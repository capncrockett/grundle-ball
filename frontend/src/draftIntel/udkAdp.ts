import type { SleeperPlayer } from '../api/sleeper';
import type { BaselineAdpPlayer } from './keeperAdjustedAdp';

export type UdkAdpRow = {
  sourceRank: number;
  playerName: string;
  nflTeam: string | null;
  position: string;
  baselineAdp: number;
  sourceRoundPick: string;
};

export type UdkAdpSkippedRow = {
  sourceRank: number;
  playerName: string;
  reason: 'missing-adp' | 'invalid-adp' | 'missing-player-name';
};

export type UdkAdpParseResult = {
  rows: UdkAdpRow[];
  skippedRows: UdkAdpSkippedRow[];
};

export type UdkAdpResolution = {
  players: BaselineAdpPlayer[];
  unmatchedRows: UdkAdpRow[];
  ambiguousRows: Array<{
    row: UdkAdpRow;
    candidatePlayerIds: string[];
  }>;
};

const parseCsvRecords = (csv: string): string[][] => {
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    if (quoted) {
      if (character === '"') {
        if (csv[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ',') {
      record.push(field);
      field = '';
    } else if (character === '\n') {
      record.push(field);
      records.push(record);
      record = [];
      field = '';
    } else if (character !== '\r') {
      field += character;
    }
  }

  if (quoted) throw new Error('UDK ADP CSV contains an unterminated quoted field');
  if (field || record.length > 0) {
    record.push(field);
    records.push(record);
  }
  return records.filter((candidate) => candidate.some((value) => value.trim().length > 0));
};

const requiredColumn = (headers: string[], label: string): number => {
  const index = headers.indexOf(label);
  if (index === -1) throw new Error(`UDK ADP CSV is missing the ${label} column`);
  return index;
};

const normalizePosition = (position: string): string => {
  const normalized = position.trim().toUpperCase();
  return normalized === 'DST' || normalized === 'D/ST' ? 'DEF' : normalized;
};

export function parseUdkRoundPick(value: string, teamCount: number): number | null {
  const match = /^(\d+)\.(\d{1,2})$/.exec(value.trim());
  if (!match) return null;
  const round = Number(match[1]);
  const pickInRound = Number(match[2]);
  if (!Number.isInteger(round) || round < 1 || pickInRound < 1 || pickInRound > teamCount) {
    return null;
  }
  return (round - 1) * teamCount + pickInRound;
}

export function parseUdkAdpCsv(csv: string, teamCount: number): UdkAdpParseResult {
  const records = parseCsvRecords(csv);
  const rawHeaders = records.at(0);
  if (!rawHeaders) throw new Error('UDK ADP CSV is empty');
  const headers = rawHeaders.map((header) => header.replace(/^\uFEFF/, '').trim());
  const nameColumn = requiredColumn(headers, 'Name');
  const teamColumn = requiredColumn(headers, 'Team');
  const positionColumn = requiredColumn(headers, 'Pos');
  const averageColumn = requiredColumn(headers, 'Avg');
  const rows: UdkAdpRow[] = [];
  const skippedRows: UdkAdpSkippedRow[] = [];

  records.slice(1).forEach((record, index) => {
    const sourceRank = index + 1;
    const playerName = (record[nameColumn] ?? '').trim();
    const average = (record[averageColumn] ?? '').trim();
    if (!playerName) {
      skippedRows.push({ sourceRank, playerName: 'Unknown player', reason: 'missing-player-name' });
      return;
    }
    if (!average || average === '-') {
      skippedRows.push({ sourceRank, playerName, reason: 'missing-adp' });
      return;
    }
    const baselineAdp = parseUdkRoundPick(average, teamCount);
    if (baselineAdp === null) {
      skippedRows.push({ sourceRank, playerName, reason: 'invalid-adp' });
      return;
    }

    rows.push({
      sourceRank,
      playerName,
      nflTeam: (record[teamColumn] ?? '').trim().toUpperCase() || null,
      position: normalizePosition(record[positionColumn] ?? ''),
      baselineAdp,
      sourceRoundPick: average,
    });
  });

  return { rows, skippedRows };
}

const PLAYER_NAME_ALIASES: Record<string, string> = {
  hollywoodbrown: 'marquisebrown',
};

const normalizePlayerName = (name: string): string => {
  const normalized = name
    .replace(/\s+(?:jr\.?|sr\.?|ii|iii|iv|v)$/i, '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  return PLAYER_NAME_ALIASES[normalized] ?? normalized;
};

export function resolveUdkAdpPlayers(
  rows: UdkAdpRow[],
  sleeperPlayers: Record<string, SleeperPlayer>,
): UdkAdpResolution {
  const playersByName = new Map<string, SleeperPlayer[]>();
  Object.values(sleeperPlayers).forEach((player) => {
    const fullName = `${player.first_name} ${player.last_name}`.trim();
    const key = normalizePlayerName(fullName);
    if (!key) return;
    const current = playersByName.get(key) ?? [];
    current.push(player);
    playersByName.set(key, current);
  });

  const players: BaselineAdpPlayer[] = [];
  const unmatchedRows: UdkAdpRow[] = [];
  const ambiguousRows: UdkAdpResolution['ambiguousRows'] = [];

  rows.forEach((row) => {
    const nameCandidates = playersByName.get(normalizePlayerName(row.playerName)) ?? [];
    const positionCandidates = nameCandidates.filter(
      (player) => normalizePosition(player.position) === row.position,
    );
    let candidates = positionCandidates;
    if (candidates.length > 1 && row.nflTeam) {
      const teamCandidates = candidates.filter((player) => player.team === row.nflTeam);
      if (teamCandidates.length > 0) candidates = teamCandidates;
    }

    if (candidates.length === 0) {
      unmatchedRows.push(row);
      return;
    }
    if (candidates.length > 1) {
      ambiguousRows.push({
        row,
        candidatePlayerIds: candidates.map((player) => player.player_id).sort(),
      });
      return;
    }

    const player = candidates.at(0);
    if (!player) return;
    players.push({
      playerId: player.player_id,
      playerName: row.playerName,
      position: row.position,
      nflTeam: row.nflTeam,
      baselineAdp: row.baselineAdp,
      sourceRank: row.sourceRank,
    });
  });

  return { players, unmatchedRows, ambiguousRows };
}
