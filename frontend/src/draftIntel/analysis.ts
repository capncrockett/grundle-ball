import type {
  DraftHistoryPick,
  DraftHistorySeason,
  DraftHistorySnapshot,
  DraftHistoryTeam,
} from '../data/draftHistoryTypes';

export const DEFAULT_DRAFT_INTEL_START_SEASON = '2021';
export const IDP_INTEL_START_SEASON = '2026';

export type DraftIntelCategory =
  'roster-construction' | 'draft-timing' | 'opening-rounds' | 'nfl-affinity';

export type DraftIntelStrength = 'strong' | 'notable' | 'emerging';

export type DraftIntelPattern = {
  id: string;
  category: DraftIntelCategory;
  badge: string;
  description: string;
  evidence: string;
  strength: DraftIntelStrength;
  rosterIds: number[];
  sortScore: number;
};

export type DraftIntelTeamReport = {
  rosterId: number;
  team: DraftHistoryTeam;
  completedDrafts: number;
  selectionCount: number;
  patterns: DraftIntelPattern[];
};

export type DraftIntelReport = {
  startSeason: string | null;
  endSeason: string | null;
  completedDraftCount: number;
  includedTeamCount: number;
  excludedRosterId: number | null;
  leaguePatterns: DraftIntelPattern[];
  teams: DraftIntelTeamReport[];
};

export type BuildDraftIntelOptions = {
  sinceSeason?: string;
  excludedRosterId?: number | null;
};

type PositionRule = {
  position: string;
  earlyRound: number;
};

type TeamAffinity = {
  rosterId: number;
  nflTeam: string;
  pickCount: number;
  teamRate: number;
  baselineRate: number;
  multiplier: number;
  strong: boolean;
};

const POSITION_RULES: PositionRule[] = [
  { position: 'QB', earlyRound: 3 },
  { position: 'TE', earlyRound: 3 },
  { position: 'K', earlyRound: 9 },
  { position: 'DEF', earlyRound: 9 },
  { position: 'DL', earlyRound: 9 },
  { position: 'LB', earlyRound: 7 },
  { position: 'DB', earlyRound: 9 },
];

const NFL_TEAM_NAMES: Record<string, string> = {
  ARI: 'Arizona Cardinals',
  ATL: 'Atlanta Falcons',
  BAL: 'Baltimore Ravens',
  BUF: 'Buffalo Bills',
  CAR: 'Carolina Panthers',
  CHI: 'Chicago Bears',
  CIN: 'Cincinnati Bengals',
  CLE: 'Cleveland Browns',
  DAL: 'Dallas Cowboys',
  DEN: 'Denver Broncos',
  DET: 'Detroit Lions',
  GB: 'Green Bay Packers',
  HOU: 'Houston Texans',
  IND: 'Indianapolis Colts',
  JAX: 'Jacksonville Jaguars',
  KC: 'Kansas City Chiefs',
  LAC: 'Los Angeles Chargers',
  LAR: 'Los Angeles Rams',
  LV: 'Las Vegas Raiders',
  MIA: 'Miami Dolphins',
  MIN: 'Minnesota Vikings',
  NE: 'New England Patriots',
  NO: 'New Orleans Saints',
  NYG: 'New York Giants',
  NYJ: 'New York Jets',
  PHI: 'Philadelphia Eagles',
  PIT: 'Pittsburgh Steelers',
  SEA: 'Seattle Seahawks',
  SF: 'San Francisco 49ers',
  TB: 'Tampa Bay Buccaneers',
  TEN: 'Tennessee Titans',
  WAS: 'Washington Commanders',
};

const STRENGTH_ORDER: Record<DraftIntelStrength, number> = {
  strong: 3,
  notable: 2,
  emerging: 1,
};

const categoryOrder: Record<DraftIntelCategory, number> = {
  'roster-construction': 4,
  'draft-timing': 3,
  'opening-rounds': 2,
  'nfl-affinity': 1,
};

const IDP_POSITIONS = new Set(['DL', 'LB', 'DB']);

const POSITION_IMPORTANCE: Record<string, number> = {
  'RB WR': 5,
  RB: 5,
  WR: 5,
  DL: 4,
  LB: 4,
  DB: 4,
  QB: 3,
  TE: 3,
  K: 1,
  DEF: 1,
  DST: 1,
};

const normalizePosition = (position: string | null): string | null => {
  const normalized = position?.trim().toUpperCase();
  if (!normalized) return null;
  if (normalized === 'DST' || normalized === 'D/ST') return 'DEF';
  if (normalized === 'DE' || normalized === 'DT') return 'DL';
  if (normalized === 'CB' || normalized === 'S') return 'DB';
  if (normalized === 'ILB' || normalized === 'OLB') return 'LB';
  return normalized;
};

const completedSeasonsSince = (
  snapshot: DraftHistorySnapshot,
  sinceSeason: string,
): DraftHistorySeason[] =>
  snapshot.seasons
    .filter(
      (season) => season.draftStatus === 'complete' && Number(season.season) >= Number(sinceSeason),
    )
    .sort((a, b) => Number(a.season) - Number(b.season));

const draftSelections = (season: DraftHistorySeason): DraftHistoryPick[] =>
  season.picks.filter((pick) => {
    if (pick.isKeeper) return false;
    const position = normalizePosition(pick.position);
    return (
      !position ||
      !IDP_POSITIONS.has(position) ||
      Number(season.season) >= Number(IDP_INTEL_START_SEASON)
    );
  });

const currentTeams = (snapshot: DraftHistorySnapshot): DraftHistoryTeam[] => {
  const latestSeason = [...snapshot.seasons]
    .sort((a, b) => Number(b.season) - Number(a.season))
    .at(0);
  return latestSeason ? [...latestSeason.teams].sort((a, b) => a.rosterId - b.rosterId) : [];
};

const teamExistsInSeason = (season: DraftHistorySeason, rosterId: number): boolean =>
  season.teams.some((team) => team.rosterId === rosterId);

const activeSeasonsForPosition = (
  seasons: DraftHistorySeason[],
  position: string,
): DraftHistorySeason[] =>
  seasons.filter((season) => {
    const positionPickCount = draftSelections(season).filter(
      (pick) => normalizePosition(pick.position) === position,
    ).length;
    const activityFloor = Math.max(3, Math.ceil(season.teamCount * 0.4));
    return positionPickCount >= activityFloor;
  });

const selectionsForTeam = (seasons: DraftHistorySeason[], rosterId: number): DraftHistoryPick[] =>
  seasons.flatMap((season) => draftSelections(season).filter((pick) => pick.rosterId === rosterId));

const positionSelectionsForTeam = (
  seasons: DraftHistorySeason[],
  rosterId: number,
  position: string,
): DraftHistoryPick[] =>
  selectionsForTeam(seasons, rosterId).filter(
    (pick) => normalizePosition(pick.position) === position,
  );

const ratioStrength = (ratio: number, seasonCount: number): DraftIntelStrength => {
  if (seasonCount < 3) return 'emerging';
  return ratio >= 0.75 ? 'strong' : 'notable';
};

const fantasyImportance = (pattern: DraftIntelPattern): number => {
  if (pattern.category === 'nfl-affinity') return 2;
  return POSITION_IMPORTANCE[pattern.badge] ?? 2;
};

const sortPatterns = (patterns: DraftIntelPattern[]): DraftIntelPattern[] =>
  [...patterns].sort((a, b) => {
    const importanceDifference = fantasyImportance(b) - fantasyImportance(a);
    if (importanceDifference !== 0) return importanceDifference;
    const strengthDifference = STRENGTH_ORDER[b.strength] - STRENGTH_ORDER[a.strength];
    if (strengthDifference !== 0) return strengthDifference;
    const categoryDifference = categoryOrder[b.category] - categoryOrder[a.category];
    if (categoryDifference !== 0) return categoryDifference;
    if (b.sortScore !== a.sortScore) return b.sortScore - a.sortScore;
    return a.description.localeCompare(b.description);
  });

const formatDraftCount = (count: number): string =>
  `${count.toString()} completed draft${count === 1 ? '' : 's'}`;

const formatTeamNames = (rosterIds: number[], teams: DraftHistoryTeam[]): string => {
  const names = rosterIds.map(
    (rosterId) =>
      teams.find((team) => team.rosterId === rosterId)?.teamName ?? `Roster ${rosterId.toString()}`,
  );
  if (names.length <= 1) return names[0] ?? 'Unknown Team';
  if (names.length === 2) return names.join(' and ');
  return `${names.slice(0, -1).join(', ')}, and ${names.at(-1) ?? 'Unknown Team'}`;
};

const buildPositionPatterns = (
  seasons: DraftHistorySeason[],
  teams: DraftHistoryTeam[],
): { league: DraftIntelPattern[]; byRosterId: Map<number, DraftIntelPattern[]> } => {
  const league: DraftIntelPattern[] = [];
  const byRosterId = new Map<number, DraftIntelPattern[]>();

  const addTeamPattern = (rosterId: number, pattern: DraftIntelPattern) => {
    const current = byRosterId.get(rosterId) ?? [];
    current.push(pattern);
    byRosterId.set(rosterId, current);
  };

  POSITION_RULES.forEach(({ position, earlyRound }) => {
    const positionSeasons = activeSeasonsForPosition(seasons, position);
    if (positionSeasons.length === 0) return;

    const backupSupporters: number[] = [];
    teams.forEach((team) => {
      const eligibleSeasons = positionSeasons.filter((season) =>
        teamExistsInSeason(season, team.rosterId),
      );
      if (eligibleSeasons.length === 0) return;
      const seasonsWithNoBackup = eligibleSeasons.filter(
        (season) => positionSelectionsForTeam([season], team.rosterId, position).length <= 1,
      ).length;
      const ratio = seasonsWithNoBackup / eligibleSeasons.length;
      if (ratio >= 0.75) {
        backupSupporters.push(team.rosterId);
        addTeamPattern(team.rosterId, {
          id: `team-${team.rosterId.toString()}-backup-${position}`,
          category: 'roster-construction',
          badge: position,
          description: `Usually skips drafting a backup ${position}.`,
          evidence: `${seasonsWithNoBackup.toString()}/${eligibleSeasons.length.toString()} drafts with zero or one`,
          strength: ratioStrength(ratio, eligibleSeasons.length),
          rosterIds: [team.rosterId],
          sortScore: ratio,
        });
      }
    });

    const backupRatio = backupSupporters.length / teams.length;
    if (teams.length > 0 && backupRatio >= 0.25) {
      league.push({
        id: `league-backup-${position}`,
        category: 'roster-construction',
        badge: position,
        description: `${backupSupporters.length.toString()}/${teams.length.toString()} teams usually skip drafting a backup ${position}.`,
        evidence: formatDraftCount(positionSeasons.length),
        strength: ratioStrength(backupRatio, positionSeasons.length),
        rosterIds: backupSupporters,
        sortScore: backupRatio,
      });
    }

    const timingSupporters: number[] = [];
    teams.forEach((team) => {
      const teamPicks = positionSelectionsForTeam(positionSeasons, team.rosterId, position);
      const hasEarlyPick = teamPicks.some((pick) => pick.round < earlyRound);
      if (!hasEarlyPick) {
        timingSupporters.push(team.rosterId);
        addTeamPattern(team.rosterId, {
          id: `team-${team.rosterId.toString()}-timing-${position}`,
          category: 'draft-timing',
          badge: position,
          description: `Has never drafted a ${position} before Round ${earlyRound.toString()}.`,
          evidence: formatDraftCount(positionSeasons.length),
          strength: ratioStrength(1, positionSeasons.length),
          rosterIds: [team.rosterId],
          sortScore: 1,
        });
      }
    });

    const timingRatio = timingSupporters.length / teams.length;
    if (teams.length > 0 && timingRatio >= 0.5) {
      league.push({
        id: `league-timing-${position}`,
        category: 'draft-timing',
        badge: position,
        description: `${timingSupporters.length.toString()}/${teams.length.toString()} teams have never drafted a ${position} before Round ${earlyRound.toString()}.`,
        evidence: formatDraftCount(positionSeasons.length),
        strength: ratioStrength(timingRatio, positionSeasons.length),
        rosterIds: timingSupporters,
        sortScore: timingRatio,
      });
    }

    if (positionSeasons.length < 2) return;
    const firstRounds = positionSeasons.map((season) =>
      Math.min(
        ...draftSelections(season)
          .filter(
            (pick) =>
              normalizePosition(pick.position) === position &&
              teams.some((team) => team.rosterId === pick.rosterId),
          )
          .map((pick) => pick.round),
      ),
    );
    if (firstRounds.some((round) => !Number.isFinite(round))) return;
    const earliest = Math.min(...firstRounds);
    const latest = Math.max(...firstRounds);
    if (latest - earliest > 3) return;

    const draftWindow =
      earliest === latest
        ? `in Round ${earliest.toString()}`
        : `between Rounds ${earliest.toString()} and ${latest.toString()}`;
    const windowStrength: DraftIntelStrength =
      positionSeasons.length < 3 ? 'emerging' : latest - earliest <= 2 ? 'strong' : 'notable';
    league.push({
      id: `league-first-${position}`,
      category: 'draft-timing',
      badge: position,
      description: `The first ${position} has always gone ${draftWindow}.`,
      evidence: formatDraftCount(positionSeasons.length),
      strength: windowStrength,
      rosterIds: [],
      sortScore: 1 - (latest - earliest) / 10,
    });
  });

  return { league, byRosterId };
};

const buildOpeningPatterns = (
  seasons: DraftHistorySeason[],
  teams: DraftHistoryTeam[],
): { league: DraftIntelPattern[]; byRosterId: Map<number, DraftIntelPattern[]> } => {
  const league: DraftIntelPattern[] = [];
  const byRosterId = new Map<number, DraftIntelPattern[]>();
  const rbWr = new Set(['RB', 'WR']);
  const openingSupporters: number[] = [];

  teams.forEach((team) => {
    const eligibleSeasons = seasons.filter(
      (season) =>
        teamExistsInSeason(season, team.rosterId) &&
        draftSelections(season).some((pick) => pick.rosterId === team.rosterId && pick.round <= 2),
    );
    if (eligibleSeasons.length === 0) return;
    const rbWrOpenings = eligibleSeasons.filter((season) => {
      const openingPicks = draftSelections(season).filter(
        (pick) => pick.rosterId === team.rosterId && pick.round <= 2,
      );
      return openingPicks.every((pick) => {
        const position = normalizePosition(pick.position);
        return position !== null && rbWr.has(position);
      });
    }).length;
    const openingRatio = rbWrOpenings / eligibleSeasons.length;
    if (openingRatio >= 0.6) {
      openingSupporters.push(team.rosterId);
      byRosterId.set(team.rosterId, [
        {
          id: `team-${team.rosterId.toString()}-rb-wr-opening`,
          category: 'opening-rounds',
          badge: 'RB WR',
          description: 'Usually opens the draft with only RBs and WRs.',
          evidence: `${rbWrOpenings.toString()}/${eligibleSeasons.length.toString()} drafts`,
          strength: ratioStrength(openingRatio, eligibleSeasons.length),
          rosterIds: [team.rosterId],
          sortScore: openingRatio,
        },
      ]);
    }

    const earlyPicks = eligibleSeasons.flatMap((season) =>
      draftSelections(season).filter((pick) => pick.rosterId === team.rosterId && pick.round <= 5),
    );
    if (earlyPicks.length === 0) return;
    const rbWrCount = earlyPicks.filter((pick) => {
      const position = normalizePosition(pick.position);
      return position !== null && rbWr.has(position);
    }).length;
    const earlyShare = rbWrCount / earlyPicks.length;
    if (earlyShare < 0.65) return;
    const current = byRosterId.get(team.rosterId) ?? [];
    current.push({
      id: `team-${team.rosterId.toString()}-rb-wr-first-five`,
      category: 'opening-rounds',
      badge: 'RB WR',
      description: `${Math.round(earlyShare * 100).toString()}% of first-five-round selections are RBs or WRs.`,
      evidence: `${rbWrCount.toString()}/${earlyPicks.length.toString()} Draft Selections`,
      strength: ratioStrength(earlyShare, eligibleSeasons.length),
      rosterIds: [team.rosterId],
      sortScore: earlyShare,
    });
    byRosterId.set(team.rosterId, current);
  });

  const openingRatio = openingSupporters.length / teams.length;
  if (teams.length > 0 && openingRatio >= 0.5) {
    league.push({
      id: 'league-rb-wr-opening',
      category: 'opening-rounds',
      badge: 'RB WR',
      description: `${openingSupporters.length.toString()}/${teams.length.toString()} teams usually draft only RBs and WRs in the first two rounds.`,
      evidence: formatDraftCount(seasons.length),
      strength: ratioStrength(openingRatio, seasons.length),
      rosterIds: openingSupporters,
      sortScore: openingRatio,
    });
  }

  const firstFive = seasons.flatMap((season) =>
    draftSelections(season).filter(
      (pick) => pick.round <= 5 && teams.some((team) => team.rosterId === pick.rosterId),
    ),
  );
  if (firstFive.length > 0) {
    const rbWrCount = firstFive.filter((pick) => {
      const position = normalizePosition(pick.position);
      return position !== null && rbWr.has(position);
    }).length;
    const share = rbWrCount / firstFive.length;
    league.push({
      id: 'league-rb-wr-first-five',
      category: 'opening-rounds',
      badge: 'RB WR',
      description: `${Math.round(share * 100).toString()}% of picks in the first five rounds have been RBs and WRs.`,
      evidence: `${rbWrCount.toString()}/${firstFive.length.toString()} Draft Selections`,
      strength: ratioStrength(share, seasons.length),
      rosterIds: teams.map((team) => team.rosterId),
      sortScore: share,
    });
  }

  return { league, byRosterId };
};

const findTeamAffinities = (
  seasons: DraftHistorySeason[],
  teams: DraftHistoryTeam[],
): TeamAffinity[] => {
  const allPicks = seasons
    .flatMap(draftSelections)
    .filter((pick) => teams.some((team) => team.rosterId === pick.rosterId));

  return teams.flatMap((team) => {
    const teamPicks = allPicks.filter((pick) => pick.rosterId === team.rosterId && pick.nflTeam);
    const otherPicks = allPicks.filter((pick) => pick.rosterId !== team.rosterId && pick.nflTeam);
    if (teamPicks.length < 30 || otherPicks.length === 0) return [];

    const countByNflTeam = new Map<string, number>();
    teamPicks.forEach((pick) => {
      const nflTeam = pick.nflTeam?.trim().toUpperCase();
      if (nflTeam) countByNflTeam.set(nflTeam, (countByNflTeam.get(nflTeam) ?? 0) + 1);
    });

    return Array.from(countByNflTeam.entries())
      .map<TeamAffinity | null>(([nflTeam, pickCount]) => {
        const otherCount = otherPicks.filter(
          (pick) => pick.nflTeam?.trim().toUpperCase() === nflTeam,
        ).length;
        const teamRate = pickCount / teamPicks.length;
        const baselineRate = otherCount / otherPicks.length;
        const multiplier = baselineRate > 0 ? teamRate / baselineRate : Number.POSITIVE_INFINITY;
        if (pickCount < 5 || teamRate < 0.055 || multiplier < 1.65) return null;
        return {
          rosterId: team.rosterId,
          nflTeam,
          pickCount,
          teamRate,
          baselineRate,
          multiplier,
          strong: pickCount >= 7 && multiplier >= 2,
        };
      })
      .filter((affinity): affinity is TeamAffinity => affinity !== null)
      .sort((a, b) => b.multiplier - a.multiplier || b.pickCount - a.pickCount)
      .slice(0, 2);
  });
};

const buildAffinityPatterns = (
  seasons: DraftHistorySeason[],
  teams: DraftHistoryTeam[],
): { league: DraftIntelPattern[]; byRosterId: Map<number, DraftIntelPattern[]> } => {
  const affinities = findTeamAffinities(seasons, teams);
  const byRosterId = new Map<number, DraftIntelPattern[]>();

  affinities.forEach((affinity) => {
    const multiplier = Number.isFinite(affinity.multiplier)
      ? `${affinity.multiplier.toFixed(1)}x`
      : 'well above';
    const patterns = byRosterId.get(affinity.rosterId) ?? [];
    patterns.push({
      id: `team-${affinity.rosterId.toString()}-nfl-${affinity.nflTeam}`,
      category: 'nfl-affinity',
      badge: affinity.nflTeam,
      description: `Frequently drafts ${NFL_TEAM_NAMES[affinity.nflTeam] ?? affinity.nflTeam} players.`,
      evidence: `${affinity.pickCount.toString()} picks - ${multiplier} the league baseline`,
      strength: affinity.strong ? 'strong' : 'notable',
      rosterIds: [affinity.rosterId],
      sortScore: affinity.multiplier,
    });
    byRosterId.set(affinity.rosterId, patterns);
  });

  const byNflTeam = new Map<string, TeamAffinity[]>();
  affinities.forEach((affinity) => {
    const current = byNflTeam.get(affinity.nflTeam) ?? [];
    current.push(affinity);
    byNflTeam.set(affinity.nflTeam, current);
  });

  const league = sortPatterns(
    Array.from(byNflTeam.entries()).map<DraftIntelPattern>(([nflTeam, matchingAffinities]) => {
      const rosterIds = matchingAffinities.map((affinity) => affinity.rosterId);
      const teamNames = formatTeamNames(rosterIds, teams);
      return {
        id: `league-nfl-${nflTeam}`,
        category: 'nfl-affinity',
        badge: nflTeam,
        description: `${teamNames} frequently ${rosterIds.length === 1 ? 'drafts' : 'draft'} ${NFL_TEAM_NAMES[nflTeam] ?? nflTeam} players.`,
        evidence: 'At least 5 picks and 1.65x the league baseline',
        strength: matchingAffinities.some((affinity) => affinity.strong) ? 'strong' : 'notable',
        rosterIds,
        sortScore: Math.max(...matchingAffinities.map((affinity) => affinity.multiplier)),
      };
    }),
  ).slice(0, 5);

  return { league, byRosterId };
};

const mergeTeamPatternMaps = (
  rosterId: number,
  ...maps: Map<number, DraftIntelPattern[]>[]
): DraftIntelPattern[] => sortPatterns(maps.flatMap((map) => map.get(rosterId) ?? []));

export function buildDraftIntelReport(
  snapshot: DraftHistorySnapshot,
  options: BuildDraftIntelOptions = {},
): DraftIntelReport {
  const sinceSeason = options.sinceSeason ?? DEFAULT_DRAFT_INTEL_START_SEASON;
  const excludedRosterId = options.excludedRosterId ?? null;
  const seasons = completedSeasonsSince(snapshot, sinceSeason);
  const teams = currentTeams(snapshot).filter((team) => team.rosterId !== excludedRosterId);

  const positions = buildPositionPatterns(seasons, teams);
  const openings = buildOpeningPatterns(seasons, teams);
  const affinities = buildAffinityPatterns(seasons, teams);

  const teamReports = teams.map<DraftIntelTeamReport>((team) => {
    const teamSeasons = seasons.filter((season) => teamExistsInSeason(season, team.rosterId));
    return {
      rosterId: team.rosterId,
      team,
      completedDrafts: teamSeasons.length,
      selectionCount: selectionsForTeam(teamSeasons, team.rosterId).length,
      patterns: mergeTeamPatternMaps(
        team.rosterId,
        positions.byRosterId,
        openings.byRosterId,
        affinities.byRosterId,
      ),
    };
  });

  return {
    startSeason: seasons.at(0)?.season ?? null,
    endSeason: seasons.at(-1)?.season ?? null,
    completedDraftCount: seasons.length,
    includedTeamCount: teams.length,
    excludedRosterId,
    leaguePatterns: sortPatterns([...positions.league, ...openings.league, ...affinities.league]),
    teams: teamReports.sort((a, b) => a.team.teamName.localeCompare(b.team.teamName)),
  };
}
