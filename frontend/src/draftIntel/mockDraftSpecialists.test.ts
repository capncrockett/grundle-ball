import type { SleeperPlayer } from '../api/sleeper';
import type { MockDraftSample } from './mockDraftAnalyzer';
import { buildMockDraftSpecialistPool, getDraftIntelPositionGroup } from './mockDraftSpecialists';

const sleeperPlayer = (
  playerId: string,
  firstName: string,
  lastName: string,
  position: string,
  team: string | null,
): SleeperPlayer => ({
  player_id: playerId,
  first_name: firstName,
  last_name: lastName,
  position,
  team,
});

describe('mock draft specialists', () => {
  it('groups Sleeper defensive position variants under IDP', () => {
    expect(getDraftIntelPositionGroup('DL')).toBe('IDP');
    expect(getDraftIntelPositionGroup('DE')).toBe('IDP');
    expect(getDraftIntelPositionGroup('OLB')).toBe('IDP');
    expect(getDraftIntelPositionGroup('S')).toBe('IDP');
    expect(getDraftIntelPositionGroup('D/ST')).toBe('DEF');
    expect(getDraftIntelPositionGroup('K')).toBe('K');
    expect(getDraftIntelPositionGroup('WR')).toBe('WR');
  });

  it('builds a deduplicated K, defense, and IDP pool from selected mocks', () => {
    const samples: MockDraftSample[] = [
      {
        draftId: 'mock-one',
        totalPicks: 12,
        picks: [
          { playerId: 'offense', pickNo: 1 },
          { playerId: 'kicker', pickNo: 8 },
          { playerId: 'MIN', pickNo: 9 },
          { playerId: 'edge', pickNo: 10 },
          { playerId: 'excluded-db', pickNo: 11 },
        ],
      },
      {
        draftId: 'mock-two',
        totalPicks: 12,
        picks: [
          { playerId: 'kicker', pickNo: 7 },
          { playerId: 'edge', pickNo: 12 },
        ],
      },
    ];
    const sleeperPlayers: Record<string, SleeperPlayer> = {
      offense: sleeperPlayer('offense', 'Wide', 'Receiver', 'WR', 'TST'),
      kicker: sleeperPlayer('kicker', 'Test', 'Kicker', 'K', 'TST'),
      MIN: sleeperPlayer('MIN', 'Minnesota', 'Vikings', 'DST', null),
      edge: sleeperPlayer('edge', 'Edge', 'Rusher', 'DE', 'TST'),
      'excluded-db': sleeperPlayer('excluded-db', 'Kept', 'Safety', 'S', 'TST'),
    };

    expect(buildMockDraftSpecialistPool(samples, sleeperPlayers, new Set(['excluded-db']))).toEqual(
      [
        {
          playerId: 'edge',
          playerName: 'Edge Rusher',
          position: 'DL',
          positionGroup: 'IDP',
          nflTeam: 'TST',
        },
        {
          playerId: 'MIN',
          playerName: 'Minnesota Vikings',
          position: 'DEF',
          positionGroup: 'DEF',
          nflTeam: 'MIN',
        },
        {
          playerId: 'kicker',
          playerName: 'Test Kicker',
          position: 'K',
          positionGroup: 'K',
          nflTeam: 'TST',
        },
      ],
    );
  });
});
