import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { buildSleeperAvatarThumbUrl } from '../api/sleeper';
import { TeamAvatars } from '../components/common/TeamAvatars';
import { DRAFT_HISTORY } from '../data/draftHistory';
import type { DraftHistorySnapshot, DraftHistoryTeam } from '../data/draftHistoryTypes';
import {
  buildDraftIntelReport,
  DEFAULT_DRAFT_INTEL_START_SEASON,
  type DraftIntelCategory,
  type DraftIntelPattern,
  type DraftIntelStrength,
} from '../draftIntel/analysis';

type DraftIntelView = 'league' | 'teams';
type CategoryFilter = 'all' | DraftIntelCategory;

type DraftIntelPreferences = {
  scoutRosterId: number | null;
  sinceSeason: string;
};

type DraftIntelPageProps = {
  history?: DraftHistorySnapshot;
  initialScoutRosterId?: number | null;
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null;
};

const PREFERENCES_KEY = 'grundle-ball:draft-intel:v1';

const CATEGORY_OPTIONS: { value: CategoryFilter; label: string }[] = [
  { value: 'all', label: 'All Patterns' },
  { value: 'roster-construction', label: 'Roster Build' },
  { value: 'draft-timing', label: 'Timing' },
  { value: 'opening-rounds', label: 'Opening Rounds' },
  { value: 'nfl-affinity', label: 'NFL Teams' },
];

const strengthLabel: Record<DraftIntelStrength, string> = {
  strong: 'Strong pattern',
  notable: 'Notable pattern',
  emerging: 'Emerging pattern',
};

const strengthClassName: Record<DraftIntelStrength, string> = {
  strong: 'badge-success',
  notable: 'badge-info',
  emerging: 'badge-warning',
};

const badgeClassName: Record<DraftIntelCategory, string> = {
  'roster-construction': 'bg-primary/15 text-primary',
  'draft-timing': 'bg-secondary/15 text-secondary',
  'opening-rounds': 'bg-accent/20 text-accent-content',
  'nfl-affinity': 'bg-warning/20 text-warning-content',
};

const getBrowserStorage = (): Pick<Storage, 'getItem' | 'setItem'> | null => {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

const readPreferences = (
  storage: Pick<Storage, 'getItem'> | null,
): DraftIntelPreferences | null => {
  if (!storage) return null;
  try {
    const raw = storage.getItem(PREFERENCES_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DraftIntelPreferences>;
    const scoutRosterId =
      typeof parsed.scoutRosterId === 'number' && Number.isInteger(parsed.scoutRosterId)
        ? parsed.scoutRosterId
        : null;
    const sinceSeason =
      typeof parsed.sinceSeason === 'string' && /^\d{4}$/.test(parsed.sinceSeason)
        ? parsed.sinceSeason
        : DEFAULT_DRAFT_INTEL_START_SEASON;
    return { scoutRosterId, sinceSeason };
  } catch {
    return null;
  }
};

const latestTeams = (history: DraftHistorySnapshot): DraftHistoryTeam[] => {
  const latestSeason = [...history.seasons]
    .sort((a, b) => Number(b.season) - Number(a.season))
    .at(0);
  return latestSeason
    ? [...latestSeason.teams].sort((a, b) => a.teamName.localeCompare(b.teamName))
    : [];
};

function PatternCard({ pattern }: { pattern: DraftIntelPattern }) {
  return (
    <article className="card h-full border border-base-300 bg-base-100 shadow-sm">
      <div className="card-body gap-3 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div
            className={`flex min-h-11 min-w-11 items-center justify-center rounded-box px-2 text-center text-xs font-black leading-tight ${badgeClassName[pattern.category]}`}
            aria-hidden="true"
          >
            {pattern.badge}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold leading-snug">{pattern.description}</p>
            <p className="mt-1 text-xs text-base-content/55">{pattern.evidence}</p>
          </div>
        </div>
        <div>
          <span className={`badge badge-sm ${strengthClassName[pattern.strength]}`}>
            {strengthLabel[pattern.strength]}
          </span>
        </div>
      </div>
    </article>
  );
}

function PatternGrid({ patterns }: { patterns: DraftIntelPattern[] }) {
  if (patterns.length === 0) {
    return (
      <div className="alert border border-base-300 bg-base-100">
        <span>No patterns meet this filter yet.</span>
      </div>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {patterns.map((pattern) => (
        <PatternCard key={pattern.id} pattern={pattern} />
      ))}
    </div>
  );
}

export function DraftIntelPage({
  history = DRAFT_HISTORY,
  initialScoutRosterId,
  storage: storageOverride,
}: DraftIntelPageProps) {
  const storage = storageOverride === undefined ? getBrowserStorage() : storageOverride;
  const storedPreferences = readPreferences(storage);
  const completedSeasonOptions = useMemo(
    () =>
      history.seasons
        .filter((season) => season.draftStatus === 'complete')
        .map((season) => season.season)
        .sort((a, b) => Number(b) - Number(a)),
    [history.seasons],
  );
  const fallbackStartSeason = completedSeasonOptions.includes(DEFAULT_DRAFT_INTEL_START_SEASON)
    ? DEFAULT_DRAFT_INTEL_START_SEASON
    : (completedSeasonOptions.at(-1) ?? DEFAULT_DRAFT_INTEL_START_SEASON);
  const initialPreferences: DraftIntelPreferences = {
    scoutRosterId:
      initialScoutRosterId === undefined
        ? (storedPreferences?.scoutRosterId ?? null)
        : initialScoutRosterId,
    sinceSeason: storedPreferences?.sinceSeason ?? fallbackStartSeason,
  };

  const [scoutRosterId, setScoutRosterId] = useState<number | null>(
    initialPreferences.scoutRosterId,
  );
  const [sinceSeason, setSinceSeason] = useState(initialPreferences.sinceSeason);
  const [activeView, setActiveView] = useState<DraftIntelView>('league');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [selectedRosterId, setSelectedRosterId] = useState<number | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(
    initialScoutRosterId === undefined && storedPreferences === null,
  );
  const [setupRosterId, setSetupRosterId] = useState(
    initialPreferences.scoutRosterId?.toString() ?? '',
  );

  const teamOptions = useMemo(() => latestTeams(history), [history]);
  const report = useMemo(
    () => buildDraftIntelReport(history, { sinceSeason, excludedRosterId: scoutRosterId }),
    [history, scoutRosterId, sinceSeason],
  );
  const filteredLeaguePatterns = useMemo(
    () =>
      category === 'all'
        ? report.leaguePatterns
        : report.leaguePatterns.filter((pattern) => pattern.category === category),
    [category, report.leaguePatterns],
  );
  const selectedTeam =
    report.teams.find((team) => team.rosterId === selectedRosterId) ?? report.teams.at(0);
  const scoutTeam = teamOptions.find((team) => team.rosterId === scoutRosterId);

  const savePreferences = (preferences: DraftIntelPreferences) => {
    try {
      storage?.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
    } catch {
      // The report still works when browser storage is unavailable.
    }
  };

  const handleStartSeasonChange = (value: string) => {
    setSinceSeason(value);
    savePreferences({ scoutRosterId, sinceSeason: value });
  };

  const handleSaveOnboarding = () => {
    const selectedTeamId = setupRosterId ? Number(setupRosterId) : null;
    setScoutRosterId(selectedTeamId);
    setSelectedRosterId(null);
    savePreferences({ scoutRosterId: selectedTeamId, sinceSeason });
    setShowOnboarding(false);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:py-8">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="badge badge-secondary badge-sm">Local only</span>
            <span className="text-xs font-medium uppercase tracking-[0.18em] text-base-content/45">
              League tools
            </span>
          </div>
          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Draft Intel</h1>
          <p className="mt-2 max-w-2xl text-sm text-base-content/65 sm:text-base">
            Find repeatable draft habits across the Grundle League and scout each Team before the
            next room opens.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setSetupRosterId(scoutRosterId?.toString() ?? '');
              setShowOnboarding(true);
            }}
          >
            Show onboarding
          </button>
          <Link className="btn btn-primary btn-sm" to="/history">
            Review draftboards
          </Link>
        </div>
      </div>

      <section className="mb-5 grid gap-3 sm:grid-cols-3" aria-label="Draft Intel coverage">
        <div className="stat rounded-box border border-base-300 bg-base-100 py-4 shadow-sm">
          <div className="stat-title text-xs">Patterns found</div>
          <div className="stat-value text-2xl">{report.leaguePatterns.length.toString()}</div>
          <div className="stat-desc">Across league-wide signals</div>
        </div>
        <div className="stat rounded-box border border-base-300 bg-base-100 py-4 shadow-sm">
          <div className="stat-title text-xs">Completed drafts</div>
          <div className="stat-value text-2xl">{report.completedDraftCount.toString()}</div>
          <div className="stat-desc">
            {report.startSeason && report.endSeason
              ? `${report.startSeason}-${report.endSeason}`
              : 'No completed seasons in range'}
          </div>
        </div>
        <div className="stat rounded-box border border-base-300 bg-base-100 py-4 shadow-sm">
          <div className="stat-title text-xs">Teams analyzed</div>
          <div className="stat-value text-2xl">{report.includedTeamCount.toString()}</div>
          <div className="stat-desc">
            {scoutTeam ? `${scoutTeam.teamName} excluded as your Team` : 'No Team excluded'}
          </div>
        </div>
      </section>

      <div className="mb-5 flex flex-col gap-3 rounded-box border border-base-300 bg-base-100 p-3 sm:flex-row sm:items-end sm:justify-between">
        <div role="tablist" aria-label="Draft Intel views" className="tabs tabs-box w-fit">
          <button
            type="button"
            role="tab"
            aria-selected={activeView === 'league'}
            className={`tab ${activeView === 'league' ? 'tab-active' : ''}`}
            onClick={() => {
              setActiveView('league');
            }}
          >
            League Patterns
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeView === 'teams'}
            className={`tab ${activeView === 'teams' ? 'tab-active' : ''}`}
            onClick={() => {
              setActiveView('teams');
            }}
          >
            Team Patterns
          </button>
        </div>
        <label className="form-control w-full sm:w-44">
          <span className="label py-1 text-xs font-semibold">History window</span>
          <select
            className="select select-bordered select-sm"
            aria-label="History start season"
            value={sinceSeason}
            onChange={(event) => {
              handleStartSeasonChange(event.target.value);
            }}
          >
            {completedSeasonOptions.map((season) => (
              <option key={season} value={season}>
                Since {season}
              </option>
            ))}
          </select>
        </label>
      </div>

      {activeView === 'league' ? (
        <section aria-labelledby="league-patterns-heading">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 id="league-patterns-heading" className="text-xl font-bold">
                League Patterns
              </h2>
              <p className="mt-1 text-sm text-base-content/55">
                {report.leaguePatterns.length.toString()} patterns found - data since{' '}
                {report.startSeason ?? sinceSeason}
              </p>
            </div>
            <div className="flex max-w-full gap-1 overflow-x-auto pb-1" aria-label="Pattern filter">
              {CATEGORY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`btn btn-xs whitespace-nowrap ${category === option.value ? 'btn-neutral' : 'btn-ghost'}`}
                  aria-pressed={category === option.value}
                  onClick={() => {
                    setCategory(option.value);
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <PatternGrid patterns={filteredLeaguePatterns} />
        </section>
      ) : (
        <section aria-labelledby="team-patterns-heading">
          <div className="mb-4">
            <h2 id="team-patterns-heading" className="text-xl font-bold">
              Team Patterns
            </h2>
            <p className="mt-1 text-sm text-base-content/55">
              Pick a leaguemate to see the habits behind the league-level signals.
            </p>
          </div>

          <div className="mb-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {report.teams.map((teamReport) => {
              const selected = selectedTeam?.rosterId === teamReport.rosterId;
              return (
                <button
                  key={teamReport.rosterId}
                  type="button"
                  className={`card border text-left transition ${
                    selected
                      ? 'border-primary bg-primary/10 shadow-sm'
                      : 'border-base-300 bg-base-100 hover:border-base-content/30'
                  }`}
                  aria-pressed={selected}
                  onClick={() => {
                    setSelectedRosterId(teamReport.rosterId);
                  }}
                >
                  <span className="card-body flex-row items-center gap-3 p-3">
                    <TeamAvatars
                      teamName={teamReport.team.teamName}
                      teamAvatarUrl={buildSleeperAvatarThumbUrl(teamReport.team.avatar)}
                      size="lg"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">
                        {teamReport.team.teamName}
                      </span>
                      <span className="block text-xs text-base-content/50">
                        {teamReport.patterns.length.toString()} patterns
                      </span>
                    </span>
                    <span className="text-xs font-semibold text-primary">View</span>
                  </span>
                </button>
              );
            })}
          </div>

          {selectedTeam && (
            <div>
              <div className="mb-4 flex items-center gap-3">
                <TeamAvatars
                  teamName={selectedTeam.team.teamName}
                  teamAvatarUrl={buildSleeperAvatarThumbUrl(selectedTeam.team.avatar)}
                  size="lg"
                />
                <div>
                  <h3 className="text-lg font-bold">{selectedTeam.team.teamName}</h3>
                  <p className="text-xs text-base-content/55">
                    {selectedTeam.selectionCount.toString()} Draft Selections across{' '}
                    {selectedTeam.completedDrafts.toString()} completed drafts
                  </p>
                </div>
              </div>
              <PatternGrid patterns={selectedTeam.patterns} />
            </div>
          )}
        </section>
      )}

      <div className="alert mt-6 border border-base-300 bg-base-100 text-sm">
        <span>
          Keeper Designations and the forced 2024-2025 IDP rounds are excluded. IDP evidence begins
          with the completed 2026 draft. Rookie tendency is not scored because the stored draft
          archive does not preserve rookie status.
        </span>
      </div>

      {showOnboarding && (
        <div
          className="modal modal-open"
          role="dialog"
          aria-modal="true"
          aria-labelledby="intel-setup-title"
        >
          <div className="modal-box max-w-lg">
            <div className="mb-3 flex items-center gap-2">
              <span className="badge badge-secondary badge-sm">Local only</span>
              <span className="text-xs font-semibold uppercase tracking-wider text-base-content/45">
                Private scouting setup
              </span>
            </div>
            <h2 id="intel-setup-title" className="text-2xl font-black">
              Make the league patterns yours
            </h2>
            <p className="mt-2 text-sm text-base-content/65">
              Choose your Team and Draft Intel will analyze everyone else as your leaguemates. This
              preference stays in this browser only.
            </p>

            <label className="form-control mt-5 w-full">
              <span className="label font-semibold">Your Team</span>
              <select
                className="select select-bordered w-full"
                aria-label="Your Team"
                value={setupRosterId}
                onChange={(event) => {
                  setSetupRosterId(event.target.value);
                }}
              >
                <option value="">Analyze all Teams</option>
                {teamOptions.map((team) => (
                  <option key={team.rosterId} value={team.rosterId}>
                    {team.teamName} - {team.managerName}
                  </option>
                ))}
              </select>
            </label>

            <div className="mt-5 rounded-box bg-base-200 p-3 text-xs text-base-content/60">
              This tool exists only in the local development build. It is removed from production
              builds and has no link or route on the shared site.
            </div>

            <div className="modal-action">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setShowOnboarding(false);
                }}
              >
                Not now
              </button>
              <button type="button" className="btn btn-primary" onClick={handleSaveOnboarding}>
                Analyze league
              </button>
            </div>
          </div>
          <button
            type="button"
            className="modal-backdrop"
            aria-label="Close onboarding"
            onClick={() => {
              setShowOnboarding(false);
            }}
          />
        </div>
      )}
    </div>
  );
}

export default DraftIntelPage;
