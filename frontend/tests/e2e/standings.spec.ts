import { expect, test } from '@playwright/test';
import type { SleeperLeague, SleeperRoster } from '../../src/api/sleeper';
import { LEAGUE_ID } from '../../src/config/league';
import {
  mockSleeperLeague,
  mockSleeperRosters,
  mockSleeperUsers,
} from '../../src/test/fixtures/sleeper';

const preseasonLeague: SleeperLeague = {
  ...mockSleeperLeague,
  league_id: LEAGUE_ID,
  season: '2026',
  season_type: 'pre',
  status: 'pre_draft',
  settings: { playoff_week_start: 15, divisions: 3 },
  metadata: {
    division_1: 'D1',
    division_2: 'D2',
    division_3: 'D3',
  },
};

const preseasonRosters: SleeperRoster[] = mockSleeperRosters.map((roster, index) => ({
  ...roster,
  league_id: LEAGUE_ID,
  division_id: undefined,
  settings: {
    ...roster.settings,
    division: (index % 3) + 1,
    wins: 0,
    losses: 0,
    ties: 0,
    fpts: 0,
    fpts_decimal: 0,
    fpts_against: 0,
    fpts_against_decimal: 0,
  },
}));

test.describe('Standings page with preseason divisions', () => {
  test('shows division lineups without inventing seeds or performance stats', async ({ page }) => {
    await page.route(`**/league/${LEAGUE_ID}**`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(preseasonLeague),
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
        body: JSON.stringify(preseasonRosters),
      }),
    );
    await page.goto('/standings');

    const preseason = page.getByTestId('division-preseason');
    await expect(
      preseason.getByRole('heading', { name: /2026 preseason divisions/i }),
    ).toBeVisible();
    await expect(preseason.getByRole('heading', { name: 'D1' })).toBeVisible();
    await expect(preseason.getByRole('heading', { name: 'D2' })).toBeVisible();
    await expect(preseason.getByRole('heading', { name: 'D3' })).toBeVisible();
    await expect(preseason.locator('.card')).toHaveCount(3);
    await expect(preseason.getByText("Big Ol' TDs")).toBeVisible();

    await expect(page.getByRole('columnheader', { name: /^Seed$/i })).toHaveCount(0);
    await expect(page.getByText(/Toughest Schedule/i)).toHaveCount(0);
    await expect(page.getByText(/Standings Glossary/i)).toHaveCount(0);
  });
});
