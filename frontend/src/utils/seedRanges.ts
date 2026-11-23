// frontend/src/utils/seedRanges.ts
//
// Best/worst possible final seeds under the real remaining schedule. Every
// remaining game is a plain win or loss (ties are rare and ignored), and each
// team plays only the opponents it is actually scheduled against, so outcomes
// like "everyone else loses out" are impossible unless the schedule allows
// them.
//
// Points-for is treated as unknown while games remain: equal records (and
// the Grundle points-for seed) break toward the team in its best case and
// against it in its worst case.
//
// The search is a memoized depth-first walk over the remaining games. A state
// only tracks how close each team is to finishing above the focus team, and a
// team drops out of the state once it is certain to finish above or below.
// Partial outcomes that cannot beat the best answer found so far are pruned.
// If a search would grow too large, that bound falls back to the looser
// schedule-free bound, which is still never wrong.

export type SeedRangeTeam = {
  id: number;
  wins: number;
  ties: number;
  divisionId: number | null;
};

export type ScheduledGame = { teamA: number; teamB: number };

export type SeedingRule =
  /** Seeds follow record alone. */
  | { kind: 'record' }
  /**
   * Grundle League seeding (see computeSeeds): division winners first, then
   * the best remaining records through `recordSeeds`, then the highest
   * points-for among everyone left, then the rest by record.
   */
  | { kind: 'divisions'; recordSeeds: number };

export type SeedBounds = { best: number; worst: number };

type Objective = 'best' | 'worst';

// Upper limit on distinct states one search may visit before falling back.
const STATE_BUDGET = 200_000;

type Prepared = {
  n: number;
  index: Map<number, number>;
  winUnits: number[];
  division: (number | null)[];
  divisions: number[];
  games: [number, number][];
  seedOf: (above: Uint8Array, focus: number, objective: Objective) => number;
  /** Seed is 1 + the number of teams above, so counting bounds apply. */
  countBased: boolean;
};

const prepare = (teams: SeedRangeTeam[], games: ScheduledGame[], rule: SeedingRule): Prepared => {
  const index = new Map(teams.map((team, i) => [team.id, i]));
  const division = teams.map((team) => team.divisionId);
  const divisions = [...new Set(division.filter((id): id is number => id !== null))];
  const pairs = games.flatMap((game): [number, number][] => {
    const a = index.get(game.teamA);
    const b = index.get(game.teamB);
    return a === undefined || b === undefined || a === b ? [] : [[a, b]];
  });
  return {
    n: teams.length,
    index,
    winUnits: teams.map((team) => 2 * team.wins + team.ties),
    division,
    divisions,
    games: pairs,
    seedOf:
      rule.kind === 'record'
        ? recordSeed
        : divisionSeed(division, divisions, Math.max(rule.recordSeeds, 0)),
    countBased: rule.kind === 'record',
  };
};

const recordSeed = (above: Uint8Array): number => {
  let count = 0;
  for (const flag of above) count += flag;
  return 1 + count;
};

// `above[i]` = team i finishes ahead of the focus team. The result never
// improves when more teams finish ahead, which the pruning relies on.
const divisionSeed = (division: (number | null)[], divisions: number[], recordSeeds: number) => {
  const slotOf = division.map((id) => (id === null ? -1 : divisions.indexOf(id)));
  const divisionHasAbove = new Uint8Array(divisions.length);
  return (above: Uint8Array, focus: number, objective: Objective): number => {
    divisionHasAbove.fill(0);
    let aboveCount = 0;
    let winnersAbove = 0;
    for (let i = 0; i < above.length; i += 1) {
      if (!above[i]) continue;
      aboveCount += 1;
      const slot = slotOf[i];
      if (slot >= 0 && !divisionHasAbove[slot]) {
        divisionHasAbove[slot] = 1;
        winnersAbove += 1;
      }
    }

    const ownSlot = slotOf[focus];
    if (ownSlot >= 0 && !divisionHasAbove[ownSlot]) return 1 + winnersAbove;

    const wildcardSlots = Math.max(recordSeeds - divisions.length, 0);
    const othersAbove = aboveCount - winnersAbove;
    if (othersAbove < wildcardSlots) return divisions.length + 1 + othersAbove;

    // Outside the record seeds. With points-for unknown, the best case takes
    // the points-for seed; the worst case hands it to a team below if any.
    if (objective === 'best') return recordSeeds + 1;
    const restAbove = othersAbove - wildcardSlots;
    const winnersBelow = divisions.length - winnersAbove;
    const restBelow = above.length - 1 - aboveCount - winnersBelow;
    return recordSeeds + (restBelow > 0 ? 2 : 1) + restAbove;
  };
};

/**
 * Seed bound for `focus`. `objective` picks the best or worst outcome; the
 * focus team's own games are all wins (`focusWins`) or all losses.
 */
const solve = (
  p: Prepared,
  focus: number,
  objective: Objective,
  focusWins: boolean,
  fallback: () => number,
): number => {
  const { n, games, winUnits } = p;
  const isBest = objective === 'best';

  // Apply the focus team's own games, which are fixed.
  const startGains = new Array<number>(n).fill(0);
  let focusGain = 0;
  const steps: [number, number][] = [];
  for (const [a, b] of games) {
    if (a === focus || b === focus) {
      if (focusWins) focusGain += 1;
      else startGains[a === focus ? b : a] += 1;
    } else {
      steps.push([a, b]);
    }
  }
  const focusUnits = winUnits[focus] + 2 * focusGain;

  // needed[i]: further wins team i needs to finish ahead of the focus team.
  const needed = winUnits.map((units, i) => {
    if (i === focus) return 0;
    const gap = focusUnits - units - 2 * startGains[i];
    return isBest ? Math.floor(gap / 2) + 1 : Math.ceil(gap / 2);
  });
  // remaining[k][i]: games team i plays from step k on.
  const remaining: number[][] = [new Array<number>(n).fill(0)];
  for (let k = steps.length - 1; k >= 0; k -= 1) {
    const row = [...remaining[0]];
    row[steps[k][0]] += 1;
    row[steps[k][1]] += 1;
    remaining.unshift(row);
  }

  // Per-team digit: 0..needed-1 = wins so far, then ABOVE, then BELOW.
  // Teams decided before any game is played keep a fixed status instead.
  const fixed = new Int8Array(n); // 1 = always above, -1 = never above, 0 = open
  const base = new Array<number>(n).fill(1);
  const place = new Array<number>(n).fill(0);
  let span = 1;
  for (let i = 0; i < n; i += 1) {
    if (i === focus) {
      fixed[i] = -1;
    } else if (needed[i] <= 0) {
      fixed[i] = 1;
    } else if (needed[i] > remaining[0][i]) {
      fixed[i] = -1;
    } else {
      base[i] = needed[i] + 2;
      place[i] = span;
      span *= base[i];
    }
  }
  if (span > Number.MAX_SAFE_INTEGER) return fallback();

  const digit = (key: number, i: number): number => Math.floor(key / place[i]) % base[i];
  const above = new Uint8Array(n);
  // Seed if every open team breaks the focus team's way (best) or against it (worst).
  const optimistic = (key: number): number => {
    for (let i = 0; i < n; i += 1) {
      if (fixed[i] !== 0) {
        above[i] = fixed[i] === 1 ? 1 : 0;
        continue;
      }
      const d = digit(key, i);
      above[i] = d === needed[i] ? 1 : d === needed[i] + 1 ? 0 : isBest ? 0 : 1;
    }
    return p.seedOf(above, focus, objective);
  };

  // Tighter bound for record seeding, from the wins the remaining games must
  // hand out. Best case: a game between two open teams gives one of them a
  // win, so once their spare room runs out some must pass the focus team.
  // Worst case: open teams can only reach the focus team with wins those
  // same games can supply.
  const toPass = new Array<number>(n).fill(0);
  const isOpen = new Uint8Array(n);
  const openGames = new Array<number>(n).fill(0);
  const decidedGames = new Array<number>(n).fill(0);
  const counted = (key: number, k: number): number => {
    let aboveCount = 0;
    const open: number[] = [];
    for (let i = 0; i < n; i += 1) {
      isOpen[i] = 0;
      openGames[i] = 0;
      decidedGames[i] = 0;
      if (fixed[i] !== 0) {
        if (fixed[i] === 1) aboveCount += 1;
        continue;
      }
      const d = digit(key, i);
      if (d === needed[i]) aboveCount += 1;
      else if (d < needed[i]) {
        isOpen[i] = 1;
        toPass[i] = needed[i] - d;
        open.push(i);
      }
    }
    let gamesBetweenOpen = 0;
    for (let j = k; j < steps.length; j += 1) {
      const [a, b] = steps[j];
      if (isOpen[a] && isOpen[b]) {
        gamesBetweenOpen += 1;
        openGames[a] += 1;
        openGames[b] += 1;
      } else if (isOpen[a]) {
        decidedGames[a] += 1;
      } else if (isOpen[b]) {
        decidedGames[b] += 1;
      }
    }
    if (isBest) {
      let absorbed = 0;
      const extra: number[] = [];
      for (const i of open) {
        const spare = Math.min(toPass[i] - 1, openGames[i]);
        absorbed += spare;
        extra.push(openGames[i] - spare);
      }
      extra.sort((x, y) => y - x);
      let deficit = gamesBetweenOpen - absorbed;
      let forced = 0;
      while (deficit > 0 && forced < extra.length) {
        deficit -= extra[forced];
        forced += 1;
      }
      return 1 + aboveCount + forced;
    }
    const shortfalls = open
      .map((i) => Math.max(toPass[i] - decidedGames[i], 0))
      .sort((x, y) => x - y);
    let supply = gamesBetweenOpen;
    let reachable = 0;
    for (const shortfall of shortfalls) {
      if (shortfall > supply) break;
      supply -= shortfall;
      reachable += 1;
    }
    return 1 + aboveCount + reachable;
  };
  const boundAt = (key: number, k: number): number =>
    p.countBased ? counted(key, k) : optimistic(key);

  const target = boundAt(0, 0);
  let incumbent = isBest ? Infinity : -Infinity;
  const visited = steps.map(() => new Set<number>());
  let explored = 0;
  // An object so TypeScript sees the flag change inside search().
  const budget = { exceeded: false };

  // Digit after team i adds one win, starting from step k + 1.
  const afterWin = (d: number, i: number, k: number): number => {
    if (d >= needed[i]) return d;
    const wins = d + 1;
    if (wins >= needed[i]) return needed[i];
    return wins + remaining[k + 1][i] < needed[i] ? needed[i] + 1 : wins;
  };
  const afterLoss = (d: number, i: number, k: number): number => {
    if (d >= needed[i]) return d;
    return d + remaining[k + 1][i] < needed[i] ? needed[i] + 1 : d;
  };

  const search = (k: number, key: number): void => {
    if (incumbent === target || budget.exceeded) return;
    const bound = boundAt(key, k);
    if (k === steps.length) {
      incumbent = isBest ? Math.min(incumbent, bound) : Math.max(incumbent, bound);
      return;
    }
    if (isBest ? bound >= incumbent : bound <= incumbent) return;
    if (visited[k].has(key)) return;
    visited[k].add(key);
    explored += 1;
    if (explored > STATE_BUDGET) {
      budget.exceeded = true;
      return;
    }

    const [a, b] = steps[k];
    const da = fixed[a] === 0 ? digit(key, a) : -1;
    const db = fixed[b] === 0 ? digit(key, b) : -1;
    const next = (aWins: boolean): number => {
      let result = key;
      if (da >= 0) result += ((aWins ? afterWin : afterLoss)(da, a, k) - da) * place[a];
      if (db >= 0) result += ((aWins ? afterLoss : afterWin)(db, b, k) - db) * place[b];
      return result;
    };
    // Try the more promising winner first: in the best case, the team with
    // the most room to spare; in the worst case, the team closest to passing.
    const room = (d: number, i: number): number =>
      d < 0 || d >= needed[i] ? Infinity : needed[i] - d;
    const aFirst = isBest ? room(da, a) >= room(db, b) : room(da, a) <= room(db, b);
    search(k + 1, next(aFirst));
    search(k + 1, next(!aFirst));
  };

  search(0, 0);
  return budget.exceeded ? fallback() : incumbent;
};

/**
 * Schedule-free bound: the focus team wins (best) or loses (worst) everything
 * and every other team does the opposite of what helps it. Looser than the
 * exact search, but never wrong.
 */
const looseBound = (
  p: Prepared,
  remainingByIndex: number[],
  focus: number,
  objective: Objective,
  focusWins: boolean,
  gamesAgainstFocus: number[],
): number => {
  const focusUnits = p.winUnits[focus] + (focusWins ? 2 * remainingByIndex[focus] : 0);
  const above = new Uint8Array(p.n);
  for (let i = 0; i < p.n; i += 1) {
    if (i === focus) continue;
    const extra =
      objective === 'best' ? 0 : remainingByIndex[i] - (focusWins ? gamesAgainstFocus[i] : 0);
    const units = p.winUnits[i] + 2 * extra;
    above[i] = (objective === 'best' ? units > focusUnits : units >= focusUnits) ? 1 : 0;
  }
  return p.seedOf(above, focus, objective);
};

const scheduleCounts = (p: Prepared, focus?: number) => {
  const remainingByIndex = new Array<number>(p.n).fill(0);
  const againstFocus = new Array<number>(p.n).fill(0);
  for (const [a, b] of p.games) {
    remainingByIndex[a] += 1;
    remainingByIndex[b] += 1;
    if (a === focus) againstFocus[b] += 1;
    if (b === focus) againstFocus[a] += 1;
  }
  return { remainingByIndex, againstFocus };
};

/** Exact best/worst seeds for every team, keyed by team id. */
export function computeSeedRanges(
  teams: SeedRangeTeam[],
  remainingGames: ScheduledGame[],
  rule: SeedingRule,
): Map<number, SeedBounds> {
  const p = prepare(teams, remainingGames, rule);
  const { remainingByIndex } = scheduleCounts(p);
  const none = new Array<number>(p.n).fill(0);
  return new Map(
    teams.map((team, i) => [
      team.id,
      {
        best: solve(p, i, 'best', true, () =>
          looseBound(p, remainingByIndex, i, 'best', true, none),
        ),
        worst: solve(p, i, 'worst', false, () =>
          looseBound(p, remainingByIndex, i, 'worst', false, none),
        ),
      },
    ]),
  );
}

/** Worst seed a team can finish with if it wins every remaining game. */
export function worstSeedIfWinsOut(
  teams: SeedRangeTeam[],
  remainingGames: ScheduledGame[],
  rule: SeedingRule,
  teamId: number,
): number | null {
  const p = prepare(teams, remainingGames, rule);
  const focus = p.index.get(teamId);
  if (focus === undefined) return null;
  const { remainingByIndex, againstFocus } = scheduleCounts(p, focus);
  return solve(p, focus, 'worst', true, () =>
    looseBound(p, remainingByIndex, focus, 'worst', true, againstFocus),
  );
}

/**
 * True when the schedule gives every team exactly the number of remaining
 * games its record implies. A partial or missing schedule would otherwise
 * read as games that never happen.
 */
export function scheduleCoversRemaining(
  remainingGames: ScheduledGame[],
  remainingByTeam: Map<number, number>,
): boolean {
  const scheduled = new Map<number, number>();
  for (const game of remainingGames) {
    // The search discards self-pairings, so they must not satisfy coverage.
    if (game.teamA === game.teamB) return false;
    scheduled.set(game.teamA, (scheduled.get(game.teamA) ?? 0) + 1);
    scheduled.set(game.teamB, (scheduled.get(game.teamB) ?? 0) + 1);
  }
  for (const [teamId] of scheduled) {
    if (!remainingByTeam.has(teamId)) return false;
  }
  for (const [teamId, count] of remainingByTeam) {
    if ((scheduled.get(teamId) ?? 0) !== count) return false;
  }
  return true;
}

/**
 * Bounds without a schedule, from each team's remaining game count. Use only
 * when the schedule is unavailable; it allows impossible combinations, such
 * as every other team losing out.
 */
export function computeScheduleFreeSeedRanges(
  teams: SeedRangeTeam[],
  remainingByTeam: Map<number, number>,
  rule: SeedingRule,
): Map<number, SeedBounds> {
  const p = prepare(teams, [], rule);
  const remainingByIndex = teams.map((team) => remainingByTeam.get(team.id) ?? 0);
  const none = new Array<number>(p.n).fill(0);
  return new Map(
    teams.map((team, i) => [
      team.id,
      {
        best: looseBound(p, remainingByIndex, i, 'best', true, none),
        worst: looseBound(p, remainingByIndex, i, 'worst', false, none),
      },
    ]),
  );
}
