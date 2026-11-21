import assert from 'node:assert/strict';
import test from 'node:test';
import {
  fetchEspnLeague,
  findUnreviewedPersonalNames,
  readCredentials,
  toSisterLeagueSnapshot,
  type RawEspnLeague,
} from './updateSisterLeague.ts';

const credentials = { espnS2: 'test-s2', swid: '{TEST-SWID}' };

// Includes ESPN member and owner fields that the snapshot must drop.
const raw = {
  id: 42,
  seasonId: 2030,
  settings: {
    name: ' Test League ',
    scheduleSettings: { matchupPeriodCount: 14, playoffTeamCount: 6 },
  },
  status: { currentMatchupPeriod: 9 },
  members: [{ id: '{OWNER}', firstName: 'Private', lastName: 'Person', displayName: 'handle' }],
  teams: [
    {
      id: 2,
      name: 'Second ',
      playoffSeed: 2,
      owners: ['{OWNER}'],
      primaryOwner: '{OWNER}',
      record: { overall: { wins: 5, losses: 3, ties: 0, pointsFor: 900.12345 } },
    },
    {
      id: 1,
      name: 'First',
      playoffSeed: 1,
      owners: ['{OTHER}'],
      record: { overall: { wins: 6, losses: 1, ties: 1, pointsFor: 1000.1 } },
    },
  ],
} as unknown as RawEspnLeague;

test('snapshot keeps team names, records, and points and drops member identities', () => {
  const snapshot = toSisterLeagueSnapshot(raw, '2030-11-01T00:00:00.000Z');

  assert.deepEqual(snapshot, {
    leagueId: '42',
    seasonId: 2030,
    leagueName: 'Test League',
    fetchedAt: '2030-11-01T00:00:00.000Z',
    currentMatchupPeriod: 9,
    regularSeasonWeeks: 14,
    playoffTeamCount: 6,
    teams: [
      { id: 1, name: 'First', wins: 6, losses: 1, ties: 1, pointsFor: 1000.1, seed: 1 },
      { id: 2, name: 'Second', wins: 5, losses: 3, ties: 0, pointsFor: 900.12, seed: 2 },
    ],
  });
  assert.doesNotMatch(JSON.stringify(snapshot), /OWNER|Private|Person|handle/);
});

test('snapshot applies the display name and team-name overrides by team id', () => {
  const snapshot = toSisterLeagueSnapshot(raw, '2030-11-01T00:00:00.000Z', {
    displayName: 'Public League',
    teamNameOverrides: { 2: 'S Team' },
  });

  assert.equal(snapshot.leagueName, 'Public League');
  assert.deepEqual(
    snapshot.teams.map((team) => team.name),
    ['First', 'S Team'],
  );
});

test('flags possessive first-name team names that have no override', () => {
  const named = {
    ...raw,
    teams: [
      { ...raw.teams[0], id: 5, name: "Sam's Squad" },
      { ...raw.teams[0], id: 6, name: "Chris' Crew" },
      { ...raw.teams[0], id: 7, name: 'King Tet' },
      { ...raw.teams[0], id: 8, name: "Pat's Picks" },
    ],
  } as RawEspnLeague;

  assert.deepEqual(findUnreviewedPersonalNames(named, { 8: 'P Picks' }), [5, 6]);
});

test('credentials require both cookies and a braced SWID', () => {
  assert.deepEqual(readCredentials({ ESPN_S2: ' s2 ', ESPN_SWID: '{ID}' }), {
    espnS2: 's2',
    swid: '{ID}',
  });
  assert.throws(() => readCredentials({ ESPN_S2: 's2' }), /ESPN_S2 and ESPN_SWID/);
  assert.throws(() => readCredentials({ ESPN_S2: 's2', ESPN_SWID: 'ID' }), /curly braces/);
});

test('fetch sends the cookies and requests only settings and team views', async () => {
  let requested: { url: string; cookie: string | undefined } | undefined;
  const result = await fetchEspnLeague(
    credentials,
    { leagueId: '42', seasonId: 2030 },
    (url, init) => {
      requested = { url, cookie: init.headers.Cookie };
      return Promise.resolve(Response.json(raw));
    },
  );

  assert.equal(result.id, 42);
  assert.equal(
    requested?.url,
    'https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/2030/segments/0/leagues/42?view=mSettings&view=mTeam',
  );
  assert.equal(requested.cookie, 'espn_s2=test-s2; SWID={TEST-SWID}');
});

test('a rejected cookie surfaces a refresh hint without echoing the cookie', async () => {
  await assert.rejects(
    fetchEspnLeague(credentials, { leagueId: '42', seasonId: 2030 }, () =>
      Promise.resolve(new Response('{}', { status: 401 })),
    ),
    (error: Error) => {
      assert.match(error.message, /Refresh ESPN_S2 and ESPN_SWID/);
      assert.doesNotMatch(error.message, /test-s2|TEST-SWID/);
      return true;
    },
  );
});
