// frontend/src/pages/PlayoffsPage.tsx
//
// The official Playoffs page. Renders Sleeper's real winners_bracket /
// losers_bracket directly - no custom cross-bracket routing. See
// src/sleeperBracket/resolveBracket.ts for the transform.

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getLeague,
  getLeagueRosters,
  getLeagueUsers,
  getLosersBracket,
  getWinnersBracket,
} from '../api/sleeper';
import type { SleeperLeague } from '../api/sleeper';
import { mergeRostersAndUsersToTeams, computeSeeds } from '../utils/sleeperTransforms';
import { resolveBracketMatchups } from '../sleeperBracket/resolveBracket';
import type { ResolvedBracketMatchup } from '../sleeperBracket/types';
import { SleeperBracketBoard } from '../components/sleeperBracket/SleeperBracketBoard';
import type { Team } from '../models/fantasy';
import { LEAGUE_ID } from '../config/league';

export default function PlayoffsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [league, setLeague] = useState<SleeperLeague | null>(null);
  const [winners, setWinners] = useState<ResolvedBracketMatchup[]>([]);
  const [losers, setLosers] = useState<ResolvedBracketMatchup[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setIsLoading(true);
        setError(null);

        const [leagueData, users, rosters, winnersBracket, losersBracket] = await Promise.all([
          getLeague(LEAGUE_ID),
          getLeagueUsers(LEAGUE_ID),
          getLeagueRosters(LEAGUE_ID),
          getWinnersBracket(LEAGUE_ID),
          getLosersBracket(LEAGUE_ID),
        ]);

        const merged = mergeRostersAndUsersToTeams(rosters, users, leagueData);
        setLeague(leagueData);
        setTeams(computeSeeds(merged));
        setWinners(resolveBracketMatchups(winnersBracket));
        setLosers(resolveBracketMatchups(losersBracket));
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    }

    void load();
  }, []);

  const teamsById = useMemo(() => {
    const map = new Map<number, Team>();
    teams.forEach((team) => map.set(team.sleeperRosterId, team));
    return map;
  }, [teams]);

  const hasBracket = winners.length > 0 || losers.length > 0;
  const hasCompletedGame = teams.some(
    (team) => team.record.wins + team.record.losses + team.record.ties > 0,
  );
  const hasBracketResult = [...winners, ...losers].some(
    (matchup) => matchup.winnerRosterId !== null || matchup.loserRosterId !== null,
  );
  const isProvisional = hasBracket && !hasCompletedGame && !hasBracketResult;
  const playoffWeekStart =
    typeof league?.settings.playoff_week_start === 'number'
      ? league.settings.playoff_week_start
      : 15;
  const playoffTeams =
    typeof league?.settings.playoff_teams === 'number' ? league.settings.playoff_teams : 6;
  const totalRosters = league?.total_rosters ?? teams.length;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Playoffs</h1>
        <p className="text-sm text-base-content/60">
          {league ? `${league.season} official bracket` : 'The official bracket'}, mirrored directly
          from Sleeper &mdash; no house rules.
        </p>
      </div>

      {isLoading && (
        <div className="flex justify-center py-10">
          <span className="loading loading-spinner loading-lg" />
        </div>
      )}

      {error && !isLoading && (
        <div className="alert alert-error">
          <span>Failed to load the playoff bracket: {error}</span>
        </div>
      )}

      {!isLoading && !error && !hasBracket && (
        <div className="alert" data-testid="playoffs-not-started">
          <span>
            Playoffs haven&apos;t been seeded yet. Sleeper is configured to begin the bracket in
            Week {playoffWeekStart}, or see the current{' '}
            <Link to="/standings" className="link">
              standings
            </Link>
            .
          </span>
        </div>
      )}

      {!isLoading && !error && isProvisional && (
        <div className="alert alert-info" data-testid="playoffs-provisional">
          <span>
            Sleeper has published the {league?.season ?? 'current'} bracket structure, but these
            preseason seeds are provisional. They will change as the standings take shape.
          </span>
        </div>
      )}

      {!isLoading && !error && hasBracket && (
        <div className="space-y-10">
          {winners.length > 0 && (
            <SleeperBracketBoard
              title="Championship Bracket"
              subtitle={`Places 1-${String(playoffTeams)}`}
              matchups={winners}
              teamsById={teamsById}
            />
          )}
          {losers.length > 0 && (
            <SleeperBracketBoard
              title="Consolation Bracket"
              subtitle={`Places ${String(playoffTeams + 1)}-${String(totalRosters)}`}
              matchups={losers}
              teamsById={teamsById}
              placementOffset={playoffTeams}
            />
          )}
        </div>
      )}
    </div>
  );
}
