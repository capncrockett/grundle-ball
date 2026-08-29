export type StoredMatchup = {
  leagueId: string;
  season: string;
  week: number;
  team: string;
  opponent: string;
  pointsFor: number;
  pointsAgainst: number;
  margin: number;
  finished: boolean;
};

export type MatchupHistory = StoredMatchup[];

export type MatchupHistoryScope = Pick<StoredMatchup, 'leagueId' | 'season'>;
