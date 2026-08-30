import draftHistoryData from './draftHistoryStore.json';
import type { DraftHistorySnapshot } from './draftHistoryTypes';

export const DRAFT_HISTORY: DraftHistorySnapshot = draftHistoryData as DraftHistorySnapshot;

export {
  buildDraftHistorySeason,
  buildKeeperLedger,
  getDraftPickNumber,
  getTeamForRoster,
  mergeLiveDraftSeason,
} from './draftHistoryTransforms';
