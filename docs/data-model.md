# Data Models

This document describes the TypeScript models used by the Grundle Ball frontend.

## SleeperUser

Represents a raw user object from the Sleeper API.

Key fields:

- `user_id: string`
- `username: string`
- `display_name: string`
- `avatar?: string | null`
- `metadata?: { team_name?: string; ... }`

Source: `SleeperUser` in `src/api/sleeper.ts`.

## SleeperRoster

Represents a raw roster object from the Sleeper API.

Key fields:

- `roster_id: number`
- `owner_id: string`
- `league_id: string`
- `starters: string[]`
- `players: string[]`
- `reserve: string[]`
- `settings: { wins?: number; losses?: number; ties?: number; fpts?: number; fpts_decimal?: number; fpts_against?: number; fpts_against_decimal?: number; ... }`

Source: `SleeperRoster` in `src/api/sleeper.ts`.

## Team

Internal team model combining `SleeperUser` + `SleeperRoster` + standings info.

Fields:

- `teamName: string`
- `ownerDisplayName: string`
- `avatarUrl: string | null`
- `sleeperRosterId: number`
- `sleeperUserId: string`
- `record: { wins: number; losses: number; ties: number }`
- `pointsFor: number`
- `pointsAgainst: number`
- `rank: number` (1-based, derived from standings)
- `seed?: number` (1-12, used for playoffs)

Source: `Team` in `src/models/fantasy.ts`.

## PairedMatchup

Represents a 2-team matchup created by grouping raw Sleeper matchup entries sharing `matchup_id`.

Fields:

- `matchupId: number`
- `week: number`
- `rosterIdA: number`
- `rosterIdB: number | null`
- `pointsA: number`
- `pointsB: number`

Source: `PairedMatchup` in `src/models/fantasy.ts`.

## LiveMatchData

Represents a UI-ready live view of a matchup, including win probabilities.

Fields:

- `teamIdA: number`
- `teamIdB: number | null`
- `pointsA: number`
- `pointsB: number`
- `projectedA: number`
- `projectedB: number`
- `winProbA: number` (0-1, simple projection-based estimate)
- `winProbB: number` (0-1)
- `week: number`

Built from `PairedMatchup` via `buildLiveMatchData` in `src/utils/sleeperTransforms.ts`.

## SeasonState

Simplified view of the NFL state from Sleeper.

Fields:

- `week: number`
- `displayWeek: number`
- `season: string`
- `seasonType: string`
- `leagueSeason: string`

Source: `SeasonState` in `src/models/fantasy.ts`, created from `SleeperNFLState` via `mapNFLStateToSeasonState`.
