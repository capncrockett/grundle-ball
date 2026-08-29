import { render, screen, within } from '@testing-library/react';
import { StandingsPage } from './StandingsPage';
import { mockSleeperLeague, mockSleeperRosters, mockSleeperUsers } from '../test/fixtures/sleeper';
import * as sleeperApi from '../api/sleeper';
import * as matchupHistory from '../data/matchupHistory';
import type { StoredMatchup } from '../data/matchupHistoryTypes';

describe('StandingsPage', () => {
  let leagueSpy: jest.SpyInstance;
  let usersSpy: jest.SpyInstance;
  let rostersSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    leagueSpy = jest.spyOn(sleeperApi, 'getLeague').mockResolvedValue(mockSleeperLeague);
    usersSpy = jest.spyOn(sleeperApi, 'getLeagueUsers').mockResolvedValue(mockSleeperUsers);
    rostersSpy = jest.spyOn(sleeperApi, 'getLeagueRosters').mockResolvedValue(mockSleeperRosters);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders standings table with seeds', async () => {
    render(<StandingsPage />);

    expect(await screen.findByText(/Toughest Schedule/i)).toBeInTheDocument();
    const rows = await screen.findAllByRole('row');
    const row = rows.find((candidate) => within(candidate).queryByText(/Big Ol' TDs/i));
    expect(row).toBeInTheDocument();
    expect(row).toHaveTextContent(/\b1\b/);
  });

  it('requests stored history for the active Sleeper league and season', async () => {
    const historySpy = jest.spyOn(matchupHistory, 'getStoredMatchups');

    render(<StandingsPage />);

    expect(await screen.findByText(/Toughest Schedule/i)).toBeInTheDocument();
    expect(historySpy).toHaveBeenCalledWith({
      leagueId: mockSleeperLeague.league_id,
      season: mockSleeperLeague.season,
    });
  });

  it('renders insights cards with fixture data', async () => {
    render(<StandingsPage />);

    const toughestCardHeading = await screen.findByText(/Toughest Schedule/i);
    const toughestCard = toughestCardHeading.closest('.card');
    expect(toughestCard).toBeInTheDocument();
    if (toughestCard instanceof HTMLElement) {
      expect(
        within(toughestCard).getByText(/Team Twelve is eating 130\.8 PA per week/i),
      ).toBeInTheDocument();
      expect(within(toughestCard).getByText(/118\.4/)).toBeInTheDocument();
    }

    const easiestCardHeading = await screen.findByText(/Easiest Schedule/i);
    const easiestCard = easiestCardHeading.closest('.card');
    expect(easiestCard).toBeInTheDocument();
    if (easiestCard instanceof HTMLElement) {
      expect(
        within(easiestCard).getByText(/Big Ol' TDs sees only 107\.7 PA per week/i),
      ).toBeInTheDocument();
    }
  });

  it('flags stat-correction risk when a small margin flip changes seeding', async () => {
    const closeMatchups: StoredMatchup[] = [
      {
        leagueId: 'test_league',
        season: '2025',
        week: 1,
        team: "Big Ol' TDs",
        opponent: 'Kitchen Chubbards',
        pointsFor: 110,
        pointsAgainst: 107,
        margin: 3,
        finished: true,
      },
      {
        leagueId: 'test_league',
        season: '2025',
        week: 1,
        team: 'Kitchen Chubbards',
        opponent: "Big Ol' TDs",
        pointsFor: 107,
        pointsAgainst: 110,
        margin: -3,
        finished: true,
      },
    ];

    jest.spyOn(matchupHistory, 'getStoredMatchups').mockReturnValue(closeMatchups);

    const tightRosters = [
      {
        ...mockSleeperRosters[0],
        settings: {
          ...mockSleeperRosters[0].settings,
          wins: 8,
          losses: 5,
          ties: 0,
          fpts: 1400,
          fpts_decimal: 0,
          fpts_against: 1200,
          fpts_against_decimal: 0,
        },
        division_id: 1,
      },
      {
        ...mockSleeperRosters[5],
        settings: {
          ...mockSleeperRosters[5].settings,
          wins: 7,
          losses: 6,
          ties: 0,
          fpts: 1390,
          fpts_decimal: 0,
          fpts_against: 1210,
          fpts_against_decimal: 0,
        },
        division_id: 1,
      },
      {
        ...mockSleeperRosters[1],
        settings: {
          ...mockSleeperRosters[1].settings,
          wins: 6,
          losses: 7,
          ties: 0,
          fpts: 1300,
          fpts_decimal: 0,
          fpts_against: 1250,
          fpts_against_decimal: 0,
        },
        division_id: 1,
      },
      {
        ...mockSleeperRosters[2],
        settings: {
          ...mockSleeperRosters[2].settings,
          wins: 5,
          losses: 8,
          ties: 0,
          fpts: 1290,
          fpts_decimal: 0,
          fpts_against: 1260,
          fpts_against_decimal: 0,
        },
        division_id: 1,
      },
    ];
    rostersSpy.mockResolvedValueOnce(tightRosters);

    render(<StandingsPage />);

    const tables = await screen.findAllByRole('table');
    const standingsTable = tables.find((table) =>
      within(table).queryByRole('columnheader', { name: /^Seed$/i }),
    );
    expect(standingsTable).toBeDefined();
    if (!standingsTable) return;

    const rows = within(standingsTable).getAllByRole('row');
    const row = rows.find((candidate) => within(candidate).queryByText(/Big Ol' TDs/i));
    expect(row).toBeDefined();
    if (row instanceof HTMLElement) {
      expect(within(row).getAllByText(/sc/).length).toBeGreaterThan(0);
    }

    const other = rows.find((candidate) => within(candidate).queryByText(/Glaurung & Foes/i));
    if (other instanceof HTMLElement) {
      expect(within(other).queryByText(/sc/)).toBeNull();
    }
  });

  it('shows empty state when no teams', async () => {
    rostersSpy.mockResolvedValueOnce([]);
    usersSpy.mockResolvedValueOnce([]);

    render(<StandingsPage />);

    expect(await screen.findByText(/No teams found/i)).toBeInTheDocument();
  });

  it('surfaces API errors', async () => {
    leagueSpy.mockRejectedValueOnce(new Error('boom'));

    render(<StandingsPage />);

    expect(await screen.findByText(/Failed to load standings/i)).toBeInTheDocument();
  });

  it('hides insights before any games are played', async () => {
    const zeroed = mockSleeperRosters.map((roster, index) => ({
      ...roster,
      division_id: undefined,
      settings: {
        ...roster.settings,
        division: (index % 3) + 1,
        wins: 0,
        losses: 0,
        ties: 0,
        fpts: 0,
        fpts_decimal: 0,
        fpts_against: 0,
        fpts_against_decimal: 0,
      },
    }));
    leagueSpy.mockResolvedValueOnce({
      ...mockSleeperLeague,
      status: 'pre_draft',
      season: '2026',
      season_type: 'pre',
      metadata: {
        division_1: 'D1',
        division_2: 'D2',
        division_3: 'D3',
      },
    });
    rostersSpy.mockResolvedValueOnce(zeroed);

    render(<StandingsPage />);

    const preseason = await screen.findByTestId('division-preseason');
    expect(preseason).toHaveTextContent(/2026 Preseason Divisions/i);
    expect(preseason).toHaveTextContent(/Division assignments are live/i);
    expect(screen.queryByText(/Toughest Schedule/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Easiest Schedule/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/did not return division assignments/i)).not.toBeInTheDocument();
    expect(within(preseason).getByRole('heading', { name: 'D1' })).toBeInTheDocument();
    expect(within(preseason).getByRole('heading', { name: 'D2' })).toBeInTheDocument();
    expect(within(preseason).getByRole('heading', { name: 'D3' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /^Seed$/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Standings Glossary/i)).not.toBeInTheDocument();
  });
});
