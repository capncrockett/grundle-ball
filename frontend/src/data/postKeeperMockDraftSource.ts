import { LEAGUE_ID } from '../config/league';

export type PostKeeperMockDraftSource = {
  name: string;
  leagueId: string;
  keeperLockedAt: string;
  batchCompletedAt: string;
  draftIds: readonly string[];
};

export const POST_KEEPER_MOCK_DRAFT_SOURCE: PostKeeperMockDraftSource = {
  name: '2026 Grundle post-lock Sleeper league mocks',
  leagueId: LEAGUE_ID,
  keeperLockedAt: '2026-08-31T00:00:54.000Z',
  batchCompletedAt: '2026-09-06T21:19:59.380Z',
  draftIds: [
    '1402351575594209280',
    '1402377180608008192',
    '1402377269229441024',
    '1402377312741150720',
    '1402377360572964864',
    '1402377396765655040',
    '1402377438150852608',
    '1402377481071124480',
    '1402377555721342976',
    '1402377586419445760',
  ],
};
