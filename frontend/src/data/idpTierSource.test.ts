import { IDP_TIER_SOURCE } from './idpTierSource';

describe('IDP_TIER_SOURCE', () => {
  it('contains unique Sleeper IDs for the published Tier 1 and Tier 2 target pool', () => {
    const { players, publishedOn, sourceUrl } = IDP_TIER_SOURCE;

    expect(players).toHaveLength(28);
    expect(players.map((player) => player.sourceRank)).toEqual(
      Array.from({ length: 28 }, (_, index) => index + 1),
    );
    expect(players.filter((player) => player.tier === 1)).toHaveLength(11);
    expect(players.filter((player) => player.tier === 2)).toHaveLength(17);
    expect(new Set(players.map((player) => player.playerId)).size).toBe(players.length);
    expect(players.filter((player) => player.archetype === 'EDGE').length).toBeGreaterThan(0);
    expect(publishedOn).toBe('2026-06-16');
    expect(sourceUrl).toContain('fantasypros.com');
  });
});
