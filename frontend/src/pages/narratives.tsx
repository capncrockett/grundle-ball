import { type ReactNode } from 'react';
import type { Team } from '../models/fantasy';
import { computePlayoffRaceInsights, gamesBack } from './playoffRaceInsights';

type NarrativeSection = {
  id?: string;
  heading: string;
  summary: ReactNode;
  scenarios: ReactNode[];
  note?: ReactNode;
};

export type PlayoffNarratives = {
  bubble: NarrativeSection | null;
  bye: NarrativeSection | null;
  divisions: NarrativeSection[];
};

export type GlossaryEntry = {
  code: string;
  description: string;
  example?: string;
};

export const STANDINGS_GLOSSARY: GlossaryEntry[] = [
  { code: 'x', description: 'Clinched Playoffs' },
  { code: 'y', description: 'Clinched Division' },
  { code: 'z', description: 'Clinched First-Round Bye' },
  { code: '*', description: 'Clinched No. 1 Overall Seed' },
  { code: 'e', description: 'Eliminated From Playoff Contention' },
  {
    code: '6',
    description: 'Currently holds the 6th seed (highest PF among non-division-winners)',
  },
  {
    code: 'bw',
    description:
      'Best/Worst range showing the highest and lowest possible seed (e.g., 3-8, 1-4, 1-1)',
  },
  {
    code: 'sc',
    description:
      'Locked barring a small stat correction (scores would need an unusual swing to change the result)',
  },
];

const seedToken = (team: Team): ReactNode => {
  const seed = team.seed ?? team.rank;
  return (
    <>
      ({seed}) <strong>{team.teamName}</strong>
    </>
  );
};

const boldName = (team: Team): ReactNode => <strong>{team.teamName}</strong>;

const winPoints = (team: Team): number => team.record.wins + team.record.ties * 0.5;

type BestWorst = { best: number; worst: number; label: string };

const rankTeams = (entries: { winPoints: number; pf: number; id: number }[]): number[] => {
  const sorted = [...entries].sort((a, b) => {
    if (b.winPoints !== a.winPoints) return b.winPoints - a.winPoints;
    return b.pf - a.pf;
  });
  return sorted.map((entry) => entry.id);
};

const computeBestWorstRanges = (teams: Team[], regularSeasonWeeks = 14): Map<number, BestWorst> => {
  const map = new Map<number, BestWorst>();
  teams.forEach((team) => {
    const gamesPlayed = team.record.wins + team.record.losses + team.record.ties;
    const remaining = Math.max(regularSeasonWeeks - gamesPlayed, 0);
    const minWinPoints = winPoints(team);
    const maxWinPoints = minWinPoints + remaining;

    const optimisticEntries = teams.map((t) => {
      const isSelf = t.sleeperRosterId === team.sleeperRosterId;
      return {
        id: t.sleeperRosterId,
        winPoints: isSelf ? maxWinPoints : winPoints(t), // others at floor
        pf: isSelf ? Number.POSITIVE_INFINITY : t.pointsFor,
      };
    });

    const pessimisticEntries = teams.map((t) => {
      const gp = t.record.wins + t.record.losses + t.record.ties;
      const rem = Math.max(regularSeasonWeeks - gp, 0);
      const isSelf = t.sleeperRosterId === team.sleeperRosterId;
      return {
        id: t.sleeperRosterId,
        winPoints: isSelf ? minWinPoints : winPoints(t) + rem, // others at ceiling
        pf: isSelf ? Number.NEGATIVE_INFINITY : t.pointsFor,
      };
    });

    const bestRank = rankTeams(optimisticEntries).indexOf(team.sleeperRosterId) + 1;
    const worstRank = rankTeams(pessimisticEntries).indexOf(team.sleeperRosterId) + 1;

    map.set(team.sleeperRosterId, {
      best: bestRank,
      worst: worstRank,
      label: `${bestRank.toString()}-${worstRank.toString()}`,
    });
  });
  return map;
};

const isSeasonComplete = (teams: Team[], regularSeasonWeeks = 14): boolean => {
  const gamesPlayed = teams.map((team) => team.record.wins + team.record.losses + team.record.ties);
  const maxGames = Math.max(...gamesPlayed);
  const minGames = Math.min(...gamesPlayed);
  return minGames === maxGames && maxGames >= regularSeasonWeeks;
};

const leagueAvgPfPerGame = (teams: Team[]): number => {
  const withGames = teams
    .map((team) => ({
      games: team.record.wins + team.record.losses + team.record.ties,
      pf: team.pointsFor,
    }))
    .filter((entry) => entry.games > 0);

  if (!withGames.length) return 0;

  const total = withGames.reduce((sum, entry) => sum + entry.pf / entry.games, 0);
  return total / withGames.length;
};

const pfSwingNeeded = (leader: Team, chaser: Team): number => {
  const gap = leader.pointsFor - chaser.pointsFor;
  const rounded = Math.abs(gap);
  return Number(rounded.toFixed(1));
};

const formatPfEdge = (gap: number, withPlus = false): string => {
  if (gap === 0) return 'any PF edge';
  const value = gap.toFixed(1);
  return withPlus ? `+${value}` : value;
};

type PfContext = {
  avgPerWeek: number;
  estHigh: number;
  estLow: number;
};

const computePfContexts = (teams: Team[]): { perTeam: Map<number, PfContext>; median: number } => {
  const perTeam = new Map<number, PfContext>();
  const avgs: number[] = [];

  teams.forEach((team) => {
    const games = team.record.wins + team.record.losses + team.record.ties;
    const avgPerWeek = games > 0 ? team.pointsFor / games : 0;
    const estHigh = avgPerWeek * 1.35; // heuristic ceiling
    const estLow = avgPerWeek * 0.65; // heuristic floor
    avgs.push(avgPerWeek);
    perTeam.set(team.sleeperRosterId, { avgPerWeek, estHigh, estLow });
  });

  avgs.sort((a, b) => a - b);
  const mid = Math.floor(avgs.length / 2);
  const median = avgs.length
    ? avgs.length % 2 === 0
      ? (avgs[mid - 1] + avgs[mid]) / 2
      : avgs[mid]
    : 0;

  return { perTeam, median };
};

const describePfSwing = (gap: number, leagueMedian: number, teamHigh: number): string => {
  if (gap === 0) return 'any PF edge';
  const abs = Math.abs(gap);
  const base = `+${abs.toFixed(1)}`;
  if (abs <= leagueMedian + 15) return base; // normal swing
  if (abs <= teamHigh) return `${base} (hot week)`;
  return `${base} (outlier vs season range)`;
};

type RecordGap = {
  leader: Team | null;
  trailer: Team | null;
  games: number;
};

const recordLead = (a: Team, b: Team): RecordGap => {
  const gap = gamesBack(a, b);
  if (gap > 0) {
    return { leader: a, trailer: b, games: gap };
  }
  if (gap < 0) {
    return { leader: b, trailer: a, games: Math.abs(gap) };
  }
  return { leader: null, trailer: null, games: 0 };
};

const findBubbleThirdTeam = (
  teams: Team[],
  cutoff: Team,
  challenger: Team,
  avgPf: number,
): Team | null => {
  const seeded = teams
    .filter((team) => team.seed != null)
    .sort((a, b) => (a.seed ?? 99) - (b.seed ?? 99));
  const bubbleNeighbors = seeded.filter((team) => (team.seed ?? 99) > 7);

  // Record-based threat: within one game of the challenger
  const recordThreat = bubbleNeighbors.find((team) => Math.abs(gamesBack(challenger, team)) <= 1);
  if (recordThreat) return recordThreat;

  // PF-based threat to the 6 seed
  const pfLeader = bubbleNeighbors.reduce<Team | null>((best, team) => {
    if (!best) return team;
    return team.pointsFor > best.pointsFor ? team : best;
  }, null);

  if (!pfLeader) return null;

  const gapToPfLeader = cutoff.pointsFor - pfLeader.pointsFor;
  const threshold = Math.max(75, avgPf); // generous: a typical weekly score keeps the door open

  return gapToPfLeader <= threshold ? pfLeader : null;
};

const buildBubbleNarrative = (
  teams: Team[],
  ranges: Map<number, BestWorst>,
): NarrativeSection | null => {
  const race = computePlayoffRaceInsights(teams)?.bubbleRace;
  if (!race) return null;

  const { cutoff, challenger } = race;
  const seasonComplete = isSeasonComplete(teams);

  const cutoffRange = ranges.get(cutoff.sleeperRosterId);
  const challengerRange = ranges.get(challenger.sleeperRosterId);
  if (!cutoffRange || !challengerRange) return null;
  // If both teams are already locked into their seeds, skip the bubble narrative.
  if (
    seasonComplete ||
    (cutoffRange.best === cutoffRange.worst && challengerRange.best === challengerRange.worst)
  ) {
    return null;
  }
  if (challengerRange.best > 6) return null; // challenger cannot reach Seed 6
  const recordGap = recordLead(cutoff, challenger);
  const tiedOnRecord = recordGap.games === 0;
  const pfGap = pfSwingNeeded(cutoff, challenger);
  const avgPf = leagueAvgPfPerGame(teams);
  const contexts = computePfContexts(teams);
  const pfEdgePlus = describePfSwing(
    pfGap,
    contexts.median,
    contexts.perTeam.get(cutoff.sleeperRosterId)?.estHigh ?? avgPf * 1.35,
  );
  const pfEdgePlain = formatPfEdge(pfGap, false);
  const thirdTeam = findBubbleThirdTeam(teams, cutoff, challenger, avgPf);

  const summary = (
    <>
      {seedToken(cutoff)} vs {seedToken(challenger)}.{' '}
      {tiedOnRecord ? (
        <>These two teams are locked together on record. </>
      ) : (
        <>
          {seedToken(recordGap.leader ?? cutoff)} is {recordGap.games.toFixed(1)} games ahead in the
          standings.{' '}
        </>
      )}
      {seedToken(cutoff)} holds the No. 6 seed right now because of a {pfEdgePlus} Points For (PF)
      edge.
    </>
  );

  const scenarios = tiedOnRecord
    ? [
        <>
          {boldName(cutoff)} keeps No. 6 with a win and higher PF than {boldName(challenger)}.
        </>,
        <>
          {boldName(challenger)} flips to No. 6 by winning and outscoring {boldName(cutoff)} by{' '}
          {pfEdgePlus}.
        </>,
        <>
          If both lose, the flip still happens if {boldName(challenger)} outscores{' '}
          {boldName(cutoff)} by {pfEdgePlus}.
        </>,
      ]
    : recordGap.leader?.sleeperRosterId === cutoff.sleeperRosterId
      ? [
          <>
            {boldName(cutoff)} stays put by matching {boldName(challenger)}'s result or winning
            outright.
          </>,
          <>
            {boldName(challenger)} needs a result swing plus {pfEdgePlain} to steal the 6 seed spot.
          </>,
          <>If records stay apart, {boldName(cutoff)} keeps No. 6 even if PF tightens.</>,
        ]
      : [
          <>
            {boldName(cutoff)} still owns the 6 seed spot until {boldName(challenger)} erases
            {pfEdgePlus}.
          </>,
          <>
            {boldName(challenger)} can take it by outscoring {boldName(cutoff)} by {pfEdgePlus}{' '}
            while keeping their record edge.
          </>,
          <>{boldName(cutoff)} keeps No. 6 if the PF lead holds, even if the records stay split.</>,
        ];

  const thirdRange = thirdTeam ? ranges.get(thirdTeam.sleeperRosterId) : null;
  const thirdCtx = thirdTeam ? contexts.perTeam.get(thirdTeam.sleeperRosterId) : null;
  const note =
    thirdTeam && thirdRange && thirdRange.best <= 6 && thirdCtx ? (
      <>
        A third team ({seedToken(thirdTeam)}) can still enter the mix. They would need a big PF week
        to clear the{' '}
        {describePfSwing(
          Math.abs(cutoff.pointsFor - thirdTeam.pointsFor),
          contexts.median,
          thirdCtx.estHigh,
        )}{' '}
        gap; league median weekly PF is {contexts.median.toFixed(1)}, so it likely takes a monster
        outing while both bubble teams stumble. Otherwise, Seeds 6/7 stay as-is.
      </>
    ) : (
      'No other teams are in range to take Seeds 6 or 7 this week based on current record and PF math.'
    );

  return {
    heading: 'Bubble Watch',
    summary,
    scenarios,
    note,
  };
};

const findByeThirdTeam = (
  teams: Team[],
  holder: Team,
  challenger: Team,
  avgPf: number,
): Team | null => {
  const seeded = teams
    .filter((team) => team.seed != null)
    .sort((a, b) => (a.seed ?? 99) - (b.seed ?? 99));
  const candidates = seeded.filter(
    (team) =>
      (team.seed ?? 99) > 3 &&
      team.sleeperRosterId !== holder.sleeperRosterId &&
      team.sleeperRosterId !== challenger.sleeperRosterId,
  );

  const recordThreat = candidates.find((team) => Math.abs(gamesBack(holder, team)) <= 1);
  if (!recordThreat) return null;

  const pfGapToHolder = holder.pointsFor - recordThreat.pointsFor;
  const threshold = Math.max(75, avgPf);

  return pfGapToHolder <= threshold ? recordThreat : null;
};

const buildByeNarrative = (
  teams: Team[],
  ranges: Map<number, BestWorst>,
): NarrativeSection | null => {
  const race = computePlayoffRaceInsights(teams)?.byeRace;
  if (!race) return null;

  const { holder, challenger } = race;
  const holderRange = ranges.get(holder.sleeperRosterId);
  const challengerRange = ranges.get(challenger.sleeperRosterId);
  if (!holderRange || !challengerRange) return null;
  // If holder is locked into a bye or challenger cannot reach it, skip
  if (holderRange.worst <= 2) return null;
  if (challengerRange.best > 2) return null;
  const recordGap = recordLead(holder, challenger);
  const tiedOnRecord = recordGap.games === 0;
  const pfGap = pfSwingNeeded(holder, challenger);
  const contexts = computePfContexts(teams);
  const pfEdgePlus = describePfSwing(
    pfGap,
    contexts.median,
    contexts.perTeam.get(holder.sleeperRosterId)?.estHigh ?? contexts.median * 1.35,
  );
  const pfEdgePlain = formatPfEdge(pfGap, false);
  const avgPf = leagueAvgPfPerGame(teams);
  const thirdTeam = findByeThirdTeam(teams, holder, challenger, avgPf);

  const summary = (
    <>
      {seedToken(holder)} currently holds the Round 1 bye.{' '}
      {tiedOnRecord ? (
        <>
          {seedToken(challenger)} has the same record but trails on Points For (PF) by {pfEdgePlain}
          .
        </>
      ) : recordGap.leader?.sleeperRosterId === holder.sleeperRosterId ? (
        <>
          {seedToken(challenger)} is {recordGap.games.toFixed(1)} games back and trails on PF by{' '}
          {pfEdgePlain}.
        </>
      ) : (
        <>
          {seedToken(challenger)} is {recordGap.games.toFixed(1)} games ahead on record but still
          trails on PF by {pfEdgePlain}, which is the current separator.
        </>
      )}
    </>
  );

  const scenarios = tiedOnRecord
    ? [
        <>
          {boldName(challenger)} claims the bye with a win that erases the {pfEdgePlus} PF gap.
        </>,
        <>
          {boldName(challenger)} also gets the bye if they win while {boldName(holder)} loses (no PF
          math needed).
        </>,
        <>
          If both win or both lose, the bye stays with {boldName(holder)} unless the PF gap closes.
        </>,
      ]
    : recordGap.leader?.sleeperRosterId === holder.sleeperRosterId
      ? [
          <>
            {boldName(challenger)} needs a win and a {boldName(holder)} loss to close the{' '}
            {recordGap.games.toFixed(1)}-game gap.
          </>,
          <>
            If records tie, PF decides; current gap favors {boldName(holder)} by {pfEdgePlain}.
          </>,
        ]
      : [
          <>
            {boldName(challenger)} can claim the bye by holding the record edge and outscoring{' '}
            {boldName(holder)} by {pfEdgePlus} to flip PF.
          </>,
          <>
            {boldName(holder)} keeps the bye if they maintain the PF cushion even if{' '}
            {boldName(challenger)} stays ahead on record.
          </>,
        ];

  const note = thirdTeam ? (
    <>
      A third team ({seedToken(thirdTeam)}) remains a mathematical threat if they win and both top
      teams falter. This needs specific record/PF combos but is still on the table.
    </>
  ) : undefined;

  return {
    heading: 'Bye Chase',
    summary,
    scenarios,
    note,
  };
};

const buildDivisionNarratives = (
  teams: Team[],
  ranges: Map<number, BestWorst>,
): NarrativeSection[] => {
  const insights = computePlayoffRaceInsights(teams);
  if (!insights) return [];
  if (isSeasonComplete(teams)) return [];

  const sections: NarrativeSection[] = [];

  insights.divisionRaces.forEach((race) => {
    const leaderRange = ranges.get(race.leader.sleeperRosterId);
    const chaserRange = ranges.get(race.chaser.sleeperRosterId);
    if (!leaderRange || !chaserRange) return;
    // Require overlap: chaser must be able to finish above leader
    if (chaserRange.best >= leaderRange.worst) return;

    const pfGap = pfSwingNeeded(race.leader, race.chaser);
    const contexts = computePfContexts(teams);
    const leaderHigh =
      contexts.perTeam.get(race.leader.sleeperRosterId)?.estHigh ?? contexts.median * 1.35;
    const pfEdgePlain = formatPfEdge(pfGap, false);
    const pfEdgePlus = describePfSwing(pfGap, contexts.median, leaderHigh);
    const tiedOnRecord = race.gamesBack === 0;
    const divisionLabel = race.divisionName ?? 'Division';

    const summary = tiedOnRecord ? (
      <>
        {divisionLabel}: {seedToken(race.leader)} and {seedToken(race.chaser)} share the same
        record. Points For is the division tiebreaker and {boldName(race.leader)} leads by{' '}
        {pfEdgePlain}.
      </>
    ) : (
      <>
        {divisionLabel}: {seedToken(race.leader)} leads {seedToken(race.chaser)} by{' '}
        {race.gamesBack.toFixed(1)} games. Points For will decide it if the records tie (gap{' '}
        {pfEdgePlain}).
      </>
    );

    const scenarios = tiedOnRecord
      ? [
          <>
            {boldName(race.chaser)} takes the banner by outscoring {boldName(race.leader)} by{' '}
            {pfEdgePlus} while the records stay tied.
          </>,
          <>
            {boldName(race.chaser)} also takes it with a win and a {boldName(race.leader)} loss (no
            PF math needed).
          </>,
        ]
      : [
          <>
            {boldName(race.chaser)} must win and {boldName(race.leader)} must lose to pull even.
          </>,
          <>
            If they tie on record, PF decides; current gap favors {boldName(race.leader)} by{' '}
            {pfEdgePlain}.
          </>,
        ];

    sections.push({
      heading: 'Division Race',
      id: divisionLabel,
      summary,
      scenarios,
    });
  });

  return sections;
};

export function buildPlayoffNarratives(teams: Team[]): PlayoffNarratives | null {
  if (!teams.length) return null;

  const ranges = computeBestWorstRanges(teams);

  const bubble = buildBubbleNarrative(teams, ranges);
  const bye = buildByeNarrative(teams, ranges);
  const divisions = buildDivisionNarratives(teams, ranges);

  if (!bubble && !bye && divisions.length === 0) {
    return null;
  }

  return { bubble, bye, divisions };
}
