import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { MatchupHistory, StoredMatchup } from '../frontend/src/data/matchupHistoryTypes';
import { normalizeTeamName } from '../frontend/src/data/matchupHistory';

export type MatchupHistoryStore = {
  kind: 'json' | 'sqlite';
  describe: () => string;
  read: () => Promise<MatchupHistory>;
  write: (matchups: MatchupHistory) => Promise<MatchupHistory>;
  appendWeek: (week: number, entries: StoredMatchup[]) => Promise<MatchupHistory>;
};

export type StoreConfig = {
  kind?: 'json' | 'sqlite';
  jsonPath?: string;
  sqlitePath?: string;
};

const STORE_FILE_URL = new URL('../frontend/src/data/matchupHistoryStore.json', import.meta.url);
export const MATCHUP_HISTORY_STORE_PATH = fileURLToPath(STORE_FILE_URL);
const DEFAULT_SQLITE_PATH = fileURLToPath(
  new URL('../frontend/src/data/matchupHistory.sqlite', import.meta.url),
);

const sortMatchups = (matchups: MatchupHistory): MatchupHistory =>
  [...matchups].sort((a, b) => {
    if (a.week !== b.week) return a.week - b.week;
    return a.team.localeCompare(b.team);
  });

const roundEntry = (entry: StoredMatchup): StoredMatchup => ({
  ...entry,
  margin: Number(entry.margin.toFixed(2)),
  pointsFor: Number(entry.pointsFor.toFixed(2)),
  pointsAgainst: Number(entry.pointsAgainst.toFixed(2)),
});

function createJsonStore(path = MATCHUP_HISTORY_STORE_PATH): MatchupHistoryStore {
  const describe = () => `JSON store at ${path}`;

  const read = async (): Promise<MatchupHistory> => {
    try {
      const raw = await readFile(path, 'utf8');
      const parsed = JSON.parse(raw) as MatchupHistory;
      return sortMatchups(parsed);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw err;
    }
  };

  const write = async (matchups: MatchupHistory): Promise<MatchupHistory> => {
    const sorted = sortMatchups(matchups);
    const payload = `${JSON.stringify(sorted, null, 2)}\n`;
    await writeFile(path, payload, 'utf8');
    return sorted;
  };

  const appendWeek = async (week: number, entries: StoredMatchup[]): Promise<MatchupHistory> => {
    const existing = await read();
    const withoutWeek = existing.filter((m) => m.week !== week);
    const normalized: MatchupHistory = entries.map(roundEntry).map((entry) => ({
      ...entry,
      week,
    }));
    return write([...withoutWeek, ...normalized]);
  };

  return { kind: 'json', describe, read, write, appendWeek };
}

function ensureSqliteSchema(db: {
  exec: (sql: string) => unknown;
}): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS matchups (
      week INTEGER NOT NULL,
      team TEXT NOT NULL,
      opponent TEXT NOT NULL,
      points_for REAL NOT NULL,
      points_against REAL NOT NULL,
      margin REAL NOT NULL,
      finished INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (week, team)
    );
    CREATE INDEX IF NOT EXISTS idx_matchups_week ON matchups(week);
  `);
}

type BetterSqliteStatement = {
  run: (params?: unknown) => unknown;
  all: (params?: unknown) => unknown[];
};

type BetterSqliteDatabase = {
  exec: (sql: string) => unknown;
  prepare: (sql: string) => BetterSqliteStatement;
  transaction: <Args extends unknown[], Result>(
    fn: (...args: Args) => Result,
  ) => (...args: Args) => Result;
};

type BetterSqliteCtor = new (path: string) => BetterSqliteDatabase;

async function loadBetterSqlite(): Promise<BetterSqliteCtor> {
  try {
    const mod = (await import('better-sqlite3')) as {
      default?: BetterSqliteCtor;
    };
    const ctor = mod.default ?? (mod as unknown as BetterSqliteCtor);
    return ctor;
  } catch {
    throw new Error(
      'better-sqlite3 is not installed. Install it to use the SQLite/Turso adapter.',
    );
  }
}

async function createSqliteStore(sqlitePath = DEFAULT_SQLITE_PATH): Promise<MatchupHistoryStore> {
  const BetterSqlite = await loadBetterSqlite();
  const db = new BetterSqlite(sqlitePath);
  ensureSqliteSchema(db);

  const describe = () => `SQLite store at ${sqlitePath}`;

  const read = (): Promise<MatchupHistory> => {
    const rows = db
      .prepare(
        'SELECT week, team, opponent, points_for AS pointsFor, points_against AS pointsAgainst, margin, finished FROM matchups ORDER BY week ASC, team ASC',
      )
      .all() as {
      week: number;
      team: string;
      opponent: string;
      pointsFor: number;
      pointsAgainst: number;
      margin: number;
      finished: number | boolean;
    }[];
    const normalized = rows.map((row) => ({
      ...row,
      finished: row.finished === 1 || row.finished === true,
      margin: row.margin,
      pointsFor: row.pointsFor,
      pointsAgainst: row.pointsAgainst,
    }));
    return Promise.resolve(normalized);
  };

  const write = async (matchups: MatchupHistory): Promise<MatchupHistory> => {
    const insert = db.prepare(
      'INSERT OR REPLACE INTO matchups (week, team, opponent, points_for, points_against, margin, finished) VALUES (@week, @team, @opponent, @pointsFor, @pointsAgainst, @margin, @finished)',
    );
    const tx = db.transaction((entries: StoredMatchup[]) => {
      db.exec('DELETE FROM matchups');
      entries.forEach((entry) => insert.run(roundEntry(entry)));
    });
    tx(matchups);
    return read();
  };

  const appendWeek = async (week: number, entries: StoredMatchup[]): Promise<MatchupHistory> => {
    const insert = db.prepare(
      'INSERT OR REPLACE INTO matchups (week, team, opponent, points_for, points_against, margin, finished) VALUES (@week, @team, @opponent, @pointsFor, @pointsAgainst, @margin, @finished)',
    );
    const tx = db.transaction((rows: StoredMatchup[]) => {
      db.prepare('DELETE FROM matchups WHERE week = ?').run(week);
      rows.forEach((row) =>
        insert.run({
          ...roundEntry(row),
          week,
        }),
      );
    });
    tx(entries);
    return read();
  };

  return { kind: 'sqlite', describe, read, write, appendWeek };
}

export async function getMatchupStore(config: StoreConfig = {}): Promise<MatchupHistoryStore> {
  const envKind = process.env.MATCHUP_STORE?.toLowerCase();
  const envKindParsed: 'sqlite' | 'json' | null =
    envKind === 'sqlite' || envKind === 'json' ? envKind : null;
  const kind = config.kind ?? envKindParsed ?? 'json';

  if (kind === 'sqlite') {
    return createSqliteStore(config.sqlitePath ?? process.env.MATCHUP_SQLITE_PATH);
  }

  return createJsonStore(config.jsonPath);
}

export async function readMatchupHistoryFromDisk(): Promise<MatchupHistory> {
  const store = await getMatchupStore();
  return store.read();
}

export async function writeMatchupHistoryToDisk(
  matchups: MatchupHistory,
): Promise<MatchupHistory> {
  const store = await getMatchupStore();
  return store.write(matchups);
}

export async function appendWeekMatchups(
  week: number,
  entries: StoredMatchup[],
): Promise<MatchupHistory> {
  const store = await getMatchupStore();
  return store.appendWeek(week, entries);
}

export function getMarginsForWeekFromEntries(
  week: number,
  entries: MatchupHistory,
): Map<string, number> {
  const margins = new Map<string, number>();
  entries
    .filter((m) => m.week === week)
    .forEach((m) => {
      margins.set(m.team, m.margin);
      margins.set(normalizeTeamName(m.team), m.margin);
    });
  return margins;
}
