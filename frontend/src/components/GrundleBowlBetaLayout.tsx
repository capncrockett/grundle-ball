// frontend/src/components/GrundleBowlBetaLayout.tsx
//
// Wraps the legacy Champ/Keeper/Toilet bracket (formerly the app's main
// Playoffs pages). This custom "Keeper Bowl" cross-bracket format was voted
// down by the league (see constitution "Rule & Vote History" - 2026), so it
// lives here as a clearly-labeled Beta feature instead of the main Playoffs
// page.

import type { FC, ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';

const TABS = [
  { to: '/beta/grundle-bowl/live', label: 'Live' },
  { to: '/beta/grundle-bowl/if-today', label: 'If Today' },
];

export const GrundleBowlBetaLayout: FC<{ children: ReactNode }> = ({ children }) => {
  const location = useLocation();

  return (
    <div>
      <div className="bg-warning/10 border-b border-warning/30">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs sm:text-sm text-base-content/80">
            <span className="badge badge-warning badge-sm shrink-0">Beta</span>
            <span>
              Grundle Bowl is a house-rule bracket format the league voted down for 2026 (see{' '}
              <Link to="/constitution" className="link">
                Rule &amp; Vote History
              </Link>
              ). Kept here for fun &mdash; the official bracket lives on the{' '}
              <Link to="/playoffs" className="link">
                Playoffs
              </Link>{' '}
              page.
            </span>
          </div>
          <div className="flex gap-1 shrink-0">
            {TABS.map((tab) => (
              <Link
                key={tab.to}
                to={tab.to}
                className={`btn btn-xs ${location.pathname === tab.to ? 'btn-active' : 'btn-ghost'}`}
              >
                {tab.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
      {children}
    </div>
  );
};

export default GrundleBowlBetaLayout;
