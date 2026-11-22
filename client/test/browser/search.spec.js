import { readFileSync } from "node:fs";
const spirits = JSON.parse(readFileSync(new URL("../spirits.json", import.meta.url), "utf8"));
import { test, expect } from '@playwright/test';
const base = { theme: 'Klassiker', url: 'test.mp4', photo: '', note: '', ingredients: '6 cl gin;1 cl vermouth', steps: 'Rör med is;Sila', taste: '', servings: 2 };
const drinks = [
  { ...base, id: 101, drink: 'Dry Martini', date: '2025-01-01', note: 'Den äldre versionen' },
  { ...base, id: 202, drink: 'Dry Martini', date: '2026-01-02', note: 'Den nyare versionen' },
  ...Array.from({ length: 24 }, (_, i) => ({ ...base, id: 300 + i, drink: `Martini variant ${i + 1}`, date: '2024-01-01' })),
  { ...base, id: 999, drink: 'Gin & Vodka Sour', date: '2023-01-01', ingredients: '6 cl gin||4 cl vodka', steps: 'Rör||Skaka', servings: [2, 4] },
];
test.beforeEach(async ({ page }) => {
  // Only the local static site and this fixture response are allowed.
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === 'http://localhost:8787' && url.pathname === '/spirits') {
      await route.fulfill({ json: spirits });
    } else if (url.origin === 'http://localhost:8787' && url.pathname === '/drinks') {
      await route.fulfill({ json: drinks });
    } else if (url.origin === 'http://127.0.0.1:4173') {
      await route.continue();
    } else { await route.abort(); }
  });
  await page.goto('/');
  await expect(page.locator('#grid .card')).toHaveCount(24);
});
test('clears the search query with the search field button', async ({ page }) => {
  const search = page.getByRole('combobox', { name: 'Sök efter en drink' });
  const clearButton = page.getByRole('button', { name: 'Rensa sökning' });
  await expect(clearButton).toBeHidden();

  await search.fill('Dry Martini');
  await expect(clearButton).toBeVisible();
  await expect(page.locator('#grid .card')).toHaveCount(2);

  await clearButton.click();
  await expect(search).toHaveValue('');
  await expect(search).toBeFocused();
  await expect(clearButton).toBeHidden();
  await expect(page.locator('#grid .card')).toHaveCount(24);
});
test('selects the correct duplicate name by date and opens its recipe and URL', async ({ page }) => {
  await page.getByRole('combobox', { name: 'Sök efter en drink' }).fill('dry martini');
  const options = page.getByRole('listbox', { name: 'Drinkförslag' }).getByRole('option');
  await expect(options).toHaveCount(2);
  await expect(options.nth(1)).toContainText('1 januari 2025');
  await options.nth(1).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('#modal-drink')).toHaveText('Dry Martini');
  await expect(page.locator('#modal-note')).toHaveText('Den äldre versionen');
  await expect(page.locator('#recipe-block')).toContainText('6 cl gin');
  await expect(page.locator('#modal-servings')).toHaveValue('2');
  await expect(page.locator('.recipe-shopping .recipe-portions')).toBeVisible();
  await page.getByRole('button', { name: 'Öka portioner' }).first().click();
  await page.getByRole('button', { name: 'Öka portioner' }).first().click();
  await expect(page.locator('#modal-servings')).toHaveValue('4');
  await expect(page.locator('#recipe-block')).toContainText('12 cl gin');
  await page.locator('#modal-servings').fill('5');
  await page.getByRole('button', { name: 'Minska portioner' }).click();
  await expect(page.locator('#recipe-block')).toContainText('12 cl gin');
  await expect(page).toHaveURL((url) => url.searchParams.get("drink") === "101");
  await expect(page.locator('#search-suggestions')).toBeHidden();
  await page.goBack();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Sök efter en drink' })).toHaveValue('dry martini');
});
test('each drink variant has an independent portions counter', async ({ page }) => {
  await page.getByRole('combobox', { name: 'Sök efter en drink' }).fill('Gin & Vodka Sour');
  await page.getByRole('listbox', { name: 'Drinkförslag' }).getByRole('option').first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('.recipe-portions')).toHaveCount(2);
  await expect(page.locator('#modal-servings')).toHaveValue('2');
  await expect(page.locator('#modal-servings-2')).toHaveValue('4');

  const headings = page.locator('.recipe-shopping .recipe-heading, .recipe-method .recipe-heading');
  await expect(headings).toHaveCount(4);
  const ingredientHeadingStyle = await headings.nth(0).evaluate((element) => {
    const style = getComputedStyle(element);
    return [style.fontFamily, style.fontSize, style.fontWeight];
  });
  const methodHeadingStyle = await headings.nth(1).evaluate((element) => {
    const style = getComputedStyle(element);
    return [style.fontFamily, style.fontSize, style.fontWeight];
  });
  expect(ingredientHeadingStyle).toEqual(methodHeadingStyle);
  const [buttonColor, themeGreen] = await page.locator('.recipe-portions-button').first().evaluate((element) => [
    getComputedStyle(element).backgroundColor,
    getComputedStyle(document.documentElement).getPropertyValue('--leaf').trim(),
  ]);
  expect(buttonColor).toBe('rgb(107, 118, 84)');
  expect(themeGreen).toBe('#6b7654');

  await page.locator('#modal-servings').fill('6');
  await expect(page.locator('.recipe-shopping').first()).toContainText('18 cl gin');
  await expect(page.locator('.recipe-shopping').nth(1)).toContainText('4 cl vodka');
  await page.locator('#modal-servings-2').fill('8');
  await expect(page.locator('.recipe-shopping').first()).toContainText('18 cl gin');
  await expect(page.locator('.recipe-shopping').nth(1)).toContainText('8 cl vodka');
});
test('opens the correct suggestion with ArrowDown and Enter', async ({ page }) => {
  const search = page.getByRole('combobox', { name: 'Sök efter en drink' });
  await search.fill('dry martini');
  await search.press('ArrowDown');
  await search.press('Enter');
  await expect(page.locator('#modal-note')).toHaveText('Den nyare versionen');
  await expect(page).toHaveURL((url) => url.searchParams.get("drink") === "202");
  await page.getByRole('button', { name: 'Stäng drink', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
});
test('caps scrollable suggestions and closes them without clearing search', async ({ page }) => {
  await page.getByRole('combobox', { name: 'Sök efter en drink' }).fill('martini');
  await expect(page.getByRole('listbox', { name: 'Drinkförslag' }).getByRole('option')).toHaveCount(20);
  await expect(page.locator('#search-suggestions-summary')).toHaveText('Visar 20 av 26 förslag');
  const scrollable = await page.locator('#search-suggestion-list').evaluate(el => el.scrollHeight > el.clientHeight);
  expect(scrollable).toBe(true);
  await page.getByRole('button', { name: 'Stäng sökförslag' }).click();
  await expect(page.locator('#search-suggestions')).toBeHidden();
  await expect(page.getByRole('combobox', { name: 'Sök efter en drink' })).toHaveValue('martini');
  await page.getByRole('combobox', { name: 'Sök efter en drink' }).click();
  await expect(page.locator('#search-suggestions')).toBeVisible();
  await page.getByRole('combobox', { name: 'Sök efter en drink' }).press('Escape');
  await expect(page.locator('#search-suggestions')).toBeHidden();
});


test('loading more drinks and closing a modal keeps all visible drinks', async ({ page }) => {
  await expect(page.locator('#count')).toHaveText('Visar 24 av 27 drinkar');
  await page.getByRole('button', { name: 'Visa fler drinkar', exact: true }).click();
  await expect(page.locator('#grid .card')).toHaveCount(27);
  await expect(page.locator('#count')).toHaveText('Visar 27 av 27 drinkar');
  await expect(page.locator('#pagination')).toBeEmpty();
  await page.locator('#grid .card-open').first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.locator('#grid .card')).toHaveCount(27);
  await expect(page.locator('#count')).toHaveText('Visar 27 av 27 drinkar');
});
