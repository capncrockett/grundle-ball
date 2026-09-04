import { POST_KEEPER_MOCK_DRAFT_SOURCE } from './postKeeperMockDraftSource';

describe('POST_KEEPER_MOCK_DRAFT_SOURCE', () => {
  it('defines one unique 10-draft batch after keeper lock', () => {
    const { batchCompletedAt, draftIds, keeperLockedAt } = POST_KEEPER_MOCK_DRAFT_SOURCE;

    expect(draftIds).toHaveLength(10);
    expect(new Set(draftIds).size).toBe(10);
    expect(draftIds).toEqual(expect.arrayContaining(['1400197747742654464']));
    expect(draftIds.every((draftId) => /^\d+$/.test(draftId))).toBe(true);
    expect(Date.parse(batchCompletedAt)).toBeGreaterThan(Date.parse(keeperLockedAt));
  });
});
