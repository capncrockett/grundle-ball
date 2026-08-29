# Backend TODO — Matchup History Store

## Current state

- JSON store at `frontend/src/data/matchupHistoryStore.json` is the source for the UI.
- Backend adapter in `backend/matchupHistoryStore.ts` defaults to JSON and supports local SQLite via `MATCHUP_STORE=sqlite`; `MATCHUP_SQLITE_PATH` optionally overrides the local database path.
- Fetch CLI lives at `backend/scripts/updateMatchupHistory.ts` and requires `--week`, `--weeks`, or `--range`. Run it through the frontend workspace, for example `npm run fetch:matchups -w frontend -- --week=14`.
- The CLI imports the confirmed 2026 `LEAGUE_ID` from `frontend/src/config/league.ts` as its default and accepts `--league=<id>` as an explicit override.
- The backend workspace is maintenance tooling only. No backend service or SQLite database is queried by the deployed frontend.

## High priority — scope history by league and season

The current JSON rows are 2025 data, but `StoredMatchup` and both store implementations identify rows only by week and team. Repeated NFL week numbers collide across seasons, and Standings can consume a prior-season margin as current 2026 evidence.

- Add required `leagueId` and `season` fields to `StoredMatchup` and all store APIs.
- Resolve/stamp the season for the CLI's selected `--league` value; do not silently stamp an override with the default league's season.
- Migrate existing JSON rows with their actual 2025 league/season identity and add an explicit SQLite migration for existing local databases.
- Change JSON week replacement and SQLite keys/deletes to scope by `(leagueId, season, week)`.
- Update Standings consumers to request only the active league/season and return no history-derived insight when no matching rows exist.
- Test two leagues and two seasons with overlapping week/team values across JSON, SQLite, CLI, and frontend selectors.

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
- Migration script: create the scoped table, migrate existing local rows with explicit league/season identity, and optionally backfill the hosted store from the migrated JSON snapshot.
- Decide consumption path for the frontend:
  1. Mirror DB writes back to JSON so UI stays file-based, or
  2. Add a tiny API route/serverless function to serve matchup history from DB and point the UI at it.
- Deploy/run the fetcher on a schedule (GitHub Actions/Vercel Cron) between MNF end and Wednesday stat corrections.
- Add automated tests for JSON/SQLite parity, week replacement, CLI argument validation, and malformed upstream data before scheduling unattended writes.
- If league configuration moves to environment variables or a neutral shared module, keep the updater and browser build on one validated default while preserving the CLI override.

## Nice-to-haves

- Healthcheck/logging around fetch jobs (rows written, weeks covered).
- Simple admin command to re-run a week or wipe/reload a week from DB.
- README/ops notes for hosted DB setup, migrations, recovery, and envs once an adapter is implemented.
