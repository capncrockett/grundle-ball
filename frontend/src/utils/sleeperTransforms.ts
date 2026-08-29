// frontend/src/utils/sleeperTransforms.ts

import {
  buildSleeperAvatarUrl,
  type SleeperRoster,
  type SleeperUser,
  type SleeperMatchup,
  type SleeperNFLState,
  type SleeperPlayer,
  type SleeperLeague,
} from '../api/sleeper';
import type { Team, PairedMatchup, LiveMatchData, SeasonState } from '../models/fantasy';
import { countFinishedPlayers } from './playerGameStatus';

// --- Merge rosters + users -> Team[] ---

export function mergeRostersAndUsersToTeams(
  rosters: SleeperRoster[],
  users: SleeperUser[],
  league?: SleeperLeague,
): Team[] {
  const usersById = new Map<string, SleeperUser>(users.map((u) => [u.user_id, u]));
  const divisionNameById = new Map<number, string>();
  const divisionAvatarById = new Map<number, string | null>();

  const resolveAvatarUrl = (avatarId?: string | null): string | null => {
    if (!avatarId) return null;
    return avatarId.startsWith('http') ? avatarId : buildSleeperAvatarUrl(avatarId);
  };

  if (league?.metadata) {
    for (const [key, value] of Object.entries(league.metadata)) {
      if (typeof value !== 'string') continue;
      const nameMatch = key.match(/^division_(\d+)$/);
      const avatarMatch =
        key.match(/^division_(\d+)_avatar$/) ?? key.match(/^division_avatar_(\d+)$/);

      if (nameMatch) {
        const id = Number(nameMatch[1]);
        if (!Number.isNaN(id)) {
          divisionNameById.set(id, value);
        }
        continue;
      }

      if (avatarMatch) {
        const id = Number(avatarMatch[1]);
        if (!Number.isNaN(id)) {
          const url = value.startsWith('http') ? value : buildSleeperAvatarUrl(value);
          divisionAvatarById.set(id, url);
        }
      }
    }
  }

  const teams: Team[] = rosters.map((roster) => {
    const user = usersById.get(roster.owner_id);
    const divisionIdRaw =
      roster.division_id ??
      roster.division ??
      roster.settings.division_id ??
      roster.settings.division ??
      null;
    const divisionId =
      typeof divisionIdRaw === 'number' && !Number.isNaN(divisionIdRaw) ? divisionIdRaw : null;

    const wins = roster.settings.wins ?? 0;
    const losses = roster.settings.losses ?? 0;
    const ties = roster.settings.ties ?? 0;

    const pointsForRaw = roster.settings.fpts ?? 0;
    const pointsForDecimal = (roster.settings.fpts_decimal ?? 0) / 100;
    const pointsAgainstRaw = roster.settings.fpts_against ?? 0;
    const pointsAgainstDecimal = (roster.settings.fpts_against_decimal ?? 0) / 100;

    const pointsFor = pointsForRaw + pointsForDecimal;
    const pointsAgainst = pointsAgainstRaw + pointsAgainstDecimal;

    const teamName =
      roster.metadata?.team_name ??
      user?.metadata?.team_name ??
      user?.display_name ??
      `Team ${roster.roster_id.toString()}`;

    const userAvatarUrl = buildSleeperAvatarUrl(user?.avatar ?? null);
    const teamAvatarUrl =
      resolveAvatarUrl(roster.metadata?.avatar ?? null) ??
      resolveAvatarUrl(roster.metadata?.team_avatar ?? null) ??
      resolveAvatarUrl(user?.metadata?.avatar ?? null) ??
      resolveAvatarUrl(user?.metadata?.team_avatar ?? null) ??
      userAvatarUrl ??
      null;

    return {
      teamName,
      ownerDisplayName: user?.display_name ?? 'Unknown Manager',
      teamAvatarUrl,
      userAvatarUrl,
      sleeperRosterId: roster.roster_id,
      sleeperUserId: roster.owner_id,
      divisionId,
      divisionName:
        divisionId != null
          ? (divisionNameById.get(divisionId) ?? `Division ${divisionId.toString()}`)
          : null,
      divisionAvatarUrl: divisionId != null ? (divisionAvatarById.get(divisionId) ?? null) : null,
      record: { wins, losses, ties },
      pointsFor,
      pointsAgainst,
      rank: 0, // filled in by computeStandings
    };
  });

  // compute ranks now (mutates cloned array, then returns new with ranks)
  const ranked = computeStandings(teams);
  return ranked;
}

// --- Pair matchups by matchup_id ---

export function pairMatchups(
  week: number,
  matchups: SleeperMatchup[],
  playersById?: Record<string, SleeperPlayer | undefined>,
  teamGameStatus?: Map<string, boolean>,
): PairedMatchup[] {
  const map = new Map<number, SleeperMatchup[]>();

  for (const m of matchups) {
    const existing = map.get(m.matchup_id);
    if (existing) {
      existing.push(m);
    } else {
      map.set(m.matchup_id, [m]);
    }
  }

  const paired: PairedMatchup[] = [];

  for (const [matchupId, entries] of map.entries()) {
    if (entries.length === 0) continue;

    const [a, b] = entries;

    // Count finished players if data is available
    const finishedA =
      playersById && teamGameStatus
        ? countFinishedPlayers(a.starters, playersById, teamGameStatus)
        : { total: a.starters.length, finished: a.starters.length };

    if (entries.length < 2) {
      // bye / incomplete data - treat second side as null
      paired.push({
        matchupId,
        week,
        rosterIdA: a.roster_id,
        rosterIdB: null,
        pointsA: a.points,
        pointsB: 0,
        startersA: finishedA.total,
        startersB: 0,
        playersFinishedA: finishedA.finished,
        playersFinishedB: 0,
      });
      continue;
    }

    const finishedB =
      playersById && teamGameStatus
        ? countFinishedPlayers(b.starters, playersById, teamGameStatus)
        : { total: b.starters.length, finished: b.starters.length };

    paired.push({
      matchupId,
      week,
      rosterIdA: a.roster_id,
      rosterIdB: b.roster_id,
      pointsA: a.points,
      pointsB: b.points,
      startersA: finishedA.total,
      startersB: finishedB.total,
      playersFinishedA: finishedA.finished,
      playersFinishedB: finishedB.finished,
    });
  }

  return paired;
}

// --- Build LiveMatchData from a paired matchup ---

export function buildLiveMatchData(paired: PairedMatchup): LiveMatchData {
  return {
    teamIdA: paired.rosterIdA,
    teamIdB: paired.rosterIdB,
    pointsA: paired.pointsA,
    pointsB: paired.pointsB,
    startersA: paired.startersA,
    startersB: paired.startersB,
    playersFinishedA: paired.playersFinishedA,
    playersFinishedB: paired.playersFinishedB,
    week: paired.week,
  };
}

// --- Season state derivation ---

export function mapNFLStateToSeasonState(nfl: SleeperNFLState): SeasonState {
  return {
    week: nfl.week,
    displayWeek: nfl.display_week,
    season: nfl.season,
    seasonType: nfl.season_type,
    leagueSeason: nfl.league_season,
  };
}

// --- Standings + seeding ---

const sortByRecordThenPoints = (a: Team, b: Team) => {
  // primary: wins desc
  if (b.record.wins !== a.record.wins) {
    return b.record.wins - a.record.wins;
  }

  // secondary: pointsFor desc
  if (b.pointsFor !== a.pointsFor) {
    return b.pointsFor - a.pointsFor;
  }

  // tertiary: losses asc
  if (a.record.losses !== b.record.losses) {
    return a.record.losses - b.record.losses;
  }

  // final: ties asc
  return a.record.ties - b.record.ties;
};

export function computeStandings(teams: Team[]): Team[] {
  const sorted = [...teams].sort(sortByRecordThenPoints);

  return sorted.map((team, index) => ({
    ...team,
    rank: index + 1,
  }));
}

/**
 * League-specific seeding rules:
 * - Seeds 1-3: Division winners (sorted by record > points for).
 * - Seeds 4-5: Next best records regardless of division.
 * - Seed 6: Highest points for among teams not already seeded.
 * - Seeds 7-12: Remaining teams by record order.
 */
export function computeSeeds(teams: Team[]): Team[] {
  const standings = computeStandings(teams);
  const sortedByRank = [...standings].sort((a, b) => a.rank - b.rank);
  const seeded: Team[] = [];
  const usedRosterIds = new Set<number>();

  // Seeds 1-3: division winners
  const divisionIds = Array.from(
    new Set(sortedByRank.map((team) => team.divisionId).filter((id): id is number => id !== null)),
  );

  const divisionWinners: Team[] = [];
  for (const divisionId of divisionIds) {
    const winner = sortedByRank.find(
      (team) => team.divisionId === divisionId && !usedRosterIds.has(team.sleeperRosterId),
    );
    if (winner) {
      divisionWinners.push(winner);
      usedRosterIds.add(winner.sleeperRosterId);
    }
  }
  divisionWinners.sort((a, b) => a.rank - b.rank);
  seeded.push(...divisionWinners);

  // Seeds 4-5: next best records (regardless of division)
  for (const team of sortedByRank) {
    if (seeded.length >= 5) break;
    if (usedRosterIds.has(team.sleeperRosterId)) continue;
    seeded.push(team);
    usedRosterIds.add(team.sleeperRosterId);
  }

  // Seed 6: highest points for among remaining teams
  const remainingAfterWildcards = sortedByRank.filter(
    (team) => !usedRosterIds.has(team.sleeperRosterId),
  );
  const pfSeed = remainingAfterWildcards.reduce<Team | null>((currentBest, team) => {
    if (!currentBest) return team;
    if (team.pointsFor > currentBest.pointsFor) return team;
    if (team.pointsFor === currentBest.pointsFor && team.rank < currentBest.rank) return team;
    return currentBest;
  }, null);

  if (pfSeed) {
    seeded.push(pfSeed);
    usedRosterIds.add(pfSeed.sleeperRosterId);
  }

  // Seeds 7-12: fill in remaining teams by record order
  const remainder = sortedByRank.filter((team) => !usedRosterIds.has(team.sleeperRosterId));
  const finalOrder = [...seeded, ...remainder];

  return finalOrder.map((team, index) => ({
    ...team,
    seed: index + 1,
  }));
}
