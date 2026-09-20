// src/components/common/TeamAvatars.tsx

import type { FC } from 'react';

type AvatarSize = 'sm' | 'md' | 'lg';

interface TeamAvatarsProps {
  teamName: string;
  teamAvatarUrl?: string | null;
  userAvatarUrl?: string | null;
  userDisplayName?: string;
  /** Whether to render the small manager avatar overlay. Defaults to true. */
  showUserAvatar?: boolean;
  /** Visual size preset. */
  size?: AvatarSize;
  /**
   * Larger preset applied at the `md` breakpoint and up, in place of `size`.
   * Renders the true pixel dimensions for that breakpoint via Tailwind width/
   * height classes rather than a `transform: scale()` on `size`, which is
   * what produces a compositing seam on the rounded, overflow-hidden,
   * ring-bordered avatar circle at desktop widths.
   */
  mdSize?: AvatarSize;
  className?: string;
}

const SIZE_PRESETS: Record<AvatarSize, { main: number; sub: number; boxClass: string }> = {
  sm: { main: 24, sub: 12, boxClass: 'w-6 h-6' },
  md: { main: 32, sub: 14, boxClass: 'w-8 h-8' },
  lg: { main: 40, sub: 16, boxClass: 'w-10 h-10' },
};

const MD_BOX_CLASS: Record<AvatarSize, string> = {
  sm: 'md:w-6 md:h-6',
  md: 'md:w-8 md:h-8',
  lg: 'md:w-10 md:h-10',
};

export const TeamAvatars: FC<TeamAvatarsProps> = ({
  teamName,
  teamAvatarUrl = null,
  userAvatarUrl = null,
  userDisplayName,
  showUserAvatar = false,
  size = 'md',
  mdSize,
  className = '',
}) => {
  const { sub, boxClass } = SIZE_PRESETS[size];
  const mdBoxClass = mdSize ? MD_BOX_CLASS[mdSize] : '';
  const sizeClassName = `${boxClass} ${mdBoxClass}`.trim();
  const shouldShowUserAvatar =
    showUserAvatar && userAvatarUrl != null && userAvatarUrl !== teamAvatarUrl;
  const initial = teamName.charAt(0).toUpperCase() || '?';
  const userAvatarAlt = userDisplayName ?? 'Manager avatar';

  return (
    <div
      className={`relative inline-flex items-center justify-center ${sizeClassName} ${className}`}
      aria-label={teamName}
    >
      <div className="avatar">
        <div
          className={`rounded-full bg-base-300 overflow-hidden ring-1 ring-base-200 ${sizeClassName}`}
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
