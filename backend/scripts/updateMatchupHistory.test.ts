import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  SleeperLeague,
  SleeperMatchup,
  SleeperRoster,
  SleeperUser,
} from '../../frontend/src/api/sleeper.ts';
import type { MatchupHistoryScope } from '../../frontend/src/data/matchupHistoryTypes.ts';
import type { MatchupHistoryStore } from '../matchupHistoryStore.ts';
import {
  parseArgs,
  updateMatchupHistory,
  type UpdateDependencies,
} from './updateMatchupHistory.ts';

const alternateLeagueId = 'alternate-league';
const alternateSeason = '2030';

const league: SleeperLeague = {
  total_rosters: 2,
  status: 'in_season',
  sport: 'nfl',
  settings: {},
  season_type: 'regular',
  season: alternateSeason,
  scoring_settings: {},
  roster_positions: [],
  name: 'Alternate League',
  league_id: alternateLeagueId,
  draft_id: 'draft-id',
};

const users: SleeperUser[] = [
  {
    user_id: 'user-a',
    username: 'alpha',
    display_name: 'Alpha Manager',
    metadata: { team_name: 'Alpha' },
  },
  {
    user_id: 'user-b',
    username: 'beta',
    display_name: 'Beta Manager',
    metadata: { team_name: 'Beta' },
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
    league_id: alternateLeagueId,
  },
  {
    starters: [],
    settings: {},
    roster_id: 2,
    reserve: [],
    players: [],
    owner_id: 'user-b',
    league_id: alternateLeagueId,
  },
];

const matchups: SleeperMatchup[] = [
  {
    starters: [],
    roster_id: 1,
    players: [],
    matchup_id: 1,
    points: 110.126,
  },
  {
    starters: [],
    roster_id: 2,
    players: [],
    matchup_id: 1,
    points: 99.994,
  },
];

type AppendCall = {
  scope: MatchupHistoryScope;
  week: number;
  entries: Parameters<MatchupHistoryStore['appendWeek']>[2];
};

const createHarness = (overrides: Partial<UpdateDependencies> = {}) => {
  const appendCalls: AppendCall[] = [];
  const store: MatchupHistoryStore = {
    kind: 'json',
    describe: () => 'test store',
    read: () => Promise.resolve([]),
    write: (entries) => Promise.resolve(entries),
    appendWeek: (scope, week, entries) => {
      appendCalls.push({ scope, week, entries });
      return Promise.resolve(entries);
    },
  };
  const dependencies: Partial<UpdateDependencies> = {
    getLeague: () => Promise.resolve(league),
    getLeagueUsers: () => Promise.resolve(users),
    getLeagueRosters: () => Promise.resolve(rosters),
    getLeagueMatchupsForWeek: () => Promise.resolve(matchups),
    getMatchupStore: () => Promise.resolve(store),
    logger: { log: () => undefined, warn: () => undefined },
    ...overrides,
  };

  return { appendCalls, dependencies };
};

test('parseArgs combines supported week selectors and preserves an alternate league', () => {
  const parsed = parseArgs(
    ['--week=4', '--weeks=2,4', '--range=1-2', `--league=${alternateLeagueId}`, '--unfinished'],
    'default-league',
  );

  assert.deepEqual(parsed, {
    weeks: [1, 2, 4],
    leagueId: alternateLeagueId,
    markFinished: false,
  });
});

test('parseArgs rejects malformed or unknown arguments', () => {
  assert.throws(() => parseArgs([], 'default-league'), /Pass target weeks/);
  assert.throws(() => parseArgs(['--week=1.5'], 'default-league'), /positive integer/);
  assert.throws(() => parseArgs(['--range=3-1'], 'default-league'), /end must be/);
  assert.throws(() => parseArgs(['--week=1', '--league='], 'default-league'), /non-empty/);
  assert.throws(() => parseArgs(['--week=1', '--finished=maybe'], 'default-league'), /Unknown/);
});

test('an alternate league is stamped with the season resolved from that league', async () => {
  const { appendCalls, dependencies } = createHarness();

  const result = await updateMatchupHistory(
    { weeks: [7], leagueId: alternateLeagueId, markFinished: true },
    { dependencies },
  );

  assert.deepEqual(result, {
    scope: { leagueId: alternateLeagueId, season: alternateSeason },
    touchedWeeks: [7],
    totalWritten: 2,
  });
  assert.equal(appendCalls.length, 1);
  assert.deepEqual(appendCalls[0]?.scope, {
    leagueId: alternateLeagueId,
    season: alternateSeason,
  });
  assert.equal(appendCalls[0]?.week, 7);
  assert.equal(appendCalls[0]?.entries[0]?.leagueId, alternateLeagueId);
  assert.equal(appendCalls[0]?.entries[0]?.season, alternateSeason);
  assert.equal(appendCalls[0]?.entries[0]?.margin, 10.14);
});

test('a mismatched or seasonless league response is rejected before writes', async () => {
  const mismatched = createHarness({
    getLeague: () => Promise.resolve({ ...league, league_id: 'wrong-league' }),
  });
  await assert.rejects(
    updateMatchupHistory(
      { weeks: [1], leagueId: alternateLeagueId, markFinished: true },
      { dependencies: mismatched.dependencies },
    ),
    /returned league wrong-league/,
  );
  assert.equal(mismatched.appendCalls.length, 0);

  const seasonless = createHarness({
    getLeague: () => Promise.resolve({ ...league, season: '' }),
  });
  await assert.rejects(
    updateMatchupHistory(
      { weeks: [1], leagueId: alternateLeagueId, markFinished: true },
      { dependencies: seasonless.dependencies },
    ),
    /missing a valid season/,
  );
  assert.equal(seasonless.appendCalls.length, 0);
});

test('malformed matchup payloads are rejected before writes', async () => {
  const malformed = createHarness({
    getLeagueMatchupsForWeek: () =>
      Promise.resolve([{ ...matchups[0], points: Number.NaN }, matchups[1]]),
  });

  await assert.rejects(
    updateMatchupHistory(
      { weeks: [1], leagueId: alternateLeagueId, markFinished: true },
      { dependencies: malformed.dependencies },
    ),
    /invalid matchup at index 0/,
  );
  assert.equal(malformed.appendCalls.length, 0);
});
