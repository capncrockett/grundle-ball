import { render, screen } from '@testing-library/react';
import type { BracketLayoutColumn } from './BracketGrid';
import type { BracketSlot } from '../../bracket/types';
import { BracketGrid } from './BracketGrid';
import { buildTeam } from '../../test/fixtures/teams';

describe('BracketGrid', () => {
  it('uses score overrides when masking a BYE slot', () => {
    const team = buildTeam({ sleeperRosterId: 1, teamName: 'Alpha', pointsFor: 200 });
    const teamsById = new Map([[team.sleeperRosterId, team]]);

    const slots: BracketSlot[] = [
      {
        id: 'champ_r2_g1',
        bracketId: 'champ',
        round: 'champ_round_2',
        label: 'Champ R2',
        positions: [
          { seed: 1, teamId: team.sleeperRosterId, currentPoints: 200 },
          { seed: 4, teamId: 4, currentPoints: 88 },
        ],
      },
    ];

    const columns: BracketLayoutColumn[] = [
      {
        title: 'Round 1',
        items: [{ id: 'champ_bye1', slotId: 'champ_r2_g1', maskOppIndex: 1, titleOverride: 'BYE' }],
      },
    ];

    render(
      <BracketGrid
        columns={columns}
        slots={slots}
        teamsById={teamsById}
        scoreOverridesByTeamId={new Map([[team.sleeperRosterId, 123.45]])}
        highlightTeamId={null}
        mode="score"
      />,
    );

    expect(screen.getByText('123.45')).toBeInTheDocument();
    expect(screen.queryByText('200.00')).not.toBeInTheDocument();
  });
});
