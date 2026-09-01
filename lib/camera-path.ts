import { clamp01 } from './scroll-math';

export type CameraSample = {
  position: [number, number, number];
  lookAt: [number, number, number];
  fov: number;
};

type Vec3 = [number, number, number];

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number) {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
}

function sampleSpline(points: Vec3[], p: number): Vec3 {
  const t = clamp01(p);
  const n = points.length - 1;
  const scaled = t * n;
  const i = Math.min(Math.floor(scaled), n - 1);
  const local = scaled - i;
  const p0 = points[Math.max(0, i - 1)];
  const p1 = points[i];
  const p2 = points[i + 1];
  const p3 = points[Math.min(n, i + 2)];
  return [
    catmullRom(p0[0], p1[0], p2[0], p3[0], local),
    catmullRom(p0[1], p1[1], p2[1], p3[1], local),
    catmullRom(p0[2], p1[2], p2[2], p3[2], local),
  ];
}

// Opening set-piece (hero → truck assembly/load → departure) → services
// pullback → dissolve → light close. Keyframes land roughly at the
// SECTIONS boundaries: 0 hero rest, 0.2 mid-assembly, 0.4 set-piece
// release / services start, 0.6 guarantees/dissolve, 0.8 testimonials,
// 1.0 CTA.
const HOME_POSITIONS: Vec3[] = [
  [0, 0.65, 6.0],
  [0.3, 0.6, 6.6],
  [-0.5, 0.9, 7.6],
  [0.2, 0.7, 7.2],
  [1.0, 0.9, 8.4],
  [0, 1.4, 10.0],
];

const HOME_TARGETS: Vec3[] = [
  [0, -0.35, 0],
  [0.2, -0.1, 0],
  [0, 0.15, 0],
  [0, 0.1, 0],
  [-0.8, 0.2, 0],
  [-1.6, 0.3, 0],
];

// Calmer, shorter, stays wide.
const ABOUT_POSITIONS: Vec3[] = [
  [1.4, 0.6, 7.2],
  [0.8, 1.0, 7.8],
  [-0.4, 1.1, 8.4],
  [-1.0, 1.3, 9.0],
];

const ABOUT_TARGETS: Vec3[] = [
  [0, 0.2, 0],
  [0, 0.3, 0],
  [0, 0.3, 0],
  [0, 0.4, 0],
];

export function sampleHomeCamera(p: number): CameraSample {
  const t = clamp01(p);
  return {
    position: sampleSpline(HOME_POSITIONS, t),
    lookAt: sampleSpline(HOME_TARGETS, t),
    fov: 42 + t * 6,
  };
}

export function sampleAboutCamera(p: number): CameraSample {
  const t = clamp01(p);
  return {
    position: sampleSpline(ABOUT_POSITIONS, t),
    lookAt: sampleSpline(ABOUT_TARGETS, t),
    fov: 46,
  };
}
