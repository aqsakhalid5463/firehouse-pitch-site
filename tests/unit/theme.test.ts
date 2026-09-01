import { describe, it, expect } from 'vitest';
import { themeAt, mixHex } from '@/lib/theme';
import { COLORS } from '@/lib/constants';

describe('mixHex', () => {
  it('returns the endpoints exactly', () => {
    expect(mixHex('#000000', '#FFFFFF', 0)).toBe('#000000');
    expect(mixHex('#000000', '#FFFFFF', 1)).toBe('#ffffff');
  });

  it('mixes the midpoint', () => {
    expect(mixHex('#000000', '#FFFFFF', 0.5)).toBe('#808080');
  });
});

describe('themeAt', () => {
  it('is fully dark through the hero and the set-piece', () => {
    for (const p of [0, 0.1, 0.3, 0.5, 0.6]) {
      expect(themeAt(p).bg.toLowerCase()).toBe(COLORS.darkBg.toLowerCase());
    }
  });

  it('is fully light after the dissolve completes', () => {
    for (const p of [0.75, 0.85, 1]) {
      expect(themeAt(p).bg.toLowerCase()).toBe(COLORS.lightBg.toLowerCase());
    }
  });

  it('is partway through the dissolve at its midpoint', () => {
    const mid = themeAt(0.675).bg.toLowerCase();
    expect(mid).not.toBe(COLORS.darkBg.toLowerCase());
    expect(mid).not.toBe(COLORS.lightBg.toLowerCase());
  });

  it('drops bloom to zero in the light and peaks it in the dark', () => {
    expect(themeAt(0.5).bloomIntensity).toBeGreaterThan(themeAt(1).bloomIntensity);
    expect(themeAt(1).bloomIntensity).toBe(0);
  });

  it('fades embers out across the dissolve', () => {
    expect(themeAt(0.6).emberOpacity).toBe(1);
    expect(themeAt(0.75).emberOpacity).toBe(0);
  });

  it('moves bloom monotonically downward across the dissolve', () => {
    let prev = Infinity;
    for (let p = 0.6; p <= 0.7501; p += 0.01) {
      const v = themeAt(p).bloomIntensity;
      expect(v).toBeLessThanOrEqual(prev + 1e-9);
      prev = v;
    }
  });
});
