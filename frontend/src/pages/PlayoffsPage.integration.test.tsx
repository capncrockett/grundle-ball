import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import PlayoffsPage from './PlayoffsPage';
import { renderWithRouter } from '../test/testUtils';
import { server } from '../test/server';
import { errorHandlers } from '../test/mocks/handlers';

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
    expect(await screen.findByText(/Big Ol' TDs/i)).toBeInTheDocument();
    expect((await screen.findAllByText(/Winner of Game/i)).length).toBeGreaterThan(0);
  });

  it('shows a placeholder before the bracket has been seeded', async () => {
    server.use(
      http.get(`${SLEEPER_BASE}/league/:leagueId/winners_bracket`, () => HttpResponse.json([])),
      http.get(`${SLEEPER_BASE}/league/:leagueId/losers_bracket`, () => HttpResponse.json([])),
    );

    renderWithRouter(<PlayoffsPage />);

    expect(await screen.findByTestId('playoffs-not-started')).toBeInTheDocument();
  });

  it('shows error message when data fails to load', async () => {
    server.use(...errorHandlers);

    renderWithRouter(<PlayoffsPage />);

    expect(await screen.findByText(/Failed to load the playoff bracket/i)).toBeInTheDocument();
  });
});
