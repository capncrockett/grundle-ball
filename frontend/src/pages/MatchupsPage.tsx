// src/pages/MatchupsPage.tsx

import { useEffect, useMemo, useState } from 'react';
import {
  getLeagueUsers,
  getLeagueRosters,
  getLeagueMatchupsForWeek,
  getNFLState,
  getAllPlayers,
  type SleeperPlayer,
} from '../api/sleeper';
import { getESPNScoreboard, buildTeamGameStatusMap } from '../api/espn';
import {
  mergeRostersAndUsersToTeams,
  pairMatchups,
  buildLiveMatchData,
  mapNFLStateToSeasonState,
} from '../utils/sleeperTransforms';
import type { Team, LiveMatchData } from '../models/fantasy';
import { MatchupCard } from '../components/matchups/MatchupCard';
import { LEAGUE_ID } from '../config/league';

export function MatchupsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [liveMatchups, setLiveMatchups] = useState<LiveMatchData[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [seasonLabel, setSeasonLabel] = useState<string>('');
  const [season, setSeason] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [playersById, setPlayersById] = useState<Record<string, SleeperPlayer> | null>(null);

  // 1) Load NFL state and player data once
  useEffect(() => {
    async function loadSeasonState() {
      try {
        const [nflState, players] = await Promise.all([
          getNFLState(),
          getAllPlayers(),
        ]);
        
        const seasonState = mapNFLStateToSeasonState(nflState);
        setPlayersById(players);
        setSelectedWeek(seasonState.displayWeek);
        setSeason(seasonState.season);
        setSeasonLabel(`${seasonState.season} • Week ${seasonState.displayWeek.toString()}`);
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : 'Failed to load NFL state');
      }
    }

    void loadSeasonState();
  }, []);

  // 2) Whenever selectedWeek changes, fetch league data for that week
  useEffect(() => {
    if (selectedWeek == null || !playersById) return;

    async function loadWeekData(week: number) {
      try {
        setIsLoading(true);
        setError(null);

        const [users, rosters, matchups, espnScoreboard] = await Promise.all([
          getLeagueUsers(LEAGUE_ID),
          getLeagueRosters(LEAGUE_ID),
          getLeagueMatchupsForWeek(LEAGUE_ID, week),
          getESPNScoreboard(week),
        ]);

        const mergedTeams = mergeRostersAndUsersToTeams(rosters, users);
        setTeams(mergedTeams);

        // Build team game status map from ESPN data
        const teamGameStatus = buildTeamGameStatusMap(espnScoreboard);

        // Pass player and game status data to pairMatchups
        const paired = pairMatchups(week, matchups, playersById ?? undefined, teamGameStatus);
        const live = paired.map((p) => buildLiveMatchData(p));
        setLiveMatchups(live);
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : 'Failed to load matchups');
        setLiveMatchups([]);
        setTeams([]);
      } finally {
        setIsLoading(false);
      }

      if (season) {
        setSeasonLabel(`${season} • Week ${week.toString()}`);
      }
    }

    void loadWeekData(selectedWeek);
  }, [selectedWeek, playersById, season]);

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

      {!isLoading && !error && liveMatchups.length === 0 && (
        <p className="text-sm text-base-content/60">No matchups found for this week.</p>
      )}

      <div>
        {liveMatchups.map((live) => {
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
            />
          );
        })}
      </div>
    </div>
  );
}
