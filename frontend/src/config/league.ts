// Centralized league configuration used by frontend pages.
//
// If you ever want to support multiple leagues or environments, consider
// promoting these to environment variables and wiring them through Vite.

export const LEAGUE_ID = '1385053148233621511';

// The Megalabowl is a separate, staging-only Sleeper league (a Fantasy
// Footballers listener super-league) mirrored alongside the main Grundle
// League. See frontend/src/draftIntelAccess.ts for the staging gate that
// restricts its nav link and routes.
//
// Its "win/loss vs. league average" rule (top 6 scorers each week get a
// bonus win, bottom 6 a bonus loss) is confirmed live via
// `league_average_match: 1` in this league's Sleeper settings, so the
// roster wins/losses this app already reads from Sleeper include it - no
// separate computation needed here. It also has no divisions
// (`settings.divisions` is absent); see the `leagueHasDivisionsConfigured`
// check in StandingsPage.
export const MEGALABOWL_LEAGUE_ID = '1402702919295377408';

export const PLAYOFF_WEEKS = {
  round1: 15,
  round2: 16,
  finals: 17,
} as const;
