export const KEEPER_ADP_TEAM_COUNT = 12;
export const CURRENT_DRAFT_ROUNDS = 16;

export type KeeperAdpCalculation = {
  adp: number;
  adpRound: number;
  roundStartPick: number;
  roundEndPick: number;
  uncappedKeeperRound: number;
  keeperRound: number;
  wasCapped: boolean;
};

export function calculateUndraftedKeeperCost(adp: number): KeeperAdpCalculation | null {
  if (!Number.isFinite(adp) || adp < 1) return null;

  const adpRound = Math.ceil(adp / KEEPER_ADP_TEAM_COUNT);
  const uncappedKeeperRound = adpRound + 2;
  const keeperRound = Math.min(uncappedKeeperRound, CURRENT_DRAFT_ROUNDS);

  return {
    adp,
    adpRound,
    roundStartPick: (adpRound - 1) * KEEPER_ADP_TEAM_COUNT + 1,
    roundEndPick: adpRound * KEEPER_ADP_TEAM_COUNT,
    uncappedKeeperRound,
    keeperRound,
    wasCapped: keeperRound !== uncappedKeeperRound,
  };
}
