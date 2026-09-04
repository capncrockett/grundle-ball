import {
  syntheticKeeperAdpDraftConfig,
  syntheticKeeperAdpKeepers,
  syntheticKeeperAdpPlayers,
} from './fixtures/keeperAdjustedAdpFixture';
import {
  buildKeeperAdjustedDraftBoard,
  calculateKeeperAdjustedAdp,
  getOpenDraftPicksForRoster,
  mapAvailablePoolRankToOpenPick,
  type BaselineAdpPlayer,
  type KeeperAdjustedDraftConfig,
} from './keeperAdjustedAdp';

const baselinePlayer = (
  playerId: string,
  baselineAdp: number,
  sourceRank: number,
): BaselineAdpPlayer => ({
  playerId,
  playerName: playerId,
  position: 'WR',
  nflTeam: 'TST',
  baselineAdp,
  sourceRank,
});

const configFor = (teamCount: number, rounds: number): KeeperAdjustedDraftConfig => ({
  teamCount,
  rounds,
  draftType: 'snake',
  draftSlots: Array.from({ length: teamCount }, (_, index) => ({
    draftSlot: index + 1,
    rosterId: index + 1,
  })),
});

describe('calculateKeeperAdjustedAdp', () => {
  it('leaves integer and decimal ADP unchanged when there are no keepers', () => {
    const players = [baselinePlayer('one', 1, 1), baselinePlayer('decimal', 7.25, 2)];

    const result = calculateKeeperAdjustedAdp(players, [], configFor(4, 4));

    expect(result.players).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ playerId: 'one', keeperAdjustedAdp: 1, adpDelta: 0 }),
        expect.objectContaining({
          playerId: 'decimal',
          keeperAdjustedAdp: 7.25,
          adpDelta: 0,
        }),
      ]),
    );
  });

  it('compresses players before a highly ranked keeper assigned to a late pick', () => {
    const players = [
      baselinePlayer('keeper', 1, 1),
      baselinePlayer('before-slot', 8, 2),
      baselinePlayer('after-slot', 15, 3),
    ];

    const result = calculateKeeperAdjustedAdp(
      players,
      [{ playerId: 'keeper', overallPick: 14 }],
      configFor(4, 4),
    );

    expect(result.players.find((row) => row.playerId === 'before-slot')).toMatchObject({
      availablePoolRank: 7,
      keeperAdjustedAdp: 7,
      adpDelta: -1,
    });
  });

  it('repays an individual keeper effect after its occupied slot', () => {
    const players = [baselinePlayer('keeper', 1, 1), baselinePlayer('after-slot', 15, 2)];

    const result = calculateKeeperAdjustedAdp(
      players,
      [{ playerId: 'keeper', overallPick: 14 }],
      configFor(4, 4),
    );

    expect(result.players[0]).toMatchObject({
      availablePoolRank: 14,
      keeperAdjustedAdp: 15,
      adpDelta: 0,
    });
  });

  it('compounds multiple keeper effects in the manually verifiable fixture', () => {
    const result = calculateKeeperAdjustedAdp(
      syntheticKeeperAdpPlayers,
      syntheticKeeperAdpKeepers,
      syntheticKeeperAdpDraftConfig,
    );
    const byId = new Map(result.players.map((row) => [row.playerId, row]));

    expect(result.openSlots.map((slot) => slot.overallPick)).toEqual([
      1, 2, 3, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15, 16,
    ]);
    expect(byId.get('available-4')).toMatchObject({
      availablePoolRank: 2,
      keeperAdjustedAdp: 2,
      adpDelta: -2,
      higherRankedKeepersRemoved: 2,
    });
    expect(byId.get('available-6')).toMatchObject({
      availablePoolRank: 4,
      keeperAdjustedAdp: 5,
      adpDelta: -1,
    });
    expect(byId.get('available-6-5')).toMatchObject({
      availablePoolRank: 4.5,
      keeperAdjustedAdp: 5.5,
      adpDelta: -1,
    });
    expect(byId.get('available-11')).toMatchObject({
      availablePoolRank: 9,
      keeperAdjustedAdp: 11,
      adpDelta: 0,
    });
  });

  it('treats the same valuable keeper differently in Round 3 and Round 10', () => {
    const players = [baselinePlayer('keeper', 1, 1), baselinePlayer('target', 80, 2)];
    const config = configFor(12, 12);

    const roundThree = calculateKeeperAdjustedAdp(
      players,
      [{ playerId: 'keeper', overallPick: 25 }],
      config,
    );
    const roundTen = calculateKeeperAdjustedAdp(
      players,
      [{ playerId: 'keeper', overallPick: 109 }],
      config,
    );

    expect(roundThree.players[0]?.adpDelta).toBe(0);
    expect(roundTen.players[0]?.adpDelta).toBe(-1);
  });

  it('excludes keeper players from available-player results', () => {
    const result = calculateKeeperAdjustedAdp(
      syntheticKeeperAdpPlayers,
      syntheticKeeperAdpKeepers,
      syntheticKeeperAdpDraftConfig,
    );

    expect(result.players.map((row) => row.playerId)).not.toEqual(
      expect.arrayContaining(['keeper-early', 'keeper-late']),
    );
  });

  it('uses source order as a deterministic tie-breaker for equal ADP', () => {
    const players = [baselinePlayer('keeper', 5, 1), baselinePlayer('same-adp', 5, 2)];

    const result = calculateKeeperAdjustedAdp(
      players,
      [{ playerId: 'keeper', overallPick: 12 }],
      configFor(4, 4),
    );

    expect(result.players[0]).toMatchObject({
      availablePoolRank: 4,
      higherRankedKeepersRemoved: 1,
      keeperAdjustedAdp: 4,
    });
  });

  it('returns null when an available player falls beyond the final open slot', () => {
    const players = [baselinePlayer('keeper', 1, 1), baselinePlayer('late', 20, 2)];

    const result = calculateKeeperAdjustedAdp(
      players,
      [{ playerId: 'keeper', overallPick: 4 }],
      configFor(4, 2),
    );

    expect(result.players[0]).toMatchObject({ keeperAdjustedAdp: null, adpDelta: null });
  });

  it('rejects a keeper missing from the baseline source', () => {
    expect(() =>
      calculateKeeperAdjustedAdp(
        [baselinePlayer('available', 2, 1)],
        [{ playerId: 'missing', overallPick: 8 }],
        configFor(4, 4),
      ),
    ).toThrow('Keeper missing is missing from the baseline ADP source');
  });
});

describe('draft board helpers', () => {
  it('numbers odd and even snake rounds and excludes a roster keeper pick', () => {
    const board = buildKeeperAdjustedDraftBoard(syntheticKeeperAdpDraftConfig, [
      { playerId: 'keeper', overallPick: 10 },
    ]);

    expect(board.find((slot) => slot.round === 1 && slot.draftSlot === 2)?.overallPick).toBe(2);
    expect(board.find((slot) => slot.round === 2 && slot.draftSlot === 2)?.overallPick).toBe(7);
    expect(board.find((slot) => slot.round === 3 && slot.draftSlot === 2)?.overallPick).toBe(10);
    expect(board.find((slot) => slot.round === 4 && slot.draftSlot === 2)?.overallPick).toBe(15);
    expect(getOpenDraftPicksForRoster(board, 2).map((slot) => slot.overallPick)).toEqual([
      2, 7, 15,
    ]);
  });

  it('interpolates across a keeper-created gap', () => {
    expect(mapAvailablePoolRankToOpenPick(3.5, [1, 2, 3, 5, 6])).toBe(4);
  });

  it('rejects non-snake draft configuration', () => {
    expect(() =>
      buildKeeperAdjustedDraftBoard(
        { ...syntheticKeeperAdpDraftConfig, draftType: 'linear' },
        syntheticKeeperAdpKeepers,
      ),
    ).toThrow('Keeper-Adjusted ADP currently supports snake drafts only');
  });
});
