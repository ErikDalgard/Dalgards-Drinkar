import { test, expect } from '@playwright/test';

const drinks = [
  { id: 1, date: '2025-11-18', drink: 'Vinterdrink', theme: 'Vinter', photo: 'winter-photo.jpg' },
  { id: 2, date: '2026-03-10', drink: 'Ny vårdrink', theme: 'Vår', photo: 'spring-photo.jpg' },
  { id: 3, date: '2026-02-01', drink: 'Äldre vårdrink', theme: 'Vår' },
  { id: 4, date: '2026-01-05', drink: 'Temalös drink', theme: '' },
];

test('timeline shows drinks grouped by descending year and theme without losing drafts', async ({ page }) => {
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin === 'http://localhost:8787') {
      if (url.pathname === '/admin/verify') return route.fulfill({ json: { success: true } });
      if (url.pathname === '/drinks') return route.fulfill({ json: drinks });
      if (url.pathname === '/spirits') return route.fulfill({ json: [] });
    }
    if (url.origin === 'http://127.0.0.1:4173') return route.continue();
    return route.abort();
  });

  await page.goto('/admin.html');
  await page.locator('#admin-key-input').fill('test-only');
  await page.locator('#key-save').click();
  await expect(page.locator('.admin-timeline-year-title')).toHaveCount(2);
  await expect(page.locator('#admin-timeline-intro')).toHaveText(
    'Ni har under åren gjort 4 drinkar med 2 olika teman! Här kan ni kika igenom tidslinjen för Dalgards drinkar.',
  );

  await page.locator('#f-drink').fill('Osparat utkast');
  await page.locator('[data-admin-mode="timeline"]').click();

  await expect(page.locator('#admin-timeline-view')).toBeVisible();
  await expect(page.locator('.admin-timeline-years')).toHaveCount(1);
  await expect(page.locator('#admin-drinks-view')).toBeHidden();
  await expect(page.locator('#admin-filters-view')).toBeHidden();
  await expect(page.locator('.admin-timeline-year-label')).toHaveText(['2026', '2025']);
  await expect(page.locator('.admin-timeline-theme-label')).toHaveText([
    'Vår',
    'Övrigt',
    'Vinter',
  ]);
  await expect(page.locator('.admin-timeline-year[open]')).toHaveCount(0);
  await expect(page.locator('.admin-timeline-group[open]')).toHaveCount(0);
  await expect(page.locator('.admin-timeline-group').first()).toHaveAttribute('style', /--theme-hue:/);
  await expect(page.locator('.admin-timeline-drink-name')).toHaveText([
    'Ny vårdrink',
    'Äldre vårdrink',
    'Temalös drink',
    'Vinterdrink',
  ]);

  const firstDrinkLink = page.locator('.admin-timeline-drink-link').first();
  await expect(firstDrinkLink).toHaveAttribute('href', /index\.html\?drink=2$/);
  await expect(firstDrinkLink.locator('img')).toHaveAttribute('src', /spring-photo\.jpg$/);

  const newestYear = page.locator('.admin-timeline-year').first();
  await expect(newestYear.locator('.admin-timeline-group')).toHaveCount(2);
  await newestYear.locator('.admin-timeline-year-title').click();
  await expect(newestYear.locator('.admin-timeline-group').first()).toBeVisible();
  const newestTheme = newestYear.locator('.admin-timeline-group').first();
  await expect(newestTheme.locator('.admin-timeline-drinks')).toBeHidden();
  await newestTheme.locator('.admin-timeline-theme').click();
  await expect(newestTheme.locator('.admin-timeline-drinks')).toBeVisible();
  await expect(newestTheme.locator('.admin-timeline-drinks')).toHaveClass(/has-multiple-drinks/);
  await newestTheme.locator('.admin-timeline-theme').click();
  await expect(newestTheme.locator('.admin-timeline-drinks')).toBeHidden();
  await newestYear.locator('.admin-timeline-year-title').click();
  await expect(newestYear.locator('.admin-timeline-group').first()).toBeHidden();

  await page.locator('[data-admin-mode="add"]').click();
  await expect(page.locator('#f-drink')).toHaveValue('Osparat utkast');
});
