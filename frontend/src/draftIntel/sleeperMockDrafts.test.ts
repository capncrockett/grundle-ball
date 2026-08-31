import type { SleeperDraft, SleeperDraftPick, SleeperLeague } from '../api/sleeper';
import {
  identifySleeperMockDraftCandidates,
  loadSleeperMockDraftCandidates,
  type MockDraftCandidateCriteria,
} from './sleeperMockDrafts';

const userId = 'user-1';
const criteria: MockDraftCandidateCriteria = {
  userId,
  teamCount: 4,
  rounds: 3,
  draftSlot: 2,
  keepers: [{ playerId: 'keeper', overallPick: 5 }],
  knownLeagueIds: ['current-league'],
};

const draft = (overrides: Partial<SleeperDraft> = {}): SleeperDraft => ({
  type: 'snake',
  status: 'complete',
  start_time: 1,
  sport: 'nfl',
  settings: { teams: 4, rounds: 3 },
  season_type: 'regular',
  season: '2026',
  metadata: { name: 'Post-Keeper Mock' },
  league_id: 'mock-league',
  draft_order: { [userId]: 2 },
  slot_to_roster_id: null,
  draft_id: 'mock-draft',
  creators: [userId],
  created: 100,
  ...overrides,
});

const picks = (draftId = 'mock-draft'): SleeperDraftPick[] =>
  Array.from({ length: 12 }, (_, index) => ({
    player_id: index === 4 ? 'keeper' : `player-${(index + 1).toString()}`,
    picked_by: userId,
    roster_id: 1,
    round: Math.floor(index / 4) + 1,
    draft_slot: (index % 4) + 1,
    pick_no: index + 1,
    draft_id: draftId,
  }));

describe('identifySleeperMockDraftCandidates', () => {
  it('excludes linked league drafts and accepts exact unlinked post-keeper mocks', () => {
    const candidates = identifySleeperMockDraftCandidates(
      [draft({ draft_id: 'real', league_id: 'current-league' }), draft()],
      ['current-league'],
      new Map([['mock-draft', picks()]]),
      criteria,
    );

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      draftId: 'mock-draft',
      name: 'Post-Keeper Mock',
      compatible: true,
      compatibilityIssues: [],
      teamCount: 4,
      rounds: 3,
      draftSlot: 2,
    });
    expect(candidates[0]?.sample.picks).toHaveLength(12);
  });

  it('keeps incompatible candidates visible with exact reasons', () => {
    const incompatibleDraft = draft({
      settings: { teams: 4, rounds: 2 },
      draft_order: { [userId]: 3 },
    });
    const incompatiblePicks = picks()
      .filter((pick) => pick.player_id !== 'keeper')
      .slice(0, 8);

    const [candidate] = identifySleeperMockDraftCandidates(
      [incompatibleDraft],
      [],
      new Map([['mock-draft', incompatiblePicks]]),
      criteria,
    );

    expect(candidate).toMatchObject({ compatible: false, rounds: 2, draftSlot: 3 });
    expect(candidate.compatibilityIssues).toEqual(
      expect.arrayContaining([
        'Expected 3 rounds, found 2',
        'Expected draft slot 2, found 3',
        'Missing keeper keeper at pick 5',
      ]),
    );
  });
});

describe('loadSleeperMockDraftCandidates', () => {
  it('fetches picks only for drafts not attached to a current user league', async () => {
    const realDraft = draft({ draft_id: 'real', league_id: 'real-league' });
    const mockDraft = draft();
    const league = { league_id: 'real-league' } as SleeperLeague;
    const getDraftPicks = jest.fn((draftId: string) => Promise.resolve(picks(draftId)));

    const candidates = await loadSleeperMockDraftCandidates(
      { ...criteria, season: '2026' },
      {
        getUserDrafts: jest.fn(() => Promise.resolve([realDraft, mockDraft])),
        getUserLeagues: jest.fn(() => Promise.resolve([league])),
        getDraftPicks,
      },
    );

    expect(getDraftPicks).toHaveBeenCalledTimes(1);
    expect(getDraftPicks).toHaveBeenCalledWith('mock-draft');
    expect(candidates.map((candidate) => candidate.draftId)).toEqual(['mock-draft']);
  });
});
