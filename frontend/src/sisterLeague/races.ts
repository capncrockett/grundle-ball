// frontend/src/sisterLeague/races.ts
//
// Picks the teams worth narrating for the Sister League's playoff line
// (Bubble Watch) and bye line (Bye Chase): teams whose final side of the cut
// is still mathematically open and not already a near-certainty in the
// simulations.

import {
  oddsByRemainingWins,
  rootingInterests,
  type OddsByWins,
  type PlayoffTarget,
  type RootingInterest,
  type SeasonSimulation,
  type TeamScoring,
} from './projections';
import {
  remainingSchedule,
  SISTER_LEAGUE_SEEDING,
  toSeedRangeTeams,
  type SisterLeagueSeedRange,
  type SisterLeagueSnapshot,
} from './sisterLeague';
import { worstSeedIfWinsOut } from '../utils/seedRanges';

export type RaceEntry = {
  teamId: number;
  odds: number;
  mostLikelySeed: number;
  mostLikelySeedOdds: number;
  /** 1 = highest season scoring average in the league. */
  averageRank: number;
  byWins: OddsByWins[];
  /** True when winning every remaining game guarantees the target. */
  winOutClinches: boolean;
  rooting: RootingInterest[];
};

export type SisterLeagueRace = {
  target: PlayoffTarget;
  cut: number;
  entries: RaceEntry[];
};

// Below/above these simulated odds a team is effectively decided.
const MIN_ODDS = 0.02;
const MAX_ODDS = 0.98;
// Ignore outside games that move a team's odds by less than this. Long shots
// use a smaller bar (a quarter of their odds) so a 4% -> 6% game still shows up.
const MIN_ROOTING_SWING = 0.05;
const MIN_LONG_SHOT_SWING = 0.01;
const MAX_ROOTING_GAMES = 3;
// Hide remaining-record rows that almost never happen.
const MIN_RECORD_SHARE = 0.01;

// True when the team's worst possible seed after winning out, under the
// remaining schedule, is inside the cut. Ties go against it.
const winsOutWithin = (snapshot: SisterLeagueSnapshot, teamId: number, cut: number): boolean => {
  const worst = worstSeedIfWinsOut(
    toSeedRangeTeams(snapshot),
    remainingSchedule(snapshot),
    SISTER_LEAGUE_SEEDING,
    teamId,
  );
  return worst !== null && worst <= cut;
};

const buildRace = (
  snapshot: SisterLeagueSnapshot,
  sim: SeasonSimulation,
  ranges: Map<number, SisterLeagueSeedRange>,
  averageRanks: Map<number, number>,
  target: PlayoffTarget,
): SisterLeagueRace | null => {
  const cut = target === 'playoffs' ? snapshot.playoffTeamCount : snapshot.playoffByeCount;
  if (cut <= 0 || sim.remainingGames.length === 0) return null;

  const entries = snapshot.teams
    .filter((team) => {
      const range = ranges.get(team.id);
      const outlook = sim.outlooks.get(team.id);
      if (!range || !outlook) return false;
      const odds = target === 'playoffs' ? outlook.playoffOdds : outlook.byeOdds;
      const stillOpen = range.best <= cut && range.worst > cut;
      return stillOpen && odds > MIN_ODDS && odds < MAX_ODDS;
    })
    .map((team): RaceEntry => {
      const outlook = sim.outlooks.get(team.id);
      const odds = (target === 'playoffs' ? outlook?.playoffOdds : outlook?.byeOdds) ?? 0;
      const seedOdds = outlook?.seedOdds ?? [];
      const mostLikelySeed = outlook?.mostLikelySeed ?? team.seed;
      return {
        teamId: team.id,
        odds,
        mostLikelySeed,
        mostLikelySeedOdds: seedOdds[mostLikelySeed - 1] ?? 0,
        averageRank: averageRanks.get(team.id) ?? team.seed,
        byWins: oddsByRemainingWins(snapshot, sim, team.id, target).filter(
          (row) => row.share >= MIN_RECORD_SHARE,
        ),
        winOutClinches: winsOutWithin(snapshot, team.id, cut),
        rooting: rootingInterests(snapshot, sim, team.id, target)
          .filter(
            (interest) =>
              interest.swing >=
              Math.min(MIN_ROOTING_SWING, Math.max(odds / 4, MIN_LONG_SHOT_SWING)),
          )
          .slice(0, MAX_ROOTING_GAMES),
      };
    })
    .sort((a, b) => b.odds - a.odds);

  return entries.length ? { target, cut, entries } : null;
};

export function buildSisterLeagueRaces(
  snapshot: SisterLeagueSnapshot,
  sim: SeasonSimulation,
  scoring: Map<number, TeamScoring>,
  ranges: Map<number, SisterLeagueSeedRange>,
): { bubble: SisterLeagueRace | null; bye: SisterLeagueRace | null } {
  const averageRanks = new Map(
    [...scoring.values()]
      .sort((a, b) => b.average - a.average)
      .map((entry, index) => [entry.teamId, index + 1]),
  );

  return {
    bubble: buildRace(snapshot, sim, ranges, averageRanks, 'playoffs'),
    bye: buildRace(snapshot, sim, ranges, averageRanks, 'bye'),
  };
}

/**
 * Simulated odds as a whole percent. Mathematically settled results show
 * 100%/0%; anything still open never rounds to a false certainty.
 */
export function formatOdds(
  odds: number,
  { clinched = false, eliminated = false }: { clinched?: boolean; eliminated?: boolean } = {},
): string {
  if (clinched) return '100%';
  if (eliminated) return '0%';
  if (odds >= 0.995) return '>99%';
  if (odds < 0.005) return '<1%';
  return `${Math.round(odds * 100).toString()}%`;
}

export function ordinal(value: number): string {
  const lastTwo = value % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${value.toString()}th`;
  const suffix = ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[value % 10] ?? 'th';
  return `${value.toString()}${suffix}`;
}
