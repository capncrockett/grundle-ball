import { useMemo, useState } from 'react';
import { getDraftPickNumber, getTeamForRoster } from '../../data/draftHistoryTransforms';
import type {
  DraftHistoryPick,
  DraftHistorySeason,
  DraftHistoryTeam,
} from '../../data/draftHistoryTypes';
import {
  DRAFT_POSITION_LEGEND,
  getLegendPositionStyle,
  getPlayerPositionStyle,
} from './playerPositionStyles';

type DraftBoardProps = {
  season: DraftHistorySeason;
};

const draftStatusLabel = (status: DraftHistorySeason['draftStatus']): string => {
  if (status === 'pre_draft') return 'Pre-draft';
  return status.charAt(0).toUpperCase() + status.slice(1);
};

const formatDraftDate = (startTime: number | null): string => {
  if (!startTime) return 'Date unavailable';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(startTime));
};

const abbreviation = (team: DraftHistoryTeam | undefined, draftSlot: number): string => {
  const value = team?.teamName || `Slot ${draftSlot.toString()}`;
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('');
};

type DraftPickCellProps = {
  pick: DraftHistoryPick | undefined;
  pickNo: number;
  slotTeam: DraftHistoryTeam | undefined;
  destinationTeam: DraftHistoryTeam | undefined;
  dimmed: boolean;
};

function DraftPickCell({ pick, pickNo, slotTeam, destinationTeam, dimmed }: DraftPickCellProps) {
  if (!pick) {
    return (
      <div className="min-h-[4.75rem] border-r border-b border-base-300/70 bg-base-100/35 p-1.5 text-base-content/30">
        <span className="text-[0.6rem] font-mono">#{pickNo.toString()}</span>
      </div>
    );
  }

  const traded = destinationTeam && slotTeam?.rosterId !== destinationTeam.rosterId;
  const positionStyle = getPlayerPositionStyle(pick.position);

  return (
    <div
      className={`min-h-[4.75rem] border-r border-b border-l-4 border-r-base-300/70 border-b-base-300/70 p-1.5 transition-opacity ${positionStyle.cellClassName} ${
        pick.isKeeper ? 'ring-1 ring-inset ring-warning/70' : ''
      } ${dimmed ? 'opacity-25' : ''}`}
      data-keeper={pick.isKeeper ? 'true' : 'false'}
      data-position={positionStyle.label}
    >
      <div className="mb-0.5 flex items-center justify-between gap-1 text-[0.6rem] text-base-content/55">
        <span className="font-mono">#{pick.pickNo.toString()}</span>
        {pick.isKeeper && <span className="badge badge-warning badge-xs">Keeper</span>}
      </div>
      <div className="line-clamp-2 text-xs font-semibold leading-tight" title={pick.playerName}>
        {pick.playerName}
      </div>
      <div className="mt-1 flex items-center gap-1">
        <span className={`badge badge-xs ${positionStyle.badgeClassName}`}>
          {positionStyle.label}
        </span>
        {pick.nflTeam && (
          <span className="truncate text-[0.6rem] font-medium uppercase text-base-content/55">
            {pick.nflTeam}
          </span>
        )}
      </div>
      {traded && (
        <div className="mt-1 truncate text-[0.6rem] text-info" title={destinationTeam.teamName}>
          To {destinationTeam.teamName}
        </div>
      )}
    </div>
  );
}

export function DraftBoard({ season }: DraftBoardProps) {
  const [highlightedRosterId, setHighlightedRosterId] = useState<number | null>(null);
  const [keepersOnly, setKeepersOnly] = useState(false);

  const picksByCell = useMemo(
    () =>
      new Map(
        season.picks.map((pick) => [`${pick.round.toString()}:${pick.draftSlot.toString()}`, pick]),
      ),
    [season.picks],
  );
  const keeperCount = season.picks.filter((pick) => pick.isKeeper).length;
  const draftSlots = Array.from({ length: season.teamCount }, (_, index) => {
    const draftSlot = index + 1;
    return (
      season.draftSlots.find((slot) => slot.draftSlot === draftSlot) ?? {
        draftSlot,
        rosterId: draftSlot,
      }
    );
  });

  return (
    <section aria-labelledby="draftboard-heading">
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_auto_auto] xl:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="draftboard-heading" className="text-xl font-bold">
              {season.season} Draftboard
            </h2>
            <span
              className={`badge ${season.draftStatus === 'complete' ? 'badge-success' : 'badge-warning'}`}
            >
              {draftStatusLabel(season.draftStatus)}
            </span>
          </div>
          <p className="mt-1 text-sm text-base-content/60">
            {formatDraftDate(season.startTime)} - {season.teamCount.toString()} teams -{' '}
            {season.rounds.toString()} rounds - {keeperCount.toString()} keeper
            {keeperCount === 1 ? '' : 's'}
          </p>
        </div>

        <label className="form-control w-full sm:max-w-xs">
          <span className="label py-1 text-xs font-medium">Highlight Team</span>
          <select
            className="select select-bordered select-sm"
            aria-label="Highlight team"
            value={highlightedRosterId ?? ''}
            onChange={(event) => {
              setHighlightedRosterId(event.target.value ? Number(event.target.value) : null);
            }}
          >
            <option value="">All teams</option>
            {[...season.teams]
              .sort((a, b) => a.teamName.localeCompare(b.teamName))
              .map((team) => (
                <option key={team.rosterId} value={team.rosterId}>
                  {team.teamName}
                </option>
              ))}
          </select>
        </label>

        <label className="label cursor-pointer justify-start gap-3 rounded-box border border-base-300 bg-base-100 px-3 py-2">
          <input
            type="checkbox"
            className="toggle toggle-warning toggle-sm"
            checked={keepersOnly}
            onChange={(event) => {
              setKeepersOnly(event.target.checked);
            }}
          />
          <span className="label-text whitespace-nowrap">Focus keepers</span>
        </label>
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-base-content/55">
        <span className="font-medium text-base-content/70">Positions</span>
        {DRAFT_POSITION_LEGEND.map((position) => {
          const style = getLegendPositionStyle(position);
          return (
            <span key={position} className={`badge badge-xs ${style.badgeClassName}`}>
              {position}
            </span>
          );
        })}
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm ring-1 ring-inset ring-warning/70" /> Keeper
          designation
        </span>
        <span>Traded picks show their destination Team.</span>
        {season.draftStatus !== 'complete' && <span>Empty slots have not been drafted.</span>}
      </div>

      <div
        className="max-h-[68vh] overflow-auto rounded-box border border-base-300 bg-base-200 shadow-sm"
        role="region"
        aria-label={`${season.season} draftboard`}
        tabIndex={0}
      >
        <div
          className="grid w-full"
          style={{
            gridTemplateColumns: `3rem repeat(${season.teamCount.toString()}, minmax(6.25rem, 1fr))`,
            minWidth: `${(3 + season.teamCount * 6.25).toString()}rem`,
          }}
        >
          <div className="sticky left-0 top-0 z-30 flex min-h-[4.75rem] items-center justify-center border-r border-b border-base-300 bg-base-300 px-1 text-[0.65rem] font-bold uppercase tracking-wide">
            Rd
          </div>
          {draftSlots.map((slot) => {
            const team = getTeamForRoster(season, slot.rosterId);
            const selected = highlightedRosterId === slot.rosterId;
            return (
              <div
                key={slot.draftSlot}
                className={`sticky top-0 z-20 min-h-[4.75rem] border-r border-b border-base-300 p-1.5 ${
                  selected ? 'bg-primary text-primary-content' : 'bg-base-300'
                }`}
                title={
                  team && team.managerName !== team.teamName
                    ? `${team.teamName} - ${team.managerName}`
                    : team?.teamName
                }
              >
                <div className="mb-1 flex items-center gap-1.5">
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[0.6rem] font-bold ${
                      selected ? 'bg-primary-content/20' : 'bg-base-100'
                    }`}
                  >
                    {abbreviation(team, slot.draftSlot)}
                  </span>
                  <span className="text-[0.6rem] font-mono opacity-60">
                    {slot.draftSlot.toString()}
                  </span>
                </div>
                <div
                  className="line-clamp-2 text-[0.7rem] font-bold leading-tight"
                  title={team?.teamName}
                >
                  {team?.teamName ?? `Roster ${slot.rosterId.toString()}`}
                </div>
              </div>
            );
          })}

          {Array.from({ length: season.rounds }, (_, roundIndex) => roundIndex + 1).flatMap(
            (round) => {
              const roundLabel = (
                <div
                  key={`round-${round.toString()}`}
                  className="sticky left-0 z-10 flex min-h-[4.75rem] items-center justify-center border-r border-b border-base-300 bg-base-300 text-base font-black"
                >
                  {round.toString()}
                </div>
              );
              const cells = draftSlots.map((slot) => {
                const pick = picksByCell.get(`${round.toString()}:${slot.draftSlot.toString()}`);
                const slotTeam = getTeamForRoster(season, slot.rosterId);
                const destinationTeam = pick ? getTeamForRoster(season, pick.rosterId) : undefined;
                const dimmed =
                  (highlightedRosterId !== null && pick?.rosterId !== highlightedRosterId) ||
                  (keepersOnly && pick?.isKeeper !== true);
                return (
                  <DraftPickCell
                    key={`${round.toString()}:${slot.draftSlot.toString()}`}
                    pick={pick}
                    pickNo={getDraftPickNumber(round, slot.draftSlot, season.teamCount)}
                    slotTeam={slotTeam}
                    destinationTeam={destinationTeam}
                    dimmed={dimmed}
                  />
                );
              });
              return [roundLabel, ...cells];
            },
          )}
        </div>
      </div>
    </section>
  );
}
