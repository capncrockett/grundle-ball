export type IdpTier = 1 | 2;
export type IdpArchetype = 'EDGE' | 'INTERIOR' | 'TACKLE';

export type IdpTierPlayer = {
  playerId: string;
  playerName: string;
  sourceRank: number;
  tier: IdpTier;
  archetype: IdpArchetype;
};

export type IdpTierSource = {
  name: string;
  sourceUrl: string;
  publishedOn: string;
  retrievedOn: string;
  players: readonly IdpTierPlayer[];
};

export const IDP_TIER_SOURCE: IdpTierSource = {
  name: 'FantasyPros - Scott Bogman 2026 IDP Rankings & Tiers',
  sourceUrl: 'https://www.fantasypros.com/2026/06/fantasy-football-idp-rankings-tiers-2026/',
  publishedOn: '2026-06-16',
  retrievedOn: '2026-09-01',
  players: [
    { playerId: '3973', playerName: 'Myles Garrett', sourceRank: 1, tier: 1, archetype: 'EDGE' },
    {
      playerId: '8289',
      playerName: 'Aidan Hutchinson',
      sourceRank: 2,
      tier: 1,
      archetype: 'EDGE',
    },
    { playerId: '5991', playerName: 'Maxx Crosby', sourceRank: 3, tier: 1, archetype: 'EDGE' },
    { playerId: '5862', playerName: 'Brian Burns', sourceRank: 4, tier: 1, archetype: 'EDGE' },
    {
      playerId: '10892',
      playerName: 'Will Anderson Jr.',
      sourceRank: 5,
      tier: 1,
      archetype: 'EDGE',
    },
    {
      playerId: '6949',
      playerName: 'Jordyn Brooks',
      sourceRank: 6,
      tier: 1,
      archetype: 'TACKLE',
    },
    {
      playerId: '10880',
      playerName: 'Jack Campbell',
      sourceRank: 7,
      tier: 1,
      archetype: 'TACKLE',
    },
    {
      playerId: '12578',
      playerName: 'Carson Schwesinger',
      sourceRank: 8,
      tier: 1,
      archetype: 'TACKLE',
    },
    {
      playerId: '4960',
      playerName: 'Roquan Smith',
      sourceRank: 9,
      tier: 1,
      archetype: 'TACKLE',
    },
    { playerId: '4070', playerName: 'T.J. Watt', sourceRank: 10, tier: 1, archetype: 'EDGE' },
    {
      playerId: '2393',
      playerName: 'Danielle Hunter',
      sourceRank: 11,
      tier: 1,
      archetype: 'EDGE',
    },
    {
      playerId: '13375',
      playerName: 'Sonny Styles',
      sourceRank: 12,
      tier: 2,
      archetype: 'TACKLE',
    },
    {
      playerId: '11742',
      playerName: 'Cedric Gray',
      sourceRank: 13,
      tier: 2,
      archetype: 'TACKLE',
    },
    { playerId: '6815', playerName: 'Zack Baun', sourceRank: 14, tier: 2, archetype: 'TACKLE' },
    { playerId: '5816', playerName: 'Nick Bosa', sourceRank: 15, tier: 2, archetype: 'EDGE' },
    { playerId: '5041', playerName: 'Fred Warner', sourceRank: 16, tier: 2, archetype: 'TACKLE' },
    {
      playerId: '6125',
      playerName: 'Jeffery Simmons',
      sourceRank: 17,
      tier: 2,
      archetype: 'INTERIOR',
    },
    {
      playerId: '6217',
      playerName: 'Blake Cashman',
      sourceRank: 18,
      tier: 2,
      archetype: 'TACKLE',
    },
    {
      playerId: '5332',
      playerName: 'Foyesade Oluokun',
      sourceRank: 19,
      tier: 2,
      archetype: 'TACKLE',
    },
    {
      playerId: '7841',
      playerName: 'Jamien Sherwood',
      sourceRank: 20,
      tier: 2,
      archetype: 'TACKLE',
    },
    { playerId: '10917', playerName: 'Byron Young', sourceRank: 21, tier: 2, archetype: 'EDGE' },
    { playerId: '11665', playerName: 'Jared Verse', sourceRank: 22, tier: 2, archetype: 'EDGE' },
    {
      playerId: '10898',
      playerName: 'Tuli Tuipulotu',
      sourceRank: 23,
      tier: 2,
      archetype: 'EDGE',
    },
    { playerId: '8266', playerName: 'Quay Walker', sourceRank: 24, tier: 2, archetype: 'TACKLE' },
    {
      playerId: '7672',
      playerName: 'Ernest Jones IV',
      sourceRank: 25,
      tier: 2,
      archetype: 'TACKLE',
    },
    {
      playerId: '6183',
      playerName: 'Andrew Van Ginkel',
      sourceRank: 26,
      tier: 2,
      archetype: 'EDGE',
    },
    { playerId: '8280', playerName: 'Nik Bonitto', sourceRank: 27, tier: 2, archetype: 'EDGE' },
    {
      playerId: '7113',
      playerName: 'Alex Highsmith',
      sourceRank: 28,
      tier: 2,
      archetype: 'EDGE',
    },
  ],
};
