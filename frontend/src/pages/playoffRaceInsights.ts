import type { Team } from '../models/fantasy';

export const gamesBack = (leader: Team, chaser: Team): number => {
  const winDiff = leader.record.wins - chaser.record.wins;
  const lossDiff = chaser.record.losses - leader.record.losses;
  const tieDiff = leader.record.ties - chaser.record.ties;
  return (winDiff + lossDiff + tieDiff) / 2;
};

export type BubbleRace = {
  cutoff: Team;
  challenger: Team;
  gamesBack: number;
  pfGap: number;
};

export type ByeRace = {
  holder: Team;
  challenger: Team;
  gamesBack: number;
};

export type DivisionRace = {
  divisionId: number | null;
  divisionName: string | null | undefined;
  leader: Team;
  chaser: Team;
  gamesBack: number;
};

export type PlayoffRaceInsights = {
  bubbleRace: BubbleRace | null;
  byeRace: ByeRace | null;
  divisionRaces: DivisionRace[];
};

export function computePlayoffRaceInsights(teams: Team[]): PlayoffRaceInsights | null {
  if (!teams.length) return null;

  const seeded = [...teams].sort((a, b) => (a.seed ?? 99) - (b.seed ?? 99));

  const seedMap = new Map<number, Team>();
  seeded.forEach((team) => {
    if (team.seed != null) {
      seedMap.set(team.seed, team);
    }
  });

  const cutoff = seedMap.get(6);
  const challenger = seedMap.get(7);
  const bubbleRace: BubbleRace | null =
    cutoff && challenger
      ? {
          cutoff,
          challenger,
          gamesBack: gamesBack(cutoff, challenger),
          pfGap: cutoff.pointsFor - challenger.pointsFor,
        }
      : null;

  const byeHolder = seedMap.get(2);
  const byeChallenger = seedMap.get(3);
  const byeRace: ByeRace | null =
    byeHolder && byeChallenger
      ? {
          holder: byeHolder,
          challenger: byeChallenger,
          gamesBack: gamesBack(byeHolder, byeChallenger),
        }
      : null;

  const byDivision = teams.reduce((map, team) => {
    const key = team.divisionId ?? -1;
    const current = map.get(key) ?? [];
    current.push(team);
    map.set(key, current);
    return map;
  }, new Map<number, Team[]>());

  const divisionRaces: DivisionRace[] = [];
  byDivision.forEach((members, divisionId) => {
    if (divisionId === -1 || members.length < 2) return;
    const sorted = [...members].sort((a, b) => {
      if (b.record.wins !== a.record.wins) return b.record.wins - a.record.wins;
      if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
      if (a.record.losses !== b.record.losses) return a.record.losses - b.record.losses;
      return a.record.ties - b.record.ties;
    });
    const leader = sorted[0];
    const chaser = sorted[1];
    const gb = gamesBack(leader, chaser);
    if (gb <= 1.5) {
      divisionRaces.push({
        divisionId,
        divisionName: leader.divisionName,
        leader,
        chaser,
        gamesBack: gb,
      });
    }
  });

  return {
    bubbleRace,
    byeRace,
    divisionRaces,
  };
}
