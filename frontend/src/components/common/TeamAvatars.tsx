// src/components/common/TeamAvatars.tsx

import type { FC } from 'react';

interface TeamAvatarsProps {
  teamName: string;
  teamAvatarUrl?: string | null;
  userAvatarUrl?: string | null;
  userDisplayName?: string;
  /** Whether to render the small manager avatar overlay. Defaults to true. */
  showUserAvatar?: boolean;
  /** Visual size preset. */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_PRESETS: Record<NonNullable<TeamAvatarsProps['size']>, { main: number; sub: number }> = {
  sm: { main: 24, sub: 12 },
  md: { main: 32, sub: 14 },
  lg: { main: 40, sub: 16 },
};

export const TeamAvatars: FC<TeamAvatarsProps> = ({
  teamName,
  teamAvatarUrl = null,
  userAvatarUrl = null,
  userDisplayName,
  showUserAvatar = false,
  size = 'md',
  className = '',
}) => {
  const { main, sub } = SIZE_PRESETS[size];
  const shouldShowUserAvatar =
    showUserAvatar && userAvatarUrl != null && userAvatarUrl !== teamAvatarUrl;
  const initial = teamName.charAt(0).toUpperCase() || '?';
  const userAvatarAlt = userDisplayName ?? 'Manager avatar';

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: main, height: main }}
      aria-label={teamName}
    >
      <div className="avatar">
        <div
          className="rounded-full bg-base-300 overflow-hidden ring-1 ring-base-200"
          style={{ width: main, height: main }}
        >
          {teamAvatarUrl ? (
            <img src={teamAvatarUrl} alt={teamName} />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xs font-semibold text-base-content/70">
              {initial}
            </div>
          )}
        </div>
      </div>

      {shouldShowUserAvatar && (
        <div
          className="avatar absolute rounded-full shadow-sm"
          style={{
            width: sub,
            height: sub,
            right: -sub / 4,
            bottom: -sub / 4,
          }}
          aria-label={userDisplayName ?? 'Manager avatar'}
        >
          <div
            className="rounded-full border-2 border-base-100 bg-base-200 overflow-hidden"
            style={{ width: sub, height: sub }}
          >
            <img src={userAvatarUrl} alt={userAvatarAlt} />
          </div>
        </div>
      )}
    </div>
  );
};
