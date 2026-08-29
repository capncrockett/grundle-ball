import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import PlayoffsPage from './PlayoffsPage';
import { renderWithRouter } from '../test/testUtils';
import { server } from '../test/server';
import { errorHandlers } from '../test/mocks/handlers';
import {
  mockSleeperLeague,
  mockSleeperRosters,
  mockPlayoffWinnersBracket,
  mockPlayoffLosersBracket,
} from '../test/fixtures/sleeper';

const SLEEPER_BASE = 'https://api.sleeper.app/v1';

describe('PlayoffsPage', () => {
  it('renders the official bracket mirrored directly from Sleeper', async () => {
    renderWithRouter(<PlayoffsPage />);

    expect(await screen.findByRole('heading', { name: /^playoffs$/i })).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { name: /championship bracket/i }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { name: /consolation bracket/i }),
    ).toBeInTheDocument();

    // Round 1 shows a resolved real team.
    expect(await screen.findByText(/The Dudes From Cocoon/i)).toBeInTheDocument();
    // Round 2 shows a real team (bye) alongside an unresolved placeholder side.
    expect((await screen.findAllByText(/Big Ol' TDs/i)).length).toBeGreaterThan(0);
    expect((await screen.findAllByText(/^TBD$/i)).length).toBeGreaterThan(0);
    expect(await screen.findByText(/Decides 5th \/ 6th/i)).toBeInTheDocument();
    expect(await screen.findByText(/Decides 7th \/ 8th/i)).toBeInTheDocument();
    expect(await screen.findByText(/Decides 9th \/ 10th/i)).toBeInTheDocument();
    expect(await screen.findByText(/Decides 11th \/ 12th/i)).toBeInTheDocument();
    expect(screen.queryByText(/Decides 11th \/ 12th.*Week 16/i)).not.toBeInTheDocument();
    expect(screen.getAllByTestId('sleeper-bracket-grid')).toHaveLength(2);
    expect(screen.getAllByText('Week 15')).toHaveLength(2);
    expect(screen.getAllByText('Finals')).toHaveLength(2);
  });

  it('marks Sleeper bracket seeds as provisional before games are played', async () => {
    const preseasonRosters = mockSleeperRosters.map((roster) => ({
      ...roster,
      settings: {
        ...roster.settings,
        wins: 0,
        losses: 0,
        ties: 0,
        fpts: 0,
        fpts_decimal: 0,
        fpts_against: 0,
        fpts_against_decimal: 0,
      },
    }));
    server.use(
      http.get(`${SLEEPER_BASE}/league/:leagueId`, () =>
        HttpResponse.json({
          ...mockSleeperLeague,
          season: '2026',
          status: 'pre_draft',
          settings: { playoff_week_start: 15, playoff_teams: 6 },
        }),
      ),
      http.get(`${SLEEPER_BASE}/league/:leagueId/rosters`, () =>
        HttpResponse.json(preseasonRosters),
      ),
      http.get(`${SLEEPER_BASE}/league/:leagueId/winners_bracket`, () =>
        HttpResponse.json(mockPlayoffWinnersBracket),
      ),
      http.get(`${SLEEPER_BASE}/league/:leagueId/losers_bracket`, () =>
        HttpResponse.json(mockPlayoffLosersBracket),
      ),
    );

    renderWithRouter(<PlayoffsPage />);

    expect(await screen.findByTestId('playoffs-provisional')).toHaveTextContent(
      /2026 bracket structure.*preseason seeds are provisional/i,
    );
    expect(
      await screen.findByRole('heading', { name: /championship bracket/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/^Seed \d+$/i)).not.toBeInTheDocument();
  });

  it('shows a placeholder before the bracket has been seeded', async () => {
    server.use(
      http.get(`${SLEEPER_BASE}/league/:leagueId`, () =>
        HttpResponse.json({
          ...mockSleeperLeague,
          settings: { playoff_week_start: 16, playoff_teams: 6 },
        }),
      ),
      http.get(`${SLEEPER_BASE}/league/:leagueId/winners_bracket`, () => HttpResponse.json([])),
      http.get(`${SLEEPER_BASE}/league/:leagueId/losers_bracket`, () => HttpResponse.json([])),
    );

    renderWithRouter(<PlayoffsPage />);

    expect(await screen.findByTestId('playoffs-not-started')).toBeInTheDocument();
    expect(screen.getByTestId('playoffs-not-started')).toHaveTextContent(
      /begin the bracket in Week 16/i,
    );
  });

  it('shows error message when data fails to load', async () => {
    server.use(...errorHandlers);

    renderWithRouter(<PlayoffsPage />);

    expect(await screen.findByText(/Failed to load the playoff bracket/i)).toBeInTheDocument();
  });
});
