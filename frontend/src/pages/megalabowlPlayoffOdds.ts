// frontend/src/pages/megalabowlPlayoffOdds.ts
//
// Megalabowl playoff advancement (weeks 15-17, per the official FAQ) is
// decided by score rank across every Megalabowl league's top-6 seeds
// pooled together, not by an in-league bracket - see issue #57. Until the
// cross-league scrape (issue #58) exists, this only has this league's own
// data to work with, so it estimates a best/worst scoring RANK among the
// current top-6 seeds, not a real cross-pool survival probability.

import type { Team } from '../models/fantasy';

export const MEGALABOWL_PLAYOFF_FIELD_SIZE = 6;

// Same +/-35% heuristic ceiling/floor already used for playoff-race
// narratives elsewhere in Standings (see narratives.tsx's
// computePfContexts), kept identical so "optimistic/pessimistic" reads the
// same way across the app.
const CEILING_MULTIPLIER = 1.35;
const FLOOR_MULTIPLIER = 0.65;

export type MegalabowlPlayoffOddsEntry = {
  sleeperRosterId: number;
  teamName: string;
  seed: number;
  avgPointsPerGame: number;
  bestRank: number;
  worstRank: number;
  label: string;
};

const gamesPlayed = (team: Team): number =>
  team.record.wins + team.record.losses + team.record.ties;

const avgPointsPerGame = (team: Team): number => {
  const games = gamesPlayed(team);
  return games > 0 ? team.pointsFor / games : 0;
};

const rankByProjectedScore = (scores: Map<number, number>): number[] =>
  [...scores.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);

export function computeMegalabowlPlayoffOdds(teams: Team[]): MegalabowlPlayoffOddsEntry[] {
  const qualified = teams.filter(
    (team) => (team.seed ?? team.rank) <= MEGALABOWL_PLAYOFF_FIELD_SIZE && gamesPlayed(team) > 0,
  );

  if (qualified.length === 0) return [];

  const averageByRosterId = new Map<number, number>(
    qualified.map((team) => [team.sleeperRosterId, avgPointsPerGame(team)]),
  );

  return qualified
    .map((team) => {
      const avg = averageByRosterId.get(team.sleeperRosterId) ?? 0;

      const optimistic = new Map(
        qualified.map((other) => [
          other.sleeperRosterId,
          other.sleeperRosterId === team.sleeperRosterId
            ? avg * CEILING_MULTIPLIER
            : (averageByRosterId.get(other.sleeperRosterId) ?? 0) * FLOOR_MULTIPLIER,
        ]),
      );
      const pessimistic = new Map(
        qualified.map((other) => [
          other.sleeperRosterId,
          other.sleeperRosterId === team.sleeperRosterId
            ? avg * FLOOR_MULTIPLIER
            : (averageByRosterId.get(other.sleeperRosterId) ?? 0) * CEILING_MULTIPLIER,
        ]),
      );

      const bestRank = rankByProjectedScore(optimistic).indexOf(team.sleeperRosterId) + 1;
      const worstRank = rankByProjectedScore(pessimistic).indexOf(team.sleeperRosterId) + 1;

      return {
        sleeperRosterId: team.sleeperRosterId,
        teamName: team.teamName,
        seed: team.seed ?? team.rank,
        avgPointsPerGame: avg,
        bestRank,
        worstRank,
        label: `${bestRank.toString()}-${worstRank.toString()}`,
      };
    })
    .sort((a, b) => a.seed - b.seed);
}
