// frontend/src/utils/playerGameStatus.test.ts

import { countFinishedPlayers } from './playerGameStatus';
import { mockSleeperPlayers } from '../test/fixtures/sleeper';
import { mockGameStatusMap } from '../test/fixtures/espn';

describe('playerGameStatus', () => {
  describe('countFinishedPlayers', () => {
    it('counts players whose games are complete', () => {
      const starterIds = ['player1', 'player2', 'player3']; // KC, BUF, MIA

      const result = countFinishedPlayers(starterIds, mockSleeperPlayers, mockGameStatusMap);

      // KC and MIA games complete, BUF still playing
      expect(result.total).toBe(3);
      expect(result.finished).toBe(2); // player1 (KC) and player3 (MIA)
    });

    it('returns all finished when all games complete', () => {
      const starterIds = ['player1', 'player3']; // KC, MIA (both complete)

      const result = countFinishedPlayers(starterIds, mockSleeperPlayers, mockGameStatusMap);

      expect(result.total).toBe(2);
      expect(result.finished).toBe(2);
    });

    it('returns zero finished when all games in progress', () => {
      const gameStatus = new Map([['BUF', false]]);
      const starterIds = ['player2']; // BUF (in progress)

      const result = countFinishedPlayers(starterIds, mockSleeperPlayers, gameStatus);

      expect(result.total).toBe(1);
      expect(result.finished).toBe(0);
    });

    it('treats unknown players as finished', () => {
      const starterIds = ['unknown_player'];

      const result = countFinishedPlayers(starterIds, mockSleeperPlayers, mockGameStatusMap);

      // Unknown player assumed finished
      expect(result.total).toBe(1);
      expect(result.finished).toBe(1);
    });

    it('treats players without teams as finished', () => {
      const playersWithoutTeam = {
        playerX: {
          player_id: 'playerX',
          team: null,
          position: 'RB',
          first_name: 'Free',
          last_name: 'Agent',
        },
      };
      const starterIds = ['playerX'];

      const result = countFinishedPlayers(starterIds, playersWithoutTeam, mockGameStatusMap);

      expect(result.total).toBe(1);
      expect(result.finished).toBe(1);
    });

    it('handles empty starters list', () => {
      const result = countFinishedPlayers([], mockSleeperPlayers, mockGameStatusMap);

      expect(result.total).toBe(0);
      expect(result.finished).toBe(0);
    });
  });
});
