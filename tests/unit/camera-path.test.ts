import { describe, it, expect } from 'vitest';
import { sampleHomeCamera, sampleAboutCamera } from '@/lib/camera-path';

describe('sampleHomeCamera', () => {
  it('returns a finite sample across the whole range', () => {
    for (let p = 0; p <= 1.0001; p += 0.05) {
      const s = sampleHomeCamera(p);
      expect(s.position.every(Number.isFinite)).toBe(true);
      expect(s.lookAt.every(Number.isFinite)).toBe(true);
      expect(Number.isFinite(s.fov)).toBe(true);
    }
  });

  it('clamps out-of-range input to the endpoints', () => {
    expect(sampleHomeCamera(-1)).toEqual(sampleHomeCamera(0));
    expect(sampleHomeCamera(2)).toEqual(sampleHomeCamera(1));
  });

  it('pulls the camera back between the hero and the services grid', () => {
    expect(sampleHomeCamera(0.3).position[2]).toBeGreaterThan(
      sampleHomeCamera(0).position[2],
    );
  });

  it('is continuous — no jumps between adjacent samples', () => {
    let prev = sampleHomeCamera(0).position;
    for (let p = 0.01; p <= 1.0001; p += 0.01) {
      const cur = sampleHomeCamera(p).position;
      const d = Math.hypot(cur[0] - prev[0], cur[1] - prev[1], cur[2] - prev[2]);
      expect(d).toBeLessThan(1.5);
      prev = cur;
    }
  });
});

describe('sampleAboutCamera', () => {
  it('returns finite samples and is continuous', () => {
    let prev = sampleAboutCamera(0).position;
    for (let p = 0.01; p <= 1.0001; p += 0.01) {
      const cur = sampleAboutCamera(p).position;
      expect(cur.every(Number.isFinite)).toBe(true);
      const d = Math.hypot(cur[0] - prev[0], cur[1] - prev[1], cur[2] - prev[2]);
      expect(d).toBeLessThan(1.5);
      prev = cur;
    }
  });

  it('follows a different path from the home page', () => {
    expect(sampleAboutCamera(0.5).position).not.toEqual(
      sampleHomeCamera(0.5).position,
    );
  });
});
