import { screen, within } from '@testing-library/react';
import App from './App';
import { renderWithRouter } from './test/testUtils';

describe('App routing and navigation', () => {
  it('redirects "/" to "/standings" and highlights nav', async () => {
    renderWithRouter(<App />, { route: '/' });

    expect(await screen.findByRole('heading', { name: /^standings$/i })).toBeInTheDocument();
    const standingsLink = screen.getByRole('link', { name: /standings/i });
    expect(standingsLink).toHaveClass('btn-active');
  });

  it('keeps nav visible on unknown routes', () => {
    renderWithRouter(<App />, { route: '/not-a-route' });

    expect(screen.getByRole('banner')).toBeInTheDocument();
    const matchupsLink = screen.getByRole('link', { name: /matchups/i });
    expect(matchupsLink).not.toHaveClass('btn-active');
  });

  it('shows the Grundle Ball brand in the header', async () => {
    renderWithRouter(<App />, { route: '/' });

    expect(await screen.findByText(/^Grundle Ball$/)).toBeInTheDocument();
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

  it('routes to the new Playoffs page and highlights its nav item', async () => {
    renderWithRouter(<App />, { route: '/playoffs' });

    expect(await screen.findByRole('heading', { name: /^playoffs$/i })).toBeInTheDocument();

    const banner = screen.getByRole('banner');
    const playoffsLink = within(banner).getByRole('link', { name: /^playoffs$/i });
    expect(playoffsLink).toHaveClass('btn-active');
  });

  it('redirects the legacy /playoffs/live route into the Grundle Bowl beta section', async () => {
    renderWithRouter(<App />, { route: '/playoffs/live' });

    expect(await screen.findByRole('heading', { name: /live playoffs/i })).toBeInTheDocument();
    expect(screen.getByText(/Beta/i)).toBeInTheDocument();

    const banner = screen.getByRole('banner');
    const betaLink = within(banner).getByRole('link', { name: /grundle bowl/i });
    expect(betaLink).toHaveClass('btn-active');
  });
});
