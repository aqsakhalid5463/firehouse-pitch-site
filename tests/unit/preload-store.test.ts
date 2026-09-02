import { describe, expect, it } from 'vitest';
import { preloadProgress } from '@/lib/preload-store';

describe('preloadProgress', () => {
  it('is zero before anything is ready', () => {
    expect(preloadProgress({})).toBe(0);
  });

  it('reaches exactly 1 when every signal is ready', () => {
    // The exit condition compares against 1, so a floating-point sum
    // landing at 0.9999999 would leave the curtain up forever.
    expect(preloadProgress({ fonts: true, logo: true, frame: true })).toBe(1);
  });

  it('never completes on a partial set', () => {
    expect(preloadProgress({ fonts: true, logo: true })).toBeLessThan(1);
    expect(preloadProgress({ frame: true })).toBeLessThan(1);
  });

  it('weights the rendered frame most heavily', () => {
    // The frame covers shader compilation and the procedural texture
    // canvases; the other two are a font check and one SVG.
    const frame = preloadProgress({ frame: true });
    expect(frame).toBeGreaterThan(preloadProgress({ fonts: true }));
    expect(frame).toBeGreaterThan(preloadProgress({ logo: true }));
  });

  it('increases monotonically as signals arrive', () => {
    const steps = [
      preloadProgress({}),
      preloadProgress({ fonts: true }),
      preloadProgress({ fonts: true, logo: true }),
      preloadProgress({ fonts: true, logo: true, frame: true }),
    ];
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i]).toBeGreaterThan(steps[i - 1]);
    }
  });
});
