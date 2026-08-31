import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SleeperPlayer } from '../../api/sleeper';
import type { DraftHistoryPick, DraftHistorySeason } from '../../data/draftHistoryTypes';
import type { UdkAdpSource } from '../../data/udkAdpSource';
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
});
