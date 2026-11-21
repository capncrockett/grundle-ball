// frontend/src/sisterLeague/sisterLeague.ts
//
// Snapshot shape and seeding math for the Sister League, a separate ESPN
// league shown at /sister-league. The
// snapshot is written by backend/scripts/updateSisterLeague.ts and keeps only
// team names, records, and points; ESPN member identities are dropped.

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

export type SisterLeagueSnapshot = {
  leagueId: string;
  seasonId: number;
  leagueName: string;
  fetchedAt: string;
  currentMatchupPeriod: number;
  regularSeasonWeeks: number;
  playoffTeamCount: number;
  teams: SisterLeagueTeam[];
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

const winPoints = (team: SisterLeagueTeam): number => team.wins + team.ties * 0.5;

const remainingGames = (team: SisterLeagueTeam, regularSeasonWeeks: number): number =>
  Math.max(regularSeasonWeeks - gamesPlayed(team), 0);

/**
 * Best/worst possible final seed, using the same bounds as the Grundle
 * standings: best case, the team wins out while everyone else loses out;
 * worst case, the reverse. Points-for ties break toward the team in its best
 * case and against it in its worst case, since season points are not final.
 */
export function computeSisterLeagueSeedRanges(
  snapshot: SisterLeagueSnapshot,
): SisterLeagueSeedRange[] {
  const { teams, regularSeasonWeeks, playoffTeamCount } = snapshot;
  const seasonComplete = teams.every((team) => remainingGames(team, regularSeasonWeeks) === 0);

  return [...teams]
    .sort((a, b) => a.seed - b.seed)
    .map((team) => {
      let best = team.seed;
      let worst = team.seed;

      if (!seasonComplete) {
        const ceiling = winPoints(team) + remainingGames(team, regularSeasonWeeks);
        const floor = winPoints(team);
        const others = teams.filter((other) => other.id !== team.id);
        best = 1 + others.filter((other) => winPoints(other) > ceiling).length;
        worst =
          1 +
          others.filter(
            (other) => winPoints(other) + remainingGames(other, regularSeasonWeeks) >= floor,
          ).length;
      }

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
