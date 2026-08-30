// src/bracket/state.ts

import type { BracketSlotId, BracketSlot } from './types';
import { ROUTING_RULES } from './routingRules';
import type { BracketRoutingRule } from './types';

export interface BracketGameOutcome {
  /** Slot where the game was played. */
  slotId: BracketSlotId;
  /** Index of the winner in that slot's positions: 0 = top/left, 1 = bottom/right. */
  winnerIndex: 0 | 1;
}

/**
 * Apply a set of game outcomes to a bracket using the routing rules.
 *
 * This does NOT decide who wins - you tell it who won each from-slot,
 * and it will:
 *  - find the routing rule for that slot
 *  - copy the winner into the target winner slot/index
 *  - copy the loser into the target loser slot/index (if configured)
 *
 * It returns a NEW array of BracketSlot, leaving the input untouched.
 */
export function applyGameOutcomesToBracket(
  slots: BracketSlot[],
  outcomes: BracketGameOutcome[],
  rules: BracketRoutingRule[] = ROUTING_RULES,
): BracketSlot[] {
  // Make a mutable clone of slots, including a shallow copy of positions
  const nextSlots = slots.map((slot) => ({
    ...slot,
    positions: [...slot.positions] as typeof slot.positions,
  }));

  const slotById = new Map<BracketSlotId, BracketSlot>();
  nextSlots.forEach((slot) => {
    slotById.set(slot.id, slot);
  });

  const ruleByFromId = new Map<BracketSlotId, BracketRoutingRule>();
  rules.forEach((rule) => {
    ruleByFromId.set(rule.fromSlotId, rule);
  });

  for (const outcome of outcomes) {
    const fromSlot = slotById.get(outcome.slotId);
    if (!fromSlot) continue;

    const routingRule = ruleByFromId.get(outcome.slotId);
    if (!routingRule) continue;

    const winnerRef = fromSlot.positions[outcome.winnerIndex];
    const loserIndex: 0 | 1 = outcome.winnerIndex === 0 ? 1 : 0;
    const loserRef = fromSlot.positions[loserIndex];

    // Route winner
    if (winnerRef && routingRule.winnerGoesTo) {
      const target = slotById.get(routingRule.winnerGoesTo.slotId);
      if (target) {
        const idx = routingRule.winnerGoesTo.positionIndex;
        const newPositions = [...target.positions] as typeof target.positions;

        newPositions[idx] = {
          // keep any existing metadata on the target position (if needed)
          ...(newPositions[idx] ?? {}),
          ...winnerRef,
        };

        target.positions = newPositions;
      }
    }

    // Route loser
    if (loserRef && routingRule.loserGoesTo) {
      const target = slotById.get(routingRule.loserGoesTo.slotId);
      if (target) {
        const idx = routingRule.loserGoesTo.positionIndex;
        const newPositions = [...target.positions] as typeof target.positions;

        newPositions[idx] = {
          ...(newPositions[idx] ?? {}),
          ...loserRef,
        };

        target.positions = newPositions;
      }
    }
  }

  return nextSlots;
}
