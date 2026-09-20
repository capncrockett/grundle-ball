// frontend/src/components/MegalabowlLayout.tsx
//
// Wraps the Megalabowl mirror: a staging-only view of a separate, linked
// Sleeper league (a Fantasy Footballers listener super-league), reusing the
// Grundle League's own Standings/Matchups/Playoffs pages against a second
// league id. Restricted to localhost and the protected staging deployment
// via the same gate as Draft Intel; see frontend/src/draftIntelAccess.ts.

import type { FC, ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';

const TABS = [
  { to: '/local/megalabowl/standings', label: 'Standings' },
  { to: '/local/megalabowl/matchups', label: 'Matchups' },
  { to: '/local/megalabowl/playoffs', label: 'Playoffs' },
];

export const MegalabowlLayout: FC<{ children: ReactNode }> = ({ children }) => {
  const location = useLocation();

  return (
    <div>
      <div className="bg-secondary/10 border-b border-secondary/30">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs sm:text-sm text-base-content/80">
            <span className="badge badge-secondary badge-sm shrink-0">Staging</span>
            <span>
              Megalabowl is a staging-only mirror of a separate, linked Sleeper league. It is not
              part of the Grundle League.
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

export default MegalabowlLayout;
