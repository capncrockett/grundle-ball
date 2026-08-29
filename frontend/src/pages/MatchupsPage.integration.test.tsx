import { render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse, delay } from 'msw';
import { MatchupsPage } from './MatchupsPage';
import { server } from '../test/server';
import { errorHandlers } from '../test/mocks/handlers';
import { mockNFLState, mockSleeperMatchupsWeek13 } from '../test/fixtures/sleeper';

const SLEEPER_BASE = 'https://api.sleeper.app/v1';
const ESPN_BASE = 'https://site.api.espn.com';

describe('MatchupsPage', () => {
  it('renders matchup cards from fixtures', async () => {
    render(<MatchupsPage />);

    expect(await screen.findByText(/Big Ol' TDs/i)).toBeInTheDocument();
    expect(screen.getByText(/Glaurung & Foes/i)).toBeInTheDocument();
    expect(screen.getByText(/11-2/)).toBeInTheDocument();
  });

  it('shows loading spinner while fetching', async () => {
    server.use(
      http.get(`${SLEEPER_BASE}/league/:leagueId/matchups/:week`, async () => {
        await delay(100);
        return HttpResponse.json(mockSleeperMatchupsWeek13);
      }),
    );

    const { container } = render(<MatchupsPage />);

    await waitFor(() => {
      expect(container.querySelector('.loading-spinner')).toBeTruthy();
    });
  });

  it('surfaces API errors', async () => {
    server.use(...errorHandlers);

    render(<MatchupsPage />);

    expect(await screen.findByText(/Sleeper API error/i)).toBeInTheDocument();
  });

  it('surfaces ESPN scoreboard errors', async () => {
    server.use(
      http.get(`${ESPN_BASE}/apis/site/v2/sports/football/nfl/scoreboard`, () => {
        return new HttpResponse(null, { status: 500, statusText: 'Internal Server Error' });
      }),
    );

    render(<MatchupsPage />);

    expect(await screen.findByText(/ESPN API error/i)).toBeInTheDocument();
  });

  it('shows empty state when no matchups found', async () => {
    server.use(
      http.get(`${SLEEPER_BASE}/league/:leagueId/matchups/:week`, () => HttpResponse.json([])),
    );

    render(<MatchupsPage />);

    expect(await screen.findByText(/No matchups found for this week/i)).toBeInTheDocument();
  });

  it('treats NFL preseason as pre-schedule fantasy Week 1', async () => {
    server.use(
      http.get(`${SLEEPER_BASE}/state/nfl`, () =>
        HttpResponse.json({
          ...mockNFLState,
          week: 3,
          display_week: 3,
          season: '2026',
          season_type: 'pre',
          league_season: '2026',
        }),
      ),
      http.get(`${SLEEPER_BASE}/league/:leagueId/matchups/:week`, () => HttpResponse.json([])),
      http.get(`${SLEEPER_BASE}/players/nfl`, () =>
        HttpResponse.json({ message: 'should not be called' }, { status: 500 }),
      ),
      http.get(`${ESPN_BASE}/apis/site/v2/sports/football/nfl/scoreboard`, () =>
        HttpResponse.json({ message: 'should not be called' }, { status: 500 }),
      ),
    );

    render(<MatchupsPage />);

    expect(await screen.findByText('2026 • Preseason • Fantasy Week 1')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /week/i })).toHaveValue('1');
    expect(
      await screen.findByText(/Sleeper will publish them after the league draft/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/API error/i)).not.toBeInTheDocument();
  });

  it('falls back when roster data is missing', async () => {
    server.use(http.get(`${SLEEPER_BASE}/league/:leagueId/rosters`, () => HttpResponse.json([])));

    render(<MatchupsPage />);

    expect(await screen.findAllByText(/Unknown/i)).not.toHaveLength(0);
  });
});
