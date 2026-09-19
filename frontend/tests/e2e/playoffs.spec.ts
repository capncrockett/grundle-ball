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
  test('team avatar stays fully inside its bracket card', async ({ page }) => {
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

    await page.goto('/playoffs');

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
    // both axes is a sufficient (if conservative) guarantee the avatar's
    // square box never crosses into the curved region.
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
