// frontend/src/sisterLeague/sisterLeague.ts
//
// Snapshot shape and seeding math for the Sister League, a separate ESPN
// league shown at /sister-league. The snapshot is written by
// backend/scripts/updateSisterLeague.ts and keeps only team names, records,
// points, and the regular-season schedule; ESPN member identities are dropped.

import {
  computeScheduleFreeSeedRanges,
  computeSeedRanges,
  scheduleCoversRemaining,
  type ScheduledGame,
  type SeedingRule,
  type SeedRangeTeam,
} from '../utils/seedRanges';

export type SisterLeagueTeam = {
  id: number;
  name: string;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  /** ESPN's current playoff seed (record first, total points as tiebreaker). */
  seed: number;
};

/** One regular-season game. Scores are only meaningful when `final`. */
export type SisterLeagueMatchup = {
  week: number;
  homeTeamId: number;
  awayTeamId: number;
  homePoints: number;
  awayPoints: number;
  final: boolean;
};

export type SisterLeagueSnapshot = {
  leagueId: string;
  seasonId: number;
  leagueName: string;
  fetchedAt: string;
  currentMatchupPeriod: number;
  regularSeasonWeeks: number;
  playoffTeamCount: number;
  /** Top seeds that skip the first playoff round. */
  playoffByeCount: number;
  teams: SisterLeagueTeam[];
  matchups: SisterLeagueMatchup[];
};

export type SisterLeagueSeedRange = {
  teamId: number;
  best: number;
  worst: number;
  label: string;
  clinched: boolean;
  eliminated: boolean;
};

const gamesPlayed = (team: SisterLeagueTeam): number => team.wins + team.losses + team.ties;

/** ESPN seeds by record alone; a tie counts as half a win. */
export const SISTER_LEAGUE_SEEDING: SeedingRule = { kind: 'record' };

export const toSeedRangeTeams = (snapshot: SisterLeagueSnapshot): SeedRangeTeam[] =>
  snapshot.teams.map((team) => ({
    id: team.id,
    wins: team.wins,
    ties: team.ties,
    divisionId: null,
  }));

/** Regular-season games not yet final, as scheduled. */
export const remainingSchedule = (snapshot: SisterLeagueSnapshot): ScheduledGame[] =>
  snapshot.matchups
    .filter((matchup) => !matchup.final)
    .map((matchup) => ({ teamA: matchup.homeTeamId, teamB: matchup.awayTeamId }));

/**
 * Best/worst possible final seed under the remaining schedule (see
 * utils/seedRanges.ts): every remaining game is a win or a loss against the
 * opponent actually scheduled. Points-for ties break toward the team in its
 * best case and against it in its worst case, since season points are not
 * final.
 */
export function computeSisterLeagueSeedRanges(
  snapshot: SisterLeagueSnapshot,
): SisterLeagueSeedRange[] {
  const { teams, regularSeasonWeeks, playoffTeamCount } = snapshot;
  const remainingByTeam = new Map(
    teams.map((team) => [team.id, Math.max(regularSeasonWeeks - gamesPlayed(team), 0)]),
  );
  const seasonComplete = [...remainingByTeam.values()].every((count) => count === 0);
  const schedule = remainingSchedule(snapshot);
  const bounds = seasonComplete
    ? null
    : scheduleCoversRemaining(schedule, remainingByTeam)
      ? computeSeedRanges(toSeedRangeTeams(snapshot), schedule, SISTER_LEAGUE_SEEDING)
      : computeScheduleFreeSeedRanges(
          toSeedRangeTeams(snapshot),
          remainingByTeam,
          SISTER_LEAGUE_SEEDING,
        );

  return [...teams]
    .sort((a, b) => a.seed - b.seed)
    .map((team) => {
      const best = bounds?.get(team.id)?.best ?? team.seed;
      const worst = bounds?.get(team.id)?.worst ?? team.seed;

      return {
        teamId: team.id,
        best,
        worst,
        label: `${best.toString()}-${worst.toString()}`,
        clinched: worst <= playoffTeamCount,
        eliminated: best > playoffTeamCount,
      };
    });
}
