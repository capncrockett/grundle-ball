import matchupHistoryData from './matchupHistoryStore.json';
import type { MatchupHistory, MatchupHistoryScope, StoredMatchup } from './matchupHistoryTypes';

export const MATCHUP_HISTORY: MatchupHistory = matchupHistoryData;

export const normalizeTeamName = (name: string): string => name.replace(/’/g, "'").toLowerCase();

export function selectMatchupsForScope(
  matchups: MatchupHistory,
  scope: MatchupHistoryScope,
): MatchupHistory {
  return matchups.filter(
    (matchup) => matchup.leagueId === scope.leagueId && matchup.season === scope.season,
  );
}

export function getStoredMatchups(scope: MatchupHistoryScope): MatchupHistory {
  return selectMatchupsForScope(MATCHUP_HISTORY, scope);
}

export function getLatestRecordedWeek(matchups: MatchupHistory): number | null {
  if (matchups.length === 0) return null;
  return matchups.reduce((max, m) => Math.max(max, m.week), 0);
}

export function getLatestCompletedWeek(matchups: MatchupHistory): number | null {
  if (matchups.length === 0) return null;

  const groupedByWeek = new Map<number, StoredMatchup[]>();
  matchups.forEach((m) => {
    const existing = groupedByWeek.get(m.week) ?? [];
    existing.push(m);
    groupedByWeek.set(m.week, existing);
  });

  const completedWeeks = Array.from(groupedByWeek.entries())
    .filter(([, games]) => games.every((game) => game.finished))
    .map(([week]) => week);

  if (completedWeeks.length === 0) return null;

  return completedWeeks.reduce((max, week) => Math.max(max, week), completedWeeks[0]);
}

export function getMatchupMarginsForWeek(
  week: number,
  matchups: MatchupHistory,
): Map<string, number> {
  const margins = new Map<string, number>();

  matchups
    .filter((m) => m.week === week)
    .forEach((m) => {
      margins.set(m.team, m.margin);
      margins.set(normalizeTeamName(m.team), m.margin);
    });
  return margins;
}

export function findMatchupForTeam(
  teamName: string,
  options: { week?: number; matchups: MatchupHistory },
): StoredMatchup | undefined {
  const { matchups } = options;
  const normalized = normalizeTeamName(teamName);

  const choose = (candidates: MatchupHistory): StoredMatchup | undefined => {
    const direct = candidates.find((m) => normalizeTeamName(m.team) === normalized);
    return direct ?? candidates[0];
  };

  const byWeek = matchups.filter(
    (m) =>
      (options.week === undefined || m.week === options.week) &&
      (normalizeTeamName(m.team) === normalized || normalizeTeamName(m.opponent) === normalized),
  );
  if (byWeek.length > 0) return choose(byWeek);

  const anyWeek = matchups.filter(
    (m) => normalizeTeamName(m.team) === normalized || normalizeTeamName(m.opponent) === normalized,
  );
  if (anyWeek.length > 0) return choose(anyWeek);

  return undefined;
}
