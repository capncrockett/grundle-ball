import { fireEvent, render, screen } from '@testing-library/react';
import PlayoffsLivePage from './PlayoffsLivePage';
import { server } from '../test/server';
import { errorHandlers } from '../test/mocks/handlers';

describe('PlayoffsLivePage', () => {
  it('renders live bracket and allows mode toggle', async () => {
    render(<PlayoffsLivePage />);

    expect(await screen.findByRole('heading', { name: /live playoffs/i })).toBeInTheDocument();

    const [teamLabel] = await screen.findAllByText(/Big Ol' TDs/i);
    expect(teamLabel).toBeInTheDocument();
    expect(await screen.findByText('123.45')).toBeInTheDocument();
    expect(await screen.findByText('150.01')).toBeInTheDocument();

    const rewardButton = screen.getByRole('button', { name: /reward mode/i });
    fireEvent.click(rewardButton);
    expect(rewardButton).toHaveClass('btn-primary');
  });

  it('shows error message when data fails to load', async () => {
    server.use(...errorHandlers);

    render(<PlayoffsLivePage />);

    expect(await screen.findByText(/Failed to load live playoffs/i)).toBeInTheDocument();
  });
});
