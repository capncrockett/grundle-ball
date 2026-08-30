# Frontend Agent Guide

This file is the working index for `frontend/`. Read the root `AGENTS.md` first for repository conventions, skills, and naming rules.

All frontend code, content, tests, and documentation must follow the root prohibition on Unicode em dashes and en dashes. Use the ASCII hyphen-minus (`-`) instead.

## Product boundary

Grundle Ball is the Grundle League dashboard, not only a playoff visualizer. Its primary features are standings/insights, weekly matchups, the official Sleeper playoff bracket, and the league constitution.

The names around playoffs are intentionally distinct:

- `/playoffs` is the **official** bracket and mirrors Sleeper's `winners_bracket` and `losers_bracket` responses without custom routing.
- `/beta/grundle-bowl/*` is the **Grundle Bowl Beta**, which preserves the rejected Champ Bowl / Keeper Bowl / Toilet Bowl proposal.
- Keeper Bowl remains a legitimate middle-bracket and rule-history term inside that Beta proposal. It is not the application brand.

The 2026 vote is documented in `src/content/constitution.md` under “Rule & Vote History.”

## Current stack

- React 19.2, Vite 8.2, and TypeScript 5.9
- React Router 7.18
- Tailwind CSS 4.3 and DaisyUI 5.7
- ESLint 10 and Prettier 3.9
- Jest 30, React Testing Library 16, MSW 2.12, and Playwright 1.62
- Checked-in JSON matchup history with an optional local `better-sqlite3` maintenance adapter

## Commands

Run these from the repository root unless the command explicitly changes directory:

```bash
# Install all workspaces
npm install

# Vite development server (http://localhost:5173)
npm run dev -w frontend

# Production build and preview
npm run build -w frontend
npm run preview -w frontend

# Frontend + backend lint, or frontend only
npm run lint
npm run lint -w frontend

# Frontend + backend typecheck, or frontend only
npm run typecheck
npm run typecheck -w frontend

# Formatting
npm run format -w frontend
npm run format:write -w frontend

# Jest
npm run test -w frontend
npm run test:watch -w frontend
npm run test:ci -w frontend

# Playwright (configured deployment or local Vite)
npm run test:e2e -w frontend
npm run test:e2e:local -w frontend
npm run test:e2e:headed -w frontend

# Refresh selected matchup-history weeks
npm run fetch:matchups -w frontend -- --week=14
npm run fetch:matchups -w frontend -- --range=1-14

# Refresh canonical draft and keeper history
npm run fetch:drafts -w frontend
```

Matchup-history rows and replacement keys are scoped by league, season, and week. The checked-in snapshot contains labeled 2025 history; fetch commands can add 2026 weeks without overwriting the prior season.

See root `TESTING.md` for browser installation, CI triggers, and known gaps.

## Source map

```text
frontend/
├── public/docs/                       # Statically hosted constitution PDF
├── src/
│   ├── api/
│   │   ├── sleeper.ts                 # Typed Sleeper fetch functions
│   │   └── espn.ts                    # NFL scoreboard/game completion
│   ├── bracket/                       # Grundle Bowl Beta template/routing engine
│   │   ├── types.ts
│   │   ├── template.ts
│   │   ├── routingRules.ts
│   │   ├── seedAssignment.ts
│   │   └── state.ts
│   ├── components/
│   │   ├── bracket/                   # Beta board/grid/tile components
│   │   ├── common/                    # Shared toggles, selectors, avatars
│   │   ├── history/                   # Historical draftboard and keeper ledger
│   │   ├── matchups/                  # Weekly matchup cards
│   │   ├── sleeperBracket/            # Official Sleeper bracket board
│   │   ├── GrundleBowlBetaLayout.tsx
│   │   └── ThemeSelector.tsx
│   ├── config/league.ts               # Shared 2026 league ID and playoff weeks
│   ├── content/                        # Constitution Markdown + parser
│   ├── data/                           # Checked-in matchup/draft history + helpers
│   ├── draftIntel/                     # Local-only draft-pattern analysis
│   ├── models/fantasy.ts              # Internal team/matchup/season models
│   ├── pages/                          # Route components and insight logic
│   ├── sleeperBracket/                 # Official bracket resolution/types
│   ├── test/                           # Jest setup, MSW handlers, fixtures, helpers
│   └── utils/                          # Sleeper transforms and status/score helpers
├── tests/e2e/                          # Playwright smoke, matchup, theme specs
├── jest.config.ts
├── playwright.config.ts
└── vite.config.ts
```

## Routes

- `/` redirects to `/standings`.
- `/standings` shows ranked teams, league-specific seeds, division summaries, and playoff-race insights.
- `/playoffs` shows Sleeper's official winners and consolation brackets.
- `/matchups` shows a selectable week of scores and finished-starter counts.
- `/history` shows canonical annual draftboards and Team-specific keeper history.
- `/local/draft-intel` analyzes completed drafts for league and Team patterns. Vite includes this route only in the local development build, and the app also requires a localhost browser origin.
- `/constitution` renders the current Markdown constitution and links the hosted review-draft PDF.
- `/beta/grundle-bowl` redirects to `/beta/grundle-bowl/live`.
- `/beta/grundle-bowl/live` applies real playoff outcomes to the custom Beta bracket.
- `/beta/grundle-bowl/if-today` seeds the custom Beta bracket from current standings.
- Legacy `/playoffs/live` and `/playoffs/if-today` links redirect to the corresponding Beta routes.

The shared top navigation has six items: Standings, Playoffs, Matchups, History, Constitution, and Grundle Bowl (Beta). Local development adds Draft Intel.

## Runtime data flows

### Standings

1. Fetch league, users, and rosters from Sleeper.
2. `mergeRostersAndUsersToTeams()` resolves names, separate team/manager avatars, divisions, records, and points.
3. Before any completed games, render the Sleeper division assignments as preseason cards without ranks, seeds, ranges, or performance claims.
4. Once completed records exist, `computeSeeds()` applies the league-specific six-team playoff seeding rules.
5. Standings and playoff-race helpers derive displayed insights.
6. The checked-in `src/data/matchupHistoryStore.json` supplies latest stored margins used by best/worst and stat-correction insight logic only when its league and season match the active Sleeper league.

Standings does not query SQLite or a runtime backend. The checked-in rows are explicitly scoped to the 2025 league, so the 2026 page receives no history-derived stat-correction signal until a matching 2026 snapshot exists.

### Matchups

1. Fetch Sleeper NFL state and the all-players map.
2. For the selected week, fetch users, rosters, and matchups from Sleeper plus the ESPN NFL scoreboard.
3. `buildTeamGameStatusMap()` maps NFL teams to completed/not-completed.
4. `pairMatchups()` groups Sleeper rows and counts completed starters.
5. `buildLiveMatchData()` produces the actual-score data rendered by `MatchupCard`.

Projected totals and win probability are not currently part of `LiveMatchData`. The unused projection client is tracked as future work in root `ROADMAP.md`.

### Official playoffs

1. Fetch users, rosters, `winners_bracket`, and `losers_bracket` from Sleeper.
2. Build the roster-to-team display map.
3. `resolveBracketMatchups()` resolves direct participants, winner/loser placeholders, results, and placement metadata.
4. `SleeperBracketBoard` uses the Beta boards' proven three-column sizing, vertical distribution, card geometry, and responsive SVG winner connectors while leaving Sleeper's matchup graph untouched. Loser-fed placement games remain explicit without adding crossing connector clutter.

Do not feed official bracket data through the custom `bracket/` routing engine.

### Draft and keeper history

1. Import completed seasons from `src/data/draftHistoryStore.json`.
2. Refresh the active league's canonical `draft_id`, picks, users, and rosters from Sleeper.
3. Normalize both paths with `buildDraftHistorySeason()`.
4. Render the selected season through `DraftBoard` and group `is_keeper` picks by Team/player through `KeeperHistory`.

The archive follows `previous_league_id` and uses each league record's `draft_id`, which excludes abandoned draft setup records. Current keeper designations remain labeled provisional until the draft is complete. Keeper history uses Sleeper roster ID as the persistent Team key rather than Manager identity.

### Local Draft Intel

1. Import completed seasons from `src/data/draftHistoryStore.json`.
2. Exclude Keeper Designations, the locally selected user's Team, and constrained 2024-2025 IDP selections.
3. Derive league-wide and Team-level roster construction, timing, opening-round, and NFL-team affinity patterns.
4. Label signals from fewer than three applicable drafts as emerging.
5. Sort by fantasy relevance before confidence: RB/WR, IDP, QB/TE, NFL-team affinity, then K/DEF.

The route and navigation are compiled only for `vite serve` and require a localhost origin at runtime. They are absent from Vercel and other production builds. This is a deployment visibility boundary, not user authentication. IDP evidence begins with completed 2026 drafts, after Sleeper's 1QB IDP ADP became usable. Rookie patterns remain unavailable until the stored archive records rookie status.

### Grundle Bowl Beta

1. Fetch users/rosters and compute internal teams/seeds.
2. Start from a cloned `BRACKET_TEMPLATE`.
3. `assignSeedsToBracketSlots()` populates initial positions.
4. Live mode converts Sleeper playoff results with `toBracketGameOutcomes()` and applies them through `applyGameOutcomesToBracket()` plus `ROUTING_RULES`.
5. `Bracket` renders the Champ, Keeper, and Toilet boards.

`BRACKET_TEMPLATE` contains 18 slots across the three boards. Never mutate the exported template.

## Beta bracket layout and routing

`BracketGrid` combines CSS Grid for equal-width round columns with Flexbox inside each column. It:

- Renders real slots, ghost/spacer cards, and masked BYE views.
- Derives visible winner connector curves from `ROUTING_RULES`.
- Supports manual connectors for layout-only items such as BYE cards.
- Recomputes SVG Bezier paths with `ResizeObserver`, `requestAnimationFrame`, window resize, and mode changes.

The connector renderer does not consistently show loser or cross-board movement; that gap is documented in `ROADMAP.md`.

`BracketTile` owns card presentation only:

- Mobile and desktop typography/layout.
- Score and reward modes.
- Team highlighting.
- BYE/TBD placeholders.
- Reward/destination copy derived from slot and route metadata.

`ChampBracket`, `KeeperBracket`, and `ToiletBracket` declare column titles, subtitles, item order, Flexbox justification classes, ghost content, and height classes. Keep layout in these declarations rather than embedding API or seeding logic in presentation components.

Example of the current column interface:

```typescript
const columns: BracketLayoutColumn[] = [
  {
    title: 'Round 1',
    subtitle: 'Week 15',
    itemsContainerClassName: 'justify-between',
    items: [
      { id: 'game-1', slotId: 'champ_r1_g1' },
      {
        id: 'bye-1',
        slotId: 'champ_r2_g1',
        maskOppIndex: 1,
        titleOverride: 'BYE',
        connectorToSlotId: 'champ_r2_g1',
      },
    ],
  },
];
```

The old `topPct`, `centerOnPct`, and `heightScale` layout properties do not exist in the current interface.

## Common implementation patterns

### Fetch Sleeper data

Use relative imports; no `@/` path alias is configured:

```typescript
import {
  getLeagueRosters,
  getLeagueUsers,
  getLosersBracket,
  getWinnersBracket,
} from '../api/sleeper';
```

Keep public response types in `api/sleeper.ts`, transformations in `utils/` or `sleeperBracket/`, and rendering concerns in components/pages.

### Modify the Grundle Bowl Beta structure

1. Add or change a typed `BracketSlotId` in `bracket/types.ts`.
2. Update `BRACKET_TEMPLATE` in `bracket/template.ts`.
3. Update `ROUTING_RULES` if advancement changes.
4. Update the relevant Champ/Keeper/Toilet column declaration.
5. Update seed, state/routing, grid/tile, and page tests as applicable.
6. Keep the feature labeled Beta and do not imply the league adopted its rules.

### Modify the official playoff view

Treat Sleeper bracket nodes as the source of truth. Changes normally belong in:

- `api/sleeper.ts` for the raw response shape.
- `sleeperBracket/resolveBracket.ts` for generic resolution/labels.
- `components/sleeperBracket/SleeperBracketBoard.tsx` for rendering.
- `pages/PlayoffsPage.tsx` for fetch/loading/error/empty orchestration.

Do not encode the Beta bracket's custom destinations into this path.

### Edit the constitution

- Edit `src/content/constitution.md`; it is the current rules source of truth and is PR-reviewed.
- Keep implementation details out of the constitution.
- Update parser/content/page tests when changing supported Markdown structures or anchors.
- The current review-draft PDF is `public/docs/Grundle_League_Constitution_2026_REVIEW_DRAFT_v2.pdf`; root `docs/` holds the archival copies.

### Style UI

- Prefer DaisyUI components and Tailwind Grid/Flex utilities over new custom chrome.
- Preserve dense information and responsive behavior.
- Use hard positioning only when the bracket connector/anchor geometry genuinely requires it.
- The current selectable themes are Cupcake, Retro, Dim, and Dracula; `ThemeSelector.tsx` owns persistence.
- The main mobile/desktop switch is Tailwind's `md:` breakpoint (768px).

## Testing

The current suite includes:

- Unit tests for bracket seeding, transforms, official bracket resolution, stored history, player status, insights, and constitution parsing.
- Component tests for Beta bracket grid/tiles and matchup cards.
- Page integration tests for Standings, Matchups, official Playoffs, both Beta views, and Constitution, including representative loading/error paths.
- History page integration tests for season switching, draftboard keeper markers, current Team designation cards, and the keeper ledger.
- App routing/navigation tests and Playwright desktop/mobile smoke, preseason standings, matchup, and theme flows.

Use MSW/fixtures for deterministic Jest coverage. Playwright's deployment smoke intentionally checks a live environment, while its dedicated Matchups flow uses route fixtures. Root `TESTING.md` is the authoritative command/CI/gap guide.

## Configuration and backend notes

- `src/config/league.ts` exports the confirmed 2026 league ID (`1385053148233621511`) for every frontend page and the Playwright Matchups test, plus Weeks 15-17 for the Beta playoff pages.
- `backend/scripts/updateMatchupHistory.ts` imports that same `LEAGUE_ID` as its default and retains `--league=<id>` as an explicit override.
- `backend/scripts/updateDraftHistory.ts` follows the linked league chain from that same default and rewrites the canonical draft archive.
- `VITE_LEAGUE_ID` is not supported. If league selection becomes environment-configurable, design the Vite and Node configuration boundary together rather than creating two independent defaults.
- The browser imports the checked-in JSON matchup history and filters it by the active Sleeper league ID and season.
- The browser imports checked-in canonical draft history and overlays the active season with live Sleeper data.
- The backend script resolves the selected league's season and defaults to replacing that scoped week in the JSON file.
- `MATCHUP_STORE=sqlite` selects an optional local SQLite store for the maintenance script; it does not change frontend reads.
- Hosted persistence, scheduling, and runtime API decisions live in `backend/TODO.md`.

## Current work tracking

- Root `ROADMAP.md`: release verification, configuration, Beta polish, and future matchup features.
- Root `ROADMAP.md`: coordinated ESLint/Jest/Vite/TypeScript major-version migrations and their full validation gate.
- Root `TESTING.md`: verified coverage and test-infrastructure gaps.
- `TODO.md`: frontend configuration and optional style cleanup.
- `../backend/TODO.md`: hosted history-store and automation work.
