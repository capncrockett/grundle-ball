import {
  computeScheduleFreeSeedRanges,
  computeSeedRanges,
  scheduleCoversRemaining,
  worstSeedIfWinsOut,
  type ScheduledGame,
  type SeedingRule,
  type SeedRangeTeam,
} from './seedRanges';

const RECORD: SeedingRule = { kind: 'record' };
const GRUNDLE: SeedingRule = { kind: 'divisions', recordSeeds: 5 };

const teamsFrom = (wins: number[], divisions: (number | null)[] = []): SeedRangeTeam[] =>
  wins.map((w, i) => ({ id: i + 1, wins: w, ties: 0, divisionId: divisions[i] ?? null }));

const games = (pairs: [number, number][]): ScheduledGame[] =>
  pairs.map(([teamA, teamB]) => ({ teamA, teamB }));

const labels = (ranges: Map<number, { best: number; worst: number }>) =>
  [...ranges.values()].map(({ best, worst }) => `${best.toString()}-${worst.toString()}`);

describe('computeSeedRanges with record seeding', () => {
  it('never lets two teams that play each other both lose', () => {
    // Teams 1 and 2 meet, so one of them must pass Team 3's best of 4 wins.
    const ranges = computeSeedRanges(
      teamsFrom([4, 4, 3, 0]),
      games([
        [1, 2],
        [3, 4],
      ]),
      RECORD,
    );

    expect(ranges.get(3)?.best).toBe(2);
  });

  it('never lets two teams that play each other both win', () => {
    // Teams 2 and 3 meet, so at most one of them can catch Team 1 at 4 wins.
    const ranges = computeSeedRanges(
      teamsFrom([4, 3, 3, 0]),
      games([
        [2, 3],
        [1, 4],
      ]),
      RECORD,
    );

    expect(ranges.get(1)?.worst).toBe(2);
  });

  it('finds the worst seed a team can reach after winning out', () => {
    // Team 2 wins out to 6; Teams 1 and 3 can both reach 6, but not with Team 4 too.
    const teams = teamsFrom([5, 4, 4, 4]);
    const schedule = games([
      [2, 4],
      [1, 3],
      [2, 1],
      [3, 4],
    ]);

    expect(worstSeedIfWinsOut(teams, schedule, RECORD, 2)).toBe(2);
    expect(worstSeedIfWinsOut(teams, schedule, RECORD, 99)).toBeNull();
  });
});

describe('computeSeedRanges with Grundle division seeding', () => {
  // Divisions: 1 = Teams 1-4, 2 = Teams 5-8, 3 = Teams 9-12.
  const divisions = [1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3];

  it('seeds a division winner ahead of better records elsewhere', () => {
    // Team 9 leads a weak division, so even its worst case is a top-3 seed.
    // At best it ties division 2's leader at 8 wins and takes the tiebreak.
    const teams = teamsFrom([12, 11, 10, 9, 8, 7, 6, 5, 7, 2, 1, 0], divisions);
    const schedule = games([
      [1, 5],
      [2, 6],
      [3, 7],
      [4, 8],
      [9, 10],
      [11, 12],
    ]);

    const ranges = computeSeedRanges(teams, schedule, GRUNDLE);

    expect(ranges.get(9)).toEqual({ best: 2, worst: 3 });
    expect(ranges.get(2)?.worst).toBe(5);
  });

  it('lets a team outside the record seeds take the points-for seed in its best case', () => {
    const teams = teamsFrom([12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1], divisions);
    const schedule = games([
      [1, 2],
      [3, 4],
      [5, 6],
      [7, 8],
      [9, 10],
      [11, 12],
    ]);

    const ranges = computeSeedRanges(teams, schedule, GRUNDLE);

    expect(ranges.get(12)).toEqual({ best: 6, worst: 12 });
  });
});

describe('scheduleCoversRemaining', () => {
  const remaining = new Map([
    [1, 1],
    [2, 1],
    [3, 0],
  ]);

  it('accepts a schedule that matches every team', () => {
    expect(scheduleCoversRemaining(games([[1, 2]]), remaining)).toBe(true);
  });

  it('rejects a schedule that is missing or adds games', () => {
    expect(scheduleCoversRemaining([], remaining)).toBe(false);
    expect(
      scheduleCoversRemaining(
        games([
          [1, 2],
          [2, 3],
        ]),
        remaining,
      ),
    ).toBe(false);
  });
});

describe('computeScheduleFreeSeedRanges', () => {
  it('lets every other team lose out (best) or win out (worst)', () => {
    // Team 3's best of 1st needs both 4-win teams to lose, even if they play
    // each other (compare the exact search above, which gives 2nd).
    const teams = teamsFrom([4, 4, 3, 0]);
    const remaining = new Map(teams.map((team) => [team.id, 1]));

    expect(labels(computeScheduleFreeSeedRanges(teams, remaining, RECORD))).toEqual([
      '1-3',
      '1-3',
      '1-3',
      '4-4',
    ]);
  });
});

// Cross-check against a direct brute force: every outcome of every remaining
// game (including the team's own) and every points-for order, seeded straight
// from the league rules.
describe('agreement with brute force on small random leagues', () => {
  const createRandom = (seed: number) => {
    let state = seed;
    return () => {
      state = (state * 1103515245 + 12345) % 2147483648;
      return state / 2147483648;
    };
  };
  const permutations = (items: number[]): number[][] =>
    items.length <= 1
      ? [items]
      : items.flatMap((item, i) =>
          permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [
            item,
            ...rest,
          ]),
        );

  const seedOrder = (
    units: number[],
    pointsFor: number[],
    divisions: (number | null)[],
    rule: SeedingRule,
  ): number[] => {
    const order = units
      .map((_, i) => i)
      .sort((a, b) => units[b] - units[a] || pointsFor[b] - pointsFor[a]);
    if (rule.kind === 'record') return order;
    const seeded: number[] = [];
    const divisionIds = [...new Set(divisions.filter((id) => id !== null))];
    const winners = divisionIds
      .map((id) => order.find((i) => divisions[i] === id))
      .filter((i): i is number => i !== undefined)
      .sort((a, b) => order.indexOf(a) - order.indexOf(b));
    seeded.push(...winners);
    for (const i of order) {
      if (seeded.length >= rule.recordSeeds) break;
      if (!seeded.includes(i)) seeded.push(i);
    }
    const rest = order.filter((i) => !seeded.includes(i));
    if (rest.length) {
      seeded.push(rest.reduce((best, i) => (pointsFor[i] > pointsFor[best] ? i : best), rest[0]));
    }
    return [...seeded, ...order.filter((i) => !seeded.includes(i))];
  };

  const bruteForce = (teams: SeedRangeTeam[], pairs: [number, number][], rule: SeedingRule) => {
    const n = teams.length;
    const divisions = teams.map((team) => team.divisionId);
    const results = teams.map(() => ({ best: Infinity, worst: -Infinity, winOut: -Infinity }));
    for (let mask = 0; mask < 2 ** pairs.length; mask += 1) {
      const units = teams.map((team) => 2 * team.wins + team.ties);
      const lost = new Array<boolean>(n).fill(false);
      pairs.forEach(([a, b], g) => {
        const aWins = ((mask >> g) & 1) === 1;
        units[aWins ? a : b] += 2;
        lost[aWins ? b : a] = true;
      });
      teams.forEach((_, focus) => {
        const others = teams.map((__, i) => i).filter((i) => i !== focus);
        for (const ranking of permutations(others)) {
          const pfBest = new Array<number>(n);
          const pfWorst = new Array<number>(n);
          ranking.forEach((i, r) => {
            pfBest[i] = n - r - 1;
            pfWorst[i] = n - r;
          });
          pfBest[focus] = n;
          pfWorst[focus] = 0;
          const best = seedOrder(units, pfBest, divisions, rule).indexOf(focus) + 1;
          const worst = seedOrder(units, pfWorst, divisions, rule).indexOf(focus) + 1;
          const result = results[focus];
          result.best = Math.min(result.best, best);
          result.worst = Math.max(result.worst, worst);
          if (!lost[focus]) result.winOut = Math.max(result.winOut, worst);
        }
      });
    }
    return results;
  };

  const cases: {
    label: string;
    size: number;
    weeks: number;
    rule: SeedingRule;
    divisions: number;
  }[] = [
    { label: 'record seeding', size: 5, weeks: 3, rule: RECORD, divisions: 0 },
    {
      label: 'two divisions',
      size: 5,
      weeks: 3,
      rule: { kind: 'divisions', recordSeeds: 3 },
      divisions: 2,
    },
    {
      label: 'three divisions',
      size: 6,
      weeks: 2,
      rule: { kind: 'divisions', recordSeeds: 4 },
      divisions: 3,
    },
  ];

  it.each(cases)('matches for $label', ({ size, weeks, rule, divisions }) => {
    const random = createRandom(size * 31 + weeks * 7 + divisions);
    for (let trial = 0; trial < 12; trial += 1) {
      const teams: SeedRangeTeam[] = Array.from({ length: size }, (_, i) => ({
        id: 100 + i,
        wins: Math.floor(random() * 4),
        ties: random() < 0.1 ? 1 : 0,
        divisionId: divisions ? (i % divisions) + 1 : null,
      }));
      const pairs: [number, number][] = [];
      for (let week = 0; week < weeks; week += 1) {
        const order = teams.map((_, i) => i).sort(() => random() - 0.5);
        for (let i = 0; i + 1 < size; i += 2) pairs.push([order[i], order[i + 1]]);
      }
      const schedule = pairs.map(([a, b]) => ({ teamA: teams[a].id, teamB: teams[b].id }));

      const ranges = computeSeedRanges(teams, schedule, rule);
      const actual = teams.map((team) => ({
        best: ranges.get(team.id)?.best,
        worst: ranges.get(team.id)?.worst,
        winOut: worstSeedIfWinsOut(teams, schedule, rule, team.id),
      }));

      expect(actual).toEqual(bruteForce(teams, pairs, rule));
    }
  });
});
