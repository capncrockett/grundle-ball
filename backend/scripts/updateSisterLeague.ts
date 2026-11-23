import { writeFileSync } from 'node:fs';
import { SISTER_LEAGUE } from '../../frontend/src/config/league.ts';
import type {
  SisterLeagueMatchup,
  SisterLeagueSnapshot,
  SisterLeagueTeam,
} from '../../frontend/src/sisterLeague/sisterLeague.ts';

// Refreshes frontend/src/data/sisterLeagueSnapshot.json for the /sister-league page.
// The league is private on ESPN, so requests carry the espn_s2 and SWID
// cookies from the root .env. Cookie values are never logged or written.

const ESPN_API_BASE = 'https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl';
const SNAPSHOT_PATH = new URL('../../frontend/src/data/sisterLeagueSnapshot.json', import.meta.url);

type RawEspnRecord = {
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
};

type RawEspnTeam = {
  id: number;
  name?: string;
  playoffSeed: number;
  record: { overall: RawEspnRecord };
};

type RawEspnMatchupSide = { teamId: number; totalPoints: number };

type RawEspnMatchup = {
  matchupPeriodId: number;
  playoffTierType: string;
  winner: 'HOME' | 'AWAY' | 'TIE' | 'UNDECIDED';
  home: RawEspnMatchupSide;
  away?: RawEspnMatchupSide;
};

export type RawEspnLeague = {
  id: number;
  seasonId: number;
  settings: {
    name: string;
    scheduleSettings: {
      // Optional so a response without it is reported as unsupported, not a TypeError.
      divisions?: { id: number; size: number }[];
      matchupPeriodCount: number;
      playoffTeamCount: number;
      playoffMatchupPeriodLength: number;
      playoffSeedingRule: string;
    };
  };
  status: { currentMatchupPeriod: number; finalScoringPeriod: number };
  teams: RawEspnTeam[];
  schedule: RawEspnMatchup[];
};

// The top seeds take the empty slots in the smallest power-of-two bracket.
// Extra scoring weeks or longer playoff matchups do not add first-round byes.
const playoffByeCount = (raw: RawEspnLeague): number => {
  const { playoffTeamCount } = raw.settings.scheduleSettings;
  if (playoffTeamCount < 2) return 0;
  return 2 ** Math.ceil(Math.log2(playoffTeamCount)) - playoffTeamCount;
};

const toMatchups = (raw: RawEspnLeague): SisterLeagueMatchup[] =>
  raw.schedule
    .filter(
      (matchup) =>
        matchup.playoffTierType === 'NONE' &&
        matchup.away !== undefined &&
        matchup.matchupPeriodId <= raw.settings.scheduleSettings.matchupPeriodCount,
    )
    .map((matchup) => ({
      week: matchup.matchupPeriodId,
      homeTeamId: matchup.home.teamId,
      awayTeamId: matchup.away?.teamId ?? 0,
      homePoints: round(matchup.home.totalPoints),
      awayPoints: round(matchup.away?.totalPoints ?? 0),
      final: matchup.winner !== 'UNDECIDED',
    }))
    .sort((a, b) => a.week - b.week || a.homeTeamId - b.homeTeamId);

export type EspnCredentials = { espnS2: string; swid: string };

type FetchLike = (url: string, init: { headers: Record<string, string> }) => Promise<Response>;

const round = (value: number): number => Number(value.toFixed(2));

export function readCredentials(env: NodeJS.ProcessEnv): EspnCredentials {
  const espnS2 = env.ESPN_S2?.trim();
  const swid = env.ESPN_SWID?.trim();
  if (!espnS2 || !swid) {
    throw new Error('Set ESPN_S2 and ESPN_SWID in the repository root .env.');
  }
  if (!/^\{[^{}]+\}$/.test(swid)) {
    throw new Error('ESPN_SWID must include its curly braces, e.g. {XXXXXXXX-...}.');
  }
  return { espnS2, swid };
}

export type SnapshotNaming = {
  displayName?: string;
  teamNameOverrides?: Readonly<Record<number, string>>;
};

// A leading capitalized word with a possessive ("Name's" / "Names'") usually
// means a member's first name; require a reviewed override before publishing.
const LOOKS_LIKE_PERSONAL_NAME = /^[A-Z][a-z]+'s?\s/;

export function findUnreviewedPersonalNames(
  raw: RawEspnLeague,
  teamNameOverrides: Readonly<Record<number, string>> = {},
): number[] {
  return raw.teams
    .filter((team) => !(team.id in teamNameOverrides))
    .filter((team) => LOOKS_LIKE_PERSONAL_NAME.test(team.name?.trim() ?? ''))
    .map((team) => team.id);
}

export function toSisterLeagueSnapshot(
  raw: RawEspnLeague,
  fetchedAt: string,
  { displayName, teamNameOverrides = {} }: SnapshotNaming = {},
): SisterLeagueSnapshot {
  const { scheduleSettings } = raw.settings;
  // ESPN gives division winners the top seeds. The public page currently
  // models one division and total points as the record tiebreaker only.
  if (
    scheduleSettings.playoffSeedingRule !== 'TOTAL_POINTS_SCORED' ||
    (scheduleSettings.divisions ?? []).filter((division) => division.size > 0).length !== 1
  ) {
    throw new Error(
      'Unsupported ESPN playoff seeding: Sister League requires one division and total points as the record tiebreaker. Update the seeding model before refreshing.',
    );
  }
  const unreviewed = findUnreviewedPersonalNames(raw, teamNameOverrides);
  if (unreviewed.length > 0) {
    throw new Error(
      `Team ids ${unreviewed.join(', ')} may contain a member's name; add reviewed teamNameOverrides in frontend/src/config/league.ts before refreshing.`,
    );
  }
  const teams: SisterLeagueTeam[] = raw.teams.map((team) => ({
    id: team.id,
    name: teamNameOverrides[team.id] ?? (team.name?.trim() || `Team ${team.id.toString()}`),
    wins: team.record.overall.wins,
    losses: team.record.overall.losses,
    ties: team.record.overall.ties,
    pointsFor: round(team.record.overall.pointsFor),
    seed: team.playoffSeed,
  }));

  return {
    leagueId: raw.id.toString(),
    seasonId: raw.seasonId,
    leagueName: displayName ?? raw.settings.name.trim(),
    fetchedAt,
    currentMatchupPeriod: raw.status.currentMatchupPeriod,
    regularSeasonWeeks: scheduleSettings.matchupPeriodCount,
    playoffTeamCount: scheduleSettings.playoffTeamCount,
    playoffByeCount: playoffByeCount(raw),
    teams: teams.sort((a, b) => a.seed - b.seed),
    matchups: toMatchups(raw),
  };
}

export async function fetchEspnLeague(
  credentials: EspnCredentials,
  { leagueId, seasonId }: { leagueId: string; seasonId: number } = SISTER_LEAGUE,
  fetchImpl: FetchLike = fetch,
): Promise<RawEspnLeague> {
  const url = `${ESPN_API_BASE}/seasons/${seasonId.toString()}/segments/0/leagues/${leagueId}?view=mSettings&view=mTeam&view=mMatchupScore`;
  const response = await fetchImpl(url, {
    headers: { Cookie: `espn_s2=${credentials.espnS2}; SWID=${credentials.swid}` },
  });
  if (response.status === 401) {
    throw new Error('ESPN rejected the cookies (401). Refresh ESPN_S2 and ESPN_SWID in .env.');
  }
  if (!response.ok) {
    throw new Error(`ESPN API error (${response.status.toString()}): ${response.statusText}`);
  }
  return (await response.json()) as RawEspnLeague;
}

async function main(): Promise<void> {
  const credentials = readCredentials(process.env);
  const raw = await fetchEspnLeague(credentials);
  const snapshot = toSisterLeagueSnapshot(raw, new Date().toISOString(), SISTER_LEAGUE);
  writeFileSync(SNAPSHOT_PATH, `${JSON.stringify(snapshot, null, 2)}\n`);
  console.log(
    `Wrote ${snapshot.teams.length.toString()} teams for ${snapshot.leagueName} (week ${snapshot.currentMatchupPeriod.toString()}).`,
  );
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
