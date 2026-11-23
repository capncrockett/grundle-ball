import { expect, test } from '@playwright/test';
import snapshot from '../../src/data/sisterLeagueSnapshot.json' with { type: 'json' };

test('Sister League standings, races, and scoring work without live APIs', async ({
  page,
}, testInfo) => {
  const apiRequests: string[] = [];
  await page.route(/https:\/\/[^/]*(?:sleeper\.app|espn\.com)\//, (route) => {
    apiRequests.push(new URL(route.request().url()).hostname);
    return route.abort();
  });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/sister-league');
  await expect(page.getByRole('heading', { name: snapshot.leagueName, exact: true })).toBeVisible();
  const standings = page.getByRole('table', { name: 'Standings' });
  await expect(standings.getByRole('row')).toHaveCount(snapshot.teams.length + 1);
  await expect(standings.getByRole('columnheader', { name: 'Playoffs' })).toBeVisible();
  await expect(
    page.getByRole('navigation').getByRole('link', { name: /sister league/i }),
  ).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: testInfo.outputPath('sister-standings.png') });

  for (const name of ['Bubble Watch', 'Bye Chase']) {
    const panel = page.getByRole('region', { name, exact: true });
    const card = panel.locator('details').first();
    const summary = card.locator('summary');
    await expect(summary).toBeVisible();
    await summary.focus();
    await summary.press('Enter');
    await expect(card).toHaveAttribute('open', '');
    await expect(card.getByText(/Most likely finish:/)).toBeVisible();
    await expect(card.getByLabel(/Odds by remaining record/)).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await card.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: testInfo.outputPath(`sister-${name === 'Bubble Watch' ? 'bubble' : 'bye'}.png`),
    });
    await summary.press('Enter');
    await expect(card).not.toHaveAttribute('open', '');
  }

  const scoring = page.getByRole('region', { name: 'Season scoring' });
  await scoring.scrollIntoViewIfNeeded();
  await expect(scoring.getByRole('row')).toHaveCount(snapshot.teams.length + 1);
  await page.screenshot({ path: testInfo.outputPath('sister-scoring.png') });
  expect(apiRequests).toEqual([]);
  expect(errors).toEqual([]);
});
