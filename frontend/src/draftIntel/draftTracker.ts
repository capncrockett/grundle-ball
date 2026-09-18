import type { DraftHistoryPick, DraftHistorySeason } from '../data/draftHistoryTypes';
import type { KeeperAdjustedDraftSlot } from './keeperAdjustedAdp';

export type DraftTrackerSnapshot = {
  draftedPicks: DraftHistoryPick[];
  draftedByPlayerId: ReadonlyMap<string, DraftHistoryPick>;
  draftedOverallPicks: ReadonlySet<number>;
  draftedCount: number;
  totalOpenPickCount: number;
  remainingPickCount: number;
  latestPick: DraftHistoryPick | null;
  nextPick: KeeperAdjustedDraftSlot | null;
};

export function buildDraftTrackerSnapshot(
  season: DraftHistorySeason,
  openSlots: KeeperAdjustedDraftSlot[],
): DraftTrackerSnapshot {
  const openOverallPicks = new Set(openSlots.map((slot) => slot.overallPick));
  const draftedPicks = season.picks
    .filter((pick) => !pick.isKeeper && openOverallPicks.has(pick.pickNo))
    .sort((a, b) => a.pickNo - b.pickNo);
  const draftedByPlayerId = new Map(draftedPicks.map((pick) => [pick.playerId, pick]));
  const draftedOverallPicks = new Set(draftedPicks.map((pick) => pick.pickNo));
  const nextPick = openSlots.find((slot) => !draftedOverallPicks.has(slot.overallPick)) ?? null;

  return {
    draftedPicks,
    draftedByPlayerId,
    draftedOverallPicks,
    draftedCount: draftedPicks.length,
    totalOpenPickCount: openSlots.length,
    remainingPickCount: Math.max(0, openSlots.length - draftedPicks.length),
    latestPick: draftedPicks.at(-1) ?? null,
    nextPick,
  };
}
