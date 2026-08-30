export type DraftHistoryTeam = {
  rosterId: number;
  ownerId: string;
  teamName: string;
  managerName: string;
  avatar: string | null;
};

export type DraftHistoryPick = {
  playerId: string;
  playerName: string;
  position: string | null;
  nflTeam: string | null;
  rosterId: number;
  round: number;
  draftSlot: number;
  pickNo: number;
  isKeeper: boolean;
};

export type DraftHistorySlot = {
  draftSlot: number;
  rosterId: number;
};

export type DraftHistorySeason = {
  leagueId: string;
  season: string;
  leagueStatus: 'pre_draft' | 'drafting' | 'in_season' | 'complete';
  draftId: string;
  draftStatus: 'pre_draft' | 'drafting' | 'paused' | 'complete';
  draftType: string;
  startTime: number | null;
  rounds: number;
  teamCount: number;
  draftSlots: DraftHistorySlot[];
  teams: DraftHistoryTeam[];
  picks: DraftHistoryPick[];
};

export type DraftHistorySnapshot = {
  generatedAt: string;
  currentLeagueId: string;
  seasons: DraftHistorySeason[];
};

export type KeeperDesignation = {
  season: string;
  leagueId: string;
  draftStatus: DraftHistorySeason['draftStatus'];
  rosterId: number;
  teamName: string;
  managerName: string;
  playerId: string;
  playerName: string;
  position: string | null;
  nflTeam: string | null;
  round: number;
  pickNo: number;
};

export type KeeperLedgerEntry = {
  rosterId: number;
  teamName: string;
  playerId: string;
  playerName: string;
  position: string | null;
  nflTeam: string | null;
  designations: KeeperDesignation[];
};
