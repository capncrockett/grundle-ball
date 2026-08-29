import {
  findMatchupForTeam,
  getLatestCompletedWeek,
  getMatchupMarginsForWeek,
  getStoredMatchups,
  MATCHUP_HISTORY,
  selectMatchupsForScope,
} from './matchupHistory';
import type { StoredMatchup } from './matchupHistoryTypes';

const LEGACY_SCOPE = {
  leagueId: '1251950356187840512',
  season: '2025',
};

const scopedMatchup = (
  matchup: Omit<StoredMatchup, 'leagueId' | 'season'>,
  scope = LEGACY_SCOPE,
): StoredMatchup => ({ ...scope, ...matchup });

describe('matchupHistory store', () => {
  it('normalizes names when building margins', () => {
    const margins = getMatchupMarginsForWeek(14, getStoredMatchups(LEGACY_SCOPE));
    expect(margins.get("Big Ol' TDs")).toBeDefined();
    expect(margins.get("big ol' tds")).toEqual(margins.get("Big Ol' TDs"));
  });

  it('finds matchups by week and falls back to earliest entry', () => {
    const sample: StoredMatchup[] = [
      scopedMatchup({
        week: 1,
        team: 'Alpha',
        opponent: 'Beta',
        pointsFor: 100,
        pointsAgainst: 90,
        margin: 10,
        finished: true,
      }),
      scopedMatchup({
        week: 2,
        team: 'Gamma',
        opponent: 'Beta',
        pointsFor: 101,
        pointsAgainst: 110,
        margin: -9,
        finished: true,
      }),
      scopedMatchup({
        week: 1,
        team: 'Beta',
        opponent: 'Alpha',
        pointsFor: 90,
        pointsAgainst: 100,
        margin: -10,
        finished: true,
      }),
      scopedMatchup({
        week: 2,
        team: 'Beta',
        opponent: 'Gamma',
        pointsFor: 110,
        pointsAgainst: 101,
        margin: 9,
        finished: true,
      }),
    ];

    expect(findMatchupForTeam('beta', { week: 1, matchups: sample })?.opponent).toBe('Alpha');
    expect(findMatchupForTeam('beta', { matchups: sample })?.week).toBe(1);
  });

  it('ignores unfinished weeks when determining latest completed week', () => {
    const unfinishedWeek: StoredMatchup[] = [
      ...MATCHUP_HISTORY,
      scopedMatchup({
        week: 15,
        team: 'Alpha',
        opponent: 'Beta',
        pointsFor: 100,
        pointsAgainst: 90,
        margin: 10,
        finished: false,
      }),
      scopedMatchup({
        week: 15,
        team: 'Beta',
        opponent: 'Alpha',
        pointsFor: 90,
        pointsAgainst: 100,
        margin: -10,
        finished: false,
      }),
    ];

    expect(getLatestCompletedWeek(unfinishedWeek)).toBe(14);

    const completedWeek = unfinishedWeek.map((matchup) =>
      matchup.week === 15 ? { ...matchup, finished: true } : matchup,
    );
    expect(getLatestCompletedWeek(completedWeek)).toBe(15);
  });

  it('selects only the requested league and season when week numbers overlap', () => {
    const shared = {
      week: 1,
      team: 'Alpha',
      opponent: 'Beta',
      pointsFor: 100,
      pointsAgainst: 90,
      margin: 10,
      finished: true,
    };
    const matchups = [
      scopedMatchup(shared, { leagueId: 'league-a', season: '2025' }),
      scopedMatchup({ ...shared, margin: 20 }, { leagueId: 'league-a', season: '2026' }),
      scopedMatchup({ ...shared, margin: 30 }, { leagueId: 'league-b', season: '2026' }),
    ];

    const selected = selectMatchupsForScope(matchups, {
      leagueId: 'league-a',
      season: '2026',
    });

    expect(selected).toHaveLength(1);
    expect(selected[0]?.margin).toBe(20);
  });
});
