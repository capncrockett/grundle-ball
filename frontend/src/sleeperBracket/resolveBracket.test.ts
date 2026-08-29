import type { SleeperPlayoffMatchup } from '../api/sleeper';
import {
  describePlacementLabel,
  describeSideLabel,
  groupMatchupsByRound,
  resolveBracketMatchups,
} from './resolveBracket';

// Fixture mirrors the exact example from Sleeper's public API docs for a
// 6-team bracket (2 byes, R1, consolation, finals).
const SIX_TEAM_BRACKET: SleeperPlayoffMatchup[] = [
  { r: 1, m: 1, t1: 3, t2: 6, w: null, l: null },
  { r: 1, m: 2, t1: 4, t2: 5, w: null, l: null },
  { r: 2, m: 3, t1: 1, t2_from: { w: 1 }, w: null, l: null },
  { r: 2, m: 4, t1: 2, t2_from: { w: 2 }, w: null, l: null },
  { r: 2, m: 5, t1_from: { l: 1 }, t2_from: { l: 2 }, w: null, l: null, p: 5 },
  { r: 3, m: 6, t1_from: { w: 3 }, t2_from: { w: 4 }, w: null, l: null, p: 1 },
  { r: 3, m: 7, t1_from: { l: 3 }, t2_from: { l: 4 }, w: null, l: null, p: 3 },
];

describe('resolveBracketMatchups', () => {
  it('resolves direct team sides and placeholder winner/loser sides', () => {
    const resolved = resolveBracketMatchups(SIX_TEAM_BRACKET);

    expect(resolved).toHaveLength(7);

    const r1m1 = resolved.find((m) => m.matchId === 1);
    expect(r1m1?.sideA).toEqual({ kind: 'team', rosterId: 3 });
    expect(r1m1?.sideB).toEqual({ kind: 'team', rosterId: 6 });

    const r2m3 = resolved.find((m) => m.matchId === 3);
    expect(r2m3?.sideA).toEqual({ kind: 'team', rosterId: 1 });
    expect(r2m3?.sideB).toEqual({ kind: 'winner-of', matchId: 1 });

    const r2m5 = resolved.find((m) => m.matchId === 5);
    expect(r2m5?.sideA).toEqual({ kind: 'loser-of', matchId: 1 });
    expect(r2m5?.sideB).toEqual({ kind: 'loser-of', matchId: 2 });
    expect(r2m5?.placement).toBe(5);

    const finals = resolved.find((m) => m.matchId === 6);
    expect(finals?.placement).toBe(1);
  });

  it('sorts by round then match id regardless of input order', () => {
    const shuffled = [...SIX_TEAM_BRACKET].reverse();
    const resolved = resolveBracketMatchups(shuffled);

    expect(resolved.map((m) => [m.round, m.matchId])).toEqual([
      [1, 1],
      [1, 2],
      [2, 3],
      [2, 4],
      [2, 5],
      [3, 6],
      [3, 7],
    ]);
  });

  it('groups resolved matchups by round', () => {
    const grouped = groupMatchupsByRound(resolveBracketMatchups(SIX_TEAM_BRACKET));

    expect(grouped.map((g) => g.round)).toEqual([1, 2, 3]);
    expect(grouped[0].matchups).toHaveLength(2);
    expect(grouped[1].matchups).toHaveLength(3);
    expect(grouped[2].matchups).toHaveLength(2);
  });

  it('returns an empty list before the bracket has been seeded', () => {
    expect(resolveBracketMatchups([])).toEqual([]);
  });
});

describe('describeSideLabel', () => {
  it('describes placeholder sides and returns null for real teams', () => {
    expect(describeSideLabel({ kind: 'winner-of', matchId: 3 })).toBe('Winner of Game 3');
    expect(describeSideLabel({ kind: 'loser-of', matchId: 4 })).toBe('Loser of Game 4');
    expect(describeSideLabel({ kind: 'tbd' })).toBe('TBD');
    expect(describeSideLabel({ kind: 'team', rosterId: 1 })).toBeNull();
  });
});

describe('describePlacementLabel', () => {
  it('formats winner/loser placement pairs with ordinal suffixes', () => {
    expect(describePlacementLabel(1)).toBe('Decides 1st / 2nd');
    expect(describePlacementLabel(3)).toBe('Decides 3rd / 4th');
    expect(describePlacementLabel(5)).toBe('Decides 5th / 6th');
    expect(describePlacementLabel(11)).toBe('Decides 11th / 12th');
  });

  it('offsets consolation placements into overall league standings', () => {
    expect(describePlacementLabel(1, 6)).toBe('Decides 7th / 8th');
    expect(describePlacementLabel(5, 6)).toBe('Decides 11th / 12th');
  });

  it('returns null when there is no placement', () => {
    expect(describePlacementLabel(null)).toBeNull();
  });
});
