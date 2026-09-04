import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { SleeperPlayer } from '../api/sleeper';
import { DRAFT_HISTORY } from '../data/draftHistory';
import { parseUdkAdpCsv, parseUdkRoundPick, resolveUdkAdpPlayers } from './udkAdp';

describe('UDK ADP source adapter', () => {
  it('converts 12-Team round-pick notation to overall pick values', () => {
    expect(parseUdkRoundPick('1.01', 12)).toBe(1);
    expect(parseUdkRoundPick('2.05', 12)).toBe(17);
    expect(parseUdkRoundPick('16.12', 12)).toBe(192);
    expect(parseUdkRoundPick('2.13', 12)).toBeNull();
    expect(parseUdkRoundPick('-', 12)).toBeNull();
  });

  it('parses quoted CSV fields and reports rows without ADP', () => {
    const csv = [
      '"Rank","Name","Team","Pos","Pos","Avg","Sleeper"',
      '"[object Object]","Smith, Jr.","SEA","WR","WR","2.05","2.06"',
      '"[object Object]","No ADP","FA","RB","RB","-","-"',
    ].join('\n');

    const result = parseUdkAdpCsv(csv, 12);

    expect(result.rows).toEqual([
      {
        sourceRank: 1,
        playerName: 'Smith, Jr.',
        nflTeam: 'SEA',
        position: 'WR',
        baselineAdp: 17,
        sourceRoundPick: '2.05',
      },
    ]);
    expect(result.skippedRows).toEqual([
      { sourceRank: 2, playerName: 'No ADP', reason: 'missing-adp' },
    ]);
  });

  it('resolves normalized names and uses Team to disambiguate Sleeper IDs', () => {
    const rows = parseUdkAdpCsv(
      [
        '"Rank","Name","Team","Pos","Pos","Avg"',
        '"x","Audric Estimé","NO","RB","RB","8.01"',
        '"x","Alex Smith","SEA","QB","QB","10.01"',
        '"x","James Cook III","BUF","RB","RB","2.01"',
        '"x","Hollywood Brown","KC","WR","WR","9.01"',
      ].join('\n'),
      12,
    ).rows;
    const players: Record<string, SleeperPlayer> = {
      estime: {
        player_id: 'estime',
        first_name: 'Audric',
        last_name: 'Estime',
        position: 'RB',
        team: 'NO',
      },
      alexSea: {
        player_id: 'alex-sea',
        first_name: 'Alex',
        last_name: 'Smith',
        position: 'QB',
        team: 'SEA',
      },
      alexOther: {
        player_id: 'alex-other',
        first_name: 'Alex',
        last_name: 'Smith',
        position: 'QB',
        team: 'OTHER',
      },
      cook: {
        player_id: 'cook',
        first_name: 'James',
        last_name: 'Cook',
        position: 'RB',
        team: 'BUF',
      },
      brown: {
        player_id: 'brown',
        first_name: 'Marquise',
        last_name: 'Brown',
        position: 'WR',
        team: 'KC',
      },
    };

    const result = resolveUdkAdpPlayers(rows, players);

    expect(result.players.map((player) => player.playerId)).toEqual([
      'estime',
      'alex-sea',
      'cook',
      'brown',
    ]);
    expect(result.unmatchedRows).toHaveLength(0);
    expect(result.ambiguousRows).toHaveLength(0);
  });

  it('parses the timestamped UDK snapshot checked into Draft Intel', () => {
    const path = resolve(
      process.cwd(),
      'src/data/adp/UDK - ADP Comparison - Fantasy Footballers Podcast - 2026-08-31_12-05-31_PDT.csv',
    );
    const csv = readFileSync(path, 'utf8');

    const result = parseUdkAdpCsv(csv, 12);

    expect(result.rows).toHaveLength(310);
    expect(result.skippedRows).toHaveLength(5);
    expect(result.rows[0]).toMatchObject({
      playerName: 'Jahmyr Gibbs',
      baselineAdp: 2,
      sourceRoundPick: '1.02',
    });

    const currentSeason = [...DRAFT_HISTORY.seasons]
      .sort((a, b) => Number(b.season) - Number(a.season))
      .at(0);
    const sourceNames = new Set(result.rows.map((row) => row.playerName));
    const missingKeepers =
      currentSeason?.picks
        .filter((pick) => pick.isKeeper)
        .filter((pick) => !sourceNames.has(pick.playerName)) ?? [];
    expect(missingKeepers).toEqual([]);
  });
});
