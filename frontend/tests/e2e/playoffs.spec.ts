import { expect, test } from '@playwright/test';
import {
  mockPlayoffLosersBracket,
  mockPlayoffWinnersBracket,
  mockSleeperLeague,
  mockSleeperRosters,
  mockSleeperUsers,
} from '../../src/test/fixtures/sleeper';
import { LEAGUE_ID } from '../../src/config/league';

test.describe('Playoffs bracket layout', () => {
  test('preview race controls and Toilet Bowl fit, and live avatars stay inside cards', async ({
    page,
  }, testInfo) => {
    // The bare league route is anchored with a regex (path ends right after
    // the league id, optional query string only) so it can never also match
    // the /users, /rosters, /winners_bracket, /losers_bracket sub-paths,
    // regardless of Playwright's route registration/matching order.
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
    await page.route(`**/league/${LEAGUE_ID}/winners_bracket**`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockPlayoffWinnersBracket),
      }),
    );
    await page.route(`**/league/${LEAGUE_ID}/losers_bracket**`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockPlayoffLosersBracket),
      }),
    );
    await page.route(new RegExp(`/league/${LEAGUE_ID}(\\?.*)?$`), (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockSleeperLeague),
      }),
    );

    await page.route('**/state/nfl**', (route) =>
      route.fulfill({ json: { season: mockSleeperLeague.season, week: 13 } }),
    );
    await page.goto('/playoffs');
    await expect(
      page.getByRole('heading', { name: 'Championship Bracket', exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'If Today', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Projected Championship Bracket', exact: true }),
    ).toBeVisible();
    for (const title of ['Bubble Watch', 'Bye Chase', 'Division Races']) {
      const panel = page
        .locator('details')
        .filter({ has: page.locator('summary', { hasText: title }) });
      const summary = panel.locator('summary');
      await expect(summary.getByTestId('race-chevron')).toBeVisible();
      if (testInfo.project.name === 'iphone-12') {
        await expect(summary.getByText('Expand', { exact: true })).toBeHidden();
      } else {
        await expect(summary.getByText('Expand', { exact: true })).toBeVisible();
      }
      await summary.click();
      await expect(panel).toHaveAttribute('open', '');
      if (testInfo.project.name !== 'iphone-12') {
        await expect(summary.getByText('Collapse', { exact: true })).toBeVisible();
        await expect(summary.getByText('Expand', { exact: true })).toBeHidden();
      }
      await expect(panel.locator('ul').first()).toBeVisible();
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await expect(
      page.getByRole('heading', { name: 'Projected Toilet Bowl', exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId('projected-last-place')).toContainText(
      'Projected King (Last Place):',
    );
    const toilet = page.getByRole('region', { name: 'Projected Toilet Bowl', exact: true });
    await expect(toilet.getByText('BYE', { exact: true })).toHaveCount(2);
    await expect(toilet.getByText('Last Place', { exact: true })).toBeVisible();
    await expect(toilet.getByText(/Decides 11th \/ 12th/)).toBeVisible();
    await page.getByRole('button', { name: 'Live Playoffs', exact: true }).click();

    // Roster 1 (user1, "Big Ol' TDs") has a round-1 bye in the winners bracket
    // fixture, so its card renders a real team avatar next to a BYE row.
    const avatar = page.locator('img[alt="Big Ol\' TDs"]').first();
    await expect(avatar).toBeVisible();

    // "card-body" also contains the substring "card", so match on
    // "card-compact" (only the outer rounded card carries that class) to
    // avoid grabbing the nearer, non-rounded card-body ancestor instead.
    const card = avatar.locator('xpath=ancestor::div[contains(@class,"card-compact")][1]');
    await expect(card).toBeVisible();

    const cardBox = await card.boundingBox();
    const avatarBox = await avatar.boundingBox();
    if (!cardBox || !avatarBox) {
      throw new Error('Expected both the card and avatar to have a bounding box');
    }

    // The card's top-left corner is a curve, not a right angle: a child can
    // sit inside the card's rectangular bounding box while still being
    // visually clipped by that curve. Clearing the corner's own radius on
    // both axes is a sufficient guarantee the avatar's square box never
    // crosses into the curved region. A tighter check (only one axis needs
    // to clear the radius, verified against the exact circle the curve
    // traces) was tried and reverted: it judged the original, confirmed-
    // clipped layout as safe, so real corner-radius rendering (anti-
    // aliasing/softening at the edge) is less forgiving than the pure math.
    const cornerRadius = await card.evaluate((el) => {
      const radius = parseFloat(getComputedStyle(el).borderTopLeftRadius);
      return Number.isNaN(radius) ? 0 : radius;
    });

    const leftMargin = avatarBox.x - cardBox.x;
    const topMargin = avatarBox.y - cardBox.y;
    const rightMargin = cardBox.x + cardBox.width - (avatarBox.x + avatarBox.width);
    const bottomMargin = cardBox.y + cardBox.height - (avatarBox.y + avatarBox.height);

    expect(leftMargin).toBeGreaterThanOrEqual(cornerRadius);
    expect(topMargin).toBeGreaterThanOrEqual(cornerRadius);
    expect(rightMargin).toBeGreaterThanOrEqual(0);
    expect(bottomMargin).toBeGreaterThanOrEqual(0);

    // The card's bottom-left corner is curved too: the second row's BYE
    // label must clear it on the same terms as the avatar clears the top.
    const byeLabel = card.locator('[title="BYE"]').first();
    await expect(byeLabel).toBeVisible();
    const byeBox = await byeLabel.boundingBox();
    if (!byeBox) {
      throw new Error('Expected the BYE label to have a bounding box');
    }
    const bottomCornerRadius = await card.evaluate((el) => {
      const radius = parseFloat(getComputedStyle(el).borderBottomLeftRadius);
      return Number.isNaN(radius) ? 0 : radius;
    });
    const byeLeftMargin = byeBox.x - cardBox.x;
    const byeBottomMargin = cardBox.y + cardBox.height - (byeBox.y + byeBox.height);

    expect(byeLeftMargin).toBeGreaterThanOrEqual(bottomCornerRadius);
    expect(byeBottomMargin).toBeGreaterThanOrEqual(bottomCornerRadius);
  });
});
