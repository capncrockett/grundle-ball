import { computePlayoffRaceInsights } from './playoffRaceInsights';
import { computeSeeds, mergeRostersAndUsersToTeams } from '../utils/sleeperTransforms';
import { mockSleeperLeague, mockSleeperRosters, mockSleeperUsers } from '../test/fixtures/sleeper';

const buildTeams = () =>
  computeSeeds(
    mergeRostersAndUsersToTeams(mockSleeperRosters, mockSleeperUsers, mockSleeperLeague),
  );

describe('computePlayoffRaceInsights', () => {
  it('returns null when no teams', () => {
    expect(computePlayoffRaceInsights([])).toBeNull();
  });

  it('identifies bubble, bye, and division races', () => {
    const insights = computePlayoffRaceInsights(buildTeams());
    expect(insights).not.toBeNull();
    if (!insights) return;

    expect(insights.bubbleRace?.cutoff.teamName).toBe('5 Fingers 2 Ur Face');
    expect(insights.bubbleRace?.challenger.teamName).toBe('Inappropriate touchdowns');
    expect(insights.bubbleRace?.gamesBack).toBeCloseTo(1);
    expect(insights.bubbleRace?.pfGap).toBeCloseTo(74.5);

    expect(insights.byeRace?.holder.teamName).toBe('The Dudes From Cocoon');
    expect(insights.byeRace?.challenger.teamName).toBe('Glaurung & Foes');
    expect(Math.abs(insights.byeRace?.gamesBack ?? 0)).toBeCloseTo(1);

    expect(insights.divisionRaces.length).toBeGreaterThan(0);
    expect(insights.divisionRaces[0].gamesBack).toBeLessThanOrEqual(1.5);
  });
});
