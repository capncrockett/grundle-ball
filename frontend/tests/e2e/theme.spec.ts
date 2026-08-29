import { expect, test } from '@playwright/test';

const THEME_KEY = 'grundle-ball-theme';

const getTheme = async (page: import('@playwright/test').Page) =>
  page.evaluate(() => document.documentElement.getAttribute('data-theme'));

const getStoredTheme = async (page: import('@playwright/test').Page) =>
  page.evaluate((key) => localStorage.getItem(key), THEME_KEY);

test.describe('Theme selection', () => {
  test('switches theme and persists after reload', async ({ page }) => {
    await page.goto('/');

    const themeToggle = page.locator('header .dropdown > label').first();

    await themeToggle.click();
    await page.getByRole('button', { name: 'Retro' }).click();

    await expect.poll(() => getTheme(page)).toBe('retro');
    await expect.poll(() => getStoredTheme(page)).toBe('retro');

    await page.reload();

    await expect.poll(() => getTheme(page)).toBe('retro');
    await expect.poll(() => getStoredTheme(page)).toBe('retro');

    await themeToggle.click();
    await page.getByRole('button', { name: 'Cupcake' }).click();

    await expect.poll(() => getTheme(page)).toBe('cupcake');
    await expect.poll(() => getStoredTheme(page)).toBe('cupcake');
  });
});
