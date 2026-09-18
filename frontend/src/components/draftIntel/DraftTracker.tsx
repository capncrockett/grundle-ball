import type { DraftHistorySeason } from '../../data/draftHistoryTypes';
import type { DraftTrackerSnapshot } from '../../draftIntel/draftTracker';
import type { KeeperAdjustedDraftSlot } from '../../draftIntel/keeperAdjustedAdp';

export type DraftTrackerProps = {
  season: DraftHistorySeason;
  tracker: DraftTrackerSnapshot;
  remainingTeamPicks: KeeperAdjustedDraftSlot[];
  selectedRosterId: number | null;
  isRefreshing: boolean;
  isSyncEnabled: boolean;
  lastUpdatedAt: number | null;
  refreshIntervalMs: number;
  warning: string | null;
  onStartSync?: () => void;
};

const draftStatusLabel: Record<DraftHistorySeason['draftStatus'], string> = {
  pre_draft: 'Pre-draft',
  drafting: 'Live',
  paused: 'Paused',
  complete: 'Complete',
};

const draftStatusClass: Record<DraftHistorySeason['draftStatus'], string> = {
  pre_draft: 'badge-ghost',
  drafting: 'badge-success',
  paused: 'badge-warning',
  complete: 'badge-neutral',
};

const formatPick = (round: number, pickInRound: number, overallPick: number): string =>
  `${round.toString()}.${pickInRound.toString().padStart(2, '0')} #${overallPick.toString()}`;

const formatUpdatedAt = (value: number): string =>
  new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(value));

export function DraftTracker({
  season,
  tracker,
  remainingTeamPicks,
  selectedRosterId,
  isRefreshing,
  isSyncEnabled,
  lastUpdatedAt,
  refreshIntervalMs,
  warning,
  onStartSync,
}: DraftTrackerProps) {
  const nextTeam = tracker.nextPick
    ? season.teams.find((team) => team.rosterId === tracker.nextPick?.rosterId)
    : null;
  const latestTeam = tracker.latestPick
    ? season.teams.find((team) => team.rosterId === tracker.latestPick?.rosterId)
    : null;
  const myNextPick = remainingTeamPicks.at(0) ?? null;
  const progressMax = Math.max(1, tracker.totalOpenPickCount);
  const refreshSeconds = Math.max(1, Math.round(refreshIntervalMs / 1000));

  return (
    <section
      className="mb-5 rounded-box border border-base-300 bg-base-100 p-4 shadow-sm"
      aria-labelledby="draft-tracker-heading"
      aria-busy={isRefreshing}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 id="draft-tracker-heading" className="font-bold">
              Draft tracker
            </h3>
            <span className={`badge badge-sm ${draftStatusClass[season.draftStatus]}`}>
              {draftStatusLabel[season.draftStatus]}
            </span>
          </div>
          <p className="mt-1 text-xs text-base-content/55">
            {season.draftStatus === 'complete'
              ? 'The final Sleeper draft snapshot is loaded.'
              : isSyncEnabled
                ? `Syncing from Sleeper every ${refreshSeconds.toString()} seconds while this page is visible.`
                : onStartSync
                  ? 'When the live draft begins, start polling Sleeper with Draft started.'
                  : 'Using the loaded Sleeper draft snapshot.'}{' '}
            {lastUpdatedAt === null ? '' : `Updated ${formatUpdatedAt(lastUpdatedAt)}.`}
          </p>
        </div>
        {onStartSync && !isSyncEnabled && season.draftStatus !== 'complete' && (
          <button
            type="button"
            className="btn btn-success btn-sm"
            disabled={isRefreshing}
            onClick={onStartSync}
          >
            {isRefreshing && <span className="loading loading-spinner loading-xs" />}
            Draft started
          </button>
        )}
        {isSyncEnabled && season.draftStatus !== 'complete' && (
          <span className="badge badge-success gap-1.5 py-3 font-semibold" role="status">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-success-content" />
            Live sync on
          </span>
        )}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <progress
          className="progress progress-success h-2 flex-1"
          aria-label="Draft progress"
          value={Math.min(tracker.draftedCount, progressMax)}
          max={progressMax}
        />
        <span
          className="whitespace-nowrap font-mono text-xs font-bold"
          role="status"
          aria-live="polite"
        >
          {tracker.draftedCount.toString()} / {tracker.totalOpenPickCount.toString()} drafted
        </span>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <div className="rounded-box min-w-0 bg-base-200/60 px-3 py-2">
          <div className="text-[0.65rem] font-semibold uppercase text-base-content/50">
            {season.draftStatus === 'drafting' || season.draftStatus === 'paused'
              ? 'On the clock'
              : 'Next open pick'}
          </div>
          {tracker.nextPick ? (
            <>
              <div className="font-mono font-bold">
                {formatPick(
                  tracker.nextPick.round,
                  tracker.nextPick.pickInRound,
                  tracker.nextPick.overallPick,
                )}
              </div>
              <div className="truncate text-xs text-base-content/55">
                {nextTeam?.teamName ?? `Roster ${tracker.nextPick.rosterId.toString()}`}
              </div>
            </>
          ) : (
            <div className="font-semibold">Draft complete</div>
          )}
        </div>

        <div className="rounded-box min-w-0 bg-base-200/60 px-3 py-2">
          <div className="text-[0.65rem] font-semibold uppercase text-base-content/50">
            Latest pick
          </div>
          {tracker.latestPick ? (
            <>
              <div className="truncate font-bold">{tracker.latestPick.playerName}</div>
              <div className="truncate text-xs text-base-content/55">
                {formatPick(
                  tracker.latestPick.round,
                  ((tracker.latestPick.pickNo - 1) % season.teamCount) + 1,
                  tracker.latestPick.pickNo,
                )}{' '}
                - {latestTeam?.teamName ?? `Roster ${tracker.latestPick.rosterId.toString()}`}
              </div>
            </>
          ) : (
            <div className="font-semibold">No selections yet</div>
          )}
        </div>

        <div className="rounded-box min-w-0 bg-base-200/60 px-3 py-2">
          <div className="text-[0.65rem] font-semibold uppercase text-base-content/50">
            My next pick
          </div>
          {selectedRosterId === null ? (
            <div className="font-semibold">Choose Your Team</div>
          ) : myNextPick ? (
            <>
              <div className="font-mono font-bold">
                {formatPick(myNextPick.round, myNextPick.pickInRound, myNextPick.overallPick)}
              </div>
              <div className="text-xs text-base-content/55">
                {remainingTeamPicks.length.toString()} remaining Team pick
                {remainingTeamPicks.length === 1 ? '' : 's'}
              </div>
            </>
          ) : (
            <div className="font-semibold">No remaining picks</div>
          )}
        </div>
      </div>

      {warning && (
        <div className="alert alert-warning mt-3 py-2 text-sm" role="alert">
          <span>{warning}</span>
        </div>
      )}
    </section>
  );
}
