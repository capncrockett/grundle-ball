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
    scheduleSettings: {
      divisions: [{ id: 0, size: 2 }],
      matchupPeriodCount: 14,
      playoffTeamCount: 6,
      playoffMatchupPeriodLength: 1,
      playoffSeedingRule: 'TOTAL_POINTS_SCORED',
    },
  },
  status: { currentMatchupPeriod: 9, finalScoringPeriod: 17 },
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
  schedule: [
    {
      matchupPeriodId: 9,
      playoffTierType: 'NONE',
      winner: 'UNDECIDED',
      home: { teamId: 2, totalPoints: 12.5, pointsByScoringPeriod: { 9: 12.5 } },
      away: { teamId: 1, totalPoints: 0 },
    },
    {
      matchupPeriodId: 1,
      playoffTierType: 'NONE',
      winner: 'AWAY',
      home: { teamId: 2, totalPoints: 101.236 },
      away: { teamId: 1, totalPoints: 120.4 },
    },
    // Bye week, playoff, and post-season rows stay out of the regular-season schedule.
    { matchupPeriodId: 2, playoffTierType: 'NONE', winner: 'UNDECIDED', home: { teamId: 1 } },
    {
      matchupPeriodId: 15,
      playoffTierType: 'WINNERS_BRACKET',
      winner: 'UNDECIDED',
      home: { teamId: 1, totalPoints: 0 },
      away: { teamId: 2, totalPoints: 0 },
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
    playoffByeCount: 2,
    teams: [
      { id: 1, name: 'First', wins: 6, losses: 1, ties: 1, pointsFor: 1000.1, seed: 1 },
      { id: 2, name: 'Second', wins: 5, losses: 3, ties: 0, pointsFor: 900.12, seed: 2 },
    ],
    matchups: [
      {
        week: 1,
        homeTeamId: 2,
        awayTeamId: 1,
        homePoints: 101.24,
        awayPoints: 120.4,
        final: true,
      },
      { week: 9, homeTeamId: 2, awayTeamId: 1, homePoints: 12.5, awayPoints: 0, final: false },
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

test('snapshot refuses unreviewed personal names without disclosing them in its error', () => {
  const named: RawEspnLeague = {
    ...raw,
    teams: [{ ...raw.teams[0], id: 5, name: "Sam's Squad" }],
  };

  assert.throws(
    () => toSisterLeagueSnapshot(named, '2030-11-01T00:00:00.000Z'),
    (error: Error) => {
      assert.match(error.message, /Team ids 5.*reviewed teamNameOverrides/);
      assert.doesNotMatch(error.message, /Sam|Squad/);
      return true;
    },
  );
  const reviewed = toSisterLeagueSnapshot(named, '2030-11-01T00:00:00.000Z', {
    teamNameOverrides: { 5: 'S Team' },
  });
  assert.equal(reviewed.teams[0].name, 'S Team');
});

test('snapshot refuses playoff settings the record-and-points model cannot represent', () => {
  for (const scheduleSettings of [
    { ...raw.settings.scheduleSettings, playoffSeedingRule: 'H2H_RECORD' },
    {
      ...raw.settings.scheduleSettings,
      divisions: [
        { id: 0, size: 1 },
        { id: 1, size: 1 },
      ],
    },
  ]) {
    assert.throws(
      () =>
        toSisterLeagueSnapshot(
          { ...raw, settings: { ...raw.settings, scheduleSettings } },
          '2030-11-01T00:00:00.000Z',
        ),
      /Unsupported ESPN playoff seeding/,
    );
  }
});

test('first-round byes depend on bracket size rather than extra playoff scoring weeks', () => {
  for (const playoffTeamCount of [6, 8]) {
    for (const finalScoringPeriod of [17, 18]) {
      const snapshot = toSisterLeagueSnapshot(
        {
          ...raw,
          settings: {
            ...raw.settings,
            scheduleSettings: { ...raw.settings.scheduleSettings, playoffTeamCount },
          },
          status: { ...raw.status, finalScoringPeriod },
        },
        '2030-11-01T00:00:00.000Z',
      );
      assert.equal(snapshot.playoffByeCount, playoffTeamCount === 6 ? 2 : 0);
    }
  }
});

test('credentials require both cookies and a braced SWID', () => {
  assert.deepEqual(readCredentials({ ESPN_S2: ' s2 ', ESPN_SWID: '{ID}' }), {
    espnS2: 's2',
    swid: '{ID}',
  });
  assert.throws(() => readCredentials({ ESPN_S2: 's2' }), /ESPN_S2 and ESPN_SWID/);
  assert.throws(() => readCredentials({ ESPN_S2: 's2', ESPN_SWID: 'ID' }), /curly braces/);
});

test('fetch sends the cookies and requests only settings, team, and score views', async () => {
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
    'https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/2030/segments/0/leagues/42?view=mSettings&view=mTeam&view=mMatchupScore',
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
