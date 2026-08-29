// frontend/src/api/espn.ts

const ESPN_BASE_URL = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl';

export interface ESPNCompetitor {
  team: {
    abbreviation: string;
    displayName: string;
  };
}

export interface ESPNCompetition {
  competitors: ESPNCompetitor[];
  status: {
    type: {
      name: string; // "STATUS_SCHEDULED", "STATUS_IN_PROGRESS", "STATUS_FINAL", etc.
      state: string; // "pre", "in", "post"
      completed: boolean;
    };
  };
}

export interface ESPNEvent {
  id?: string;
  competitions: ESPNCompetition[];
  status?: ESPNCompetition['status'];
}

export interface ESPNScoreboard {
  events: ESPNEvent[];
}

/**
 * Fetches the NFL scoreboard for a given week
 * @param week - Week number (1-18 for regular season)
 * @param seasonType - 2 for regular season, 3 for playoffs
 */
export async function getESPNScoreboard(
  week: number,
  seasonType: number = 2,
): Promise<ESPNScoreboard> {
  const params = new URLSearchParams({
    seasontype: String(seasonType),
    week: String(week),
  });
  const url = `${ESPN_BASE_URL}/scoreboard?${params.toString()}`;

  const response = await fetch(url, {
    cache: 'no-store', // Always get fresh game status
  });

  if (!response.ok) {
    throw new Error(`ESPN API error (${response.status.toString()}): ${response.statusText}`);
  }

  return (await response.json()) as ESPNScoreboard;
}

/**
 * Builds a map of NFL team abbreviation to game completion status
 * @param scoreboard - ESPN scoreboard data
 * @returns Map of team abbreviation to whether their game is complete
 */
export function buildTeamGameStatusMap(scoreboard: ESPNScoreboard): Map<string, boolean> {
  const teamStatusMap = new Map<string, boolean>();

  for (const event of scoreboard.events) {
    for (const competition of event.competitions) {
      const isComplete = competition.status.type.completed;

      for (const competitor of competition.competitors) {
        const teamAbbr = competitor.team.abbreviation;
        teamStatusMap.set(teamAbbr, isComplete);
      }
    }
  }

  return teamStatusMap;
}
