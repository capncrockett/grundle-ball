# Architecture Overview

Grundle Ball is a client-rendered React application with a small set of Node maintenance scripts. There is no runtime application server or database dependency in the deployed request path.

## Runtime application

- `frontend/` contains the React 19 + Vite + TypeScript single-page application.
- React Router owns client-side routes. Vercel rewrites non-`/docs/` requests to `index.html`; static constitution files under `/docs/` bypass that rewrite.
- Pages use React hooks and local component state. No global state library is installed.
- DaisyUI/Tailwind provide the component and layout system.
- Vite injects build/deployment metadata into the footer at build time.

## Routes and feature boundaries

- `/standings` is the default route and combines live Sleeper standings data with the checked-in matchup-history snapshot for selected insights.
- `/playoffs` renders Sleeper's official `winners_bracket` and `losers_bracket` responses directly. `sleeperBracket/resolveBracket.ts` resolves participants and placement labels without applying house routing.
- `/matchups` combines Sleeper league/matchup/player data with ESPN NFL game status to show scores and finished-starter counts.
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

Known correctness gap: the snapshot currently contains 2025 rows without league/season identity, while the 2026 Standings path selects by week only. Until the high-priority migration and filtering work in `ROADMAP.md` is complete, prior-season margins can influence current stat-correction insight.

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
- `backend/matchupHistoryStore.ts` provides a `MatchupHistoryStore` interface with a checked-in JSON implementation (default) and an optional local `better-sqlite3` implementation. Both current schemas lack league/season identity.
- The deployed frontend imports `frontend/src/data/matchupHistoryStore.json`; it does not query SQLite or a backend service.
- Hosted storage, scheduling, and any future API boundary are intentionally deferred in `backend/TODO.md`.

## External boundaries

- Sleeper public APIs provide league, roster, user, matchup, player, NFL-state, and playoff-bracket data.
- ESPN's public NFL scoreboard endpoint provides game completion status for the Matchups page.
- Neither current browser flow requires a private application API key.

## Configuration boundary

`frontend/src/config/league.ts` is the current source for the confirmed 2026 league ID. Every frontend page and the Playwright Matchups test import it, and the Node history updater imports the same value as its default while allowing a `--league` override. This cross-workspace import avoids duplicated IDs today. If configuration later moves to environment variables or a neutral shared package, the browser build and Node CLI must be designed and validated together; that future decision is tracked in `frontend/TODO.md`.
