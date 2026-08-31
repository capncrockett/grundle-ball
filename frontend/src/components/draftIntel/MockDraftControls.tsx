import type { SleeperMockDraftCandidate } from '../../draftIntel/sleeperMockDrafts';

export type MockDraftControlsProps = {
  canLoad: boolean;
  candidates: SleeperMockDraftCandidate[];
  selectedDraftIds: ReadonlySet<string>;
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
  onToggle: (draftId: string, selected: boolean) => void;
};

const formatCreatedAt = (value: number): string =>
  new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));

export function MockDraftControls({
  canLoad,
  candidates,
  selectedDraftIds,
  isLoading,
  error,
  onRefresh,
  onToggle,
}: MockDraftControlsProps) {
  const compatibleCount = candidates.filter((candidate) => candidate.compatible).length;

  return (
    <section
      className="mb-5 rounded-box border border-base-300 bg-base-100 p-4"
      aria-labelledby="post-keeper-mocks-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="post-keeper-mocks-heading" className="font-bold">
            Post-Keeper Mock Drafts
          </h3>
          <p className="mt-1 max-w-3xl text-xs text-base-content/60">
            Sleeper has no documented mock flag. Candidates are completed user drafts not attached
            to the user's current league list. Only exact draft size, slot, and keeper-board matches
            can be selected.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-outline btn-xs"
          disabled={!canLoad || isLoading}
          onClick={onRefresh}
        >
          {isLoading ? 'Refreshing...' : 'Refresh mocks'}
        </button>
      </div>

      {!canLoad && (
        <p className="mt-3 text-sm text-base-content/60">
          Choose Your Team in Draft Intel onboarding to find that Sleeper user's mocks.
        </p>
      )}

      {error && (
        <div className="alert alert-warning mt-3 py-2 text-sm">
          <span>{error}</span>
        </div>
      )}

      {canLoad && !isLoading && !error && candidates.length === 0 && (
        <p className="mt-3 text-sm text-base-content/60">
          No unlinked mock-draft candidates found for this season. Run mocks in Sleeper, then
          refresh.
        </p>
      )}

      {candidates.length > 0 && (
        <>
          <div className="mt-3 text-xs font-semibold text-base-content/60">
            {selectedDraftIds.size.toString()} selected of {compatibleCount.toString()} compatible -{' '}
            {candidates.length.toString()} candidates found
          </div>
          <div className="mt-2 grid gap-2 lg:grid-cols-2">
            {candidates.map((candidate) => (
              <label
                key={candidate.draftId}
                className={`flex gap-3 rounded-box border p-3 ${
                  candidate.compatible
                    ? 'cursor-pointer border-base-300'
                    : 'border-warning/40 bg-warning/5'
                }`}
              >
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm mt-0.5"
                  disabled={!candidate.compatible}
                  checked={selectedDraftIds.has(candidate.draftId)}
                  onChange={(event) => {
                    onToggle(candidate.draftId, event.target.checked);
                  }}
                />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{candidate.name}</span>
                  <span className="block text-xs text-base-content/55">
                    {formatCreatedAt(candidate.createdAt)} -{' '}
                    {candidate.teamCount?.toString() ?? '?'} Teams -{' '}
                    {candidate.rounds?.toString() ?? '?'} rounds - slot{' '}
                    {candidate.draftSlot?.toString() ?? '?'}
                  </span>
                  {!candidate.compatible && (
                    <span className="mt-1 block text-xs text-warning">
                      {candidate.compatibilityIssues.join('; ')}
                    </span>
                  )}
                </span>
              </label>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
