import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { renderRecipeGroups, renderTasteProfile } from '../../public/js/recipes.js';

function withRecipe(callback) {
  const dom = new JSDOM('<div id="recipe-groups"></div>');
  globalThis.document = dom.window.document;
  try { callback(dom.window.document); }
  finally { delete globalThis.document; dom.window.close(); }
}
test('recipe headings become subsections rather than ingredients or numbered steps', () => withRecipe(document => {
  renderRecipeGroups('# Drinken;5 cl gin;# Bärsyrup;150 g bär;½ dl vatten', '# Bärsyrup;Koka;Låt svalna;# Drinken;Skaka;Sila', 'Testdrink');
  assert.deepEqual([...document.querySelectorAll('.recipe-shopping h4')].map(el => el.textContent), ['Drinken', 'Bärsyrup']);
  assert.deepEqual([...document.querySelectorAll('.recipe-method h4')].map(el => el.textContent), ['Bärsyrup', 'Drinken']);
  assert.deepEqual([...document.querySelectorAll('ul')].map(el => el.children.length), [1, 2]);
  // Each method section gets its own ordered list, restarting at 1.
  assert.deepEqual([...document.querySelectorAll('ol')].map(el => el.children.length), [2, 2]);
  assert.deepEqual([...document.querySelectorAll('ol li')].map(el => el.textContent), ['Koka', 'Låt svalna', 'Skaka', 'Sila']);
}));
test('plain recipes and legacy multiple recipes still render normally', () => withRecipe(document => {
  renderRecipeGroups('5 cl gin;citron||vodka', 'Skaka;Sila||Rör', 'Gin & Vodka');
  assert.equal(document.querySelectorAll('.recipe-subsection').length, 0);
  assert.deepEqual([...document.querySelectorAll('.recipe-group-label')].map(el => el.textContent), ['Gin', 'Vodka']);
  assert.equal(document.querySelectorAll('li').length, 6);
}));
test('unnamed opening items remain visible and headings render as text', () => withRecipe(document => {
  renderRecipeGroups('citron;# <img src=x onerror=alert(1)>;vatten', '# Förberedelser', 'Test');
  assert.deepEqual([...document.querySelectorAll('ul li')].map(el => el.textContent), ['citron', 'vatten']);
  assert.equal(document.querySelector('h4').textContent, '<img src=x onerror=alert(1)>');
  assert.equal(document.querySelectorAll('img').length, 0);
  assert.equal(document.querySelectorAll('ol').length, 0);
}));

test('multiple taste profiles render after their matching drink', () => {
  const dom = new JSDOM(`
    <div id="recipe-groups"></div>
    <div id="modal-drink" style="display:none">Gin Sour & Vodka Sour</div>
    <div id="taste-profile">
      <div id="taste-rows"></div>
    </div>
  `);
  globalThis.document = dom.window.document;
  try {
    renderRecipeGroups(
      '4 cl gin;citron||4 cl vodka;citron',
      'Skaka;Sila||Skaka;Sila',
      'Gin Sour & Vodka Sour',
      '3/5,4/5,0/5,4/5,0/5||4/5,2/5,0/5,3/5,0/5',
    );
    assert.deepEqual([...document.querySelectorAll('.recipe-group-label')].map(el => el.textContent), ['Gin Sour', 'Vodka Sour']);
    assert.equal(document.querySelectorAll('.recipe-taste-profile').length, 2);
  } finally {
    delete globalThis.document;
    dom.window.close();
  }
});
