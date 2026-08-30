// src/pages/StandingsPage.tsx

import { useEffect, useMemo, useState } from 'react';
import { getLeague, getLeagueRosters, getLeagueUsers } from '../api/sleeper';
import { mergeRostersAndUsersToTeams, computeSeeds } from '../utils/sleeperTransforms';
import type { Team } from '../models/fantasy';
import { TeamAvatars } from '../components/common/TeamAvatars';
import { computeStandingsInsights } from './standingsInsights';
import { STANDINGS_GLOSSARY } from './narratives.tsx';
import {
  findMatchupForTeam,
  getLatestCompletedWeek,
  getMatchupMarginsForWeek,
  getStoredMatchups,
  normalizeTeamName,
} from '../data/matchupHistory';
import { LEAGUE_ID } from '../config/league';

const formatRecord = (record: Team['record']): string => {
  const base = `${record.wins.toString()}-${record.losses.toString()}`;
  return record.ties ? `${base}-${record.ties.toString()}` : base;
};

type DivisionRosterGroup = {
  divisionId: number | null;
  divisionName: string;
  divisionAvatarUrl: string | null;
  members: Team[];
};

const groupTeamsByDivision = (teams: Team[]): DivisionRosterGroup[] => {
  const grouped = teams.reduce((groups, team) => {
    const key = team.divisionId ?? -1;
    const members = groups.get(key) ?? [];
    members.push(team);
    groups.set(key, members);
    return groups;
  }, new Map<number, Team[]>());

  return Array.from(grouped.entries())
    .map(([divisionId, members]) => ({
      divisionId: divisionId === -1 ? null : divisionId,
      divisionName:
        members[0]?.divisionName ??
        (divisionId === -1 ? 'Unassigned' : `Division ${divisionId.toString()}`),
      divisionAvatarUrl: members[0]?.divisionAvatarUrl ?? null,
      members: [...members].sort((a, b) => a.teamName.localeCompare(b.teamName)),
    }))
    .sort((a, b) => {
      if (a.divisionId === null) return 1;
      if (b.divisionId === null) return -1;
      return a.divisionId - b.divisionId;
    });
};

export function StandingsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [regularSeasonWeeks, setRegularSeasonWeeks] = useState<number>(14);
  const [activeLeagueId, setActiveLeagueId] = useState<string | null>(null);
  const [leagueSeason, setLeagueSeason] = useState<string | null>(null);

  const winPoints = (team: Team): number => team.record.wins + team.record.ties * 0.5;

  const rankTeams = (entries: { winPoints: number; pf: number; id: number }[]): number[] => {
    const sorted = [...entries].sort((a, b) => {
      if (b.winPoints !== a.winPoints) return b.winPoints - a.winPoints;
      return b.pf - a.pf;
    });
    return sorted.map((entry) => entry.id);
  };

  const storedMatchups = useMemo(
    () =>
      activeLeagueId && leagueSeason
        ? getStoredMatchups({ leagueId: activeLeagueId, season: leagueSeason })
        : [],
    [activeLeagueId, leagueSeason],
  );

  const findMatchup = (teamName: string, week?: number) =>
    findMatchupForTeam(teamName, { week, matchups: storedMatchups });

  const computeSeedAfterFlip = (
    team: Team,
    allTeams: Team[],
    matchupMargin: number,
    opponentName: string | null,
  ): number | null => {
    if (!opponentName) return null;
    const opponent = allTeams.find(
      (t) => normalizeTeamName(t.teamName) === normalizeTeamName(opponentName),
    );
    if (!opponent) return null;

    const adjusted = allTeams.map((t) => ({ ...t, record: { ...t.record } }));
    const target = adjusted.find((t) => t.sleeperRosterId === team.sleeperRosterId);
    const targetOpp = adjusted.find((t) => t.sleeperRosterId === opponent.sleeperRosterId);
    if (!target || !targetOpp) return null;

    if (matchupMargin > 0) {
      target.record.wins = Math.max(0, target.record.wins - 1);
      target.record.losses += 1;
      targetOpp.record.wins += 1;
      targetOpp.record.losses = Math.max(0, targetOpp.record.losses - 1);
    } else if (matchupMargin < 0) {
      target.record.wins += 1;
      target.record.losses = Math.max(0, target.record.losses - 1);
      targetOpp.record.wins = Math.max(0, targetOpp.record.wins - 1);
      targetOpp.record.losses += 1;
    } else {
      // tie margin unlikely; treat as no-op
      return null;
    }

    const reseeded = computeSeeds(adjusted);
    return reseeded.find((t) => t.sleeperRosterId === team.sleeperRosterId)?.seed ?? null;
  };

  const bestWorstRange = (
    team: Team,
    allTeams: Team[],
    marginByTeam: Map<string, number>,
    latestWeek: number | null,
  ): { best: number; worst: number; label: string; statCorrectionRisk: boolean } => {
    const gamesPlayed = team.record.wins + team.record.losses + team.record.ties;
    const remaining = Math.max(regularSeasonWeeks - gamesPlayed, 0);
    const currentSeed = team.seed ?? team.rank;
    const normalizedName = normalizeTeamName(team.teamName);
    const margin = marginByTeam.get(team.teamName) ?? marginByTeam.get(normalizedName);

    const withinCorrectionThreshold = margin != null && Math.abs(margin) <= 8;
    const matchup = latestWeek !== null ? findMatchup(team.teamName, latestWeek) : null;
    let flippedSeed: number | null = null;
    if (withinCorrectionThreshold && matchup) {
      flippedSeed = computeSeedAfterFlip(team, allTeams, margin, matchup.opponent);
    }
    const statCorrectionRisk =
      withinCorrectionThreshold && flippedSeed != null && flippedSeed !== currentSeed;

    if (remaining === 0) {
      return {
        best: currentSeed,
        worst: currentSeed,
        label: `${currentSeed.toString()}-${currentSeed.toString()}`,
        statCorrectionRisk,
      };
    }

    const minWinPoints = winPoints(team);
    const maxWinPoints = minWinPoints + remaining;

    const optimisticEntries = allTeams.map((t) => {
      const isSelf = t.sleeperRosterId === team.sleeperRosterId;
      return {
        id: t.sleeperRosterId,
        winPoints: isSelf ? maxWinPoints : winPoints(t), // others at their floor for best case
        pf: isSelf ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY,
      };
    });

    const pessimisticEntries = allTeams.map((t) => {
      const gp = t.record.wins + t.record.losses + t.record.ties;
      const rem = Math.max(regularSeasonWeeks - gp, 0);
      const isSelf = t.sleeperRosterId === team.sleeperRosterId;
      return {
        id: t.sleeperRosterId,
        winPoints: isSelf ? minWinPoints : winPoints(t) + rem, // others at their ceiling for worst case
        pf: isSelf ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
      };
    });

    const bestRank = rankTeams(optimisticEntries).indexOf(team.sleeperRosterId) + 1;
    const worstRank = rankTeams(pessimisticEntries).indexOf(team.sleeperRosterId) + 1;

    return {
      best: bestRank,
      worst: worstRank,
      label: `${bestRank.toString()}-${worstRank.toString()}`,
      statCorrectionRisk,
    };
  };

  const teamBadges = (
    team: Team,
    bw: { best: number; worst: number; statCorrectionRisk: boolean },
  ): string[] => {
    const badges = new Set<string>();
    const seed = team.seed ?? team.rank;
    if (bw.worst <= 1) {
      badges.add('*');
      badges.add('z');
    } else if (bw.worst <= 2) {
      badges.add('z');
    }
    if (bw.worst <= 3) badges.add('y');
    if (bw.worst <= 6) badges.add('x');
    if (seed === 6) badges.add('6');
    return Array.from(badges);
  };

  useEffect(() => {
    async function load() {
      try {
        setIsLoading(true);
        setError(null);

        const [league, users, rosters] = await Promise.all([
          getLeague(LEAGUE_ID),
          getLeagueUsers(LEAGUE_ID),
          getLeagueRosters(LEAGUE_ID),
        ]);

        const totalWeeks =
          typeof league.settings.playoff_week_start === 'number'
            ? Math.max(1, league.settings.playoff_week_start - 1)
            : 14;
        setRegularSeasonWeeks(totalWeeks);
        setActiveLeagueId(league.league_id);
        setLeagueSeason(league.season);

        const merged = mergeRostersAndUsersToTeams(rosters, users, league);
        const hasCompletedGames = merged.some(
          (team) => team.record.wins + team.record.losses + team.record.ties > 0,
        );

        setTeams(hasCompletedGames ? computeSeeds(merged) : merged);
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    }

    void load();
  }, []);

  const latestCompletedWeek = useMemo(
    () => getLatestCompletedWeek(storedMatchups),
    [storedMatchups],
  );

  const marginByTeam = useMemo(() => {
    if (latestCompletedWeek === null) return new Map<string, number>();
    return getMatchupMarginsForWeek(latestCompletedWeek, storedMatchups);
  }, [latestCompletedWeek, storedMatchups]);

  const insights = computeStandingsInsights(teams);
  const hasDivisionData = teams.some((team) => team.divisionId !== null);
  const hasStandingsData = teams.some(
    (team) => team.record.wins + team.record.losses + team.record.ties > 0,
  );
  const preseasonDivisions = useMemo(() => groupTeamsByDivision(teams), [teams]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-2">Standings</h1>
      <p className="text-sm text-base-content/60 mb-4">
        {leagueSeason === null
          ? 'Live standings and division assignments from Sleeper.'
          : hasStandingsData
            ? 'Live seeds derived from Sleeper rosters and records.'
            : `${leagueSeason} preseason divisions from Sleeper. Live standings begin when Week 1 results are complete.`}
      </p>

      {isLoading && (
        <div className="flex justify-center py-10">
          <span className="loading loading-spinner loading-lg" />
        </div>
      )}

      {error && !isLoading && (
        <div className="alert alert-error mb-4">
          <span>Failed to load standings: {error}</span>
        </div>
      )}

      {!isLoading && !error && teams.length === 0 && (
        <p className="text-sm text-base-content/60">No teams found.</p>
      )}

      {!isLoading && !error && teams.length > 0 && (
        <>
          {insights && (
            <div className="grid gap-3 md:grid-cols-2 mb-4">
              <div className="card bg-base-200">
                <div className="card-body p-4">
                  <h3 className="card-title text-sm">Toughest Schedule (PA)</h3>
                  <p className="text-sm">
                    {insights.toughestSchedule.teamName} is eating{' '}
                    {insights.toughestSchedule.paPerGame.toFixed(1)} PA per week (league avg{' '}
                    {insights.leagueAvgPaPerGame.toFixed(1)}).
                  </p>
                </div>
              </div>
              <div className="card bg-base-200">
                <div className="card-body p-4">
                  <h3 className="card-title text-sm">Easiest Schedule (PA)</h3>
                  <p className="text-sm">
                    {insights.easiestSchedule.teamName} sees only{' '}
                    {insights.easiestSchedule.paPerGame.toFixed(1)} PA per week.
                  </p>
                </div>
              </div>
              <div className="card bg-base-200">
                <div className="card-body p-4">
                  <h3 className="card-title text-sm">Luckiest Record</h3>
                  <p className="text-sm">
                    {insights.luckiestRecord.teamName} is seeded #
                    {insights.luckiestRecord.standingRank} but sits #
                    {insights.luckiestRecord.pfRank} in PF (diff{' '}
                    {insights.luckiestRecord.fortuneScore}). Low PA and timing are doing work.
                  </p>
                </div>
              </div>
              <div className="card bg-base-200">
                <div className="card-body p-4">
                  <h3 className="card-title text-sm">Unluckiest Record</h3>
                  <p className="text-sm">
                    {insights.unluckiestRecord.teamName} owns #{insights.unluckiestRecord.pfRank} PF
                    but is seeded #{insights.unluckiestRecord.standingRank} (diff{' '}
                    {insights.unluckiestRecord.fortuneScore}). Running into weekly hammers.
                  </p>
                </div>
              </div>
            </div>
          )}
          {!hasStandingsData ? (
            <section aria-labelledby="preseason-divisions-heading" data-testid="division-preseason">
              {!hasDivisionData && (
                <div className="alert alert-warning mb-4">
                  <span>Sleeper did not return division assignments for any roster.</span>
                </div>
              )}
              <div className="mb-4">
                <h2 id="preseason-divisions-heading" className="text-lg font-semibold">
                  {leagueSeason ? `${leagueSeason} ` : ''}Preseason Divisions
                </h2>
                <p className="text-sm text-base-content/60">
                  Division assignments are live. Seeds, ranges, and performance stats will appear
                  once completed games create real standings.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                {preseasonDivisions.map((division) => (
                  <div
                    key={division.divisionId ?? 'unassigned'}
                    className="card border border-base-300 bg-base-200"
                  >
                    <div className="card-body gap-3 p-4">
                      <div className="flex items-center gap-3">
                        {division.divisionAvatarUrl ? (
                          <div className="avatar">
                            <div className="w-10 rounded">
                              <img src={division.divisionAvatarUrl} alt="" />
                            </div>
                          </div>
                        ) : null}
                        <div>
                          <h3 className="card-title text-base">{division.divisionName}</h3>
                          <p className="text-xs text-base-content/60">
                            {division.members.length}{' '}
                            {division.members.length === 1 ? 'team' : 'teams'}
                          </p>
                        </div>
                      </div>
                      <ul className="divide-y divide-base-300">
                        {division.members.map((team) => (
                          <li
                            key={team.sleeperRosterId}
                            className="flex items-center gap-2 py-2 first:pt-0 last:pb-0"
                          >
                            <TeamAvatars
                              teamName={team.teamName}
                              teamAvatarUrl={team.teamAvatarUrl}
                              userAvatarUrl={team.userAvatarUrl}
                              userDisplayName={team.ownerDisplayName}
                              showUserAvatar={false}
                              size="sm"
                            />
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium">{team.teamName}</div>
                              <div className="truncate text-xs text-base-content/60">
                                {team.ownerDisplayName}
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : hasDivisionData && insights ? (
            <>
              <div className="grid gap-3 md:grid-cols-2 mb-4">
                <div className="card bg-base-200">
                  <div className="card-body p-4">
                    <h3 className="card-title text-sm">Highest-Scoring Division</h3>
                    <div className="text-sm inline-flex items-center gap-2">
                      <span>
                        {insights.highestAvgPfDivision?.divisionName ?? 'Division unknown'} is
                        averaging {insights.highestAvgPfDivision?.avgPfPerGame.toFixed(1) ?? '-'} PF
                        per week; top seed is{' '}
                        {insights.highestAvgPfDivision?.topSeed.teamName ?? '-'}.
                      </span>
                    </div>
                  </div>
                </div>
                <div className="card bg-base-200">
                  <div className="card-body p-4">
                    <h3 className="card-title text-sm">Softest Division (PA)</h3>
                    <div className="text-sm inline-flex items-center gap-2">
                      <span>
                        {insights.lowestAvgPaDivision?.divisionName ?? 'Division unknown'} is seeing
                        only {insights.lowestAvgPaDivision?.avgPaPerGame.toFixed(1) ?? '-'} PA per
                        week.
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="overflow-auto overscroll-x-contain touch-pan-y max-h-[60vh] mb-6 border border-base-300 rounded-lg">
                <table className="table table-compact w-full">
                  <thead className="sticky top-0 z-10 bg-base-200">
                    <tr>
                      <th>Avatar</th>
                      <th>Division</th>
                      <th>Teams</th>
                      <th>Avg PF/Week</th>
                      <th>Avg PA/Week</th>
                      <th>Top Seed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {insights.divisionStats.map((div) => (
                      <tr key={div.divisionId}>
                        <td>
                          {div.divisionAvatarUrl ? (
                            <div className="avatar">
                              <div className="w-8 rounded">
                                <img src={div.divisionAvatarUrl} alt={div.divisionName} />
                              </div>
                            </div>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td>{div.divisionName}</td>
                        <td className="text-center">{div.members.length}</td>
                        <td>{div.avgPfPerGame.toFixed(1)}</td>
                        <td>{div.avgPaPerGame.toFixed(1)}</td>
                        <td>
                          ({div.topSeed.standingRank}) {div.topSeed.teamName}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="alert alert-warning mb-4">
              <span>Sleeper did not return division assignments for any roster.</span>
            </div>
          )}
          {hasStandingsData && (
            <>
              <div className="overflow-auto overscroll-x-contain touch-pan-y max-h-[70vh]">
                <table className="table table-zebra w-full">
                  <thead className="sticky top-0 z-10 bg-base-200">
                    <tr>
                      <th>Seed</th>
                      <th>Team</th>
                      <th>Division</th>
                      <th>B/W</th>
                      <th>Owner</th>
                      <th>Record</th>
                      <th>Points For</th>
                      <th>Points Against</th>
                      <th>Avg PF/Week</th>
                      <th>PA/PF</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teams.map((team) => {
                      const gamesPlayed = team.record.wins + team.record.losses + team.record.ties;
                      const avgPoints = gamesPlayed > 0 ? team.pointsFor / gamesPlayed : 0;
                      const paPfRatio =
                        team.pointsFor > 0 ? team.pointsAgainst / team.pointsFor : null;
                      const bw = bestWorstRange(team, teams, marginByTeam, latestCompletedWeek);

                      return (
                        <tr key={team.sleeperRosterId}>
                          <td className="font-semibold">{team.seed ?? team.rank}</td>
                          <td>
                            <div className="flex items-center gap-2">
                              <TeamAvatars
                                teamName={team.teamName}
                                teamAvatarUrl={team.teamAvatarUrl}
                                userAvatarUrl={team.userAvatarUrl}
                                userDisplayName={team.ownerDisplayName}
                                showUserAvatar={false}
                                size="md"
                              />
                              <span className="flex items-center gap-1">
                                {team.teamName}
                                <span className="flex items-center gap-0.5 text-[0.6rem] text-base-content/60">
                                  {teamBadges(team, bw).map((code) => (
                                    <span
                                      key={code}
                                      title={
                                        STANDINGS_GLOSSARY.find((g) => g.code === code)
                                          ?.description ?? ''
                                      }
                                    >
                                      {code}
                                    </span>
                                  ))}
                                </span>
                              </span>
                            </div>
                          </td>
                          <td>{team.divisionName ?? 'Unassigned'}</td>
                          <td className="text-sm text-base-content/80">
                            {bw.label}
                            {bw.statCorrectionRisk && (
                              <span className="ml-1 text-[0.65rem] text-base-content/60">sc</span>
                            )}
                          </td>
                          <td>
                            <div className="flex items-center gap-2">
                              {team.userAvatarUrl && (
                                <div className="avatar">
                                  <div className="w-8 rounded-full">
                                    <img src={team.userAvatarUrl} alt={team.ownerDisplayName} />
                                  </div>
                                </div>
                              )}
                              <span>{team.ownerDisplayName}</span>
                            </div>
                          </td>
                          <td>
                            {formatRecord(team.record)}
                            {bw.statCorrectionRisk && (
                              <span className="ml-1 text-[0.65rem] text-base-content/60">sc</span>
                            )}
                          </td>
                          <td>{team.pointsFor.toFixed(2)}</td>
                          <td>{team.pointsAgainst.toFixed(2)}</td>
                          <td>{avgPoints.toFixed(2)}</td>
                          <td>{paPfRatio !== null ? paPfRatio.toFixed(2) : '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="card bg-base-200 mt-4">
                <div className="card-body p-4 space-y-1">
                  <h3 className="card-title text-sm">Standings Glossary</h3>
                  <ul className="text-sm leading-snug space-y-1">
                    {STANDINGS_GLOSSARY.map((entry) => (
                      <li key={entry.code}>
                        <span className="font-semibold">{entry.code}</span> - {entry.description}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
