import { expect, test } from '@playwright/test';
import {
  mockNFLState,
  mockSleeperMatchupsWeek13,
  mockSleeperPlayers,
  mockSleeperRosters,
  mockSleeperUsers,
} from '../../src/test/fixtures/sleeper';
import { LEAGUE_ID } from '../../src/config/league';
import { isDraftIntelHost } from '../../src/draftIntelAccess';

const routes = [
  { path: '/', heading: /^standings$/i },
  { path: '/playoffs', heading: /^playoffs$/i },
  { path: '/standings', heading: /^standings$/i },
  { path: '/history', heading: /^league history$/i },
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
    await expect(page.getByRole('contentinfo')).toContainText(/Branch:/i);
    await expect(page.getByRole('contentinfo')).toContainText(/Environment:/i);
    await expect(
      page.getByRole('contentinfo').getByRole('link', { name: /Repository:/i }),
    ).toHaveAttribute('href', 'https://github.com/capncrockett/grundle-ball');
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

    await page.getByRole('link', { name: /^history$/i }).click();
    await expect(page).toHaveURL(/\/history$/);
    await expect(page.getByRole('heading', { name: /^league history$/i })).toBeVisible();

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

    await expect(page.getByText(/^GB$/)).toBeVisible();
    await expect(page.getByText(/^Grundle Ball$/)).toBeHidden();
    const hostname = new URL(String(testInfo.project.use.baseURL)).hostname;
    await expect(page.locator('nav a:visible')).toHaveCount(isDraftIntelHost(hostname) ? 7 : 6);
  });

  test('exposes Draft Intel on its approved local or staging host', async ({ page }, testInfo) => {
    const hostname = new URL(String(testInfo.project.use.baseURL)).hostname;
    test.skip(!isDraftIntelHost(hostname), 'Draft Intel is excluded from this deployment');

    await page.goto('/local/draft-intel');

    await expect(page.getByRole('heading', { name: /^draft intel$/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /^draft intel$/i })).toBeVisible();
  });

  test('constitution TOC jumps to section anchors', async ({ page }) => {
    await page.goto('/constitution');

    await expect(page.getByRole('heading', { name: /grundle league constitution/i })).toBeVisible();
    await page
      .getByRole('navigation', { name: /constitution table of contents/i })
      .getByRole('link', { name: /^keepers$/i })
      .click();
    await expect(page).toHaveURL(/#keepers/);
    await expect(page.locator('#keepers')).toBeVisible();
  });

  test('surfaces ESPN API errors', async ({ page }) => {
    await page.route('**/state/nfl**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockNFLState),
      }),
    );
    await page.route(`**/league/${LEAGUE_ID}/users**`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockSleeperUsers),
      }),
    );
    await page.route(`**/league/${LEAGUE_ID}/rosters**`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockSleeperRosters),
      }),
    );
    await page.route(`**/league/${LEAGUE_ID}/matchups/**`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockSleeperMatchupsWeek13),
      }),
    );
    await page.route('**/players/nfl**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockSleeperPlayers),
      }),
    );
    await page.route('**/apis/site/v2/sports/football/nfl/scoreboard**', (route) =>
      route.fulfill({ status: 500, statusText: 'Internal Server Error' }),
    );

    await page.goto('/matchups');

    await expect(page.getByText(/ESPN API error/i)).toBeVisible();
  });
});
