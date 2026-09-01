# Testing Guide

Grundle Ball uses Jest and React Testing Library for unit/integration coverage and Playwright for browser smoke coverage. Unless noted otherwise, run commands from the repository root.

## Commands

```bash
# Jest (interactive/default)
npm run test -w frontend

# Jest as CI runs it
npm run test:ci -w frontend

# Matchup-history JSON/SQLite tests
npm run test -w backend

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

All Playwright scripts use the repo-local browser cache selected by `PLAYWRIGHT_BROWSERS_PATH=0`. The local script also sets `E2E_BASE_URL=http://localhost:5173`, starts Vite automatically (or reuses an existing local server), and runs the configured Chromium desktop and iPhone 12 projects. It also builds and serves the production app for the production-boundary project, which verifies that local-only tools are absent.

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
- Historical draftboard season switching, keeper markers, provisional Team designations, and cross-season keeper-ledger grouping.
- Keeper-Adjusted ADP pool compression, occupied-slot repayment, multiple keepers, decimal interpolation, finite-board behavior, snake numbering, UDK CSV parsing, Sleeper identity resolution, and Draft Intel presentation.
- Mock-draft descriptive statistics, inclusive per-pick availability, undrafted players, sample denominators, the unique 10-ID source batch, pasted URL/ID parsing and deduplication, strict league-mock/post-lock filtering, exact complete-keeper-set checks, selection controls, compact `round.pick` scan rows, expandable player detail, and separate Observed Mock ADP presentation.
- Constitution rendering, table of contents, source content, and Markdown parsing.
- Bracket layout/cards, seed assignment, routing-related transforms, and score application.
- Sleeper transforms, official bracket resolution, player game status, stored matchup-history helpers, standings insights, playoff-race insights, and narratives.

Jest uses jsdom, React Testing Library, and MSW-backed fixtures. It excludes `frontend/tests/e2e/` through `frontend/jest.config.ts`.

### Node test runner

- Scoped JSON and SQLite matchup-history replacement across overlapping league/season/week values.
- Automatic migration of the known unscoped SQLite shape to the 2025 league/season identity.
- CLI selector validation, alternate-league season resolution, and malformed upstream matchup rejection before writes.
- Canonical draft-history traversal, alternate current-league selection, and league-chain cycle rejection.

### Playwright

- `smoke.spec.ts`: primary routes, desktop navigation, compact mobile navigation, Constitution anchors, the Grundle Ball header/footer, and a user-visible ESPN error.
- `production-boundary.spec.ts`: the production build has no Draft Intel navigation, route, UDK source, Keeper-Adjusted ADP, or mock-draft feature text, while local development retains the tool.
- `matchups.spec.ts`: mocked Sleeper/ESPN matchup data and week switching.
- `standings.spec.ts`: mocked 2026 preseason divisions without fabricated seeds or performance claims.
- `theme.spec.ts`: theme selection and persistence across reloads.
- Both Chromium desktop and the iPhone 12 device profile run for every Playwright invocation.

Most smoke checks target the configured deployment and therefore exercise its current API environment. The dedicated Matchups flow and ESPN error-path smoke intercept external API calls with fixtures for deterministic assertions.

## GitHub Actions behavior

- Both workflows use `actions/checkout@v7`, `actions/setup-node@v7`, and Node 24.x, matching the root package engine.
- `.github/workflows/lint.yml` runs root formatting, lint, and typechecks on pull requests, `release/**` pushes, and manual dispatch. The lint and typecheck commands cover both frontend and backend workspaces.
- `.github/workflows/test.yml` runs the frontend Jest CI suite, backend matchup-history store tests, and the production Vite build on pull requests, `release/**` pushes, and manual dispatch.
- The Playwright job runs on pushes to `release/**`, pull requests targeting `main`, and manual dispatch. It starts the checked-out app locally and runs Chromium desktop and iPhone 12 coverage against that exact commit.

For a release, require the release-branch CI run against the checked-out local application to pass before merging to `main`. Protected staging remains available as an optional environment check when `VERCEL_AUTOMATION_BYPASS_SECRET` is configured. After deployment, run the smoke suite against the production URL to verify the real deployment and external API access.

## Known gaps

- [ ] No Jest coverage thresholds or coverage-report artifact are configured.
- [ ] The deployment smoke suite does not mock every external request, so it is useful for environment verification but is not fully hermetic.
- [x] Maintained Markdown has automated internal-link and stale-brand checks through `npm run docs:check`.
- [ ] Production-route smoke results are operational steps, not a current CI job.

Track implementation work for these gaps in `ROADMAP.md` or the relevant frontend/backend TODO file rather than marking them complete here without test evidence.
