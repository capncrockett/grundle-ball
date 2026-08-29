import { computeStandingsInsights } from './standingsInsights';
import { computeSeeds, mergeRostersAndUsersToTeams } from '../utils/sleeperTransforms';
import { mockSleeperLeague, mockSleeperRosters, mockSleeperUsers } from '../test/fixtures/sleeper';

const buildTeams = () =>
  computeSeeds(
    mergeRostersAndUsersToTeams(mockSleeperRosters, mockSleeperUsers, mockSleeperLeague),
  );

describe('computeStandingsInsights', () => {
  it('returns null when no games have been played', () => {
    const zeroed = buildTeams().map((team) => ({
      ...team,
      record: { wins: 0, losses: 0, ties: 0 },
      pointsFor: 0,
      pointsAgainst: 0,
    }));

    const insights = computeStandingsInsights(zeroed);

    expect(insights).toBeNull();
  });

  it('derives schedule difficulty and luck from fixture data', () => {
    const insights = computeStandingsInsights(buildTeams());

    expect(insights).not.toBeNull();
    if (!insights) return;

    const expectedLeagueAvgPa =
      mockSleeperRosters.reduce((sum, roster) => {
        const gamesPlayed =
          (roster.settings.wins ?? 0) + (roster.settings.losses ?? 0) + (roster.settings.ties ?? 0);
        const pa =
          (roster.settings.fpts_against ?? 0) + (roster.settings.fpts_against_decimal ?? 0) / 100;
        return sum + (gamesPlayed > 0 ? pa / gamesPlayed : 0);
      }, 0) / mockSleeperRosters.length;

    expect(insights.toughestSchedule.teamName).toBe('Team Twelve');
    expect(insights.toughestSchedule.paPerGame).toBeCloseTo(1700 / 13, 2);
    expect(insights.easiestSchedule.teamName).toBe("Big Ol' TDs");
    expect(insights.easiestSchedule.paPerGame).toBeCloseTo(1400 / 13, 2);
    expect(insights.luckiestRecord.teamName).toBe('The Dudes From Cocoon');
    expect(insights.unluckiestRecord.teamName).toBe('Kitchen Chubbards');
    expect(insights.leagueAvgPaPerGame).toBeCloseTo(expectedLeagueAvgPa, 5);
    expect(insights.hasDivisionData).toBe(true);
    expect(insights.highestAvgPfDivision?.divisionName).toBe('Alpha');
    expect(insights.lowestAvgPaDivision?.divisionName).toBe('Alpha');
  });
});
