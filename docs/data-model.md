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
