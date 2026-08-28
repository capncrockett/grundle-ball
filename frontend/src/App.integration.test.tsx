import { screen, within } from '@testing-library/react';
import App from './App';
import { renderWithRouter } from './test/testUtils';

describe('App routing and navigation', () => {
  it('redirects "/" to "/playoffs/live" and highlights nav', async () => {
    renderWithRouter(<App />, { route: '/' });

    expect(await screen.findByRole('heading', { name: /live playoffs/i })).toBeInTheDocument();
    const playoffsLink = screen.getByRole('link', { name: /playoffs/i });
    expect(playoffsLink).toHaveClass('btn-active');
  });

  it('keeps nav visible on unknown routes', () => {
    renderWithRouter(<App />, { route: '/not-a-route' });

    expect(screen.getByRole('banner')).toBeInTheDocument();
    const matchupsLink = screen.getByRole('link', { name: /matchups/i });
    expect(matchupsLink).not.toHaveClass('btn-active');
  });

it('shows mobile brand text at small widths', async () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, value: 480 });
    window.dispatchEvent(new Event('resize'));

    renderWithRouter(<App />, { route: '/' });

    expect(await screen.findByText(/KB Playoffs/i)).toBeInTheDocument();
  });

it('routes to constitution and highlights its nav item', async () => {
    renderWithRouter(<App />, { route: '/constitution' });

    expect(
      await screen.findByRole('heading', { name: /grundle league constitution/i }),
    ).toBeInTheDocument();

    const banner = screen.getByRole('banner');
    const constitutionLink = within(banner).getByRole('link', { name: /constitution/i });
    expect(constitutionLink).toHaveClass('btn-active');
    expect(constitutionLink).toHaveAttribute('href', '/constitution');
  });
});
