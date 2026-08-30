import { useEffect, useMemo, useState } from 'react';
import {
  getDraft,
  getDraftPicks,
  getLeague,
  getLeagueRosters,
  getLeagueUsers,
} from '../api/sleeper';
import { DraftBoard } from '../components/history/DraftBoard';
import { KeeperHistory } from '../components/history/KeeperHistory';
import { LEAGUE_ID } from '../config/league';
import { DRAFT_HISTORY } from '../data/draftHistory';
import { buildDraftHistorySeason, mergeLiveDraftSeason } from '../data/draftHistoryTransforms';
import type { DraftHistorySeason, DraftHistorySnapshot } from '../data/draftHistoryTypes';
import { findKeeperRuleViolations } from '../data/keeperRuleValidation';

type HistoryView = 'draftboard' | 'keepers';

type HistoryPageProps = {
  initialHistory?: DraftHistorySnapshot;
  refreshLive?: boolean;
};

const formatSnapshotTime = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'the stored archive';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(parsed);
};

export function HistoryPage({
  initialHistory = DRAFT_HISTORY,
  refreshLive = true,
}: HistoryPageProps) {
  const [history, setHistory] = useState(initialHistory);
  const [activeView, setActiveView] = useState<HistoryView>('draftboard');
  const [selectedSeason, setSelectedSeason] = useState(initialHistory.seasons[0]?.season ?? '');
  const [isRefreshing, setIsRefreshing] = useState(refreshLive);
  const [liveError, setLiveError] = useState<string | null>(null);

  useEffect(() => {
    if (!refreshLive) return;

    async function refreshCurrentDraft() {
      try {
        setIsRefreshing(true);
        setLiveError(null);
        const league = await getLeague(LEAGUE_ID);
        const [draft, picks, users, rosters] = await Promise.all([
          getDraft(league.draft_id),
          getDraftPicks(league.draft_id),
          getLeagueUsers(league.league_id),
          getLeagueRosters(league.league_id),
        ]);
        const liveSeason = buildDraftHistorySeason(league, draft, picks, users, rosters);
        setHistory((current) => mergeLiveDraftSeason(current, liveSeason));
      } catch (error) {
        setLiveError(error instanceof Error ? error.message : 'Unknown Sleeper error');
      } finally {
        setIsRefreshing(false);
      }
    }

    void refreshCurrentDraft();
  }, [refreshLive]);

  const selectedDraft = useMemo<DraftHistorySeason | undefined>(
    () =>
      history.seasons.find((season) => season.season === selectedSeason) ?? history.seasons.at(0),
    [history.seasons, selectedSeason],
  );
  const keeperViolations = useMemo(
    () => findKeeperRuleViolations(history.seasons),
    [history.seasons],
  );

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold">League History</h1>
          <p className="mt-1 max-w-3xl text-sm text-base-content/60">
            Every canonical Grundle draft on Sleeper, with keeper designations tracked by Team.
          </p>
        </div>
        <div className="text-xs text-base-content/50">
          {isRefreshing ? (
            <span className="flex items-center gap-2">
              <span className="loading loading-spinner loading-xs" /> Refreshing the current draft
            </span>
          ) : liveError ? (
            <span>Stored archive from {formatSnapshotTime(history.generatedAt)}</span>
          ) : (
            <span className="flex items-center gap-2">
              <span className="status status-success" /> Current season refreshed from Sleeper
            </span>
          )}
        </div>
      </div>

      {liveError && (
        <div className="alert alert-warning mb-4">
          <span>Live keeper refresh failed. Showing the stored snapshot instead: {liveError}</span>
        </div>
      )}

      <div role="tablist" aria-label="League history views" className="tabs tabs-box mb-4 w-fit">
        <button
          type="button"
          role="tab"
          aria-selected={activeView === 'draftboard'}
          className={`tab ${activeView === 'draftboard' ? 'tab-active' : ''}`}
          onClick={() => {
            setActiveView('draftboard');
          }}
        >
          Draftboard
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeView === 'keepers'}
          className={`tab ${activeView === 'keepers' ? 'tab-active' : ''}`}
          onClick={() => {
            setActiveView('keepers');
          }}
        >
          Keeper History
          {keeperViolations.length > 0 && (
            <span className="badge badge-error badge-xs ml-1" aria-hidden="true">
              {keeperViolations.length.toString()}
            </span>
          )}
        </button>
      </div>

      {activeView === 'draftboard' && (
        <>
          <div className="mb-5 overflow-x-auto pb-1">
            <div className="join min-w-max" aria-label="Draft season">
              {history.seasons.map((season) => (
                <button
                  key={season.leagueId}
                  type="button"
                  className={`btn join-item btn-sm ${
                    selectedDraft?.season === season.season ? 'btn-primary' : 'btn-ghost'
                  }`}
                  aria-pressed={selectedDraft?.season === season.season}
                  onClick={() => {
                    setSelectedSeason(season.season);
                  }}
                >
                  {season.season}
                </button>
              ))}
            </div>
          </div>
          {selectedDraft ? (
            <DraftBoard season={selectedDraft} />
          ) : (
            <div className="alert">No draft history is available.</div>
          )}
        </>
      )}

      {activeView === 'keepers' && (
        <KeeperHistory seasons={history.seasons} violations={keeperViolations} />
      )}
    </div>
  );
}

export default HistoryPage;
