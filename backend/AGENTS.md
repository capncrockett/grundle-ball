# Backend maintenance agent entry point

Read the root [AGENTS.md](../AGENTS.md). This workspace contains maintenance tooling, not a deployed API server. The frontend reads checked-in JSON.

## Change boundaries

- [matchupHistoryStore.ts](matchupHistoryStore.ts) provides JSON and optional local SQLite adapters. Every replacement is scoped by league, season, and week; Team identity must not cross those scopes.
- [updateMatchupHistory.ts](scripts/updateMatchupHistory.ts) validates selectors and resolves the selected league's season before writing.
- [updateDraftHistory.ts](scripts/updateDraftHistory.ts) follows linked leagues and their canonical `draft_id`, excluding abandoned draft records.
- Both updaters share the frontend's [league configuration](../frontend/src/config/league.ts). Keep explicit `--league` overrides working.
- Stored-history and keeper terminology lives in [CONTEXT.md](../CONTEXT.md). Persistence behavior lives in [data-model.md](../docs/data-model.md).

## Verification

From the repository root:

```bash
npm run test -w backend
npm run lint -w backend
npm run typecheck -w backend
```

Use Node 24 and the existing temporary JSON/SQLite fixtures. `npm run doctor` checks the native SQLite module without opening a disk database. Tests must not rewrite checked-in snapshots or fetch live league data.

Before handoff, run `npm run verify`. If a requested task refreshes history, inspect the generated diff for the intended league/season/week and run the relevant frontend history tests too. The [task map](../docs/agent-workflow.md#task-map) lists them.

[TODO.md](TODO.md) records possible hosted-storage work. It is not authorization to add a database, service, scheduler, or migration to a maintenance fix.
