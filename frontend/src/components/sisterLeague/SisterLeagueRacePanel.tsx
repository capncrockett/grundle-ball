// frontend/src/components/sisterLeague/SisterLeagueRacePanel.tsx
//
// Narrated Bubble Watch / Bye Chase cards for the Sister League page. Each
// card explains a team's simulated odds, what its remaining record has to be,
// and which other games it should root for.

import type { TeamScoring } from '../../sisterLeague/projections';
import {
  formatOdds,
  ordinal,
  type RaceEntry,
  type SisterLeagueRace,
} from '../../sisterLeague/races';
import type { SisterLeagueTeam } from '../../sisterLeague/sisterLeague';

type RacePanelProps = {
  heading: string;
  description: string;
  race: SisterLeagueRace;
  teamsById: Map<number, SisterLeagueTeam>;
  scoring: Map<number, TeamScoring>;
};

const goalLabel = (race: SisterLeagueRace): string =>
  race.target === 'playoffs' ? 'makes the playoffs' : 'earns a bye';

const teamName = (teamsById: Map<number, SisterLeagueTeam>, id: number): string =>
  teamsById.get(id)?.name ?? `Team ${id.toString()}`;

function scoringSentence(entry: RaceEntry, team: SisterLeagueTeam, scoring?: TeamScoring) {
  if (!scoring || scoring.games === 0) return null;
  const gap = team.seed - entry.averageRank;
  const read =
    gap >= 3
      ? ' The record is running behind the scoring, so better luck could carry them.'
      : gap <= -3
        ? ' The record is ahead of the scoring, so they may have been riding some luck.'
        : '';
  const rankText = entry.averageRank === 1 ? 'the best' : `the ${ordinal(entry.averageRank)}-best`;
  return (
    <p>
      Scores average {scoring.average.toFixed(1)} (median {scoring.median.toFixed(1)}, high{' '}
      {scoring.high.toFixed(1)}, low {scoring.low.toFixed(1)}), {rankText} average in the league.
      {read}
    </p>
  );
}

function recordSentence(entry: RaceEntry, race: SisterLeagueRace) {
  if (entry.byWins.length === 0) return null;
  const best = entry.byWins[0];
  const wonOut = best.losses === 0;
  const prize = race.target === 'playoffs' ? 'a playoff spot' : 'a bye';
  return (
    <div>
      <p>
        {wonOut && entry.winOutClinches
          ? `Win out and they are guaranteed ${prize}.`
          : wonOut && best.odds >= 0.99
            ? `Winning out lands them ${prize} in virtually every simulation.`
            : wonOut
              ? `Even winning out is not a lock (${formatOdds(best.odds)}).`
              : 'Their remaining record decides most of it:'}
      </p>
      <ul
        className="flex flex-wrap gap-1.5 mt-1"
        aria-label={`Odds by remaining record (${race.target})`}
      >
        {entry.byWins.map((row) => (
          <li
            key={row.wins}
            className="badge badge-outline badge-sm font-mono"
            title={`${formatOdds(row.share)} of simulations finish ${row.wins.toString()}-${row.losses.toString()}`}
          >
            {row.wins}-{row.losses}: {formatOdds(row.odds)}
          </li>
        ))}
      </ul>
    </div>
  );
}

function rootingList(entry: RaceEntry, teamsById: Map<number, SisterLeagueTeam>) {
  if (!entry.rooting.length) {
    return <p>No single outside game moves their odds much; it is mostly on them.</p>;
  }
  return (
    <div>
      <p>Help that matters most:</p>
      <ul className="list-disc list-inside space-y-0.5">
        {entry.rooting.map((interest) => {
          const opponentId =
            interest.rootForTeamId === interest.game.homeTeamId
              ? interest.game.awayTeamId
              : interest.game.homeTeamId;
          return (
            <li key={interest.game.index}>
              Week {interest.game.week}: root for{' '}
              <strong>{teamName(teamsById, interest.rootForTeamId)}</strong> over{' '}
              {teamName(teamsById, opponentId)} ({formatOdds(interest.oddsIfRootedWins)} vs{' '}
              {formatOdds(interest.oddsOtherwise)})
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function SisterLeagueRacePanel({
  heading,
  description,
  race,
  teamsById,
  scoring,
}: RacePanelProps) {
  return (
    <section className="mt-6" aria-label={heading}>
      <h2 className="text-lg font-bold">{heading}</h2>
      <p className="text-xs text-base-content/70 mb-2">{description}</p>
      <div className="grid items-start gap-3 md:grid-cols-2">
        {race.entries.map((entry) => {
          const team = teamsById.get(entry.teamId);
          if (!team) return null;
          return (
            <details
              key={entry.teamId}
              className="group bg-base-100 border-2 border-base-content/30 rounded-lg shadow-md transition-colors hover:border-primary/70 open:border-primary/70"
            >
              <summary className="flex items-center justify-between gap-3 rounded-lg px-4 py-3 cursor-pointer select-none hover:bg-base-200">
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold leading-snug">
                    ({team.seed}) {team.name}
                  </span>
                  <span className="text-xs text-base-content/70">
                    {team.wins}-{team.losses}
                    {team.ties ? `-${team.ties.toString()}` : ''}, {goalLabel(race)} in{' '}
                    {formatOdds(entry.odds)} of simulations
                  </span>
                </span>
                <span className="badge badge-primary badge-outline shrink-0 font-mono">
                  {formatOdds(entry.odds)}
                </span>
              </summary>
              <div className="px-4 pb-4 text-sm leading-snug space-y-2 text-base-content/90">
                <p>
                  Most likely finish: {ordinal(entry.mostLikelySeed)} (
                  {formatOdds(entry.mostLikelySeedOdds)} of simulations).
                </p>
                {scoringSentence(entry, team, scoring.get(team.id))}
                {recordSentence(entry, race)}
                {rootingList(entry, teamsById)}
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}

export default SisterLeagueRacePanel;
