import type { Team } from '../models/fantasy';

export type DerivedTeamWithInsights = Team & {
  gamesPlayed: number;
  pfPerGame: number;
  paPerGame: number;
  pfRank: number;
  standingRank: number;
  fortuneScore: number;
};

export type DivisionInsight = {
  divisionId: number;
  divisionName: string;
  divisionAvatarUrl: string | null;
  members: DerivedTeamWithInsights[];
  avgPfPerGame: number;
  avgPaPerGame: number;
  topSeed: DerivedTeamWithInsights;
};

export type StandingsInsights = {
  derived: DerivedTeamWithInsights[];
  leagueAvgPaPerGame: number;
  toughestSchedule: DerivedTeamWithInsights;
  easiestSchedule: DerivedTeamWithInsights;
  luckiestRecord: DerivedTeamWithInsights;
  unluckiestRecord: DerivedTeamWithInsights;
  divisionStats: DivisionInsight[];
  highestAvgPfDivision: DivisionInsight | null;
  lowestAvgPaDivision: DivisionInsight | null;
  hasDivisionData: boolean;
} | null;

export function computeStandingsInsights(teams: Team[]): StandingsInsights {
  if (teams.length === 0) {
    return null;
  }

  const pfSorted = [...teams].sort((a, b) => b.pointsFor - a.pointsFor);
  const pfRankByRosterId = new Map<number, number>(
    pfSorted.map((team, index) => [team.sleeperRosterId, index + 1]),
  );

  const derived: DerivedTeamWithInsights[] = teams.map((team) => {
    const gamesPlayed = team.record.wins + team.record.losses + team.record.ties;
    const pfPerGame = gamesPlayed > 0 ? team.pointsFor / gamesPlayed : 0;
    const paPerGame = gamesPlayed > 0 ? team.pointsAgainst / gamesPlayed : 0;
    const pfRank = pfRankByRosterId.get(team.sleeperRosterId) ?? teams.length;
    const standingRank = team.seed ?? team.rank;
    const fortuneScore = pfRank - standingRank; // positive: record outpaces PF, negative: unlucky

    return {
      ...team,
      gamesPlayed,
      pfPerGame,
      paPerGame,
      pfRank,
      standingRank,
      fortuneScore,
    };
  });

  const totalGamesPlayed = derived.reduce((sum, team) => sum + team.gamesPlayed, 0);
  // Skip insights until at least one game has been played (avoid preseason noise).
  if (totalGamesPlayed === 0) {
    return null;
  }

  const leagueAvgPaPerGame =
    derived.reduce((sum, team) => sum + team.paPerGame, 0) / derived.length;

  const toughestSchedule = derived.reduce((prev, curr) =>
    curr.paPerGame > prev.paPerGame ? curr : prev,
  );
  const easiestSchedule = derived.reduce((prev, curr) =>
    curr.paPerGame < prev.paPerGame ? curr : prev,
  );
  const luckiestRecord = derived.reduce((prev, curr) =>
    curr.fortuneScore > prev.fortuneScore ? curr : prev,
  );
  const unluckiestRecord = derived.reduce((prev, curr) =>
    curr.fortuneScore < prev.fortuneScore ? curr : prev,
  );

  const hasDivisionData = derived.some((team) => team.divisionId !== null);

  const divisionBuckets = hasDivisionData
    ? derived.reduce((map, team) => {
        const key = team.divisionId ?? -1;
        const current = map.get(key);
        if (current) {
          current.push(team);
        } else {
          map.set(key, [team]);
        }
        return map;
      }, new Map<number, DerivedTeamWithInsights[]>())
    : new Map<number, DerivedTeamWithInsights[]>();

  const divisionStats: DivisionInsight[] = Array.from(divisionBuckets.entries()).map(
    ([divisionId, members]) => {
      const avgPfPerGame = members.reduce((sum, team) => sum + team.pfPerGame, 0) / members.length;
      const avgPaPerGame = members.reduce((sum, team) => sum + team.paPerGame, 0) / members.length;
      const topSeed = members.reduce((prev, curr) =>
        curr.standingRank < prev.standingRank ? curr : prev,
      );
      const divisionName =
        members[0]?.divisionName ??
        (divisionId === -1 ? 'Unassigned division' : `Division ${divisionId.toString()}`);
      const divisionAvatarUrl = members[0]?.divisionAvatarUrl ?? null;

      return {
        divisionId,
        divisionName,
        divisionAvatarUrl,
        members,
        avgPfPerGame,
        avgPaPerGame,
        topSeed,
      };
    },
  );

  const highestAvgPfDivision =
    divisionStats.length > 0
      ? divisionStats.reduce((prev, curr) => (curr.avgPfPerGame > prev.avgPfPerGame ? curr : prev))
      : null;
  const lowestAvgPaDivision =
    divisionStats.length > 0
      ? divisionStats.reduce((prev, curr) => (curr.avgPaPerGame < prev.avgPaPerGame ? curr : prev))
      : null;

  return {
    derived,
    leagueAvgPaPerGame,
    toughestSchedule,
    easiestSchedule,
    luckiestRecord,
    unluckiestRecord,
    divisionStats,
    highestAvgPfDivision,
    lowestAvgPaDivision,
    hasDivisionData,
  };
}
