import type { SleeperMockDraftCandidate } from '../../draftIntel/sleeperMockDrafts';

export type MockDraftControlsProps = {
  canLoad: boolean;
  expectedDraftCount: number;
  draftInput: string;
  parsedDraftCount: number;
  duplicateDraftCount: number;
  inputError: string | null;
  candidates: SleeperMockDraftCandidate[];
  selectedDraftIds: ReadonlySet<string>;
  isLoading: boolean;
  error: string | null;
  onDraftInputChange: (value: string) => void;
  onLoad: () => void;
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
  expectedDraftCount,
  draftInput,
  parsedDraftCount,
  duplicateDraftCount,
  inputError,
  candidates,
  selectedDraftIds,
  isLoading,
  error,
  onDraftInputChange,
  onLoad,
  onToggle,
}: MockDraftControlsProps) {
  const compatibleCount = candidates.filter((candidate) => candidate.compatible).length;

  return (
    <section
      className="mb-5 rounded-box border border-base-300 bg-base-100 p-4"
      aria-labelledby="post-keeper-mocks-heading"
    >
      <div>
        <h3 id="post-keeper-mocks-heading" className="font-bold">
          Post-Keeper Mock Drafts
        </h3>
        <p className="mt-1 max-w-3xl text-xs text-base-content/60">
          Starts with the {expectedDraftCount.toString()} checked-in post-lock league mocks. Paste
          Sleeper draft URLs or IDs to replace the exact set. Every draft must match the league,
          creator, board, slot, timestamp, and complete keeper set.
        </p>
      </div>

      <label className="form-control mt-3" htmlFor="mock-drafts-to-include">
        <span className="label py-1 text-xs font-semibold">Mock Drafts to include</span>
        <textarea
          id="mock-drafts-to-include"
          className="textarea textarea-bordered min-h-24 font-mono text-xs"
          value={draftInput}
          placeholder="https://sleeper.com/draft/nfl/1400197747742654464"
          spellCheck={false}
          onChange={(event) => {
            onDraftInputChange(event.target.value);
          }}
        />
      </label>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-base-content/55">
          {parsedDraftCount.toString()} unique draft{parsedDraftCount === 1 ? '' : 's'} entered
          {duplicateDraftCount > 0
            ? ` - ${duplicateDraftCount.toString()} duplicate${duplicateDraftCount === 1 ? '' : 's'} ignored`
            : ''}
        </div>
        <button
          type="button"
          className="btn btn-outline btn-xs"
          disabled={!canLoad || isLoading}
          onClick={onLoad}
        >
          {isLoading ? 'Loading...' : 'Load and validate'}
        </button>
      </div>

      {!canLoad && (
        <p className="mt-3 text-sm text-base-content/60">
          Choose Your Team in Draft Intel onboarding to validate the curated mocks against your
          draft slot.
        </p>
      )}

      {(inputError || error) && (
        <div className="alert alert-warning mt-3 py-2 text-sm">
          <span>{inputError ?? error}</span>
        </div>
      )}

      {canLoad && !isLoading && !error && candidates.length === 0 && (
        <p className="mt-3 text-sm text-base-content/60">No post-lock mock drafts are loaded.</p>
      )}

      {candidates.length > 0 && (
        <>
          <div className="mt-3 text-xs font-semibold text-base-content/60">
            {selectedDraftIds.size.toString()} selected of {compatibleCount.toString()} compatible -{' '}
            {candidates.length.toString()} batch drafts loaded
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
                  <span className="block truncate font-mono text-[0.65rem] text-base-content/45">
                    {candidate.draftId}
                  </span>
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
