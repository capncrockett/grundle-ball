# Architecture Overview

Grundle Ball is a client-rendered React application with a small set of Node maintenance scripts. There is no runtime application server or database dependency in the deployed request path.

## Runtime application

- `frontend/` contains the React 19 + Vite + TypeScript single-page application.
- React Router owns client-side routes. Vercel rewrites non-`/docs/` requests to `index.html`; static constitution files under `/docs/` bypass that rewrite.
- Pages use React hooks and local component state. No global state library is installed.
- DaisyUI/Tailwind provide the component and layout system.
- Vite injects the deployment branch and environment into the footer at build time; the footer also links to the public repository.

## Routes and feature boundaries

- `/standings` is the default route and combines live Sleeper standings data with the checked-in matchup-history snapshot for selected insights.
- `/playoffs` renders Sleeper's official `winners_bracket` and `losers_bracket` responses directly. `sleeperBracket/resolveBracket.ts` resolves participants and placement labels without applying house routing.
- `/matchups` combines Sleeper league/matchup/player data with ESPN NFL game status to show scores and finished-starter counts.
- `/history` renders canonical annual draftboards and Team-specific keeper history. Completed seasons come from a checked-in snapshot; the active season is refreshed from Sleeper in the browser.
- `/local/draft-intel` is available only in local development. It combines completed-draft pattern analysis with deterministic Keeper-Adjusted ADP and is removed from production builds.
- `/constitution` renders `frontend/src/content/constitution.md`; the review-draft PDF is served as a static file.
- `/beta/grundle-bowl/*` contains the custom Champ Bowl / Keeper Bowl / Toilet Bowl proposal. This Beta feature has its own immutable bracket template and routing engine and must not be confused with the official playoff route.

## Data flows

### Standings

```text
Sleeper league + users + rosters
  -> mergeRostersAndUsersToTeams()
  -> computeSeeds()
  -> standings and playoff-race insights
  + checked-in matchupHistoryStore.json for latest stored margins
```

Stored-history rows carry league and season identity. Standings filters the checked-in snapshot to the league and season returned by Sleeper, so the scoped 2025 rows cannot influence 2026 stat-correction insight.

### Matchups

```text
Sleeper NFL state + players + users + rosters + weekly matchups
  + ESPN weekly scoreboard
  -> pairMatchups()
  -> buildLiveMatchData()
  -> MatchupCard
```

### Official playoffs

```text
Sleeper users + rosters + winners_bracket + losers_bracket
  -> resolveBracketMatchups()
  -> SleeperBracketBoard
```

### Draft and keeper history

```text
checked-in draftHistoryStore.json
  + active Sleeper league + canonical draft + picks + users + rosters
  -> buildDraftHistorySeason()
  -> DraftBoard and KeeperHistory
```

The season chain follows `previous_league_id`, while each season uses the league record's `draft_id`. This excludes abandoned or setup-only Sleeper draftboards. Keeper ledger identity is `(rosterId, playerId)` across seasons because keeper history belongs to the persistent Team rather than the current Manager.

### Local Draft Intel

```text
completed draftHistoryStore.json
  -> buildDraftIntelReport()
  -> League and Team pattern views

timestamped Fantasy Footballers UDK ADP CSV
  + Sleeper all-player identities
  + live canonical draft Keeper Designations and exact pick numbers
  -> parseUdkAdpCsv() and resolveUdkAdpPlayers()
  -> calculateKeeperAdjustedAdp()
  -> available-player table and the selected Team's open picks

"Mock Drafts to include" URLs or IDs, seeded by postKeeperMockDraftSource.ts
  + selected Team owner ID
  + live canonical Keeper Designations
  -> public Sleeper metadata and picks for each exact draft ID
  -> league-mock, post-lock, creator, board, draft-slot, and Keeper Designation checks
  -> analyzeMockDrafts()
  -> Observed Mock ADP and availability at the Team's open picks
```

The Keeper-Adjusted ADP engine accepts normalized player, keeper, and draft inputs. It does not fetch Sleeper or parse the UDK CSV. `MockDraftAnalyzer` is also source-independent and consumes only selected draft samples. Baseline ADP, Keeper-Adjusted ADP, and Observed Mock ADP remain separate values. The UI presents the scan-level draft positions in `round.pick` notation and moves overall ADP, pool, sample, and per-pick availability data into an expandable player detail row.

Sleeper's public user-drafts endpoint does not list league-specific mocks. Its draftboards page uses an authenticated query, so Draft Intel does not attempt automatic discovery or handle Sleeper credentials. Instead, the local source seeds the exact approved post-lock batch, and the local-only field accepts replacement Sleeper draft URLs or bare IDs. Input is deduplicated in entry order before the adapter fetches only that exact set. The adapter permits selection only when league-mock metadata, creator, timestamp, draft size, snake type, user draft slot, completed pick count, and the complete current keeper set match exactly. Incompatible drafts stay visible with reasons.

### Grundle Bowl Beta

```text
Sleeper data
  -> internal Team models and seeds
  -> BRACKET_TEMPLATE clone
  -> optional game outcomes through ROUTING_RULES
  -> Champ / Keeper / Toilet bracket components
```

`BRACKET_TEMPLATE` is immutable input. Callers clone and populate slots rather than mutating the shared template.

## Maintenance tooling and stored history

- `backend/scripts/updateMatchupHistory.ts` is a CLI that fetches selected Sleeper weeks.
- `backend/scripts/updateDraftHistory.ts` follows the linked Sleeper league seasons and rewrites the checked-in canonical draft archive.
- `backend/matchupHistoryStore.ts` provides a `MatchupHistoryStore` interface with a checked-in JSON implementation (default) and an optional local `better-sqlite3` implementation. Both schemas include league/season identity.
- The deployed frontend imports `frontend/src/data/matchupHistoryStore.json`; it does not query SQLite or a backend service.
- The deployed frontend imports `frontend/src/data/draftHistoryStore.json` and overlays the active draft with a live browser fetch.
- The timestamped UDK CSV is bundled only with the local Draft Intel source path. It is not a runtime service or a production data dependency.
- Hosted storage, scheduling, and any future API boundary are intentionally deferred in `backend/TODO.md`.

## External boundaries

- Sleeper public APIs provide league, roster, user, matchup, draft, draft-pick, player, NFL-state, and playoff-bracket data.
- ESPN's public NFL scoreboard endpoint provides game completion status for the Matchups page.
- The Fantasy Footballers UDK CSV provides the local Baseline ADP snapshot. Sleeper supplies canonical player IDs and current Keeper Designations, not the ADP values used by this calculation.
- Neither current browser flow requires a private application API key.

## Configuration boundary

`frontend/src/config/league.ts` is the current source for the confirmed 2026 league ID. Every frontend page and the Playwright Matchups test import it, and the Node history updater imports the same value as its default while allowing a `--league` override. This cross-workspace import avoids duplicated IDs today. If configuration later moves to environment variables or a neutral shared package, the browser build and Node CLI must be designed and validated together; that future decision is tracked in `frontend/TODO.md`.
