import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse, delay } from 'msw';
import { MatchupsPage } from './MatchupsPage';
import { server } from '../test/server';
import { errorHandlers } from '../test/mocks/handlers';
import { mockNFLState, mockSleeperMatchupsWeek13 } from '../test/fixtures/sleeper';
import { mockESPNScoreboard } from '../test/fixtures/espn';
import * as espn from '../api/espn';

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

  it('preserves scores and hides completion counts when ESPN fails', async () => {
    server.use(
      http.get(`${ESPN_BASE}/apis/site/v2/sports/football/nfl/scoreboard`, () => {
        return new HttpResponse(null, { status: 500, statusText: 'Internal Server Error' });
      }),
    );

    render(<MatchupsPage />);

    expect(await screen.findByText(/ESPN API error/i)).toBeInTheDocument();
    expect(screen.getAllByTestId('matchup-card')).toHaveLength(6);
    expect(screen.getByText('87.88')).toBeInTheDocument();
    expect(screen.queryByText(/\d+\/\d+ finished/)).not.toBeInTheDocument();
    expect(screen.getAllByText('Starter status unavailable')).toHaveLength(12);
  });

  it('preserves scores when player metadata fails', async () => {
    server.use(
      http.get(
        `${SLEEPER_BASE}/players/nfl`,
        () => new HttpResponse(null, { status: 503, statusText: 'Service Unavailable' }),
      ),
    );

    render(<MatchupsPage />);

    expect(await screen.findByText(/Players API error/i)).toBeInTheDocument();
    expect(screen.getAllByTestId('matchup-card')).toHaveLength(6);
    expect(screen.getByText('87.88')).toBeInTheDocument();
    expect(screen.queryByText(/\d+\/\d+ finished/)).not.toBeInTheDocument();
  });

  it('preserves scores when the ESPN response cannot be transformed', async () => {
    server.use(
      http.get(`${ESPN_BASE}/apis/site/v2/sports/football/nfl/scoreboard`, () =>
        HttpResponse.json({}),
      ),
    );

    render(<MatchupsPage />);

    expect(await screen.findByText(/Starter completion is unavailable/)).toBeInTheDocument();
    expect(screen.getByText('87.88')).toBeInTheDocument();
    expect(screen.queryByText(/\d+\/\d+ finished/)).not.toBeInTheDocument();
  });

  it('ignores a late failure from the previous week', async () => {
    const user = userEvent.setup();
    let rejectPrevious!: (error: Error) => void;
    const previousRequest = new Promise<espn.ESPNScoreboard>((_resolve, reject) => {
      rejectPrevious = reject;
    });
    const scoreboard = jest
      .spyOn(espn, 'getESPNScoreboard')
      .mockImplementation((week) =>
        week === 13 ? previousRequest : Promise.resolve(mockESPNScoreboard),
      );
    server.use(
      http.get(`${SLEEPER_BASE}/league/:leagueId/matchups/:week`, ({ params }) =>
        HttpResponse.json(
          mockSleeperMatchupsWeek13.map((matchup) => ({
            ...matchup,
            points: params.week === '14' && matchup.roster_id === 1 ? 200 : matchup.points,
          })),
        ),
      ),
    );

    try {
      render(<MatchupsPage />);
      await waitFor(() => {
        expect(scoreboard).toHaveBeenCalledWith(13);
      });
      await user.selectOptions(screen.getByRole('combobox', { name: 'Week' }), '14');
      expect(await screen.findByText('200.00')).toBeInTheDocument();

      await act(async () => {
        rejectPrevious(new Error('Old week failed'));
        await previousRequest.catch(() => undefined);
      });

      expect(screen.getByText('200.00')).toBeInTheDocument();
      expect(screen.queryByText(/Old week failed/)).not.toBeInTheDocument();
      expect(screen.queryByText('87.88')).not.toBeInTheDocument();
      expect(screen.queryByText('Starter status unavailable')).not.toBeInTheDocument();
    } finally {
      scoreboard.mockRestore();
    }
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
