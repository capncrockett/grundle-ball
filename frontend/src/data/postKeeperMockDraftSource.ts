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
  batchCompletedAt: '2026-08-31T17:01:06.767Z',
  draftIds: [
    '1400182079936823296',
    '1400197523422842880',
    '1400197580876435456',
    '1400197632764227584',
    '1400197652271878144',
    '1400197689949298688',
    '1400197705308860416',
    '1400197718206316544',
    '1400197732676673536',
    '1400197747742654464',
  ],
};
