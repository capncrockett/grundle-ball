import { screen, waitFor, within } from '@testing-library/react';
import App from './App';
import { renderWithRouter } from './test/testUtils';

// Mock pages to avoid real data fetching
jest.mock('./pages/PlayoffsIfTodayPage', () => ({
  __esModule: true,
  default: () => <div>If Today Page</div>,
}));

jest.mock('./pages/PlayoffsLivePage', () => ({
  __esModule: true,
  default: () => <div>Live Playoffs Page</div>,
}));

jest.mock('./pages/PlayoffsPage', () => ({
  __esModule: true,
  default: () => <div>Playoffs Page</div>,
}));

jest.mock('./pages/StandingsPage', () => ({
  StandingsPage: () => <div>Standings Page</div>,
}));

jest.mock('./pages/ConstitutionPage', () => ({
  ConstitutionPage: () => <div>Constitution Page</div>,
}));

// Theme selector manipulates DOM/localStorage; keep it simple for tests
jest.mock('./components/ThemeSelector', () => ({
  ThemeSelector: () => <div>Theme Picker</div>,
}));

describe('App routing + nav', () => {
  it('redirects "/" to "/standings" and highlights nav', async () => {
    renderWithRouter(<App />, { route: '/' });

    expect(await screen.findByText('Standings Page')).toBeInTheDocument();

    const standingsLink = screen.getByRole('link', { name: /standings/i });
    await waitFor(() => {
      expect(standingsLink).toHaveClass('btn-active');
    });
  });

  it('renders the new Playoffs route and highlights its nav item', () => {
    renderWithRouter(<App />, { route: '/playoffs' });

    expect(screen.getByText('Playoffs Page')).toBeInTheDocument();

    const banner = screen.getByRole('banner');
    const playoffsLink = within(banner).getByRole('link', { name: /^playoffs$/i });
    expect(playoffsLink).toHaveClass('btn-active');
  });

  it('renders the relocated Beta If Today route and nav state', () => {
    renderWithRouter(<App />, { route: '/beta/grundle-bowl/if-today' });

    expect(screen.getByText('If Today Page')).toBeInTheDocument();

    const ifTodayLink = screen.getByRole('link', { name: /if today/i });
    const matchupsLink = screen.getByRole('link', { name: /matchups/i });

    expect(ifTodayLink).toHaveClass('btn-active');
    expect(matchupsLink).not.toHaveClass('btn-active');

    const banner = screen.getByRole('banner');
    const betaLink = within(banner).getByRole('link', { name: /grundle bowl/i });
    expect(betaLink).toHaveClass('btn-active');
  });

  it('redirects the legacy /playoffs/live route into the Beta section', () => {
    renderWithRouter(<App />, { route: '/playoffs/live' });

    expect(screen.getByText('Live Playoffs Page')).toBeInTheDocument();
  });

  it('renders constitution route and highlights constitution nav', () => {
    renderWithRouter(<App />, { route: '/constitution' });

    expect(screen.getByText('Constitution Page')).toBeInTheDocument();

    const banner = screen.getByRole('banner');
    const constitutionLink = within(banner).getByRole('link', { name: /constitution/i });
    expect(constitutionLink).toHaveClass('btn-active');
    expect(constitutionLink).toHaveAttribute('href', '/constitution');
  });
});
