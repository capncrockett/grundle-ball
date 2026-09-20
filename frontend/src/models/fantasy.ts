// frontend/src/models/fantasy.ts

import type { SleeperRoster, SleeperUser, SleeperMatchup, SleeperNFLState } from '../api/sleeper';

// --- Internal domain models ---

export interface TeamRecord {
  wins: number;
  losses: number;
  ties: number;
}

export interface Team {
  teamName: string;
  ownerDisplayName: string;
  /** Team/league avatar (Sleeper league logo or team-specific avatar) */
  teamAvatarUrl: string | null;
  /** Manager's global profile avatar */
  userAvatarUrl: string | null;
  sleeperRosterId: number;
  sleeperUserId: string;
  divisionId: number | null;
  divisionName?: string | null;
  divisionAvatarUrl?: string | null;
  record: TeamRecord;
  pointsFor: number;
  pointsAgainst: number;
  rank: number; // 1-based rank in standings
  seed?: number; // 1-12, computed for playoffs
}

export interface PairedMatchup {
  matchupId: number;
  week: number;
  rosterIdA: number;
  rosterIdB: number | null; // handle odd cases / byes
  pointsA: number;
  pointsB: number;
  /** True when pointsA is a commissioner override (e.g. vacant-team median), not the raw computed score. */
  pointsAEdited: boolean;
  /** True when pointsB is a commissioner override (e.g. vacant-team median), not the raw computed score. */
  pointsBEdited: boolean;
  startersA: number; // count of starters for team A
  startersB: number; // count of starters for team B
  playersFinishedA: number; // count of players who have finished their games
  playersFinishedB: number;
}

export interface LiveMatchData {
  teamIdA: number;
  teamIdB: number | null;
  pointsA: number;
  pointsB: number;
  /** True when pointsA is a commissioner override (e.g. vacant-team median), not the raw computed score. */
  pointsAEdited: boolean;
  /** True when pointsB is a commissioner override (e.g. vacant-team median), not the raw computed score. */
  pointsBEdited: boolean;
  startersA: number; // count of starters for team A
  startersB: number; // count of starters for team B
  playersFinishedA: number; // count of players who have finished their games
  playersFinishedB: number;
  week: number;
}

export interface SeasonState {
  week: number;
  displayWeek: number;
  season: string;
  seasonType: string;
  leagueSeason: string;
}

// --- “Glue” types combining raw Sleeper + internal ---

export interface LeagueDataBundle {
  users: SleeperUser[];
  rosters: SleeperRoster[];
  matchups: SleeperMatchup[];
  nflState: SleeperNFLState;
}
