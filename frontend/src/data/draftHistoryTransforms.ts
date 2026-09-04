import type {
  SleeperDraft,
  SleeperDraftPick,
  SleeperLeague,
  SleeperRoster,
  SleeperUser,
} from '../api/sleeper';
import type {
  DraftHistoryPick,
  DraftHistorySeason,
  DraftHistorySnapshot,
  DraftHistorySlot,
  DraftHistoryTeam,
  KeeperDesignation,
  KeeperLedgerEntry,
} from './draftHistoryTypes';
import { getSnakeDraftPickNumber } from '../utils/draftBoard.ts';

const positiveInteger = (value: unknown, label: string): number => {
  const parsed = typeof value === 'string' ? Number(value) : value;
  if (typeof parsed !== 'number' || !Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Sleeper draft data is missing a valid ${label}`);
  }
  return parsed;
};

const playerNameFor = (pick: SleeperDraftPick): string => {
  const name = [pick.metadata?.first_name, pick.metadata?.last_name]
    .filter((part): part is string => Boolean(part?.trim()))
    .join(' ')
    .trim();
  return name || `Player ${pick.player_id}`;
};

const buildTeams = (users: SleeperUser[], rosters: SleeperRoster[]): DraftHistoryTeam[] => {
  const usersById = new Map(users.map((user) => [user.user_id, user]));

  return rosters
    .map((roster) => {
      const user = usersById.get(roster.owner_id);
      const managerName =
        user?.display_name || user?.username || `Roster ${roster.roster_id.toString()}`;
      return {
        rosterId: roster.roster_id,
        ownerId: roster.owner_id,
        teamName: user?.metadata?.team_name || managerName,
        managerName,
        avatar: user?.avatar ?? null,
      };
    })
    .sort((a, b) => a.rosterId - b.rosterId);
};

const buildPicks = (picks: SleeperDraftPick[]): DraftHistoryPick[] =>
  picks
    .map((pick) => ({
      playerId: pick.player_id,
      playerName: playerNameFor(pick),
      position: pick.metadata?.position || null,
      nflTeam: pick.metadata?.team || null,
      rosterId: positiveInteger(pick.roster_id, 'pick roster_id'),
      round: positiveInteger(pick.round, 'pick round'),
      draftSlot: positiveInteger(pick.draft_slot, 'pick draft_slot'),
      pickNo: positiveInteger(pick.pick_no, 'pick pick_no'),
      isKeeper: pick.is_keeper === true,
    }))
    .sort((a, b) => a.pickNo - b.pickNo);

export function buildDraftHistorySeason(
  league: SleeperLeague,
  draft: SleeperDraft,
  picks: SleeperDraftPick[],
  users: SleeperUser[],
  rosters: SleeperRoster[],
): DraftHistorySeason {
  if (draft.league_id !== league.league_id) {
    throw new Error(
      `Sleeper draft ${draft.draft_id} belongs to league ${draft.league_id}, not ${league.league_id}`,
    );
  }
  if (draft.draft_id !== league.draft_id) {
    throw new Error(
      `Sleeper league ${league.league_id} points to draft ${league.draft_id}, not ${draft.draft_id}`,
    );
  }

  const normalizedPicks = buildPicks(picks);
  const inferredRounds = normalizedPicks.reduce((max, pick) => Math.max(max, pick.round), 0);
  const teamCount =
    typeof draft.settings.teams === 'number' && draft.settings.teams > 0
      ? draft.settings.teams
      : league.total_rosters;
  const rosterIdByOwnerId = new Map(rosters.map((roster) => [roster.owner_id, roster.roster_id]));
  const rosterIdByDraftSlot = new Map<number, number>();

  Object.entries(draft.slot_to_roster_id ?? {}).forEach(([slot, rosterId]) => {
    rosterIdByDraftSlot.set(
      positiveInteger(slot, 'slot_to_roster_id draft slot'),
      positiveInteger(rosterId, 'slot_to_roster_id roster'),
    );
  });
  Object.entries(draft.draft_order ?? {}).forEach(([ownerId, slot]) => {
    const rosterId = rosterIdByOwnerId.get(ownerId);
    if (rosterId !== undefined && !rosterIdByDraftSlot.has(slot)) {
      rosterIdByDraftSlot.set(slot, rosterId);
    }
  });

  const draftSlots: DraftHistorySlot[] = Array.from({ length: teamCount }, (_, index) => {
    const draftSlot = index + 1;
    const inferredRosterId = normalizedPicks.find((pick) => pick.draftSlot === draftSlot)?.rosterId;
    return {
      draftSlot,
      rosterId: rosterIdByDraftSlot.get(draftSlot) ?? inferredRosterId ?? draftSlot,
    };
  });

  return {
    leagueId: league.league_id,
    season: league.season,
    leagueStatus: league.status,
    draftId: draft.draft_id,
    draftStatus: draft.status,
    draftType: draft.type,
    startTime: draft.start_time,
    rounds:
      typeof draft.settings.rounds === 'number' && draft.settings.rounds > 0
        ? draft.settings.rounds
        : inferredRounds,
    teamCount,
    draftSlots,
    teams: buildTeams(users, rosters),
    picks: normalizedPicks,
  };
}

export function mergeLiveDraftSeason(
  snapshot: DraftHistorySnapshot,
  liveSeason: DraftHistorySeason,
): DraftHistorySnapshot {
  const seasons = snapshot.seasons.filter((season) => season.leagueId !== liveSeason.leagueId);
  seasons.push(liveSeason);
  seasons.sort((a, b) => Number(b.season) - Number(a.season));
  return { ...snapshot, seasons };
}

export function getTeamForRoster(
  season: DraftHistorySeason,
  rosterId: number,
): DraftHistoryTeam | undefined {
  return season.teams.find((team) => team.rosterId === rosterId);
}

export function getDraftPickNumber(round: number, draftSlot: number, teamCount: number): number {
  return getSnakeDraftPickNumber(round, draftSlot, teamCount);
}

export function buildKeeperLedger(seasons: DraftHistorySeason[]): KeeperLedgerEntry[] {
  const ledger = new Map<string, KeeperLedgerEntry>();

  seasons.forEach((season) => {
    season.picks
      .filter((pick) => pick.isKeeper)
      .forEach((pick) => {
        const team = getTeamForRoster(season, pick.rosterId);
        const teamName = team?.teamName ?? `Roster ${pick.rosterId.toString()}`;
        const designation: KeeperDesignation = {
          season: season.season,
          leagueId: season.leagueId,
          draftStatus: season.draftStatus,
          rosterId: pick.rosterId,
          teamName,
          managerName: team?.managerName ?? teamName,
          playerId: pick.playerId,
          playerName: pick.playerName,
          position: pick.position,
          nflTeam: pick.nflTeam,
          round: pick.round,
          pickNo: pick.pickNo,
        };
        const key = `${pick.rosterId.toString()}:${pick.playerId}`;
        const existing = ledger.get(key);
        if (existing) {
          existing.designations.push(designation);
        } else {
          ledger.set(key, {
            rosterId: pick.rosterId,
            teamName,
            playerId: pick.playerId,
            playerName: pick.playerName,
            position: pick.position,
            nflTeam: pick.nflTeam,
            designations: [designation],
          });
        }
      });
  });

  return Array.from(ledger.values())
    .map((entry) => {
      const designations = [...entry.designations].sort(
        (a, b) => Number(b.season) - Number(a.season),
      );
      const latest = designations.at(0);
      return {
        ...entry,
        teamName: latest?.teamName ?? entry.teamName,
        playerName: latest?.playerName ?? entry.playerName,
        position: latest?.position ?? entry.position,
        nflTeam: latest?.nflTeam ?? entry.nflTeam,
        designations,
      };
    })
    .sort((a, b) => {
      const latestA = Number(a.designations.at(0)?.season ?? 0);
      const latestB = Number(b.designations.at(0)?.season ?? 0);
      if (latestA !== latestB) return latestB - latestA;
      return a.playerName.localeCompare(b.playerName);
    });
}
