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

jest.mock('./pages/HistoryPage', () => ({
  __esModule: true,
  default: () => <div>History Page</div>,
  HistoryPage: () => <div>History Page</div>,
}));

jest.mock('./pages/DraftIntelPage', () => ({
  __esModule: true,
  default: () => <div>Draft Intel Page</div>,
  DraftIntelPage: () => <div>Draft Intel Page</div>,
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

  it('renders league history and highlights its nav item', async () => {
    renderWithRouter(<App />, { route: '/history' });

    expect(await screen.findByText('History Page')).toBeInTheDocument();

    const banner = screen.getByRole('banner');
    const historyLink = within(banner).getByRole('link', { name: /history/i });
    expect(historyLink).toHaveClass('btn-active');
    expect(historyLink).toHaveAttribute('href', '/history');
  });

  it('renders Draft Intel through its restricted route on an approved host', async () => {
    renderWithRouter(<App />, { route: '/local/draft-intel' });

    expect(await screen.findByText('Draft Intel Page')).toBeInTheDocument();

    const banner = screen.getByRole('banner');
    const draftIntelLink = within(banner).getByRole('link', { name: /draft intel/i });
    expect(draftIntelLink).toHaveClass('btn-active');
    expect(draftIntelLink).toHaveAttribute('href', '/local/draft-intel');
  });

  it('shows only the useful deployment details in the footer', () => {
    renderWithRouter(<App />, { route: '/standings' });

    const footer = screen.getByRole('contentinfo');
    expect(footer).toHaveTextContent('Branch: local');
    expect(footer).toHaveTextContent('Environment: development');
    expect(within(footer).getByRole('link', { name: /Repository:/ })).toHaveAttribute(
      'href',
      'https://github.com/capncrockett/grundle-ball',
    );
    expect(footer).not.toHaveTextContent(/SHA:|Built:|Author:|Message:|Deploy:|Project:/);
  });
});
