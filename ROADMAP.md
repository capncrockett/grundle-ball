# Grundle Ball - Roadmap

This file tracks work that remains after the Grundle Ball rebrand and the move to a Sleeper-mirrored official playoff page. Completed phase-by-phase implementation notes have been removed; current architecture and supported behavior live in `frontend/WARP.md`.

## High priority - stored-history correctness

The 2025 snapshot is labeled with its actual league and season, storage keys are scoped, Standings requests only the active Sleeper league/season, and the CLI validates its arguments and upstream scope before writing.

- [x] Add `leagueId` and `season` to stored matchup rows and make them part of SQLite uniqueness/indexing.
- [x] Stamp fetched rows from the selected league and its resolved season rather than assuming the app's current default.
- [x] Migrate and explicitly label the existing JSON/SQLite rows as 2025 data.
- [x] Require Standings history helpers to select the current league and season; if no matching snapshot exists, omit history-dependent stat-correction insight instead of falling back to another season.
- [x] Add JSON, SQLite, and frontend regression tests with overlapping week numbers across seasons and leagues.
- [x] Add CLI argument/upstream-data regression coverage proving an alternate `--league` is stamped with that league's resolved season.

### Manual Sleeper edit reconciliation (decided 2026-09-18, issue #47)

A commissioner's manual Sleeper score edit (the vacant-team median rule from PR #46) appeared not to be reflected in the app. Investigation traced this to the live Sleeper API's own recompute lag, not app-side staleness:

- `StandingsPage` and `MatchupsPage` read `getLeague`/`getLeagueUsers`/`getLeagueRosters`/`getLeagueMatchupsForWeek` live with `cache: 'no-store'` on every load; there is no app-side cache on either path that could serve a stale value.
- `matchupHistoryStore.json`'s only consumer, `StandingsPage`'s best/worst seed-range and stat-correction hint, is scoped by both `leagueId` and `season` (`getStoredMatchups`). The 2025 snapshot is stamped with the prior season's Sleeper `league_id` (`1251950356187840512`), which differs from the 2026 league's id (`1385053148233621511`) because Sleeper mints a new `league_id` per season. The scoping added earlier in this section already makes the feature go inert for a new season instead of leaking prior-season numbers.
- Confirmed live: fetching the 2026 league directly showed the edited roster's `fpts` matching the constitution example, i.e. Sleeper had already propagated the edit by the time of the check.

Decision: no scheduled sync worker. A periodic re-fetch would guard a view (Standings/Matchups) that is already live and uncached; the actual gap was `matchupHistoryStore.json` having no 2026 rows yet, which only affects the best/worst-seed hint, not win/loss/PF/PA. That gap is closed by running the existing `npm run fetch:matchups -w frontend -- --week=N` CLI after each week's Wednesday stat corrections finalize (manual, not scheduled - vacant-team weeks needing this hint are rare). This supersedes the "Deploy/run the fetcher on a schedule" backlog item in `backend/TODO.md`.

## Release and operations

Production root availability is verified at `https://grundle-ball.vercel.app` (HTTP 200 with the Grundle Ball title). Every `release/**` push runs the checked-out application locally through both Playwright projects, so protected Vercel staging is an optional environment check rather than a release gate.

- [x] Run the full local Playwright suite on both projects for every release-branch push in GitHub Actions.
- [ ] Run a production smoke pass after the next release and verify Sleeper and ESPN requests from the deployed origin.
- [x] Add CI production-build validation (`npm run build -w frontend`) alongside the frontend and backend tests.
- [x] Add automated internal-link and stale-brand checks for maintained Markdown documentation.

See `TESTING.md` for the verified automated coverage and remaining test gaps, and `docs/deployment.md` for the current release flow.

## Configuration evolution

- [x] Keep league configuration in checked-in source for the current single-league product. The browser and Node history updater share `frontend/src/config/league.ts`.
- [ ] Revisit configuration only if multiple leagues become a supported product requirement. Before adding a selector, define how league selection affects cached matchup history, divisions, seeding rules, and URLs.

## Coordinated major dependency migrations

The compatibility-safe dependency refresh does not mean every package is on its latest major. Treat the remaining toolchain jumps as coordinated migrations, not independent version bumps:

- [x] Upgrade ESLint 10 with compatible `typescript-eslint`, React Hooks, React Refresh, and globals packages; keep root frontend/backend lint green.
- [x] Upgrade Jest and `jest-environment-jsdom` to 30 with `ts-jest` 29.4 and Jest 30 types.
- [x] Upgrade Vite 8 with its compatible React plugin, Tailwind integration, and Lightning CSS build path.
- [ ] Upgrade TypeScript 7 after its consumers support it. `typescript-eslint` 8.68 supports TypeScript below 6.1, and `ts-jest` 29.4 supports TypeScript below 7.
- [x] Upgrade one compatibility cluster at a time and run root lint/typecheck, Jest, the production build, and both Playwright projects before declaring it complete.
- [x] Re-run the dependency report after each cluster and record deliberately deferred majors.

Current deliberate deferrals from the post-upgrade dependency report:

- Keep `@types/node` on 24 while the application runtime contract is Node 24.
- Keep MSW pinned to 2.12.3 because 2.15 introduces an ESM interceptor path that the current CommonJS Jest transform cannot load.
- Keep TypeScript on 5.9 until both `typescript-eslint` and `ts-jest` support TypeScript 7.

## Grundle Bowl Beta polish

The items in this section apply only to the rejected custom Champ Bowl / Keeper Bowl / Toilet Bowl proposal under `/beta/grundle-bowl`, not the official `/playoffs` bracket.

- [ ] Add compact flow labels where they improve comprehension: `Rimmers`, `Flushed`, `Floaters`, and `Splashbacks`.
- [ ] Decide how to visualize loser and cross-bracket movement. `BracketGrid` currently derives visible winner connectors from `ROUTING_RULES` and supports manual BYE connectors; cross-board and loser routes are not represented consistently.
- [ ] Recheck connector geometry after any bracket layout change at desktop and mobile widths.

## Matchup enhancements

### Projected totals and win probability

The Matchups page currently shows actual points plus finished-starter counts. `getPlayerProjections()` exists in `frontend/src/api/sleeper.ts` but is not consumed.

- [ ] Confirm the projection endpoint and scoring-format mapping before relying on it.
- [ ] Sum remaining starter projections using the league's scoring settings.
- [ ] Define a defensible win-probability model; a ratio of projected totals should not be presented as equivalent to Sleeper's proprietary probability.
- [ ] Add loading, partial-data, and unavailable-projection behavior plus tests before restoring projected totals or probabilities to the UI.
- [ ] Consider caching because projections change throughout the week and add another large request.

Starter completion tracking is already implemented with Sleeper player metadata and ESPN game status; it is no longer a future workstream.

## Backend and stored history

The checked-in JSON snapshot remains the UI source until a hosted data layer is deliberately introduced. Detailed implementation notes live in [`backend/TODO.md`](backend/TODO.md).

### Hosted data layer

- [ ] Define the product and operational trigger for introducing a hosted database, such as multi-season history, multiple leagues, scheduled writes, or administrator workflows; do not add a runtime dependency without a concrete need.
- [x] Complete league/season scoping and migration coverage for the existing JSON and SQLite stores before selecting hosted infrastructure.
- [ ] Choose a hosted store behind `MatchupHistoryStore` and record the durable choice in an ADR. Turso/libsql and Postgres are the current candidates.
- [ ] Design the browser access boundary, authentication/authorization, scheduled ingestion, observability, backups, recovery, and rollback before moving the deployed frontend off the checked-in snapshot.
- [ ] Define forward and rollback migrations plus explicit backfill validation for every persisted schema change.
- [ ] Classify database-backed releases under [`docs/versioning.md`](docs/versioning.md): private compatible migrations are normally patches, new capabilities are minors, and operator- or user-breaking migrations may require a major.
