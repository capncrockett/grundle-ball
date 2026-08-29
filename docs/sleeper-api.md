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
| NFL state                    | `/state/nfl`                          | `getNFLState()`              |
| All NFL players              | `/players/nfl`                        | `getAllPlayers()`            |

The official `/playoffs` page resolves and renders the two bracket responses as Sleeper provides them. It does not apply the Grundle Bowl Beta's Champ Bowl / Keeper Bowl / Toilet Bowl routing rules.

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
- Rosters, weekly matchups, NFL state, and both bracket calls request fresh data through cache-busting/no-store behavior.
- League users and league metadata use the browser's default cache behavior.
- The all-players payload uses `force-cache` because it is large and changes less frequently.
- ESPN scoreboard requests use `no-store`.
- Pages surface caught API errors in visible alerts; automated coverage is summarized in `TESTING.md`.

## League configuration

The confirmed 2026 league ID is `1385053148233621511`. It is checked into `frontend/src/config/league.ts` and imported by every frontend page, the Playwright Matchups test, and the history updater's default configuration. The updater's `--league=<id>` option remains available for an explicit alternate target. `VITE_LEAGUE_ID` is not supported; any future environment-based configuration must cover both the Vite browser build and the Node updater.

## Maintenance guidance

- Treat league IDs, current week/season state, rosters, scores, and playoff brackets as live data.
- Keep tests deterministic with MSW or Playwright route fixtures; reserve unmocked calls for explicit deployment smoke checks.
- When adding response fields, update the TypeScript interface, transform tests, fixture payloads, and `docs/data-model.md` together.
- If an upstream response shape becomes operationally important, add runtime validation rather than relying only on TypeScript's compile-time assertion.
