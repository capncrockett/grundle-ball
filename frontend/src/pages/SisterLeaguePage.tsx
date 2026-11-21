// frontend/src/pages/SisterLeaguePage.tsx
//
// Public, unlisted /sister-league page for the Sister League, a separate
// ESPN-hosted league (not the
// Grundle League). It renders the checked-in snapshot from
// `npm run sister:update`; it never calls ESPN from the browser.

import { useMemo } from 'react';
import sisterLeagueData from '../data/sisterLeagueSnapshot.json';
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
};

export function SisterLeaguePage({ snapshot = DEFAULT_SNAPSHOT }: SisterLeaguePageProps) {
  const ranges = useMemo(
    () => new Map(computeSisterLeagueSeedRanges(snapshot).map((range) => [range.teamId, range])),
    [snapshot],
  );
  const teams = useMemo(
    () => [...snapshot.teams].sort((a, b) => a.seed - b.seed),
    [snapshot.teams],
  );
  const week = Math.min(snapshot.currentMatchupPeriod, snapshot.regularSeasonWeeks);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="mb-4">
        <span className="badge badge-accent badge-sm mb-1">Sister League</span>
        <h1 className="text-2xl font-bold">{snapshot.leagueName}</h1>
        <p className="text-sm text-base-content/70">
          ESPN snapshot, week {week.toString()} of {snapshot.regularSeasonWeeks.toString()}. Top{' '}
          {snapshot.playoffTeamCount.toString()} make the playoffs. Updated{' '}
          {formatSnapshotTime(snapshot.fetchedAt)}.
        </p>
      </div>

      <div className="overflow-auto overscroll-x-contain touch-pan-x touch-pan-y border border-base-300 rounded-lg bg-base-100">
        <table className="table table-zebra w-full">
          <thead>
            <tr>
              <th>Seed</th>
              <th>Team</th>
              <th>Record</th>
              <th className="text-right">PF</th>
              <th className="text-center">B-W</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {teams.map((team) => {
              const range = ranges.get(team.id);
              const isCutLine = team.seed === snapshot.playoffTeamCount;
              return (
                <tr key={team.id} className={isCutLine ? 'border-b-2 border-b-primary' : undefined}>
                  <td className="font-semibold">{team.seed}</td>
                  <td>{team.name}</td>
                  <td className="whitespace-nowrap">
                    {formatRecord(team.wins, team.losses, team.ties)}
                  </td>
                  <td className="text-right tabular-nums">{team.pointsFor.toFixed(2)}</td>
                  <td className="text-center font-mono">{range?.label ?? '-'}</td>
                  <td>{range && <StatusBadge range={range} />}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 text-xs text-base-content/70 space-y-1">
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
