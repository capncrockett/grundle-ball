import { getDraft, getDraftPicks, type SleeperDraft, type SleeperDraftPick } from '../api/sleeper';
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
  leagueId: string;
  teamCount: number;
  rounds: number;
  draftSlot: number;
  keepers: KeeperAdpInput[];
  createdAtOrAfter: number;
};

export type LoadSleeperMockDraftCandidatesInput = MockDraftCandidateCriteria & {
  draftIds: readonly string[];
};

export type SleeperMockDraftDependencies = {
  getDraft: typeof getDraft;
  getDraftPicks: typeof getDraftPicks;
};

export type ParsedSleeperMockDraftInput = {
  draftIds: string[];
  duplicateDraftIds: string[];
  invalidEntries: string[];
};

const DEFAULT_DEPENDENCIES: SleeperMockDraftDependencies = {
  getDraft,
  getDraftPicks,
};

const positiveIntegerOrNull = (value: number | undefined): number | null =>
  Number.isInteger(value) && (value ?? 0) > 0 ? (value ?? null) : null;

const SLEEPER_DRAFT_URL_PATTERN =
  /(?:https?:\/\/)?(?:www\.)?sleeper\.com\/draft\/nfl\/(\d{16,20})/gi;
const SLEEPER_DRAFT_ID_PATTERN = /^\d{16,20}$/;

export const formatSleeperMockDraftInput = (draftIds: readonly string[]): string =>
  draftIds.map((draftId) => `https://sleeper.com/draft/nfl/${draftId}`).join('\n');

export function parseSleeperMockDraftInput(value: string): ParsedSleeperMockDraftInput {
  const draftIds: string[] = [];
  const duplicateDraftIds: string[] = [];
  const invalidEntries: string[] = [];
  const seenDraftIds = new Set<string>();
  const seenDuplicateIds = new Set<string>();

  const addDraftId = (draftId: string) => {
    if (seenDraftIds.has(draftId)) {
      if (!seenDuplicateIds.has(draftId)) {
        duplicateDraftIds.push(draftId);
        seenDuplicateIds.add(draftId);
      }
      return;
    }
    seenDraftIds.add(draftId);
    draftIds.push(draftId);
  };

  value
    .split(/[\s,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .forEach((entry) => {
      const urlMatches = Array.from(entry.matchAll(SLEEPER_DRAFT_URL_PATTERN));
      if (urlMatches.length > 0) {
        urlMatches.forEach((match) => {
          if (match[1]) addDraftId(match[1]);
        });
        return;
      }

      if (SLEEPER_DRAFT_ID_PATTERN.test(entry)) {
        addDraftId(entry);
      } else {
        invalidEntries.push(entry);
      }
    });

  return { draftIds, duplicateDraftIds, invalidEntries };
}

export function identifySleeperMockDraftCandidates(
  drafts: SleeperDraft[],
  picksByDraftId: ReadonlyMap<string, SleeperDraftPick[]>,
  criteria: MockDraftCandidateCriteria,
): SleeperMockDraftCandidate[] {
  return drafts
    .map((draft) => {
      const picks = picksByDraftId.get(draft.draft_id) ?? [];
      const teamCount = positiveIntegerOrNull(draft.settings.teams);
      const rounds = positiveIntegerOrNull(draft.settings.rounds);
      const draftSlot = draft.draft_order?.[criteria.userId] ?? null;
      const totalPicks = teamCount && rounds ? teamCount * rounds : Math.max(1, picks.length);
      const compatibilityIssues: string[] = [];
      const expectedKeepers = new Set(
        criteria.keepers.map((keeper) => `${keeper.playerId}:${keeper.overallPick.toString()}`),
      );
      const markedKeepers = picks.filter((pick) => pick.is_keeper === true);

      if (draft.metadata?.type !== 'league_mock') {
        compatibilityIssues.push(
          `Expected league mock, found ${draft.metadata?.type?.trim() || 'unknown'}`,
        );
      }
      if (draft.metadata?.league_id !== criteria.leagueId) {
        compatibilityIssues.push(
          `Expected league ${criteria.leagueId}, found ${draft.metadata?.league_id?.trim() || 'unknown'}`,
        );
      }
      if (draft.created < criteria.createdAtOrAfter) {
        compatibilityIssues.push('Draft was created before keeper lock');
      }
      if (!draft.creators?.includes(criteria.userId)) {
        compatibilityIssues.push('Selected Sleeper user did not create this mock');
      }

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
      if (markedKeepers.length !== criteria.keepers.length) {
        compatibilityIssues.push(
          `Expected ${criteria.keepers.length.toString()} keeper slots, found ${markedKeepers.length.toString()}`,
        );
      }
      criteria.keepers.forEach((keeper) => {
        const exactKeeper = picks.some(
          (pick) =>
            pick.player_id === keeper.playerId &&
            pick.pick_no === keeper.overallPick &&
            pick.is_keeper === true,
        );
        if (!exactKeeper) {
          compatibilityIssues.push(
            `Missing keeper ${keeper.playerId} at pick ${keeper.overallPick.toString()}`,
          );
        }
      });
      markedKeepers.forEach((keeper) => {
        const key = `${keeper.player_id}:${keeper.pick_no.toString()}`;
        if (!expectedKeepers.has(key)) {
          compatibilityIssues.push(
            `Unexpected keeper ${keeper.player_id} at pick ${keeper.pick_no.toString()}`,
          );
        }
      });

      return {
        draftId: draft.draft_id,
        leagueId: draft.metadata?.league_id ?? draft.league_id,
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
  const draftIds = criteria.draftIds.map((draftId) => draftId.trim());
  if (draftIds.some((draftId) => !draftId)) throw new Error('Mock draft ID cannot be empty');
  if (new Set(draftIds).size !== draftIds.length) throw new Error('Mock draft IDs must be unique');

  const entries = await Promise.all(
    draftIds.map(async (draftId) => {
      const [draft, picks] = await Promise.all([
        dependencies.getDraft(draftId),
        dependencies.getDraftPicks(draftId),
      ]);
      if (draft.draft_id !== draftId) {
        throw new Error(`Sleeper returned draft ${draft.draft_id} for requested draft ${draftId}`);
      }
      return { draft, picks };
    }),
  );

  return identifySleeperMockDraftCandidates(
    entries.map((entry) => entry.draft),
    new Map(entries.map((entry) => [entry.draft.draft_id, entry.picks])),
    criteria,
  );
}
