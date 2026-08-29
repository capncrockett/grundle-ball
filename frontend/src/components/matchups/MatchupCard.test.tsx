// frontend/src/components/matchups/MatchupCard.test.tsx

import { render, screen } from '@testing-library/react';
import { MatchupCard } from './MatchupCard';
import type { LiveMatchData, Team } from '../../models/fantasy';

// Mock TeamAvatars to simplify testing (avoid duplicate name text)
jest.mock('../common/TeamAvatars', () => ({
  TeamAvatars: () => <div data-testid="team-avatar" />,
}));

const mockTeamA: Team = {
  teamName: "Big Ol' TDs",
  ownerDisplayName: 'Joe Champion',
  teamAvatarUrl: null,
  userAvatarUrl: 'avatar1',
  sleeperRosterId: 1,
  sleeperUserId: 'user1',
  divisionId: 1,
  record: { wins: 11, losses: 2, ties: 0 },
  pointsFor: 1650.5,
  pointsAgainst: 1400,
  rank: 1,
  seed: 1,
};

const mockTeamB: Team = {
  teamName: 'Glaurung & Foes',
  ownerDisplayName: 'Sarah Winner',
  teamAvatarUrl: null,
  userAvatarUrl: 'avatar2',
  sleeperRosterId: 4,
  sleeperUserId: 'user4',
  divisionId: 2,
  record: { wins: 9, losses: 4, ties: 0 },
  pointsFor: 1575.8,
  pointsAgainst: 1450,
  rank: 4,
  seed: 4,
};

const mockLiveMatchData: LiveMatchData = {
  teamIdA: 1,
  teamIdB: 4,
  pointsA: 87.88,
  pointsB: 85.64,
  startersA: 9,
  startersB: 9,
  playersFinishedA: 8,
  playersFinishedB: 7,
  week: 13,
};

describe('MatchupCard', () => {
  it('renders team names and records', () => {
    render(<MatchupCard live={mockLiveMatchData} teamA={mockTeamA} teamB={mockTeamB} />);

    expect(screen.getByText("Big Ol' TDs")).toBeInTheDocument();
    expect(screen.getByText('Glaurung & Foes')).toBeInTheDocument();
    expect(screen.getByText('11-2')).toBeInTheDocument();
    expect(screen.getByText('9-4')).toBeInTheDocument();
  });

  it('displays current scores', () => {
    render(<MatchupCard live={mockLiveMatchData} teamA={mockTeamA} teamB={mockTeamB} />);

    expect(screen.getByText('87.88')).toBeInTheDocument();
    expect(screen.getByText('85.64')).toBeInTheDocument();
  });

  it('shows finished players count', () => {
    render(<MatchupCard live={mockLiveMatchData} teamA={mockTeamA} teamB={mockTeamB} />);

    expect(screen.getByText('8/9 finished')).toBeInTheDocument();
    expect(screen.getByText('7/9 finished')).toBeInTheDocument();
  });

  it('displays week and matchup numbers', () => {
    render(<MatchupCard live={mockLiveMatchData} teamA={mockTeamA} teamB={mockTeamB} />);

    expect(screen.getByText('Week 13')).toBeInTheDocument();
    expect(screen.getByText('Matchup #1-4')).toBeInTheDocument();
  });

  it('handles missing team A gracefully', () => {
    render(<MatchupCard live={mockLiveMatchData} teamA={undefined} teamB={mockTeamB} />);

    expect(screen.getByText('Unknown')).toBeInTheDocument();
    expect(screen.getByText('-')).toBeInTheDocument(); // Record placeholder
  });

  it('handles BYE week (no team B)', () => {
    const byeMatchup: LiveMatchData = {
      ...mockLiveMatchData,
      teamIdB: null,
      pointsB: 0,
      startersB: 0,
      playersFinishedB: 0,
    };

    render(<MatchupCard live={byeMatchup} teamA={mockTeamA} teamB={undefined} />);

    expect(screen.getByText('BYE')).toBeInTheDocument();
    expect(screen.getByText('Matchup #1-BYE')).toBeInTheDocument();
    // Team B score should show dash
    expect(screen.queryByText('0.00')).not.toBeInTheDocument();
  });

  it('formats scores to 2 decimal places', () => {
    const matchupWithDecimals: LiveMatchData = {
      ...mockLiveMatchData,
      pointsA: 100.5,
      pointsB: 99.99,
    };

    render(<MatchupCard live={matchupWithDecimals} teamA={mockTeamA} teamB={mockTeamB} />);

    expect(screen.getByText('100.50')).toBeInTheDocument();
    expect(screen.getByText('99.99')).toBeInTheDocument();
  });

  it('handles teams with ties in record', () => {
    const teamWithTies: Team = {
      ...mockTeamA,
      record: { wins: 8, losses: 3, ties: 2 },
    };

    render(<MatchupCard live={mockLiveMatchData} teamA={teamWithTies} teamB={mockTeamB} />);

    expect(screen.getByText('8-3-2')).toBeInTheDocument();
  });

  it('shows zero points as dash when pointsA is 0', () => {
    const noPointsMatch: LiveMatchData = {
      ...mockLiveMatchData,
      pointsA: 0,
    };

    render(<MatchupCard live={noPointsMatch} teamA={mockTeamA} teamB={mockTeamB} />);

    // 0 is falsy, so it shows '-'
    expect(screen.getByText('-')).toBeInTheDocument();
  });
});
