import type {
  BaselineAdpPlayer,
  KeeperAdpInput,
  KeeperAdjustedDraftConfig,
} from '../keeperAdjustedAdp';

const player = (
  playerId: string,
  playerName: string,
  baselineAdp: number,
  sourceRank: number,
): BaselineAdpPlayer => ({
  playerId,
  playerName,
  position: 'RB',
  nflTeam: 'TST',
  baselineAdp,
  sourceRank,
});

export const syntheticKeeperAdpPlayers: BaselineAdpPlayer[] = [
  player('keeper-late', 'Late Elite Keeper', 1, 1),
  player('available-2', 'Available Two', 2, 2),
  player('keeper-early', 'Early Keeper', 3, 3),
  player('available-4', 'Available Four', 4, 4),
  player('available-6', 'Available Six', 6, 5),
  player('available-6-5', 'Available Six Point Five', 6.5, 6),
  player('available-11', 'Available Eleven', 11, 7),
];

export const syntheticKeeperAdpKeepers: KeeperAdpInput[] = [
  { playerId: 'keeper-early', overallPick: 4 },
  { playerId: 'keeper-late', overallPick: 10 },
];

export const syntheticKeeperAdpDraftConfig: KeeperAdjustedDraftConfig = {
  teamCount: 4,
  rounds: 4,
  draftType: 'snake',
  draftSlots: [
    { draftSlot: 1, rosterId: 1 },
    { draftSlot: 2, rosterId: 2 },
    { draftSlot: 3, rosterId: 3 },
    { draftSlot: 4, rosterId: 4 },
  ],
};
