import type { DraftHistorySeason } from '../data/draftHistoryTypes';
import type { KeeperAdjustedDraftSlot } from './keeperAdjustedAdp';
import { buildDraftTrackerSnapshot } from './draftTracker';

const season: DraftHistorySeason = {
  leagueId: 'league',
  season: '2026',
  leagueStatus: 'drafting',
  draftId: 'draft',
  draftStatus: 'drafting',
  draftType: 'snake',
  startTime: 1,
  rounds: 2,
  teamCount: 2,
  draftSlots: [
    { draftSlot: 1, rosterId: 1 },
    { draftSlot: 2, rosterId: 2 },
  ],
  teams: [],
  picks: [
    {
      playerId: 'keeper',
      playerName: 'Keeper',
      position: 'RB',
      nflTeam: 'TST',
      rosterId: 1,
      round: 1,
      draftSlot: 1,
      pickNo: 1,
      isKeeper: true,
    },
    {
      playerId: 'drafted',
      playerName: 'Drafted Player',
      position: 'WR',
      nflTeam: 'TST',
      rosterId: 2,
      round: 1,
      draftSlot: 2,
      pickNo: 2,
      isKeeper: false,
    },
  ],
};

const openSlots: KeeperAdjustedDraftSlot[] = [
  {
    overallPick: 2,
    round: 1,
    pickInRound: 2,
    draftSlot: 2,
    rosterId: 2,
    keeperPlayerId: null,
  },
  {
    overallPick: 3,
    round: 2,
    pickInRound: 1,
    draftSlot: 2,
    rosterId: 2,
    keeperPlayerId: null,
  },
  {
    overallPick: 4,
    round: 2,
    pickInRound: 2,
    draftSlot: 1,
    rosterId: 1,
    keeperPlayerId: null,
  },
];

describe('buildDraftTrackerSnapshot', () => {
  it('tracks only non-keeper selections and finds the next open pick', () => {
    const tracker = buildDraftTrackerSnapshot(season, openSlots);

    expect(tracker.draftedCount).toBe(1);
    expect(tracker.totalOpenPickCount).toBe(3);
    expect(tracker.remainingPickCount).toBe(2);
    expect(tracker.latestPick?.playerId).toBe('drafted');
    expect(tracker.draftedByPlayerId.get('drafted')?.pickNo).toBe(2);
    expect(tracker.draftedByPlayerId.has('keeper')).toBe(false);
    expect(tracker.nextPick?.overallPick).toBe(3);
  });
});
