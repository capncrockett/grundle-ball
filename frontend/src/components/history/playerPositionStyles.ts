export type PlayerPositionStyle = {
  label: string;
  colorClassName: string;
};

export const DRAFT_POSITION_LEGEND = [
  'QB',
  'RB',
  'WR',
  'TE',
  'K',
  'DEF',
  'DL',
  'LB',
  'DB',
] as const;

const POSITION_STYLES: Record<(typeof DRAFT_POSITION_LEGEND)[number], PlayerPositionStyle> = {
  QB: {
    label: 'QB',
    colorClassName: 'draft-position-qb',
  },
  RB: {
    label: 'RB',
    colorClassName: 'draft-position-rb',
  },
  WR: {
    label: 'WR',
    colorClassName: 'draft-position-wr',
  },
  TE: {
    label: 'TE',
    colorClassName: 'draft-position-te',
  },
  K: {
    label: 'K',
    colorClassName: 'draft-position-k',
  },
  DEF: {
    label: 'DEF',
    colorClassName: 'draft-position-def',
  },
  DL: {
    label: 'DL',
    colorClassName: 'draft-position-dl',
  },
  LB: {
    label: 'LB',
    colorClassName: 'draft-position-lb',
  },
  DB: {
    label: 'DB',
    colorClassName: 'draft-position-db',
  },
};

const UNKNOWN_POSITION_STYLE: PlayerPositionStyle = {
  label: 'N/A',
  colorClassName: 'draft-position-unknown',
};

export const getPlayerPositionStyle = (position: string | null): PlayerPositionStyle => {
  const normalized = position?.trim().toUpperCase();
  const canonicalPosition =
    normalized === 'DST' || normalized === 'D/ST'
      ? 'DEF'
      : normalized === 'DE' || normalized === 'DT'
        ? 'DL'
        : normalized === 'CB' || normalized === 'S'
          ? 'DB'
          : normalized === 'ILB' || normalized === 'OLB'
            ? 'LB'
            : normalized;

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
