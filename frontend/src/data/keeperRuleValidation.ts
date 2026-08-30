import type { DraftHistorySeason } from './draftHistoryTypes';

export const MAX_KEEPERS_PER_TEAM = 2;
export const MAX_CONSECUTIVE_KEEPER_SEASONS = 2;

export type TeamKeeperLimitViolation = {
  code: 'team-keeper-limit';
  season: string;
  rosterId: number;
  teamName: string;
  keeperCount: number;
  limit: number;
};

export type TeamPlayerKeeperCycleLimitViolation = {
  code: 'team-player-cycle-limit';
  season: string;
  rosterId: number;
  teamName: string;
  playerId: string;
  playerName: string;
  keeperCycleLength: number;
  limit: number;
};

export type KeeperRuleViolation = TeamKeeperLimitViolation | TeamPlayerKeeperCycleLimitViolation;

const teamNameFor = (season: DraftHistorySeason, rosterId: number): string =>
  season.teams.find((team) => team.rosterId === rosterId)?.teamName ??
  `Roster ${rosterId.toString()}`;

const teamPlayerKey = (rosterId: number, playerId: string): string =>
  `${rosterId.toString()}:${playerId}`;

const keeperCycleLengthFor = (
  seasons: DraftHistorySeason[],
  currentSeason: DraftHistorySeason,
  rosterId: number,
  playerId: string,
): number => {
  const currentSeasonNumber = Number(currentSeason.season);
  if (!Number.isInteger(currentSeasonNumber)) return 1;

  const seasonsByNumber = new Map<number, DraftHistorySeason>();
  seasons.forEach((season) => {
    const seasonNumber = Number(season.season);
    if (!Number.isInteger(seasonNumber)) return;
    const isCurrentSeason = season.draftId === currentSeason.draftId;
    if (!isCurrentSeason && season.draftStatus !== 'complete') return;
    if (isCurrentSeason || !seasonsByNumber.has(seasonNumber)) {
      seasonsByNumber.set(seasonNumber, season);
    }
  });

  let keeperCycleLength = 0;
  for (let seasonNumber = currentSeasonNumber; ; seasonNumber -= 1) {
    const season = seasonsByNumber.get(seasonNumber);
    if (!season) break;
    const hasKeeperDesignation = season.picks.some(
      (pick) => pick.isKeeper && pick.rosterId === rosterId && pick.playerId === playerId,
    );
    if (!hasKeeperDesignation) break;
    keeperCycleLength += 1;
  }

  return keeperCycleLength;
};

export function getCurrentKeeperCycleLength(
  seasons: DraftHistorySeason[],
  rosterId: number,
  playerId: string,
): number {
  const currentSeason = seasons.at(0);
  if (!currentSeason) return 0;
  return keeperCycleLengthFor(seasons, currentSeason, rosterId, playerId);
}

export function findKeeperRuleViolations(seasons: DraftHistorySeason[]): KeeperRuleViolation[] {
  const currentSeason = seasons.at(0);
  if (!currentSeason) return [];

  const currentKeepers = currentSeason.picks.filter((pick) => pick.isKeeper);
  const violations: KeeperRuleViolation[] = [];
  const currentKeeperCountsByRoster = new Map<number, number>();

  currentKeepers.forEach((pick) => {
    currentKeeperCountsByRoster.set(
      pick.rosterId,
      (currentKeeperCountsByRoster.get(pick.rosterId) ?? 0) + 1,
    );
  });

  currentKeeperCountsByRoster.forEach((keeperCount, rosterId) => {
    if (keeperCount <= MAX_KEEPERS_PER_TEAM) return;
    violations.push({
      code: 'team-keeper-limit',
      season: currentSeason.season,
      rosterId,
      teamName: teamNameFor(currentSeason, rosterId),
      keeperCount,
      limit: MAX_KEEPERS_PER_TEAM,
    });
  });

  const checkedTeamPlayers = new Set<string>();
  currentKeepers.forEach((pick) => {
    const key = teamPlayerKey(pick.rosterId, pick.playerId);
    if (checkedTeamPlayers.has(key)) return;
    checkedTeamPlayers.add(key);

    const keeperCycleLength = keeperCycleLengthFor(
      seasons,
      currentSeason,
      pick.rosterId,
      pick.playerId,
    );
    if (keeperCycleLength <= MAX_CONSECUTIVE_KEEPER_SEASONS) return;
    violations.push({
      code: 'team-player-cycle-limit',
      season: currentSeason.season,
      rosterId: pick.rosterId,
      teamName: teamNameFor(currentSeason, pick.rosterId),
      playerId: pick.playerId,
      playerName: pick.playerName,
      keeperCycleLength,
      limit: MAX_CONSECUTIVE_KEEPER_SEASONS,
    });
  });

  return violations.sort((a, b) => {
    const teamOrder = a.teamName.localeCompare(b.teamName);
    if (teamOrder !== 0) return teamOrder;
    if (a.code !== b.code) return a.code.localeCompare(b.code);
    if (a.code === 'team-player-cycle-limit' && b.code === a.code) {
      return a.playerName.localeCompare(b.playerName);
    }
    return 0;
  });
}
