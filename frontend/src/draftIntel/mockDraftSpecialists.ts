import type { SleeperPlayer } from '../api/sleeper';
import type { MockDraftSample } from './mockDraftAnalyzer';

export type MockDraftSpecialistGroup = 'K' | 'DEF' | 'IDP';

export type MockDraftSpecialistPlayer = {
  playerId: string;
  playerName: string;
  position: string;
  positionGroup: MockDraftSpecialistGroup;
  nflTeam: string | null;
};

const IDP_POSITIONS = new Set(['DL', 'LB', 'DB']);

const canonicalizePosition = (position: string): string => {
  const normalized = position.trim().toUpperCase();
  if (normalized === 'DST' || normalized === 'D/ST') return 'DEF';
  if (normalized === 'DE' || normalized === 'DT' || normalized === 'NT' || normalized === 'EDGE') {
    return 'DL';
  }
  if (normalized === 'ILB' || normalized === 'OLB') return 'LB';
  if (normalized === 'CB' || normalized === 'S') return 'DB';
  return normalized;
};

export const getDraftIntelPositionGroup = (position: string): string => {
  const canonicalPosition = canonicalizePosition(position);
  return IDP_POSITIONS.has(canonicalPosition) ? 'IDP' : canonicalPosition;
};

export function buildMockDraftSpecialistPool(
  samples: MockDraftSample[],
  sleeperPlayers: Record<string, SleeperPlayer>,
  excludedPlayerIds: ReadonlySet<string> = new Set(),
): MockDraftSpecialistPlayer[] {
  const selectedPlayerIds = new Set(
    samples.flatMap((sample) => sample.picks.map((pick) => pick.playerId)),
  );
  const sleeperPlayersById = new Map(
    Object.values(sleeperPlayers).map((player) => [player.player_id, player]),
  );

  return Array.from(selectedPlayerIds)
    .filter((playerId) => !excludedPlayerIds.has(playerId))
    .map((playerId) => {
      const player = sleeperPlayersById.get(playerId);
      if (!player) return null;
      const position = canonicalizePosition(player.position);
      const positionGroup = getDraftIntelPositionGroup(position);
      if (positionGroup !== 'K' && positionGroup !== 'DEF' && positionGroup !== 'IDP') {
        return null;
      }

      const playerName = `${player.first_name} ${player.last_name}`.trim() || playerId;
      return {
        playerId,
        playerName,
        position,
        positionGroup,
        nflTeam: player.team ?? (positionGroup === 'DEF' ? playerId : null),
      } satisfies MockDraftSpecialistPlayer;
    })
    .filter((player): player is MockDraftSpecialistPlayer => player !== null)
    .sort(
      (a, b) => a.playerName.localeCompare(b.playerName) || a.playerId.localeCompare(b.playerId),
    );
}
