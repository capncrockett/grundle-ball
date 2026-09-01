# Data Models

This document describes the models currently crossing Grundle Ball's API, transformation, UI, and stored-history boundaries. Source paths are relative to `frontend/src/` unless noted.

## Raw external models

`api/sleeper.ts` defines the response shapes used by the app:

- `SleeperLeague`: league identity, season/status, settings, scoring, roster positions, metadata, and optional previous-league link.
- `SleeperUser`: manager identity, display name, avatar, and team-name metadata.
- `SleeperRoster`: owner, roster/player IDs, starters/reserve, record and points settings, division fields, and roster metadata.
- `SleeperMatchup`: weekly roster entry keyed by `matchup_id`, with starters, players, points, and optional custom points.
- `SleeperNFLState`: current/display week and season state.
- `SleeperPlayoffMatchup`: Sleeper bracket node with round/match IDs, direct teams or winner/loser sources, result IDs, and placement metadata.
- `SleeperDraft`: the canonical draft's status, settings, slot ownership, season, and identity.
- `SleeperDraftPick`: a player's round, slot, destination roster, overall pick number, metadata, and keeper flag.
- `SleeperPlayer`: the subset of the all-players payload needed for NFL team and player status mapping.
- `SleeperPlayerProjection`: projection response shape. The API client exists, but the current UI does not consume projections.

`api/espn.ts` defines `ESPNScoreboard`, `ESPNEvent`, `ESPNCompetition`, and `ESPNCompetitor`. The Matchups page uses only competitor team abbreviations and each competition's completed status.

## Team

`models/fantasy.ts` defines the internal team model produced by `mergeRostersAndUsersToTeams()`:

```typescript
interface Team {
  teamName: string;
  ownerDisplayName: string;
  teamAvatarUrl: string | null;
  userAvatarUrl: string | null;
  sleeperRosterId: number;
  sleeperUserId: string;
  divisionId: number | null;
  divisionName?: string | null;
  divisionAvatarUrl?: string | null;
  record: { wins: number; losses: number; ties: number };
  pointsFor: number;
  pointsAgainst: number;
  rank: number;
  seed?: number;
}
```

The transform resolves team and manager avatars separately, derives optional division metadata from the league/roster payloads, combines Sleeper's integer and decimal point fields, and assigns standings rank. `computeSeeds()` adds the league-specific playoff seed.

## Weekly matchup models

`PairedMatchup` groups the one-row-per-roster Sleeper response by `matchup_id`:

```typescript
interface PairedMatchup {
  matchupId: number;
  week: number;
  rosterIdA: number;
  rosterIdB: number | null;
  pointsA: number;
  pointsB: number;
  startersA: number;
  startersB: number;
  playersFinishedA: number;
  playersFinishedB: number;
}
```

`LiveMatchData` is the card-ready projection of that pair:

```typescript
interface LiveMatchData {
  teamIdA: number;
  teamIdB: number | null;
  pointsA: number;
  pointsB: number;
  startersA: number;
  startersB: number;
  playersFinishedA: number;
  playersFinishedB: number;
  week: number;
}
```

Despite its historical name, `LiveMatchData` currently contains actual points and starter completion counts-not projected totals or win probabilities.

## SeasonState

`SeasonState` is the UI-facing subset produced from `SleeperNFLState` by `mapNFLStateToSeasonState()`:

```typescript
interface SeasonState {
  week: number;
  displayWeek: number;
  season: string;
  seasonType: string;
  leagueSeason: string;
}
```

## Official Sleeper bracket

The official `/playoffs` path uses `sleeperBracket/types.ts`:

- `BracketSide` is a discriminated union for a known team, winner of a prior game, loser of a prior game, or TBD.
- `ResolvedBracketMatchup` holds round/match IDs, two resolved sides, winner/loser roster IDs, optional placement, and the raw Sleeper node.
- `BracketRoundGroup` groups resolved matchups for rendering.

These models describe Sleeper's bracket as returned; they do not apply the Grundle Bowl Beta routing rules.

## Grundle Bowl Beta bracket

The custom Beta engine uses `bracket/types.ts`:

- `BracketSlot` is one immutable-style matchup slot with a typed ID, bracket/round, two `BracketTeamRef` positions, optional Sleeper week, and reward copy.
- `BracketTeamRef` may carry seed, Sleeper roster ID, BYE state, current points, and simulated projection.
- `BracketRoutingRule` maps a source slot's winner and/or loser to a target slot position.
- `BracketId` is `champ`, `keeper`, or `toilet`; Keeper Bowl is a bracket name within this Beta feature, not the application brand.

`BRACKET_TEMPLATE` currently contains 18 slots across the three boards. Callers clone/populate it through the seeding and outcome functions rather than mutating the exported template.

## Stored matchup history

`data/matchupHistoryTypes.ts` defines the checked-in history row:

```typescript
type StoredMatchup = {
  leagueId: string;
  season: string;
  week: number;
  team: string;
  opponent: string;
  pointsFor: number;
  pointsAgainst: number;
  margin: number;
  finished: boolean;
};

type MatchupHistory = StoredMatchup[];
```

The deployed frontend imports `data/matchupHistoryStore.json`. `backend/matchupHistoryStore.ts` implements the same logical shape through the default JSON store and an optional local SQLite store.

The JSON snapshot, store APIs, and SQLite schema use `(leagueId, season, week, team)` identity. The checked-in rows and automatic legacy SQLite migration use the verified 2025 league ID (`1251950356187840512`) and season (`2025`). The updater resolves the selected Sleeper league before stamping new rows, and Standings returns no history-derived current insight when a matching league/season snapshot is unavailable.

JSON, SQLite, frontend selectors, and the update CLI have regression coverage across league/season scopes. The CLI also rejects malformed selectors, mismatched or seasonless league responses, and invalid matchup scores before writing.

## Draft and keeper history

`data/draftHistoryTypes.ts` defines a normalized snapshot rooted at `DraftHistorySnapshot`. Each `DraftHistorySeason` contains canonical draft metadata, draft-slot ownership, historical Team labels, and normalized `DraftHistoryPick` rows.

A keeper designation is a draft pick whose Sleeper `is_keeper` flag is true. `buildKeeperLedger()` groups those designations by `(rosterId, playerId)`, preserving separate keeper histories when the same player is kept by different Teams. Draft status distinguishes provisional active-season designations from finalized Keeper Seasons.

`findKeeperRuleViolations()` checks the current designations against the two-keeper Team cap and the two-consecutive-season Keeper Cycle cap. A completed season without a Keeper Designation for that `(rosterId, playerId)` ends the cycle. Pricing, required-pick ownership at the keeper lock, and designation timing remain outside this check because the draft-history feed cannot establish them reliably.

The checked-in `data/draftHistoryStore.json` is regenerated by `backend/scripts/updateDraftHistory.ts`. The History page overlays the current season with a live normalized response while retaining completed seasons from the snapshot.

## Draft Intel

`draftIntel/analysis.ts` derives read-only scouting reports from `DraftHistorySnapshot`. Analysis defaults to completed drafts from 2021 onward, excludes Keeper Designations, and can exclude the local user's Team by Sleeper roster ID. It also excludes 2024-2025 DL, LB, and DB Draft Selections from every metric because league rules forced IDP into the final two rounds while reliable 1QB IDP ADP was unavailable. Completed 2026 drafts are the first eligible source of IDP evidence.

Each `DraftIntelPattern` records its category, display badge, evidence, strength, supporting Team roster IDs, and deterministic sort score. Pattern categories cover roster construction, draft timing, opening rounds, and NFL-team affinity. Presentation order prioritizes fantasy relevance before confidence: RB/WR, IDP, QB/TE, NFL-team affinity, then K/DEF. Signals backed by fewer than three applicable drafts are labeled emerging. Rookie tendency is not modeled because `DraftHistoryPick` does not currently retain rookie status.

### Keeper-Adjusted ADP

`draftIntel/keeperAdjustedAdp.ts` defines the source-independent Phase 1 calculation models:

- `BaselineAdpPlayer` carries canonical Sleeper player identity, display fields, Baseline ADP, and stable source order.
- `KeeperAdpInput` identifies a keeper by player ID and exact occupied overall pick.
- `KeeperAdjustedDraftConfig` carries Team count, round count, snake type, and draft-slot-to-roster assignments.
- `KeeperAdjustedAdpRow` keeps Baseline ADP, Keeper-Adjusted ADP, signed shift, structured round-pick positions, available-pool rank, and the number of higher-ranked keepers removed.

The timestamped UDK ADP Comparison CSV supplies the `Avg` column in 12-Team round-pick notation. `parseUdkAdpCsv()` converts values such as `2.05` to overall pick 17. `resolveUdkAdpPlayers()` matches normalized player name, position, and NFL Team against Sleeper's all-player map. Missing or ambiguous identities are excluded and reported instead of guessed.

The calculation removes Keeper Designations from the Baseline ADP pool, subtracts only higher-ranked keepers from each available player's pool rank, marks exact keeper picks occupied, and maps the resulting rank onto the ordered open draft slots. Decimal ranks use linear interpolation between adjacent open slots. A result beyond the finite board is `null`, and `adpDelta` is `keeperAdjustedAdp - baselineAdp`, so a negative value means earlier.

The selected Team's open picks are the standard snake slots assigned to its Sleeper roster ID, excluding its keeper-occupied slots. This is nominal draft-slot ownership and does not infer traded open-pick ownership.

### Observed mock drafts

`draftIntel/mockDraftAnalyzer.ts` defines source-independent Phase 2 models:

- `MockDraftSample` identifies one selected draft, its board length, and player selections by overall pick.
- `MockDraftPlayerAnalysis` keeps selection count, mean, median, earliest, latest, and availability results.
- `MockDraftAvailability` records the eligible sample count and the count and percentage still available at one overall pick.

A player selected exactly at the Team's pick counts as available when that pick begins. An undrafted player also counts as available. Drafts shorter than a requested pick are excluded from that pick's denominator. Descriptive statistics include only mocks in which the player was selected, while `mockCount` and the selected-mock total expose missing observations. The table rounds observed mean and median overall picks to the nearest slot for `round.pick` display, while range endpoints are exact slots shown with "to" between them.

`data/postKeeperMockDraftSource.ts` records the exact 10-draft 2026 league-mock batch plus its keeper-lock cutoff and batch completion time. It seeds the local "Mock Drafts to include" field. `draftIntel/sleeperMockDrafts.ts` parses pasted Sleeper draft URLs or bare IDs, deduplicates them in entry order, loads only that exact set, and adapts their public Sleeper metadata and picks into pure samples.

A configured draft is selectable only when its metadata identifies the current league and `league_mock` type, the selected user created it, it was created after keeper lock, and it is a complete snake draft with the current Team count, round count, user draft slot, and full pick count. Its complete set of Sleeper-marked keepers must equal the current Keeper Designations at their exact occupied picks; both missing and unexpected keepers invalidate it.
