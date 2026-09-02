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
// Keyframes 1-3 (mid-assembly through the loading beat) are pulled back
// further than a side-profile framing would need (round 8): the truck
// now holds a constant down-road heading (see TruckAssembly's
// DOWN_ROAD_YAW) instead of a 3/4 display angle, which puts its
// nose-to-tail length along the camera's view axis (depth) rather than
// spread across the frame (width) — so the same "close" distance that
// worked for a side-on view now put the rear door uncomfortably close
// to the camera. Pulling these three back keeps the whole truck (cab to
// open door) comfortably in frame.
//
// Keyframes 4-5 cover the departure. The truck's own transform
// (TruckAssembly's computeTruckGroupTransform) carries its world X from
// 0 to -0.6 as it drives away down world -Z, and it is already held
// dead-parallel to the road (DOWN_ROAD_YAW) for the whole of this move.
// For the rear door to read square-on rather than skewed, the camera's
// line of sight has to run parallel to that heading — i.e. straight
// down -Z — which means the camera position's X and the look-at
// target's X must land on the *same* value (round 14: they used to
// diverge, at x=1.0 → 0 for the camera vs x=-0.8 → -1.6 for the
// target, which cut diagonally across the road and exposed the truck's
// side no matter how correct its yaw was). Keyframe 4 eases partway
// into that alignment so the swing into the square-on view is gradual,
// and keyframe 5 lands both X values on the truck's own departure lane
// (-0.6) exactly.
const HOME_POSITIONS: Vec3[] = [
  [0, 0.65, 6.0],
  [0.3, 0.6, 8.8],
  [-0.5, 0.9, 9.8],
  [0.2, 0.7, 9.4],
  [-0.3, 1.1, 9.7],
  [-0.6, 1.3, 10.4],
];

// Keyframes 0-1 (the hero rest pose and early assembly) used to aim at
// positive X (0.55 / 0.5), which yaws the camera right and pushes the
// road's vanishing point well left of centre — that was the client's
// "the road does not look center" complaint (round 16). Both now aim at
// x=0, matching keyframe 2's target and, for keyframe 0, the camera's
// own position X (also 0) — that equality is what makes the hero-rest
// look straight down the road instead of across it. The box stack's
// right-third placement is handled entirely by BoxStack's own
// HERO_OFFSET now that the camera isn't already skewing the frame left
// to "balance" it.
//
// Keyframes 4-5: see the comment on HOME_POSITIONS above — these two
// targets converge their X onto the camera's own X (rather than sitting
// further left, as they used to) and push out along -Z to sit far down
// the road, so camera→target runs parallel to the truck's departure
// heading instead of cutting across it.
const HOME_TARGETS: Vec3[] = [
  [0, -0.35, 0],
  [0, -0.1, 0],
  [0, 0.15, 0],
  [0, 0.1, 0],
  [-0.5, 0.25, -4],
  [-0.6, 0.3, -18],
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
