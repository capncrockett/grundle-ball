// frontend/src/sleeperBracket/types.ts
//
// Types for rendering Sleeper's playoff bracket format (winners_bracket /
// losers_bracket) directly, with no custom routing rules layered on top.

import type { SleeperPlayoffMatchup } from '../api/sleeper';

export type BracketSide =
  | { kind: 'team'; rosterId: number }
  | { kind: 'winner-of'; matchId: number }
  | { kind: 'loser-of'; matchId: number }
  | { kind: 'tbd' };

export interface ResolvedBracketMatchup {
  round: number;
  matchId: number;
  sideA: BracketSide;
  sideB: BracketSide;
  winnerRosterId: number | null;
  loserRosterId: number | null;
  /**
   * Placement within the bracket reported by Sleeper. The winner earns this
   * placement and the loser earns `placement + 1`; a consolation bracket
   * needs an offset to express overall league places.
   */
  placement: number | null;
  raw: SleeperPlayoffMatchup;
}
