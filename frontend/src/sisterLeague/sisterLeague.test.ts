import {
  computeSisterLeagueSeedRanges,
  type SisterLeagueSnapshot,
  type SisterLeagueTeam,
} from './sisterLeague';

const team = (
  id: number,
  seed: number,
  wins: number,
  losses: number,
  pointsFor = 1000,
): SisterLeagueTeam => ({
  id,
  name: `Team ${id.toString()}`,
  wins,
  losses,
  ties: 0,
  pointsFor,
  seed,
});

const snapshot = (
  teams: SisterLeagueTeam[],
  overrides: Partial<SisterLeagueSnapshot> = {},
): SisterLeagueSnapshot => ({
  leagueId: '1',
  seasonId: 2026,
  leagueName: 'Test League',
  fetchedAt: '2026-11-20T00:00:00.000Z',
  currentMatchupPeriod: 11,
  regularSeasonWeeks: 14,
  playoffTeamCount: 2,
  playoffByeCount: 0,
  teams,
  matchups: [],
  ...overrides,
});

describe('computeSisterLeagueSeedRanges', () => {
  it('bounds each seed by winning out against everyone else losing out, and the reverse', () => {
    const ranges = computeSisterLeagueSeedRanges(
      snapshot([team(1, 1, 9, 1), team(2, 2, 7, 3), team(3, 3, 5, 5), team(4, 4, 2, 8)]),
    );

    expect(ranges.map((range) => [range.teamId, range.label])).toEqual([
      [1, '1-3'],
      [2, '1-3'],
      [3, '1-4'],
      [4, '3-4'],
    ]);
  });

  it('flags clinched and eliminated teams against the playoff cut', () => {
    const ranges = computeSisterLeagueSeedRanges(
      snapshot([team(1, 1, 12, 0), team(2, 2, 9, 3), team(3, 3, 2, 10)], {
        regularSeasonWeeks: 14,
        playoffTeamCount: 2,
      }),
    );

    expect(ranges.find((range) => range.teamId === 1)).toMatchObject({
      clinched: true,
      eliminated: false,
    });
    expect(ranges.find((range) => range.teamId === 3)).toMatchObject({
      clinched: false,
      eliminated: true,
    });
  });

  it('breaks win ties toward the team in its best case and against it in its worst case', () => {
    const ranges = computeSisterLeagueSeedRanges(
      snapshot([team(1, 1, 7, 3, 1200), team(2, 2, 7, 3, 900)], { regularSeasonWeeks: 11 }),
    );

    expect(ranges.map((range) => range.label)).toEqual(['1-2', '1-2']);
  });

  it('locks every team to its ESPN seed once the regular season is complete', () => {
    const ranges = computeSisterLeagueSeedRanges(
      snapshot([team(1, 1, 10, 4, 1500), team(2, 2, 10, 4, 1400)], { regularSeasonWeeks: 14 }),
    );

    expect(ranges.map((range) => range.label)).toEqual(['1-1', '2-2']);
  });
});
