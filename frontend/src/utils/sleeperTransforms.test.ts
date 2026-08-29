// frontend/src/utils/sleeperTransforms.test.ts

import { mergeRostersAndUsersToTeams, pairMatchups, computeSeeds } from './sleeperTransforms';
import {
  mockSleeperUsers,
  mockSleeperRosters,
  mockSleeperMatchupsWeek13,
} from '../test/fixtures/sleeper';

describe('sleeperTransforms', () => {
  describe('mergeRostersAndUsersToTeams', () => {
    it('merges rosters and users into Team objects', () => {
      const teams = mergeRostersAndUsersToTeams(mockSleeperRosters, mockSleeperUsers);

      expect(teams).toHaveLength(12);
      expect(teams[0].teamName).toBe("Big Ol' TDs");
      expect(teams[0].ownerDisplayName).toBe('Joe Champion');
      expect(teams[0].sleeperRosterId).toBe(1);
      expect(teams[0].record).toEqual({ wins: 11, losses: 2, ties: 0 });
      expect(teams[0].pointsFor).toBe(1650.5);
    });

    it('ranks teams by record and points', () => {
      const teams = mergeRostersAndUsersToTeams(mockSleeperRosters, mockSleeperUsers);

      // First team should have rank 1 (best record)
      expect(teams[0].rank).toBe(1);
      expect(teams[0].record.wins).toBe(11);

      // Last team should have rank 12 (worst record)
      const lastTeam = teams.find((t) => t.record.wins === 1);
      expect(lastTeam?.rank).toBe(12);
    });

    it('handles missing user data gracefully', () => {
      const rostersOnly = [mockSleeperRosters[0]];
      const teams = mergeRostersAndUsersToTeams(rostersOnly, []);

      expect(teams).toHaveLength(1);
      expect(teams[0].ownerDisplayName).toBe('Unknown Manager');
    });

    it('calculates points with decimals correctly', () => {
      const teams = mergeRostersAndUsersToTeams(mockSleeperRosters, mockSleeperUsers);
      const team = teams.find((t) => t.sleeperRosterId === 1);

      // fpts: 1650, fpts_decimal: 50 → 1650.50
      expect(team?.pointsFor).toBe(1650.5);
    });
  });

  describe('pairMatchups', () => {
    it('pairs matchups by matchup_id', () => {
      const paired = pairMatchups(13, mockSleeperMatchupsWeek13);

      expect(paired).toHaveLength(6); // 6 matchups
      expect(paired[0].matchupId).toBe(1);
      expect(paired[0].week).toBe(13);
      expect(paired[0].rosterIdA).toBe(1);
      expect(paired[0].rosterIdB).toBe(4);
    });

    it('includes correct scores', () => {
      const paired = pairMatchups(13, mockSleeperMatchupsWeek13);

      const matchup1 = paired.find((p) => p.matchupId === 1);
      expect(matchup1?.pointsA).toBe(87.88);
      expect(matchup1?.pointsB).toBe(85.64);
    });

    it('handles BYE weeks with null rosterIdB', () => {
      const byeMatchup = [
        {
          roster_id: 1,
          matchup_id: 1,
          points: 100,
          starters: ['p1', 'p2'],
          players: ['p1', 'p2'],
        },
      ];

      const paired = pairMatchups(15, byeMatchup);

      expect(paired).toHaveLength(1);
      expect(paired[0].rosterIdB).toBeNull();
      expect(paired[0].pointsB).toBe(0);
    });

    it('counts starters correctly', () => {
      const paired = pairMatchups(13, mockSleeperMatchupsWeek13);

      const matchup1 = paired.find((p) => p.matchupId === 1);
      expect(matchup1?.startersA).toBe(9);
      expect(matchup1?.startersB).toBe(9);
    });
  });

  describe('computeSeeds', () => {
    it('assigns seeds 1-12 to teams', () => {
      const teams = mergeRostersAndUsersToTeams(mockSleeperRosters, mockSleeperUsers);
      const seeded = computeSeeds(teams);

      expect(seeded).toHaveLength(12);

      // Seeds should be 1-12
      const seeds = seeded.map((t) => t.seed).sort((a, b) => (a ?? 0) - (b ?? 0));
      expect(seeds).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    });

    it('assigns seed 1 to best record', () => {
      const teams = mergeRostersAndUsersToTeams(mockSleeperRosters, mockSleeperUsers);
      const seeded = computeSeeds(teams);

      const seed1 = seeded.find((t) => t.seed === 1);
      expect(seed1?.record.wins).toBe(11); // Best record
    });

    it('assigns seed 12 to worst record', () => {
      const teams = mergeRostersAndUsersToTeams(mockSleeperRosters, mockSleeperUsers);
      const seeded = computeSeeds(teams);

      const seed12 = seeded.find((t) => t.seed === 12);
      expect(seed12?.record.wins).toBe(1); // Worst record
    });
  });
});
