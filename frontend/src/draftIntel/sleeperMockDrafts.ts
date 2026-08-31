import {
  getDraftPicks,
  getUserDrafts,
  getUserLeagues,
  type SleeperDraft,
  type SleeperDraftPick,
} from '../api/sleeper';
import type { KeeperAdpInput } from './keeperAdjustedAdp';
import type { MockDraftSample } from './mockDraftAnalyzer';

export type SleeperMockDraftCandidate = {
  draftId: string;
  leagueId: string;
  name: string;
  createdAt: number;
  teamCount: number | null;
  rounds: number | null;
  draftSlot: number | null;
  compatible: boolean;
  compatibilityIssues: string[];
  sample: MockDraftSample;
};

export type MockDraftCandidateCriteria = {
  userId: string;
  teamCount: number;
  rounds: number;
  draftSlot: number;
  keepers: KeeperAdpInput[];
  knownLeagueIds: string[];
};

export type LoadSleeperMockDraftCandidatesInput = MockDraftCandidateCriteria & {
  season: string;
};

export type SleeperMockDraftDependencies = {
  getUserDrafts: typeof getUserDrafts;
  getUserLeagues: typeof getUserLeagues;
  getDraftPicks: typeof getDraftPicks;
};

const DEFAULT_DEPENDENCIES: SleeperMockDraftDependencies = {
  getUserDrafts,
  getUserLeagues,
  getDraftPicks,
};

const positiveIntegerOrNull = (value: number | undefined): number | null =>
  Number.isInteger(value) && (value ?? 0) > 0 ? (value ?? null) : null;

export function identifySleeperMockDraftCandidates(
  drafts: SleeperDraft[],
  activeLeagueIds: string[],
  picksByDraftId: ReadonlyMap<string, SleeperDraftPick[]>,
  criteria: MockDraftCandidateCriteria,
): SleeperMockDraftCandidate[] {
  const linkedLeagueIds = new Set([...activeLeagueIds, ...criteria.knownLeagueIds]);

  return drafts
    .filter((draft) => !linkedLeagueIds.has(draft.league_id))
    .map((draft) => {
      const picks = picksByDraftId.get(draft.draft_id) ?? [];
      const teamCount = positiveIntegerOrNull(draft.settings.teams);
      const rounds = positiveIntegerOrNull(draft.settings.rounds);
      const draftSlot = draft.draft_order?.[criteria.userId] ?? null;
      const totalPicks = teamCount && rounds ? teamCount * rounds : Math.max(1, picks.length);
      const compatibilityIssues: string[] = [];

      if (draft.status !== 'complete') compatibilityIssues.push('Draft is not complete');
      if (draft.type !== 'snake')
        compatibilityIssues.push(`Expected snake draft, found ${draft.type}`);
      if (teamCount !== criteria.teamCount) {
        compatibilityIssues.push(
          `Expected ${criteria.teamCount.toString()} Teams, found ${teamCount?.toString() ?? 'unknown'}`,
        );
      }
      if (rounds !== criteria.rounds) {
        compatibilityIssues.push(
          `Expected ${criteria.rounds.toString()} rounds, found ${rounds?.toString() ?? 'unknown'}`,
        );
      }
      if (draftSlot !== criteria.draftSlot) {
        compatibilityIssues.push(
          `Expected draft slot ${criteria.draftSlot.toString()}, found ${draftSlot?.toString() ?? 'unknown'}`,
        );
      }
      if (picks.length !== totalPicks) {
        compatibilityIssues.push(
          `Expected ${totalPicks.toString()} completed picks, found ${picks.length.toString()}`,
        );
      }
      criteria.keepers.forEach((keeper) => {
        const exactKeeper = picks.some(
          (pick) => pick.player_id === keeper.playerId && pick.pick_no === keeper.overallPick,
        );
        if (!exactKeeper) {
          compatibilityIssues.push(
            `Missing keeper ${keeper.playerId} at pick ${keeper.overallPick.toString()}`,
          );
        }
      });

      return {
        draftId: draft.draft_id,
        leagueId: draft.league_id,
        name: draft.metadata?.name?.trim() || `Draft ${draft.draft_id}`,
        createdAt: draft.created,
        teamCount,
        rounds,
        draftSlot,
        compatible: compatibilityIssues.length === 0,
        compatibilityIssues,
        sample: {
          draftId: draft.draft_id,
          totalPicks,
          picks: picks.map((pick) => ({ playerId: pick.player_id, pickNo: pick.pick_no })),
        },
      };
    })
    .sort((a, b) => b.createdAt - a.createdAt || a.draftId.localeCompare(b.draftId));
}

export async function loadSleeperMockDraftCandidates(
  criteria: LoadSleeperMockDraftCandidatesInput,
  dependencyOverrides: Partial<SleeperMockDraftDependencies> = {},
): Promise<SleeperMockDraftCandidate[]> {
  const dependencies = { ...DEFAULT_DEPENDENCIES, ...dependencyOverrides };
  const [drafts, leagues] = await Promise.all([
    dependencies.getUserDrafts(criteria.userId, criteria.season),
    dependencies.getUserLeagues(criteria.userId, criteria.season),
  ]);
  const linkedLeagueIds = new Set([
    ...leagues.map((league) => league.league_id),
    ...criteria.knownLeagueIds,
  ]);
  const unlinkedDrafts = drafts.filter((draft) => !linkedLeagueIds.has(draft.league_id));
  const pickEntries = await Promise.all(
    unlinkedDrafts.map(
      async (draft) => [draft.draft_id, await dependencies.getDraftPicks(draft.draft_id)] as const,
    ),
  );

  return identifySleeperMockDraftCandidates(
    drafts,
    leagues.map((league) => league.league_id),
    new Map(pickEntries),
    criteria,
  );
}
