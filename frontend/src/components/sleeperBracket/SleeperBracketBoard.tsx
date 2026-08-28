// frontend/src/components/sleeperBracket/SleeperBracketBoard.tsx
//
// Renders a Sleeper bracket (winners_bracket or losers_bracket) generically:
// group by round, one card per matchup, showing real teams where known and
// "Winner/Loser of Game N" placeholders otherwise. No custom routing.

import type { FC } from 'react';
import type { Team } from '../../models/fantasy';
import type { BracketSide, ResolvedBracketMatchup } from '../../sleeperBracket/types';
import {
  describePlacementLabel,
  describeSideLabel,
  groupMatchupsByRound,
} from '../../sleeperBracket/resolveBracket';
import { TeamAvatars } from '../common/TeamAvatars';

interface SleeperBracketBoardProps {
  title: string;
  subtitle?: string;
  matchups: ResolvedBracketMatchup[];
  teamsById: Map<number, Team>;
}

interface SideRowProps {
  side: BracketSide;
  isWinner: boolean;
  teamsById: Map<number, Team>;
}

const SideRow: FC<SideRowProps> = ({ side, isWinner, teamsById }) => {
  if (side.kind === 'team') {
    const team = teamsById.get(side.rosterId);
    const teamName = team?.teamName ?? `Roster ${String(side.rosterId)}`;

    return (
      <div className={`flex items-center gap-2 py-1 min-w-0 ${isWinner ? 'font-semibold' : 'opacity-80'}`}>
        <TeamAvatars teamName={teamName} teamAvatarUrl={team?.teamAvatarUrl} size="sm" />
        <span className="text-sm truncate">{teamName}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 py-1 text-sm italic text-base-content/50">
      <div className="w-6 h-6 rounded-full bg-base-300/50 shrink-0" aria-hidden />
      <span className="truncate">{describeSideLabel(side)}</span>
    </div>
  );
};

export const SleeperBracketBoard: FC<SleeperBracketBoardProps> = ({
  title,
  subtitle,
  matchups,
  teamsById,
}) => {
  const rounds = groupMatchupsByRound(matchups);

  return (
    <div>
      <h2 className="text-sm md:text-lg font-bold mb-1 text-base-content">{title}</h2>
      {subtitle && <p className="text-xs text-base-content/60 mb-3">{subtitle}</p>}
      <div className="flex gap-4 md:gap-6 overflow-x-auto pb-2">
        {rounds.map(({ round, matchups: roundMatchups }) => (
          <div key={round} className="flex flex-col gap-4 min-w-[200px] shrink-0">
            <div className="text-[0.65rem] uppercase tracking-wide text-base-content/50">
              Round {round}
            </div>
            {roundMatchups.map((matchup) => {
              const placementLabel = describePlacementLabel(matchup.placement);
              const winnerIsSideA =
                matchup.winnerRosterId != null &&
                matchup.sideA.kind === 'team' &&
                matchup.sideA.rosterId === matchup.winnerRosterId;
              const winnerIsSideB =
                matchup.winnerRosterId != null &&
                matchup.sideB.kind === 'team' &&
                matchup.sideB.rosterId === matchup.winnerRosterId;

              return (
                <div key={matchup.matchId} className="card bg-base-100 border border-base-300 shadow-sm">
                  <div className="card-body p-3 gap-0">
                    <SideRow side={matchup.sideA} isWinner={winnerIsSideA} teamsById={teamsById} />
                    <div className="divider my-0" />
                    <SideRow side={matchup.sideB} isWinner={winnerIsSideB} teamsById={teamsById} />
                    {placementLabel && (
                      <div className="text-[0.65rem] text-base-content/50 mt-1">{placementLabel}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SleeperBracketBoard;
