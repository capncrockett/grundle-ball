# Frontend agent entry point

Read the root [AGENTS.md](../AGENTS.md) and [WARP.md](WARP.md) before non-trivial frontend work. WARP remains the detailed architecture index for existing tools and links.

## Find the right boundary

- Route orchestration lives in [src/pages](src/pages/MatchupsPage.tsx); shared navigation and routes live in [App.tsx](src/App.tsx).
- API response types and fetch functions live in [Sleeper](src/api/sleeper.ts) and [ESPN](src/api/espn.ts). Keep transforms and pure calculations outside React components.
- Official playoff resolution lives in [sleeperBracket](src/sleeperBracket/resolveBracket.ts); the separate [bracket engine](src/bracket/state.ts) belongs to Grundle Bowl Beta.
- Public draft/keeper history and restricted Draft Intel have different build and runtime boundaries. Read WARP's relevant data flow before touching either.

## Verify the changed behavior

Run commands from the repository root. The [task map](../docs/agent-workflow.md#task-map) pairs entry points with focused tests.

- Use the existing [MSW handlers](src/test/mocks/handlers.ts), [Sleeper fixtures](src/test/fixtures/sleeper.ts), and [ESPN fixtures](src/test/fixtures/espn.ts) for deterministic page tests.
- Use [renderWithRouter](src/test/testUtils.tsx) for components requiring router context.
- Preserve score/zero/error/empty states when changing API orchestration. Secondary service failures should degrade the dependent information without erasing valid primary data.
- For visible layout changes, check desktop and mobile in a browser. Private-tool changes also require the production-boundary Playwright project.
- Run `npm run verify:quick` during iteration and `npm run verify` before handoff. Include `-- --e2e` for the full browser gate when appropriate to the change or release.

Never run history-fetch commands merely to exercise a page. They rewrite canonical snapshots; fixtures cover ordinary development.
