// frontend/src/sleeperBracket/resolveBracket.ts
//
// Converts Sleeper's raw winners_bracket/losers_bracket response into a
// resolved, render-ready list of matchups - sorted by round then match id.
//
// This intentionally does NOT apply any custom routing: it is a direct,
// generic mirror of whatever bracket shape Sleeper itself computed (byes,
// consolation games, placements) via `t1`/`t2`/`t1_from`/`t2_from`/`w`/`l`/`p`.

import type { SleeperPlayoffMatchup } from '../api/sleeper';
import type { BracketSide, ResolvedBracketMatchup } from './types';

function resolveSide(
  teamId: number | undefined,
  from: { w?: number; l?: number } | null | undefined,
): BracketSide {
  if (teamId != null) return { kind: 'team', rosterId: teamId };
  if (from?.w != null) return { kind: 'winner-of', matchId: from.w };
  if (from?.l != null) return { kind: 'loser-of', matchId: from.l };
  return { kind: 'tbd' };
}

export function resolveBracketMatchups(raw: SleeperPlayoffMatchup[]): ResolvedBracketMatchup[] {
  return raw
    .map((matchup) => ({
      round: matchup.r,
      matchId: matchup.m,
      sideA: resolveSide(matchup.t1, matchup.t1_from),
      sideB: resolveSide(matchup.t2, matchup.t2_from),
      winnerRosterId: matchup.w ?? null,
      loserRosterId: matchup.l ?? null,
      placement: matchup.p ?? null,
      raw: matchup,
    }))
    .sort((a, b) => a.round - b.round || a.matchId - b.matchId);
}

export interface BracketRoundGroup {
  round: number;
  matchups: ResolvedBracketMatchup[];
}

export function groupMatchupsByRound(matchups: ResolvedBracketMatchup[]): BracketRoundGroup[] {
  const rounds = new Map<number, ResolvedBracketMatchup[]>();
  matchups.forEach((matchup) => {
    const list = rounds.get(matchup.round) ?? [];
    list.push(matchup);
    rounds.set(matchup.round, list);
  });
  return Array.from(rounds.entries())
    .sort(([a], [b]) => a - b)
    .map(([round, list]) => ({ round, matchups: list }));
}

/** Human label for a placeholder side that isn't decided yet. */
export function describeSideLabel(side: BracketSide): string | null {
  switch (side.kind) {
    case 'winner-of':
      return `Winner of Game ${String(side.matchId)}`;
    case 'loser-of':
      return `Loser of Game ${String(side.matchId)}`;
    case 'tbd':
      return 'TBD';
    default:
      return null;
  }
}

function ordinalSuffix(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return 'th';
  switch (n % 10) {
    case 1:
      return 'st';
    case 2:
      return 'nd';
    case 3:
      return 'rd';
    default:
      return 'th';
  }
}

/** Human label for what a matchup decides, when Sleeper marks a placement. */
export function describePlacementLabel(placement: number | null, offset = 0): string | null {
  if (placement == null) return null;
  const winnerPlacement = placement + offset;
  const loserPlacement = winnerPlacement + 1;
  return `Decides ${String(winnerPlacement)}${ordinalSuffix(winnerPlacement)} / ${String(loserPlacement)}${ordinalSuffix(loserPlacement)}`;
}
