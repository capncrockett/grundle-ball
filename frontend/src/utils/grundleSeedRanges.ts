// frontend/src/utils/grundleSeedRanges.ts
//
// Grundle League best/worst seed ranges from the real remaining schedule,
// shared by Standings and the Playoffs narratives (Bubble Watch, Bye Chase,
// Division Races). The search itself lives in seedRanges.ts.

import { getLeagueMatchupsForWeek, type SleeperLeague } from '../api/sleeper';
import type { Team } from '../models/fantasy';
import { RECORD_SEED_COUNT, scheduledGamesFromMatchups } from './sleeperTransforms';
import {
  computeScheduleFreeSeedRanges,
  computeSeedRanges,
  scheduleCoversRemaining,
  type ScheduledGame,
  type SeedBounds,
  type SeedingRule,
} from './seedRanges';

const GRUNDLE_SEEDING: SeedingRule = { kind: 'divisions', recordSeeds: RECORD_SEED_COUNT };

export const gamesPlayed = (team: Team): number =>
  team.record.wins + team.record.losses + team.record.ties;

/** Regular-season length from Sleeper; an unset or 0 playoff start means 14 weeks. */
export const regularSeasonWeeksFor = (league: SleeperLeague | null): number => {
  const playoffWeekStart = league?.settings.playoff_week_start;
  return typeof playoffWeekStart === 'number' && playoffWeekStart > 0
    ? Math.max(1, playoffWeekStart - 1)
    : 14;
};

/**
 * Sleeper pairings for every regular-season week not yet reflected in the
 * records. Returns null when Sleeper cannot supply them; ranges then fall
 * back to the schedule-free bound.
 */
export async function loadRemainingGames(
  leagueId: string,
  teams: Team[],
  regularSeasonWeeks: number,
): Promise<ScheduledGame[] | null> {
  const completedWeeks = Math.max(0, ...teams.map(gamesPlayed));
  const weeks: number[] = [];
  for (let week = completedWeeks + 1; week <= regularSeasonWeeks; week += 1) weeks.push(week);
  try {
    const byWeek = await Promise.all(weeks.map((week) => getLeagueMatchupsForWeek(leagueId, week)));
    return byWeek.flatMap(scheduledGamesFromMatchups);
  } catch (err) {
    console.error(err);
    return null;
  }
}

/**
 * Best/worst seed per Sleeper roster id. Records count wins only, matching
 * computeSeeds. Without a schedule that covers every remaining game, falls
 * back to the looser schedule-free bound. Once the season is complete, each
 * team is locked to its current seed.
 */
export function computeGrundleSeedRanges(
  teams: Team[],
  remainingGames: ScheduledGame[] | null,
  regularSeasonWeeks: number,
): Map<number, SeedBounds> {
  const remainingByTeam = new Map(
    teams.map((team) => [
      team.sleeperRosterId,
      Math.max(regularSeasonWeeks - gamesPlayed(team), 0),
    ]),
  );
  if ([...remainingByTeam.values()].every((count) => count === 0)) {
    return new Map(
      teams.map((team) => {
        const seed = team.seed ?? team.rank;
        return [team.sleeperRosterId, { best: seed, worst: seed }];
      }),
    );
  }
  const seedTeams = teams.map((team) => ({
    id: team.sleeperRosterId,
    wins: team.record.wins,
    ties: 0,
    divisionId: team.divisionId,
  }));
  return remainingGames && scheduleCoversRemaining(remainingGames, remainingByTeam)
    ? computeSeedRanges(seedTeams, remainingGames, GRUNDLE_SEEDING)
    : computeScheduleFreeSeedRanges(seedTeams, remainingByTeam, GRUNDLE_SEEDING);
}
