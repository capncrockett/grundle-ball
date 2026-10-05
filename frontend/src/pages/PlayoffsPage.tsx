// frontend/src/pages/PlayoffsPage.tsx
//
// The official Playoffs page. Renders Sleeper's real winners_bracket /
// losers_bracket directly - no custom cross-bracket routing. See
// src/sleeperBracket/resolveBracket.ts for the transform.

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getLeague,
  getNFLState,
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
import { buildIfTodayBracket, seasonAverage } from '../sleeperBracket/ifToday';
import { PlayoffRacePanels } from '../components/PlayoffRacePanels';
import { buildPlayoffNarratives } from './narratives';
import { LEAGUE_ID } from '../config/league';

export default function PlayoffsPage({ leagueId = LEAGUE_ID }: { leagueId?: string } = {}) {
  const [view, setView] = useState<'live' | 'if-today'>('live');
  const [currentWeek, setCurrentWeek] = useState<number | null>(null);
  const [previewWarning, setPreviewWarning] = useState<string | null>(null);
  const [bracketError, setBracketError] = useState<string | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [league, setLeague] = useState<SleeperLeague | null>(null);
  const [winners, setWinners] = useState<ResolvedBracketMatchup[]>([]);
  const [losers, setLosers] = useState<ResolvedBracketMatchup[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setIsLoading(true);
        setError(null);
        setBracketError(null);
        setPreviewWarning(null);
        setCurrentWeek(null);

        const [leagueData, users, rosters, brackets, nflState] = await Promise.all([
          getLeague(leagueId),
          getLeagueUsers(leagueId),
          getLeagueRosters(leagueId),
          Promise.all([getWinnersBracket(leagueId), getLosersBracket(leagueId)])
            .then((data) => ({ data, error: null }))
            .catch(() => ({ data: [[], []], error: 'Sleeper bracket data is unavailable.' })),
          getNFLState().catch(() => null),
        ]);
        if (cancelled) return;
        setBracketError(brackets.error);
        setCurrentWeek(nflState?.season === leagueData.season ? nflState.week : null);
        if (!nflState || nflState.season !== leagueData.season) {
          setPreviewWarning(
            'Race updates are unavailable for this season. The standings preview is still available.',
          );
        }
        const [winnersBracket, losersBracket] = brackets.data;
        const merged = mergeRostersAndUsersToTeams(rosters, users, leagueData);
        setLeague(leagueData);
        setTeams(merged);
        setWinners(resolveBracketMatchups(winnersBracket));
        setLosers(resolveBracketMatchups(losersBracket));
      } catch (err) {
        if (cancelled) return;
        console.error(err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [leagueId]);

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
    typeof league?.settings.playoff_week_start === 'number' &&
    league.settings.playoff_week_start > 0
      ? league.settings.playoff_week_start
      : 15;
  const playoffTeams =
    typeof league?.settings.playoff_teams === 'number' ? league.settings.playoff_teams : 6;
  const totalRosters = league?.total_rosters ?? teams.length;

  const seededTeams = useMemo(() => computeSeeds(teams), [teams]);
  const preview = useMemo(() => buildIfTodayBracket(seededTeams), [seededTeams]);
  const previewTeams = useMemo(
    () => new Map(seededTeams.map((team) => [team.sleeperRosterId, team])),
    [seededTeams],
  );
  const averages = useMemo(
    () => new Map(seededTeams.map((team) => [team.sleeperRosterId, seasonAverage(team)])),
    [seededTeams],
  );
  const narratives = useMemo(
    () =>
      currentWeek == null || !hasCompletedGame
        ? null
        : buildPlayoffNarratives(seededTeams, currentWeek),
    [seededTeams, currentWeek, hasCompletedGame],
  );
  const supportsPreview = leagueId === LEAGUE_ID && playoffTeams === 6;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Playoffs</h1>
        <p className="text-sm text-base-content/60">
          {league ? `${league.season} official bracket` : 'The official bracket'}, mirrored directly
          from Sleeper. Use If Today to preview the current playoff race.
        </p>
      </div>

      {supportsPreview && (
        <div className="join" aria-label="Playoff view">
          <button
            className={`btn join-item ${view === 'live' ? 'btn-primary' : ''}`}
            aria-pressed={view === 'live'}
            onClick={() => {
              setView('live');
            }}
          >
            Live Playoffs
          </button>
          <button
            className={`btn join-item ${view === 'if-today' ? 'btn-primary' : ''}`}
            aria-pressed={view === 'if-today'}
            onClick={() => {
              setView('if-today');
            }}
          >
            If Today
          </button>
        </div>
      )}
      {!isLoading && !error && view === 'if-today' && supportsPreview && (
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-bold">If the Season Ended Today</h2>
            <p className="text-sm text-base-content/70">
              Current league seeds, with every championship game projected using season-long average
              points per week. Equal averages favor the better seed. This is a hypothetical preview,
              not Sleeper results.
            </p>
          </div>
          {previewWarning && <div className="alert alert-warning">{previewWarning}</div>}
          {!hasCompletedGame ? (
            <div className="alert">
              The preview will be available once regular-season games have been played.
            </div>
          ) : preview.length === 0 ? (
            <div className="alert">Not enough teams to seed the six-team playoff preview.</div>
          ) : (
            <>
              <PlayoffRacePanels narratives={narratives} />
              <SleeperBracketBoard
                title="Projected Championship Bracket"
                subtitle="Seeds 1-6 - projected weekly averages"
                matchups={preview}
                teamsById={previewTeams}
                projectedScores={averages}
                weekStart={playoffWeekStart}
              />
              <div className="card bg-base-200">
                <div className="card-body">
                  <h3 className="card-title">Outside the Playoffs</h3>
                  <ul>
                    {seededTeams
                      .filter((team) => (team.seed ?? 0) > 6)
                      .map((team) => (
                        <li key={team.sleeperRosterId}>
                          {team.seed}. {team.teamName}
                        </li>
                      ))}
                  </ul>
                  <p className="text-sm text-base-content/70">
                    See Live Playoffs for Sleeper's official consolation bracket.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      )}
      {view === 'live' && !isLoading && !error && bracketError && (
        <div className="alert alert-error">Failed to load the playoff bracket: {bracketError}</div>
      )}
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

      {view === 'live' && !isLoading && !error && !bracketError && !hasBracket && (
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

      {view === 'live' && !isLoading && !error && !bracketError && isProvisional && (
        <div className="alert alert-info" data-testid="playoffs-provisional">
          <span>
            Sleeper has published the {league?.season ?? 'current'} bracket structure, but these
            preseason seeds are provisional. They will change as the standings take shape.
          </span>
        </div>
      )}

      {view === 'live' && !isLoading && !error && !bracketError && hasBracket && (
        <div className="space-y-10">
          {winners.length > 0 && (
            <SleeperBracketBoard
              title="Championship Bracket"
              subtitle={`Places 1-${String(playoffTeams)}`}
              matchups={winners}
              teamsById={teamsById}
              weekStart={playoffWeekStart}
            />
          )}
          {losers.length > 0 && (
            <SleeperBracketBoard
              title="Consolation Bracket"
              subtitle={`Places ${String(playoffTeams + 1)}-${String(totalRosters)}`}
              matchups={losers}
              teamsById={teamsById}
              placementOffset={playoffTeams}
              placementOrder="reverse"
              weekStart={playoffWeekStart}
            />
          )}
        </div>
      )}
    </div>
  );
}
