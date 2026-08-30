import {
  DRAFT_POSITION_LEGEND,
  getLegendPositionStyle,
  getPlayerPositionStyle,
} from './playerPositionStyles';

describe('playerPositionStyles', () => {
  it('assigns every standard draft position a distinct theme color', () => {
    const styles = DRAFT_POSITION_LEGEND.map((position) => getLegendPositionStyle(position));

    expect(new Set(styles.map((style) => style.cellClassName)).size).toBe(
      DRAFT_POSITION_LEGEND.length,
    );
    expect(new Set(styles.map((style) => style.badgeClassName)).size).toBe(
      DRAFT_POSITION_LEGEND.length,
    );
  });

  it('normalizes common defense labels', () => {
    expect(getPlayerPositionStyle('DST')).toBe(getLegendPositionStyle('DEF'));
    expect(getPlayerPositionStyle('D/ST')).toBe(getLegendPositionStyle('DEF'));
  });
});
