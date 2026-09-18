import {
  getDraft,
  getDraftPicks,
  getLeague,
  getLeagueRosters,
  getLeagueUsers,
  type SleeperLeague,
  type SleeperRoster,
  type SleeperUser,
} from '../api/sleeper';
import { buildDraftHistorySeason } from './draftHistoryTransforms';
import type { DraftHistorySeason } from './draftHistoryTypes';

export type CurrentDraftDependencies = {
  getLeague: typeof getLeague;
  getDraft: typeof getDraft;
  getDraftPicks: typeof getDraftPicks;
  getLeagueUsers: typeof getLeagueUsers;
  getLeagueRosters: typeof getLeagueRosters;
};

const DEFAULT_DEPENDENCIES: CurrentDraftDependencies = {
  getLeague,
  getDraft,
  getDraftPicks,
  getLeagueUsers,
  getLeagueRosters,
};

// League settings, users, and rosters do not change while a draft is in progress, but the
// canonical draft/picks do - so a poll during a live draft only needs to refetch those two.
// This cache holds the rarely-changing pieces per league for the life of the page.
type StaticDraftContext = {
  leagueId: string;
  league: SleeperLeague;
  users: SleeperUser[];
  rosters: SleeperRoster[];
};
let staticContextCache: StaticDraftContext | null = null;

export function resetCurrentDraftSeasonCache(): void {
  staticContextCache = null;
}

export async function loadCurrentDraftSeason(
  leagueId: string,
  dependencyOverrides: Partial<CurrentDraftDependencies> = {},
): Promise<DraftHistorySeason> {
  const dependencies = { ...DEFAULT_DEPENDENCIES, ...dependencyOverrides };
  const cached = staticContextCache?.leagueId === leagueId ? staticContextCache : null;

  const league = cached?.league ?? (await dependencies.getLeague(leagueId));
  const [draft, picks, users, rosters] = await Promise.all([
    dependencies.getDraft(league.draft_id),
    dependencies.getDraftPicks(league.draft_id),
    cached ? Promise.resolve(cached.users) : dependencies.getLeagueUsers(league.league_id),
    cached ? Promise.resolve(cached.rosters) : dependencies.getLeagueRosters(league.league_id),
  ]);

  staticContextCache = { leagueId, league, users, rosters };

  return buildDraftHistorySeason(league, draft, picks, users, rosters);
}
