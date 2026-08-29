import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import BetterSqlite from 'better-sqlite3';
import { getMatchupStore } from './matchupHistoryStore.ts';
import type {
  MatchupHistoryScope,
  StoredMatchup,
} from '../frontend/src/data/matchupHistoryTypes.ts';

const scopeA2025 = { leagueId: 'league-a', season: '2025' };
const scopeA2026 = { leagueId: 'league-a', season: '2026' };
const scopeB2026 = { leagueId: 'league-b', season: '2026' };

const matchup = (
  scope: MatchupHistoryScope,
  margin: number,
  overrides: Partial<StoredMatchup> = {},
): StoredMatchup => ({
  ...scope,
  week: 1,
  team: 'Alpha',
  opponent: 'Beta',
  pointsFor: 100 + margin,
  pointsAgainst: 100,
  margin,
  finished: true,
  ...overrides,
});

const assertScopedReplacement = async (kind: 'json' | 'sqlite', path: string) => {
  const store = await getMatchupStore(
    kind === 'json' ? { kind, jsonPath: path } : { kind, sqlitePath: path },
  );
  await store.write([matchup(scopeA2025, 5), matchup(scopeA2026, 10), matchup(scopeB2026, 15)]);

  const updated = await store.appendWeek(scopeA2026, 1, [matchup(scopeA2026, 20.126)]);

  assert.equal(updated.length, 3);
  assert.equal(
    updated.find(
      (entry) => entry.leagueId === scopeA2025.leagueId && entry.season === scopeA2025.season,
    )?.margin,
    5,
  );
  assert.equal(
    updated.find(
      (entry) => entry.leagueId === scopeA2026.leagueId && entry.season === scopeA2026.season,
    )?.margin,
    20.13,
  );
  assert.equal(
    updated.find(
      (entry) => entry.leagueId === scopeB2026.leagueId && entry.season === scopeB2026.season,
    )?.margin,
    15,
  );
};

test('JSON week replacement is scoped by league and season', async (context) => {
  const directory = await mkdtemp(join(tmpdir(), 'grundle-history-json-'));
  context.after(() => rm(directory, { recursive: true, force: true }));

  await assertScopedReplacement('json', join(directory, 'history.json'));
});

test('SQLite week replacement is scoped by league and season', async (context) => {
  const directory = await mkdtemp(join(tmpdir(), 'grundle-history-sqlite-'));
  context.after(() => rm(directory, { recursive: true, force: true }));

  await assertScopedReplacement('sqlite', join(directory, 'history.sqlite'));
});

test('SQLite migrates the known unscoped snapshot as 2025 history', async (context) => {
  const directory = await mkdtemp(join(tmpdir(), 'grundle-history-migration-'));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, 'history.sqlite');
  const legacyDb = new BetterSqlite(path);
  legacyDb.exec(`
    CREATE TABLE matchups (
      week INTEGER NOT NULL,
      team TEXT NOT NULL,
      opponent TEXT NOT NULL,
      points_for REAL NOT NULL,
      points_against REAL NOT NULL,
      margin REAL NOT NULL,
      finished INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (week, team)
    );
    INSERT INTO matchups VALUES (14, 'Alpha', 'Beta', 110, 100, 10, 1);
  `);
  legacyDb.close();

  const store = await getMatchupStore({ kind: 'sqlite', sqlitePath: path });
  const [migrated] = await store.read();

  assert.equal(migrated?.leagueId, '1251950356187840512');
  assert.equal(migrated?.season, '2025');
  assert.equal(migrated?.week, 14);
});
