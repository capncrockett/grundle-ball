import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SleeperPlayer, SleeperPlayerProjection } from '../../api/sleeper';
import type { DraftHistoryPick, DraftHistorySeason } from '../../data/draftHistoryTypes';
import type { IdpTierSource } from '../../data/idpTierSource';
import type { UdkAdpSource } from '../../data/udkAdpSource';
import type { SleeperMockDraftCandidate } from '../../draftIntel/sleeperMockDrafts';
import { KeeperAdjustedAdpPanel } from './KeeperAdjustedAdpPanel';

const source: UdkAdpSource = {
  name: 'Test UDK ADP',
  fileName: 'test-2026-08-31_12-05-31_PDT.csv',
  capturedAt: '2026-08-31T12:05:31-07:00',
  teamCount: 4,
  column: 'Avg',
  csv: [
    '"Rank","Name","Team","Pos","Pos","Avg"',
    '"x","Late Elite Keeper","TST","RB","RB","1.01"',
    '"x","Available Two","TST","RB","RB","1.02"',
    '"x","Early Keeper","TST","RB","RB","1.03"',
    '"x","Available Four","TST","RB","RB","1.04"',
    '"x","Available Six","TST","RB","RB","2.02"',
    '"x","Available Eleven","TST","RB","RB","3.03"',
    '"x","Outside Player","TST","RB","RB","5.04"',
    '"x","No ADP","TST","RB","RB","-"',
  ].join('\n'),
};

const sleeperPlayers: Record<string, SleeperPlayer> = Object.fromEntries(
  [
    ['keeper-late', 'Late', 'Elite Keeper'],
    ['available-2', 'Available', 'Two'],
    ['keeper-early', 'Early', 'Keeper'],
    ['available-4', 'Available', 'Four'],
    ['available-6', 'Available', 'Six'],
    ['available-11', 'Available', 'Eleven'],
    ['outside', 'Outside', 'Player'],
  ].map(([playerId, firstName, lastName]) => [
    playerId,
    {
      player_id: playerId,
      first_name: firstName,
      last_name: lastName,
      position: 'RB',
      team: 'TST',
    },
  ]),
);

const keeperPick = (
  playerId: string,
  playerName: string,
  pickNo: number,
  round: number,
  draftSlot: number,
  rosterId: number,
): DraftHistoryPick => ({
  playerId,
  playerName,
  position: 'RB',
  nflTeam: 'TST',
  rosterId,
  round,
  draftSlot,
  pickNo,
  isKeeper: true,
});

const draftedPick = (
  playerId: string,
  playerName: string,
  pickNo: number,
  round: number,
  draftSlot: number,
  rosterId: number,
): DraftHistoryPick => ({
  playerId,
  playerName,
  position: 'RB',
  nflTeam: 'TST',
  rosterId,
  round,
  draftSlot,
  pickNo,
  isKeeper: false,
});

const season: DraftHistorySeason = {
  leagueId: 'league-2026',
  season: '2026',
  leagueStatus: 'pre_draft',
  draftId: 'draft-2026',
  draftStatus: 'pre_draft',
  draftType: 'snake',
  startTime: null,
  rounds: 4,
  teamCount: 4,
  draftSlots: [
    { draftSlot: 1, rosterId: 1 },
    { draftSlot: 2, rosterId: 2 },
    { draftSlot: 3, rosterId: 3 },
    { draftSlot: 4, rosterId: 4 },
  ],
  teams: [1, 2, 3, 4].map((rosterId) => ({
    rosterId,
    ownerId: `owner-${rosterId.toString()}`,
    teamName: `Team ${rosterId.toString()}`,
    managerName: `Manager ${rosterId.toString()}`,
    avatar: null,
  })),
  picks: [
    keeperPick('keeper-early', 'Early Keeper', 4, 1, 4, 4),
    keeperPick('keeper-late', 'Late Elite Keeper', 10, 3, 2, 2),
  ],
};

const liveSeason: DraftHistorySeason = {
  ...season,
  leagueStatus: 'drafting',
  draftStatus: 'drafting',
  picks: [
    ...season.picks,
    draftedPick('available-2', 'Available Two', 1, 1, 1, 1),
    draftedPick('available-4', 'Available Four', 2, 1, 2, 2),
  ],
};

const mockCandidate = (
  draftId: string,
  createdAt: number,
  picks: Array<{ playerId: string; pickNo: number }>,
): SleeperMockDraftCandidate => ({
  draftId,
  leagueId: `mock-league-${draftId}`,
  name: `Post-Keeper ${draftId}`,
  createdAt,
  teamCount: 4,
  rounds: 4,
  draftSlot: 2,
  compatible: true,
  compatibilityIssues: [],
  sample: { draftId, totalPicks: 16, picks },
});

const mockCandidates = [
  mockCandidate('Mock One', 1, [
    { playerId: 'available-4', pickNo: 3 },
    { playerId: 'available-6', pickNo: 8 },
  ]),
  mockCandidate('Mock Two', 2, [{ playerId: 'available-4', pickNo: 5 }]),
];

const specialistSleeperPlayers: Record<string, SleeperPlayer> = {
  kicker: {
    player_id: 'kicker',
    first_name: 'Test',
    last_name: 'Kicker',
    position: 'K',
    team: 'TST',
  },
  MIN: {
    player_id: 'MIN',
    first_name: 'Minnesota',
    last_name: 'Vikings',
    position: 'DEF',
    team: 'MIN',
  },
  defender: {
    player_id: 'defender',
    first_name: 'Test',
    last_name: 'Linebacker',
    position: 'LB',
    team: 'TST',
  },
};

const specialistMockCandidates = [
  mockCandidate('Specialist Mock One', 5, [
    { playerId: 'available-4', pickNo: 3 },
    { playerId: 'defender', pickNo: 10 },
    { playerId: 'kicker', pickNo: 12 },
    { playerId: 'MIN', pickNo: 15 },
  ]),
  mockCandidate('Specialist Mock Two', 6, [
    { playerId: 'available-4', pickNo: 5 },
    { playerId: 'defender', pickNo: 11 },
    { playerId: 'kicker', pickNo: 14 },
    { playerId: 'MIN', pickNo: 16 },
  ]),
];

const idpTierSource: IdpTierSource = {
  name: 'Test tiered IDP rankings',
  sourceUrl: 'https://example.com/idp-tiers',
  publishedOn: '2026-06-16',
  retrievedOn: '2026-09-01',
  players: [
    {
      playerId: 'idp-early',
      playerName: 'Early Edge',
      sourceRank: 1,
      tier: 1,
      archetype: 'EDGE',
    },
    {
      playerId: 'idp-late',
      playerName: 'Late Edge',
      sourceRank: 2,
      tier: 1,
      archetype: 'EDGE',
    },
    {
      playerId: 'idp-fallback-one',
      playerName: 'Fallback One',
      sourceRank: 3,
      tier: 2,
      archetype: 'EDGE',
    },
    {
      playerId: 'idp-fallback-two',
      playerName: 'Fallback Two',
      sourceRank: 4,
      tier: 2,
      archetype: 'EDGE',
    },
  ],
};

const idpSleeperPlayers: Record<string, SleeperPlayer> = Object.fromEntries(
  idpTierSource.players.map((player) => [
    player.playerId,
    {
      player_id: player.playerId,
      first_name: player.playerName.split(' ')[0] ?? '',
      last_name: player.playerName.split(' ').slice(1).join(' '),
      position: 'DE',
      team: 'TST',
      status: 'Active',
    },
  ]),
);

const idpAdp: SleeperPlayerProjection[] = idpTierSource.players.map((player, index) => ({
  player_id: player.playerId,
  stats: { adp_idp_1qb: 8 + index * 2 },
}));

const idpMockCandidates = [
  mockCandidate('IDP Mock One', 3, [
    { playerId: 'idp-early', pickNo: 8 },
    { playerId: 'idp-late', pickNo: 15 },
    { playerId: 'idp-fallback-one', pickNo: 10 },
    { playerId: 'idp-fallback-two', pickNo: 13 },
  ]),
  mockCandidate('IDP Mock Two', 4, [
    { playerId: 'idp-early', pickNo: 9 },
    { playerId: 'idp-late', pickNo: 16 },
    { playerId: 'idp-fallback-one', pickNo: 11 },
    { playerId: 'idp-fallback-two', pickNo: 14 },
  ]),
];

describe('KeeperAdjustedAdpPanel', () => {
  it('shows deterministic keeper adjustment and the selected Team open picks', async () => {
    const user = userEvent.setup();
    render(
      <KeeperAdjustedAdpPanel
        storedSeason={season}
        selectedRosterId={2}
        source={source}
        refreshLive={false}
        initialSleeperPlayers={sleeperPlayers}
      />,
    );

    expect(await screen.findByRole('heading', { name: 'Keeper-Adjusted ADP' })).toBeInTheDocument();
    const coverage = await screen.findByRole('region', { name: 'Keeper ADP coverage' });
    expect(within(coverage).getByText('2')).toBeInTheDocument();
    expect(within(coverage).getByText('14')).toBeInTheDocument();

    const picks = screen.getByRole('heading', {
      name: 'My remaining snake-draft picks',
    }).parentElement;
    expect(picks).not.toBeNull();
    if (!picks) return;
    expect(within(picks).getByText('1.02')).toBeInTheDocument();
    expect(within(picks).getByText('2.03')).toBeInTheDocument();
    expect(within(picks).getByText('4.03')).toBeInTheDocument();

    const adjustedRow = screen.getByRole('row', { name: /Available Four/ });
    const adjustedCells = within(adjustedRow).getAllByRole('cell');
    expect(adjustedCells[1]).toHaveTextContent('1.04');
    expect(adjustedCells[2]).toHaveTextContent('1.02');
    expect(adjustedCells[3]).toHaveTextContent('-2.0');
    expect(screen.queryByRole('columnheader', { name: 'Baseline ADP' })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Keeper ADP' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show details for Available Four' }));
    const details = screen.getByRole('region', { name: 'Available Four details' });
    expect(within(details).getByText('Baseline overall ADP').parentElement).toHaveTextContent(
      '4.0',
    );
    expect(
      within(details).getByText('Keeper-adjusted overall ADP').parentElement,
    ).toHaveTextContent('2.0');
    expect(within(details).getByText('Keepers ahead').parentElement).toHaveTextContent('2');
    expect(screen.queryByRole('row', { name: /Late Elite Keeper/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('row', { name: /Outside Player/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: 'Show outside board' }));
    expect(screen.getByRole('row', { name: /Outside Player/ })).toBeInTheDocument();
    expect(screen.getByText(/1 rows have no usable ADP/)).toBeInTheDocument();
  });

  it('tracks live selections, removes used Team picks, and can show drafted players', async () => {
    const user = userEvent.setup();
    render(
      <KeeperAdjustedAdpPanel
        storedSeason={liveSeason}
        selectedRosterId={2}
        source={source}
        refreshLive={false}
        initialSleeperPlayers={sleeperPlayers}
      />,
    );

    const tracker = await screen.findByRole('region', { name: 'Draft tracker' });
    expect(within(tracker).getByText('Live')).toBeVisible();
    expect(within(tracker).getByText('2 / 14 drafted')).toBeVisible();
    expect(within(tracker).getByText('1.03 #3')).toBeVisible();
    expect(within(tracker).getByText('Available Four')).toBeVisible();
    expect(within(tracker).getByText(/1\.02 #2 - Team 2/)).toBeVisible();

    const picks = screen.getByRole('heading', {
      name: 'My remaining snake-draft picks',
    }).parentElement;
    expect(picks).not.toBeNull();
    if (!picks) return;
    expect(within(picks).queryByText('1.02')).not.toBeInTheDocument();
    expect(within(picks).getByText('2.03')).toBeVisible();

    const hideDrafted = screen.getByRole('checkbox', { name: 'Hide drafted' });
    expect(hideDrafted).toBeChecked();
    expect(screen.queryByRole('row', { name: /Available Four/ })).not.toBeInTheDocument();
    expect(screen.getByText(/2 drafted UDK players hidden/)).toBeVisible();

    await user.click(hideDrafted);

    const draftedRow = screen.getByRole('row', { name: /Available Four/ });
    expect(within(draftedRow).getByText('Drafted 1.02 #2')).toBeVisible();
  });

  it('refreshes the canonical draft tracker from the table on demand', async () => {
    const user = userEvent.setup();
    const loadLiveSeason = jest
      .fn<Promise<DraftHistorySeason>, []>()
      .mockResolvedValueOnce(season)
      .mockResolvedValueOnce(liveSeason);

    render(
      <KeeperAdjustedAdpPanel
        storedSeason={season}
        selectedRosterId={2}
        source={source}
        refreshLive
        refreshIdpAdp={false}
        refreshMocks={false}
        draftRefreshIntervalMs={0}
        initialSleeperPlayers={sleeperPlayers}
        loadLiveSeason={loadLiveSeason}
      />,
    );

    const tracker = await screen.findByRole('region', { name: 'Draft tracker' });
    await waitFor(() => {
      expect(loadLiveSeason).toHaveBeenCalledTimes(1);
    });
    expect(within(tracker).getByText('Pre-draft')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Refresh draft now' }));

    await waitFor(() => {
      expect(loadLiveSeason).toHaveBeenCalledTimes(2);
      expect(within(tracker).getByText('Live')).toBeVisible();
      expect(within(tracker).getByText('2 / 14 drafted')).toBeVisible();
    });
  });

  it('polls an incomplete canonical draft after Draft started is pressed', async () => {
    const user = userEvent.setup();
    const loadLiveSeason = jest
      .fn<Promise<DraftHistorySeason>, []>()
      .mockResolvedValueOnce(season)
      .mockResolvedValue(liveSeason);

    const view = render(
      <KeeperAdjustedAdpPanel
        storedSeason={season}
        selectedRosterId={2}
        source={source}
        refreshLive
        refreshIdpAdp={false}
        refreshMocks={false}
        draftRefreshIntervalMs={20}
        initialSleeperPlayers={sleeperPlayers}
        loadLiveSeason={loadLiveSeason}
      />,
    );

    const tracker = await screen.findByRole('region', { name: 'Draft tracker' });
    await waitFor(() => {
      expect(loadLiveSeason).toHaveBeenCalledTimes(1);
    });

    await new Promise((resolve) => window.setTimeout(resolve, 50));
    expect(loadLiveSeason).toHaveBeenCalledTimes(1);

    await user.click(within(tracker).getByRole('button', { name: 'Draft started' }));

    await waitFor(() => {
      expect(loadLiveSeason.mock.calls.length).toBeGreaterThanOrEqual(3);
    });
    expect(within(tracker).getByText('Live')).toBeVisible();
    expect(within(tracker).getByText('Live sync on')).toBeVisible();
    expect(within(tracker).getByText('2 / 14 drafted')).toBeVisible();

    view.unmount();
  });

  it('fails visibly when a current keeper has no resolved baseline ADP', async () => {
    render(
      <KeeperAdjustedAdpPanel
        storedSeason={season}
        selectedRosterId={2}
        source={{ ...source, csv: source.csv.replace('"x","Late Elite Keeper"', '"x","Missing"') }}
        refreshLive={false}
        initialSleeperPlayers={sleeperPlayers}
      />,
    );

    expect(
      await screen.findByText(/Keeper keeper-late is missing from the baseline ADP source/),
    ).toBeInTheDocument();
  });

  it('keeps observed mock results separate and shows availability at each open pick', async () => {
    const user = userEvent.setup();
    render(
      <KeeperAdjustedAdpPanel
        storedSeason={season}
        selectedRosterId={2}
        source={source}
        refreshLive={false}
        refreshMocks={false}
        initialSleeperPlayers={sleeperPlayers}
        initialMockDraftCandidates={mockCandidates}
      />,
    );

    expect(await screen.findByRole('heading', { name: 'Post-Keeper Mock Drafts' })).toBeVisible();
    expect(screen.getByText(/2 selected of 2 compatible/)).toBeVisible();
    expect(screen.getByRole('columnheader', { name: 'Observed Mock ADP' })).toBeVisible();

    const row = screen.getByRole('row', { name: /Available Four/ });
    const cells = within(row).getAllByRole('cell');
    expect(cells[1]).toHaveTextContent('1.04');
    expect(cells[2]).toHaveTextContent('1.02');
    expect(cells[3]).toHaveTextContent('-2.0');
    expect(cells[4]).toHaveTextContent('1.04');
    expect(cells[5]).toHaveTextContent('Med 1.04 - Rng 1.03 to 2.01');
    expect(screen.queryByRole('columnheader', { name: 'Mocks Sampled' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show details for Available Four' }));
    const details = screen.getByRole('region', { name: 'Available Four details' });
    expect(within(details).getByText('Mocks sampled').parentElement).toHaveTextContent('2 / 2');
    expect(within(details).getByText('At 1.02').parentElement).toHaveTextContent(
      '2 / 2 available - 100.0%',
    );
    expect(within(details).getByText('At 2.03').parentElement).toHaveTextContent(
      '0 / 2 available - 0.0%',
    );

    await user.click(screen.getByRole('checkbox', { name: /Post-Keeper Mock Two/ }));
    expect(within(row).getAllByRole('cell')[4]).toHaveTextContent('1.03');
    expect(screen.getByText(/1 selected of 2 compatible/)).toBeVisible();
  });

  it('adds K, defense, and IDP players observed in the selected mocks', async () => {
    const user = userEvent.setup();
    render(
      <KeeperAdjustedAdpPanel
        storedSeason={season}
        selectedRosterId={2}
        source={source}
        refreshLive={false}
        refreshMocks={false}
        initialSleeperPlayers={{ ...sleeperPlayers, ...specialistSleeperPlayers }}
        initialMockDraftCandidates={specialistMockCandidates}
      />,
    );

    const allPositions = await screen.findByRole('button', { name: 'All positions' });
    const kickerFilter = screen.getByRole('button', { name: 'K' });
    const defenseFilter = screen.getByRole('button', { name: 'Defense' });
    const idpFilter = screen.getByRole('button', { name: 'IDP' });
    expect(allPositions).toHaveAttribute('aria-pressed', 'true');
    expect(kickerFilter).toHaveAttribute('aria-pressed', 'false');

    await user.click(kickerFilter);
    expect(allPositions).toHaveAttribute('aria-pressed', 'false');
    expect(kickerFilter).toHaveAttribute('aria-pressed', 'true');
    const kickerRow = screen.getByRole('row', { name: /Test Kicker/ });
    const kickerCells = within(kickerRow).getAllByRole('cell');
    expect(within(kickerRow).getByText('Mock-only')).toBeVisible();
    expect(kickerCells[1]).toHaveTextContent('-');
    expect(kickerCells[2]).toHaveTextContent('-');
    expect(kickerCells[3]).toHaveTextContent('-');
    expect(kickerCells[4]).toHaveTextContent('4.01');

    await user.click(defenseFilter);
    expect(screen.getByRole('row', { name: /Minnesota Vikings/ })).toBeVisible();
    expect(screen.getByRole('row', { name: /Test Kicker/ })).toBeVisible();

    await user.click(kickerFilter);
    expect(screen.queryByRole('row', { name: /Test Kicker/ })).not.toBeInTheDocument();
    expect(defenseFilter).toHaveAttribute('aria-pressed', 'true');

    await user.click(idpFilter);
    const idpRow = screen.getByRole('row', { name: /Test Linebacker/ });
    expect(within(idpRow).getByText('LB')).toBeVisible();
    expect(within(idpRow).getAllByRole('cell')[4]).toHaveTextContent('3.03');

    await user.click(screen.getByRole('button', { name: 'Show details for Test Linebacker' }));
    const details = screen.getByRole('region', { name: 'Test Linebacker details' });
    expect(within(details).getByText('Selected Sleeper mocks')).toBeVisible();
    expect(within(details).getByText('2 / 2')).toBeVisible();

    await user.click(allPositions);
    expect(allPositions).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('row', { name: /Test Kicker/ })).toBeVisible();

    await user.click(idpFilter);
    expect(allPositions).toHaveAttribute('aria-pressed', 'false');
    await user.click(idpFilter);
    expect(allPositions).toHaveAttribute('aria-pressed', 'true');
  });

  it('loads only the configured post-lock mock batch for the selected Team', async () => {
    const loadMockCandidates = jest.fn(() => Promise.resolve([]));
    const exactMockId = '1400197747742654464';

    render(
      <KeeperAdjustedAdpPanel
        storedSeason={season}
        selectedRosterId={2}
        source={source}
        mockDraftSource={{
          name: 'Test post-lock batch',
          leagueId: season.leagueId,
          keeperLockedAt: '1970-01-01T00:00:00.050Z',
          batchCompletedAt: '1970-01-01T00:00:00.100Z',
          draftIds: [exactMockId],
        }}
        refreshLive={false}
        refreshMocks
        initialSleeperPlayers={sleeperPlayers}
        loadMockCandidates={loadMockCandidates}
      />,
    );

    await waitFor(() => {
      expect(loadMockCandidates).toHaveBeenCalledWith({
        userId: 'owner-2',
        leagueId: season.leagueId,
        teamCount: 4,
        rounds: 4,
        draftSlot: 2,
        keepers: [
          { playerId: 'keeper-early', overallPick: 4 },
          { playerId: 'keeper-late', overallPick: 10 },
        ],
        createdAtOrAfter: 50,
        draftIds: [exactMockId],
      });
    });
  });

  it('builds a compact tier-aware IDP target plan from Sleeper and selected mocks', async () => {
    render(
      <KeeperAdjustedAdpPanel
        storedSeason={season}
        selectedRosterId={2}
        source={source}
        idpTierSource={idpTierSource}
        refreshLive={false}
        initialSleeperPlayers={{ ...sleeperPlayers, ...idpSleeperPlayers }}
        initialIdpAdp={idpAdp}
        initialMockDraftCandidates={idpMockCandidates}
      />,
    );

    expect(await screen.findByRole('heading', { name: 'IDP Draft Plan' })).toBeVisible();
    expect(screen.getByText('Primary Tier 1 shortlist')).toBeVisible();
    expect(screen.getByText('2 mocks selected')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Test tiered IDP rankings' })).toHaveAttribute(
      'href',
      'https://example.com/idp-tiers',
    );

    const lateTarget = screen.getByRole('article', { name: 'Late Edge IDP target' });
    expect(within(lateTarget).getByText('Target 4.03')).toBeVisible();
    expect(within(lateTarget).getByText(/100% at 4.03/)).toBeVisible();
    expect(screen.getByText(/Tier 2 fallback plan/)).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Fallback Two IDP target' })).toBeInTheDocument();
  });

  it('loads pasted Sleeper draft URLs and deduplicates them', async () => {
    const user = userEvent.setup();
    const firstDraftId = '1400197747742654464';
    const secondDraftId = '1400197652271878144';
    const loadMockCandidates = jest.fn(() => Promise.resolve([]));

    render(
      <KeeperAdjustedAdpPanel
        storedSeason={season}
        selectedRosterId={2}
        source={source}
        mockDraftSource={{
          name: 'Test post-lock batch',
          leagueId: season.leagueId,
          keeperLockedAt: '1970-01-01T00:00:00.050Z',
          batchCompletedAt: '1970-01-01T00:00:00.100Z',
          draftIds: [firstDraftId],
        }}
        refreshLive={false}
        refreshMocks
        initialSleeperPlayers={sleeperPlayers}
        loadMockCandidates={loadMockCandidates}
      />,
    );

    await waitFor(() => {
      expect(loadMockCandidates).toHaveBeenCalledTimes(1);
    });

    const draftInput = await screen.findByRole('textbox', { name: 'Mock Drafts to include' });
    await user.clear(draftInput);
    await user.type(
      draftInput,
      [
        `https://sleeper.com/draft/nfl/${firstDraftId}`,
        `https://sleeper.com/draft/nfl/${secondDraftId}`,
        firstDraftId,
      ].join('\n'),
    );

    expect(screen.getByText('2 unique drafts entered - 1 duplicate ignored')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Load and validate' }));

    await waitFor(() => {
      expect(loadMockCandidates).toHaveBeenLastCalledWith(
        expect.objectContaining({ draftIds: [firstDraftId, secondDraftId] }),
      );
    });
  });
});
