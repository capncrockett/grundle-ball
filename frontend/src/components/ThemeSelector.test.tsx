import { render, waitFor } from '@testing-library/react';
import { ThemeSelector } from './ThemeSelector';

const THEME_KEY = 'grundle-ball-theme';
const LEGACY_THEME_KEY = 'keeper-bowl-theme';

describe('ThemeSelector storage', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('stores the default theme under the Grundle Ball key', async () => {
    render(<ThemeSelector />);

    await waitFor(() => {
      expect(document.documentElement).toHaveAttribute('data-theme', 'dracula');
      expect(localStorage.getItem(THEME_KEY)).toBe('dracula');
    });
    expect(localStorage.getItem(LEGACY_THEME_KEY)).toBeNull();
  });

  it('migrates a valid preference from the pre-rebrand key', async () => {
    localStorage.setItem(LEGACY_THEME_KEY, 'retro');

    render(<ThemeSelector />);

    await waitFor(() => {
      expect(document.documentElement).toHaveAttribute('data-theme', 'retro');
      expect(localStorage.getItem(THEME_KEY)).toBe('retro');
      expect(localStorage.getItem(LEGACY_THEME_KEY)).toBeNull();
    });
  });
});
