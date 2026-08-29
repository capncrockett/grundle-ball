# Grundle Ball

Grundle Ball is the Grundle League dashboard: standings and playoff-race insights, weekly matchups, the official Sleeper playoff bracket, and the league constitution in one React app.

The official `/playoffs` page renders Sleeper's `winners_bracket` and `losers_bracket` without applying house routing. The custom Champ Bowl / Keeper Bowl / Toilet Bowl proposal is preserved separately as the clearly labeled **Grundle Bowl Beta** at `/beta/grundle-bowl`; it is not the league's active playoff format.

## Features

- Standings, division summaries, seeding, and playoff-race insights.
- Weekly Sleeper matchups with ESPN-backed starter completion counts.
- Official playoff bracket derived directly from Sleeper.
- In-repo Grundle League constitution with a table of contents and downloadable review-draft PDF.
- Grundle Bowl Beta with Live and If-Today views of the rejected custom bracket proposal.
- Responsive DaisyUI interface, selectable themes, and Vercel build metadata.

## Tech stack

- React, Vite, and TypeScript
- Tailwind CSS and DaisyUI
- Jest, React Testing Library, MSW, and Playwright
- Node maintenance scripts with JSON and optional local SQLite matchup-history stores

## Getting started

Run these commands from the repository root:

```bash
npm install
npm run dev -w frontend
```

The development server defaults to `http://localhost:5173`.

## Quality checks

```bash
# Prettier check
npm run format

# Frontend and backend lint
npm run lint

# Frontend and backend TypeScript checks
npm run typecheck

# Frontend Jest suite
npm run test:ci -w frontend

# Production build
npm run build -w frontend
```

For local end-to-end testing, start the dev server in one terminal and run this in another:

```bash
npm run test:e2e:local -w frontend
```

Playwright's default non-local target is the Grundle Ball staging deployment. Set `E2E_BASE_URL` to test a different deployment. See [`TESTING.md`](TESTING.md) for browser setup, CI behavior, coverage, and known gaps.

Production is hosted at <https://grundle-ball.vercel.app>. A live root check returned HTTP 200 with the title “Grundle Ball”; route-by-route production smoke coverage remains a release task.

## Routes

| Route                         | Purpose                                                                        |
| ----------------------------- | ------------------------------------------------------------------------------ |
| `/standings`                  | Default landing page; standings, division summaries, and playoff-race insights |
| `/playoffs`                   | Official Sleeper winners and consolation brackets                              |
| `/matchups`                   | Week-selectable matchups and starter completion counts                         |
| `/constitution`               | Current in-repo constitution and review-draft PDF link                         |
| `/beta/grundle-bowl/live`     | Beta custom bracket populated from playoff results                             |
| `/beta/grundle-bowl/if-today` | Beta custom bracket seeded from current standings                              |

Legacy `/playoffs/live` and `/playoffs/if-today` links redirect to the corresponding Beta routes.

## Data and configuration

- The browser calls Sleeper's public API directly. The Matchups page also calls ESPN's public NFL scoreboard endpoint to determine whether starters' games are complete.
- League targeting is code-configured. `frontend/src/config/league.ts` exports the confirmed 2026 Sleeper league ID (`1385053148233621511`) used by every frontend page, the Playwright Matchups test, and the backend history updater's default. The updater can still target another league explicitly with `--league=<id>`.
- `frontend/src/data/matchupHistoryStore.json` is a checked-in snapshot used by standings insights. Its current rows came from the 2025 season, but the stored model has no league or season field yet. Until the high-priority scoping work in `ROADMAP.md` and `backend/TODO.md` is complete, those rows can incorrectly influence 2026 stat-correction insights. The existing maintenance syntax is:

  ```bash
  npm run fetch:matchups -w frontend -- --week=14
  ```

  The maintenance script defaults to the JSON store; set `MATCHUP_STORE=sqlite` to use its local SQLite adapter. Do not mix 2026 updates into an unscoped 2025 store without the planned migration or an explicit full-store replacement. Hosted persistence and scheduling remain tracked in [`backend/TODO.md`](backend/TODO.md).

## Documentation

- [`frontend/WARP.md`](frontend/WARP.md): frontend architecture, patterns, and commands
- [`docs/architecture.md`](docs/architecture.md): system boundaries and data flows
- [`docs/data-model.md`](docs/data-model.md): current TypeScript domain models
- [`docs/deployment.md`](docs/deployment.md): Vercel and release operations
- [`docs/versioning.md`](docs/versioning.md): semantic-versioning and release-branch policy
- [`docs/sleeper-api.md`](docs/sleeper-api.md): external API calls used by the app
- [`ROADMAP.md`](ROADMAP.md): active and deferred work
