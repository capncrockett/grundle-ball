import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  getAllPlayers,
  getIdp1QbAdp,
  type SleeperPlayer,
  type SleeperPlayerProjection,
} from '../../api/sleeper';
import { LEAGUE_ID } from '../../config/league';
import { loadCurrentDraftSeason } from '../../data/currentDraft';
import type { DraftHistorySeason } from '../../data/draftHistoryTypes';
import { IDP_TIER_SOURCE, type IdpTierSource } from '../../data/idpTierSource';
import {
  POST_KEEPER_MOCK_DRAFT_SOURCE,
  type PostKeeperMockDraftSource,
} from '../../data/postKeeperMockDraftSource';
import { UDK_ADP_SOURCE, type UdkAdpSource } from '../../data/udkAdpSource';
import { buildDraftTrackerSnapshot } from '../../draftIntel/draftTracker';
import { buildIdpDraftPlan } from '../../draftIntel/idpDraftPlan';
import { analyzeMockDrafts } from '../../draftIntel/mockDraftAnalyzer';
import {
  buildMockDraftSpecialistPool,
  getDraftIntelPositionGroup,
  type MockDraftSpecialistPlayer,
} from '../../draftIntel/mockDraftSpecialists';
import {
  calculateKeeperAdjustedAdp,
  getOpenDraftPicksForRoster,
  type KeeperAdjustedAdpRow,
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
import { DraftTracker } from './DraftTracker';
import { IdpDraftPlan } from './IdpDraftPlan';
import { MockDraftControls } from './MockDraftControls';

type SleeperPlayerMap = Record<string, SleeperPlayer>;
type MockCandidateLoader = (
  input: LoadSleeperMockDraftCandidatesInput,
) => Promise<SleeperMockDraftCandidate[]>;
type IdpAdpLoader = (season: number) => Promise<SleeperPlayerProjection[]>;

const DEFAULT_DRAFT_REFRESH_INTERVAL_MS = 15_000;

export type KeeperAdjustedAdpPanelProps = {
  storedSeason?: DraftHistorySeason;
  selectedRosterId: number | null;
  source?: UdkAdpSource;
  idpTierSource?: IdpTierSource;
  mockDraftSource?: PostKeeperMockDraftSource;
  refreshLive?: boolean;
  refreshIdpAdp?: boolean;
  initialSleeperPlayers?: SleeperPlayerMap;
  initialIdpAdp?: SleeperPlayerProjection[];
  initialMockDraftCandidates?: SleeperMockDraftCandidate[];
  loadLiveSeason?: () => Promise<DraftHistorySeason>;
  loadSleeperPlayers?: () => Promise<SleeperPlayerMap>;
  loadIdpAdp?: IdpAdpLoader;
  loadMockCandidates?: MockCandidateLoader;
  refreshMocks?: boolean;
  draftRefreshIntervalMs?: number;
};

const defaultLoadLiveSeason = () => loadCurrentDraftSeason(LEAGUE_ID);
const defaultLoadSleeperPlayers = () => getAllPlayers();
const defaultLoadIdpAdp: IdpAdpLoader = (season) => getIdp1QbAdp(season);
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
  K: 'badge-accent',
  DEF: 'badge-neutral',
  DL: 'badge-error',
  LB: 'badge-success',
  DB: 'badge-secondary',
};

type KeeperAdjustedTablePlayer = KeeperAdjustedAdpRow & {
  source: 'udk';
  positionGroup: string;
};

type MockSpecialistTablePlayer = MockDraftSpecialistPlayer & {
  source: 'mock';
};

type DraftIntelTablePlayer = KeeperAdjustedTablePlayer | MockSpecialistTablePlayer;

const POSITION_FILTER_ORDER = ['QB', 'RB', 'TE', 'WR', 'K', 'DEF', 'IDP'];
const POSITION_FILTER_LABELS: Record<string, string> = {
  DEF: 'Defense',
};

const comparePositionFilters = (a: string, b: string): number => {
  const aIndex = POSITION_FILTER_ORDER.indexOf(a);
  const bIndex = POSITION_FILTER_ORDER.indexOf(b);
  if (aIndex !== -1 || bIndex !== -1) {
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  }
  return a.localeCompare(b);
};

const draftPlanningSignature = (season: DraftHistorySeason): string =>
  JSON.stringify({
    leagueId: season.leagueId,
    draftId: season.draftId,
    draftType: season.draftType,
    teamCount: season.teamCount,
    rounds: season.rounds,
    draftSlots: season.draftSlots,
    teams: season.teams.map(({ rosterId, ownerId }) => ({ rosterId, ownerId })),
    keepers: season.picks
      .filter((pick) => pick.isKeeper)
      .map(({ playerId, pickNo }) => ({ playerId, pickNo })),
  });

export function KeeperAdjustedAdpPanel({
  storedSeason,
  selectedRosterId,
  source = UDK_ADP_SOURCE,
  idpTierSource = IDP_TIER_SOURCE,
  mockDraftSource = POST_KEEPER_MOCK_DRAFT_SOURCE,
  refreshLive = true,
  refreshIdpAdp = refreshLive,
  initialSleeperPlayers,
  initialIdpAdp,
  initialMockDraftCandidates,
  loadLiveSeason = defaultLoadLiveSeason,
  loadSleeperPlayers = defaultLoadSleeperPlayers,
  loadIdpAdp = defaultLoadIdpAdp,
  loadMockCandidates = defaultLoadMockCandidates,
  refreshMocks = refreshLive,
  draftRefreshIntervalMs = DEFAULT_DRAFT_REFRESH_INTERVAL_MS,
}: KeeperAdjustedAdpPanelProps) {
  const [season, setSeason] = useState(storedSeason);
  const [draftTrackerSeason, setDraftTrackerSeason] = useState(storedSeason);
  const [sleeperPlayers, setSleeperPlayers] = useState<SleeperPlayerMap | null>(
    initialSleeperPlayers ?? null,
  );
  const [isLoading, setIsLoading] = useState(refreshLive || initialSleeperPlayers === undefined);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [liveWarning, setLiveWarning] = useState<string | null>(null);
  const [idpAdp, setIdpAdp] = useState<SleeperPlayerProjection[]>(initialIdpAdp ?? []);
  const [isLoadingIdpAdp, setIsLoadingIdpAdp] = useState(
    refreshIdpAdp && initialIdpAdp === undefined,
  );
  const [idpAdpWarning, setIdpAdpWarning] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedPositions, setSelectedPositions] = useState<Set<string>>(new Set());
  const [showOutsideBoard, setShowOutsideBoard] = useState(false);
  const [hideDrafted, setHideDrafted] = useState(true);
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
  const [isRefreshingDraft, setIsRefreshingDraft] = useState(false);
  const [isDraftSyncEnabled, setIsDraftSyncEnabled] = useState(false);
  const [draftRefreshWarning, setDraftRefreshWarning] = useState<string | null>(null);
  const [lastDraftRefreshAt, setLastDraftRefreshAt] = useState<number | null>(null);
  const draftRefreshInFlight = useRef(false);
  const parsedMockDraftInput = useMemo(
    () => parseSleeperMockDraftInput(mockDraftInput),
    [mockDraftInput],
  );
  const idpSeason = season?.season;

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
        setDraftTrackerSeason(seasonResult.value);
        if (refreshLive) setLastDraftRefreshAt(Date.now());
      } else if (storedSeason) {
        const reason =
          seasonResult.status === 'rejected'
            ? seasonResult.reason instanceof Error
              ? seasonResult.reason.message
              : String(seasonResult.reason)
            : 'No live draft was returned';
        setSeason(storedSeason);
        setDraftTrackerSeason(storedSeason);
        setLiveWarning(
          `Live draft refresh failed. Using the stored ${storedSeason.season} draft: ${reason}`,
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

  const refreshDraft = useCallback(async () => {
    if (draftRefreshInFlight.current) return;
    draftRefreshInFlight.current = true;
    setIsRefreshingDraft(true);
    setDraftRefreshWarning(null);
    setLiveWarning(null);

    try {
      const liveSeason = await loadLiveSeason();
      setDraftTrackerSeason(liveSeason);
      setSeason((current) =>
        !current || draftPlanningSignature(current) !== draftPlanningSignature(liveSeason)
          ? liveSeason
          : current,
      );
      setLastDraftRefreshAt(Date.now());
    } catch (error) {
      setDraftRefreshWarning(
        `Sleeper draft refresh failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      draftRefreshInFlight.current = false;
      setIsRefreshingDraft(false);
    }
  }, [loadLiveSeason]);

  const startDraftSync = useCallback(() => {
    setIsDraftSyncEnabled(true);
    void refreshDraft();
  }, [refreshDraft]);

  useEffect(() => {
    if (
      !refreshLive ||
      !isDraftSyncEnabled ||
      isLoading ||
      draftRefreshIntervalMs <= 0 ||
      draftTrackerSeason?.draftStatus === 'complete'
    ) {
      return;
    }

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refreshDraft();
    }, draftRefreshIntervalMs);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [
    draftRefreshIntervalMs,
    draftTrackerSeason?.draftStatus,
    isDraftSyncEnabled,
    isLoading,
    refreshDraft,
    refreshLive,
  ]);

  useEffect(() => {
    let active = true;

    if (initialIdpAdp !== undefined || !refreshIdpAdp || !idpSeason) {
      return () => {
        active = false;
      };
    }

    const seasonNumber = Number(idpSeason);
    async function loadAdp() {
      setIsLoadingIdpAdp(true);
      setIdpAdpWarning(null);
      try {
        const projections = await loadIdpAdp(seasonNumber);
        if (!active) return;
        setIdpAdp(projections);
      } catch (error) {
        if (!active) return;
        setIdpAdpWarning(
          `Sleeper IDP ADP refresh failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      } finally {
        if (active) setIsLoadingIdpAdp(false);
      }
    }

    void loadAdp();
    return () => {
      active = false;
    };
  }, [idpSeason, initialIdpAdp, loadIdpAdp, refreshIdpAdp]);

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

  const trackedDraft = draftTrackerSeason ?? season;
  const draftTracker = useMemo(
    () =>
      trackedDraft && model?.calculation
        ? buildDraftTrackerSnapshot(trackedDraft, model.calculation.openSlots)
        : null,
    [model, trackedDraft],
  );
  const myOpenPicks =
    model?.calculation && selectedRosterId !== null
      ? getOpenDraftPicksForRoster(model.calculation.board, selectedRosterId).filter(
          (pick) => !draftTracker?.draftedOverallPicks.has(pick.overallPick),
        )
      : [];
  const canLoadMocks =
    season !== undefined &&
    selectedRosterId !== null &&
    season.teams.some((team) => team.rosterId === selectedRosterId) &&
    season.draftSlots.some((slot) => slot.rosterId === selectedRosterId) &&
    (!refreshMocks || season.leagueId === mockDraftSource.leagueId);
  const selectedMockSamples = useMemo(
    () =>
      (canLoadMocks ? mockCandidates : [])
        .filter((candidate) => candidate.compatible && selectedMockIds.has(candidate.draftId))
        .map((candidate) => candidate.sample),
    [canLoadMocks, mockCandidates, selectedMockIds],
  );
  const mockSpecialistPlayers = useMemo(() => {
    if (!model?.calculation || !sleeperPlayers) return [];
    const excludedPlayerIds = new Set([
      ...model.calculation.players.map((player) => player.playerId),
      ...model.draftInput.keepers.map((keeper) => keeper.playerId),
    ]);
    return buildMockDraftSpecialistPool(selectedMockSamples, sleeperPlayers, excludedPlayerIds);
  }, [model, selectedMockSamples, sleeperPlayers]);
  const tablePlayers: DraftIntelTablePlayer[] = model?.calculation
    ? [
        ...model.calculation.players.map<KeeperAdjustedTablePlayer>((player) => ({
          ...player,
          source: 'udk',
          positionGroup: getDraftIntelPositionGroup(player.position),
        })),
        ...mockSpecialistPlayers.map<MockSpecialistTablePlayer>((player) => ({
          ...player,
          source: 'mock',
        })),
      ]
    : [];
  const mockAnalysis =
    tablePlayers.length > 0 && selectedMockSamples.length > 0
      ? analyzeMockDrafts(
          tablePlayers.map((player) => player.playerId),
          selectedMockSamples,
          myOpenPicks.map((pick) => pick.overallPick),
        )
      : null;
  const mockAnalysisByPlayer = new Map(
    mockAnalysis?.players.map((player) => [player.playerId, player]) ?? [],
  );
  const positions = Array.from(
    new Set([...POSITION_FILTER_ORDER, ...tablePlayers.map((player) => player.positionGroup)]),
  ).sort(comparePositionFilters);
  const filteredPlayers = tablePlayers
    .filter((player) => {
      if (hideDrafted && draftTracker?.draftedByPlayerId.has(player.playerId)) return false;
      if (player.source === 'udk' && !showOutsideBoard && player.keeperAdjustedAdp === null) {
        return false;
      }
      if (selectedPositions.size > 0 && !selectedPositions.has(player.positionGroup)) return false;
      const normalizedSearch = search.trim().toLowerCase();
      if (!normalizedSearch) return true;
      return `${player.playerName} ${player.nflTeam ?? ''} ${player.position} ${player.positionGroup}`
        .toLowerCase()
        .includes(normalizedSearch);
    })
    .sort((a, b) => {
      if (a.source !== b.source) return a.source === 'udk' ? -1 : 1;
      if (a.source === 'udk' || b.source === 'udk') return 0;
      const aMean = mockAnalysisByPlayer.get(a.playerId)?.meanPick ?? Number.POSITIVE_INFINITY;
      const bMean = mockAnalysisByPlayer.get(b.playerId)?.meanPick ?? Number.POSITIVE_INFINITY;
      return aMean - bMean || a.playerName.localeCompare(b.playerName);
    });
  const idpMockAnalysis =
    selectedMockSamples.length > 0
      ? analyzeMockDrafts(
          idpTierSource.players.map((player) => player.playerId),
          selectedMockSamples,
          myOpenPicks.map((pick) => pick.overallPick),
        )
      : null;
  const idpPlan =
    sleeperPlayers && model?.draftInput
      ? buildIdpDraftPlan({
          source: idpTierSource,
          sleeperPlayers,
          projections: idpAdp,
          mockAnalysis: idpMockAnalysis,
          openPicks: myOpenPicks,
          keeperPlayerIds: new Set(model.draftInput.keepers.map((keeper) => keeper.playerId)),
          draftedPlayerIds: new Set(draftTracker?.draftedByPlayerId.keys() ?? []),
        })
      : null;
  const inBoardCount =
    model?.calculation?.players.filter(
      (player) =>
        player.keeperAdjustedAdp !== null && !draftTracker?.draftedByPlayerId.has(player.playerId),
    ).length ?? 0;
  const draftedRowsCount = tablePlayers.filter((player) =>
    draftTracker?.draftedByPlayerId.has(player.playerId),
  ).length;

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
          <span>Refreshing the Sleeper draft and player identities...</span>
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
              <div className="stat-title text-xs">Draft picks remaining</div>
              <div className="stat-value text-2xl">
                {(
                  draftTracker?.remainingPickCount ?? model.calculation.openSlots.length
                ).toString()}
              </div>
              <div className="stat-desc">
                Of {model.calculation.openSlots.length.toString()} non-keeper slots
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

          {trackedDraft && draftTracker && (
            <DraftTracker
              season={trackedDraft}
              tracker={draftTracker}
              remainingTeamPicks={myOpenPicks}
              selectedRosterId={selectedRosterId}
              isRefreshing={isRefreshingDraft}
              isSyncEnabled={isDraftSyncEnabled}
              lastUpdatedAt={lastDraftRefreshAt}
              refreshIntervalMs={draftRefreshIntervalMs}
              warning={draftRefreshWarning}
              onStartSync={refreshLive && draftRefreshIntervalMs > 0 ? startDraftSync : undefined}
            />
          )}

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
              My remaining snake-draft picks
            </h3>
            {selectedRosterId === null ? (
              <p className="mt-2 text-sm text-base-content/60">
                Choose Your Team in Draft Intel onboarding to calculate your open picks.
              </p>
            ) : myOpenPicks.length === 0 ? (
              <p className="mt-2 text-sm text-base-content/60">No remaining picks were found.</p>
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

          {idpPlan && (
            <IdpDraftPlan
              source={idpTierSource}
              plan={idpPlan}
              teamCount={model.draftInput.config.teamCount}
              isLoadingAdp={isLoadingIdpAdp}
              adpWarning={idpAdpWarning}
            />
          )}

          <div className="mb-3 grid gap-3 rounded-box border border-base-300 bg-base-100 p-3 sm:grid-cols-2 sm:items-end xl:grid-cols-[minmax(0,1fr)_minmax(22rem,auto)_auto_auto]">
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
            <fieldset className="min-w-0">
              <legend className="label py-1 text-xs font-semibold">Positions</legend>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  className={`btn btn-xs ${selectedPositions.size === 0 ? 'btn-primary' : 'btn-outline'}`}
                  aria-pressed={selectedPositions.size === 0}
                  onClick={() => {
                    setSelectedPositions(new Set());
                  }}
                >
                  All positions
                </button>
                {positions.map((candidate) => (
                  <button
                    key={candidate}
                    type="button"
                    className={`btn btn-xs ${selectedPositions.has(candidate) ? 'btn-primary' : 'btn-outline'}`}
                    aria-pressed={selectedPositions.has(candidate)}
                    onClick={() => {
                      setSelectedPositions((current) => {
                        const next = new Set(current);
                        if (next.has(candidate)) next.delete(candidate);
                        else next.add(candidate);
                        return next;
                      });
                    }}
                  >
                    {POSITION_FILTER_LABELS[candidate] ?? candidate}
                  </button>
                ))}
              </div>
            </fieldset>
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
            <label className="label cursor-pointer justify-start gap-2 rounded-box border border-base-300 px-3 py-2">
              <input
                type="checkbox"
                className="toggle toggle-success toggle-sm"
                checked={hideDrafted}
                onChange={(event) => {
                  setHideDrafted(event.target.checked);
                }}
              />
              <span className="label-text whitespace-nowrap text-xs">Hide drafted</span>
            </label>
          </div>

          <div className="mb-2 flex items-center justify-between gap-3 text-xs text-base-content/55">
            <div>
              Showing {filteredPlayers.length.toString()} {hideDrafted ? 'available ' : ''}players.
              {hideDrafted && draftedRowsCount > 0
                ? ` ${draftedRowsCount.toString()} drafted UDK player${draftedRowsCount === 1 ? '' : 's'} hidden.`
                : ''}{' '}
              UDK round-pick values are converted to 12-Team overall picks before adjustment.
            </div>
            {refreshLive && (
              <button
                type="button"
                className="btn btn-ghost btn-square btn-xs shrink-0"
                aria-label="Refresh draft now"
                title="Refresh draft now"
                disabled={isRefreshingDraft}
                onClick={() => {
                  void refreshDraft();
                }}
              >
                {isRefreshingDraft ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : (
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20 6v5h-5" />
                    <path d="M4 18v-5h5" />
                    <path d="M6.1 9a7 7 0 0 1 11.5-2.6L20 11" />
                    <path d="m4 13 2.4 4.6A7 7 0 0 0 17.9 15" />
                  </svg>
                )}
              </button>
            )}
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
                  const draftedPick = draftTracker?.draftedByPlayerId.get(player.playerId);
                  const isExpanded = expandedPlayerIds.has(player.playerId);
                  const detailsId = `keeper-adp-details-${player.playerId}`;
                  const deltaClass =
                    player.source === 'mock' || player.adpDelta === null || player.adpDelta === 0
                      ? 'text-base-content/60'
                      : player.adpDelta < 0
                        ? 'text-success'
                        : 'text-warning';
                  return (
                    <Fragment key={player.playerId}>
                      <tr className={draftedPick ? 'bg-base-200/45 text-base-content/55' : ''}>
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
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="font-semibold">{player.playerName}</span>
                                {draftedPick && (
                                  <span className="badge badge-neutral badge-xs whitespace-nowrap">
                                    Drafted{' '}
                                    {formatOverallPickAsRoundPick(
                                      draftedPick.pickNo,
                                      model.draftInput.config.teamCount,
                                    )}{' '}
                                    #{draftedPick.pickNo.toString()}
                                  </span>
                                )}
                                {player.source === 'mock' && (
                                  <span className="badge badge-outline badge-xs whitespace-nowrap">
                                    Mock-only
                                  </span>
                                )}
                              </div>
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
                          {player.source === 'udk'
                            ? formatRoundPick(player.baselineRoundPick)
                            : '-'}
                        </td>
                        <td className="text-right font-mono text-xs font-bold">
                          {player.source === 'mock'
                            ? '-'
                            : player.adjustedRoundPick
                              ? formatRoundPick(player.adjustedRoundPick)
                              : 'Outside board'}
                        </td>
                        <td className={`text-right font-mono font-bold ${deltaClass}`}>
                          {player.source === 'mock' || player.adpDelta === null
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
                                {player.source === 'udk' ? (
                                  <>
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
                                  </>
                                ) : (
                                  <div className="rounded-box bg-base-100 px-3 py-2 sm:col-span-2">
                                    <div className="text-[0.65rem] font-semibold uppercase text-base-content/50">
                                      Market source
                                    </div>
                                    <div className="font-semibold">Selected Sleeper mocks</div>
                                    <div className="mt-0.5 text-xs text-base-content/55">
                                      No UDK baseline or keeper adjustment is applied.
                                    </div>
                                  </div>
                                )}
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
