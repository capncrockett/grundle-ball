import {
  computeSisterLeagueSeedRanges,
  type SisterLeagueMatchup,
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

const game = (week: number, homeTeamId: number, awayTeamId: number): SisterLeagueMatchup => ({
  week,
  homeTeamId,
  awayTeamId,
  homePoints: 0,
  awayPoints: 0,
  final: false,
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
  it('rules out results the schedule makes impossible', () => {
    // Both leaders and both 4-4 teams play each other in week 9, so they
    // cannot all lose (or all win) together.
    const ranges = computeSisterLeagueSeedRanges(
      snapshot([team(1, 1, 6, 2), team(2, 2, 6, 2), team(3, 3, 4, 4), team(4, 4, 4, 4)], {
        regularSeasonWeeks: 10,
        matchups: [game(9, 1, 2), game(9, 3, 4), game(10, 1, 3), game(10, 2, 4)],
      }),
    );

    expect(ranges.map((range) => [range.teamId, range.label])).toEqual([
      [1, '1-3'],
      [2, '1-3'],
      [3, '2-4'],
      [4, '2-4'],
    ]);
  });

  it('flags clinched and eliminated teams against the playoff cut', () => {
    const ranges = computeSisterLeagueSeedRanges(
      snapshot([team(1, 1, 12, 0), team(2, 2, 9, 3), team(3, 3, 8, 4), team(4, 4, 2, 10)], {
        playoffTeamCount: 2,
        matchups: [game(13, 1, 2), game(13, 3, 4), game(14, 1, 3), game(14, 2, 4)],
      }),
    );

    expect(ranges.find((range) => range.teamId === 1)).toMatchObject({
      clinched: true,
      eliminated: false,
    });
    expect(ranges.find((range) => range.teamId === 4)).toMatchObject({
      clinched: false,
      eliminated: true,
    });
  });

  it('breaks record ties toward the team in its best case and against it in its worst case', () => {
    // If Team 1 loses and Team 2 wins, both finish 8-3; points are not final yet.
    const ranges = computeSisterLeagueSeedRanges(
      snapshot(
        [team(1, 1, 8, 2, 1200), team(2, 2, 7, 3, 900), team(3, 3, 1, 9), team(4, 4, 0, 10)],
        {
          regularSeasonWeeks: 11,
          matchups: [game(11, 1, 3), game(11, 2, 4)],
        },
      ),
    );

    expect(ranges.map((range) => range.label)).toEqual(['1-2', '1-2', '3-4', '3-4']);
  });

  it('falls back to the schedule-free bound when the schedule is incomplete', () => {
    // Four games remain per the records, but the snapshot has no schedule.
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

  it('locks every team to its ESPN seed once the regular season is complete', () => {
    const ranges = computeSisterLeagueSeedRanges(
      snapshot([team(1, 1, 10, 4, 1500), team(2, 2, 10, 4, 1400)], { regularSeasonWeeks: 14 }),
    );

    expect(ranges.map((range) => range.label)).toEqual(['1-1', '2-2']);
  });
});
