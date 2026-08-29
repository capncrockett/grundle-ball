import {
  getLeagueMatchupsForWeek,
  getLeagueRosters,
  getLeagueUsers,
  type SleeperMatchup,
  type SleeperRoster,
  type SleeperUser,
} from '../../frontend/src/api/sleeper';
import { LEAGUE_ID as DEFAULT_LEAGUE_ID } from '../../frontend/src/config/league';
import {
  getMatchupStore,
  type MatchupHistoryStore,
  type StoreConfig,
} from '../matchupHistoryStore';
import type { StoredMatchup } from '../../frontend/src/data/matchupHistoryTypes';

type CliOptions = {
  weeks: number[];
  leagueId: string;
  markFinished: boolean;
};

const round = (value: number): number => Number(value.toFixed(2));

function parseArgs(): CliOptions {
  let weeks: number[] = [];
  let leagueId = DEFAULT_LEAGUE_ID;
  let markFinished = true;

  process.argv.slice(2).forEach((arg) => {
    if (arg.startsWith('--week=')) {
      weeks.push(Number(arg.split('=')[1]));
    } else if (arg.startsWith('--weeks=')) {
      weeks = weeks.concat(
        arg
          .split('=')[1]
          .split(',')
          .map((value) => Number(value.trim()))
          .filter((value) => !Number.isNaN(value)),
      );
    } else if (arg.startsWith('--range=')) {
      const [start, end] = arg
        .split('=')[1]
        .split('-')
        .map((value) => Number(value.trim()));
      if (!Number.isNaN(start) && !Number.isNaN(end) && start > 0 && end >= start) {
        for (let week = start; week <= end; week += 1) {
          weeks.push(week);
        }
      }
    } else if (arg === '--finished=false' || arg === '--unfinished') {
      markFinished = false;
    } else if (arg.startsWith('--league=')) {
      leagueId = arg.split('=')[1];
    }
  });

  const uniqueWeeks = Array.from(new Set(weeks)).filter((week) => week > 0);
  uniqueWeeks.sort((a, b) => a - b);

  if (uniqueWeeks.length === 0 || uniqueWeeks.some((week) => Number.isNaN(week))) {
    throw new Error(
      'Pass target weeks with --week={number}, --weeks=1,2,3, or --range=start-end',
    );
  }

  return { weeks: uniqueWeeks, leagueId, markFinished };
}

function rosterIdToTeamName(users: SleeperUser[], rosters: SleeperRoster[]): Map<number, string> {
  const userNameById = new Map<string, string>();
  users.forEach((user) => {
    const teamName = user.metadata?.team_name || user.display_name || user.username;
    if (teamName) userNameById.set(user.user_id, teamName);
  });

  const map = new Map<number, string>();
  rosters.forEach((roster) => {
    const name =
      userNameById.get(roster.owner_id) ?? `Roster ${roster.roster_id.toString()}`;
    map.set(roster.roster_id, name);
  });
  return map;
}

const scoreFor = (matchup: SleeperMatchup): number =>
  round(typeof matchup.custom_points === 'number' ? matchup.custom_points : matchup.points);

const resolveTeamName = (nameMap: Map<number, string>, rosterId: number): string => {
  const found = nameMap.get(rosterId);
  return found !== undefined ? found : `Roster ${rosterId.toString()}`;
};

function buildMatchups(
  week: number,
  matchups: SleeperMatchup[],
  nameMap: Map<number, string>,
  finished: boolean,
): StoredMatchup[] {
  const groups = new Map<number, SleeperMatchup[]>();
  matchups.forEach((matchup) => {
    const current = groups.get(matchup.matchup_id) ?? [];
    current.push(matchup);
    groups.set(matchup.matchup_id, current);
  });

  const entries: StoredMatchup[] = [];

  for (const [matchupId, games] of groups.entries()) {
    if (games.length !== 2) {
      console.warn(
        `Skipping matchup ${matchupId.toString()} (expected 2 rosters, found ${String(
          games.length,
        )})`,
      );
      continue;
    }

    const [a, b] = games;
    const pointsA = scoreFor(a);
    const pointsB = scoreFor(b);
    const teamA = resolveTeamName(nameMap, a.roster_id);
    const teamB = resolveTeamName(nameMap, b.roster_id);

    entries.push({
      week,
      team: teamA,
      opponent: teamB,
      pointsFor: pointsA,
      pointsAgainst: pointsB,
      margin: round(pointsA - pointsB),
      finished,
    });
    entries.push({
      week,
      team: teamB,
      opponent: teamA,
      pointsFor: pointsB,
      pointsAgainst: pointsA,
      margin: round(pointsB - pointsA),
      finished,
    });
  }

  return entries;
}

async function main(storeConfig: StoreConfig = {}) {
  const options = parseArgs();
  console.log(`Fetching Sleeper matchups for week(s): ${options.weeks.join(', ')}...`);

  const store: MatchupHistoryStore = await getMatchupStore(storeConfig);
  console.log(`Using matchup store: ${store.describe()}`);

  const [users, rosters] = await Promise.all([
    getLeagueUsers(options.leagueId),
    getLeagueRosters(options.leagueId),
  ]);

  const nameMap = rosterIdToTeamName(users, rosters);

  let totalWritten = 0;
  const touchedWeeks = new Set<number>();

  for (const week of options.weeks) {
    const matchups = await getLeagueMatchupsForWeek(options.leagueId, week);
    const entries = buildMatchups(week, matchups, nameMap, options.markFinished);
    if (entries.length === 0) {
      console.warn(`No matchup entries created for week ${week.toString()}; skipping write.`);
      continue;
    }

    const updated = await store.appendWeek(week, entries);
    touchedWeeks.add(week);
    totalWritten += entries.length;
    const weeks = Array.from(new Set(updated.map((m) => m.week))).sort((a, b) => a - b);
    console.log(
      `Wrote ${entries.length.toString()} rows for week ${week.toString()} to ${store.describe()}`,
    );
    console.log(`Store now covers weeks: ${weeks.join(', ')}`);
  }

  if (touchedWeeks.size > 0) {
    console.log(
      `Completed update for weeks [${Array.from(touchedWeeks).sort((a, b) => a - b).join(', ')}]; total rows written: ${totalWritten.toString()}`,
    );
  }
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(message);
  process.exit(1);
});
