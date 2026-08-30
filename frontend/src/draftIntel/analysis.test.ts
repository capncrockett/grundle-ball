import type {
  DraftHistoryPick,
  DraftHistorySeason,
  DraftHistorySnapshot,
  DraftHistoryTeam,
} from '../data/draftHistoryTypes';
import { buildDraftIntelReport } from './analysis';

const teams: DraftHistoryTeam[] = [
  {
    rosterId: 1,
    ownerId: 'one',
    teamName: 'Alpha',
    managerName: 'Manager One',
    avatar: null,
  },
  {
    rosterId: 2,
    ownerId: 'two',
    teamName: 'Bravo',
    managerName: 'Manager Two',
    avatar: null,
  },
  {
    rosterId: 3,
    ownerId: 'three',
    teamName: 'Charlie',
    managerName: 'Manager Three',
    avatar: null,
  },
];

const pick = (
  rosterId: number,
  position: string,
  round: number,
  pickNo: number,
  isKeeper = false,
  nflTeam = rosterId === 1 ? 'SEA' : rosterId === 2 ? 'SF' : 'KC',
): DraftHistoryPick => ({
  playerId: `${rosterId.toString()}-${position}-${round.toString()}-${pickNo.toString()}`,
  playerName: `Player ${pickNo.toString()}`,
  position,
  nflTeam,
  rosterId,
  round,
  draftSlot: rosterId,
  pickNo,
  isKeeper,
});

const season = (
  year: string,
  draftStatus: DraftHistorySeason['draftStatus'],
  picks: DraftHistoryPick[],
): DraftHistorySeason => ({
  leagueId: `league-${year}`,
  season: year,
  leagueStatus: draftStatus === 'complete' ? 'complete' : 'pre_draft',
  draftId: `draft-${year}`,
  draftStatus,
  draftType: 'snake',
  startTime: null,
  rounds: 14,
  teamCount: 3,
  draftSlots: teams.map((team) => ({ draftSlot: team.rosterId, rosterId: team.rosterId })),
  teams,
  picks,
});

const completedPicks = (offset: number): DraftHistoryPick[] => [
  pick(1, 'RB', 1, offset + 1),
  pick(1, 'QB', 1, offset + 2, true),
  pick(1, 'QB', 3, offset + 3),
  pick(2, 'WR', 1, offset + 4),
  pick(2, 'QB', 4, offset + 5),
  pick(3, 'QB', 1, offset + 6),
  pick(1, 'K', 9, offset + 7),
  pick(2, 'K', 9, offset + 8),
  pick(3, 'K', 9, offset + 9),
];

const snapshot: DraftHistorySnapshot = {
  generatedAt: '2026-08-30T00:00:00.000Z',
  currentLeagueId: 'league-2024',
  seasons: [
    season('2024', 'pre_draft', [pick(1, 'QB', 1, 1)]),
    season('2023', 'complete', completedPicks(20)),
    season('2022', 'complete', completedPicks(10)),
    season('2021', 'complete', completedPicks(0)),
  ],
};

describe('buildDraftIntelReport', () => {
  it('analyzes completed drafts, excludes the scout team, and ignores keepers', () => {
    const report = buildDraftIntelReport(snapshot, {
      sinceSeason: '2021',
      excludedRosterId: 3,
    });

    expect(report.startSeason).toBe('2021');
    expect(report.endSeason).toBe('2023');
    expect(report.completedDraftCount).toBe(3);
    expect(report.includedTeamCount).toBe(2);
    expect(report.teams.map((team) => team.rosterId)).toEqual([1, 2]);

    expect(report.leaguePatterns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'league-backup-QB',
          description: '2/2 teams usually skip drafting a backup QB.',
          strength: 'strong',
        }),
        expect.objectContaining({
          id: 'league-timing-QB',
          description: '2/2 teams have never drafted a QB before Round 3.',
          strength: 'strong',
        }),
        expect.objectContaining({
          id: 'league-first-QB',
          description: 'The first QB has always gone in Round 3.',
        }),
      ]),
    );

    const orderedPatternIds = report.leaguePatterns.map((pattern) => pattern.id);
    expect(orderedPatternIds).toEqual(
      expect.arrayContaining(['league-rb-wr-first-five', 'league-backup-QB', 'league-backup-K']),
    );
    expect(orderedPatternIds.indexOf('league-rb-wr-first-five')).toBeLessThan(
      orderedPatternIds.indexOf('league-backup-QB'),
    );
    expect(orderedPatternIds.indexOf('league-backup-QB')).toBeLessThan(
      orderedPatternIds.indexOf('league-backup-K'),
    );

    const alpha = report.teams.find((team) => team.rosterId === 1);
    expect(alpha?.selectionCount).toBe(9);
    expect(alpha?.patterns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          description: 'Has never drafted a QB before Round 3.',
        }),
      ]),
    );
  });

  it('returns an empty report when no completed draft is in range', () => {
    const report = buildDraftIntelReport(snapshot, { sinceSeason: '2025' });

    expect(report.completedDraftCount).toBe(0);
    expect(report.startSeason).toBeNull();
    expect(report.endSeason).toBeNull();
    expect(report.leaguePatterns).toEqual([]);
  });

  it('names the Grundle Team behind each NFL-team affinity', () => {
    const nflTeams = [
      'SEA',
      'SF',
      'KC',
      'GB',
      'BUF',
      'NYJ',
      'PHI',
      'ATL',
      'CAR',
      'CLE',
      'DEN',
      'DET',
      'HOU',
      'IND',
      'JAX',
      'LAC',
      'LAR',
      'MIA',
      'MIN',
      'NE',
    ];
    const affinitySeason = (year: string, seasonIndex: number) => {
      let pickNo = 0;
      const picks = teams.flatMap((team) =>
        Array.from({ length: 10 }, (_, index) => {
          pickNo += 1;
          const isAlphaDallasPick = team.rosterId === 1 && index < 3;
          const isBaselineDallasPick =
            (team.rosterId === 2 && seasonIndex === 0 && index === 0) ||
            (team.rosterId === 3 && seasonIndex === 1 && index === 0);
          const nflTeam =
            isAlphaDallasPick || isBaselineDallasPick
              ? 'DAL'
              : nflTeams[(seasonIndex * 7 + team.rosterId * 3 + index) % nflTeams.length];
          return pick(
            team.rosterId,
            index % 2 === 0 ? 'RB' : 'WR',
            Math.floor(index / 3) + 1,
            pickNo,
            false,
            nflTeam,
          );
        }),
      );
      return season(year, 'complete', picks);
    };
    const affinitySnapshot: DraftHistorySnapshot = {
      generatedAt: '2026-08-30T00:00:00.000Z',
      currentLeagueId: 'league-2023',
      seasons: [affinitySeason('2023', 2), affinitySeason('2022', 1), affinitySeason('2021', 0)],
    };

    const report = buildDraftIntelReport(affinitySnapshot);

    expect(report.leaguePatterns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'league-nfl-DAL',
          description: 'Alpha frequently drafts Dallas Cowboys players.',
          rosterIds: [1],
        }),
      ]),
    );
  });

  it('quarantines forced 2024-2025 IDP picks and begins IDP evidence in 2026', () => {
    const idpPicks = (offset: number): DraftHistoryPick[] =>
      teams.map((team, index) => pick(team.rosterId, 'DL', 13, offset + index + 1));
    const forcedIdpSnapshot: DraftHistorySnapshot = {
      generatedAt: '2026-08-30T00:00:00.000Z',
      currentLeagueId: 'league-2025',
      seasons: [season('2025', 'complete', idpPicks(10)), season('2024', 'complete', idpPicks(0))],
    };

    const forcedReport = buildDraftIntelReport(forcedIdpSnapshot);

    expect(forcedReport.leaguePatterns.some((pattern) => pattern.badge === 'DL')).toBe(false);
    expect(forcedReport.teams.every((team) => team.selectionCount === 0)).toBe(true);

    let eligiblePickNo = 0;
    const eligibleIdpPicks = teams.flatMap((team) =>
      [
        { position: 'RB', round: 1 },
        { position: 'DL', round: 13 },
        { position: 'QB', round: 5 },
        { position: 'K', round: 12 },
      ].map(({ position, round }) => {
        eligiblePickNo += 1;
        return pick(team.rosterId, position, round, eligiblePickNo);
      }),
    );
    const eligibleIdpSnapshot: DraftHistorySnapshot = {
      generatedAt: '2027-08-30T00:00:00.000Z',
      currentLeagueId: 'league-2026',
      seasons: [season('2026', 'complete', eligibleIdpPicks)],
    };
    const eligibleReport = buildDraftIntelReport(eligibleIdpSnapshot);

    expect(eligibleReport.leaguePatterns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'league-backup-DL',
          strength: 'emerging',
        }),
      ]),
    );
    const orderedPatternIds = eligibleReport.leaguePatterns.map((pattern) => pattern.id);
    expect(orderedPatternIds).toEqual(
      expect.arrayContaining(['league-backup-DL', 'league-backup-QB', 'league-backup-K']),
    );
    expect(orderedPatternIds.indexOf('league-backup-DL')).toBeLessThan(
      orderedPatternIds.indexOf('league-backup-QB'),
    );
    expect(orderedPatternIds.indexOf('league-backup-QB')).toBeLessThan(
      orderedPatternIds.indexOf('league-backup-K'),
    );
  });
});
