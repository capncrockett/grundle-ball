# Testing Guide

Grundle Ball uses Jest and React Testing Library for unit/integration coverage and Playwright for browser smoke coverage. Unless noted otherwise, run commands from the repository root.

## Commands

```bash
# Jest (interactive/default)
npm run test -w frontend

# Jest as CI runs it
npm run test:ci -w frontend

# Jest watch mode
npm run test:watch -w frontend

# Prettier check
npm run format

# Frontend + backend lint
npm run lint

# Frontend + backend TypeScript checks
npm run typecheck

# Production build
npm run build -w frontend
```

### Playwright against local development

Install the browsers once in the cache used by the local script:

```bash
cd frontend
PLAYWRIGHT_BROWSERS_PATH=0 npx playwright install chromium webkit
cd ..
```

Run Playwright:

```bash
npm run test:e2e:local -w frontend
```

The local script sets `E2E_BASE_URL=http://localhost:5173`, starts Vite automatically (or reuses an existing local server), and runs the configured Chromium desktop and iPhone 12 projects.

### Playwright against a deployment

```bash
# Uses the staging URL configured in frontend/playwright.config.ts
npm run test:e2e -w frontend

# Override the target
E2E_BASE_URL=https://example.invalid npm run test:e2e -w frontend

# Visible browser; set E2E_BASE_URL as needed
npm run test:e2e:headed -w frontend
```

The Playwright config loads `.env` from the repository root and then `frontend/.env`. If a protected Vercel deployment is targeted, set `VERCEL_AUTOMATION_BYPASS_SECRET`; the config sends the corresponding Vercel bypass headers.

## Current automated coverage

### Jest

- App routing, active navigation, the Grundle Ball header, Constitution route, and Beta redirects.
- Official Sleeper playoff rendering and its loading, empty, and error states.
- Grundle Bowl Beta Live and If-Today pages, including API failures.
- Standings and Matchups page rendering, loading, empty/partial data, and API failures.
- Constitution rendering, table of contents, source content, and Markdown parsing.
- Bracket layout/cards, seed assignment, routing-related transforms, and score application.
- Sleeper transforms, official bracket resolution, player game status, stored matchup-history helpers, standings insights, playoff-race insights, and narratives.

Jest uses jsdom, React Testing Library, and MSW-backed fixtures. It excludes `frontend/tests/e2e/` through `frontend/jest.config.ts`.

### Playwright

- `smoke.spec.ts`: primary routes, desktop navigation, compact mobile navigation, Constitution anchors, the Grundle Ball header/footer, and a user-visible ESPN error.
- `matchups.spec.ts`: mocked Sleeper/ESPN matchup data and week switching.
- `theme.spec.ts`: theme selection and persistence across reloads.
- Both Chromium desktop and the iPhone 12 device profile run for every Playwright invocation.

Most smoke checks target the configured deployment and therefore exercise its current API environment. The dedicated Matchups flow intercepts external API calls with fixtures for deterministic assertions.

## GitHub Actions behavior

- Both workflows use `actions/checkout@v7`, `actions/setup-node@v7`, and Node 24.x, matching the root package engine.
- `.github/workflows/lint.yml` runs root formatting, lint, and typechecks on pull requests, `release/**` pushes, and manual dispatch. The lint and typecheck commands cover both frontend and backend workspaces.
- `.github/workflows/test.yml` runs the frontend Jest CI suite on pull requests, `release/**` pushes, and manual dispatch.
- The Playwright job runs on pushes to `release/**`, pull requests targeting `main`, and manual dispatch. It starts the checked-out app locally and runs Chromium desktop and iPhone 12 coverage against that exact commit.

For a release, separately run the full Playwright suite against the deployed staging URL and record the result before merging to `main`; after deployment, repeat the smoke suite against the production URL.

## Known gaps

- [ ] No Jest coverage thresholds or coverage-report artifact are configured.
- [ ] Backend store and history-update scripts have no automated tests; the high-priority league/season scoping migration needs overlapping-week regression coverage across JSON, SQLite, CLI, and Standings selectors.
- [ ] GitHub Actions do not currently run the production Vite build.
- [ ] The deployment smoke suite does not mock every external request, so it is useful for environment verification but is not fully hermetic.
- [ ] There is no automated link checker or stale-brand scanner for maintained documentation.
- [ ] Production-route smoke results are operational steps, not a current CI job.

Track implementation work for these gaps in `ROADMAP.md` or the relevant frontend/backend TODO file rather than marking them complete here without test evidence.
