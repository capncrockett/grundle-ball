// src/pages/MatchupsPage.tsx

import { useEffect, useMemo, useState } from 'react';
import {
  getLeagueUsers,
  getLeagueRosters,
  getLeagueMatchupsForWeek,
  getNFLState,
  getAllPlayers,
} from '../api/sleeper';
import { getESPNScoreboard, buildTeamGameStatusMap } from '../api/espn';
import {
  mergeRostersAndUsersToTeams,
  pairMatchups,
  buildLiveMatchData,
  mapNFLStateToSeasonState,
} from '../utils/sleeperTransforms';
import type { Team, LiveMatchData, SeasonState } from '../models/fantasy';
import { MatchupCard } from '../components/matchups/MatchupCard';
import { LEAGUE_ID } from '../config/league';

export function MatchupsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [liveMatchups, setLiveMatchups] = useState<LiveMatchData[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [seasonState, setSeasonState] = useState<SeasonState | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [statusWarning, setStatusWarning] = useState<string | null>(null);
  const [completionAvailable, setCompletionAvailable] = useState(false);

  // 1) Load the NFL calendar once. NFL preseason weeks are not fantasy matchup weeks.
  useEffect(() => {
    async function loadSeasonState() {
      try {
        const nflState = await getNFLState();
        const seasonState = mapNFLStateToSeasonState(nflState);
        const defaultFantasyWeek =
          seasonState.seasonType === 'pre' ? 1 : Math.min(Math.max(seasonState.displayWeek, 1), 18);

        setSeasonState(seasonState);
        setSelectedWeek(defaultFantasyWeek);
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : 'Failed to load NFL state');
        setIsLoading(false);
      }
    }

    void loadSeasonState();
  }, []);

  // 2) Whenever selectedWeek changes, fetch league data for that week
  useEffect(() => {
    if (selectedWeek == null || !seasonState) return;
    let cancelled = false;
    const isCancelled = () => cancelled;

    async function loadWeekData(week: number) {
      try {
        setIsLoading(true);
        setError(null);
        setStatusWarning(null);
        setCompletionAvailable(false);

        const [users, rosters, matchups] = await Promise.all([
          getLeagueUsers(LEAGUE_ID),
          getLeagueRosters(LEAGUE_ID),
          getLeagueMatchupsForWeek(LEAGUE_ID, week),
        ]);
        if (isCancelled()) return;

        const mergedTeams = mergeRostersAndUsersToTeams(rosters, users);
        setTeams(mergedTeams);

        if (matchups.length === 0) {
          setLiveMatchups([]);
          return;
        }

        // Optional completion data must never prevent displaying valid Sleeper scores.
        let paired = pairMatchups(week, matchups);
        try {
          const [players, scoreboard] = await Promise.all([
            getAllPlayers(),
            getESPNScoreboard(week),
          ]);
          if (isCancelled()) return;
          paired = pairMatchups(week, matchups, players, buildTeamGameStatusMap(scoreboard));
          setCompletionAvailable(true);
        } catch (err) {
          if (isCancelled()) return;
          const reason = err instanceof Error ? err.message : 'Game status request failed';
          setStatusWarning(
            `Starter completion is unavailable. Sleeper scores are still shown. ${reason}`,
          );
        }
        const live = paired.map((p) => buildLiveMatchData(p));
        setLiveMatchups(live);
      } catch (err) {
        if (isCancelled()) return;
        console.error(err);
        setError(err instanceof Error ? err.message : 'Failed to load matchups');
        setLiveMatchups([]);
        setTeams([]);
      } finally {
        if (!isCancelled()) setIsLoading(false);
      }
    }

    void loadWeekData(selectedWeek);
    return () => {
      cancelled = true;
    };
  }, [selectedWeek, seasonState]);

  const seasonLabel = seasonState
    ? seasonState.seasonType === 'pre'
      ? `${seasonState.season} • Preseason • Fantasy Week ${String(selectedWeek ?? 1)}`
      : `${seasonState.season} • Week ${String(selectedWeek ?? seasonState.displayWeek)}`
    : '';

  const teamsByRosterId = useMemo(
    () => new Map<number, Team>(teams.map((t) => [t.sleeperRosterId, t])),
    [teams],
  );

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4 gap-4">
        <div>
          <h1 className="text-2xl font-bold">Matchups</h1>
          <p className="text-sm text-base-content/60">
            {seasonLabel || 'Loading current Sleeper week...'}
          </p>
        </div>

        {/* Week selector */}
        <div className="form-control">
          <label className="label">
            <span className="label-text text-xs">Week</span>
          </label>
          <select
            className="select select-bordered select-sm"
            value={selectedWeek ?? ''}
            onChange={(e) => {
              setIsLoading(true);
              setSelectedWeek(Number(e.target.value));
            }}
            aria-label="Week"
            disabled={selectedWeek == null}
          >
            <option disabled value="">
              Select week
            </option>
            {Array.from({ length: 18 }).map((_, idx) => {
              const w = idx + 1;
              return (
                <option key={w} value={w}>
                  Week {w}
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {isLoading && (
        <div className="flex justify-center py-10">
          <span className="loading loading-spinner loading-lg" />
        </div>
      )}

      {error && !isLoading && (
        <div className="alert alert-error mb-4">
          <span>{error}</span>
        </div>
      )}

      {statusWarning && !isLoading && (
        <div role="status" className="alert alert-warning mb-4">
          <span>{statusWarning}</span>
        </div>
      )}

      {!isLoading && !error && liveMatchups.length === 0 && (
        <p className="text-sm text-base-content/60">
          {seasonState?.seasonType === 'pre'
            ? 'Fantasy matchups are not available yet. Sleeper will publish them after the league draft and schedule are set.'
            : 'No matchups found for this week.'}
        </p>
      )}

      <div>
        {!isLoading &&
          liveMatchups.map((live) => {
            const teamA = teamsByRosterId.get(live.teamIdA);
            const teamB = live.teamIdB !== null ? teamsByRosterId.get(live.teamIdB) : undefined;
            const matchupKey = [
              live.week.toString(),
              live.teamIdA.toString(),
              live.teamIdB?.toString() ?? 'bye',
            ].join('-');

            return (
              <MatchupCard
                key={matchupKey}
                live={live}
                teamA={teamA}
                teamB={teamB}
                completionAvailable={completionAvailable}
              />
            );
          })}
      </div>
    </div>
  );
}
