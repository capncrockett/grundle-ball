import { buildIfTodayBracket, buildIfTodayToiletBowl, seasonAverage } from './ifToday';
import { computeSeeds, mergeRostersAndUsersToTeams } from '../utils/sleeperTransforms';
import { mockSleeperRosters, mockSleeperUsers } from '../test/fixtures/sleeper';

const teams = computeSeeds(mergeRostersAndUsersToTeams(mockSleeperRosters, mockSleeperUsers));

it('uses current seeds, correct bye paths and independent placement games', () => {
  const original = JSON.stringify(teams);
  const bracket = buildIfTodayBracket(teams);
  const id = (seed: number) => teams.find((team) => team.seed === seed)?.sleeperRosterId;
  expect(bracket[0].raw).toMatchObject({ t1: id(3), t2: id(6) });
  expect(bracket[1].raw).toMatchObject({ t1: id(4), t2: id(5) });
  expect(bracket[2].raw).toMatchObject({ t1: id(1), t2: bracket[1].winnerRosterId });
  expect(bracket[3].raw).toMatchObject({ t1: id(2), t2: bracket[0].winnerRosterId });
  expect(bracket[4].raw).toMatchObject({
    t1: bracket[0].loserRosterId,
    t2: bracket[1].loserRosterId,
    p: 5,
  });
  expect(bracket[5].raw).toMatchObject({
    t1: bracket[2].winnerRosterId,
    t2: bracket[3].winnerRosterId,
    p: 1,
  });
  expect(bracket.every((game) => game.winnerRosterId != null && game.loserRosterId != null)).toBe(
    true,
  );
  expect(JSON.stringify(teams)).toBe(original);
});

it('advances higher scoring averages, with better seeds breaking ties', () => {
  const equal = teams.map((team) => ({
    ...team,
    pointsFor: 100,
    record: { wins: 1, losses: 0, ties: 0 },
  }));
  const bracket = buildIfTodayBracket(equal);
  expect(bracket[5].winnerRosterId).toBe(equal.find((team) => team.seed === 1)?.sleeperRosterId);
  const boosted = equal.map((team) => ({ ...team, pointsFor: team.seed === 6 ? 200 : 100 }));
  expect(buildIfTodayBracket(boosted)[5].winnerRosterId).toBe(
    boosted.find((team) => team.seed === 6)?.sleeperRosterId,
  );
});

it('handles missing seeds and zero completed games without inventing averages', () => {
  expect(buildIfTodayBracket(teams.slice(0, 5))).toEqual([]);
  expect(seasonAverage({ ...teams[0], record: { wins: 0, losses: 0, ties: 0 } })).toBe(0);
  expect(
    seasonAverage({ ...teams[0], pointsFor: 90, record: { wins: 1, losses: 1, ties: 1 } }),
  ).toBe(30);
});

it('routes Toilet Bowl losers toward last place while winners play for higher placements', () => {
  const original = JSON.stringify(teams);
  const bracket = buildIfTodayToiletBowl(teams);
  const id = (seed: number) => teams.find((team) => team.seed === seed)?.sleeperRosterId;
  expect(bracket[0].raw).toMatchObject({ t1: id(8), t2: id(9) });
  expect(bracket[1].raw).toMatchObject({ t1: id(7), t2: id(10) });
  expect(bracket[2].raw).toMatchObject({ t1: id(12), t2: bracket[0].loserRosterId });
  expect(bracket[3].raw).toMatchObject({ t1: id(11), t2: bracket[1].loserRosterId });
  expect(bracket[4].raw).toMatchObject({
    t1: bracket[0].winnerRosterId,
    t2: bracket[1].winnerRosterId,
    p: 7,
  });
  expect(bracket[5].raw).toMatchObject({
    t1: bracket[2].loserRosterId,
    t2: bracket[3].loserRosterId,
    p: 11,
  });
  expect(bracket[6].raw).toMatchObject({
    t1: bracket[2].winnerRosterId,
    t2: bracket[3].winnerRosterId,
    p: 9,
  });
  expect(bracket[5].loserRosterId).toBe(id(12));
  expect(JSON.stringify(teams)).toBe(original);
  expect(buildIfTodayToiletBowl(teams.filter((team) => team.seed !== 12))).toEqual([]);
});

it('projects the weakest average to last place even when it belongs to the seventh seed', () => {
  const adjusted = teams.map((team) => ({
    ...team,
    pointsFor: team.seed === 7 ? 1 : 100,
    record: { wins: 1, losses: 0, ties: 0 },
  }));
  const final = buildIfTodayToiletBowl(adjusted).find((game) => game.placement === 11);
  expect(final?.loserRosterId).toBe(adjusted.find((team) => team.seed === 7)?.sleeperRosterId);
});
