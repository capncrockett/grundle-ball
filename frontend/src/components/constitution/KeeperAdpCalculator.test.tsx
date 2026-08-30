import { fireEvent, render, screen, within } from '@testing-library/react';
import { calculateUndraftedKeeperCost } from '../../utils/keeperAdp';
import { KeeperAdpCalculator } from './KeeperAdpCalculator';

describe('calculateUndraftedKeeperCost', () => {
  it('maps ADP to its 12-team round and adds two rounds', () => {
    expect(calculateUndraftedKeeperCost(74.3)).toEqual({
      adp: 74.3,
      adpRound: 7,
      roundStartPick: 73,
      roundEndPick: 84,
      uncappedKeeperRound: 9,
      keeperRound: 9,
      wasCapped: false,
    });
  });

  it('handles round boundaries and the final-round cap', () => {
    expect(calculateUndraftedKeeperCost(12)?.adpRound).toBe(1);
    expect(calculateUndraftedKeeperCost(12.1)?.adpRound).toBe(2);
    expect(calculateUndraftedKeeperCost(181)).toMatchObject({
      adpRound: 16,
      uncappedKeeperRound: 18,
      keeperRound: 16,
      wasCapped: true,
    });
  });

  it('rejects values below the first ADP slot', () => {
    expect(calculateUndraftedKeeperCost(0)).toBeNull();
    expect(calculateUndraftedKeeperCost(Number.NaN)).toBeNull();
  });
});

describe('KeeperAdpCalculator', () => {
  it('explains the calculated round and cap while the user types', () => {
    render(<KeeperAdpCalculator />);

    const input = screen.getByRole('spinbutton', { name: 'Sleeper ADP on draft day' });
    const result = screen.getByTestId('keeper-adp-result');
    expect(within(result).getByText(/Enter an ADP/)).toBeInTheDocument();

    fireEvent.change(input, { target: { value: '74.3' } });
    expect(within(result).getByText('Round 9')).toBeInTheDocument();
    expect(within(result).getByText(/Round 7 \(picks 73-84\)/)).toBeInTheDocument();

    fireEvent.change(input, { target: { value: '181' } });
    expect(within(result).getByText('Round 16')).toBeInTheDocument();
    expect(
      within(result).getByText(/final-round cap sets the cost at Round 16/),
    ).toBeInTheDocument();

    fireEvent.change(input, { target: { value: '0' } });
    expect(within(result).getByText('Enter an ADP of 1 or higher.')).toBeInTheDocument();
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });
});
