// frontend/src/utils/seasonSimulation.ts
//
// Monte Carlo playout of a regular season's remaining schedule, shared by the
// Sister League page and Grundle Standings. Each team's weekly score is drawn
// from a normal distribution built from its own completed weeks (average
// nudged slightly toward the league average, spread floored at half the
// league spread). Each league supplies its own seeding rule.
//
// Results are deterministic for the same inputs and PRNG seed so pages do not
// reshuffle odds on every render.

export type SimulationTeam = {
  id: number;
  /** Standings credit so far: wins, plus whatever a tie is worth in this league. */
  winPoints: number;
  pointsFor: number;
  /** Completed weekly scores; they model the team's future weeks. */
  scores: number[];
};

export type SimulationGame = { homeTeamId: number; awayTeamId: number };

/**
 * Rearranges `order` (team indexes, in input order) into final seed order
 * given each team's final standings credit and points for.
 */
export type SeedOrder = (
  order: number[],
  winPoints: readonly number[],
  points: readonly number[],
) => void;

export type TeamOutlook = {
  teamId: number;
  playoffOdds: number;
  byeOdds: number;
  /** seedOdds[i] is the share of simulations finishing at seed i + 1. */
  seedOdds: number[];
  mostLikelySeed: number;
  projectedWins: number;
};

export type SeasonSimulation<G extends SimulationGame = SimulationGame> = {
  /** False means projections are withheld because scheduled games or scores are missing. */
  scheduleComplete: boolean;
  runs: number;
  teamIds: number[];
  remainingGames: (G & { index: number })[];
  outlooks: Map<number, TeamOutlook>;
  /** runs x remainingGames: 1 when the home team won that simulated game. */
  homeWins: Uint8Array;
  /** runs x teamIds: the final seed each team reached in that simulation. */
  finalSeeds: Uint8Array;
};

export type SimulationOptions = { runs?: number; seed?: number };

export const DEFAULT_SIMULATION_RUNS = 10000;

// Pulls each average this many "league-average weeks" toward the league mean.
const SHRINK_WEEKS = 2;
const MIN_SPREAD_SHARE = 0.5;

export const mean = (values: number[]): number =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

export const median = (values: number[]): number => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
};

export const stdDev = (values: number[]): number => {
  if (values.length < 2) return 0;
  const avg = mean(values);
  return Math.sqrt(
    values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (values.length - 1),
  );
};

// Mulberry32: small, fast, seedable PRNG.
const createRandom = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const createNormal = (random: () => number): (() => number) => {
  let spare: number | null = null;
  return () => {
    if (spare !== null) {
      const value = spare;
      spare = null;
      return value;
    }
    const u = Math.max(random(), Number.EPSILON);
    const v = random();
    const radius = Math.sqrt(-2 * Math.log(u));
    spare = radius * Math.sin(2 * Math.PI * v);
    return radius * Math.cos(2 * Math.PI * v);
  };
};

const scoreModels = (teams: SimulationTeam[]): { mean: number; sd: number }[] => {
  const all = teams.flatMap((team) => team.scores);
  const leagueMean = mean(all);
  const leagueSd = stdDev(all);
  return teams.map(({ scores }) => {
    const n = scores.length;
    const shrunkMean = (n * mean(scores) + SHRINK_WEEKS * leagueMean) / (n + SHRINK_WEEKS);
    const sd = n >= 2 ? Math.max(stdDev(scores), leagueSd * MIN_SPREAD_SHARE) : leagueSd;
    return { mean: shrunkMean, sd };
  });
};

const indexGames = <G extends SimulationGame>(games: G[]): (G & { index: number })[] =>
  games.map((game, index) => ({ ...game, index }));

/** An empty simulation for when the schedule or scores cannot support odds. */
export function withheldSimulation<G extends SimulationGame>(
  teamIds: number[],
  remainingGames: G[],
): SeasonSimulation<G> {
  return {
    scheduleComplete: false,
    runs: 0,
    teamIds,
    remainingGames: indexGames(remainingGames),
    outlooks: new Map(),
    homeWins: new Uint8Array(0),
    finalSeeds: new Uint8Array(0),
  };
}

/** Sorts by standings credit, then points for. */
export const recordSeedOrder: SeedOrder = (order, winPoints, points) => {
  order.sort((a, b) => winPoints[b] - winPoints[a] || points[b] - points[a]);
};

/**
 * Plays out `remainingGames` `runs` times. The caller must already have
 * checked that the schedule covers every remaining game.
 */
export function playOutSeason<G extends SimulationGame>({
  teams,
  remainingGames: games,
  seedOrder,
  playoffTeamCount,
  playoffByeCount,
  runs = DEFAULT_SIMULATION_RUNS,
  seed = 2026,
}: {
  teams: SimulationTeam[];
  remainingGames: G[];
  seedOrder: SeedOrder;
  playoffTeamCount: number;
  playoffByeCount: number;
} & SimulationOptions): SeasonSimulation<G> {
  const teamIds = teams.map((team) => team.id);
  const teamIndex = new Map(teamIds.map((id, index) => [id, index]));
  const remainingGames = indexGames(games);
  const models = scoreModels(teams);
  const normal = createNormal(createRandom(seed));

  const teamCount = teamIds.length;
  const homeWins = new Uint8Array(runs * remainingGames.length);
  const finalSeeds = new Uint8Array(runs * teamCount);
  const seedCounts = teamIds.map(() => new Array<number>(teamCount).fill(0));
  const totalWins = new Array<number>(teamCount).fill(0);

  const winPoints = new Array<number>(teamCount);
  const points = new Array<number>(teamCount);
  const order = teamIds.map((_, index) => index);

  for (let run = 0; run < runs; run += 1) {
    for (let i = 0; i < teamCount; i += 1) {
      winPoints[i] = teams[i].winPoints;
      points[i] = teams[i].pointsFor;
    }

    remainingGames.forEach((game) => {
      const home = teamIndex.get(game.homeTeamId);
      const away = teamIndex.get(game.awayTeamId);
      if (home === undefined || away === undefined) return;
      const homeModel = models[home];
      const awayModel = models[away];
      const homeScore = Math.max(0, homeModel.mean + homeModel.sd * normal());
      const awayScore = Math.max(0, awayModel.mean + awayModel.sd * normal());
      points[home] += homeScore;
      points[away] += awayScore;
      const homeWon = homeScore >= awayScore;
      winPoints[homeWon ? home : away] += 1;
      homeWins[run * remainingGames.length + game.index] = homeWon ? 1 : 0;
    });

    seedOrder(order, winPoints, points);
    order.forEach((teamIdx, position) => {
      finalSeeds[run * teamCount + teamIdx] = position + 1;
      seedCounts[teamIdx][position] += 1;
    });
    for (let i = 0; i < teamCount; i += 1) totalWins[i] += winPoints[i];
  }

  const outlooks = new Map<number, TeamOutlook>();
  teamIds.forEach((teamId, index) => {
    const seedOdds = seedCounts[index].map((count) => count / Math.max(runs, 1));
    const sumThrough = (cut: number) => seedOdds.slice(0, cut).reduce((sum, odds) => sum + odds, 0);
    const mostLikely = seedOdds.reduce((best, odds, i) => (odds > seedOdds[best] ? i : best), 0);
    outlooks.set(teamId, {
      teamId,
      playoffOdds: sumThrough(playoffTeamCount),
      byeOdds: sumThrough(playoffByeCount),
      seedOdds,
      mostLikelySeed: mostLikely + 1,
      projectedWins: totalWins[index] / Math.max(runs, 1),
    });
  });

  return { scheduleComplete: true, runs, teamIds, remainingGames, outlooks, homeWins, finalSeeds };
}

/**
 * Simulated odds as a whole percent. Mathematically settled results show
 * 100%/0%; anything still open never rounds to a false certainty.
 */
export function formatOdds(
  odds: number,
  { clinched = false, eliminated = false }: { clinched?: boolean; eliminated?: boolean } = {},
): string {
  if (clinched) return '100%';
  if (eliminated) return '0%';
  if (odds >= 0.995) return '>99%';
  if (odds < 0.005) return '<1%';
  return `${Math.round(odds * 100).toString()}%`;
}
