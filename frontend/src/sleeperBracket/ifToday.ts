import type { SleeperPlayoffMatchup } from '../api/sleeper';
import type { Team } from '../models/fantasy';
import { resolveBracketMatchups } from './resolveBracket';

export function seasonAverage(team: Team): number {
  const games = team.record.wins + team.record.losses + team.record.ties;
  return games > 0 ? team.pointsFor / games : 0;
}

/** Six-team championship preview, independent of any published results or Beta routing. */
export function buildIfTodayBracket(teams: Team[]) {
  const bySeed = new Map(teams.map((team) => [team.seed, team]));
  if ([1, 2, 3, 4, 5, 6].some((seed) => !bySeed.has(seed))) return [];
  const roster = (seed: number) => bySeed.get(seed)?.sleeperRosterId;
  const games: SleeperPlayoffMatchup[] = [
    { r: 1, m: 1, t1: roster(3), t2: roster(6) },
    { r: 1, m: 2, t1: roster(4), t2: roster(5) },
    { r: 2, m: 3, t1: roster(1), t2_from: { w: 2 } },
    { r: 2, m: 4, t1: roster(2), t2_from: { w: 1 } },
    { r: 2, m: 5, t1_from: { l: 1 }, t2_from: { l: 2 }, p: 5 },
    { r: 3, m: 6, t1_from: { w: 3 }, t2_from: { w: 4 }, p: 1 },
    { r: 3, m: 7, t1_from: { l: 3 }, t2_from: { l: 4 }, p: 3 },
  ];
  const byRoster = new Map(teams.map((team) => [team.sleeperRosterId, team]));
  for (const game of games) {
    const source = (from: { w?: number; l?: number } | null | undefined) => {
      if (from?.w != null) return games.find((candidate) => candidate.m === from.w)?.w;
      if (from?.l != null) return games.find((candidate) => candidate.m === from.l)?.l;
      return undefined;
    };
    game.t1 ??= source(game.t1_from) ?? undefined;
    game.t2 ??= source(game.t2_from) ?? undefined;
    const a = game.t1 == null ? undefined : byRoster.get(game.t1);
    const b = game.t2 == null ? undefined : byRoster.get(game.t2);
    if (!a || !b) return [];
    const aWins =
      seasonAverage(a) > seasonAverage(b) ||
      (seasonAverage(a) === seasonAverage(b) && (a.seed ?? Infinity) < (b.seed ?? Infinity));
    game.w = aWins ? game.t1 : game.t2;
    game.l = aWins ? game.t2 : game.t1;
  }
  return resolveBracketMatchups(games);
}
