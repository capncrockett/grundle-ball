import { computeMegalabowlPlayoffOdds } from './megalabowlPlayoffOdds';
import type { Team } from '../models/fantasy';

const makeTeam = (overrides: Partial<Team> & { sleeperRosterId: number; seed: number }): Team => ({
  teamName: `Team ${overrides.sleeperRosterId.toString()}`,
  ownerDisplayName: 'Owner',
  teamAvatarUrl: null,
  userAvatarUrl: null,
  sleeperUserId: `user-${overrides.sleeperRosterId.toString()}`,
  divisionId: null,
  record: { wins: 5, losses: 5, ties: 0 },
  pointsFor: 1000,
  pointsAgainst: 900,
  rank: overrides.seed,
  ...overrides,
});

describe('computeMegalabowlPlayoffOdds', () => {
  it('gives a dominant seed and a clear bottom seed locked-in ranks, and only ranks the top 6', () => {
    const teams: Team[] = [
      makeTeam({
        sleeperRosterId: 1,
        seed: 1,
        pointsFor: 10000,
        record: { wins: 10, losses: 0, ties: 0 },
      }), // avg 1000
      makeTeam({
        sleeperRosterId: 2,
        seed: 2,
        pointsFor: 1500,
        record: { wins: 8, losses: 2, ties: 0 },
      }), // avg 150
      makeTeam({
        sleeperRosterId: 3,
        seed: 3,
        pointsFor: 1400,
        record: { wins: 7, losses: 3, ties: 0 },
      }), // avg 140
      makeTeam({
        sleeperRosterId: 4,
        seed: 4,
        pointsFor: 1100,
        record: { wins: 6, losses: 4, ties: 0 },
      }), // avg 110
      makeTeam({
        sleeperRosterId: 5,
        seed: 5,
        pointsFor: 1000,
        record: { wins: 5, losses: 5, ties: 0 },
      }), // avg 100
      makeTeam({
        sleeperRosterId: 6,
        seed: 6,
        pointsFor: 100,
        record: { wins: 1, losses: 9, ties: 0 },
      }), // avg 10
      makeTeam({
        sleeperRosterId: 7,
        seed: 7,
        pointsFor: 5000,
        record: { wins: 10, losses: 0, ties: 0 },
      }), // outside top 6
    ];

    const result = computeMegalabowlPlayoffOdds(teams);

    expect(result.map((entry) => entry.sleeperRosterId)).toEqual([1, 2, 3, 4, 5, 6]);

    const dominant = result.find((entry) => entry.sleeperRosterId === 1);
    expect(dominant?.label).toBe('1-1'); // even at its floor, beats everyone else's ceiling

    const laggard = result.find((entry) => entry.sleeperRosterId === 6);
    expect(laggard?.label).toBe('6-6'); // even at its ceiling, trails everyone else's floor

    const midpack = result.find((entry) => entry.sleeperRosterId === 2);
    // Never catches the dominant seed 1 even at its own ceiling, but its
    // worst case slips further as the closer mid-pack seeds' ceilings pass it.
    expect(midpack?.bestRank).toBe(2);
    expect(midpack?.worstRank).toBeGreaterThan(2);
    expect(midpack?.avgPointsPerGame).toBeCloseTo(150);
  });

  it('excludes a top-6 seed with zero games played', () => {
    const teams: Team[] = [
      makeTeam({
        sleeperRosterId: 1,
        seed: 1,
        pointsFor: 1000,
        record: { wins: 5, losses: 5, ties: 0 },
      }),
      makeTeam({
        sleeperRosterId: 2,
        seed: 2,
        pointsFor: 0,
        record: { wins: 0, losses: 0, ties: 0 },
      }),
    ];

    const result = computeMegalabowlPlayoffOdds(teams);

    expect(result.map((entry) => entry.sleeperRosterId)).toEqual([1]);
  });

  it('returns an empty list when no team qualifies', () => {
    expect(computeMegalabowlPlayoffOdds([])).toEqual([]);
  });
});
