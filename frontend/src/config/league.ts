// Centralized league configuration used by frontend pages.
//
// If you ever want to support multiple leagues or environments, consider
// promoting these to environment variables and wiring them through Vite.

export const LEAGUE_ID = '1385053148233621511';

export const PLAYOFF_WEEKS = {
  round1: 15,
  round2: 16,
  finals: 17,
} as const;

// The Sister League: a separate ESPN-hosted league (not the Grundle League), shown as a
// public, unlisted snapshot at /sister-league. The league is private on ESPN, so the
// snapshot is refreshed locally with `npm run sister:update`, which reads
// ESPN_S2/ESPN_SWID from the root .env; the cookies never leave that machine.
//
// The snapshot is public, so the updater replaces the ESPN league name and any
// team name built on a member's first name. Overrides are keyed by ESPN team
// id so the original names never enter the repository; if a team renames
// itself on ESPN, its override still wins until it is updated here.
export const SISTER_LEAGUE = {
  leagueId: '346160653',
  seasonId: 2026,
  displayName: 'GL 2026 League',
  teamNameOverrides: {
    2: "S's Smart Team",
    3: "H's Im New HereTeam",
    9: "V's Spirited Team",
    11: 'B the Crusher',
    18: "C's Cool Team",
    19: "M's llama drama",
  } as Readonly<Record<number, string>>,
} as const;
