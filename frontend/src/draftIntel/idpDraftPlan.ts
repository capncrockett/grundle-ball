import type { SleeperPlayer, SleeperPlayerProjection } from '../api/sleeper';
import type { IdpTierPlayer, IdpTierSource } from '../data/idpTierSource';
import type {
  MockDraftAnalysis,
  MockDraftAvailability,
  MockDraftPlayerAnalysis,
} from './mockDraftAnalyzer';

export type IdpPlanAction = 'stream' | 'target' | 'watch';

export type IdpPlanOpenPick = {
  overallPick: number;
  round: number;
  pickInRound: number;
};

export type IdpPlanPlayer = IdpTierPlayer & {
  nflTeam: string | null;
  sleeperPosition: string | null;
  playerStatus: string | null;
  sleeperAdp: number | null;
  mockStats: MockDraftPlayerAnalysis | null;
  targetPick: IdpPlanOpenPick | null;
  targetAvailability: MockDraftAvailability | null;
  nextPick: IdpPlanOpenPick | null;
  nextAvailability: MockDraftAvailability | null;
  action: IdpPlanAction;
  isBigPlayFit: boolean;
};

export type IdpDraftPlan = {
  primaryTargets: IdpPlanPlayer[];
  fallbackTargets: IdpPlanPlayer[];
  candidates: IdpPlanPlayer[];
  selectedMockCount: number;
};

export type BuildIdpDraftPlanInput = {
  source: IdpTierSource;
  sleeperPlayers: Record<string, SleeperPlayer>;
  projections: SleeperPlayerProjection[];
  mockAnalysis: MockDraftAnalysis | null;
  openPicks: IdpPlanOpenPick[];
  keeperPlayerIds: ReadonlySet<string>;
};

const MOCK_TARGET_AVAILABILITY_PERCENTAGE = 70;

const readAdp = (projection: SleeperPlayerProjection): number | null => {
  const value = projection.stats.adp_idp_1qb;
  return typeof value === 'number' && Number.isFinite(value) && value >= 1 ? value : null;
};

const chooseTargetPick = (
  openPicks: IdpPlanOpenPick[],
  mockStats: MockDraftPlayerAnalysis | null,
  sleeperAdp: number | null,
): IdpPlanOpenPick | null => {
  const mockTarget = mockStats?.availability
    .filter(
      (availability) =>
        availability.sampleCount > 0 &&
        availability.percentage !== null &&
        availability.percentage >= MOCK_TARGET_AVAILABILITY_PERCENTAGE,
    )
    .at(-1);
  if (mockTarget) {
    return openPicks.find((pick) => pick.overallPick === mockTarget.overallPick) ?? null;
  }

  if (sleeperAdp !== null) {
    return (
      openPicks.filter((pick) => pick.overallPick <= sleeperAdp).at(-1) ?? openPicks.at(0) ?? null
    );
  }

  return openPicks.at(-1) ?? null;
};

const chooseAction = (
  selectedMockCount: number,
  mockStats: MockDraftPlayerAnalysis | null,
  sleeperAdp: number | null,
): IdpPlanAction => {
  if (selectedMockCount > 0 && mockStats) {
    return mockStats.mockCount * 2 < selectedMockCount ? 'stream' : 'target';
  }
  return sleeperAdp === null ? 'watch' : 'target';
};

const targetComparator = (a: IdpPlanPlayer, b: IdpPlanPlayer): number => {
  const actionPriority: Record<IdpPlanAction, number> = { target: 0, watch: 1, stream: 2 };
  const actionDifference = actionPriority[a.action] - actionPriority[b.action];
  if (actionDifference !== 0) return actionDifference;
  if (a.isBigPlayFit !== b.isBigPlayFit) return a.isBigPlayFit ? -1 : 1;

  const aTargetPick = a.targetPick?.overallPick ?? 0;
  const bTargetPick = b.targetPick?.overallPick ?? 0;
  if (aTargetPick !== bTargetPick) return bTargetPick - aTargetPick;

  const aMarketPick = a.mockStats?.meanPick ?? a.sleeperAdp ?? 0;
  const bMarketPick = b.mockStats?.meanPick ?? b.sleeperAdp ?? 0;
  if (aMarketPick !== bMarketPick) return bMarketPick - aMarketPick;
  return a.sourceRank - b.sourceRank;
};

export function buildIdpDraftPlan({
  source,
  sleeperPlayers,
  projections,
  mockAnalysis,
  openPicks,
  keeperPlayerIds,
}: BuildIdpDraftPlanInput): IdpDraftPlan {
  const sortedOpenPicks = [...openPicks].sort((a, b) => a.overallPick - b.overallPick);
  const sleeperAdpByPlayerId = new Map<string, number>();
  projections.forEach((projection) => {
    const adp = readAdp(projection);
    if (adp !== null) sleeperAdpByPlayerId.set(projection.player_id, adp);
  });
  const mockStatsByPlayerId = new Map(
    mockAnalysis?.players.map((player) => [player.playerId, player]) ?? [],
  );
  const sleeperPlayerById = new Map(
    Object.values(sleeperPlayers).map((player) => [player.player_id, player]),
  );
  const selectedMockCount = mockAnalysis?.selectedMockCount ?? 0;

  const candidates = source.players
    .filter((player) => !keeperPlayerIds.has(player.playerId))
    .map<IdpPlanPlayer>((player) => {
      const sleeperPlayer = sleeperPlayerById.get(player.playerId);
      const sleeperAdp = sleeperAdpByPlayerId.get(player.playerId) ?? null;
      const mockStats = mockStatsByPlayerId.get(player.playerId) ?? null;
      const targetPick = chooseTargetPick(sortedOpenPicks, mockStats, sleeperAdp);
      const targetAvailability = targetPick
        ? (mockStats?.availability.find(
            (availability) => availability.overallPick === targetPick.overallPick,
          ) ?? null)
        : null;
      const targetIndex = targetPick
        ? sortedOpenPicks.findIndex((pick) => pick.overallPick === targetPick.overallPick)
        : -1;
      const nextPick = targetIndex >= 0 ? (sortedOpenPicks.at(targetIndex + 1) ?? null) : null;
      const nextAvailability = nextPick
        ? (mockStats?.availability.find(
            (availability) => availability.overallPick === nextPick.overallPick,
          ) ?? null)
        : null;

      return {
        ...player,
        nflTeam: sleeperPlayer?.team ?? null,
        sleeperPosition: sleeperPlayer?.position ?? null,
        playerStatus: sleeperPlayer?.status ?? null,
        sleeperAdp,
        mockStats,
        targetPick,
        targetAvailability,
        nextPick,
        nextAvailability,
        action: chooseAction(selectedMockCount, mockStats, sleeperAdp),
        isBigPlayFit: player.archetype === 'EDGE',
      };
    });

  return {
    primaryTargets: candidates
      .filter((player) => player.tier === 1)
      .sort(targetComparator)
      .filter((player) => player.action === 'target')
      .slice(0, 2),
    fallbackTargets: candidates
      .filter((player) => player.tier === 2)
      .sort(targetComparator)
      .slice(0, 2),
    candidates,
    selectedMockCount,
  };
}
