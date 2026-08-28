import type { ChangeEvent, FC } from 'react';
import type { Team } from '../../models/fantasy';

interface TeamSelectorProps {
  teams: Team[];
  selectedTeamId: number | null;
  onSelectedTeamChange: (teamId: number | null) => void;
}

/**
 * Shared team selector dropdown used on playoff pages to highlight a roster
 * in the bracket. This preserves existing styling and copy.
 */
export const TeamSelector: FC<TeamSelectorProps> = ({
  teams,
  selectedTeamId,
  onSelectedTeamChange,
}) => {
  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const { value } = event.target;
    onSelectedTeamChange(value ? Number(value) : null);
  };

  return (
    <select
      className="select select-xs sm:select-sm w-40"
      value={selectedTeamId ?? ''}
      onChange={handleChange}
    >
      <option value="">All teams</option>
      {teams.map((team) => (
        <option key={team.sleeperRosterId} value={team.sleeperRosterId}>
          {team.seed}. {team.teamName}
        </option>
      ))}
    </select>
  );
};