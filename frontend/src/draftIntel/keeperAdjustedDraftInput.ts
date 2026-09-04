import type { DraftHistorySeason } from '../data/draftHistoryTypes';
import type { KeeperAdpInput, KeeperAdjustedDraftConfig } from './keeperAdjustedAdp';

export type KeeperAdjustedDraftInput = {
  config: KeeperAdjustedDraftConfig;
  keepers: KeeperAdpInput[];
};

export function buildKeeperAdjustedDraftInput(
  season: DraftHistorySeason,
): KeeperAdjustedDraftInput {
  if (season.draftType !== 'snake') {
    throw new Error(`Unsupported Sleeper draft type: ${season.draftType}`);
  }

  return {
    config: {
      teamCount: season.teamCount,
      rounds: season.rounds,
      draftType: 'snake',
      draftSlots: season.draftSlots,
    },
    keepers: season.picks
      .filter((pick) => pick.isKeeper)
      .map((pick) => ({ playerId: pick.playerId, overallPick: pick.pickNo })),
  };
}
