# Backend TODO — Matchup History Store

## Current state

- JSON store at `frontend/src/data/matchupHistoryStore.json` is the source for the UI.
- Backend adapter in `backend/matchupHistoryStore.ts` defaults to JSON and supports local SQLite via `MATCHUP_STORE=sqlite`; `MATCHUP_SQLITE_PATH` optionally overrides the local database path.
- Fetch CLI lives at `backend/scripts/updateMatchupHistory.ts` and requires `--week`, `--weeks`, or `--range`. Run it through the frontend workspace, for example `npm run fetch:matchups -w frontend -- --week=14`.
- The CLI imports the confirmed 2026 `LEAGUE_ID` from `frontend/src/config/league.ts` as its default, accepts `--league=<id>` as an explicit override, and resolves the selected league's season before writing.
- Stored rows, JSON replacement, and SQLite uniqueness/deletes are scoped by `(leagueId, season, week)`; the existing snapshot and automatic legacy SQLite migration label known rows as league `1251950356187840512`, season `2025`.
- `npm run test -w backend` covers scoped JSON/SQLite replacement and the legacy SQLite migration.
- The backend workspace is maintenance tooling only. No backend service or SQLite database is queried by the deployed frontend.

## Remaining correctness coverage

- Add CLI argument and mocked-upstream tests, including an alternate `--league` whose resolved season differs from the app default.
- Add malformed Sleeper payload coverage before scheduling unattended writes.

## Next steps (DB / hosting)

- Add a hosted adapter (Turso/libsql recommended; Postgres acceptable) under the existing `MatchupHistoryStore` interface.
- Proposed env shape for hosted mode (not implemented):
  - `MATCHUP_STORE=db`
  - Turso/libsql: `DB_URL`, `DB_AUTH_TOKEN`
  - Postgres: `DATABASE_URL` (with SSL flags as needed)
- Schema to create:
  ```
  CREATE TABLE matchups (
    league_id TEXT NOT NULL,
    season TEXT NOT NULL,
    week INTEGER NOT NULL,
    team TEXT NOT NULL,
    opponent TEXT NOT NULL,
    points_for REAL NOT NULL,
    points_against REAL NOT NULL,
    margin REAL NOT NULL,
    finished BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (league_id, season, week, team)
  );
  CREATE INDEX idx_matchups_scope_week ON matchups(league_id, season, week);
  ```
- Hosted migration: create the scoped table and optionally backfill it from the migrated JSON snapshot.
- Decide consumption path for the frontend:
  1. Mirror DB writes back to JSON so UI stays file-based, or
  2. Add a tiny API route/serverless function to serve matchup history from DB and point the UI at it.
- Deploy/run the fetcher on a schedule (GitHub Actions/Vercel Cron) between MNF end and Wednesday stat corrections.
- Extend the existing JSON/SQLite tests with hosted-adapter parity once an adapter is selected.
- If league configuration moves to environment variables or a neutral shared module, keep the updater and browser build on one validated default while preserving the CLI override.

## Nice-to-haves

- Healthcheck/logging around fetch jobs (rows written, weeks covered).
- Simple admin command to re-run a week or wipe/reload a week from DB.
- README/ops notes for hosted DB setup, migrations, recovery, and envs once an adapter is implemented.
