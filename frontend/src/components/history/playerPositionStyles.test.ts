import {
  DRAFT_POSITION_LEGEND,
  getLegendPositionStyle,
  getPlayerPositionStyle,
} from './playerPositionStyles';

describe('playerPositionStyles', () => {
  it('assigns every standard draft position a distinct theme color', () => {
    const styles = DRAFT_POSITION_LEGEND.map((position) => getLegendPositionStyle(position));

    expect(new Set(styles.map((style) => style.colorClassName)).size).toBe(
      DRAFT_POSITION_LEGEND.length,
    );
  });

  it('normalizes common defense labels', () => {
    expect(getPlayerPositionStyle('DST')).toBe(getLegendPositionStyle('DEF'));
    expect(getPlayerPositionStyle('D/ST')).toBe(getLegendPositionStyle('DEF'));
  });

  it('normalizes individual defensive position variants', () => {
    expect(getPlayerPositionStyle('DE')).toBe(getLegendPositionStyle('DL'));
    expect(getPlayerPositionStyle('OLB')).toBe(getLegendPositionStyle('LB'));
    expect(getPlayerPositionStyle('CB')).toBe(getLegendPositionStyle('DB'));
  });
});
