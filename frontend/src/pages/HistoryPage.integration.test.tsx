import { fireEvent, render, screen, within } from '@testing-library/react';
import { getLeague } from '../api/sleeper';
import type { DraftHistorySeason, DraftHistorySnapshot } from '../data/draftHistoryTypes';
import { HistoryPage } from './HistoryPage';

jest.mock('../api/sleeper', () => ({
  getDraft: jest.fn(),
  getDraftPicks: jest.fn(),
  getLeague: jest.fn(),
  getLeagueRosters: jest.fn(),
  getLeagueUsers: jest.fn(),
}));

const mockedGetLeague = jest.mocked(getLeague);

const teams = [
  {
    rosterId: 1,
    ownerId: 'user-a',
    teamName: 'Alpha Team',
    managerName: 'Alpha Manager',
    avatar: null,
  },
  {
    rosterId: 2,
    ownerId: 'user-b',
    teamName: 'Beta Team',
    managerName: 'Beta Manager',
    avatar: null,
  },
];

const currentSeason: DraftHistorySeason = {
  leagueId: 'league-2026',
  season: '2026',
  leagueStatus: 'pre_draft',
  draftId: 'draft-2026',
  draftStatus: 'pre_draft',
  draftType: 'snake',
  startTime: 1_788_739_254_000,
  rounds: 2,
  teamCount: 2,
  draftSlots: [
    { draftSlot: 1, rosterId: 1 },
    { draftSlot: 2, rosterId: 2 },
  ],
  teams,
  picks: [
    {
      playerId: 'player-a',
      playerName: 'Alpha Player',
      position: 'WR',
      nflTeam: 'SEA',
      rosterId: 1,
      round: 1,
      draftSlot: 1,
      pickNo: 1,
      isKeeper: true,
    },
  ],
};

const priorSeason: DraftHistorySeason = {
  ...currentSeason,
  leagueId: 'league-2025',
  season: '2025',
  leagueStatus: 'complete',
  draftId: 'draft-2025',
  draftStatus: 'complete',
  picks: [
    { ...currentSeason.picks[0], pickNo: 2, draftSlot: 2, round: 1 },
    {
      playerId: 'player-b',
      playerName: 'Beta Runner',
      position: 'RB',
      nflTeam: 'DET',
      rosterId: 2,
      round: 1,
      draftSlot: 1,
      pickNo: 1,
      isKeeper: false,
    },
  ],
};

const history: DraftHistorySnapshot = {
  generatedAt: '2026-08-29T12:00:00.000Z',
  currentLeagueId: currentSeason.leagueId,
  seasons: [currentSeason, priorSeason],
};

describe('HistoryPage', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('switches between season draftboards and identifies keeper picks', () => {
    render(<HistoryPage initialHistory={history} refreshLive={false} />);

    const currentBoard = screen.getByRole('region', { name: '2026 draftboard' });
    expect(within(currentBoard).getByText('A. Player')).toHaveAttribute('title', 'Alpha Player');
    expect(within(currentBoard).getByLabelText('Keeper')).toHaveClass('draft-keeper-badge');
    const wrPick = currentBoard.querySelector('[data-position="WR"]');
    expect(wrPick).toHaveClass('draft-position-cell', 'draft-position-wr', 'draft-keeper-cell');
    expect(within(wrPick as HTMLElement).getByText('WR - SEA')).toBeInTheDocument();
    expect(wrPick?.querySelector('.draft-position-badge')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '2025' }));

    const priorBoard = screen.getByRole('region', { name: '2025 draftboard' });
    expect(within(priorBoard).getByText('B. Runner')).toHaveAttribute('title', 'Beta Runner');
    expect(priorBoard.querySelector('[data-position="RB"]')).toHaveClass('draft-position-rb');
    expect(screen.getByText('2025 Draftboard')).toBeInTheDocument();
  });

  it('shows provisional Team designations and the cross-season keeper ledger', () => {
    render(<HistoryPage initialHistory={history} refreshLive={false} />);

    fireEvent.click(screen.getByRole('tab', { name: 'Keeper History' }));

    expect(screen.getByText('Current designations are provisional')).toBeInTheDocument();
    expect(screen.getByText('No designation on the board')).toBeInTheDocument();
    expect(screen.getAllByText('Alpha Player').length).toBeGreaterThan(1);
    expect(screen.getByText('2025 - Rd 1')).toBeInTheDocument();
    expect(screen.getByText('2026 - Rd 1')).toBeInTheDocument();
  });

  it('keeps the stored draftboard available when the live refresh fails', async () => {
    mockedGetLeague.mockRejectedValueOnce(new Error('Sleeper unavailable'));

    render(<HistoryPage initialHistory={history} />);

    expect(await screen.findByText(/Live keeper refresh failed/)).toHaveTextContent(
      'Sleeper unavailable',
    );
    expect(screen.getByRole('region', { name: '2026 draftboard' })).toBeInTheDocument();
  });
});
