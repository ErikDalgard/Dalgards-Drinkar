import { readFileSync } from "node:fs";
const spirits = JSON.parse(readFileSync(new URL("../spirits.json", import.meta.url), "utf8"));
import { test, expect } from '@playwright/test';
const savedDrink = {
  id: 42, date: '2026-01-02', drink: 'Test Sour', theme: 'Fredag', note: 'Sparad drink',
  url: 'existing.mp4', photo: 'existing.jpeg', ingredients: '6 cl whiskey;3 cl citronjuice',
  steps: 'Skaka;Sila', taste: '', servings: 2,
};
let writes;
test.beforeEach(async ({ page }) => {
  writes = [];
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === 'http://localhost:8787') {
      if (url.pathname === '/spirits') return route.fulfill({ json: spirits });
      if (url.pathname === '/admin/verify') return route.fulfill({ json: { success: true } });
      if (url.pathname === '/drinks' && request.method() === 'GET') return route.fulfill({ json: [savedDrink] });
      writes.push({ path: url.pathname, body: request.postDataJSON() });
      return route.fulfill({ json: { success: true } });
    }
    if (url.origin === 'http://127.0.0.1:4173') return route.continue();
    return route.abort();
  });
  await page.goto('/admin.html');
  await page.locator('#admin-key-input').fill('test-only');
  const loaded = page.waitForResponse(response => response.url() === 'http://localhost:8787/drinks');
  await page.getByRole('button', { name: 'Logga in' }).click();
  await loaded;
  await expect(page.locator('#admin-panel')).toBeVisible();
});
test('required fields gate preview/save; local preview uploads nothing and retains the form', async ({ page }) => {
  const save = page.locator('#submit-btn');
  const preview = page.getByRole('button', { name: 'Förhandsgranska', exact: true });
  await expect(save).toBeDisabled();
  await expect(preview).toBeDisabled();
  await page.locator('#f-date').fill('2026-01-02');
  await page.locator('#f-drink').fill('Ny drink');
  await expect(page.locator('#f-servings')).toHaveValue('1');
  await page.locator('#f-servings').fill('2');
  await page.locator('#f-photo-file').setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aP1sAAAAASUVORK5CYII=', 'base64') });
  await expect(preview).toBeDisabled();
  await page.locator('#f-video-file').setInputFiles({ name: 'video.mp4', mimeType: 'video/mp4', buffer: Buffer.from('test-video-bytes') });
  await page.locator('#f-ingredients input').fill('6 cl whiskey');
  await page.locator('#f-steps textarea').fill('Skaka med is');
  await expect(save).toBeEnabled();
  await expect(preview).toBeEnabled();
  await preview.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('#modal-drink')).toHaveText('Ny drink');
  await expect(page.locator('.admin-preview .detail-panel')).toBeVisible();
  await expect(page.locator('.admin-preview .detail-hero')).toBeVisible();
  await expect(page.locator('#recipe-groups')).toContainText('6 cl whiskey');
  await expect(page.locator('#recipe-groups')).toContainText('Skaka med is');
  await expect(page.locator('#modal-video')).toHaveAttribute('src', /^blob:/);
  await expect(page.locator('#modal-video')).toHaveAttribute('poster', /^blob:/);
  expect(writes).toEqual([]);
  await page.getByRole('button', { name: 'Stäng förhandsgranskning' }).click();
  await expect(page.locator('#f-drink')).toHaveValue('Ny drink');
  await expect(preview).toBeFocused();
  await page.locator('#f-drink').fill('   ');
  await expect(save).toBeDisabled();
  await expect(preview).toBeDisabled();
});
test('existing media enables edit preview; saving resets action availability', async ({ page }) => {
  await page.getByRole('button', { name: 'Redigera en drink', exact: true }).click();
  await page.locator('#edit-search').fill('Test Sour');
  await page.locator('.edit-search-result').click();
  const save = page.locator('#edit-submit-btn');
  const preview = page.locator('#preview-btn');
  await expect(save).toBeEnabled();
  await expect(preview).toBeEnabled();
  await preview.click();
  await expect(page.locator('#modal-drink')).toHaveText('Test Sour');
  await expect(page.locator('#modal-video')).toHaveAttribute('src', /existing\.mp4$/);
  await expect(page.locator('#modal-video')).toHaveAttribute('poster', /existing\.jpeg$/);
  expect(writes).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.locator('#f-drink').fill('Edited Sour');
  await preview.click();
  await expect(page.locator('#modal-servings')).toHaveValue('2');
  await page.locator('#modal-servings').fill('4');
  await expect(page.locator('#recipe-groups')).toContainText('12 cl whiskey');
  await page.keyboard.press('Escape');
  await page.locator('#f-servings').fill('4');
  await save.click();
  await expect(page.locator('#submit-btn')).toBeVisible();
  await expect(page.locator('#submit-btn')).toBeDisabled();
  await expect(preview).toBeDisabled();
  expect(writes).toEqual([{ path: '/drinks/42', body: { ...savedDrink, id: undefined, drink: 'Edited Sour', servings: 4 } }]);
});

test('admin can preview and save a separate servings baseline for each drink', async ({ page }) => {
  await page.getByRole('button', { name: 'Redigera en drink', exact: true }).click();
  await page.locator('#edit-search').fill('Test Sour');
  await page.locator('.edit-search-result').click();
  await page.locator('#add-drink-variant').click();
  const variant = page.locator('.admin-variant').first();
  await variant.locator('.admin-variant-name').fill('Vodka Sour');
  await variant.locator('.variant-servings').fill('4');
  await variant.locator('#variant-ingredients-0 input').fill('4 cl vodka');
  await variant.locator('#variant-steps-0 textarea').fill('Rör');

  await page.locator('#preview-btn').click();
  await expect(page.locator('#recipe-groups .recipe-shopping')).toHaveCount(2);
  await expect(page.locator('#recipe-groups .recipe-shopping').nth(0)).toContainText('6 cl whiskey');
  await expect(page.locator('#recipe-groups .recipe-shopping').nth(1)).toContainText('4 cl vodka');
  await page.locator('#modal-servings-2').fill('8');
  await expect(page.locator('#recipe-groups .recipe-shopping').nth(0)).toContainText('6 cl whiskey');
  await expect(page.locator('#recipe-groups .recipe-shopping').nth(1)).toContainText('8 cl vodka');
  expect(writes).toEqual([]);

  await page.keyboard.press('Escape');
  await page.locator('#edit-submit-btn').click();
  expect(writes).toHaveLength(1);
  expect(writes[0].body).toMatchObject({
    drink: 'Test Sour & Vodka Sour',
    ingredients: '6 cl whiskey;3 cl citronjuice||4 cl vodka',
    steps: 'Skaka;Sila||Rör',
    servings: [2, 4],
  });
});

test('admin navigation separates views and keeps drafts when visiting filters', async ({ page }) => {
  const add = page.getByRole('button', { name: 'Lägg till drink', exact: true }).first();
  const edit = page.getByRole('button', { name: 'Redigera en drink', exact: true });
  const filters = page.getByRole('button', { name: 'Redigera filter', exact: true });
  await expect(add).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#drink-form')).toBeVisible();
  await expect(page.locator('#edit-picker-group')).toBeHidden();
  await expect(page.locator('#admin-filters-view')).toBeHidden();
  await page.locator('#f-drink').fill('Osparad drink');
  await filters.click();
  await expect(filters).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#admin-drinks-view')).toBeHidden();
  await expect(page.locator('#admin-filters-view')).toBeVisible();
  await add.click();
  await expect(page.locator('#f-drink')).toHaveValue('Osparad drink');
  page.once('dialog', dialog => dialog.accept());
  await edit.click();
  await expect(page.locator('#edit-picker-group')).toBeVisible();
  await expect(page.locator('#drink-form')).toBeHidden();
  await page.locator('#edit-search').fill('Test Sour');
  await page.locator('.edit-search-result').click();
  await expect(page.locator('#f-drink')).toHaveValue('Test Sour');
  await filters.click();
  await edit.click();
  await expect(page.locator('#f-drink')).toHaveValue('Test Sour');
  await expect(page.locator('#edit-submit-btn')).toBeVisible();
  await expect(edit).toHaveAttribute('aria-pressed', 'true');
  expect(writes).toEqual([]);
});

test('recipe headings can be added, previewed and saved using the existing API fields', async ({ page }) => {
  await page.getByRole('button', { name: 'Redigera en drink', exact: true }).click();
  await page.locator('#edit-search').fill('Test Sour');
  await page.locator('.edit-search-result').click();
  for (const kind of ['ingredients', 'steps']) {
    const first = page.locator(`#f-${kind} .admin-recipe-row`).first();
    await first.locator('select').selectOption('heading');
    await first.locator('.admin-recipe-value').fill('Drinken');
    await page.locator(`#add-${kind}-heading`).click();
    await page.locator(`#f-${kind} .admin-recipe-row`).last().locator('.admin-recipe-value').fill('Bärsyrup');
    await page.locator(`#add-${kind}`).click();
    await page.locator(`#f-${kind} .admin-recipe-row`).last().locator('.admin-recipe-value').fill(kind === 'ingredients' ? '150 g bär' : 'Koka vatten och socker');
  }
  await page.locator('#preview-btn').click();
  await expect(page.locator('#recipe-groups h4')).toHaveText(['Drinken', 'Bärsyrup', 'Drinken', 'Bärsyrup']);
  await expect(page.locator('#recipe-groups ul li')).toHaveText(['3 cl citronjuice', '150 g bär']);
  await expect(page.locator('#recipe-groups ol li')).toHaveText(['Sila', 'Koka vatten och socker']);
  expect(writes).toEqual([]);
  await page.keyboard.press('Escape');
  await page.locator('#edit-submit-btn').click();
  await expect(page.locator('#f-drink')).toHaveValue('');
  expect(writes).toHaveLength(1);
  expect(writes[0].body.ingredients).toBe('# Drinken;3 cl citronjuice;# Bärsyrup;150 g bär');
  expect(writes[0].body.steps).toBe('# Drinken;Sila;# Bärsyrup;Koka vatten och socker');
});

test('optional taste buttons gate partial profiles, render in preview and save existing API format', async ({ page }) => {
  await page.getByRole('button', { name: 'Redigera en drink', exact: true }).click();
  await page.locator('#edit-search').fill('Test Sour');
  await page.locator('.edit-search-result').click();
  const save = page.locator('#edit-submit-btn');
  await expect(page.locator('.admin-taste-fields input:checked')).toHaveCount(0);
  await expect(save).toBeEnabled();
  await page.getByRole('radio', { name: 'Sötma: 3 av 5', exact: true }).check();
  await expect(save).toBeDisabled();
  await expect(page.locator('#preview-btn')).toBeDisabled();
  for (const [name, value] of [['Syra', 4], ['Beska', 0], ['Styrka', 4], ['Sälta', 0]]) {
    await page.getByRole('radio', { name: `${name}: ${value} av 5`, exact: true }).check();
  }
  await expect(save).toBeEnabled();
  await page.locator('#preview-btn').click();
  await expect(page.locator('#taste-profile')).toBeVisible();
  const rows = page.locator('#taste-rows .taste-row');
  for (const [index, count] of [3, 4, 0, 4, 0].entries()) {
    await expect(rows.nth(index).locator('.filled')).toHaveCount(count);
  }
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Rensa smakprofil', exact: true }).click();
  await expect(page.locator('.admin-taste-fields input:checked')).toHaveCount(0);
  await expect(save).toBeEnabled();
  for (const [name, value] of [['Sötma', 3], ['Syra', 4], ['Beska', 0], ['Styrka', 4], ['Sälta', 0]]) {
    await page.getByRole('radio', { name: `${name}: ${value} av 5`, exact: true }).check();
  }
  await save.click();
  await expect(page.locator('#f-drink')).toHaveValue('');
  expect(writes).toHaveLength(1);
  expect(writes[0].body.taste).toBe('3/5,4/5,0/5,4/5,0/5');
  await expect(page.locator('.admin-taste-fields input:checked')).toHaveCount(0);
});
