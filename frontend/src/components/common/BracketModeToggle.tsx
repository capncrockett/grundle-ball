import type { FC } from 'react';

type BracketMode = 'score' | 'reward';

interface BracketModeToggleProps {
  mode: BracketMode;
  onModeChange: (mode: BracketMode) => void;
}

/**
 * Small shared control for switching between Score and Reward bracket modes.
 *
 * This is a thin extraction of the existing button group used on the playoff
 * pages. It preserves the same DaisyUI classes and text labels.
 */
export const BracketModeToggle: FC<BracketModeToggleProps> = ({ mode, onModeChange }) => {
  return (
    <div className="join">
      <button
        type="button"
        className={`btn btn-xs sm:btn-sm join-item ${mode === 'score' ? 'btn-primary' : 'btn-ghost'}`}
        onClick={() => {
          onModeChange('score');
        }}
      >
        Score mode
      </button>
      <button
        type="button"
        className={`btn btn-xs sm:btn-sm join-item ${mode === 'reward' ? 'btn-primary' : 'btn-ghost'}`}
        onClick={() => {
          onModeChange('reward');
        }}
      >
        Reward mode
      </button>
    </div>
  );
};