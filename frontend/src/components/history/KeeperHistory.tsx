import { useMemo, useState } from 'react';
import { buildKeeperLedger, getTeamForRoster } from '../../data/draftHistoryTransforms';
import type { DraftHistorySeason, KeeperLedgerEntry } from '../../data/draftHistoryTypes';
import { getPlayerPositionStyle } from './playerPositionStyles';

type KeeperHistoryProps = {
  seasons: DraftHistorySeason[];
};

const isProvisional = (entry: KeeperLedgerEntry): boolean =>
  entry.designations.some((designation) => designation.draftStatus !== 'complete');

export function KeeperHistory({ seasons }: KeeperHistoryProps) {
  const [rosterFilter, setRosterFilter] = useState<number | null>(null);
  const [playerFilter, setPlayerFilter] = useState('');
  const [currentOnly, setCurrentOnly] = useState(false);

  const currentSeason = seasons.at(0);
  const ledger = useMemo(() => buildKeeperLedger(seasons), [seasons]);
  const currentKeepers = useMemo(
    () => currentSeason?.picks.filter((pick) => pick.isKeeper) ?? [],
    [currentSeason],
  );
  const finalizedCount = seasons
    .filter((season) => season.draftStatus === 'complete')
    .reduce((total, season) => total + season.picks.filter((pick) => pick.isKeeper).length, 0);
  const teamsWithCurrentKeepers = new Set(currentKeepers.map((pick) => pick.rosterId)).size;

  const filteredLedger = ledger.filter((entry) => {
    if (rosterFilter !== null && entry.rosterId !== rosterFilter) return false;
    if (currentOnly && entry.designations.at(0)?.season !== currentSeason?.season) return false;
    const query = playerFilter.trim().toLowerCase();
    return !query || entry.playerName.toLowerCase().includes(query);
  });

  if (!currentSeason) {
    return <div className="alert">No keeper history is available.</div>;
  }

  return (
    <section aria-labelledby="keeper-history-heading">
      <div className="mb-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="keeper-history-heading" className="text-xl font-bold">
            Keeper History
          </h2>
          {currentSeason.draftStatus !== 'complete' && (
            <span className="badge badge-warning">Current designations are provisional</span>
          )}
        </div>
        <p className="mt-1 max-w-3xl text-sm text-base-content/60">
          A keeper season is recorded for the Team that received the keeper draft pick. This is a
          historical ledger, not an automatic eligibility ruling.
        </p>
      </div>

      <div className="stats stats-vertical mb-6 w-full border border-base-300 bg-base-100 shadow-sm sm:stats-horizontal">
        <div className="stat py-4">
          <div className="stat-title">{currentSeason.season} designations</div>
          <div className="stat-value text-warning">{currentKeepers.length.toString()}</div>
          <div className="stat-desc">
            Across {teamsWithCurrentKeepers.toString()} of {currentSeason.teamCount.toString()}{' '}
            Teams
          </div>
        </div>
        <div className="stat py-4">
          <div className="stat-title">Finalized keeper seasons</div>
          <div className="stat-value">{finalizedCount.toString()}</div>
          <div className="stat-desc">Completed Sleeper drafts</div>
        </div>
        <div className="stat py-4">
          <div className="stat-title">Team-player histories</div>
          <div className="stat-value">{ledger.length.toString()}</div>
          <div className="stat-desc">Tracked independently by Team</div>
        </div>
      </div>

      <div className="mb-8">
        <h3 className="mb-3 text-lg font-bold">{currentSeason.season} Team Designations</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[...currentSeason.teams]
            .sort((a, b) => a.teamName.localeCompare(b.teamName))
            .map((team) => {
              const picks = currentKeepers
                .filter((pick) => pick.rosterId === team.rosterId)
                .sort((a, b) => a.round - b.round);
              return (
                <article
                  key={team.rosterId}
                  className={`card border bg-base-100 shadow-sm ${
                    picks.length > 0 ? 'border-warning/50' : 'border-base-300'
                  }`}
                >
                  <div className="card-body gap-2 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="truncate font-bold" title={team.teamName}>
                          {team.teamName}
                        </h4>
                        <p className="truncate text-xs text-base-content/55">{team.managerName}</p>
                      </div>
                      <span className="badge badge-sm whitespace-nowrap">
                        {picks.length.toString()} set
                      </span>
                    </div>
                    {picks.length === 0 ? (
                      <p className="py-3 text-sm italic text-base-content/40">
                        No designation on the board
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {picks.map((pick) => {
                          const history = ledger.find(
                            (entry) =>
                              entry.rosterId === pick.rosterId && entry.playerId === pick.playerId,
                          );
                          return (
                            <li key={pick.playerId} className="rounded-box bg-warning/10 px-3 py-2">
                              <div className="flex items-center justify-between gap-2">
                                <span className="truncate text-sm font-semibold">
                                  {pick.playerName}
                                </span>
                                <span className="text-xs font-bold">
                                  Rd {pick.round.toString()}
                                </span>
                              </div>
                              <div className="mt-0.5 text-[0.68rem] text-base-content/55">
                                {history?.designations.length.toString() ?? '1'} recorded keeper
                                {history?.designations.length === 1 ? ' season' : ' seasons'} with
                                this Team
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </article>
              );
            })}
        </div>
      </div>

      <div className="mb-3 flex flex-col gap-3 rounded-box border border-base-300 bg-base-100 p-3 lg:flex-row lg:items-end">
        <label className="form-control flex-1">
          <span className="label py-1 text-xs font-medium">Team</span>
          <select
            className="select select-bordered select-sm"
            aria-label="Filter keeper history by team"
            value={rosterFilter ?? ''}
            onChange={(event) => {
              setRosterFilter(event.target.value ? Number(event.target.value) : null);
            }}
          >
            <option value="">All Teams</option>
            {[...currentSeason.teams]
              .sort((a, b) => a.teamName.localeCompare(b.teamName))
              .map((team) => (
                <option key={team.rosterId} value={team.rosterId}>
                  {team.teamName}
                </option>
              ))}
          </select>
        </label>
        <label className="form-control flex-1">
          <span className="label py-1 text-xs font-medium">Player</span>
          <input
            className="input input-bordered input-sm"
            aria-label="Filter keeper history by player"
            type="search"
            placeholder="Search player name"
            value={playerFilter}
            onChange={(event) => {
              setPlayerFilter(event.target.value);
            }}
          />
        </label>
        <label className="label cursor-pointer justify-start gap-3 rounded-box border border-base-300 px-3 py-2">
          <input
            type="checkbox"
            className="checkbox checkbox-sm"
            checked={currentOnly}
            onChange={(event) => {
              setCurrentOnly(event.target.checked);
            }}
          />
          <span className="label-text whitespace-nowrap">Current season only</span>
        </label>
      </div>

      <div className="overflow-x-auto rounded-box border border-base-300 bg-base-100">
        <table className="table table-zebra">
          <thead>
            <tr>
              <th>Player</th>
              <th>Team</th>
              <th>Keeper seasons</th>
              <th>Latest</th>
            </tr>
          </thead>
          <tbody>
            {filteredLedger.map((entry) => {
              const currentTeam = getTeamForRoster(currentSeason, entry.rosterId);
              const latest = entry.designations.at(0);
              const positionStyle = getPlayerPositionStyle(entry.position);
              return (
                <tr key={`${entry.rosterId.toString()}:${entry.playerId}`}>
                  <td>
                    <div className="font-semibold">{entry.playerName}</div>
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-base-content/50">
                      <span className={`badge badge-xs ${positionStyle.badgeClassName}`}>
                        {positionStyle.label}
                      </span>
                      {entry.nflTeam && <span>{entry.nflTeam}</span>}
                    </div>
                  </td>
                  <td>
                    <div>{currentTeam?.teamName ?? entry.teamName}</div>
                    <div className="text-xs text-base-content/45">
                      Team {entry.rosterId.toString()}
                    </div>
                  </td>
                  <td>
                    <div className="flex min-w-52 flex-wrap gap-1">
                      {entry.designations.map((designation) => (
                        <span
                          key={`${designation.season}:${designation.pickNo.toString()}`}
                          className={`badge badge-sm ${
                            designation.draftStatus === 'complete' ? 'badge-ghost' : 'badge-warning'
                          }`}
                        >
                          {designation.season} - Rd {designation.round.toString()}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <div>{latest?.season ?? 'Unknown'}</div>
                    {isProvisional(entry) && (
                      <span className="badge badge-warning badge-xs">Provisional</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredLedger.length === 0 && (
          <p className="p-8 text-center text-sm text-base-content/55">
            No keeper history matches those filters.
          </p>
        )}
      </div>
    </section>
  );
}
