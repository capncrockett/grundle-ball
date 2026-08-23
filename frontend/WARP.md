# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

Playoff bracket visualization UI for a Sleeper fantasy football keeper league (Grundle). The app visualizes three interrelated brackets (Champ Bowl, Keeper Bowl, Toilet Bowl) with custom routing rules where losers from Champ Bowl flow into Keeper Bowl, and winners from Toilet Bowl feed into Keeper Bowl.

**Current State:** Fully functional React SPA with Live + If-Today playoff modes, matchups, standings, and a Constitution page for in-repo league rules. Responsive design with mobile-optimized layouts. Direct calls to Sleeper public APIs. Backend proxy may be added later (caching/rate-limiting).

**Repo agent docs:** See root `AGENTS.md` for skills, glossary/ADR locations, and conventions. Domain terminology work uses `.agents/skills/grill-with-docs` and writes `CONTEXT.md` / `docs/adr/` at the repo root.

## Tech Stack

- React 19.2 + Vite 7.2 + TypeScript 5.9
- Tailwind CSS 4.1 + DaisyUI 5.5
- react-router-dom 7.9 for routing
- ESLint 9 + Prettier 3.6
- Testing: Jest 29 + React Testing Library 16 + Playwright 1.49
- Data: SQLite (better-sqlite3) for matchup history caching

## Development Commands

```bash
# Install dependencies
npm install

# Run dev server (default: http://localhost:5173)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint TypeScript files
npm run lint

# Format check
npm format

# Format and write
npm run format:write

# Run Jest tests
npm test

# Run Jest in watch mode
npm run test:watch

# Run Playwright E2E tests (against deployed staging)
npm run test:e2e

# Run Playwright E2E tests locally
npm run test:e2e:local

# Fetch matchup history from Sleeper (backend script)
npm run fetch:matchups
```

## Code Architecture

### Directory Structure

```
src/
├── api/
│   └── sleeper.ts                    # Sleeper API client (typed fetch wrappers + playoff bracket endpoints)
├── bracket/
│   ├── types.ts                      # BracketSlot, BracketSlotId, Position types
│   ├── template.ts                   # BRACKET_TEMPLATE (immutable structure)
│   ├── routingRules.ts               # ROUTING_RULES (winner/loser flows)
│   ├── seedAssignment.ts             # assignSeedsToBracketSlots()
│   └── state.ts                      # applyGameOutcomesToBracket() routing engine
├── components/
│   ├── bracket/
│   │   ├── Bracket.tsx               # Main container (3 sub-brackets)
│   │   ├── BracketGrid.tsx           # Shared grid layout with SVG connectors
│   │   ├── BracketTile.tsx           # Responsive matchup card (mobile minimal/desktop rich)
│   │   ├── ChampBracket.tsx          # Champ Bowl layout definition
│   │   ├── KeeperBracket.tsx         # Keeper Bowl layout definition
│   │   ├── ToiletBracket.tsx         # Toilet Bowl layout definition
│   │   └── BracketMatchShell.tsx     # Wrapper with anchors for connectors (embedded in BracketGrid)
│   ├── common/
│   │   └── TeamAvatars.tsx           # Reusable team avatar component
│   ├── matchups/
│   │   └── MatchupCard.tsx           # Weekly matchup results card
│   └── ThemeSelector.tsx             # DaisyUI theme switcher (light/dark/cupcake/synthwave)
├── content/
│   ├── constitution.md               # League constitution source of truth (markdown)
│   ├── constitution.ts               # Parsed document + TOC helpers
│   └── parseConstitutionMarkdown.ts  # Lightweight markdown -> document AST
├── data/
│   ├── matchupHistory.ts             # Read matchup history from JSON store
│   ├── matchupHistoryTypes.ts        # Types for matchup history data
│   └── matchupHistoryStore.json      # Cached matchup data (updated via backend script)
├── models/
│   └── fantasy.ts                    # Team, PairedMatchup domain types
├── pages/
│   ├── PlayoffsIfTodayPage.tsx       # Preview bracket (seeded from current standings)
│   ├── PlayoffsLivePage.tsx          # Live playoff bracket (real game outcomes)
│   ├── MatchupsPage.tsx              # Weekly matchup results
│   ├── StandingsPage.tsx             # Season standings table
│   ├── ConstitutionPage.tsx          # League constitution with TOC + anchors
│   ├── narratives.tsx                # Narrative text generation for insights
│   ├── playoffRaceInsights.ts        # Playoff race analysis logic
│   └── standingsInsights.ts          # Standings insights and division analysis
├── test/
│   ├── fixtures/                     # Test data (Sleeper API mocks, teams, matchups)
│   ├── mocks/                        # MSW handlers and API mocks
│   ├── __mocks__/                    # Module mocks (incl. raw markdown import mock)
│   ├── setupTests.ts                 # Jest/RTL configuration
│   ├── server.ts                     # MSW server setup
│   └── testUtils.tsx                 # Test helpers (renderWithRouter, etc.)
└── utils/
    ├── sleeperTransforms.ts          # Sleeper data -> Teams, seeds, standings
    ├── sleeperPlayoffTransforms.ts   # Sleeper playoff matchups -> BracketGameOutcomes
    ├── applyMatchupScores.ts         # Apply current/projected points to bracket slots
    └── playerGameStatus.ts           # Player status tracking (finished/yet to play)
```

### Bracket Engine (Most Critical System)

The bracket system is **data-driven and immutable**. Understanding this is key to making changes.

#### Core Files

- `bracket/types.ts` - Type definitions for slots, routing rules, team references
- `bracket/template.ts` - `BRACKET_TEMPLATE`: declarative structure of all 15 playoff slots across 3 brackets
- `bracket/routingRules.ts` - `ROUTING_RULES`: defines winner/loser movement between slots (e.g., Champ R1 loser -> Keeper Floater)
- `bracket/seedAssignment.ts` - `assignSeedsToBracketSlots()`: places teams into initial bracket positions
- `bracket/state.ts` - `applyGameOutcomesToBracket()`: immutable routing engine that applies game results

#### How It Works

1. Fetch Sleeper users/rosters -> compute standings -> assign seeds 1-12
2. Start with `BRACKET_TEMPLATE` (immutable baseline structure)
3. Call `assignSeedsToBracketSlots(teams)` to populate initial positions
4. For live playoffs: apply real game outcomes via `applyGameOutcomesToBracket(slots, outcomes)`
5. Render via `<Bracket />` component

**Key Principle:** Never mutate `BRACKET_TEMPLATE`. Always clone slots before applying outcomes.

#### Bracket Structure

- **Champ Bowl**: Seeds 1-6, traditional bracket with R1 -> R2 -> Finals + 3rd place
- **Keeper Bowl**: Fed by Champ Bowl losers and Toilet Bowl winners. Contains Floater/Splashback games leading to 5th-8th place
- **Toilet Bowl**: Seeds 7-12, bottom bracket with R1 -> R2 -> Poop King final + placement games

### Data Flow

```
Sleeper API -> sleeperTransforms.ts -> Team models -> bracket/seedAssignment.ts -> BracketSlot[]
                                                                                      ↓
                                                                            Bracket components
```

**Important Transforms:**

- `mergeRostersAndUsersToTeams()` in `utils/sleeperTransforms.ts` - combines raw Sleeper data into `Team` objects
- `computeSeeds()` - converts standings rank to playoff seeds with custom tiebreakers
- `assignSeedsToBracketSlots()` - maps seeds to bracket positions

### Components

#### Bracket Components

- `<Bracket />` - Main container that organizes 3 sub-brackets with mode toggle (score/reward)
- `<BracketGrid />` - Shared layout engine with dynamic SVG connector paths
  - Uses flexbox column layout with responsive gaps
  - Embeds `<BracketMatchShell />` for connector anchors
  - Computes connector paths via ResizeObserver + requestAnimationFrame
  - Maps layout definitions to rendered `<BracketTile />` components
  - Supports manual connectors (via `connectorToSlotId`) and automatic routing-based connectors
- `<BracketTile />` - Fully responsive matchup card with two modes:
  - **Mobile (<768px)**: Minimal Sleeper-style design (avatar + name + score only)
  - **Desktop (≥768px)**: Rich cards with seed, record, reward text, and detailed layout
  - Supports reward outcome parsing and conditional rendering
- `<ChampBracket />`, `<KeeperBracket />`, `<ToiletBracket />` - Define layout structures (columns, items, ghost content)
  - Support ghost cards for BYE/TBD placeholders
  - Include mobile reward title overrides
  - Use subtitle text for round context
- `<BracketMatchShell />` - Embedded in BracketGrid, provides top/bottom anchors for connectors
- `<MatchupCard />` - Used in matchups page for weekly results
- `<ThemeSelector />` - DaisyUI theme picker with localStorage persistence
- `<TeamAvatars />` - Reusable component for rendering team avatars with various sizes

### Pages

- `/playoffs/if-today` - Preview bracket seeded from current standings
  - Includes playoff race insights (clinch scenarios, magic numbers)
  - Shows division standings and narratives
  - Team selector and mode toggle (score/reward)
- `/playoffs/live` - Real playoff bracket with live game outcomes from Sleeper
  - Fetches NFL state to determine current playoff week
  - Shows live scores with BYE week totals
  - Conditionally resolves round outcomes based on current week
- `/matchups` - Weekly matchup results with week selector
  - Uses matchup history from cached JSON store
  - Shows head-to-head matchups with scores
- `/standings` - Season standings table with division insights
  - Shows clinch status, elimination status, magic numbers
  - Division-specific insights and narratives
  - Handles leagues with/without divisions gracefully
- `/constitution` - Grundle League Constitution 2026 Edition (static, in-repo markdown)
  - Source: `src/content/constitution.md` (edit via PR; 2026 PDF + legacy docx archived under `docs/`)
  - Hosted PDF download/open link: `/docs/Grundle_League_Constitution_2026_REVIEW_DRAFT_v2.pdf` (from `frontend/public/docs/`)
  - Renders title, sticky table of contents, nested section anchors, and markdown tables
  - Lightweight custom markdown parser (no extra markdown dependency)
  - Top-nav link labeled Constitution (nav currently has 5 items)

**Both playoff pages share:**

- Mode toggle: Score view (shows current/projected points) vs Reward view (shows prize text)
- Team selector: Highlight a specific team across the bracket
- Responsive layout: Mobile-first design with desktop enhancements

## Current Development Phase

**Phase 7 (IN PROGRESS):** Testing + Release

- ✅ Jest + React Testing Library configured
- ✅ Unit tests for utilities (transforms, bracket routing, insights)
- ✅ Integration tests for all pages (including Constitution)
- ✅ Playwright E2E smoke tests (desktop + mobile; includes `/constitution`)
- ✅ MSW mocks for Sleeper API
- ✅ Test fixtures and helpers
- ✅ CI integration (Jest on every PR, Playwright on release branches)
- ✅ Constitution page + in-repo rules source of truth
- [ ] Complete smoke testing of all routes on staging after deploy
- [ ] Verify error surfacing
- [ ] Deploy to production

**Active follow-on:** Domain terminology cleanup (glossary via root `CONTEXT.md`, grill-with-docs skill).

**Phase 3.3 (COMPLETE):** Bracket Connectors

- ✅ SVG connector paths using Bezier curves
- ✅ Dynamic path computation with ResizeObserver
- ✅ Champ Bowl connectors
- ✅ Toilet Bowl Round 1 connectors
- ✅ Manual connector support for ghost items

**Phase 6 (COMPLETE):** Visual Overhaul

- ✅ Reward outcome parsing in BracketTile
- ✅ Ghost content support in BracketGrid
- ✅ Mobile reward title overrides
- ✅ Layout improvements and alignment fixes
- ✅ Column subtitles and round labels

**Phase 5 (COMPLETE):** Insights + Data Layer

- ✅ Matchup history caching (SQLite via backend script)
- ✅ Playoff race insights (clinch/elimination/magic numbers)
- ✅ Division standings insights
- ✅ Narrative text generation
- ✅ Player game status tracking

**Phase 4 (COMPLETE):** Live Playoffs Mode

- ✅ Sleeper winners_bracket/losers_bracket endpoints integrated
- ✅ `toBracketGameOutcomes()` transform implemented
- ✅ Live bracket page with real game outcomes
- ✅ Full responsive design (mobile + desktop)
- ✅ NFL state fetching for current week resolution
- ✅ BYE week totals in live brackets

## Testing & Quality

**Testing Stack:**

- **Jest 29** with ts-jest for unit/integration tests
- **React Testing Library 16** for component testing
- **Playwright 1.49** for E2E smoke tests
- **MSW 2.12** for API mocking

**Running Tests:**

```bash
# Run Jest tests
npm test

# Run Jest in watch mode
npm run test:watch

# Run Jest in CI mode
npm run test:ci

# Run Playwright E2E tests (against staging)
npm run test:e2e

# Run Playwright E2E tests locally
npm run test:e2e:local

# Run linting
npm run lint
```

**Test Coverage:**

- Unit tests: Bracket routing, seed assignment, transforms, insights logic, constitution markdown parser
- Integration tests: All pages (Playoffs If Today, Live, Matchups, Standings, Constitution)
- Component tests: BracketTile, BracketGrid, MatchupCard
- E2E tests: Navigation (5 nav links), route content including `/constitution`, TOC anchors, mobile viewports, theme toggle

See `TESTING.md` in the root directory for detailed testing strategy.

## Important Notes

- **League ID:** Hardcoded in pages (look for `LEAGUE_ID` constants). Consider moving to environment variables for multi-league support.
- **Data Caching:** Matchup history is cached in `frontend/src/data/matchupHistoryStore.json` via the `backend/scripts/updateMatchupHistory.ts` script. Run `npm run fetch:matchups` to update.
- **Sleeper API Rate Limits:** Matchup data is now cached. Live playoff data and current week data are fetched directly.
- **Routing Rules:** Changes to playoff bracket flow require updating `ROUTING_RULES` in `bracket/routingRules.ts`. These rules drive the SVG connector paths.
- **Connectors:** SVG paths are computed dynamically using ResizeObserver and requestAnimationFrame. Paths update on resize and mode toggle.
- **BYE Handling:** Ghost cards and `maskOppIndex` allow for flexible BYE/TBD display without altering slot data.
- **Responsive Design:** The app uses Tailwind breakpoint `md:` (768px) to switch between mobile and desktop layouts. All spacing, text sizes, and card layouts adapt at this breakpoint.
- **Theme System:** Uses DaisyUI themes with localStorage persistence. Current themes: light, cupcake, synthwave, dark.
- **Insights:** Playoff race insights use narrative generation and division-aware logic. Handles leagues without divisions gracefully.
- **Testing:** All critical paths have test coverage. Use `data-testid` attributes for stable E2E selectors.
- **Constitution content:** Edit `src/content/constitution.md` only. Current archive: `docs/Grundle_League_Constitution_2026_REVIEW_DRAFT_v2.pdf` (legacy: `docs/Grundle Constitution v2.docx`). Jest maps `*.md?raw` via `src/test/__mocks__/rawMarkdown.ts`.
- **Agent skills / glossary:** Repo-level skill copies live in `../.agents/skills/` (see root `AGENTS.md`). Terminology work should update root `CONTEXT.md` and optional `docs/adr/`.

## Common Patterns

### Adding a New Bracket Slot

1. Add new `BracketSlotId` to `bracket/types.ts`
2. Add slot definition to `BRACKET_TEMPLATE` in `bracket/template.ts`
3. Add routing rules to `ROUTING_RULES` in `bracket/routingRules.ts`
4. Update relevant bracket layout definition in `ChampBracket.tsx`/`KeeperBracket.tsx`/`ToiletBracket.tsx`
   - Add item to appropriate column with `slotId` and `topPct` positioning
   - Optionally set `centerOnPct: true` for vertical centering

### Fetching Sleeper Data

```typescript
import {
  getLeagueUsers,
  getLeagueRosters,
  getWinnersBracket,
  getLosersBracket,
} from '@/api/sleeper';

// For If-Today mode (standings-based)
const users = await getLeagueUsers(leagueId);
const rosters = await getLeagueRosters(leagueId);

// For Live mode (actual playoff results)
const winnersBracket = await getWinnersBracket(leagueId);
const losersBracket = await getLosersBracket(leagueId);
```

### Building Teams from Sleeper Data

```typescript
import { mergeRostersAndUsersToTeams, computeSeeds } from '@/utils/sleeperTransforms';

const teams = mergeRostersAndUsersToTeams(rosters, users);
const teamsWithSeeds = computeSeeds(teams);
```

### Applying Live Playoff Outcomes

```typescript
import { assignSeedsToBracketSlots } from '@/bracket/seedAssignment';
import { applyGameOutcomesToBracket } from '@/bracket/state';
import { BRACKET_TEMPLATE } from '@/bracket/template';
import { ROUTING_RULES } from '@/bracket/routingRules';
import { toBracketGameOutcomes } from '@/utils/sleeperPlayoffTransforms';

// Start with template + seed assignment
const initialSlots = assignSeedsToBracketSlots([...BRACKET_TEMPLATE], teams);

// Convert Sleeper playoff data to outcomes
const outcomes = toBracketGameOutcomes(winnersBracket, losersBracket);

// Apply routing
const liveSlots = applyGameOutcomesToBracket(initialSlots, outcomes, ROUTING_RULES);
```

### Working with BracketGrid Layouts

```typescript
import type { BracketLayoutColumn } from '@/components/bracket/BracketGrid';

// Define column structure
const columns: BracketLayoutColumn[] = [
  {
    title: 'Round 1',
    items: [
      { id: 'r1-g1', slotId: 'champ_r1_g1', topPct: 20 },
      { id: 'r1-g2', slotId: 'champ_r1_g2', topPct: 60 },
    ],
  },
  {
    title: 'Round 2',
    items: [{ id: 'r2-g1', slotId: 'champ_r2_g1', topPct: 40, centerOnPct: true }],
    heightScale: 1.2, // Stretch vertical spacing
  },
];
```

## Backend

The `backend/` directory contains data management scripts:

- `backend/scripts/updateMatchupHistory.ts` - Fetches all matchup data from Sleeper and writes to `frontend/src/data/matchupHistoryStore.json`
- `backend/matchupHistoryStore.ts` - SQLite-based matchup history store (used by update script)
- `backend/TODO.md` - Backend work tracking (cron jobs, DB migration, etc.)

Run the update script via: `npm run fetch:matchups` (from frontend directory).

## Roadmap Context

Refer to `/ROADMAP.md` (parent directory) for detailed phase breakdowns. Phases 0-6 are complete. Current focus is Phase 7 (Testing + Release).

Refer to `/TESTING.md` for comprehensive testing strategy and tooling details.
