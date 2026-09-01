import { Fragment, useEffect, useMemo, useState } from 'react';
import { getAllPlayers, type SleeperPlayer } from '../../api/sleeper';
import { LEAGUE_ID } from '../../config/league';
import { loadCurrentDraftSeason } from '../../data/currentDraft';
import type { DraftHistorySeason } from '../../data/draftHistoryTypes';
import {
  POST_KEEPER_MOCK_DRAFT_SOURCE,
  type PostKeeperMockDraftSource,
} from '../../data/postKeeperMockDraftSource';
import { UDK_ADP_SOURCE, type UdkAdpSource } from '../../data/udkAdpSource';
import { analyzeMockDrafts } from '../../draftIntel/mockDraftAnalyzer';
import {
  calculateKeeperAdjustedAdp,
  getOpenDraftPicksForRoster,
  type DraftPosition,
} from '../../draftIntel/keeperAdjustedAdp';
import { buildKeeperAdjustedDraftInput } from '../../draftIntel/keeperAdjustedDraftInput';
import {
  formatSleeperMockDraftInput,
  loadSleeperMockDraftCandidates,
  parseSleeperMockDraftInput,
  type LoadSleeperMockDraftCandidatesInput,
  type SleeperMockDraftCandidate,
} from '../../draftIntel/sleeperMockDrafts';
import { parseUdkAdpCsv, resolveUdkAdpPlayers } from '../../draftIntel/udkAdp';
import { getRoundPick } from '../../utils/draftBoard';
import { MockDraftControls } from './MockDraftControls';

type SleeperPlayerMap = Record<string, SleeperPlayer>;
type MockCandidateLoader = (
  input: LoadSleeperMockDraftCandidatesInput,
) => Promise<SleeperMockDraftCandidate[]>;

export type KeeperAdjustedAdpPanelProps = {
  storedSeason?: DraftHistorySeason;
  selectedRosterId: number | null;
  source?: UdkAdpSource;
  mockDraftSource?: PostKeeperMockDraftSource;
  refreshLive?: boolean;
  initialSleeperPlayers?: SleeperPlayerMap;
  initialMockDraftCandidates?: SleeperMockDraftCandidate[];
  loadLiveSeason?: () => Promise<DraftHistorySeason>;
  loadSleeperPlayers?: () => Promise<SleeperPlayerMap>;
  loadMockCandidates?: MockCandidateLoader;
  refreshMocks?: boolean;
};

const defaultLoadLiveSeason = () => loadCurrentDraftSeason(LEAGUE_ID);
const defaultLoadSleeperPlayers = () => getAllPlayers();
const defaultLoadMockCandidates: MockCandidateLoader = (input) =>
  loadSleeperMockDraftCandidates(input);
const selectableMockIds = (candidates: SleeperMockDraftCandidate[]): Set<string> =>
  new Set(
    candidates.filter((candidate) => candidate.compatible).map((candidate) => candidate.draftId),
  );

const formatNumber = (value: number): string =>
  new Intl.NumberFormat(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 }).format(
    value,
  );

const formatRoundPick = ({ lower, upper }: DraftPosition): string => {
  const format = (round: number, pick: number) =>
    `${round.toString()}.${Math.round(pick).toString().padStart(2, '0')}`;
  const lowerLabel = format(lower.round, lower.pickInRound);
  const upperLabel = format(upper.round, upper.pickInRound);
  return lowerLabel === upperLabel ? lowerLabel : `${lowerLabel}-${upperLabel}`;
};

const formatOverallPickAsRoundPick = (overallPick: number, teamCount: number): string => {
  const { round, pickInRound } = getRoundPick(Math.round(overallPick), teamCount);
  return `${round.toString()}.${pickInRound.toString().padStart(2, '0')}`;
};

const formatSourceTime = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(date);
};

const positionBadgeClass: Record<string, string> = {
  QB: 'badge-info',
  RB: 'badge-success',
  WR: 'badge-warning',
  TE: 'badge-secondary',
};

export function KeeperAdjustedAdpPanel({
  storedSeason,
  selectedRosterId,
  source = UDK_ADP_SOURCE,
  mockDraftSource = POST_KEEPER_MOCK_DRAFT_SOURCE,
  refreshLive = true,
  initialSleeperPlayers,
  initialMockDraftCandidates,
  loadLiveSeason = defaultLoadLiveSeason,
  loadSleeperPlayers = defaultLoadSleeperPlayers,
  loadMockCandidates = defaultLoadMockCandidates,
  refreshMocks = refreshLive,
}: KeeperAdjustedAdpPanelProps) {
  const [season, setSeason] = useState(storedSeason);
  const [sleeperPlayers, setSleeperPlayers] = useState<SleeperPlayerMap | null>(
    initialSleeperPlayers ?? null,
  );
  const [isLoading, setIsLoading] = useState(refreshLive || initialSleeperPlayers === undefined);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [liveWarning, setLiveWarning] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [position, setPosition] = useState('ALL');
  const [showOutsideBoard, setShowOutsideBoard] = useState(false);
  const [expandedPlayerIds, setExpandedPlayerIds] = useState<Set<string>>(new Set());
  const [mockCandidates, setMockCandidates] = useState<SleeperMockDraftCandidate[]>(
    initialMockDraftCandidates ?? [],
  );
  const [selectedMockIds, setSelectedMockIds] = useState<Set<string>>(() =>
    selectableMockIds(initialMockDraftCandidates ?? []),
  );
  const [isLoadingMocks, setIsLoadingMocks] = useState(false);
  const [mockError, setMockError] = useState<string | null>(null);
  const [mockRefreshToken, setMockRefreshToken] = useState(0);
  const [mockDraftInput, setMockDraftInput] = useState(() =>
    formatSleeperMockDraftInput(mockDraftSource.draftIds),
  );
  const [activeMockDraftIds, setActiveMockDraftIds] = useState<readonly string[]>(() => [
    ...mockDraftSource.draftIds,
  ]);
  const [mockInputError, setMockInputError] = useState<string | null>(null);
  const parsedMockDraftInput = useMemo(
    () => parseSleeperMockDraftInput(mockDraftInput),
    [mockDraftInput],
  );

  useEffect(() => {
    let active = true;

    async function loadData() {
      setIsLoading(true);
      setFatalError(null);
      setLiveWarning(null);

      const [playerResult, seasonResult] = await Promise.allSettled([
        initialSleeperPlayers ? Promise.resolve(initialSleeperPlayers) : loadSleeperPlayers(),
        refreshLive ? loadLiveSeason() : Promise.resolve(storedSeason),
      ]);
      if (!active) return;

      if (playerResult.status === 'rejected') {
        setFatalError(
          `Sleeper player identity refresh failed: ${
            playerResult.reason instanceof Error
              ? playerResult.reason.message
              : String(playerResult.reason)
          }`,
        );
      } else {
        setSleeperPlayers(playerResult.value);
      }

      if (seasonResult.status === 'fulfilled' && seasonResult.value) {
        setSeason(seasonResult.value);
      } else if (storedSeason) {
        const reason =
          seasonResult.status === 'rejected'
            ? seasonResult.reason instanceof Error
              ? seasonResult.reason.message
              : String(seasonResult.reason)
            : 'No live draft was returned';
        setSeason(storedSeason);
        setLiveWarning(
          `Live keeper refresh failed. Using the stored ${storedSeason.season} draft: ${reason}`,
        );
      } else {
        setFatalError('No current draft configuration is available');
      }
      setIsLoading(false);
    }

    void loadData();
    return () => {
      active = false;
    };
  }, [initialSleeperPlayers, loadLiveSeason, loadSleeperPlayers, refreshLive, storedSeason]);

  useEffect(() => {
    let active = true;

    if (
      !refreshMocks ||
      isLoading ||
      !season ||
      season.leagueId !== mockDraftSource.leagueId ||
      selectedRosterId === null
    ) {
      return () => {
        active = false;
      };
    }

    const targetSeason = season;
    const team = targetSeason.teams.find((candidate) => candidate.rosterId === selectedRosterId);
    const draftSlot = targetSeason.draftSlots.find(
      (candidate) => candidate.rosterId === selectedRosterId,
    )?.draftSlot;
    if (!team || draftSlot === undefined) {
      return () => {
        active = false;
      };
    }
    const criteria: LoadSleeperMockDraftCandidatesInput = {
      userId: team.ownerId,
      leagueId: targetSeason.leagueId,
      teamCount: targetSeason.teamCount,
      rounds: targetSeason.rounds,
      draftSlot,
      keepers: targetSeason.picks
        .filter((pick) => pick.isKeeper)
        .map((pick) => ({ playerId: pick.playerId, overallPick: pick.pickNo })),
      createdAtOrAfter: Date.parse(mockDraftSource.keeperLockedAt),
      draftIds: activeMockDraftIds,
    };

    async function loadMocks() {
      setIsLoadingMocks(true);
      setMockError(null);
      try {
        const candidates = await loadMockCandidates(criteria);
        if (!active) return;
        setMockCandidates(candidates);
        setSelectedMockIds(selectableMockIds(candidates));
      } catch (error) {
        if (!active) return;
        setMockError(
          `Sleeper mock refresh failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      } finally {
        if (active) setIsLoadingMocks(false);
      }
    }

    void loadMocks();
    return () => {
      active = false;
    };
  }, [
    isLoading,
    activeMockDraftIds,
    loadMockCandidates,
    mockDraftSource,
    mockRefreshToken,
    refreshMocks,
    season,
    selectedRosterId,
  ]);

  const model = useMemo(() => {
    if (!season || !sleeperPlayers) return null;
    try {
      const parsed = parseUdkAdpCsv(source.csv, source.teamCount);
      const resolved = resolveUdkAdpPlayers(parsed.rows, sleeperPlayers);
      const draftInput = buildKeeperAdjustedDraftInput(season);
      const calculation = calculateKeeperAdjustedAdp(
        resolved.players,
        draftInput.keepers,
        draftInput.config,
      );
      return { parsed, resolved, draftInput, calculation, error: null };
    } catch (error) {
      return {
        parsed: null,
        resolved: null,
        draftInput: null,
        calculation: null,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }, [season, sleeperPlayers, source]);

  const positions = useMemo(
    () =>
      model?.calculation
        ? Array.from(new Set(model.calculation.players.map((player) => player.position))).sort()
        : [],
    [model],
  );
  const filteredPlayers = useMemo(() => {
    if (!model?.calculation) return [];
    const normalizedSearch = search.trim().toLowerCase();
    return model.calculation.players.filter((player) => {
      if (!showOutsideBoard && player.keeperAdjustedAdp === null) return false;
      if (position !== 'ALL' && player.position !== position) return false;
      if (!normalizedSearch) return true;
      return `${player.playerName} ${player.nflTeam ?? ''} ${player.position}`
        .toLowerCase()
        .includes(normalizedSearch);
    });
  }, [model, position, search, showOutsideBoard]);

  const myOpenPicks =
    model?.calculation && selectedRosterId !== null
      ? getOpenDraftPicksForRoster(model.calculation.board, selectedRosterId)
      : [];
  const canLoadMocks =
    season !== undefined &&
    selectedRosterId !== null &&
    season.teams.some((team) => team.rosterId === selectedRosterId) &&
    season.draftSlots.some((slot) => slot.rosterId === selectedRosterId) &&
    (!refreshMocks || season.leagueId === mockDraftSource.leagueId);
  const selectedMockSamples = (canLoadMocks ? mockCandidates : [])
    .filter((candidate) => candidate.compatible && selectedMockIds.has(candidate.draftId))
    .map((candidate) => candidate.sample);
  const mockAnalysis =
    model?.calculation && selectedMockSamples.length > 0
      ? analyzeMockDrafts(
          model.calculation.players.map((player) => player.playerId),
          selectedMockSamples,
          myOpenPicks.map((pick) => pick.overallPick),
        )
      : null;
  const mockAnalysisByPlayer = new Map(
    mockAnalysis?.players.map((player) => [player.playerId, player]) ?? [],
  );
  const inBoardCount =
    model?.calculation?.players.filter((player) => player.keeperAdjustedAdp !== null).length ?? 0;

  return (
    <section aria-labelledby="keeper-adjusted-adp-heading">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 id="keeper-adjusted-adp-heading" className="text-2xl font-black">
            Keeper-Adjusted ADP
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-base-content/60">
            Maps the UDK Baseline ADP pool onto this league's open draft slots. Negative shifts mean
            the player moves earlier.
          </p>
        </div>
        <div className="rounded-box border border-base-300 bg-base-100 px-3 py-2 text-xs text-base-content/60">
          <div className="font-semibold text-base-content/80">{source.name}</div>
          <div>
            {source.column} column - captured {formatSourceTime(source.capturedAt)}
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center gap-3 rounded-box border border-base-300 bg-base-100 p-5">
          <span className="loading loading-spinner loading-sm" />
          <span>Refreshing Sleeper keepers and player identities...</span>
        </div>
      )}

      {liveWarning && !isLoading && (
        <div className="alert alert-warning mb-4">
          <span>{liveWarning}</span>
        </div>
      )}

      {fatalError && !isLoading && (
        <div className="alert alert-error">
          <span>{fatalError}</span>
        </div>
      )}

      {!isLoading && model?.error && (
        <div className="alert alert-error">
          <span>Keeper-Adjusted ADP could not be calculated: {model.error}</span>
        </div>
      )}

      {!isLoading && model?.calculation && (
        <>
          <section
            className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
            aria-label="Keeper ADP coverage"
          >
            <div className="stat rounded-box border border-base-300 bg-base-100 py-4 shadow-sm">
              <div className="stat-title text-xs">Keepers locked</div>
              <div className="stat-value text-2xl">
                {model.draftInput.keepers.length.toString()}
              </div>
              <div className="stat-desc">Exact occupied picks</div>
            </div>
            <div className="stat rounded-box border border-base-300 bg-base-100 py-4 shadow-sm">
              <div className="stat-title text-xs">Open draft slots</div>
              <div className="stat-value text-2xl">
                {model.calculation.openSlots.length.toString()}
              </div>
              <div className="stat-desc">
                {model.draftInput.config.teamCount.toString()} Teams -{' '}
                {model.draftInput.config.rounds.toString()} rounds
              </div>
            </div>
            <div className="stat rounded-box border border-base-300 bg-base-100 py-4 shadow-sm">
              <div className="stat-title text-xs">UDK players matched</div>
              <div className="stat-value text-2xl">{model.resolved.players.length.toString()}</div>
              <div className="stat-desc">Canonical Sleeper IDs</div>
            </div>
            <div className="stat rounded-box border border-base-300 bg-base-100 py-4 shadow-sm">
              <div className="stat-title text-xs">Projected in board</div>
              <div className="stat-value text-2xl">{inBoardCount.toString()}</div>
              <div className="stat-desc">Available non-keepers</div>
            </div>
          </section>

          {(model.parsed.skippedRows.length > 0 ||
            model.resolved.unmatchedRows.length > 0 ||
            model.resolved.ambiguousRows.length > 0) && (
            <div className="alert mb-4 border border-warning/40 bg-warning/10 text-sm">
              <span>
                Source diagnostics: {model.parsed.skippedRows.length.toString()} rows have no usable
                ADP, {model.resolved.unmatchedRows.length.toString()} did not match a Sleeper
                player, and {model.resolved.ambiguousRows.length.toString()} were ambiguous. These
                rows are excluded rather than guessed.
              </span>
            </div>
          )}

          <section
            className="mb-5 rounded-box border border-base-300 bg-base-100 p-4"
            aria-labelledby="my-open-picks-heading"
          >
            <h3 id="my-open-picks-heading" className="font-bold">
              My open snake-draft picks
            </h3>
            {selectedRosterId === null ? (
              <p className="mt-2 text-sm text-base-content/60">
                Choose Your Team in Draft Intel onboarding to calculate your open picks.
              </p>
            ) : myOpenPicks.length === 0 ? (
              <p className="mt-2 text-sm text-base-content/60">No open picks were found.</p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {myOpenPicks.map((pick) => (
                  <span key={pick.overallPick} className="badge badge-outline gap-1 py-3 font-mono">
                    {pick.round.toString()}.{pick.pickInRound.toString().padStart(2, '0')}
                    <span className="opacity-55">#{pick.overallPick.toString()}</span>
                  </span>
                ))}
              </div>
            )}
          </section>

          <MockDraftControls
            canLoad={canLoadMocks}
            expectedDraftCount={mockDraftSource.draftIds.length}
            draftInput={mockDraftInput}
            parsedDraftCount={parsedMockDraftInput.draftIds.length}
            duplicateDraftCount={parsedMockDraftInput.duplicateDraftIds.length}
            inputError={mockInputError}
            candidates={canLoadMocks ? mockCandidates : []}
            selectedDraftIds={selectedMockIds}
            isLoading={isLoadingMocks}
            error={mockError}
            onDraftInputChange={(value) => {
              setMockDraftInput(value);
              setMockInputError(null);
              setMockError(null);
            }}
            onLoad={() => {
              if (parsedMockDraftInput.invalidEntries.length > 0) {
                setMockInputError(
                  `Invalid mock draft entry: ${parsedMockDraftInput.invalidEntries[0]}`,
                );
                return;
              }
              if (parsedMockDraftInput.draftIds.length === 0) {
                setMockInputError('Enter at least one Sleeper mock draft URL or ID');
                return;
              }
              setMockInputError(null);
              setMockCandidates([]);
              setSelectedMockIds(new Set());
              setActiveMockDraftIds(parsedMockDraftInput.draftIds);
              setMockRefreshToken((current) => current + 1);
            }}
            onToggle={(draftId, selected) => {
              setSelectedMockIds((current) => {
                const next = new Set(current);
                if (selected) next.add(draftId);
                else next.delete(draftId);
                return next;
              });
            }}
          />

          <div className="mb-3 grid gap-3 rounded-box border border-base-300 bg-base-100 p-3 sm:grid-cols-[minmax(0,1fr)_10rem_auto] sm:items-end">
            <label className="form-control">
              <span className="label py-1 text-xs font-semibold">Find player</span>
              <input
                className="input input-bordered input-sm"
                type="search"
                placeholder="Name, Team, or position"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                }}
              />
            </label>
            <label className="form-control">
              <span className="label py-1 text-xs font-semibold">Position</span>
              <select
                className="select select-bordered select-sm"
                value={position}
                onChange={(event) => {
                  setPosition(event.target.value);
                }}
              >
                <option value="ALL">All positions</option>
                {positions.map((candidate) => (
                  <option key={candidate} value={candidate}>
                    {candidate}
                  </option>
                ))}
              </select>
            </label>
            <label className="label cursor-pointer justify-start gap-2 rounded-box border border-base-300 px-3 py-2">
              <input
                type="checkbox"
                className="toggle toggle-sm"
                checked={showOutsideBoard}
                onChange={(event) => {
                  setShowOutsideBoard(event.target.checked);
                }}
              />
              <span className="label-text whitespace-nowrap text-xs">Show outside board</span>
            </label>
          </div>

          <div className="mb-2 text-xs text-base-content/55">
            Showing {filteredPlayers.length.toString()} available players. UDK round-pick values are
            converted to 12-Team overall picks before adjustment.
          </div>

          <div className="overflow-x-auto rounded-box border border-base-300 bg-base-100">
            <table className="table table-sm">
              <thead className="bg-base-200 text-xs">
                <tr>
                  <th>Player</th>
                  <th className="text-right" title="Projected draft position before keepers">
                    Baseline
                  </th>
                  <th className="text-right" title="Projected draft position after keepers">
                    Adjusted
                  </th>
                  <th className="text-right">ADP Shift</th>
                  {mockAnalysis && (
                    <>
                      <th
                        className="text-right"
                        title="Average mock selection rounded to the nearest round.pick"
                      >
                        Observed Mock ADP
                      </th>
                      <th title="Median and range across selected mocks">Mock Detail</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredPlayers.map((player) => {
                  const mockStats = mockAnalysisByPlayer.get(player.playerId);
                  const isExpanded = expandedPlayerIds.has(player.playerId);
                  const detailsId = `keeper-adp-details-${player.playerId}`;
                  const deltaClass =
                    player.adpDelta === null || player.adpDelta === 0
                      ? 'text-base-content/60'
                      : player.adpDelta < 0
                        ? 'text-success'
                        : 'text-warning';
                  return (
                    <Fragment key={player.playerId}>
                      <tr>
                        <td>
                          <div className="flex items-start gap-2">
                            <button
                              type="button"
                              className="btn btn-ghost btn-xs mt-0.5 h-6 min-h-6 w-6 px-0 font-mono"
                              aria-expanded={isExpanded}
                              aria-controls={detailsId}
                              aria-label={`${isExpanded ? 'Hide' : 'Show'} details for ${player.playerName}`}
                              onClick={() => {
                                setExpandedPlayerIds((current) => {
                                  const next = new Set(current);
                                  if (next.has(player.playerId)) next.delete(player.playerId);
                                  else next.add(player.playerId);
                                  return next;
                                });
                              }}
                            >
                              <span aria-hidden="true">{isExpanded ? '-' : '+'}</span>
                            </button>
                            <div>
                              <div className="font-semibold">{player.playerName}</div>
                              <div className="mt-0.5 flex items-center gap-1.5 text-xs text-base-content/50">
                                <span
                                  className={`badge badge-xs ${positionBadgeClass[player.position] ?? 'badge-ghost'}`}
                                >
                                  {player.position}
                                </span>
                                {player.nflTeam ?? 'FA'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="text-right font-mono text-xs">
                          {formatRoundPick(player.baselineRoundPick)}
                        </td>
                        <td className="text-right font-mono text-xs font-bold">
                          {player.adjustedRoundPick
                            ? formatRoundPick(player.adjustedRoundPick)
                            : 'Outside board'}
                        </td>
                        <td className={`text-right font-mono font-bold ${deltaClass}`}>
                          {player.adpDelta === null
                            ? '-'
                            : `${player.adpDelta > 0 ? '+' : ''}${formatNumber(player.adpDelta)}`}
                        </td>
                        {mockAnalysis && (
                          <>
                            <td className="text-right font-mono font-bold">
                              {mockStats?.meanPick === null || mockStats?.meanPick === undefined
                                ? 'Undrafted'
                                : formatOverallPickAsRoundPick(
                                    mockStats.meanPick,
                                    model.draftInput.config.teamCount,
                                  )}
                            </td>
                            <td className="whitespace-nowrap text-xs">
                              {mockStats?.medianPick === null ||
                              mockStats?.medianPick === undefined ? (
                                '-'
                              ) : (
                                <>
                                  Med{' '}
                                  {formatOverallPickAsRoundPick(
                                    mockStats.medianPick,
                                    model.draftInput.config.teamCount,
                                  )}{' '}
                                  - Rng{' '}
                                  {formatOverallPickAsRoundPick(
                                    mockStats.earliestPick ?? mockStats.medianPick,
                                    model.draftInput.config.teamCount,
                                  )}
                                  {' to '}
                                  {formatOverallPickAsRoundPick(
                                    mockStats.latestPick ?? mockStats.medianPick,
                                    model.draftInput.config.teamCount,
                                  )}
                                </>
                              )}
                            </td>
                          </>
                        )}
                      </tr>
                      {isExpanded && (
                        <tr className="bg-base-200/35">
                          <td colSpan={mockAnalysis ? 6 : 4} className="p-0">
                            <div
                              id={detailsId}
                              role="region"
                              aria-label={`${player.playerName} details`}
                              className="border-t border-base-300 px-4 py-3"
                            >
                              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                                <div className="rounded-box bg-base-100 px-3 py-2">
                                  <div className="text-[0.65rem] font-semibold uppercase text-base-content/50">
                                    Baseline overall ADP
                                  </div>
                                  <div className="font-mono font-bold">
                                    {formatNumber(player.baselineAdp)}
                                  </div>
                                </div>
                                <div className="rounded-box bg-base-100 px-3 py-2">
                                  <div className="text-[0.65rem] font-semibold uppercase text-base-content/50">
                                    Keeper-adjusted overall ADP
                                  </div>
                                  <div className="font-mono font-bold">
                                    {player.keeperAdjustedAdp === null
                                      ? 'Outside board'
                                      : formatNumber(player.keeperAdjustedAdp)}
                                  </div>
                                </div>
                                <div className="rounded-box bg-base-100 px-3 py-2">
                                  <div className="text-[0.65rem] font-semibold uppercase text-base-content/50">
                                    Pool rank
                                  </div>
                                  <div className="font-mono font-bold">
                                    {formatNumber(player.availablePoolRank)}
                                  </div>
                                </div>
                                <div className="rounded-box bg-base-100 px-3 py-2">
                                  <div className="text-[0.65rem] font-semibold uppercase text-base-content/50">
                                    Keepers ahead
                                  </div>
                                  <div className="font-mono font-bold">
                                    {player.higherRankedKeepersRemoved.toString()}
                                  </div>
                                </div>
                                {mockAnalysis && mockStats && (
                                  <div className="rounded-box bg-base-100 px-3 py-2">
                                    <div className="text-[0.65rem] font-semibold uppercase text-base-content/50">
                                      Mocks sampled
                                    </div>
                                    <div className="font-mono font-bold">
                                      {mockStats.mockCount.toString()} /{' '}
                                      {mockAnalysis.selectedMockCount.toString()}
                                    </div>
                                  </div>
                                )}
                              </div>

                              {mockAnalysis && mockStats && (
                                <div className="mt-3 border-t border-base-300 pt-3">
                                  <div className="text-xs font-semibold">Available at my picks</div>
                                  <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                                    {mockStats.availability.map((availability) => (
                                      <div
                                        key={availability.overallPick}
                                        className="rounded-box bg-base-100 px-3 py-2 text-xs"
                                      >
                                        <div className="font-semibold">
                                          At{' '}
                                          {formatOverallPickAsRoundPick(
                                            availability.overallPick,
                                            model.draftInput.config.teamCount,
                                          )}
                                        </div>
                                        {availability.sampleCount === 0 ||
                                        availability.percentage === null ? (
                                          <div className="text-base-content/50">
                                            No full samples
                                          </div>
                                        ) : (
                                          <div className="font-mono">
                                            {availability.availableCount.toString()} /{' '}
                                            {availability.sampleCount.toString()} available -{' '}
                                            {formatNumber(availability.percentage)}%
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

export default KeeperAdjustedAdpPanel;
