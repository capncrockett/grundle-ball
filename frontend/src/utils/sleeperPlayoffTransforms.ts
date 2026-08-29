// frontend/src/utils/sleeperPlayoffTransforms.ts

import type { SleeperPlayoffMatchup } from '../api/sleeper';
import type { BracketGameOutcome } from '../bracket/state';
import type { BracketSlot, BracketSlotId } from '../bracket/types';

/**
 * Maps Sleeper's playoff bracket structure to our custom bracket slot IDs.
 *
 * Sleeper structure:
 * - Winners bracket: Champ Bowl (r1: matchups 1-2, r2: 3-5, r3: 6-7)
 * - Losers bracket: Toilet Bowl (r1: matchups 1-2, r2: 3-5, r3: 6-7)
 * - Keeper Bowl is fed by losers from Champ Bowl (handled via routing rules)
 */

/**
 * Maps Sleeper matchup identifiers to our BracketSlotIds
 */
const SLEEPER_TO_BRACKET_MAP: Partial<Record<string, BracketSlotId>> = {
  // Winners Bracket (Champ Bowl)
  winners_r1_m1: 'champ_r1_g2', // 3 vs 6
  winners_r1_m2: 'champ_r1_g1', // 4 vs 5
  winners_r2_m3: 'champ_r2_g1', // 9 vs winner of m1 -> seed 1 vs winner of R1G1
  winners_r2_m4: 'champ_r2_g2', // 12 vs winner of m2 -> seed 2 vs winner of R1G2
  winners_r2_m5: 'champ_3rd', // loser of m1 vs loser of m2 -> 3rd place game
  winners_r3_m6: 'champ_finals', // winner of m3 vs winner of m4
  winners_r3_m7: 'champ_3rd', // This appears to be duplicate? Need to verify

  // Losers Bracket (Toilet Bowl)
  losers_r1_m1: 'toilet_r1_g1', // 8 vs 9
  losers_r1_m2: 'toilet_r1_g2', // 7 vs 10
  losers_r2_m3: 'toilet_r2_g1', // 10 vs winner of m1 -> seed 12 vs winner
  losers_r2_m4: 'toilet_r2_g2', // 5 vs winner of m2 -> seed 11 vs winner
  losers_r2_m5: 'toilet_9th_10th', // loser of m1 vs loser of m2
  losers_r3_m6: 'toilet_finals', // Poop King final
  losers_r3_m7: 'toilet_9th_10th', // This appears to be duplicate?
};

function makeMatchupKey(bracket: 'winners' | 'losers', round: number, matchup: number): string {
  return `${bracket}_r${round.toString()}_m${matchup.toString()}`;
}

/**
 * Converts Sleeper playoff matchups to BracketGameOutcomes.
 *
 * @param winnersBracket - Array of matchups from Sleeper's winners_bracket endpoint
 * @param losersBracket - Array of matchups from Sleeper's losers_bracket endpoint
 * @returns Array of game outcomes with slotId and winnerIndex for completed games
 */
export function toBracketGameOutcomes(
  winnersBracket: SleeperPlayoffMatchup[],
  losersBracket: SleeperPlayoffMatchup[],
  slots?: BracketSlot[],
): BracketGameOutcome[] {
  const outcomes: BracketGameOutcome[] = [];

  const processMatchup = (matchup: SleeperPlayoffMatchup, bracket: 'winners' | 'losers') => {
    // Skip if game hasn't been played yet
    if (matchup.w == null) {
      return;
    }

    const key = makeMatchupKey(bracket, matchup.r, matchup.m);
    const slotId = SLEEPER_TO_BRACKET_MAP[key];

    if (!slotId) {
      console.warn(`No bracket slot mapping found for ${key}`);
      return;
    }

    // Determine which position (0 or 1) won
    // t1 is position 0 (top/left), t2 is position 1 (bottom/right)
    let winnerIndex: 0 | 1 = matchup.w === matchup.t1 ? 0 : 1;

    if (slots) {
      const slot = slots.find((candidate) => candidate.id === slotId);
      const matchingIndex = slot?.positions.findIndex((pos) => pos?.teamId === matchup.w);
      if (matchingIndex === 0 || matchingIndex === 1) {
        winnerIndex = matchingIndex;
      }
    }

    outcomes.push({
      slotId,
      winnerIndex,
    });
  };

  // Process all matchups from both brackets
  winnersBracket.forEach((m) => {
    processMatchup(m, 'winners');
  });
  losersBracket.forEach((m) => {
    processMatchup(m, 'losers');
  });

  return outcomes;
}
