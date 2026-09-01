import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SleeperPlayer } from '../../api/sleeper';
import type { DraftHistoryPick, DraftHistorySeason } from '../../data/draftHistoryTypes';
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

    const picks = screen.getByRole('heading', { name: 'My open snake-draft picks' }).parentElement;
    expect(picks).not.toBeNull();
    if (!picks) return;
    expect(within(picks).getByText('1.02')).toBeInTheDocument();
    expect(within(picks).getByText('2.03')).toBeInTheDocument();
    expect(within(picks).getByText('4.03')).toBeInTheDocument();

    const adjustedRow = screen.getByRole('row', { name: /Available Four/ });
    const adjustedCells = within(adjustedRow).getAllByRole('cell');
    expect(adjustedCells[1]).toHaveTextContent('4.0');
    expect(adjustedCells[2]).toHaveTextContent('2.0');
    expect(adjustedCells[3]).toHaveTextContent('-2.0');
    expect(screen.queryByRole('row', { name: /Late Elite Keeper/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('row', { name: /Outside Player/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: 'Show outside board' }));
    expect(screen.getByRole('row', { name: /Outside Player/ })).toBeInTheDocument();
    expect(screen.getByText(/1 rows have no usable ADP/)).toBeInTheDocument();
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
    expect(cells[8]).toHaveTextContent('4.0');
    expect(cells[9]).toHaveTextContent('Median 4.0 - Range 3.0-5.0 - SD 1.0');
    expect(cells[10]).toHaveTextContent('2 / 2');
    expect(cells[11]).toHaveTextContent('2 / 2');
    expect(cells[11]).toHaveTextContent('100.0%');
    expect(cells[12]).toHaveTextContent('0 / 2');

    await user.click(screen.getByRole('checkbox', { name: /Post-Keeper Mock Two/ }));
    expect(within(row).getAllByRole('cell')[8]).toHaveTextContent('3.0');
    expect(screen.getByText(/1 selected of 2 compatible/)).toBeVisible();
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

    const draftInput = screen.getByRole('textbox', { name: 'Mock Drafts to include' });
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
