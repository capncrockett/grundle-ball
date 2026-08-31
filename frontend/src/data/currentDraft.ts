import {
  getDraft,
  getDraftPicks,
  getLeague,
  getLeagueRosters,
  getLeagueUsers,
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

export async function loadCurrentDraftSeason(
  leagueId: string,
  dependencyOverrides: Partial<CurrentDraftDependencies> = {},
): Promise<DraftHistorySeason> {
  const dependencies = { ...DEFAULT_DEPENDENCIES, ...dependencyOverrides };
  const league = await dependencies.getLeague(leagueId);
  const [draft, picks, users, rosters] = await Promise.all([
    dependencies.getDraft(league.draft_id),
    dependencies.getDraftPicks(league.draft_id),
    dependencies.getLeagueUsers(league.league_id),
    dependencies.getLeagueRosters(league.league_id),
  ]);
  return buildDraftHistorySeason(league, draft, picks, users, rosters);
}
