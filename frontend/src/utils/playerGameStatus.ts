// frontend/src/utils/playerGameStatus.ts

import type { SleeperPlayer } from '../api/sleeper';

/**
 * Counts how many players in a starters array have finished their games
 * @param starterIds - Array of player IDs from SleeperMatchup.starters
 * @param playersById - Map of player_id to SleeperPlayer
 * @param teamGameStatus - Map of NFL team abbreviation to whether game is complete
 * @returns Object with total starters and count of finished games
 */
export function countFinishedPlayers(
  starterIds: string[],
  playersById: Record<string, SleeperPlayer | undefined>,
  teamGameStatus: Map<string, boolean>,
): { total: number; finished: number } {
  let finished = 0;
  const total = starterIds.length;

  for (const playerId of starterIds) {
    const player = playersById[playerId];

    if (!player || !player.team) {
      // Player not found or doesn't have a team (e.g., free agent)
      // Assume their game is complete if we can't determine status
      finished++;
      continue;
    }

    const isGameComplete = teamGameStatus.get(player.team) ?? false;

    if (isGameComplete) {
      finished++;
    }
  }

  return { total, finished };
}
