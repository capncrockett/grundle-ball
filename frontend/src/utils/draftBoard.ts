export type RoundPick = {
  round: number;
  pickInRound: number;
};

export function getSnakeDraftPickNumber(
  round: number,
  draftSlot: number,
  teamCount: number,
): number {
  const roundOffset = (round - 1) * teamCount;
  return roundOffset + (round % 2 === 1 ? draftSlot : teamCount - draftSlot + 1);
}

export function getSnakeDraftSlot(round: number, pickInRound: number, teamCount: number): number {
  return round % 2 === 1 ? pickInRound : teamCount - pickInRound + 1;
}

export function getRoundPick(overallPick: number, teamCount: number): RoundPick {
  const round = Math.floor((overallPick - 1) / teamCount) + 1;
  return {
    round,
    pickInRound: overallPick - (round - 1) * teamCount,
  };
}
