import type { SleeperDraft, SleeperDraftPick } from '../api/sleeper';
import {
  identifySleeperMockDraftCandidates,
  formatSleeperMockDraftInput,
  loadSleeperMockDraftCandidates,
  parseSleeperMockDraftInput,
  type MockDraftCandidateCriteria,
} from './sleeperMockDrafts';

describe('Sleeper mock draft input', () => {
  it('accepts draft URLs and bare IDs while deduplicating in entry order', () => {
    const parsed = parseSleeperMockDraftInput(
      [
        'https://sleeper.com/draft/nfl/1400197747742654464',
        '1400197652271878144',
        'https://sleeper.com/draft/nfl/1400197747742654464',
      ].join('\n'),
    );

    expect(parsed).toEqual({
      draftIds: ['1400197747742654464', '1400197652271878144'],
      duplicateDraftIds: ['1400197747742654464'],
      invalidEntries: [],
    });
    expect(formatSleeperMockDraftInput(parsed.draftIds)).toBe(
      [
        'https://sleeper.com/draft/nfl/1400197747742654464',
        'https://sleeper.com/draft/nfl/1400197652271878144',
      ].join('\n'),
    );
  });

  it('reports entries that are neither Sleeper draft URLs nor IDs', () => {
    expect(parseSleeperMockDraftInput('not-a-draft')).toEqual({
      draftIds: [],
      duplicateDraftIds: [],
      invalidEntries: ['not-a-draft'],
    });
  });
});

const userId = 'user-1';
const criteria: MockDraftCandidateCriteria = {
  userId,
  leagueId: 'current-league',
  teamCount: 4,
  rounds: 3,
  draftSlot: 2,
  keepers: [{ playerId: 'keeper', overallPick: 5 }],
  createdAtOrAfter: 50,
};

const draft = (overrides: Partial<SleeperDraft> = {}): SleeperDraft => ({
  type: 'snake',
  status: 'complete',
  start_time: 1,
  sport: 'nfl',
  settings: { teams: 4, rounds: 3 },
  season_type: 'regular',
  season: '2026',
  metadata: {
    name: 'Post-Keeper Mock',
    type: 'league_mock',
    league_id: 'current-league',
  },
  league_id: '',
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
    is_keeper: index === 4,
    draft_id: draftId,
  }));

describe('identifySleeperMockDraftCandidates', () => {
  it('accepts an exact league-specific post-lock mock', () => {
    const candidates = identifySleeperMockDraftCandidates(
      [draft()],
      new Map([['mock-draft', picks()]]),
      criteria,
    );

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      draftId: 'mock-draft',
      leagueId: 'current-league',
      name: 'Post-Keeper Mock',
      compatible: true,
      compatibilityIssues: [],
      teamCount: 4,
      rounds: 3,
      draftSlot: 2,
    });
    expect(candidates[0]?.sample.picks).toHaveLength(12);
  });

  it('keeps incompatible candidates visible with strict source and board reasons', () => {
    const incompatibleDraft = draft({
      created: 49,
      creators: ['another-user'],
      metadata: { type: 'generic', league_id: 'another-league' },
      settings: { teams: 4, rounds: 2 },
      draft_order: { [userId]: 3 },
    });
    const incompatiblePicks = picks()
      .filter((pick) => pick.player_id !== 'keeper')
      .slice(0, 8);

    const [candidate] = identifySleeperMockDraftCandidates(
      [incompatibleDraft],
      new Map([['mock-draft', incompatiblePicks]]),
      criteria,
    );

    expect(candidate).toMatchObject({ compatible: false, rounds: 2, draftSlot: 3 });
    expect(candidate.compatibilityIssues).toEqual(
      expect.arrayContaining([
        'Expected league mock, found generic',
        'Expected league current-league, found another-league',
        'Draft was created before keeper lock',
        'Selected Sleeper user did not create this mock',
        'Expected 3 rounds, found 2',
        'Expected draft slot 2, found 3',
        'Expected 1 keeper slots, found 0',
        'Missing keeper keeper at pick 5',
      ]),
    );
  });

  it('rejects unexpected marked keepers even when required keepers are present', () => {
    const picksWithExtraKeeper = picks();
    picksWithExtraKeeper[6].is_keeper = true;

    const [candidate] = identifySleeperMockDraftCandidates(
      [draft()],
      new Map([['mock-draft', picksWithExtraKeeper]]),
      criteria,
    );

    expect(candidate.compatibilityIssues).toEqual(
      expect.arrayContaining([
        'Expected 1 keeper slots, found 2',
        'Unexpected keeper player-7 at pick 7',
      ]),
    );
  });
});

describe('loadSleeperMockDraftCandidates', () => {
  it('loads metadata and picks for only the exact configured draft IDs', async () => {
    const getDraft = jest.fn((draftId: string) =>
      Promise.resolve(draft({ draft_id: draftId, created: draftId === 'mock-a' ? 100 : 110 })),
    );
    const getDraftPicks = jest.fn((draftId: string) => Promise.resolve(picks(draftId)));

    const candidates = await loadSleeperMockDraftCandidates(
      { ...criteria, draftIds: ['mock-a', 'mock-b'] },
      { getDraft, getDraftPicks },
    );

    expect(getDraft).toHaveBeenCalledTimes(2);
    expect(getDraftPicks).toHaveBeenCalledTimes(2);
    expect(candidates.map((candidate) => candidate.draftId)).toEqual(['mock-b', 'mock-a']);
  });

  it('rejects duplicate configured draft IDs before fetching', async () => {
    const getDraft = jest.fn();
    const getDraftPicks = jest.fn();

    await expect(
      loadSleeperMockDraftCandidates(
        { ...criteria, draftIds: ['mock-a', 'mock-a'] },
        { getDraft, getDraftPicks },
      ),
    ).rejects.toThrow('Mock draft IDs must be unique');
    expect(getDraft).not.toHaveBeenCalled();
    expect(getDraftPicks).not.toHaveBeenCalled();
  });
});
