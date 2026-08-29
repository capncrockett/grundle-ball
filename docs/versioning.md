# Versioning and Release Policy

Grundle Ball uses semantic versioning for the application as a whole. This policy was adopted with release **2.1.0** on `release/2.1.0`.

The root `package.json` `version` is the repository's canonical release version. Workspace package versions do not represent independent product releases. Release branches use `release/MAJOR.MINOR.PATCH`; `r2.1.0` is acceptable shorthand for release 2.1.0.

## Governing rule

> Version the declared public contract, not the private implementation.

The declared public contract includes behavior relied on by users, league administrators, deployers/operators, and documented downstream consumers. Examples include workflows, routes and bookmarks, permissions, required inputs, exports and reports, the meaning of displayed values or statuses, documented APIs, and required deployment sequencing.

An internal frontend, API, or database change is not automatically breaking. Its version impact comes from what users or operators must change because of it.

## Choosing the version bump

| Change type                                          |              Bump | Use when                                                                                                                               |
| ---------------------------------------------------- | ----------------: | -------------------------------------------------------------------------------------------------------------------------------------- |
| Incompatible change to declared public behavior      |         **Major** | Existing users, administrators, operators, or downstream consumers must adapt because supported behavior no longer works the same way. |
| Backward-compatible public or operational capability |         **Minor** | The app gains a feature or operator capability while existing behavior continues to work.                                              |
| Backward-compatible defect correction                |         **Patch** | Incorrect behavior is corrected without intentionally changing the public contract.                                                    |
| Internal refactor invisible to users and operators   | **Usually patch** | Implementation, dependencies, logging, indexing, or performance change without an intentional public or operational behavior change.   |

Examples:

- **Major:** remove a supported workflow, break old URLs, rename depended-on export columns, change required fields, remove a report, or change the meaning of a result.
- **Minor:** add a page, report, dashboard card, optional field, admin action, notification, or controllable background process.
- **Patch:** fix an incorrect calculation, broken validation, display defect, race condition, session defect, failed export, or bad-data handling.

When one release contains several kinds of change, use the highest bump required by any declared public or operational change.

## API and database cases

| Case                                                                                            |                                                                      Expected bump |
| ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------: |
| Internal API changes while the frontend is updated with it and public behavior stays compatible |                                                                          **Patch** |
| Database schema change supporting a bug fix or internal cleanup                                 |                                                                          **Patch** |
| Database schema change supporting a new backward-compatible feature                             |                                                                          **Minor** |
| Migration requiring manual sequencing, configuration, downtime, or a backfill                   |      **Minor**, or **Major** if it materially disrupts existing operators or users |
| Depended-on export or report format changes incompatibly                                        |                                                                          **Major** |
| Export or report gains a new optional trailing column                                           |                                                                          **Minor** |
| Incorrect report values are corrected                                                           | **Patch**, unless the correction necessarily breaks a declared downstream contract |

Database migrations must be assessed twice: once for product behavior and once for the operational contract. Record required sequencing, backfills, downtime, rollback, and recovery in release notes. A technically incompatible private schema or endpoint change can remain a patch when it is deployed atomically and nobody outside the implementation boundary must adapt.

## Release workflow

1. Classify the intended public and operational impact before selecting the release number.
2. Branch from `main` as `release/MAJOR.MINOR.PATCH`.
3. Set the matching version in the root `package.json` and refresh `package-lock.json`.
4. Keep release notes focused on user-visible behavior, operator actions, compatibility, and migrations; internal detail may be summarized separately.
5. Run the required checks and release flow in [`deployment.md`](deployment.md) before merging the release branch to `main`.
6. If Git tags or hosted releases are added, their version must match the root package version; a separate tag naming convention should be documented before first use.

If impact is ambiguous, write down who must adapt and what they must do. That concrete effect determines the bump more reliably than the size of the code change.
