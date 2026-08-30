import { writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  getDraft,
  getDraftPicks,
  getLeague,
  getLeagueRosters,
  getLeagueUsers,
} from '../../frontend/src/api/sleeper.ts';
import { LEAGUE_ID as DEFAULT_LEAGUE_ID } from '../../frontend/src/config/league.ts';
import { buildDraftHistorySeason } from '../../frontend/src/data/draftHistoryTransforms.ts';
import type { DraftHistorySnapshot } from '../../frontend/src/data/draftHistoryTypes.ts';

const DEFAULT_OUTPUT_PATH = fileURLToPath(
  new URL('../../frontend/src/data/draftHistoryStore.json', import.meta.url),
);

type DraftHistoryLogger = Pick<Console, 'log'>;

export type DraftHistoryDependencies = {
  getLeague: typeof getLeague;
  getDraft: typeof getDraft;
  getDraftPicks: typeof getDraftPicks;
  getLeagueUsers: typeof getLeagueUsers;
  getLeagueRosters: typeof getLeagueRosters;
  now: () => Date;
  logger: DraftHistoryLogger;
};

const DEFAULT_DEPENDENCIES: DraftHistoryDependencies = {
  getLeague,
  getDraft,
  getDraftPicks,
  getLeagueUsers,
  getLeagueRosters,
  now: () => new Date(),
  logger: console,
};

export function parseDraftHistoryArgs(
  args: string[],
  defaultLeagueId: string = DEFAULT_LEAGUE_ID,
): { leagueId: string } {
  let leagueId = defaultLeagueId;
  args.forEach((arg) => {
    if (arg.startsWith('--league=')) {
      leagueId = arg.slice('--league='.length).trim();
      if (!leagueId) throw new Error('--league requires a non-empty Sleeper league ID');
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  });
  return { leagueId };
}

export async function buildDraftHistorySnapshot(
  currentLeagueId: string,
  dependencyOverrides: Partial<DraftHistoryDependencies> = {},
): Promise<DraftHistorySnapshot> {
  const dependencies = { ...DEFAULT_DEPENDENCIES, ...dependencyOverrides };
  const seasons: DraftHistorySnapshot['seasons'] = [];
  const visitedLeagueIds = new Set<string>();
  let leagueId: string | undefined = currentLeagueId;

  while (leagueId) {
    if (visitedLeagueIds.has(leagueId)) {
      throw new Error(`Sleeper league history contains a cycle at ${leagueId}`);
    }
    if (visitedLeagueIds.size >= 50) {
      throw new Error('Sleeper league history exceeded the 50-season safety limit');
    }
    visitedLeagueIds.add(leagueId);

    const league = await dependencies.getLeague(leagueId);
    if (league.league_id !== leagueId) {
      throw new Error(
        `Sleeper returned league ${league.league_id} for requested league ${leagueId}`,
      );
    }
    if (!league.draft_id) {
      throw new Error(`Sleeper league ${leagueId} is missing its canonical draft_id`);
    }

    dependencies.logger.log(`Fetching ${league.season} draft ${league.draft_id}...`);
    const [draft, picks, users, rosters] = await Promise.all([
      dependencies.getDraft(league.draft_id),
      dependencies.getDraftPicks(league.draft_id),
      dependencies.getLeagueUsers(leagueId),
      dependencies.getLeagueRosters(leagueId),
    ]);

    seasons.push(buildDraftHistorySeason(league, draft, picks, users, rosters));
    leagueId = league.previous_league_id || undefined;
  }

  seasons.sort((a, b) => Number(b.season) - Number(a.season));
  return {
    generatedAt: dependencies.now().toISOString(),
    currentLeagueId,
    seasons,
  };
}

export async function updateDraftHistory(
  currentLeagueId: string,
  options: {
    outputPath?: string;
    dependencies?: Partial<DraftHistoryDependencies>;
  } = {},
): Promise<DraftHistorySnapshot> {
  const dependencies = { ...DEFAULT_DEPENDENCIES, ...options.dependencies };
  const snapshot = await buildDraftHistorySnapshot(currentLeagueId, dependencies);
  const outputPath = options.outputPath ?? DEFAULT_OUTPUT_PATH;
  await writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  dependencies.logger.log(
    `Wrote ${snapshot.seasons.length.toString()} draft seasons to ${outputPath}`,
  );
  return snapshot;
}

async function main() {
  const { leagueId } = parseDraftHistoryArgs(process.argv.slice(2));
  await updateDraftHistory(leagueId);
}

const executedPath = process.argv[1];
if (executedPath && import.meta.url === pathToFileURL(executedPath).href) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
