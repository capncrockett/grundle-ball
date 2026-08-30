import type {
  SleeperDraft,
  SleeperDraftPick,
  SleeperLeague,
  SleeperRoster,
  SleeperUser,
} from '../api/sleeper';
import {
  buildDraftHistorySeason,
  buildKeeperLedger,
  getDraftPickNumber,
  mergeLiveDraftSeason,
} from './draftHistoryTransforms';
import type { DraftHistorySnapshot } from './draftHistoryTypes';

const league: SleeperLeague = {
  total_rosters: 2,
  status: 'pre_draft',
  sport: 'nfl',
  settings: {},
  season_type: 'regular',
  season: '2026',
  scoring_settings: {},
  roster_positions: [],
  previous_league_id: 'league-2025',
  name: 'Test League',
  league_id: 'league-2026',
  draft_id: 'draft-2026',
};

const draft: SleeperDraft = {
  type: 'snake',
  status: 'pre_draft',
  start_time: 1_788_739_254_000,
  sport: 'nfl',
  settings: { teams: 2, rounds: 2 },
  season_type: 'regular',
  season: '2026',
  league_id: league.league_id,
  draft_order: { 'user-a': 2, 'user-b': 1 },
  slot_to_roster_id: { '1': 2, '2': 1 },
  draft_id: league.draft_id,
  created: 1_700_000_000_000,
};

const users: SleeperUser[] = [
  {
    user_id: 'user-a',
    username: 'alpha',
    display_name: 'Alpha Manager',
    metadata: { team_name: 'Alpha Team' },
  },
  {
    user_id: 'user-b',
    username: 'beta',
    display_name: 'Beta Manager',
    metadata: { team_name: 'Beta Team' },
  },
];

const rosters: SleeperRoster[] = [
  {
    starters: [],
    settings: {},
    roster_id: 1,
    reserve: [],
    players: [],
    owner_id: 'user-a',
    league_id: league.league_id,
  },
  {
    starters: [],
    settings: {},
    roster_id: 2,
    reserve: [],
    players: [],
    owner_id: 'user-b',
    league_id: league.league_id,
  },
];

const picks: SleeperDraftPick[] = [
  {
    player_id: 'player-1',
    roster_id: '1',
    round: 1,
    draft_slot: 2,
    pick_no: 2,
    metadata: { first_name: 'Alpha', last_name: 'Player', position: 'WR', team: 'SEA' },
    is_keeper: true,
    draft_id: draft.draft_id,
  },
];

describe('draft history transforms', () => {
  it('normalizes canonical draft slots, Teams, picks, and keeper flags', () => {
    const season = buildDraftHistorySeason(league, draft, picks, users, rosters);

    expect(season.draftSlots).toEqual([
      { draftSlot: 1, rosterId: 2 },
      { draftSlot: 2, rosterId: 1 },
    ]);
    expect(season.teams[0]).toMatchObject({
      rosterId: 1,
      teamName: 'Alpha Team',
      managerName: 'Alpha Manager',
    });
    expect(season.picks[0]).toEqual({
      playerId: 'player-1',
      playerName: 'Alpha Player',
      position: 'WR',
      nflTeam: 'SEA',
      rosterId: 1,
      round: 1,
      draftSlot: 2,
      pickNo: 2,
      isKeeper: true,
    });
  });

  it('calculates snake draft pick numbers in both directions', () => {
    expect(getDraftPickNumber(1, 1, 12)).toBe(1);
    expect(getDraftPickNumber(1, 12, 12)).toBe(12);
    expect(getDraftPickNumber(2, 12, 12)).toBe(13);
    expect(getDraftPickNumber(2, 1, 12)).toBe(24);
  });

  it('groups keeper seasons by persistent Team and player', () => {
    const current = buildDraftHistorySeason(league, draft, picks, users, rosters);
    const prior = {
      ...current,
      leagueId: 'league-2025',
      season: '2025',
      leagueStatus: 'complete' as const,
      draftId: 'draft-2025',
      draftStatus: 'complete' as const,
    };
    const otherTeam = {
      ...prior,
      season: '2024',
      leagueId: 'league-2024',
      draftId: 'draft-2024',
      picks: prior.picks.map((pick) => ({ ...pick, rosterId: 2 })),
    };

    const ledger = buildKeeperLedger([current, prior, otherTeam]);

    expect(ledger).toHaveLength(2);
    expect(ledger.find((entry) => entry.rosterId === 1)?.designations).toHaveLength(2);
    expect(ledger.find((entry) => entry.rosterId === 2)?.designations).toHaveLength(1);
  });

  it('replaces the stored current season with its live version', () => {
    const season = buildDraftHistorySeason(league, draft, picks, users, rosters);
    const snapshot: DraftHistorySnapshot = {
      generatedAt: '2026-01-01T00:00:00.000Z',
      currentLeagueId: league.league_id,
      seasons: [{ ...season, picks: [] }],
    };

    const merged = mergeLiveDraftSeason(snapshot, season);

    expect(merged.seasons).toHaveLength(1);
    expect(merged.seasons[0]?.picks).toHaveLength(1);
  });
});
