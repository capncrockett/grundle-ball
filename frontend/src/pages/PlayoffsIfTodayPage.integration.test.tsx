import { fireEvent, render, screen } from '@testing-library/react';
import PlayoffsIfTodayPage from './PlayoffsIfTodayPage';
import { errorHandlers } from '../test/mocks/handlers';
import { server } from '../test/server';

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

  it('surfaces API errors', async () => {
    server.use(...errorHandlers);

    render(<PlayoffsIfTodayPage />);

    expect(await screen.findByText(/Failed to load playoff preview/i)).toBeInTheDocument();
  });
});
