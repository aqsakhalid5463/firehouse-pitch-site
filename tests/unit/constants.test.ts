import { describe, it, expect } from 'vitest';
import { BUSINESS, HERO_HEADLINE, COLORS, SECTIONS } from '@/lib/constants';

describe('constants', () => {
  it('carries the real business details', () => {
    expect(BUSINESS.name).toBe('Firehouse Movers Inc.');
    expect(BUSINESS.address).toBe('2535-B Texas 121 E, State #140, Lewisville, TX 75056');
    expect(BUSINESS.phone).toBe('(972) 992-1969');
    expect(BUSINESS.phoneHref).toBe('tel:+19729921969');
    expect(BUSINESS.email).toBe('support@firehousemovers.com');
  });

  it('carries the hero headline', () => {
    expect(HERO_HEADLINE).toBe('The moving service we needed, so we built it for you');
  });

  it('carries the exact palette', () => {
    expect(COLORS.darkBg).toBe('#08070A');
    // Round 7: shifted off cream toward a clean off-white/light-grey per
    // client feedback ("their colour theme is red / white / black /
    // dark-grey") — cream is not in that palette.
    expect(COLORS.fireRed).toBe('#E23D28');
  });

  it('defines contiguous section ranges covering 0 to 1', () => {
    const ranges = Object.values(SECTIONS);
    expect(ranges[0][0]).toBe(0);
    expect(ranges[ranges.length - 1][1]).toBe(1);
    for (let i = 1; i < ranges.length; i++) {
      expect(ranges[i][0]).toBeCloseTo(ranges[i - 1][1], 5);
    }
  });
});
