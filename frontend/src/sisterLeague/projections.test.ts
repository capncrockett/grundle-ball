import {
  computeTeamScoring,
  leagueMedianScore,
  oddsByRemainingWins,
  rootingInterests,
  simulateSeason,
} from './projections';
import { buildSisterLeagueRaces, formatOdds, ordinal } from './races';
import {
  computeSisterLeagueSeedRanges,
  type SisterLeagueMatchup,
  type SisterLeagueSnapshot,
} from './sisterLeague';

const game = (
  week: number,
  homeTeamId: number,
  awayTeamId: number,
  homePoints = 0,
  awayPoints = 0,
): SisterLeagueMatchup => ({
  week,
  homeTeamId,
  awayTeamId,
  homePoints,
  awayPoints,
  final: homePoints > 0,
});

// Two weeks played, two to go. Team 1 is far ahead; 2 and 3 share the bubble.
const snapshot: SisterLeagueSnapshot = {
  leagueId: '1',
  seasonId: 2026,
  leagueName: 'Test League',
  fetchedAt: '2026-11-20T00:00:00.000Z',
  currentMatchupPeriod: 3,
  regularSeasonWeeks: 4,
  playoffTeamCount: 2,
  playoffByeCount: 1,
  teams: [
    { id: 1, name: 'Alpha', wins: 2, losses: 0, ties: 0, pointsFor: 238, seed: 1 },
    { id: 3, name: 'Charlie', wins: 1, losses: 1, ties: 0, pointsFor: 211, seed: 2 },
    { id: 2, name: 'Bravo', wins: 1, losses: 1, ties: 0, pointsFor: 210, seed: 3 },
    { id: 4, name: 'Delta', wins: 0, losses: 2, ties: 0, pointsFor: 185, seed: 4 },
  ],
  matchups: [
    game(1, 1, 4, 120, 90),
    game(1, 2, 3, 110, 100),
    game(2, 1, 2, 118, 100),
    game(2, 3, 4, 111, 95),
    game(3, 1, 3),
    game(3, 2, 4),
    game(4, 1, 4),
    game(4, 2, 3),
  ],
};

const RUNS = 4000;

describe('computeTeamScoring', () => {
  it('summarizes completed weekly scores per team', () => {
    expect(computeTeamScoring(snapshot).get(1)).toMatchObject({
      games: 2,
      average: 119,
      median: 119,
      high: 120,
      low: 118,
    });
    expect(leagueMedianScore(snapshot)).toBe(105);
  });
});

describe('simulateSeason', () => {
  const sim = simulateSeason(snapshot, { runs: RUNS });

  it('is deterministic for the same snapshot and seed', () => {
    const again = simulateSeason(snapshot, { runs: RUNS });
    expect([...again.outlooks.values()]).toEqual([...sim.outlooks.values()]);
  });

  it('only plays out unfinished games and keeps every seed distribution whole', () => {
    expect(sim.remainingGames.map((g) => [g.week, g.homeTeamId, g.awayTeamId])).toEqual([
      [3, 1, 3],
      [3, 2, 4],
      [4, 1, 4],
      [4, 2, 3],
    ]);
    const outlooks = [...sim.outlooks.values()];
    outlooks.forEach((outlook) => {
      expect(outlook.seedOdds.reduce((sum, odds) => sum + odds, 0)).toBeCloseTo(1);
    });
    expect(outlooks.reduce((sum, outlook) => sum + outlook.playoffOdds, 0)).toBeCloseTo(2);
    expect(outlooks.reduce((sum, outlook) => sum + outlook.byeOdds, 0)).toBeCloseTo(1);
  });

  it('favors the leader and leaves the bubble teams genuinely open', () => {
    const odds = (id: number) => sim.outlooks.get(id)?.playoffOdds ?? -1;
    expect(odds(1)).toBeGreaterThan(0.9);
    expect(odds(2)).toBeGreaterThan(0.1);
    expect(odds(2)).toBeLessThan(0.9);
    expect(odds(3)).toBeGreaterThan(0.1);
    expect(odds(3)).toBeLessThan(0.9);
  });

  it.each([
    [
      'one missing game',
      snapshot.matchups.filter((matchup) => !(matchup.week === 4 && matchup.homeTeamId === 2)),
    ],
    ['the entire remaining schedule', snapshot.matchups.filter((matchup) => matchup.final)],
  ])('withholds projections when %s is missing', (_, matchups) => {
    const incomplete = { ...snapshot, matchups };
    const sim = simulateSeason(incomplete, { runs: 100 });
    expect(sim).toMatchObject({ scheduleComplete: false, runs: 0 });
    expect(sim.outlooks.size).toBe(0);
    expect(oddsByRemainingWins(incomplete, sim, 2, 'playoffs')).toEqual([]);
    expect(rootingInterests(incomplete, sim, 2, 'playoffs')).toEqual([]);
  });

  it('keeps current seeds when no games remain', () => {
    const finished = simulateSeason(
      {
        ...snapshot,
        regularSeasonWeeks: 2,
        matchups: snapshot.matchups.filter((matchup) => matchup.final),
      },
      { runs: 10 },
    );
    expect(finished.outlooks.get(3)?.mostLikelySeed).toBe(2);
    expect(finished.outlooks.get(2)?.playoffOdds).toBe(0);
  });
});

describe('what has to break', () => {
  const sim = simulateSeason(snapshot, { runs: RUNS });

  it("splits a team's odds by its remaining record, improving with every win", () => {
    const rows = oddsByRemainingWins(snapshot, sim, 2, 'playoffs');
    expect(rows.map((row) => `${row.wins.toString()}-${row.losses.toString()}`)).toEqual([
      '2-0',
      '1-1',
      '0-2',
    ]);
    expect(rows.reduce((sum, row) => sum + row.share, 0)).toBeCloseTo(1);
    expect(rows[0].odds).toBeGreaterThanOrEqual(rows[1].odds);
    expect(rows[1].odds).toBeGreaterThanOrEqual(rows[2].odds);
  });

  it("ranks only other teams' games, rooting against the bubble rival", () => {
    const interests = rootingInterests(snapshot, sim, 2, 'playoffs');
    expect(interests).toHaveLength(2);
    interests.forEach((interest) => {
      expect([interest.game.homeTeamId, interest.game.awayTeamId]).not.toContain(2);
      expect(interest.oddsIfRootedWins).toBeGreaterThanOrEqual(interest.oddsOtherwise);
    });
    expect(interests[0].swing).toBeGreaterThanOrEqual(interests[1].swing);
    expect(interests.every((interest) => interest.rootForTeamId !== 3)).toBe(true);
  });
});

describe('buildSisterLeagueRaces', () => {
  it('narrates only teams whose side of the cut is still open', () => {
    const sim = simulateSeason(snapshot, { runs: RUNS });
    const ranges = new Map(
      computeSisterLeagueSeedRanges(snapshot).map((range) => [range.teamId, range]),
    );
    const races = buildSisterLeagueRaces(snapshot, sim, computeTeamScoring(snapshot), ranges);
    const bubbleIds = races.bubble?.entries.map((entry) => entry.teamId) ?? [];

    expect(bubbleIds).toEqual(expect.arrayContaining([2, 3]));
    races.bubble?.entries.forEach((entry) => {
      expect(entry.odds).toBeGreaterThan(0.02);
      expect(entry.odds).toBeLessThan(0.98);
    });
  });
});

describe('incomplete schedule guarantees', () => {
  // A and C can both win the last week, so A can still lose the second
  // playoff spot on points. Dropping B-C must not turn A's win into a lock.
  const finalWeek: SisterLeagueSnapshot = {
    ...snapshot,
    currentMatchupPeriod: 4,
    teams: [
      { id: 1, name: 'B', wins: 3, losses: 0, ties: 0, pointsFor: 330, seed: 1 },
      { id: 2, name: 'A', wins: 1, losses: 2, ties: 0, pointsFor: 330, seed: 2 },
      { id: 3, name: 'C', wins: 1, losses: 2, ties: 0, pointsFor: 310, seed: 3 },
      { id: 4, name: 'D', wins: 1, losses: 2, ties: 0, pointsFor: 300, seed: 4 },
    ],
    matchups: [
      game(1, 1, 2, 110, 100),
      game(1, 3, 4, 110, 100),
      game(2, 1, 3, 110, 100),
      game(2, 4, 2, 110, 100),
      game(3, 1, 4, 110, 90),
      game(3, 2, 3, 130, 100),
      game(4, 2, 4),
      game(4, 1, 3),
    ],
  };
  const racesFor = (data: SisterLeagueSnapshot) =>
    buildSisterLeagueRaces(
      data,
      simulateSeason(data, { runs: 2000 }),
      computeTeamScoring(data),
      new Map(computeSisterLeagueSeedRanges(data).map((range) => [range.teamId, range])),
    );

  it('keeps the complete-schedule win-out path open', () => {
    expect(racesFor(finalWeek).bubble?.entries.find((entry) => entry.teamId === 2)).toMatchObject({
      winOutClinches: false,
    });
  });

  it('withholds races instead of claiming a false guarantee after another game disappears', () => {
    const incomplete = { ...finalWeek, matchups: finalWeek.matchups.slice(0, -1) };
    expect(
      computeSisterLeagueSeedRanges(incomplete).find((range) => range.teamId === 2),
    ).toMatchObject({ best: 2, worst: 4, clinched: false });
    expect(racesFor(incomplete)).toEqual({ bubble: null, bye: null });
  });
});

describe('formatting', () => {
  it('never rounds open odds to a false certainty', () => {
    expect(formatOdds(0.999)).toBe('>99%');
    expect(formatOdds(0.001)).toBe('<1%');
    expect(formatOdds(0.364)).toBe('36%');
    expect(formatOdds(0.4, { clinched: true })).toBe('100%');
    expect(formatOdds(0.4, { eliminated: true })).toBe('0%');
  });

  it('builds ordinals', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22].map(ordinal)).toEqual([
      '1st',
      '2nd',
      '3rd',
      '4th',
      '11th',
      '12th',
      '13th',
      '21st',
      '22nd',
    ]);
  });
});
