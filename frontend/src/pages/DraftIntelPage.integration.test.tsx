import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithRouter } from '../test/testUtils';
import { DraftIntelPage } from './DraftIntelPage';

describe('DraftIntelPage', () => {
  it('builds league and Team patterns from completed draft history', async () => {
    const user = userEvent.setup();
    renderWithRouter(<DraftIntelPage initialScoutRosterId={1} storage={null} />);

    expect(screen.getByRole('heading', { name: 'Draft Intel' })).toBeInTheDocument();
    const coverage = screen.getByRole('region', { name: 'Draft Intel coverage' });
    expect(within(coverage).getByText('11')).toBeInTheDocument();
    expect(within(coverage).getByText(/Glaurung & Foes excluded as your Team/)).toBeInTheDocument();
    expect(screen.getByText(/data since 2021/i)).toBeInTheDocument();
    expect(screen.getByText(/forced 2024-2025 IDP rounds are excluded/)).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Team Patterns' }));

    expect(screen.getByRole('heading', { name: 'Team Patterns' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Kitchen Chubbards/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Glaurung & Foes/ })).not.toBeInTheDocument();
  });

  it('stores the local Team selected during onboarding', async () => {
    const user = userEvent.setup();
    const values = new Map<string, string>();
    const storage = {
      getItem: jest.fn((key: string) => values.get(key) ?? null),
      setItem: jest.fn((key: string, value: string) => {
        values.set(key, value);
      }),
    };
    renderWithRouter(<DraftIntelPage storage={storage} />);

    const dialog = screen.getByRole('dialog', { name: /Make the league patterns yours/ });
    await user.selectOptions(within(dialog).getByLabelText('Your Team'), '1');
    await user.click(within(dialog).getByRole('button', { name: 'Analyze league' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(storage.setItem).toHaveBeenCalledWith(
      'grundle-ball:draft-intel:v1',
      JSON.stringify({ scoutRosterId: 1, sinceSeason: '2021' }),
    );
    const coverage = screen.getByRole('region', { name: 'Draft Intel coverage' });
    expect(within(coverage).getByText('11')).toBeInTheDocument();
  });
});
