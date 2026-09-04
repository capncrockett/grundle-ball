import type { SleeperPlayer, SleeperPlayerProjection } from '../api/sleeper';
import type { IdpTierPlayer, IdpTierSource } from '../data/idpTierSource';
import { buildIdpDraftPlan, type IdpPlanOpenPick } from './idpDraftPlan';
import { analyzeMockDrafts, type MockDraftSample } from './mockDraftAnalyzer';

const tierPlayers: IdpTierPlayer[] = [
  { playerId: 'early-edge', playerName: 'Early Edge', sourceRank: 1, tier: 1, archetype: 'EDGE' },
  { playerId: 'middle-edge', playerName: 'Middle Edge', sourceRank: 2, tier: 1, archetype: 'EDGE' },
  { playerId: 'late-edge', playerName: 'Late Edge', sourceRank: 3, tier: 1, archetype: 'EDGE' },
  {
    playerId: 'late-tackler',
    playerName: 'Late Tackler',
    sourceRank: 4,
    tier: 1,
    archetype: 'TACKLE',
  },
  {
    playerId: 'fallback-one',
    playerName: 'Fallback One',
    sourceRank: 5,
    tier: 2,
    archetype: 'EDGE',
  },
  {
    playerId: 'fallback-two',
    playerName: 'Fallback Two',
    sourceRank: 6,
    tier: 2,
    archetype: 'EDGE',
  },
];

const source: IdpTierSource = {
  name: 'Test IDP tiers',
  sourceUrl: 'https://example.com/idp',
  publishedOn: '2026-01-01',
  retrievedOn: '2026-01-02',
  players: tierPlayers,
};

const sleeperPlayers = Object.fromEntries(
  tierPlayers.map((player) => [
    player.playerId,
    {
      player_id: player.playerId,
      first_name: player.playerName.split(' ')[0] ?? '',
      last_name: player.playerName.split(' ').slice(1).join(' '),
      position: player.archetype === 'TACKLE' ? 'LB' : 'DE',
      team: 'TST',
      status: 'Active',
    } satisfies SleeperPlayer,
  ]),
);

const projections: SleeperPlayerProjection[] = tierPlayers.map((player, index) => ({
  player_id: player.playerId,
  stats: { adp_idp_1qb: 10 + index * 5 },
}));

const openPicks: IdpPlanOpenPick[] = [
  { overallPick: 10, round: 1, pickInRound: 10 },
  { overallPick: 20, round: 2, pickInRound: 8 },
  { overallPick: 30, round: 3, pickInRound: 6 },
  { overallPick: 40, round: 4, pickInRound: 4 },
];

const samples: MockDraftSample[] = [
  {
    draftId: 'one',
    totalPicks: 40,
    picks: [
      { playerId: 'early-edge', pickNo: 12 },
      { playerId: 'middle-edge', pickNo: 22 },
      { playerId: 'late-edge', pickNo: 32 },
      { playerId: 'late-tackler', pickNo: 35 },
      { playerId: 'fallback-one', pickNo: 26 },
      { playerId: 'fallback-two', pickNo: 36 },
    ],
  },
  {
    draftId: 'two',
    totalPicks: 40,
    picks: [
      { playerId: 'early-edge', pickNo: 13 },
      { playerId: 'middle-edge', pickNo: 24 },
      { playerId: 'late-edge', pickNo: 34 },
      { playerId: 'late-tackler', pickNo: 37 },
      { playerId: 'fallback-one', pickNo: 28 },
      { playerId: 'fallback-two', pickNo: 38 },
    ],
  },
];

describe('buildIdpDraftPlan', () => {
  it('selects cheap big-play fits within each expert tier and identifies the availability cliff', () => {
    const mockAnalysis = analyzeMockDrafts(
      tierPlayers.map((player) => player.playerId),
      samples,
      openPicks.map((pick) => pick.overallPick),
    );

    const plan = buildIdpDraftPlan({
      source,
      sleeperPlayers,
      projections,
      mockAnalysis,
      openPicks,
      keeperPlayerIds: new Set(),
    });

    expect(plan.primaryTargets.map((player) => player.playerId)).toEqual([
      'late-edge',
      'middle-edge',
    ]);
    expect(plan.fallbackTargets.map((player) => player.playerId)).toEqual([
      'fallback-two',
      'fallback-one',
    ]);
    expect(plan.primaryTargets[0]).toMatchObject({
      targetPick: { overallPick: 30 },
      targetAvailability: { percentage: 100 },
      nextPick: { overallPick: 40 },
      nextAvailability: { percentage: 0 },
      action: 'target',
      isBigPlayFit: true,
    });
  });

  it('treats a player drafted in fewer than half of the mocks as a streaming fallback', () => {
    const streamingSource = { ...source, players: tierPlayers.slice(0, 1) };
    const streamingSamples: MockDraftSample[] = [
      { draftId: 'one', totalPicks: 40, picks: [{ playerId: 'early-edge', pickNo: 35 }] },
      { draftId: 'two', totalPicks: 40, picks: [] },
      { draftId: 'three', totalPicks: 40, picks: [] },
    ];
    const mockAnalysis = analyzeMockDrafts(
      ['early-edge'],
      streamingSamples,
      openPicks.map((pick) => pick.overallPick),
    );

    const plan = buildIdpDraftPlan({
      source: streamingSource,
      sleeperPlayers,
      projections,
      mockAnalysis,
      openPicks,
      keeperPlayerIds: new Set(),
    });

    expect(plan.primaryTargets).toEqual([]);
    expect(plan.candidates[0]).toMatchObject({
      action: 'stream',
      targetPick: { overallPick: 30 },
    });
  });

  it('falls back to Sleeper ADP timing and removes keeper-designated IDPs', () => {
    const plan = buildIdpDraftPlan({
      source,
      sleeperPlayers,
      projections,
      mockAnalysis: null,
      openPicks,
      keeperPlayerIds: new Set(['early-edge']),
    });

    expect(plan.candidates.some((player) => player.playerId === 'early-edge')).toBe(false);
    expect(plan.candidates.find((player) => player.playerId === 'middle-edge')).toMatchObject({
      sleeperAdp: 15,
      targetPick: { overallPick: 10 },
      action: 'target',
    });
  });
});
