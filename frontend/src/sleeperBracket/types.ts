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
   * When Sleeper marks a matchup with a placement (e.g. `p: 1` for the
   * championship), the winner earns that placement and the loser earns
   * `placement + 1`.
   */
  placement: number | null;
  raw: SleeperPlayoffMatchup;
}
