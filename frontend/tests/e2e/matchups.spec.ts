import { expect, test } from '@playwright/test';
import {
  mockSleeperUsers,
  mockSleeperRosters,
  mockSleeperMatchupsWeek13,
  mockNFLState,
  mockSleeperPlayers,
} from '../../src/test/fixtures/sleeper';
import { mockESPNScoreboard } from '../../src/test/fixtures/espn';
import type { SleeperMatchup } from '../../src/api/sleeper';
import { LEAGUE_ID } from '../../src/config/league';

const week14Matchups: SleeperMatchup[] = [
  {
    roster_id: 1,
    matchup_id: 1,
    points: 200,
    starters: ['player1'],
    players: ['player1'],
  },
  {
    roster_id: 2,
    matchup_id: 1,
    points: 150,
    starters: ['player11'],
    players: ['player11'],
  },
];

test.describe('Matchups page with mocked data', () => {
  test('loads fixture data and updates when changing weeks', async ({ page }) => {
    await page.route('**/state/nfl**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockNFLState),
      }),
    );
    await page.route(`**/league/${LEAGUE_ID}/users`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockSleeperUsers),
      }),
    );
    await page.route(`**/league/${LEAGUE_ID}/rosters`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockSleeperRosters),
      }),
    );
    await page.route(`**/league/${LEAGUE_ID}/matchups/**`, (route) => {
      const url = new URL(route.request().url());
      const weekSegment = url.pathname.split('/').pop() ?? '';
      const week = Number(weekSegment);
      const payload = week === 14 ? week14Matchups : mockSleeperMatchupsWeek13;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(payload),
      });
    });
    await page.route('**/players/nfl', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockSleeperPlayers),
      }),
    );
    await page.route('**/apis/site/v2/sports/football/nfl/scoreboard**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockESPNScoreboard),
      }),
    );

    await page.goto('/matchups');

    const weekSelect = page.getByRole('combobox');

    await expect(page.getByRole('heading', { name: /matchups/i })).toBeVisible();
    await expect(page.getByText('2025 • Week 13')).toBeVisible();
    const matchupHeaders = page.locator('text=/Matchup #/');
    await expect(matchupHeaders).toHaveCount(6);

    await weekSelect.selectOption('14');

    await expect(page.getByText('Matchup #1-2')).toBeVisible();
    await expect(matchupHeaders).toHaveCount(1);
    await expect(page.getByText('200.00')).toBeVisible();
  });
});
