import type { BracketSlot } from '../bracket/types';
import type { SleeperMatchup } from '../api/sleeper';
import { applyMatchupScoresToBracket } from './applyMatchupScores';

describe('applyMatchupScoresToBracket', () => {
  it('applies scores only to eligible rounds', () => {
    const slots: BracketSlot[] = [
      {
        id: 'champ_r1_g1',
        bracketId: 'champ',
        round: 'champ_round_1',
        label: 'R1',
        positions: [{ teamId: 1 }, { teamId: 2 }],
      },
      {
        id: 'champ_r2_g1',
        bracketId: 'champ',
        round: 'champ_round_2',
        label: 'R2',
        positions: [{ teamId: 3 }, { teamId: 4 }],
      },
    ];

    const matchups: SleeperMatchup[] = [
      { roster_id: 1, matchup_id: 1, points: 100, starters: [], players: [] },
      { roster_id: 2, matchup_id: 1, points: 90, starters: [], players: [] },
      { roster_id: 3, matchup_id: 2, points: 80, starters: [], players: [] },
      { roster_id: 4, matchup_id: 2, points: 70, starters: [], players: [] },
    ];

    const updated = applyMatchupScoresToBracket(slots, matchups, {
      rounds: ['champ_round_1'],
    });

    expect(updated[0].positions[0]?.currentPoints).toBe(100);
    expect(updated[0].positions[1]?.currentPoints).toBe(90);
    expect(updated[1].positions[0]?.currentPoints).toBeUndefined();
    expect(updated[1].positions[1]?.currentPoints).toBeUndefined();
  });

  it('prefers a manually-edited custom_points score over the raw computed points', () => {
    const slots: BracketSlot[] = [
      {
        id: 'champ_r1_g1',
        bracketId: 'champ',
        round: 'champ_round_1',
        label: 'R1',
        positions: [{ teamId: 1 }, { teamId: 2 }],
      },
    ];

    const matchups: SleeperMatchup[] = [
      {
        roster_id: 1,
        matchup_id: 1,
        points: 135.8,
        custom_points: 113.98,
        starters: [],
        players: [],
      },
      { roster_id: 2, matchup_id: 1, points: 118.06, starters: [], players: [] },
    ];

    const updated = applyMatchupScoresToBracket(slots, matchups, {
      rounds: ['champ_round_1'],
    });

    expect(updated[0].positions[0]?.currentPoints).toBe(113.98);
    expect(updated[0].positions[1]?.currentPoints).toBe(118.06);
  });
});
