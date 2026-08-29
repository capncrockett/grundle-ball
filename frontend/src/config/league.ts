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
