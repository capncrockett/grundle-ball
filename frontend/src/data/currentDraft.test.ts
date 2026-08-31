import type {
  SleeperDraft,
  SleeperDraftPick,
  SleeperLeague,
  SleeperRoster,
  SleeperUser,
} from '../api/sleeper';
import { loadCurrentDraftSeason } from './currentDraft';

const league: SleeperLeague = {
  total_rosters: 1,
  status: 'pre_draft',
  sport: 'nfl',
  settings: {},
  season_type: 'regular',
  season: '2026',
  scoring_settings: {},
  roster_positions: [],
  name: 'Test League',
  league_id: 'league-2026',
  draft_id: 'draft-2026',
};

const draft: SleeperDraft = {
  type: 'snake',
  status: 'pre_draft',
  start_time: null,
  sport: 'nfl',
  settings: { teams: 1, rounds: 2 },
  season_type: 'regular',
  season: '2026',
  league_id: league.league_id,
  draft_order: { owner: 1 },
  slot_to_roster_id: { '1': 1 },
  draft_id: league.draft_id,
  created: 1,
};

const picks: SleeperDraftPick[] = [
  {
    player_id: 'player-1',
    roster_id: 1,
    round: 1,
    draft_slot: 1,
    pick_no: 1,
    is_keeper: true,
    draft_id: draft.draft_id,
    metadata: { first_name: 'Test', last_name: 'Player', position: 'RB', team: 'TST' },
  },
];

const users: SleeperUser[] = [
  { user_id: 'owner', username: 'owner', display_name: 'Owner', metadata: { team_name: 'Team' } },
];

const rosters: SleeperRoster[] = [
  {
    starters: [],
    settings: {},
    roster_id: 1,
    reserve: [],
    players: [],
    owner_id: 'owner',
    league_id: league.league_id,
  },
];

describe('loadCurrentDraftSeason', () => {
  it('loads the canonical draft and normalizes its keeper picks', async () => {
    const getLeague = jest.fn(() => Promise.resolve(league));
    const getDraft = jest.fn(() => Promise.resolve(draft));
    const getDraftPicks = jest.fn(() => Promise.resolve(picks));
    const getLeagueUsers = jest.fn(() => Promise.resolve(users));
    const getLeagueRosters = jest.fn(() => Promise.resolve(rosters));

    const season = await loadCurrentDraftSeason(league.league_id, {
      getLeague,
      getDraft,
      getDraftPicks,
      getLeagueUsers,
      getLeagueRosters,
    });

    expect(getDraft).toHaveBeenCalledWith(league.draft_id);
    expect(getDraftPicks).toHaveBeenCalledWith(league.draft_id);
    expect(season).toMatchObject({
      leagueId: league.league_id,
      draftId: draft.draft_id,
      draftType: 'snake',
      teamCount: 1,
      rounds: 2,
    });
    expect(season.picks[0]).toMatchObject({
      playerId: 'player-1',
      pickNo: 1,
      isKeeper: true,
    });
  });
});
