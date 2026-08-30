import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  SleeperDraft,
  SleeperDraftPick,
  SleeperLeague,
  SleeperRoster,
  SleeperUser,
} from '../../frontend/src/api/sleeper.ts';
import {
  buildDraftHistorySnapshot,
  parseDraftHistoryArgs,
  type DraftHistoryDependencies,
} from './updateDraftHistory.ts';

const leagueFor = (season: string, leagueId: string, previousLeagueId?: string): SleeperLeague => ({
  total_rosters: 1,
  status: season === '2026' ? 'pre_draft' : 'complete',
  sport: 'nfl',
  settings: {},
  season_type: 'regular',
  season,
  scoring_settings: {},
  roster_positions: [],
  previous_league_id: previousLeagueId,
  name: 'Test League',
  league_id: leagueId,
  draft_id: `draft-${season}`,
});

const draftFor = (league: SleeperLeague): SleeperDraft => ({
  type: 'snake',
  status: league.status === 'complete' ? 'complete' : 'pre_draft',
  start_time: 1_700_000_000_000,
  sport: 'nfl',
  settings: { teams: 1, rounds: 1 },
  season_type: 'regular',
  season: league.season,
  league_id: league.league_id,
  draft_order: { owner: 1 },
  slot_to_roster_id: { '1': 1 },
  draft_id: league.draft_id,
  created: 1_600_000_000_000,
});

const pickFor = (draft: SleeperDraft): SleeperDraftPick => ({
  player_id: `player-${draft.season}`,
  roster_id: 1,
  round: 1,
  draft_slot: 1,
  pick_no: 1,
  metadata: { first_name: 'Test', last_name: draft.season },
  is_keeper: true,
  draft_id: draft.draft_id,
});

const users: SleeperUser[] = [
  { user_id: 'owner', username: 'owner', display_name: 'Owner', metadata: { team_name: 'Team' } },
];
const rosterFor = (leagueId: string): SleeperRoster[] => [
  {
    starters: [],
    settings: {},
    roster_id: 1,
    reserve: [],
    players: [],
    owner_id: 'owner',
    league_id: leagueId,
  },
];

test('parseDraftHistoryArgs accepts an alternate current league and rejects unknown flags', () => {
  assert.deepEqual(parseDraftHistoryArgs(['--league=alternate'], 'default'), {
    leagueId: 'alternate',
  });
  assert.throws(() => parseDraftHistoryArgs(['--league='], 'default'), /non-empty/);
  assert.throws(() => parseDraftHistoryArgs(['--season=2026'], 'default'), /Unknown argument/);
});

test('buildDraftHistorySnapshot follows the previous-league chain and canonical drafts', async () => {
  const leagues = new Map([
    ['league-2026', leagueFor('2026', 'league-2026', 'league-2025')],
    ['league-2025', leagueFor('2025', 'league-2025')],
  ]);
  const draftRequests: string[] = [];
  const dependencies: Partial<DraftHistoryDependencies> = {
    getLeague: (leagueId) => Promise.resolve(leagues.get(leagueId) as SleeperLeague),
    getDraft: (draftId) => {
      draftRequests.push(draftId);
      const season = draftId.replace('draft-', '');
      return Promise.resolve(draftFor(leagues.get(`league-${season}`) as SleeperLeague));
    },
    getDraftPicks: (draftId) => {
      const season = draftId.replace('draft-', '');
      return Promise.resolve([pickFor(draftFor(leagues.get(`league-${season}`) as SleeperLeague))]);
    },
    getLeagueUsers: () => Promise.resolve(users),
    getLeagueRosters: (leagueId) => Promise.resolve(rosterFor(leagueId)),
    now: () => new Date('2026-08-29T12:00:00.000Z'),
    logger: { log: () => undefined },
  };

  const snapshot = await buildDraftHistorySnapshot('league-2026', dependencies);

  assert.equal(snapshot.generatedAt, '2026-08-29T12:00:00.000Z');
  assert.deepEqual(
    snapshot.seasons.map((season) => season.season),
    ['2026', '2025'],
  );
  assert.deepEqual(draftRequests, ['draft-2026', 'draft-2025']);
});

test('buildDraftHistorySnapshot rejects a cycle in the league chain', async () => {
  const loopingLeague = leagueFor('2026', 'league-2026', 'league-2026');
  const draft = draftFor(loopingLeague);
  const dependencies: Partial<DraftHistoryDependencies> = {
    getLeague: () => Promise.resolve(loopingLeague),
    getDraft: () => Promise.resolve(draft),
    getDraftPicks: () => Promise.resolve([pickFor(draft)]),
    getLeagueUsers: () => Promise.resolve(users),
    getLeagueRosters: () => Promise.resolve(rosterFor(loopingLeague.league_id)),
    logger: { log: () => undefined },
  };

  await assert.rejects(buildDraftHistorySnapshot(loopingLeague.league_id, dependencies), /cycle/);
});
