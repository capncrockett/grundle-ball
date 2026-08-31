import { getRoundPick, getSnakeDraftSlot, type RoundPick } from '../utils/draftBoard.ts';

export type BaselineAdpPlayer = {
  playerId: string;
  playerName: string;
  position: string;
  nflTeam: string | null;
  baselineAdp: number;
  sourceRank: number;
};

export type KeeperAdpInput = {
  playerId: string;
  overallPick: number;
};

export type KeeperAdjustedDraftConfig = {
  teamCount: number;
  rounds: number;
  draftType: string;
  draftSlots: Array<{
    draftSlot: number;
    rosterId: number;
  }>;
};

export type DraftPosition = {
  overallPick: number;
  lower: RoundPick;
  upper: RoundPick;
  fraction: number;
};

export type KeeperAdjustedDraftSlot = {
  overallPick: number;
  round: number;
  pickInRound: number;
  draftSlot: number;
  rosterId: number;
  keeperPlayerId: string | null;
};

export type KeeperAdjustedAdpRow = {
  playerId: string;
  playerName: string;
  position: string;
  nflTeam: string | null;
  baselineAdp: number;
  keeperAdjustedAdp: number | null;
  adpDelta: number | null;
  baselineRoundPick: DraftPosition;
  adjustedRoundPick: DraftPosition | null;
  availablePoolRank: number;
  higherRankedKeepersRemoved: number;
};

export type KeeperAdjustedAdpResult = {
  players: KeeperAdjustedAdpRow[];
  board: KeeperAdjustedDraftSlot[];
  openSlots: KeeperAdjustedDraftSlot[];
};

const precise = (value: number): number => Number(value.toFixed(10));

const requirePositiveInteger = (value: number, label: string): void => {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
};

const compareBaselinePlayers = (a: BaselineAdpPlayer, b: BaselineAdpPlayer): number => {
  if (a.baselineAdp !== b.baselineAdp) return a.baselineAdp - b.baselineAdp;
  if (a.sourceRank !== b.sourceRank) return a.sourceRank - b.sourceRank;
  return a.playerId.localeCompare(b.playerId);
};

const validateDraftConfig = (config: KeeperAdjustedDraftConfig): void => {
  requirePositiveInteger(config.teamCount, 'Team count');
  requirePositiveInteger(config.rounds, 'Round count');

  if (config.draftType !== 'snake') {
    throw new Error('Keeper-Adjusted ADP currently supports snake drafts only');
  }
  if (config.draftSlots.length !== config.teamCount) {
    throw new Error('Draft slot assignments must cover every Team');
  }

  const slots = new Set<number>();
  const rosters = new Set<number>();
  config.draftSlots.forEach(({ draftSlot, rosterId }) => {
    requirePositiveInteger(draftSlot, 'Draft slot');
    requirePositiveInteger(rosterId, 'Roster ID');
    if (draftSlot > config.teamCount) throw new Error('Draft slot is outside the draft order');
    if (slots.has(draftSlot)) throw new Error(`Duplicate draft slot ${draftSlot.toString()}`);
    if (rosters.has(rosterId)) throw new Error(`Duplicate roster ID ${rosterId.toString()}`);
    slots.add(draftSlot);
    rosters.add(rosterId);
  });
};

const validatePlayers = (players: BaselineAdpPlayer[]): Map<string, BaselineAdpPlayer> => {
  const playersById = new Map<string, BaselineAdpPlayer>();
  players.forEach((player) => {
    if (!player.playerId.trim()) throw new Error('Baseline ADP contains an empty player ID');
    if (playersById.has(player.playerId)) {
      throw new Error(`Baseline ADP contains duplicate player ID ${player.playerId}`);
    }
    if (!Number.isFinite(player.baselineAdp) || player.baselineAdp < 1) {
      throw new Error(`Invalid baseline ADP for ${player.playerName}`);
    }
    requirePositiveInteger(player.sourceRank, `Source rank for ${player.playerName}`);
    playersById.set(player.playerId, player);
  });
  return playersById;
};

export function buildKeeperAdjustedDraftBoard(
  config: KeeperAdjustedDraftConfig,
  keepers: KeeperAdpInput[],
): KeeperAdjustedDraftSlot[] {
  validateDraftConfig(config);
  const totalPicks = config.teamCount * config.rounds;
  const keeperByPick = new Map<number, string>();
  const keeperIds = new Set<string>();

  keepers.forEach((keeper) => {
    requirePositiveInteger(keeper.overallPick, 'Keeper overall pick');
    if (keeper.overallPick > totalPicks) {
      throw new Error(`Keeper pick ${keeper.overallPick.toString()} is outside the draft board`);
    }
    if (keeperByPick.has(keeper.overallPick)) {
      throw new Error(`Multiple keepers occupy pick ${keeper.overallPick.toString()}`);
    }
    if (keeperIds.has(keeper.playerId)) {
      throw new Error(`Duplicate keeper player ID ${keeper.playerId}`);
    }
    keeperByPick.set(keeper.overallPick, keeper.playerId);
    keeperIds.add(keeper.playerId);
  });

  const rosterByDraftSlot = new Map(
    config.draftSlots.map(({ draftSlot, rosterId }) => [draftSlot, rosterId]),
  );

  return Array.from({ length: totalPicks }, (_, index) => {
    const overallPick = index + 1;
    const { round, pickInRound } = getRoundPick(overallPick, config.teamCount);
    const draftSlot = getSnakeDraftSlot(round, pickInRound, config.teamCount);
    const rosterId = rosterByDraftSlot.get(draftSlot);
    if (rosterId === undefined) {
      throw new Error(`Draft slot ${draftSlot.toString()} has no roster assignment`);
    }
    return {
      overallPick,
      round,
      pickInRound,
      draftSlot,
      rosterId,
      keeperPlayerId: keeperByPick.get(overallPick) ?? null,
    };
  });
}

export function toDraftPosition(overallPick: number, teamCount: number): DraftPosition {
  const lowerOverallPick = Math.floor(overallPick);
  const upperOverallPick = Math.ceil(overallPick);
  return {
    overallPick,
    lower: getRoundPick(lowerOverallPick, teamCount),
    upper: getRoundPick(upperOverallPick, teamCount),
    fraction: precise(overallPick - lowerOverallPick),
  };
}

export function mapAvailablePoolRankToOpenPick(
  availablePoolRank: number,
  openOverallPicks: number[],
): number | null {
  if (openOverallPicks.length === 0) return null;
  const boundedRank = Math.max(1, availablePoolRank);
  if (boundedRank > openOverallPicks.length) return null;

  const lowerRank = Math.floor(boundedRank);
  const upperRank = Math.ceil(boundedRank);
  const lowerPick = openOverallPicks.at(lowerRank - 1);
  const upperPick = openOverallPicks.at(upperRank - 1);
  if (lowerPick === undefined || upperPick === undefined) return null;
  if (lowerRank === upperRank) return lowerPick;

  return precise(lowerPick + (boundedRank - lowerRank) * (upperPick - lowerPick));
}

export function calculateKeeperAdjustedAdp(
  players: BaselineAdpPlayer[],
  keepers: KeeperAdpInput[],
  config: KeeperAdjustedDraftConfig,
): KeeperAdjustedAdpResult {
  const playersById = validatePlayers(players);
  const board = buildKeeperAdjustedDraftBoard(config, keepers);
  const keeperPlayers = keepers.map((keeper) => {
    const player = playersById.get(keeper.playerId);
    if (!player) {
      throw new Error(`Keeper ${keeper.playerId} is missing from the baseline ADP source`);
    }
    return player;
  });
  const keeperIds = new Set(keepers.map((keeper) => keeper.playerId));
  const openSlots = board.filter((slot) => slot.keeperPlayerId === null);
  const openOverallPicks = openSlots.map((slot) => slot.overallPick);

  const adjustedPlayers = [...players]
    .sort(compareBaselinePlayers)
    .filter((player) => !keeperIds.has(player.playerId))
    .map<KeeperAdjustedAdpRow>((player) => {
      const higherRankedKeepersRemoved = keeperPlayers.filter(
        (keeper) => compareBaselinePlayers(keeper, player) < 0,
      ).length;
      const availablePoolRank = precise(
        Math.max(1, player.baselineAdp - higherRankedKeepersRemoved),
      );
      const keeperAdjustedAdp = mapAvailablePoolRankToOpenPick(availablePoolRank, openOverallPicks);

      return {
        playerId: player.playerId,
        playerName: player.playerName,
        position: player.position,
        nflTeam: player.nflTeam,
        baselineAdp: player.baselineAdp,
        keeperAdjustedAdp,
        adpDelta:
          keeperAdjustedAdp === null ? null : precise(keeperAdjustedAdp - player.baselineAdp),
        baselineRoundPick: toDraftPosition(player.baselineAdp, config.teamCount),
        adjustedRoundPick:
          keeperAdjustedAdp === null ? null : toDraftPosition(keeperAdjustedAdp, config.teamCount),
        availablePoolRank,
        higherRankedKeepersRemoved,
      };
    });

  return { players: adjustedPlayers, board, openSlots };
}

export function getOpenDraftPicksForRoster(
  board: KeeperAdjustedDraftSlot[],
  rosterId: number,
): KeeperAdjustedDraftSlot[] {
  return board.filter((slot) => slot.rosterId === rosterId && slot.keeperPlayerId === null);
}
