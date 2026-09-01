import { describe, it, expect } from 'vitest';
import { clamp01, normalizeScroll, rangeProgress, lerp } from '@/lib/scroll-math';

describe('clamp01', () => {
  it('clamps below zero and above one', () => {
    expect(clamp01(-3)).toBe(0);
    expect(clamp01(0.42)).toBe(0.42);
    expect(clamp01(9)).toBe(1);
  });
});

describe('normalizeScroll', () => {
  it('is 0 at the top and 1 at the bottom', () => {
    expect(normalizeScroll(0, 3000, 1000)).toBe(0);
    expect(normalizeScroll(2000, 3000, 1000)).toBe(1);
  });

  it('is linear in between', () => {
    expect(normalizeScroll(1000, 3000, 1000)).toBeCloseTo(0.5, 5);
  });

  it('returns 0 when the page does not scroll', () => {
    expect(normalizeScroll(0, 800, 1000)).toBe(0);
  });

  it('clamps overscroll', () => {
    expect(normalizeScroll(9999, 3000, 1000)).toBe(1);
    expect(normalizeScroll(-50, 3000, 1000)).toBe(0);
  });
});

describe('rangeProgress', () => {
  it('is 0 before the range and 1 after it', () => {
    expect(rangeProgress(0.1, [0.6, 0.75])).toBe(0);
    expect(rangeProgress(0.9, [0.6, 0.75])).toBe(1);
  });

  it('is linear within the range', () => {
    expect(rangeProgress(0.675, [0.6, 0.75])).toBeCloseTo(0.5, 5);
    expect(rangeProgress(0.6, [0.6, 0.75])).toBe(0);
    expect(rangeProgress(0.75, [0.6, 0.75])).toBe(1);
  });

  it('is monotonic across the range', () => {
    let prev = -1;
    for (let p = 0; p <= 1.0001; p += 0.01) {
      const v = rangeProgress(p, [0.6, 0.75]);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });
});

describe('lerp', () => {
  it('interpolates endpoints exactly', () => {
    expect(lerp(10, 20, 0)).toBe(10);
    expect(lerp(10, 20, 1)).toBe(20);
    expect(lerp(10, 20, 0.5)).toBe(15);
  });
});
