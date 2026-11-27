import { createElement, Fragment } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  buildPlayoffNarratives,
  STANDINGS_GLOSSARY,
  PLAYOFF_NARRATIVES_MIN_WEEK,
} from './narratives.tsx';
import { computeSeeds, mergeRostersAndUsersToTeams } from '../utils/sleeperTransforms';
import { computeGrundleSeedRanges } from '../utils/grundleSeedRanges';
import { simulateGrundleSeason } from '../utils/grundleOdds';
import { formatOdds } from '../utils/seasonSimulation';
import type { Team } from '../models/fantasy';
import { mockSleeperLeague, mockSleeperRosters, mockSleeperUsers } from '../test/fixtures/sleeper';

const buildTeams = () =>
  computeSeeds(
    mergeRostersAndUsersToTeams(mockSleeperRosters, mockSleeperUsers, mockSleeperLeague),
  );

// The fixture has one regular-season week left and no schedule here, so these
// use the schedule-free bound.
const rangesFor = (teams: Team[]) => computeGrundleSeedRanges(teams, null, 14);

const toText = (node: React.ReactNode | undefined) =>
  node == null ? '' : renderToStaticMarkup(createElement(Fragment, null, node));

describe('buildPlayoffNarratives', () => {
  it('returns null with no teams', () => {
    expect(buildPlayoffNarratives([], PLAYOFF_NARRATIVES_MIN_WEEK, new Map())).toBeNull();
  });

  it('returns null before week 2 has fully wrapped, even with real teams', () => {
    const teams = buildTeams();
    const ranges = rangesFor(teams);

    expect(buildPlayoffNarratives(teams, 1, ranges)).toBeNull();
    expect(buildPlayoffNarratives(teams, 2, ranges)).toBeNull();
    expect(buildPlayoffNarratives(teams, PLAYOFF_NARRATIVES_MIN_WEEK, ranges)).not.toBeNull();
  });

  it('builds bubble, bye, and division narratives with clarity text', () => {
    const teams = buildTeams();
    const narratives = buildPlayoffNarratives(teams, PLAYOFF_NARRATIVES_MIN_WEEK, rangesFor(teams));

    expect(narratives).not.toBeNull();
    if (!narratives) return;

    expect(toText(narratives.bubble?.summary)).toContain('+74.5');
    expect(toText(narratives.bubble?.note)).not.toHaveLength(0);

    expect(toText(narratives.bye?.summary)).toMatch(/Round 1 bye/i);
    expect(toText(narratives.bye?.scenarios[0])).toMatch(/claims the bye|can claim the bye/i);

    expect(narratives.divisions.length).toBeGreaterThan(0);
    expect(toText(narratives.divisions[0].summary)).toMatch(/Points For/i);
  });

  it('hides Bye Chase when the remaining schedule rules the challenger out', () => {
    // Three divisions, one week left. Alpha's two 9-4 teams play each other,
    // so Alpha's winner reaches 10 wins. Gamma's 8-5 leader (the 3 seed) can
    // reach only 9, so it cannot pass Alpha's winner or Beta's 11-2 leader.
    const divisionByRoster: Record<number, number> = {
      1: 1,
      2: 1,
      7: 1,
      11: 1,
      4: 2,
      6: 2,
      8: 2,
      12: 2,
      3: 3,
      5: 3,
      9: 3,
      10: 3,
    };
    const winsByRoster: Record<number, number> = {
      1: 9,
      2: 9,
      3: 8,
      4: 6,
      5: 6,
      6: 11,
      7: 5,
      8: 5,
      9: 4,
      10: 3,
      11: 2,
      12: 1,
    };
    const teams = computeSeeds(
      mergeRostersAndUsersToTeams(
        mockSleeperRosters.map((roster) => ({
          ...roster,
          division_id: divisionByRoster[roster.roster_id],
          settings: {
            ...roster.settings,
            wins: winsByRoster[roster.roster_id],
            losses: 13 - winsByRoster[roster.roster_id],
            ties: 0,
          },
        })),
        mockSleeperUsers,
        mockSleeperLeague,
      ),
    );
    const finalWeek = [
      [1, 2],
      [3, 9],
      [6, 12],
      [4, 5],
      [7, 8],
      [10, 11],
    ].map(([teamA, teamB]) => ({ teamA, teamB }));

    const withoutSchedule = buildPlayoffNarratives(
      teams,
      14,
      computeGrundleSeedRanges(teams, null, 14),
    );
    const withSchedule = buildPlayoffNarratives(
      teams,
      14,
      computeGrundleSeedRanges(teams, finalWeek, 14),
    );

    expect(withoutSchedule?.bye).not.toBeNull();
    expect(withSchedule?.bye).toBeNull();
    expect(withSchedule?.bubble).not.toBeNull();
  });

  describe('simulated odds', () => {
    const teams = buildTeams();
    const finalWeek = [
      [1, 2],
      [3, 4],
      [5, 6],
      [7, 8],
      [9, 10],
      [11, 12],
    ].map(([teamA, teamB]) => ({ teamA, teamB }));
    const ranges = computeGrundleSeedRanges(teams, finalWeek, 14);
    const scores = new Map(
      teams.map((team) => [team.sleeperRosterId, Array<number>(13).fill(team.pointsFor / 13)]),
    );
    const simulation = simulateGrundleSeason(teams, finalWeek, scores, 14, { runs: 2000 });

    it('adds playoff odds to Bubble Watch and bye odds to Bye Chase for the teams they name', () => {
      const narratives = buildPlayoffNarratives(teams, 14, ranges, simulation.outlooks);
      const bubble = narratives?.bubble;
      const bye = narratives?.bye;
      if (!bubble?.odds || !bye?.odds) throw new Error('Expected both races with odds');

      expect(bubble.odds.label).toBe('Playoff odds');
      expect(bubble.odds.entries.slice(0, 2).map(({ team }) => team.seed)).toEqual([6, 7]);
      bubble.odds.entries.forEach(({ team, value }) => {
        const range = ranges.get(team.sleeperRosterId);
        expect(value).toBe(
          formatOdds(simulation.outlooks.get(team.sleeperRosterId)?.playoffOdds ?? -1, {
            clinched: (range?.worst ?? 99) <= 6,
            eliminated: (range?.best ?? 0) > 6,
          }),
        );
      });

      expect(bye.odds.label).toBe('Bye odds');
      expect(bye.odds.entries[0].team.seed).toBe(2);
      const byeText = toText(createElement(Fragment, null, bye.summary, bye.note ?? null))
        .replace(/&amp;/g, '&')
        .replace(/&#x27;/g, "'");
      bye.odds.entries.forEach(({ team, value }) => {
        expect(value).toMatch(/^(100%|0%|>99%|<1%|\d+%)$/);
        expect(byeText).toContain(team.teamName);
      });
    });

    it('omits odds when no complete simulation is supplied', () => {
      const narratives = buildPlayoffNarratives(teams, 14, ranges);
      expect(narratives?.bubble).not.toBeNull();
      expect(narratives?.bubble?.odds).toBeUndefined();
      expect(narratives?.bye?.odds).toBeUndefined();
    });
  });

  it('exposes glossary entries for standings UI', () => {
    const sixSeed = STANDINGS_GLOSSARY.find((entry) => entry.code === '6');
    expect(sixSeed?.description).toMatch(/6th seed/i);
    expect(STANDINGS_GLOSSARY.find((entry) => entry.code === 'bw')?.description).toMatch(
      /Best\/Worst/i,
    );
  });
});
