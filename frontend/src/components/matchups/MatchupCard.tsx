// frontend/src/components/matchups/MatchupCard.tsx

import type { LiveMatchData, Team } from '../../models/fantasy';
import { TeamAvatars } from '../common/TeamAvatars';

interface MatchupCardProps {
  live: LiveMatchData;
  teamA: Team | undefined;
  teamB: Team | undefined;
}

const formatRecord = (record: Team['record']): string => {
  const base = `${record.wins.toString()}-${record.losses.toString()}`;
  return record.ties ? `${base}-${record.ties.toString()}` : base;
};

export function MatchupCard({ live, teamA, teamB }: MatchupCardProps) {
  return (
    <div className="card bg-base-200 shadow-md mb-4" data-testid="matchup-card">
      <div className="card-body p-4 gap-3">
        {/* Header: week / matchup label */}
        <div className="flex justify-between items-center text-xs text-base-content/60">
          <span>Week {live.week}</span>
          <span>
            Matchup #{live.teamIdA}-{live.teamIdB ?? 'BYE'}
          </span>
        </div>

        {/* Teams */}
        <div className="grid grid-cols-2 gap-3">
          {/* Team A */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              {teamA && (
                <TeamAvatars
                  teamName={teamA.teamName}
                  teamAvatarUrl={teamA.teamAvatarUrl}
                  userAvatarUrl={teamA.userAvatarUrl}
                  userDisplayName={teamA.ownerDisplayName}
                  showUserAvatar={false}
                  size="md"
                />
              )}
              <div className="flex flex-col min-w-0 flex-1">
                <span className="font-semibold truncate">{teamA?.teamName ?? 'Unknown'}</span>
                <span className="text-xs text-base-content/60">
                  {teamA ? formatRecord(teamA.record) : '-'}
                </span>
              </div>
            </div>

            <div className="mt-1">
              <div className="text-2xl font-bold">
                {live.pointsA ? live.pointsA.toFixed(2) : '-'}
              </div>
              <div className="text-xs text-base-content/60">
                {live.playersFinishedA}/{live.startersA} finished
              </div>
            </div>
          </div>

          {/* Team B */}
          <div className="flex flex-col gap-1 items-end text-right">
            <div className="flex items-center gap-2 flex-row-reverse w-full">
              {teamB && (
                <TeamAvatars
                  teamName={teamB.teamName}
                  teamAvatarUrl={teamB.teamAvatarUrl}
                  userAvatarUrl={teamB.userAvatarUrl}
                  userDisplayName={teamB.ownerDisplayName}
                  showUserAvatar={false}
                  size="md"
                />
              )}
              <div className="flex flex-col min-w-0 flex-1">
                <span className="font-semibold truncate">{teamB?.teamName ?? 'BYE'}</span>
                <span className="text-xs text-base-content/60">
                  {teamB ? formatRecord(teamB.record) : '-'}
                </span>
              </div>
            </div>

            <div className="mt-1">
              <div className="text-2xl font-bold">{teamB ? live.pointsB.toFixed(2) : '-'}</div>
              {teamB && (
                <div className="text-xs text-base-content/60">
                  {live.playersFinishedB}/{live.startersB} finished
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
