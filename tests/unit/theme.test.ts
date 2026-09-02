import { describe, it, expect } from 'vitest';
import { THEME, roadOpacityAt, ROAD_FADE_START } from '@/lib/theme';
import { COLORS } from '@/lib/constants';

describe('THEME', () => {
  it('is the dark palette, with no light half', () => {
    expect(THEME.bg).toBe(COLORS.darkBg);
    expect(THEME.fog).toBe(COLORS.darkFog);
    expect(THEME.ink).toBe(COLORS.bone);
  });

  it('keeps bloom on, since nothing dissolves it away any more', () => {
    expect(THEME.bloomIntensity).toBeGreaterThan(0);
  });
});

describe('roadOpacityAt', () => {
  it('holds the road at full strength until the fade starts', () => {
    expect(roadOpacityAt(0)).toBe(1);
    expect(roadOpacityAt(ROAD_FADE_START)).toBe(1);
  });

  it('is fully faded by the end of the departure', () => {
    expect(roadOpacityAt(1)).toBe(0);
  });

  it('never leaves the 0..1 range, including out-of-range input', () => {
    for (let i = -2; i <= 12; i++) {
      const v = roadOpacityAt(i / 10);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('decreases monotonically once the fade has begun', () => {
    let prev = 1;
    for (let i = 0; i <= 20; i++) {
      const v = roadOpacityAt(ROAD_FADE_START + ((1 - ROAD_FADE_START) * i) / 20);
      expect(v).toBeLessThanOrEqual(prev + 1e-9);
      prev = v;
    }
  });
});
