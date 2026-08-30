export type PlayerPositionStyle = {
  label: string;
  cellClassName: string;
  badgeClassName: string;
};

export const DRAFT_POSITION_LEGEND = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'] as const;

const POSITION_STYLES: Record<(typeof DRAFT_POSITION_LEGEND)[number], PlayerPositionStyle> = {
  QB: {
    label: 'QB',
    cellClassName: 'border-l-primary bg-primary/10',
    badgeClassName: 'badge-primary',
  },
  RB: {
    label: 'RB',
    cellClassName: 'border-l-success bg-success/10',
    badgeClassName: 'badge-success',
  },
  WR: {
    label: 'WR',
    cellClassName: 'border-l-info bg-info/10',
    badgeClassName: 'badge-info',
  },
  TE: {
    label: 'TE',
    cellClassName: 'border-l-warning bg-warning/10',
    badgeClassName: 'badge-warning',
  },
  K: {
    label: 'K',
    cellClassName: 'border-l-secondary bg-secondary/10',
    badgeClassName: 'badge-secondary',
  },
  DEF: {
    label: 'DEF',
    cellClassName: 'border-l-error bg-error/10',
    badgeClassName: 'badge-error',
  },
};

const UNKNOWN_POSITION_STYLE: PlayerPositionStyle = {
  label: 'N/A',
  cellClassName: 'border-l-base-content/25 bg-base-100',
  badgeClassName: 'badge-ghost',
};

export const getPlayerPositionStyle = (position: string | null): PlayerPositionStyle => {
  const normalized = position?.trim().toUpperCase();
  const canonicalPosition = normalized === 'DST' || normalized === 'D/ST' ? 'DEF' : normalized;

  if (canonicalPosition && canonicalPosition in POSITION_STYLES) {
    return POSITION_STYLES[canonicalPosition as keyof typeof POSITION_STYLES];
  }

  if (canonicalPosition) {
    return {
      ...UNKNOWN_POSITION_STYLE,
      label: canonicalPosition,
    };
  }

  return UNKNOWN_POSITION_STYLE;
};

export const getLegendPositionStyle = (
  position: (typeof DRAFT_POSITION_LEGEND)[number],
): PlayerPositionStyle => POSITION_STYLES[position];
