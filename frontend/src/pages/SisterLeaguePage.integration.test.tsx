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
  playoffByeCount: 0,
  matchups: [],
};

const game = (
  week: number,
  homeTeamId: number,
  awayTeamId: number,
  homePoints = 0,
  awayPoints = 0,
) => ({ week, homeTeamId, awayTeamId, homePoints, awayPoints, final: homePoints > 0 });

// Two weeks played, two to go: Alpha leads, Bravo and Charlie share the
// bubble for the second playoff spot.
const bubbleSnapshot: SisterLeagueSnapshot = {
  leagueId: '2',
  seasonId: 2026,
  leagueName: 'Bubble League',
  fetchedAt: '2026-11-20T18:00:00.000Z',
  currentMatchupPeriod: 3,
  regularSeasonWeeks: 4,
  playoffTeamCount: 2,
  playoffByeCount: 1,
  teams: [
    { id: 1, name: 'Alpha', wins: 2, losses: 0, ties: 0, pointsFor: 238, seed: 1 },
    { id: 3, name: 'Charlie', wins: 1, losses: 1, ties: 0, pointsFor: 211, seed: 2 },
    { id: 2, name: 'Bravo', wins: 1, losses: 1, ties: 0, pointsFor: 210, seed: 3 },
    { id: 4, name: 'Delta', wins: 0, losses: 2, ties: 0, pointsFor: 185, seed: 4 },
  ],
  matchups: [
    game(1, 1, 4, 120, 90),
    game(1, 2, 3, 110, 100),
    game(2, 1, 2, 118, 100),
    game(2, 3, 4, 111, 95),
    game(3, 1, 3),
    game(3, 2, 4),
    game(4, 1, 4),
    game(4, 2, 3),
  ],
};

describe('SisterLeaguePage', () => {
  it('lists teams by seed with records, points, and best/worst seed ranges', () => {
    render(<SisterLeaguePage snapshot={snapshot} />);

    expect(screen.getByRole('heading', { name: 'Sibling League' })).toBeInTheDocument();
    expect(screen.getByText(/week 13 of 14/i)).toBeInTheDocument();

    const standings = within(screen.getByRole('table', { name: 'Standings' }));
    const rows = standings.getAllByRole('row').slice(1);
    expect(rows.map((row) => within(row).getAllByRole('cell')[1]?.textContent)).toEqual([
      'Front Runners',
      'Bubble Boys',
      'Bottom Feeders',
    ]);

    const leader = standings.getByRole('row', { name: /Front Runners/ });
    const bubble = standings.getByRole('row', { name: /Bubble Boys/ });
    const bottom = standings.getByRole('row', { name: /Bottom Feeders/ });
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

  it('narrates the bubble with odds, remaining-record paths, and rooting interests', () => {
    render(<SisterLeaguePage snapshot={bubbleSnapshot} simulationRuns={2000} />);

    const bubble = screen.getByRole('region', { name: 'Bubble Watch' });
    expect(within(bubble).getByText('(2) Charlie')).toBeInTheDocument();
    expect(within(bubble).getByText('(3) Bravo')).toBeInTheDocument();
    expect(within(bubble).getAllByText(/Most likely finish/).length).toBeGreaterThan(0);
    expect(within(bubble).getAllByLabelText(/Odds by remaining record/).length).toBeGreaterThan(0);
    expect(within(bubble).getAllByText(/root for/i).length).toBeGreaterThan(0);

    expect(screen.getByRole('columnheader', { name: 'Playoffs' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Bye' })).toBeInTheDocument();
  });

  it("summarizes each team's season scoring", () => {
    render(<SisterLeaguePage snapshot={bubbleSnapshot} simulationRuns={200} />);

    const scoring = screen.getByRole('region', { name: 'Season scoring' });
    const alpha = within(scoring).getByRole('row', { name: /Alpha/ });
    expect(
      within(alpha)
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    ).toEqual(['Alpha', '119.0', '119.0', '120.0', '118.0']);
    expect(within(scoring).getByText(/League median week: 105\.0/)).toBeInTheDocument();
  });
});
