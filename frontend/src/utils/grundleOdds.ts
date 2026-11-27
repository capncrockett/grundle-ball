// frontend/src/utils/grundleOdds.ts
//
// Grundle League playoff and bye odds for Standings. The Sister League's
// season simulation (seasonSimulation.ts) plays out the real Sleeper schedule,
// with every team scoring around its own completed weeks, and seeds each
// simulated finish under the Grundle rules in computeSeeds.

import { getLeagueMatchupsForWeek } from '../api/sleeper';
import type { Team } from '../models/fantasy';
import { gamesPlayed } from './grundleSeedRanges';
import {
  playOutSeason,
  withheldSimulation,
  type SeasonSimulation,
  type SeedOrder,
  type SimulationOptions,
} from './seasonSimulation';
import { scheduleCoversRemaining, type ScheduledGame } from './seedRanges';
import { RECORD_SEED_COUNT, scoreFor } from './sleeperTransforms';

/** Six teams make the Championship bracket. */
export const GRUNDLE_PLAYOFF_TEAMS = 6;
/** Seeds 1-2 receive first-round byes. */
export const GRUNDLE_BYE_SEEDS = 2;

export type GrundleSimulation = SeasonSimulation;

/**
 * Each roster's score in every week already reflected in the records, keyed
 * by Sleeper roster id. Commissioner score overrides count. Returns null when
 * Sleeper cannot supply them; odds are then withheld.
 */
export async function loadCompletedScores(
  leagueId: string,
  teams: Team[],
): Promise<Map<number, number[]> | null> {
  const completedWeeks = Math.max(0, ...teams.map(gamesPlayed));
  const weeks = Array.from({ length: completedWeeks }, (_, index) => index + 1);
  try {
    const byWeek = await Promise.all(weeks.map((week) => getLeagueMatchupsForWeek(leagueId, week)));
    const scores = new Map<number, number[]>(teams.map((team) => [team.sleeperRosterId, []]));
    byWeek.forEach((rows) => {
      rows.forEach((row) => {
        if (typeof row.matchup_id !== 'number') return;
        scores.get(row.roster_id)?.push(scoreFor(row));
      });
    });
    return scores;
  } catch (err) {
    console.error(err);
    return null;
  }
}

/**
 * Grundle seeding (see computeSeeds) over simulated final records: division
 * winners, then the best remaining records through seed 5, then the highest
 * points for among everyone left, then the rest. Standings go by wins, then
 * points for; the current standings rank settles exact ties.
 */
export function grundleSeedOrder(teams: Team[]): SeedOrder {
  const divisionIds = [
    ...new Set(teams.map((team) => team.divisionId).filter((id): id is number => id !== null)),
  ];
  const slotOf = teams.map((team) =>
    team.divisionId === null ? -1 : divisionIds.indexOf(team.divisionId),
  );
  const baseRank = teams.map((team) => team.rank);
  const standings = teams.map((_, index) => index);
  const seeded = new Uint8Array(teams.length);
  const divisionTaken = new Uint8Array(divisionIds.length);

  return (order, wins, points) => {
    standings.sort(
      (a, b) => wins[b] - wins[a] || points[b] - points[a] || baseRank[a] - baseRank[b],
    );
    seeded.fill(0);
    divisionTaken.fill(0);
    let next = 0;
    const take = (index: number) => {
      order[next] = index;
      next += 1;
      seeded[index] = 1;
    };

    for (const index of standings) {
      const slot = slotOf[index];
      if (slot >= 0 && !divisionTaken[slot]) {
        divisionTaken[slot] = 1;
        take(index);
      }
    }
    for (const index of standings) {
      if (next >= RECORD_SEED_COUNT) break;
      if (!seeded[index]) take(index);
    }
    let pointsSeed = -1;
    for (const index of standings) {
      if (!seeded[index] && (pointsSeed < 0 || points[index] > points[pointsSeed])) {
        pointsSeed = index;
      }
    }
    if (pointsSeed >= 0) take(pointsSeed);
    for (const index of standings) {
      if (!seeded[index]) take(index);
    }
  };
}

/**
 * Playoff and bye odds per Sleeper roster id. Withheld unless the schedule
 * covers every remaining game and every team has a score for each game it
 * has played. Wins alone count toward the record, matching computeSeeds.
 */
export function simulateGrundleSeason(
  teams: Team[],
  remainingGames: ScheduledGame[] | null,
  completedScores: Map<number, number[]> | null,
  regularSeasonWeeks: number,
  options: SimulationOptions = {},
): GrundleSimulation {
  const teamIds = teams.map((team) => team.sleeperRosterId);
  const games = (remainingGames ?? []).map(({ teamA, teamB }) => ({
    homeTeamId: teamA,
    awayTeamId: teamB,
  }));
  const remainingByTeam = new Map(
    teams.map((team) => [
      team.sleeperRosterId,
      Math.max(regularSeasonWeeks - gamesPlayed(team), 0),
    ]),
  );
  const scoresComplete =
    completedScores !== null &&
    teams.every((team) => completedScores.get(team.sleeperRosterId)?.length === gamesPlayed(team));
  if (
    !remainingGames ||
    !scoresComplete ||
    !scheduleCoversRemaining(remainingGames, remainingByTeam)
  ) {
    return withheldSimulation(teamIds, games);
  }

  return playOutSeason({
    teams: teams.map((team) => ({
      id: team.sleeperRosterId,
      winPoints: team.record.wins,
      pointsFor: team.pointsFor,
      scores: completedScores.get(team.sleeperRosterId) ?? [],
    })),
    remainingGames: games,
    seedOrder: grundleSeedOrder(teams),
    playoffTeamCount: GRUNDLE_PLAYOFF_TEAMS,
    playoffByeCount: GRUNDLE_BYE_SEEDS,
    ...options,
  });
}
