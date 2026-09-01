import { analyzeMockDrafts, type MockDraftSample } from './mockDraftAnalyzer';

const samples: MockDraftSample[] = [
  {
    draftId: 'mock-1',
    totalPicks: 20,
    picks: [
      { playerId: 'a', pickNo: 4 },
      { playerId: 'b', pickNo: 8 },
    ],
  },
  { draftId: 'mock-2', totalPicks: 20, picks: [{ playerId: 'a', pickNo: 6 }] },
  { draftId: 'mock-3', totalPicks: 20, picks: [{ playerId: 'a', pickNo: 10 }] },
];

describe('analyzeMockDrafts', () => {
  it('calculates descriptive pick statistics without blending structural ADP', () => {
    const result = analyzeMockDrafts(['a', 'b', 'undrafted'], samples, [5, 8, 12, 25]);
    const byId = new Map(result.players.map((player) => [player.playerId, player]));

    expect(result.selectedMockCount).toBe(3);
    expect(byId.get('a')).toMatchObject({
      mockCount: 3,
      meanPick: 6.6666666667,
      medianPick: 6,
      earliestPick: 4,
      latestPick: 10,
    });
    expect(byId.get('b')).toMatchObject({
      mockCount: 1,
      meanPick: 8,
      medianPick: 8,
      earliestPick: 8,
      latestPick: 8,
    });
    expect(byId.get('undrafted')).toMatchObject({
      mockCount: 0,
      meanPick: null,
      medianPick: null,
      earliestPick: null,
      latestPick: null,
    });
  });

  it('counts availability inclusively at the target pick and treats undrafted players as available', () => {
    const result = analyzeMockDrafts(['a', 'b', 'undrafted'], samples, [5, 8, 12, 25]);
    const byId = new Map(result.players.map((player) => [player.playerId, player]));

    expect(byId.get('a')?.availability).toEqual([
      { overallPick: 5, availableCount: 2, sampleCount: 3, percentage: 66.6666666667 },
      { overallPick: 8, availableCount: 1, sampleCount: 3, percentage: 33.3333333333 },
      { overallPick: 12, availableCount: 0, sampleCount: 3, percentage: 0 },
      { overallPick: 25, availableCount: 0, sampleCount: 0, percentage: null },
    ]);
    expect(byId.get('b')?.availability[1]).toEqual({
      overallPick: 8,
      availableCount: 3,
      sampleCount: 3,
      percentage: 100,
    });
    expect(byId.get('undrafted')?.availability[2]).toEqual({
      overallPick: 12,
      availableCount: 3,
      sampleCount: 3,
      percentage: 100,
    });
  });

  it('uses a deterministic even-sample median', () => {
    const result = analyzeMockDrafts(
      ['a'],
      [
        { draftId: 'one', totalPicks: 10, picks: [{ playerId: 'a', pickNo: 2 }] },
        { draftId: 'two', totalPicks: 10, picks: [{ playerId: 'a', pickNo: 8 }] },
      ],
      [],
    );

    expect(result.players[0]).toMatchObject({ meanPick: 5, medianPick: 5 });
  });

  it('rejects duplicate players or pick numbers inside a mock', () => {
    expect(() =>
      analyzeMockDrafts(
        ['a'],
        [
          {
            draftId: 'bad',
            totalPicks: 10,
            picks: [
              { playerId: 'a', pickNo: 1 },
              { playerId: 'a', pickNo: 2 },
            ],
          },
        ],
        [],
      ),
    ).toThrow('Mock bad contains player a more than once');
  });
});
