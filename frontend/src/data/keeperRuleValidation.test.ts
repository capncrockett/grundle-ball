import type { DraftHistoryPick, DraftHistorySeason } from './draftHistoryTypes';
import { DRAFT_HISTORY } from './draftHistory';
import {
  findKeeperRuleViolations,
  getCurrentKeeperCycleLength,
  MAX_CONSECUTIVE_KEEPER_SEASONS,
  MAX_KEEPERS_PER_TEAM,
} from './keeperRuleValidation';

const keeperPick = (
  playerId: string,
  playerName: string,
  rosterId = 1,
  pickNo = 1,
): DraftHistoryPick => ({
  playerId,
  playerName,
  position: 'WR',
  nflTeam: 'SEA',
  rosterId,
  round: 1,
  draftSlot: rosterId,
  pickNo,
  isKeeper: true,
});

const season = (
  year: string,
  picks: DraftHistoryPick[],
  draftStatus: DraftHistorySeason['draftStatus'] = 'complete',
): DraftHistorySeason => ({
  leagueId: `league-${year}`,
  season: year,
  leagueStatus: draftStatus === 'complete' ? 'complete' : 'pre_draft',
  draftId: `draft-${year}`,
  draftStatus,
  draftType: 'snake',
  startTime: null,
  rounds: 16,
  teamCount: 2,
  draftSlots: [
    { draftSlot: 1, rosterId: 1 },
    { draftSlot: 2, rosterId: 2 },
  ],
  teams: [
    {
      rosterId: 1,
      ownerId: 'user-a',
      teamName: 'Alpha Team',
      managerName: 'Alpha Manager',
      avatar: null,
    },
    {
      rosterId: 2,
      ownerId: 'user-b',
      teamName: 'Beta Team',
      managerName: 'Beta Manager',
      avatar: null,
    },
  ],
  picks,
});

describe('keeper rule validation', () => {
  it('allows exactly two current keepers and two consecutive keeper seasons', () => {
    const current = season(
      '2026',
      [keeperPick('player-a', 'Alpha Player'), keeperPick('player-b', 'Beta Receiver', 1, 2)],
      'pre_draft',
    );
    const prior = season('2025', [keeperPick('player-a', 'Alpha Player')]);

    expect(findKeeperRuleViolations([current, prior])).toEqual([]);
  });

  it('flags a Team with more than two current keepers', () => {
    const current = season(
      '2026',
      [
        keeperPick('player-a', 'Alpha Player'),
        keeperPick('player-b', 'Beta Receiver', 1, 2),
        keeperPick('player-c', 'Charlie Runner', 1, 3),
      ],
      'pre_draft',
    );

    expect(findKeeperRuleViolations([current])).toContainEqual({
      code: 'team-keeper-limit',
      season: '2026',
      rosterId: 1,
      teamName: 'Alpha Team',
      keeperCount: 3,
      limit: MAX_KEEPERS_PER_TEAM,
    });
  });

  it('flags a third consecutive keeper season for the same Team', () => {
    const current = season('2026', [keeperPick('player-a', 'Alpha Player')], 'pre_draft');
    const prior = season('2025', [keeperPick('player-a', 'Alpha Player')]);
    const older = season('2024', [keeperPick('player-a', 'Alpha Player')]);

    expect(findKeeperRuleViolations([current, prior, older])).toEqual([
      {
        code: 'team-player-cycle-limit',
        season: '2026',
        rosterId: 1,
        teamName: 'Alpha Team',
        playerId: 'player-a',
        playerName: 'Alpha Player',
        keeperCycleLength: 3,
        limit: MAX_CONSECUTIVE_KEEPER_SEASONS,
      },
    ]);
  });

  it('starts a new Keeper Cycle after a season without a designation', () => {
    const current = season('2026', [keeperPick('player-a', 'Alpha Player')], 'pre_draft');
    const gap = season('2025', [{ ...keeperPick('player-a', 'Alpha Player'), isKeeper: false }]);
    const earlierCycleSecond = season('2024', [keeperPick('player-a', 'Alpha Player')]);
    const earlierCycleFirst = season('2023', [keeperPick('player-a', 'Alpha Player')]);

    expect(findKeeperRuleViolations([current, gap, earlierCycleSecond, earlierCycleFirst])).toEqual(
      [],
    );
    expect(
      getCurrentKeeperCycleLength(
        [current, gap, earlierCycleSecond, earlierCycleFirst],
        1,
        'player-a',
      ),
    ).toBe(1);
  });

  it('honors the accepted Patrick Mahomes gap precedent in canonical history', () => {
    const seasonsThrough2024 = DRAFT_HISTORY.seasons
      .filter((entry) => Number(entry.season) <= 2024)
      .sort((a, b) => Number(b.season) - Number(a.season));
    const mahomes = seasonsThrough2024
      .at(0)
      ?.picks.find((pick) => pick.playerName === 'Patrick Mahomes');

    expect(mahomes).toBeDefined();
    if (!mahomes) throw new Error('Patrick Mahomes is missing from the 2024 Canonical Draft');
    const keeperSeasons = seasonsThrough2024
      .filter((entry) =>
        entry.picks.some(
          (pick) =>
            pick.isKeeper &&
            pick.rosterId === mahomes.rosterId &&
            pick.playerId === mahomes.playerId,
        ),
      )
      .map((entry) => entry.season);

    expect(keeperSeasons).toEqual(['2024', '2023', '2020']);
    expect(
      getCurrentKeeperCycleLength(seasonsThrough2024, mahomes.rosterId, mahomes.playerId),
    ).toBe(2);
    expect(
      findKeeperRuleViolations(seasonsThrough2024).some(
        (violation) =>
          violation.code === 'team-player-cycle-limit' && violation.playerId === mahomes.playerId,
      ),
    ).toBe(false);
  });
});
