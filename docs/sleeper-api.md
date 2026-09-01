# External API Notes

Grundle Ball reads league data directly from Sleeper in the browser. The Matchups page also reads ESPN's NFL scoreboard to determine whether starters' games are complete.

The typed clients are `frontend/src/api/sleeper.ts` and `frontend/src/api/espn.ts`. Keep this document aligned with those clients rather than documenting speculative endpoints.

## Sleeper base URL

```text
https://api.sleeper.app/v1
```

## Sleeper endpoints in use

| Purpose                      | Path                                  | Client function              |
| ---------------------------- | ------------------------------------- | ---------------------------- |
| League metadata/settings     | `/league/<league_id>`                 | `getLeague()`                |
| Rosters                      | `/league/<league_id>/rosters`         | `getLeagueRosters()`         |
| Users/managers               | `/league/<league_id>/users`           | `getLeagueUsers()`           |
| Weekly matchups              | `/league/<league_id>/matchups/<week>` | `getLeagueMatchupsForWeek()` |
| Official winners bracket     | `/league/<league_id>/winners_bracket` | `getWinnersBracket()`        |
| Official consolation bracket | `/league/<league_id>/losers_bracket`  | `getLosersBracket()`         |
| Draft or exact mock metadata | `/draft/<draft_id>`                   | `getDraft()`                 |
| Draft picks and keepers      | `/draft/<draft_id>/picks`             | `getDraftPicks()`            |
| NFL state                    | `/state/nfl`                          | `getNFLState()`              |
| All NFL players              | `/players/nfl`                        | `getAllPlayers()`            |

The official `/playoffs` page resolves and renders the two bracket responses as Sleeper provides them. It does not apply the Grundle Bowl Beta's Champ Bowl / Keeper Bowl / Toilet Bowl routing rules.

The `/history` page follows each league's `previous_league_id` and uses that league record's canonical `draft_id`. Draft picks marked `is_keeper: true` become keeper designations. Completed seasons are stored in `draftHistoryStore.json`; the active season is refreshed directly in the browser.

The local Draft Intel Keeper-Adjusted ADP view uses the same canonical draft flow for current Keeper Designations and exact `pick_no` values. It also uses `/players/nfl` to resolve UDK names to canonical Sleeper player IDs. Sleeper does not supply the Baseline ADP values for this view; those come from the timestamped local UDK CSV.

### League-specific mock drafts

Sleeper has two mock entry points. The public user-drafts endpoint can expose generic drafts, but it did not return the league-specific Grundle mocks. The `/draftboards/<league_id>` page lists those boards through the authenticated `user_drafts_by_league_mock` GraphQL query. An anonymous request returns `Unauthorized`, so Draft Intel does not depend on that private listing operation or handle Sleeper credentials.

Individual league-mock IDs remain readable through the public draft and pick endpoints. `postKeeperMockDraftSource.ts` therefore records the exact 10 IDs supplied for the 2026 post-lock batch. Live validation on 2026-08-31 confirmed all 10 were `league_mock` boards for league `1385053148233621511`, created after the recorded keeper-lock cutoff, complete at 192 picks, and contained all 20 current Keeper Designations at exact picks.

The checked-in IDs seed Draft Intel's "Mock Drafts to include" field. A user can paste replacement Sleeper draft URLs or bare IDs; the field ignores duplicates and the adapter loads only the resulting exact set. It repeats the source, timestamp, creator, board, and complete keeper-set checks at runtime. The UI keeps incompatible drafts visible with validation reasons and never blends mock observations into Baseline ADP or Keeper-Adjusted ADP.

## Projection endpoint present but unused

`getPlayerProjections()` is implemented against a separate Sleeper host:

```text
https://api.sleeper.com/projections/nfl/<season>/<week>?season_type=regular
```

No current page calls this function, and `LiveMatchData` does not contain projections or win probability. Work required before enabling those features is tracked in `ROADMAP.md`.

## ESPN game-status endpoint

The Matchups page calls:

```text
https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=<type>&week=<week>
```

`getESPNScoreboard()` defaults `seasontype` to `2` (regular season). `buildTeamGameStatusMap()` maps each NFL team abbreviation to the competition's `completed` flag. Sleeper player metadata supplies the player's NFL team, and the matchup transform counts finished starters.

## Fetch and cache behavior

- The shared Sleeper helper throws on non-2xx responses and returns parsed JSON without runtime schema validation.
- Rosters, weekly matchups, drafts, draft picks, NFL state, and both bracket calls request fresh data through cache-busting/no-store behavior.
- League users and league metadata use the browser's default cache behavior.
- The all-players payload uses `force-cache` because it is large and changes less frequently.
- ESPN scoreboard requests use `no-store`.
- Pages surface caught API errors in visible alerts; automated coverage is summarized in `TESTING.md`.

## League configuration

The confirmed 2026 league ID is `1385053148233621511`. It is checked into `frontend/src/config/league.ts` and imported by every frontend page, the Playwright Matchups test, and the history updater's default configuration. The updater's `--league=<id>` option remains available for an explicit alternate target. `VITE_LEAGUE_ID` is not supported; any future environment-based configuration must cover both the Vite browser build and the Node updater.

## Maintenance guidance

- Treat league IDs, current week/season state, rosters, scores, and playoff brackets as live data.
- Refresh the canonical draft archive with `npm run fetch:drafts -w frontend`; the command accepts `--league=<id>` for an explicit alternate current league.
- Keep tests deterministic with MSW or Playwright route fixtures; reserve unmocked calls for explicit deployment smoke checks.
- When adding response fields, update the TypeScript interface, transform tests, fixture payloads, and `docs/data-model.md` together.
- If an upstream response shape becomes operationally important, add runtime validation rather than relying only on TypeScript's compile-time assertion.
