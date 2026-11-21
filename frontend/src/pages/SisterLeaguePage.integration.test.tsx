import { render, screen, within } from '@testing-library/react';
import type { SisterLeagueSnapshot } from '../sisterLeague/sisterLeague';
import { SisterLeaguePage } from './SisterLeaguePage';

const snapshot: SisterLeagueSnapshot = {
  leagueId: '1',
  seasonId: 2026,
  leagueName: 'Sibling League',
  fetchedAt: '2026-11-20T18:00:00.000Z',
  currentMatchupPeriod: 13,
  regularSeasonWeeks: 14,
  playoffTeamCount: 2,
  teams: [
    { id: 3, name: 'Bottom Feeders', wins: 2, losses: 10, ties: 0, pointsFor: 900, seed: 3 },
    { id: 1, name: 'Front Runners', wins: 11, losses: 1, ties: 0, pointsFor: 1500.5, seed: 1 },
    { id: 2, name: 'Bubble Boys', wins: 6, losses: 5, ties: 1, pointsFor: 1200, seed: 2 },
  ],
};

describe('SisterLeaguePage', () => {
  it('lists teams by seed with records, points, and best/worst seed ranges', () => {
    render(<SisterLeaguePage snapshot={snapshot} />);

    expect(screen.getByRole('heading', { name: 'Sibling League' })).toBeInTheDocument();
    expect(screen.getByText(/week 13 of 14/i)).toBeInTheDocument();

    const rows = screen.getAllByRole('row').slice(1);
    expect(rows.map((row) => within(row).getAllByRole('cell')[1]?.textContent)).toEqual([
      'Front Runners',
      'Bubble Boys',
      'Bottom Feeders',
    ]);

    const leader = screen.getByRole('row', { name: /Front Runners/ });
    const bubble = screen.getByRole('row', { name: /Bubble Boys/ });
    const bottom = screen.getByRole('row', { name: /Bottom Feeders/ });
    expect(within(leader).getByText('11-1')).toBeInTheDocument();
    expect(within(leader).getByText('1500.50')).toBeInTheDocument();
    expect(within(leader).getByText('1-1')).toBeInTheDocument();
    expect(within(leader).getByText('Clinched')).toBeInTheDocument();
    expect(within(bubble).getByText('6-5-1')).toBeInTheDocument();
    expect(within(bubble).getByText('2-2')).toBeInTheDocument();
    expect(within(bottom).getByText('Out')).toBeInTheDocument();
  });

  it('labels the league as separate from the Grundle League', () => {
    render(<SisterLeaguePage snapshot={snapshot} />);

    expect(screen.getByText(/not part of the Grundle League/i)).toBeInTheDocument();
  });
});
