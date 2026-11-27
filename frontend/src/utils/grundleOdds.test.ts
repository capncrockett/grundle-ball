import * as sleeperApi from '../api/sleeper';
import type { SleeperMatchup } from '../api/sleeper';
import type { Team } from '../models/fantasy';
import {
  GRUNDLE_BYE_SEEDS,
  GRUNDLE_PLAYOFF_TEAMS,
  grundleSeedOrder,
  loadCompletedScores,
  simulateGrundleSeason,
} from './grundleOdds';
import { computeGrundleSeedRanges } from './grundleSeedRanges';
import type { ScheduledGame } from './seedRanges';
import { computeSeeds } from './sleeperTransforms';

// Small LCG so the generated leagues are the same on every run.
const createRandom = (seed: number) => {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
};

const makeTeam = (
  id: number,
  wins: number,
  losses: number,
  pointsFor: number,
  divisionId: number | null,
): Team => ({
  teamName: `Team ${id.toString()}`,
  ownerDisplayName: `Owner ${id.toString()}`,
  teamAvatarUrl: null,
  userAvatarUrl: null,
  sleeperRosterId: id,
  sleeperUserId: `user${id.toString()}`,
  divisionId,
  record: { wins, losses, ties: 0 },
  pointsFor,
  pointsAgainst: 0,
  rank: 0,
});

// Twelve teams in three divisions, the Grundle League's shape.
const randomLeague = (random: () => number, played: number): Team[] =>
  computeSeeds(
    Array.from({ length: 12 }, (_, index) => {
      const wins = Math.floor(random() * (played + 1));
      return makeTeam(
        index + 1,
        wins,
        played - wins,
        Math.round(played * (90 + random() * 50) * 100) / 100,
        (index % 3) + 1,
      );
    }),
  );

const pairsFor = (pairs: [number, number][]): ScheduledGame[] =>
  pairs.map(([teamA, teamB]) => ({ teamA, teamB }));

// Each team's weekly scores average its season points-for per game.
const scoresFor = (teams: Team[], weeks: number, random: () => number) =>
  new Map(
    teams.map((team) => {
      const average = team.pointsFor / Math.max(weeks, 1);
      return [
        team.sleeperRosterId,
        Array.from({ length: weeks }, () => average + (random() - 0.5) * 40),
      ];
    }),
  );

describe('grundleSeedOrder', () => {
  it('matches computeSeeds on finished records', () => {
    const random = createRandom(7);
    for (let league = 0; league < 200; league += 1) {
      const teams = randomLeague(random, 14);
      const order = teams.map((_, index) => index);
      grundleSeedOrder(teams)(
        order,
        teams.map((team) => team.record.wins),
        teams.map((team) => team.pointsFor),
      );
      expect(order.map((index) => teams[index].sleeperRosterId)).toEqual(
        teams.map((team) => team.sleeperRosterId),
      );
    }
  });

  it('gives seed 6 to the highest points-for team left after seeds 1-5', () => {
    const teams = computeSeeds([
      makeTeam(1, 10, 4, 1500, 1),
      makeTeam(2, 9, 5, 1450, 2),
      makeTeam(3, 8, 6, 1400, 3),
      makeTeam(4, 11, 3, 1550, 1),
      makeTeam(5, 10, 4, 1490, 2),
      makeTeam(6, 7, 7, 1300, 3),
      makeTeam(7, 5, 9, 1600, 1),
    ]);
    const order = teams.map((_, index) => index);
    grundleSeedOrder(teams)(
      order,
      teams.map((team) => team.record.wins),
      teams.map((team) => team.pointsFor),
    );
    // Division winners 4, 5, 3; best records 1, 2; then 7 (5-9) on points over 6 (7-7).
    expect(order.map((index) => teams[index].sleeperRosterId)).toEqual([4, 5, 3, 1, 2, 7, 6]);
  });
});

describe('simulateGrundleSeason', () => {
  // Two weeks left in a 14-week season.
  const random = createRandom(11);
  const teams = randomLeague(random, 12);
  const remaining = pairsFor([
    [1, 2],
    [3, 4],
    [5, 6],
    [7, 8],
    [9, 10],
    [11, 12],
    [1, 3],
    [2, 4],
    [5, 7],
    [6, 8],
    [9, 11],
    [10, 12],
  ]);
  const scores = scoresFor(teams, 12, random);
  const sim = simulateGrundleSeason(teams, remaining, scores, 14, { runs: 3000 });

  it('is deterministic for the same inputs', () => {
    const again = simulateGrundleSeason(teams, remaining, scores, 14, { runs: 3000 });
    expect([...again.outlooks.values()]).toEqual([...sim.outlooks.values()]);
  });

  it('fills six playoff spots and two byes in every simulation', () => {
    expect(sim.scheduleComplete).toBe(true);
    const outlooks = [...sim.outlooks.values()];
    outlooks.forEach((outlook) => {
      expect(outlook.seedOdds.reduce((sum, odds) => sum + odds, 0)).toBeCloseTo(1);
    });
    expect(outlooks.reduce((sum, outlook) => sum + outlook.playoffOdds, 0)).toBeCloseTo(
      GRUNDLE_PLAYOFF_TEAMS,
    );
    expect(outlooks.reduce((sum, outlook) => sum + outlook.byeOdds, 0)).toBeCloseTo(
      GRUNDLE_BYE_SEEDS,
    );
  });

  it('keeps every simulated seed inside the schedule-aware best/worst range', () => {
    const ranges = computeGrundleSeedRanges(teams, remaining, 14);
    sim.teamIds.forEach((teamId, teamIndex) => {
      const range = ranges.get(teamId);
      if (!range) throw new Error(`No range for ${teamId.toString()}`);
      for (let run = 0; run < sim.runs; run += 1) {
        const seed = sim.finalSeeds[run * sim.teamIds.length + teamIndex];
        expect(seed).toBeGreaterThanOrEqual(range.best);
        expect(seed).toBeLessThanOrEqual(range.worst);
      }
    });
  });

  it('favors the stronger scorer between two teams with the same record', () => {
    // Teams 5 and 6 are 7-6 with one game left, chasing seed 5. Team 7 holds
    // the points-for seed, so the loser of that chase misses the playoffs.
    // Team 5 averages far more points and draws the weaker opponent.
    const bubble = computeSeeds([
      makeTeam(1, 12, 1, 1690, 1),
      makeTeam(2, 11, 2, 1600, 2),
      makeTeam(3, 10, 3, 1580, 3),
      makeTeam(4, 9, 4, 1560, 1),
      makeTeam(5, 7, 6, 1560, 2),
      makeTeam(6, 7, 6, 1300, 3),
      makeTeam(7, 6, 7, 1750, 1),
      makeTeam(8, 0, 13, 1000, 2),
    ]);
    const weekly = new Map(
      bubble.map((team) => [team.sleeperRosterId, Array<number>(13).fill(team.pointsFor / 13)]),
    );
    const bubbleSim = simulateGrundleSeason(
      bubble,
      pairsFor([
        [1, 2],
        [3, 4],
        [5, 8],
        [6, 7],
      ]),
      weekly,
      14,
      { runs: 2000 },
    );
    const odds = (id: number) => bubbleSim.outlooks.get(id)?.playoffOdds ?? -1;
    expect(odds(5)).toBeGreaterThan(0.9);
    expect(odds(6)).toBeLessThan(0.5);
    expect(odds(1)).toBe(1);
  });

  it('keeps the current seeds once the season is over', () => {
    const finished = randomLeague(createRandom(3), 14);
    const done = simulateGrundleSeason(finished, [], scoresFor(finished, 14, random), 14, {
      runs: 10,
    });
    finished.forEach((team) => {
      const outlook = done.outlooks.get(team.sleeperRosterId);
      expect(outlook?.mostLikelySeed).toBe(team.seed);
      expect(outlook?.playoffOdds).toBe((team.seed ?? 99) <= GRUNDLE_PLAYOFF_TEAMS ? 1 : 0);
    });
  });

  it.each([
    ['the schedule is unavailable', null, scores],
    ['a remaining game is missing', remaining.slice(1), scores],
    ['completed scores are unavailable', remaining, null],
    [
      'a team is missing a completed score',
      remaining,
      new Map([...scores].map(([id, weekly]) => [id, id === 4 ? weekly.slice(1) : weekly])),
    ],
  ])('withholds odds when %s', (_, games, weekly) => {
    const withheld = simulateGrundleSeason(teams, games, weekly, 14, { runs: 100 });
    expect(withheld).toMatchObject({ scheduleComplete: false, runs: 0 });
    expect(withheld.outlooks.size).toBe(0);
  });
});

describe('loadCompletedScores', () => {
  const row = (
    rosterId: number,
    matchupId: number | null,
    points: number,
    customPoints?: number,
  ): SleeperMatchup =>
    ({
      roster_id: rosterId,
      matchup_id: matchupId,
      points,
      custom_points: customPoints,
      starters: [],
      players: [],
    }) as unknown as SleeperMatchup;

  const teams = [makeTeam(1, 1, 1, 200, 1), makeTeam(2, 1, 1, 210, 2)];

  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('collects every completed week, honoring commissioner overrides', async () => {
    const spy = jest
      .spyOn(sleeperApi, 'getLeagueMatchupsForWeek')
      .mockImplementation((_, week) =>
        Promise.resolve(
          week === 1
            ? [row(1, 1, 100), row(2, 1, 90, 115.5), row(3, null, 0)]
            : [row(1, 1, 95), row(2, 1, 105)],
        ),
      );

    const scores = await loadCompletedScores('league', teams);

    expect(spy.mock.calls.map(([, week]) => week)).toEqual([1, 2]);
    expect(scores?.get(1)).toEqual([100, 95]);
    expect(scores?.get(2)).toEqual([115.5, 105]);
  });

  it('returns null when Sleeper fails', async () => {
    jest.spyOn(sleeperApi, 'getLeagueMatchupsForWeek').mockRejectedValue(new Error('down'));
    await expect(loadCompletedScores('league', teams)).resolves.toBeNull();
  });
});
