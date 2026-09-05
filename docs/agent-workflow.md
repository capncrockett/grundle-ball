# Agent development workflow

Grundle Ball is a companion dashboard. Favor small defect fixes, reliable data, and maintainable code within the requested scope. Roadmap ideas are possibilities, not an instruction to add fantasy-platform workflows.

The root [AGENTS.md](../AGENTS.md) owns repository conventions. [frontend/AGENTS.md](../frontend/AGENTS.md) and [backend/AGENTS.md](../backend/AGENTS.md) provide standard directory-scoped entry points. [frontend/WARP.md](../frontend/WARP.md) remains the detailed frontend index.

## Start a session

```bash
git status --short --branch
npm run doctor
```

The doctor checks the Node version declared in the root package, installed toolchain packages, native SQLite test support, release-branch/version agreement, Git hooks, and browser binary locations. Dirty work is reported for context; it is not a failure. Missing browser binaries are warnings because non-browser work can continue. The diagnostic does not install packages, change Git state, or contact external services.

For machine-readable output, use `npm run --silent doctor -- --json`. Exit code 1 means a required prerequisite failed. Browser startup and OS dependencies are proven by running Playwright, not by binary presence alone.

On a fresh checkout, use Node 24 and `npm ci` from the root. [TESTING.md](../TESTING.md) covers browser installation. Application development requires no Sleeper credentials, deployed backend, or production environment variables. Avoid reading `.env` values when checking setup; the local verification path does not need them.

## Verification commands

| Command                    | Scope                                                                                                                         |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `npm run verify:quick`     | Repository invariants, documentation, formatting, lint, TypeScript, and tooling tests                                         |
| `npm run verify`           | Quick checks plus frontend tests, backend tests, and production build                                                         |
| `npm run verify -- --e2e`  | Full verification including desktop/mobile Playwright and the production boundary; the browser script builds production first |
| `npm run verify -- --list` | Print the planned commands without executing them; also accepts `--quick` or `--e2e`                                          |
| `npm run repo:check`       | Root package/lockfile agreement and prohibited Unicode dash punctuation in maintained text                                    |
| `npm run docs:check`       | Internal Markdown targets/anchors and stale branding                                                                          |

Verification runs checks sequentially and stops with a nonzero exit code at the first failure. It prints the failing command and leaves subsequent checks unrun. It checks formatting without rewriting it, never installs dependencies, and never refreshes canonical history. Tests/builds write their normal ignored output. Fix formatting with `npm run format:write`, then recheck it.

Repository and documentation checks include untracked, non-ignored files and omit deleted files. New agent guides are checked before staging. CI runs the same underlying checks, including tooling tests and repository invariants.

The non-browser suite uses local fixtures. Playwright includes live-service smoke checks as well as deterministic route fixtures; distinguish an upstream/network failure from a code regression. Run the browser gate for visible UI changes, routing, build boundaries, and release handoffs. For a tiny documentation-only edit, the focused docs/repository checks are sufficient during iteration.

## Task map

All test paths below are relative to the frontend workspace. Run focused Jest tests as:

```bash
npm run test -w frontend -- --runInBand --runTestsByPath src/pages/MatchupsPage.integration.test.tsx src/components/matchups/MatchupCard.test.tsx
```

| Task                           | Start here                                                                                                                                                | Relevant existing tests                                                                                                                                                                                                |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Navigation or route            | [App.tsx](../frontend/src/App.tsx)                                                                                                                        | [App integration](../frontend/src/App.integration.test.tsx), [browser smoke](../frontend/tests/e2e/smoke.spec.ts)                                                                                                      |
| Matchup scores or availability | [MatchupsPage](../frontend/src/pages/MatchupsPage.tsx), [MatchupCard](../frontend/src/components/matchups/MatchupCard.tsx)                                | [Page](../frontend/src/pages/MatchupsPage.integration.test.tsx), [card](../frontend/src/components/matchups/MatchupCard.test.tsx), [browser week switching](../frontend/tests/e2e/matchups.spec.ts)                    |
| Standings or seeds             | [sleeperTransforms](../frontend/src/utils/sleeperTransforms.ts), [StandingsPage](../frontend/src/pages/StandingsPage.tsx)                                 | [Transforms](../frontend/src/utils/sleeperTransforms.test.ts), [page](../frontend/src/pages/StandingsPage.integration.test.tsx), [preseason browser flow](../frontend/tests/e2e/standings.spec.ts)                     |
| Official playoffs              | [resolveBracket](../frontend/src/sleeperBracket/resolveBracket.ts)                                                                                        | [Resolution](../frontend/src/sleeperBracket/resolveBracket.test.ts), [page](../frontend/src/pages/PlayoffsPage.integration.test.tsx)                                                                                   |
| Beta bracket                   | [bracket template](../frontend/src/bracket/template.ts), [routing rules](../frontend/src/bracket/routingRules.ts)                                         | [Seeding](../frontend/src/bracket/seedAssignment.test.ts), [grid](../frontend/src/components/bracket/BracketGrid.test.tsx), [live page](../frontend/src/pages/PlayoffsLivePage.integration.test.tsx)                   |
| Constitution or keeper rules   | [constitution source](../frontend/src/content/constitution.md), [keeper validation](../frontend/src/data/keeperRuleValidation.ts)                         | [Content parser](../frontend/src/content/parseConstitutionMarkdown.test.ts), [rule validation](../frontend/src/data/keeperRuleValidation.test.ts), [page](../frontend/src/pages/ConstitutionPage.integration.test.tsx) |
| Draft/keeper history           | [HistoryPage](../frontend/src/pages/HistoryPage.tsx), [history transforms](../frontend/src/data/draftHistoryTransforms.ts)                                | [Transforms](../frontend/src/data/draftHistoryTransforms.test.ts), [page](../frontend/src/pages/HistoryPage.integration.test.tsx)                                                                                      |
| Restricted Draft Intel         | [WARP data flow](../frontend/WARP.md#restricted-draft-intel), [access gate](../frontend/src/draftIntelAccess.ts), [Vite gate](../frontend/vite.config.ts) | Colocated calculation tests, [page](../frontend/src/pages/DraftIntelPage.integration.test.tsx), [production boundary](../frontend/tests/e2e/production-boundary.spec.ts)                                               |
| Stored history or refresh CLI  | [Backend guide](../backend/AGENTS.md)                                                                                                                     | `npm run test -w backend`; corresponding frontend history tests                                                                                                                                                        |
| Agent tooling or documentation | [Repository scripts](../scripts/verify.mjs)                                                                                                               | `npm run test:tooling`, `npm run repo:check`, `npm run docs:check`                                                                                                                                                     |

## Reviewable handoff

Inspect `git diff --check` and the final diff. Report the behavior changed, checks actually completed, and any unresolved failures. Preserve unrelated user edits. Commit only when asked, with the co-author trailer required by AGENTS.md; branch creation does not authorize a commit, push, merge, or deployment.

For a requested release, follow [versioning.md](versioning.md) and [deployment.md](deployment.md), verify the live base/branch state, and keep the root package and lockfile versions aligned. The doctor checks a named release branch; CI's repository check deliberately avoids branch-name assumptions because pull requests may run at a detached merge ref.
