// frontend/src/sisterLeague/projections.ts
//
// Season-scoring stats and the Sister League's playout of its remaining
// regular-season schedule. The Monte Carlo model lives in
// utils/seasonSimulation.ts; seeds here go by record (a tie is half a win),
// then total points, matching ESPN.

import {
  mean,
  median,
  playOutSeason,
  recordSeedOrder,
  stdDev,
  withheldSimulation,
  type SeasonSimulation as CoreSeasonSimulation,
  type SimulationOptions,
} from '../utils/seasonSimulation';
import {
  hasCompleteRemainingSchedule,
  type SisterLeagueMatchup,
  type SisterLeagueSnapshot,
} from './sisterLeague';

export type { TeamOutlook } from '../utils/seasonSimulation';

export type TeamScoring = {
  teamId: number;
  games: number;
  average: number;
  median: number;
  high: number;
  low: number;
  stdDev: number;
};

export type SimulatedGame = SisterLeagueMatchup & { index: number };

export type SeasonSimulation = CoreSeasonSimulation<SisterLeagueMatchup>;

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

export function simulateSeason(
  snapshot: SisterLeagueSnapshot,
  options: SimulationOptions = {},
): SeasonSimulation {
  const remainingGames = snapshot.matchups.filter((matchup) => !matchup.final);
  if (!hasCompleteRemainingSchedule(snapshot)) {
    return withheldSimulation(
      snapshot.teams.map((team) => team.id),
      remainingGames,
    );
  }
  const scores = completedScoresByTeam(snapshot);
  return playOutSeason({
    teams: snapshot.teams.map((team) => ({
      id: team.id,
      winPoints: team.wins + team.ties * 0.5,
      pointsFor: team.pointsFor,
      scores: scores.get(team.id) ?? [],
    })),
    remainingGames,
    seedOrder: recordSeedOrder,
    playoffTeamCount: snapshot.playoffTeamCount,
    playoffByeCount: snapshot.playoffByeCount,
    ...options,
  });
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
  if (!sim.scheduleComplete) return [];
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
  if (!sim.scheduleComplete) return [];
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
