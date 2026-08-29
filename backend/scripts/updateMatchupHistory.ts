import { pathToFileURL } from 'node:url';
import {
  getLeague,
  getLeagueMatchupsForWeek,
  getLeagueRosters,
  getLeagueUsers,
  type SleeperMatchup,
  type SleeperRoster,
  type SleeperUser,
} from '../../frontend/src/api/sleeper.ts';
import { LEAGUE_ID as DEFAULT_LEAGUE_ID } from '../../frontend/src/config/league.ts';
import {
  getMatchupStore,
  type MatchupHistoryStore,
  type StoreConfig,
} from '../matchupHistoryStore.ts';
import type {
  MatchupHistoryScope,
  StoredMatchup,
} from '../../frontend/src/data/matchupHistoryTypes.ts';

export type CliOptions = {
  weeks: number[];
  leagueId: string;
  markFinished: boolean;
};

type UpdateLogger = Pick<Console, 'log' | 'warn'>;

export type UpdateDependencies = {
  getLeague: typeof getLeague;
  getLeagueUsers: typeof getLeagueUsers;
  getLeagueRosters: typeof getLeagueRosters;
  getLeagueMatchupsForWeek: typeof getLeagueMatchupsForWeek;
  getMatchupStore: typeof getMatchupStore;
  logger: UpdateLogger;
};

export type UpdateResult = {
  scope: MatchupHistoryScope;
  touchedWeeks: number[];
  totalWritten: number;
};

const DEFAULT_DEPENDENCIES: UpdateDependencies = {
  getLeague,
  getLeagueUsers,
  getLeagueRosters,
  getLeagueMatchupsForWeek,
  getMatchupStore,
  logger: console,
};

const round = (value: number): number => Number(value.toFixed(2));

const parsePositiveInteger = (raw: string, flag: string): number => {
  const value = Number(raw.trim());
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${flag} requires a positive integer; received "${raw}"`);
  }
  return value;
};

export function parseArgs(args: string[], defaultLeagueId: string = DEFAULT_LEAGUE_ID): CliOptions {
  let weeks: number[] = [];
  let leagueId = defaultLeagueId;
  let markFinished = true;

  args.forEach((arg) => {
    if (arg.startsWith('--week=')) {
      weeks.push(parsePositiveInteger(arg.slice('--week='.length), '--week'));
    } else if (arg.startsWith('--weeks=')) {
      const values = arg.slice('--weeks='.length).split(',');
      if (values.length === 0 || values.some((value) => value.trim() === '')) {
        throw new Error('--weeks requires a comma-separated list of positive integers');
      }
      weeks = weeks.concat(values.map((value) => parsePositiveInteger(value, '--weeks')));
    } else if (arg.startsWith('--range=')) {
      const range = arg.slice('--range='.length).split('-');
      if (range.length !== 2) {
        throw new Error('--range requires start-end using positive integers');
      }
      const start = parsePositiveInteger(range[0] ?? '', '--range');
      const end = parsePositiveInteger(range[1] ?? '', '--range');
      if (end < start) {
        throw new Error('--range end must be greater than or equal to its start');
      }
      for (let week = start; week <= end; week += 1) {
        weeks.push(week);
      }
    } else if (arg === '--finished=false' || arg === '--unfinished') {
      markFinished = false;
    } else if (arg === '--finished=true') {
      markFinished = true;
    } else if (arg.startsWith('--league=')) {
      leagueId = arg.slice('--league='.length).trim();
      if (!leagueId) {
        throw new Error('--league requires a non-empty Sleeper league ID');
      }
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  });

  const uniqueWeeks = Array.from(new Set(weeks));
  uniqueWeeks.sort((a, b) => a - b);

  if (uniqueWeeks.length === 0) {
    throw new Error('Pass target weeks with --week={number}, --weeks=1,2,3, or --range=start-end');
  }

  return { weeks: uniqueWeeks, leagueId, markFinished };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const requireArray = <T>(value: unknown, label: string): T[] => {
  if (!Array.isArray(value)) {
    throw new Error(`Sleeper returned invalid ${label}; expected an array`);
  }
  return value as T[];
};

const resolveScope = (league: unknown, requestedLeagueId: string): MatchupHistoryScope => {
  if (!isRecord(league)) {
    throw new Error('Sleeper returned invalid league data; expected an object');
  }

  const leagueId = league.league_id;
  const season = league.season;
  if (typeof leagueId !== 'string' || leagueId.trim() === '') {
    throw new Error('Sleeper league data is missing a valid league_id');
  }
  if (typeof season !== 'string' || season.trim() === '') {
    throw new Error(`Sleeper league ${leagueId} is missing a valid season`);
  }
  if (leagueId !== requestedLeagueId) {
    throw new Error(
      `Sleeper returned league ${leagueId} for requested league ${requestedLeagueId}`,
    );
  }

  return { leagueId, season };
};

const requireValidMatchups = (value: unknown, week: number): SleeperMatchup[] => {
  const matchups = requireArray<unknown>(value, `matchup data for week ${week.toString()}`);

  matchups.forEach((matchup, index) => {
    const invalid =
      !isRecord(matchup) ||
      !Number.isInteger(matchup.roster_id) ||
      !Number.isInteger(matchup.matchup_id) ||
      typeof matchup.points !== 'number' ||
      !Number.isFinite(matchup.points) ||
      (matchup.custom_points !== undefined &&
        matchup.custom_points !== null &&
        (typeof matchup.custom_points !== 'number' || !Number.isFinite(matchup.custom_points)));

    if (invalid) {
      throw new Error(
        `Sleeper returned an invalid matchup at index ${index.toString()} for week ${week.toString()}`,
      );
    }
  });

  return matchups as SleeperMatchup[];
};

function rosterIdToTeamName(users: SleeperUser[], rosters: SleeperRoster[]): Map<number, string> {
  const userNameById = new Map<string, string>();
  users.forEach((user) => {
    const teamName = user.metadata?.team_name || user.display_name || user.username;
    if (teamName) userNameById.set(user.user_id, teamName);
  });

  const map = new Map<number, string>();
  rosters.forEach((roster) => {
    const name = userNameById.get(roster.owner_id) ?? `Roster ${roster.roster_id.toString()}`;
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

export function buildMatchups(
  scope: MatchupHistoryScope,
  week: number,
  matchups: SleeperMatchup[],
  nameMap: Map<number, string>,
  finished: boolean,
  logger: UpdateLogger = console,
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
      logger.warn(
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
      ...scope,
      week,
      team: teamA,
      opponent: teamB,
      pointsFor: pointsA,
      pointsAgainst: pointsB,
      margin: round(pointsA - pointsB),
      finished,
    });
    entries.push({
      ...scope,
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

export async function updateMatchupHistory(
  options: CliOptions,
  config: {
    storeConfig?: StoreConfig;
    dependencies?: Partial<UpdateDependencies>;
  } = {},
): Promise<UpdateResult> {
  const dependencies: UpdateDependencies = {
    ...DEFAULT_DEPENDENCIES,
    ...config.dependencies,
  };
  const { logger } = dependencies;

  logger.log(`Fetching Sleeper matchups for week(s): ${options.weeks.join(', ')}...`);

  const store: MatchupHistoryStore = await dependencies.getMatchupStore(config.storeConfig);
  try {
    logger.log(`Using matchup store: ${store.describe()}`);

    const [league, usersPayload, rostersPayload] = await Promise.all([
      dependencies.getLeague(options.leagueId),
      dependencies.getLeagueUsers(options.leagueId),
      dependencies.getLeagueRosters(options.leagueId),
    ]);
    const scope = resolveScope(league, options.leagueId);
    const users = requireArray<SleeperUser>(usersPayload, 'league users');
    const rosters = requireArray<SleeperRoster>(rostersPayload, 'league rosters');

    logger.log(`Resolved matchup scope: league ${scope.leagueId}, season ${scope.season}`);

    const nameMap = rosterIdToTeamName(users, rosters);

    let totalWritten = 0;
    const touchedWeeks = new Set<number>();

    for (const week of options.weeks) {
      const matchupPayload = await dependencies.getLeagueMatchupsForWeek(options.leagueId, week);
      const matchups = requireValidMatchups(matchupPayload, week);
      const entries = buildMatchups(scope, week, matchups, nameMap, options.markFinished, logger);
      if (entries.length === 0) {
        logger.warn(`No matchup entries created for week ${week.toString()}; skipping write.`);
        continue;
      }

      const updated = await store.appendWeek(scope, week, entries);
      touchedWeeks.add(week);
      totalWritten += entries.length;
      const weeks = Array.from(
        new Set(
          updated
            .filter(
              (matchup) => matchup.leagueId === scope.leagueId && matchup.season === scope.season,
            )
            .map((matchup) => matchup.week),
        ),
      ).sort((a, b) => a - b);
      logger.log(
        `Wrote ${entries.length.toString()} rows for week ${week.toString()} to ${store.describe()}`,
      );
      logger.log(`Store now covers weeks: ${weeks.join(', ')}`);
    }

    if (touchedWeeks.size > 0) {
      logger.log(
        `Completed update for weeks [${Array.from(touchedWeeks)
          .sort((a, b) => a - b)
          .join(', ')}]; total rows written: ${totalWritten.toString()}`,
      );
    }

    return {
      scope,
      touchedWeeks: Array.from(touchedWeeks).sort((a, b) => a - b),
      totalWritten,
    };
  } finally {
    store.close();
  }
}

async function main(storeConfig: StoreConfig = {}) {
  const options = parseArgs(process.argv.slice(2));
  await updateMatchupHistory(options, { storeConfig });
}

const executedPath = process.argv[1];
if (executedPath && import.meta.url === pathToFileURL(executedPath).href) {
  void main().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error(message);
    process.exitCode = 1;
  });
}
