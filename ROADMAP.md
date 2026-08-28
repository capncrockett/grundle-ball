# Grundle Ball — Roadmap (Active)

Completed phases 0–6 removed for brevity; reopen if you need historical notes.

---

## Phase 3 — If‑Today Bracket View (Leftovers)

- [ ] Add tiny flow labels (text only): "Rimmers ->", "Flushed ->", "Floaters", "Splashbacks".
- Connectors (paused):
  - [ ] Re‑enable connectors on Champ only.
  - [ ] Switch from raw `<line>` to elbow/bracket paths.
  - [ ] Add connection map for Keeper/Toilet.
  - [ ] Ensure connectors rerender on resize + mode toggle.

---

## Phase 7 — Release / Hosting / QA (Next)

- [ ] Smoke test all routes.
- [ ] Verify Sleeper API errors are surfaced cleanly.
- [ ] Add stable `data-testid` hooks for e2e selectors (theme toggle, matchups list, etc.).
- [x] Confirm works on mobile widths.
- [ ] Add minimal README usage notes.
- [ ] Deploy to chosen host (Render/Azure/AWS).

---

## Open Questions / Parking Lot

- Connectors: SVG vs CSS pseudo‑elements decision after geometry is locked
- How to represent BYE games in Live mode if Sleeper omits them
- Whether to cache Sleeper responses for rate limits

---

## Future Enhancements (Nice-to-Have)

- Backend data store work (cron + DB migration) is tracked in `backend/TODO.md`.

### Enhanced Matchup Projections

**Goal:** Display accurate projected scores and win probabilities on the Matchups page.

**Current State:**

- Matchup cards show current scores only
- Win probability removed (not available from Sleeper API)
- Basic `getPlayerProjections()` API client exists but is unused
- Projection API: `https://api.sleeper.com/projections/nfl/{season}/{week}`

**What's Needed:**

1. **Fetch Player Projections**

   - Call `getPlayerProjections(season, week)` for current week
   - Returns array of projections keyed by `player_id` with scoring formats (std/half_ppr/ppr)

2. **Map to Team Totals**

   - For each matchup, get roster's starter player IDs from `SleeperMatchup.starters`
   - Look up each starter's projection
   - Sum projected points based on league scoring format (need to detect from league settings)
   - Add to current points for players who haven't played yet

3. **Calculate Win Probability**

   - Simple approach: `winProbA = projectedA / (projectedA + projectedB)`
   - Better approach: Use statistical model considering variance, time remaining, players left to play
   - Note: Will never match Sleeper's proprietary win probability calculation

4. **UI Updates**
   - Show projected totals on MatchupCard
   - Add win probability percentages back to cards
   - Add disclaimer: "Projections are estimates and may differ from Sleeper's calculations"

**Technical Notes:**

- Projections API is separate domain: `api.sleeper.com` vs `api.sleeper.app`
- May require league settings fetch to determine scoring format
- Additional API calls per week view (consider caching)
- Player projections change throughout the week as games complete

**Files to Modify:**

- `src/utils/sleeperTransforms.ts` - Enhance `buildLiveMatchData()` to use real projections
- `src/pages/MatchupsPage.tsx` - Fetch projections alongside matchups
- `src/components/matchups/MatchupCard.tsx` - Re-enable win probability display
- `src/models/fantasy.ts` - Potentially add `LeagueSettings` type for scoring format

**Estimated Effort:** Medium (4-6 hours)

- API integration is straightforward
- Complexity is in mapping player IDs to projections and handling edge cases
- Testing across different weeks and scoring formats

### Players Yet To Play Tracking

**Goal:** Show how many starters have finished playing vs yet to play on matchup cards.

**Current State:**

- Matchup cards only show current scores
- No indication of game progress or remaining players
- `startersA` and `startersB` fields exist in data model but not displayed

**Approach Options:**

1. **Use ESPN's undocumented API** (Recommended - Free)

   - ESPN scoreboard API: `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=2&week={week}`
   - Returns game status: `STATUS_SCHEDULED`, `STATUS_IN_PROGRESS`, `STATUS_FINAL`, `STATUS_HALFTIME`, etc.
   - Get all players from Sleeper (`https://api.sleeper.app/v1/players/nfl`)
   - Cross-reference player team with ESPN game status to determine if game is complete
   - Count starters whose games are `STATUS_FINAL` vs still in progress

2. **Use Sleeper Stats API**

   - `https://api.sleeper.com/stats/nfl/{season}/{week}?season_type=regular`
   - Check if player has non-zero stats (indicates they've played)
   - Less reliable: player could be active but have 0 stats

3. **Use NFL.com GameCenter JSON** (Mentioned in StackOverflow)
   - `http://www.nfl.com/liveupdate/game-center/{game_id}/{game_id}_gtd.json`
   - Updates every ~15 seconds during live games
   - Would need to maintain mapping of game IDs

**Implementation Steps (ESPN Approach):**

1. Add ESPN API client function: `getESPNScoreboard(week)`
2. Fetch all NFL players once per day (cache in localStorage)
3. Build map of `player_id -> NFL_team`
4. Fetch ESPN scoreboard for current week
5. Create map of `NFL_team -> game_status`
6. For each starter in matchup:
   - Look up player's NFL team
   - Check if team's game is `STATUS_FINAL`
   - Increment `playersFinished` or `playersYetToPlay` count
7. Update UI:
   - Show "X/Y finished" under each team score
   - Add visual bar showing ratio of finished players
   - Update as games progress (requires periodic refresh)

**Data Model Changes:**

```typescript
interface LiveMatchData {
  // ... existing fields
  playersFinishedA: number;
  playersFinishedB: number;
}
```

**UI Changes:**

- Add "5/9 finished" text under scores
- Add progress bar showing completion ratio
- Consider color coding: green for all done, yellow for in progress

**Estimated Effort:** Medium (6-8 hours)

- ESPN API integration
- Player data caching and mapping
- Cross-referencing logic
- UI updates
- Testing with live games

### Multi-League Expansion

- Handle leagues without divisions gracefully (skip division insights/cards when no division IDs available).
