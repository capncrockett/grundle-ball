import { render, screen } from '@testing-library/react';
import { BRACKET_TEMPLATE } from '../../bracket/template';
import { BracketTile } from './BracketTile';
import { buildTeam } from '../../test/fixtures/teams';

describe('BracketTile', () => {
  it('renders BYE slot and highlights when team is selected', () => {
    const slotTemplate = BRACKET_TEMPLATE.find((s) => s.id === 'champ_r2_g1');
    if (!slotTemplate) throw new Error('Missing slot template for champ_r2_g1');

    const team = buildTeam({ sleeperRosterId: 1, seed: 1, teamName: 'Alpha' });
    const teamsById = new Map([[team.sleeperRosterId, team]]);

    const slot = {
      ...slotTemplate,
      positions: [
        { seed: 1, teamId: team.sleeperRosterId, currentPoints: 125.4 },
        { seed: 2, isBye: true },
      ] as typeof slotTemplate.positions,
    };

    const { container } = render(
      <BracketTile
        slot={slot}
        teamsById={teamsById}
        highlightTeamId={team.sleeperRosterId}
        mode="score"
      />,
    );

    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('BYE')).toBeInTheDocument();
    expect(screen.getByText('125.40')).toBeInTheDocument();

    const card = container.querySelector('.card');
    expect(card).toHaveClass('ring-primary');
  });

  it('shows reward details on reward mode', () => {
    const finalsTemplate = BRACKET_TEMPLATE.find((s) => s.id === 'champ_finals');
    if (!finalsTemplate) throw new Error('Missing slot template for champ_finals');
    if (!finalsTemplate.rewardTitle || !finalsTemplate.rewardText) {
      throw new Error('Missing reward metadata for champ_finals');
    }

    const teamsById = new Map([
      [1, buildTeam({ sleeperRosterId: 1, teamName: 'Alpha' })],
      [2, buildTeam({ sleeperRosterId: 2, teamName: 'Bravo' })],
    ]);

    const slot = {
      ...finalsTemplate,
      positions: [
        { seed: 1, teamId: 1, currentPoints: 101.1 },
        { seed: 2, teamId: 2, currentPoints: 99.2 },
      ] as typeof finalsTemplate.positions,
    };

    render(<BracketTile slot={slot} teamsById={teamsById} highlightTeamId={null} mode="reward" />);

    expect(screen.getByText(finalsTemplate.rewardTitle)).toBeInTheDocument();
    expect(screen.getByText(/1st \( BELT \+ 👑 \+ 💰\)/)).toBeInTheDocument();
    expect(screen.getByText(/2nd \(2x buy-in\)/)).toBeInTheDocument();
  });

  it('does not fall back to season points when currentPoints is missing', () => {
    const slotTemplate = BRACKET_TEMPLATE.find((s) => s.id === 'champ_r1_g1');
    if (!slotTemplate) throw new Error('Missing slot template for champ_r1_g1');

    const teamA = buildTeam({ sleeperRosterId: 1, teamName: 'Alpha', pointsFor: 222.22 });
    const teamB = buildTeam({ sleeperRosterId: 2, teamName: 'Bravo', pointsFor: 198.76 });
    const teamsById = new Map([
      [teamA.sleeperRosterId, teamA],
      [teamB.sleeperRosterId, teamB],
    ]);

    const slot = {
      ...slotTemplate,
      positions: [
        { seed: 4, teamId: teamA.sleeperRosterId },
        { seed: 5, teamId: teamB.sleeperRosterId },
      ] as typeof slotTemplate.positions,
    };

    const { container } = render(
      <BracketTile slot={slot} teamsById={teamsById} highlightTeamId={null} mode="score" />,
    );

    const scores = Array.from(container.querySelectorAll('.bracket-score')).map((node) =>
      node.textContent.trim(),
    );
    expect(scores).toEqual(['-', '-']);
    expect(screen.queryByText('222.22')).not.toBeInTheDocument();
    expect(screen.queryByText('198.76')).not.toBeInTheDocument();
  });
});
