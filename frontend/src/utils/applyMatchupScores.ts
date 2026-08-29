// frontend/src/utils/applyMatchupScores.ts

import type { SleeperMatchup } from '../api/sleeper';
import type { BracketSlot } from '../bracket/types';

/**
 * Applies matchup scores (current points) to bracket slots.
 *
 * For each bracket slot, finds the corresponding matchup data and updates
 * the positions with currentPoints.
 *
 * @param slots - Array of bracket slots
 * @param matchups - Array of Sleeper matchup data for the week
 * @param options - Optional filters (e.g., limit to specific rounds)
 * @returns New array of bracket slots with score data applied
 */
export function applyMatchupScoresToBracket(
  slots: BracketSlot[],
  matchups: SleeperMatchup[],
  options: { rounds?: BracketSlot['round'][] } = {},
): BracketSlot[] {
  const eligibleRounds = options.rounds ? new Set(options.rounds) : null;
  // Build a map of roster_id -> matchup data
  const matchupByRosterId = new Map<number, SleeperMatchup>();
  matchups.forEach((m) => {
    matchupByRosterId.set(m.roster_id, m);
  });

  return slots.map((slot) => {
    if (eligibleRounds && !eligibleRounds.has(slot.round)) {
      return slot;
    }
    const [top, bottom] = slot.positions;

    const updatePosition = (pos: BracketSlot['positions'][number]) => {
      if (!pos || pos.teamId == null) return pos;

      const matchup = matchupByRosterId.get(pos.teamId);
      if (!matchup) return pos;

      return {
        ...pos,
        currentPoints: matchup.points,
      };
    };

    const updatedTop = updatePosition(top);
    const updatedBottom = updatePosition(bottom);

    return {
      ...slot,
      positions: [updatedTop, updatedBottom],
    };
  });
}
