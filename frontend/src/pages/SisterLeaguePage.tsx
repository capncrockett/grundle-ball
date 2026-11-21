// frontend/src/pages/SisterLeaguePage.tsx
//
// Staging-only /local/sister-league page for the Sister League, a separate
// ESPN-hosted league (not the Grundle League), gated like Draft Intel. It renders the checked-in
// snapshot from `npm run sister:update`; it never calls ESPN from the
// browser. Odds come from a deterministic in-browser simulation of the
// remaining schedule (see sisterLeague/projections.ts).

import { useMemo } from 'react';
import { SisterLeagueRacePanel } from '../components/sisterLeague/SisterLeagueRacePanel';
import sisterLeagueData from '../data/sisterLeagueSnapshot.json';
import { computeTeamScoring, leagueMedianScore, simulateSeason } from '../sisterLeague/projections';
import { buildSisterLeagueRaces, formatOdds } from '../sisterLeague/races';
import {
  computeSisterLeagueSeedRanges,
  type SisterLeagueSnapshot,
  type SisterLeagueSeedRange,
} from '../sisterLeague/sisterLeague';

const DEFAULT_SNAPSHOT: SisterLeagueSnapshot = sisterLeagueData;

const formatSnapshotTime = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'an unknown time';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(parsed);
};

const formatRecord = (wins: number, losses: number, ties: number): string =>
  ties > 0
    ? `${wins.toString()}-${losses.toString()}-${ties.toString()}`
    : `${wins.toString()}-${losses.toString()}`;

const StatusBadge = ({ range }: { range: SisterLeagueSeedRange }) => {
  if (range.clinched) return <span className="badge badge-success badge-sm">Clinched</span>;
  if (range.eliminated) return <span className="badge badge-ghost badge-sm">Out</span>;
  return null;
};

type SisterLeaguePageProps = {
  snapshot?: SisterLeagueSnapshot;
  simulationRuns?: number;
};

export function SisterLeaguePage({
  snapshot = DEFAULT_SNAPSHOT,
  simulationRuns = 10000,
}: SisterLeaguePageProps) {
  const ranges = useMemo(
    () => new Map(computeSisterLeagueSeedRanges(snapshot).map((range) => [range.teamId, range])),
    [snapshot],
  );
  const teams = useMemo(
    () => [...snapshot.teams].sort((a, b) => a.seed - b.seed),
    [snapshot.teams],
  );
  const teamsById = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams]);
  const scoring = useMemo(() => computeTeamScoring(snapshot), [snapshot]);
  const simulation = useMemo(
    () => simulateSeason(snapshot, { runs: simulationRuns }),
    [snapshot, simulationRuns],
  );
  const races = useMemo(
    () => buildSisterLeagueRaces(snapshot, simulation, scoring, ranges),
    [snapshot, simulation, scoring, ranges],
  );
  const medianScore = useMemo(() => leagueMedianScore(snapshot), [snapshot]);
  const week = Math.min(snapshot.currentMatchupPeriod, snapshot.regularSeasonWeeks);
  const byeCount = snapshot.playoffByeCount;
  const seasonOver = simulation.remainingGames.length === 0;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="mb-4">
        <span className="flex gap-1 mb-1">
          <span className="badge badge-secondary badge-sm">Staging</span>
          <span className="badge badge-accent badge-sm">Sister League</span>
        </span>
        <h1 className="text-2xl font-bold">{snapshot.leagueName}</h1>
        <p className="text-sm text-base-content/70">
          ESPN snapshot, week {week.toString()} of {snapshot.regularSeasonWeeks.toString()}. Top{' '}
          {snapshot.playoffTeamCount.toString()} make the playoffs
          {byeCount > 0 ? ` and the top ${byeCount.toString()} get a first-round bye` : ''}. Updated{' '}
          {formatSnapshotTime(snapshot.fetchedAt)}.
        </p>
      </div>

      <div className="overflow-auto overscroll-x-contain touch-pan-x touch-pan-y border border-base-300 rounded-lg bg-base-100">
        <table className="table table-zebra w-full" aria-label="Standings">
          <thead>
            <tr>
              <th>Seed</th>
              <th>Team</th>
              <th>Record</th>
              <th className="text-right">PF</th>
              <th className="text-right">Playoffs</th>
              {byeCount > 0 && <th className="text-right">Bye</th>}
              <th className="text-center">B-W</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {teams.map((team) => {
              const range = ranges.get(team.id);
              const outlook = simulation.outlooks.get(team.id);
              const isCutLine = team.seed === snapshot.playoffTeamCount;
              return (
                <tr key={team.id} className={isCutLine ? 'border-b-2 border-b-primary' : undefined}>
                  <td className="font-semibold">{team.seed}</td>
                  <td>{team.name}</td>
                  <td className="whitespace-nowrap">
                    {formatRecord(team.wins, team.losses, team.ties)}
                  </td>
                  <td className="text-right tabular-nums">{team.pointsFor.toFixed(2)}</td>
                  <td className="text-right tabular-nums">
                    {outlook && range
                      ? formatOdds(outlook.playoffOdds, {
                          clinched: range.clinched,
                          eliminated: range.eliminated,
                        })
                      : '-'}
                  </td>
                  {byeCount > 0 && (
                    <td className="text-right tabular-nums">
                      {outlook && range
                        ? formatOdds(outlook.byeOdds, {
                            clinched: range.worst <= byeCount,
                            eliminated: range.best > byeCount,
                          })
                        : '-'}
                    </td>
                  )}
                  <td className="text-center font-mono">{range?.label ?? '-'}</td>
                  <td>{range && <StatusBadge range={range} />}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {races.bubble && (
        <SisterLeagueRacePanel
          heading="Bubble Watch"
          description={`Teams still fighting over the top ${snapshot.playoffTeamCount.toString()}. Tap a team for what has to break their way.`}
          race={races.bubble}
          teamsById={teamsById}
          scoring={scoring}
        />
      )}
      {races.bye && (
        <SisterLeagueRacePanel
          heading="Bye Chase"
          description={`Teams still in the hunt for the top ${byeCount.toString()} seeds and a first-round bye.`}
          race={races.bye}
          teamsById={teamsById}
          scoring={scoring}
        />
      )}

      <section className="mt-6" aria-label="Season scoring">
        <h2 className="text-lg font-bold">Season Scoring</h2>
        <p className="text-xs text-base-content/70 mb-2">
          Weekly scores from completed games. League median week: {medianScore.toFixed(1)}.
        </p>
        <div className="overflow-auto overscroll-x-contain touch-pan-x touch-pan-y border border-base-300 rounded-lg bg-base-100">
          <table className="table table-zebra table-sm w-full">
            <thead>
              <tr>
                <th>Team</th>
                <th className="text-right">Avg</th>
                <th className="text-right">Median</th>
                <th className="text-right">High</th>
                <th className="text-right">Low</th>
              </tr>
            </thead>
            <tbody>
              {[...scoring.values()]
                .sort((a, b) => b.average - a.average)
                .map((entry) => (
                  <tr key={entry.teamId}>
                    <td>{teamsById.get(entry.teamId)?.name ?? entry.teamId}</td>
                    <td className="text-right tabular-nums">{entry.average.toFixed(1)}</td>
                    <td className="text-right tabular-nums">{entry.median.toFixed(1)}</td>
                    <td className="text-right tabular-nums">{entry.high.toFixed(1)}</td>
                    <td className="text-right tabular-nums">{entry.low.toFixed(1)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mt-4 text-xs text-base-content/70 space-y-1">
        {!seasonOver && (
          <p>
            <span className="font-semibold">Playoffs</span> and{' '}
            <span className="font-semibold">Bye</span> are the share of{' '}
            {simulation.runs.toLocaleString()} simulated finishes to the regular season. Each
            remaining game is played out with every team scoring around its own season average
            (nudged slightly toward the league average) with its own week-to-week swings. They are
            estimates, not guarantees.
          </p>
        )}
        <p>
          <span className="font-semibold">B-W</span> is the best and worst possible final seed. Best
          assumes the team wins every remaining game while everyone else loses; worst assumes the
          reverse. Seeds go by record, then total points scored.
        </p>
        <p>The line under seed {snapshot.playoffTeamCount.toString()} marks the playoff cut.</p>
        <p>This league is hosted on ESPN and is not part of the Grundle League.</p>
      </div>
    </div>
  );
}

export default SisterLeaguePage;
