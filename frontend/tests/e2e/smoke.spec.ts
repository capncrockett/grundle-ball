import { expect, test } from '@playwright/test';

const routes = [
  { path: '/', heading: /^standings$/i },
  { path: '/playoffs', heading: /^playoffs$/i },
  { path: '/standings', heading: /^standings$/i },
  { path: '/constitution', heading: /grundle league constitution/i },
  { path: '/beta/grundle-bowl/live', heading: /live playoffs/i },
  { path: '/beta/grundle-bowl/if-today', heading: /if the season ended today/i },
];

test.describe('Happy path smoke', () => {
  test.beforeAll(({}, workerInfo) => {
    const baseURL = workerInfo.project.use?.baseURL ?? 'undefined';
    console.log(`[e2e] Using baseURL: ${baseURL}`);
  });

  test('renders header/footer on home', async ({ page }) => {
    await page.goto('/');

    // Home redirects to the standings page.
    await expect(page).toHaveURL(/\/standings/);
    await expect(page).toHaveTitle('Grundle Ball');
    await expect(page.getByRole('heading', { name: /^standings$/i })).toBeVisible();
    await expect(page.getByRole('banner')).toBeVisible();
    await expect(page.getByRole('contentinfo')).toContainText(/grundle ball/i);
  });

  routes.forEach(({ path, heading }) => {
    test(`loads ${path} and shows primary heading`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole('heading', { name: heading })).toBeVisible();
    });
  });

  test('desktop nav links change routes', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.includes('iphone'), 'Nav labels are hidden on mobile width');

    await page.goto('/');
    await page.getByRole('link', { name: /^playoffs$/i }).click();
    await expect(page).toHaveURL(/\/playoffs$/);
    await expect(page.getByRole('heading', { name: /^playoffs$/i })).toBeVisible();

    await page.getByRole('link', { name: /constitution/i }).click();
    await expect(page).toHaveURL(/\/constitution/);
    await expect(page.getByRole('heading', { name: /grundle league constitution/i })).toBeVisible();

    await page.getByRole('link', { name: /grundle bowl/i }).click();
    await expect(page).toHaveURL(/\/beta\/grundle-bowl\/live/);
    await expect(page.getByRole('heading', { name: /live playoffs/i })).toBeVisible();
  });

  test('shows compact nav on mobile', async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.includes('iphone'), 'Mobile-only coverage');

    await page.goto('/');

    await expect(page.getByText(/^Grundle Ball$/)).toBeVisible();
    await expect(page.locator('nav a')).toHaveCount(5);
  });

  test('constitution TOC jumps to section anchors', async ({ page }) => {
    await page.goto('/constitution');

    await expect(page.getByRole('heading', { name: /grundle league constitution/i })).toBeVisible();
    await page.getByRole('navigation', { name: /constitution table of contents/i }).getByRole('link', { name: /^keepers$/i }).click();
    await expect(page).toHaveURL(/#keepers/);
    await expect(page.locator('#keepers')).toBeVisible();
  });

  test('surfaces API errors as overlays', async ({ page }) => {
    await page.route('**/apis/site/v2/sports/football/nfl/scoreboard**', (route) =>
      route.fulfill({ status: 500, body: 'forced failure' }),
    );

    await page.goto('/matchups');

    await expect(page.getByText(/ESPN API error/i)).toBeVisible();
  });
});
