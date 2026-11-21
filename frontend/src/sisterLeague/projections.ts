// frontend/src/sisterLeague/projections.ts
//
// Season-scoring stats and a Monte Carlo playout of the Sister League's
// remaining regular-season schedule. Each team's weekly score is drawn from
// a normal distribution built from its own completed weeks (average nudged
// slightly toward the league average, spread floored at half the league
// spread). Seeds go by record, then total points, matching ESPN.
//
// Results are deterministic for a given snapshot and PRNG seed so the page
// does not reshuffle odds on every render.

import type { SisterLeagueMatchup, SisterLeagueSnapshot } from './sisterLeague';

export type TeamScoring = {
  teamId: number;
  games: number;
  average: number;
  median: number;
  high: number;
  low: number;
  stdDev: number;
};

export type TeamOutlook = {
  teamId: number;
  playoffOdds: number;
  byeOdds: number;
  /** seedOdds[i] is the share of simulations finishing at seed i + 1. */
  seedOdds: number[];
  mostLikelySeed: number;
  projectedWins: number;
};

export type SimulatedGame = SisterLeagueMatchup & { index: number };

export type SeasonSimulation = {
  runs: number;
  teamIds: number[];
  remainingGames: SimulatedGame[];
  outlooks: Map<number, TeamOutlook>;
  /** runs x remainingGames: 1 when the home team won that simulated game. */
  homeWins: Uint8Array;
  /** runs x teamIds: the final seed each team reached in that simulation. */
  finalSeeds: Uint8Array;
};

export type PlayoffTarget = 'playoffs' | 'bye';

export type RootingInterest = {
  game: SimulatedGame;
  rootForTeamId: number;
  oddsIfRootedWins: number;
  oddsOtherwise: number;
  swing: number;
};

export type OddsByWins = {
  wins: number;
  losses: number;
  odds: number;
  share: number;
};

// Pulls each average this many "league-average weeks" toward the league mean.
const SHRINK_WEEKS = 2;
const MIN_SPREAD_SHARE = 0.5;

const mean = (values: number[]): number =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

const median = (values: number[]): number => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
};

const stdDev = (values: number[]): number => {
  if (values.length < 2) return 0;
  const avg = mean(values);
  return Math.sqrt(
    values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (values.length - 1),
  );
};

const completedScoresByTeam = (snapshot: SisterLeagueSnapshot): Map<number, number[]> => {
  const scores = new Map<number, number[]>(snapshot.teams.map((team) => [team.id, []]));
  snapshot.matchups
    .filter((matchup) => matchup.final)
    .forEach((matchup) => {
      scores.get(matchup.homeTeamId)?.push(matchup.homePoints);
      scores.get(matchup.awayTeamId)?.push(matchup.awayPoints);
    });
  return scores;
};

export function computeTeamScoring(snapshot: SisterLeagueSnapshot): Map<number, TeamScoring> {
  const scoring = new Map<number, TeamScoring>();
  completedScoresByTeam(snapshot).forEach((scores, teamId) => {
    scoring.set(teamId, {
      teamId,
      games: scores.length,
      average: mean(scores),
      median: median(scores),
      high: scores.length ? Math.max(...scores) : 0,
      low: scores.length ? Math.min(...scores) : 0,
      stdDev: stdDev(scores),
    });
  });
  return scoring;
}

/** Median of every completed weekly score in the league. */
export function leagueMedianScore(snapshot: SisterLeagueSnapshot): number {
  return median([...completedScoresByTeam(snapshot).values()].flat());
}

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

const scoreModels = (snapshot: SisterLeagueSnapshot): Map<number, { mean: number; sd: number }> => {
  const byTeam = completedScoresByTeam(snapshot);
  const all = [...byTeam.values()].flat();
  const leagueMean = mean(all);
  const leagueSd = stdDev(all);
  const models = new Map<number, { mean: number; sd: number }>();
  byTeam.forEach((scores, teamId) => {
    const n = scores.length;
    const shrunkMean = (n * mean(scores) + SHRINK_WEEKS * leagueMean) / (n + SHRINK_WEEKS);
    const sd = n >= 2 ? Math.max(stdDev(scores), leagueSd * MIN_SPREAD_SHARE) : leagueSd;
    models.set(teamId, { mean: shrunkMean, sd });
  });
  return models;
};

export function simulateSeason(
  snapshot: SisterLeagueSnapshot,
  { runs = 10000, seed = 2026 }: { runs?: number; seed?: number } = {},
): SeasonSimulation {
  const teamIds = snapshot.teams.map((team) => team.id);
  const teamIndex = new Map(teamIds.map((id, index) => [id, index]));
  const remainingGames = snapshot.matchups
    .filter((matchup) => !matchup.final)
    .map((matchup, index) => ({ ...matchup, index }));
  const models = scoreModels(snapshot);
  const normal = createNormal(createRandom(seed));

  const teamCount = teamIds.length;
  const baseWinPoints = snapshot.teams.map((team) => team.wins + team.ties * 0.5);
  const basePoints = snapshot.teams.map((team) => team.pointsFor);
  const homeWins = new Uint8Array(runs * remainingGames.length);
  const finalSeeds = new Uint8Array(runs * teamCount);
  const seedCounts = teamIds.map(() => new Array<number>(teamCount).fill(0));
  const totalWins = new Array<number>(teamCount).fill(0);

  const winPoints = new Array<number>(teamCount);
  const points = new Array<number>(teamCount);
  const order = teamIds.map((_, index) => index);

  for (let run = 0; run < runs; run += 1) {
    for (let i = 0; i < teamCount; i += 1) {
      winPoints[i] = baseWinPoints[i];
      points[i] = basePoints[i];
    }

    remainingGames.forEach((game) => {
      const home = teamIndex.get(game.homeTeamId);
      const away = teamIndex.get(game.awayTeamId);
      if (home === undefined || away === undefined) return;
      const homeModel = models.get(game.homeTeamId) ?? { mean: 0, sd: 0 };
      const awayModel = models.get(game.awayTeamId) ?? { mean: 0, sd: 0 };
      const homeScore = Math.max(0, homeModel.mean + homeModel.sd * normal());
      const awayScore = Math.max(0, awayModel.mean + awayModel.sd * normal());
      points[home] += homeScore;
      points[away] += awayScore;
      const homeWon = homeScore >= awayScore;
      winPoints[homeWon ? home : away] += 1;
      homeWins[run * remainingGames.length + game.index] = homeWon ? 1 : 0;
    });

    order.sort((a, b) => winPoints[b] - winPoints[a] || points[b] - points[a]);
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
      playoffOdds: sumThrough(snapshot.playoffTeamCount),
      byeOdds: sumThrough(snapshot.playoffByeCount),
      seedOdds,
      mostLikelySeed: mostLikely + 1,
      projectedWins: totalWins[index] / Math.max(runs, 1),
    });
  });

  return { runs, teamIds, remainingGames, outlooks, homeWins, finalSeeds };
}

const targetCut = (snapshot: SisterLeagueSnapshot, target: PlayoffTarget): number =>
  target === 'playoffs' ? snapshot.playoffTeamCount : snapshot.playoffByeCount;

const reachedTarget = (sim: SeasonSimulation, run: number, teamIdx: number, cut: number): boolean =>
  sim.finalSeeds[run * sim.teamIds.length + teamIdx] <= cut;

/** Odds of reaching the target for each number of remaining games the team wins. */
export function oddsByRemainingWins(
  snapshot: SisterLeagueSnapshot,
  sim: SeasonSimulation,
  teamId: number,
  target: PlayoffTarget,
): OddsByWins[] {
  const teamIdx = sim.teamIds.indexOf(teamId);
  const cut = targetCut(snapshot, target);
  const ownGames = sim.remainingGames.filter(
    (game) => game.homeTeamId === teamId || game.awayTeamId === teamId,
  );
  const tallies = new Map<number, { runs: number; hits: number }>();

  for (let run = 0; run < sim.runs; run += 1) {
    const wins = ownGames.reduce((count, game) => {
      const homeWon = sim.homeWins[run * sim.remainingGames.length + game.index] === 1;
      return count + (homeWon === (game.homeTeamId === teamId) ? 1 : 0);
    }, 0);
    const tally = tallies.get(wins) ?? { runs: 0, hits: 0 };
    tally.runs += 1;
    if (reachedTarget(sim, run, teamIdx, cut)) tally.hits += 1;
    tallies.set(wins, tally);
  }

  return [...tallies.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([wins, tally]) => ({
      wins,
      losses: ownGames.length - wins,
      odds: tally.hits / tally.runs,
      share: tally.runs / sim.runs,
    }));
}

/**
 * Other teams' remaining games ranked by how much their result moves this
 * team's odds of reaching the target.
 */
export function rootingInterests(
  snapshot: SisterLeagueSnapshot,
  sim: SeasonSimulation,
  teamId: number,
  target: PlayoffTarget,
): RootingInterest[] {
  const teamIdx = sim.teamIds.indexOf(teamId);
  const cut = targetCut(snapshot, target);

  return sim.remainingGames
    .filter((game) => game.homeTeamId !== teamId && game.awayTeamId !== teamId)
    .map((game) => {
      let homeRuns = 0;
      let homeHits = 0;
      let awayHits = 0;
      for (let run = 0; run < sim.runs; run += 1) {
        const hit = reachedTarget(sim, run, teamIdx, cut) ? 1 : 0;
        if (sim.homeWins[run * sim.remainingGames.length + game.index] === 1) {
          homeRuns += 1;
          homeHits += hit;
        } else {
          awayHits += hit;
        }
      }
      const awayRuns = sim.runs - homeRuns;
      const ifHome = homeRuns ? homeHits / homeRuns : 0;
      const ifAway = awayRuns ? awayHits / awayRuns : 0;
      const rootHome = ifHome >= ifAway;
      return {
        game,
        rootForTeamId: rootHome ? game.homeTeamId : game.awayTeamId,
        oddsIfRootedWins: rootHome ? ifHome : ifAway,
        oddsOtherwise: rootHome ? ifAway : ifHome,
        swing: Math.abs(ifHome - ifAway),
      };
    })
    .sort((a, b) => b.swing - a.swing);
}
