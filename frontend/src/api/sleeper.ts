// frontend/src/api/sleeper.ts

const SLEEPER_BASE_URL = 'https://api.sleeper.app/v1';
const SLEEPER_PROJECTIONS_BASE = 'https://api.sleeper.com/projections/nfl';

type SleeperSeasonType = 'pre' | 'regular' | 'post';
type SleeperLeagueStatus = 'pre_draft' | 'drafting' | 'in_season' | 'complete';

// --- Raw Sleeper API types (mirror docs) ---

export interface SleeperLeague {
  total_rosters: number;
  status: SleeperLeagueStatus;
  sport: 'nfl';
  settings: Record<string, unknown>;
  metadata?: Record<string, string | undefined>;
  season_type: SleeperSeasonType;
  season: string;
  scoring_settings: Record<string, number>;
  roster_positions: string[];
  previous_league_id?: string;
  name: string;
  league_id: string;
  draft_id: string;
  avatar?: string | null;
}

export interface SleeperRosterSettings {
  wins?: number;
  losses?: number;
  ties?: number;
  fpts?: number;
  fpts_decimal?: number;
  fpts_against?: number;
  fpts_against_decimal?: number;
  division_id?: number;
  division?: number;
  [key: string]: number | undefined;
}

export interface SleeperRoster {
  starters: string[];
  settings: SleeperRosterSettings;
  roster_id: number;
  reserve: string[];
  players: string[];
  owner_id: string;
  league_id: string;
  division_id?: number | null;
  division?: number | null;
  metadata?: Record<string, string | undefined>;
}

export interface SleeperUserMetadata {
  team_name?: string;
  [key: string]: string | undefined;
}

export interface SleeperUser {
  user_id: string;
  username: string;
  display_name: string;
  avatar?: string | null;
  metadata?: SleeperUserMetadata;
  is_owner?: boolean; // commissioner flag
}

export interface SleeperMatchup {
  starters: string[];
  roster_id: number;
  players: string[];
  matchup_id: number;
  points: number;
  custom_points?: number | null;
}

export interface SleeperNFLState {
  week: number;
  season_type: 'pre' | 'regular' | 'post';
  season_start_date: string;
  season: string;
  previous_season: string;
  leg: number;
  league_season: string;
  league_create_season: string;
  display_week: number;
}

export interface SleeperPlayoffMatchup {
  /** Unique identifier for this playoff matchup */
  r: number; // round
  m: number; // matchup number within round
  /** Team 1 roster ID */
  t1?: number;
  /** Team 2 roster ID */
  t2?: number;
  /** From matchup (route for advancement) */
  t1_from?: { w?: number; l?: number } | null;
  t2_from?: { w?: number; l?: number } | null;
  /** Winner roster ID (null if not yet played) */
  w?: number | null;
  /** Loser roster ID (null if not yet played) */
  l?: number | null;
  /** Winner's final placement; the loser finishes one place lower */
  p?: number | null;
}

export interface SleeperPlayerProjection {
  player_id: string;
  stats: {
    pts_half_ppr?: number;
    pts_ppr?: number;
    pts_std?: number;
    [key: string]: number | undefined;
  };
  player?: {
    position?: string;
    team?: string;
    [key: string]: unknown;
  };
}

async function sleeperFetch<T>(path: string, bustCache = false): Promise<T> {
  let url = `${SLEEPER_BASE_URL}${path}`;

  // Add cache-busting query param instead of headers to avoid CORS issues
  if (bustCache) {
    const separator = path.includes('?') ? '&' : '?';
    url += `${separator}_t=${Date.now().toString()}`;
  }

  const response = await fetch(url, {
    // Use no-store cache mode to prevent browser caching
    cache: bustCache ? 'no-store' : 'default',
  });

  if (!response.ok) {
    // You can add more robust logging / error boundaries later
    throw new Error(`Sleeper API error (${response.status.toString()}): ${response.statusText}`);
  }

  return (await response.json()) as T;
}

// --- Public client functions ---

export async function getLeague(leagueId: string): Promise<SleeperLeague> {
  return sleeperFetch<SleeperLeague>(`/league/${leagueId}`, true);
}

export async function getLeagueUsers(leagueId: string): Promise<SleeperUser[]> {
  return sleeperFetch<SleeperUser[]>(`/league/${leagueId}/users`, true);
}

export async function getLeagueRosters(leagueId: string): Promise<SleeperRoster[]> {
  return sleeperFetch<SleeperRoster[]>(`/league/${leagueId}/rosters`, true);
}

export async function getLeagueMatchupsForWeek(
  leagueId: string,
  week: number,
): Promise<SleeperMatchup[]> {
  return sleeperFetch<SleeperMatchup[]>(`/league/${leagueId}/matchups/${String(week)}`, true);
}

export async function getNFLState(): Promise<SleeperNFLState> {
  return sleeperFetch<SleeperNFLState>('/state/nfl', true);
}

export async function getWinnersBracket(leagueId: string): Promise<SleeperPlayoffMatchup[]> {
  return sleeperFetch<SleeperPlayoffMatchup[]>(`/league/${leagueId}/winners_bracket`, true);
}

export async function getLosersBracket(leagueId: string): Promise<SleeperPlayoffMatchup[]> {
  return sleeperFetch<SleeperPlayoffMatchup[]>(`/league/${leagueId}/losers_bracket`, true);
}

export async function getPlayerProjections(
  season: number,
  week: number,
): Promise<SleeperPlayerProjection[]> {
  const url = `${SLEEPER_PROJECTIONS_BASE}/${String(season)}/${String(week)}?season_type=regular`;
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(
      `Projections API error (${response.status.toString()}): ${response.statusText}`,
    );
  }
  return (await response.json()) as SleeperPlayerProjection[];
}

export interface SleeperPlayer {
  player_id: string;
  team: string | null;
  position: string;
  first_name: string;
  last_name: string;
  status?: string;
  [key: string]: unknown;
}

export async function getAllPlayers(): Promise<Record<string, SleeperPlayer>> {
  // Cache players data in memory for the session (it's a large payload)
  const response = await fetch('https://api.sleeper.app/v1/players/nfl', {
    cache: 'force-cache', // Cache aggressively since player data changes rarely
  });
  if (!response.ok) {
    throw new Error(`Players API error (${response.status.toString()}): ${response.statusText}`);
  }
  return (await response.json()) as Record<string, SleeperPlayer>;
}

// Helpers for avatar URLs (full + thumb) as per docs
export function buildSleeperAvatarUrl(avatarId: string | null | undefined): string | null {
  if (!avatarId) return null;
  return `https://sleepercdn.com/avatars/${avatarId}`;
}

export function buildSleeperAvatarThumbUrl(avatarId: string | null | undefined): string | null {
  if (!avatarId) return null;
  return `https://sleepercdn.com/avatars/thumbs/${avatarId}`;
}
