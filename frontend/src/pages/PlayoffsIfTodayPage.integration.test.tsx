import { fireEvent, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import PlayoffsIfTodayPage from './PlayoffsIfTodayPage';
import { errorHandlers } from '../test/mocks/handlers';
import { server } from '../test/server';
import { mockNFLState } from '../test/fixtures/sleeper';

describe('PlayoffsIfTodayPage', () => {
  it('renders bracket preview and toggles modes', async () => {
    render(<PlayoffsIfTodayPage />);

    expect(
      await screen.findByRole('heading', { name: /if the season ended today/i }),
    ).toBeInTheDocument();
    expect(await screen.findByText(/Bubble Watch/i)).toBeInTheDocument();
    expect(await screen.findByText(/Bye Chase/i)).toBeInTheDocument();
    expect(await screen.findByText(/Division Races/i)).toBeInTheDocument();

    const scoreButton = screen.getByRole('button', { name: /score mode/i });
    const rewardButton = screen.getByRole('button', { name: /reward mode/i });

    expect(scoreButton).toHaveClass('btn-primary');
    fireEvent.click(rewardButton);
    expect(rewardButton).toHaveClass('btn-primary');
  });

  it('shows head-to-head info when selecting a team', async () => {
    render(<PlayoffsIfTodayPage />);

    await screen.findByText(/Bubble Watch/i);
    const teamSelect = await screen.findByRole('combobox');
    fireEvent.change(teamSelect, { target: { value: '1' } });

    expect(await screen.findByText(/Head-to-head/i)).toBeInTheDocument();
  });

  it('hides the narratives before week 2 has fully wrapped', async () => {
    server.use(
      http.get('https://api.sleeper.app/v1/state/nfl', () =>
        HttpResponse.json({ ...mockNFLState, week: 2 }),
      ),
    );

    render(<PlayoffsIfTodayPage />);

    expect(
      await screen.findByRole('heading', { name: /if the season ended today/i }),
    ).toBeInTheDocument();
    // Bracket itself still renders; only the narrative call-outs are gated.
    expect(await screen.findByRole('combobox')).toBeInTheDocument();
    expect(screen.queryByText(/Bubble Watch/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Bye Chase/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Division Races/i)).not.toBeInTheDocument();
  });

  it('surfaces API errors', async () => {
    server.use(...errorHandlers);

    render(<PlayoffsIfTodayPage />);

    expect(await screen.findByText(/Failed to load playoff preview/i)).toBeInTheDocument();
  });
});
