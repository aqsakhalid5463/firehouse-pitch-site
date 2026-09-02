'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { usePathname } from 'next/navigation';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { getMoveAsOneProgress } from '@/lib/move-as-one-progress';
import { clamp01, lerp } from '@/lib/scroll-math';
import { COLORS, ROAD_SURFACE_Y } from '@/lib/constants';
import {
  DOOR_ENTRY_LOCAL,
  CARGO_REST_LOCAL,
  CARGO_FLOOR_LOCAL_Y,
  CARGO_CEILING_LOCAL_Y,
  CARGO_WALL_LOCAL_Z,
  CARGO_FRONT_WALL_LOCAL_X,
  CARGO_REAR_OPENING_LOCAL_X,
  TRUCK_LOAD_SCALE,
  truckLocalToWorld,
  computeTruckGroupTransform,
  type Vec3,
} from './TruckAssembly';

// The stack lives in the right third of the hero frame so it never
// collides with the left-aligned headline. It starts here at rest, then
// travels through the truck's open rear door and comes to rest as the
// truck's own cargo (see useFrame below) — there is exactly one set of
// boxes; nothing is duplicated in TruckAssembly and nothing fades away.
//
// x = 2.6 is deliberately past Highway's painted edge line
// (EDGE_LANE_X = 1.7, see Highway.tsx) — the client's exact complaint
// was boxes sitting "on the side of the road" on that line. Highway's
// paved surface runs out to ROAD_HALF_WIDTH = 4.6, so 2.6 is still
// comfortably on the road surface itself (not the shoulder/verge)
// while staying clear of the centre-frame truck assembly.
const HERO_OFFSET: Vec3 = [2.6, ROAD_SURFACE_Y, 0.15];

type BoxSpec = {
  size: Vec3;
  color: string;
  restRotationY: number;
  // Fraction of the load window (0..1 over the full approach+enter
  // travel) at which this box's own journey starts — this is the
  // staggering that keeps the three boxes from ever occupying the same
  // space at the same time in flight (see delayedP in useFrame).
  loadDelay: number;
};

// Three cartons forming an actual moving-day pile: a large base box, a
// mid box resting squarely on top of it, and a third box set beside them
// on the ground — scaled up substantially from the old two-box pair (the
// client's "looks empty" complaint) so the stack reads as a confident
// feature of the right third of the frame. These are HERO sizes in world
// units; they shrink by LOAD_SHRINK as they settle into the truck (see
// below) rather than staying this large and clipping the bay.
const BOX_SPECS: BoxSpec[] = [
  { size: [0.86, 0.72, 0.78], color: COLORS.cardboardTan, restRotationY: 0.08, loadDelay: 0 },
  { size: [0.62, 0.52, 0.58], color: COLORS.cardboardTanDark, restRotationY: -0.16, loadDelay: 0.22 },
  { size: [0.7, 0.6, 0.66], color: COLORS.cardboardTan, restRotationY: 0.3, loadDelay: 0.44 },
];

// World-space (x, z) offsets from the door waypoint for each box's own
// "waiting near the door" position — box 0 sits right at the doorway
// (first in), box 1 queues further back and to one side, box 2 further
// back still and to the other side. Sized so that even if two boxes were
// at their waypoints at the same instant (defensive — the loadDelay
// stagger already keeps this from happening in practice) their full,
// unshrunk hero-size footprints still clear each other: the diagonal
// distance between any two offsets below exceeds the sum of those two
// boxes' half-depths (their largest horizontal dimension) plus a real
// margin.
const QUEUE_OFFSET: [number, number][] = [
  [0, 0],
  [0.6, -0.45],
  [1.2, 0.45],
];

// Every box beyond loadDelay = 0 must have fully arrived (its own local
// progress reaches 1) before the load window ends, or it would still be
// mid-flight when the door starts closing (DOOR_CLOSE_START in
// TruckAssembly). The remaining travel budget for the last box is
// (1 - loadDelay), so keep the largest delay well under 1.
const MAX_LOAD_DELAY = Math.max(...BOX_SPECS.map((b) => b.loadDelay));
if (MAX_LOAD_DELAY >= 0.6) {
  throw new Error('BoxStack: a box loadDelay leaves too little travel budget before the door closes');
}

// Each resting box scales down by this factor as it settles into the
// truck (enterEase 0 -> 1 below) — the hero sizes above are deliberately
// large for the empty-looking hero frame, but the cargo bay's *interior*
// is fixed geometry (see TruckAssembly's CARGO_* constants) that cannot
// grow to match. Shrinking slightly on the way in reads as natural
// perspective/settling rather than boxes clipping through a wall, and
// keeps every rest slot verifiably inside the bay (see CARGO_FIT below).
const LOAD_SHRINK = 0.6;

// Hero "at rest" local offsets. Box 0 is the base, sitting flat on the
// ground. Box 1 stacks on top of box 0: its resting Y is derived from
// box 0's own top face (centre Y + half its height) plus box 1's own
// half-height, so contact is exact by construction — overlap is
// impossible, not just untuned. Box 2 sits beside them on the ground,
// its own footprint kept clear of box 0's footprint (see the radius
// check below) rather than eyeballed.
const HERO_STACK_LOCAL: Vec3[] = (() => {
  const [w0, h0, d0] = BOX_SPECS[0].size;
  const [, h1] = BOX_SPECS[1].size;
  const [w2, h2] = BOX_SPECS[2].size;
  void d0;

  const box0Top = h0; // box0 centre sits at local y = h0/2 (ground = 0), so its top face is at h0.
  const box1RestY = box0Top + h1 / 2; // exact contact with box0's top face.

  // Box 2 rests on the ground beside box 0, its own footprint kept
  // clear of box 0's footprint by a real gap so their bevelled corners
  // never touch.
  const sideGapX = w0 / 2 + w2 / 2 + 0.06;

  return [
    [0, h0 / 2, 0],
    [-0.05, box1RestY, 0.05],
    [sideGapX, h2 / 2, 0.1],
  ];
})();

const STACK_FOOTPRINT_RADIUS =
  Math.max(BOX_SPECS[0].size[0], BOX_SPECS[0].size[2]) * 0.6 +
  Math.abs(HERO_STACK_LOCAL[2][0]) * 0.55;

// --- Cargo-fit sanity check --------------------------------------------
// Verifies, at module load, that every box's *shrunk* rest footprint
// clears the bay's floor, ceiling, both side walls, the front wall, the
// rear opening, and the other two boxes — computed, not eyeballed, so a
// future resize of BOX_SPECS or CARGO_REST_LOCAL fails loudly instead of
// silently clipping. All comparisons are in truck-local units: a box's
// world half-size is converted to a local-equivalent by dividing by
// TRUCK_LOAD_SCALE, matching how CARGO_REST_LOCAL itself is derived.
type LocalBox = { cx: number; cy: number; cz: number; hx: number; hy: number; hz: number };

const CARGO_FIT: LocalBox[] = BOX_SPECS.map((spec, i) => {
  const [w, h, d] = spec.size;
  const shrunkHalf: Vec3 = [
    (w * LOAD_SHRINK) / 2 / TRUCK_LOAD_SCALE,
    (h * LOAD_SHRINK) / 2 / TRUCK_LOAD_SCALE,
    (d * LOAD_SHRINK) / 2 / TRUCK_LOAD_SCALE,
  ];
  const [cx, cy, cz] = CARGO_REST_LOCAL[i];
  return { cx, cy, cz, hx: shrunkHalf[0], hy: shrunkHalf[1], hz: shrunkHalf[2] };
});

CARGO_FIT.forEach((box, i) => {
  const label = `BoxStack cargo fit (box ${i})`;
  if (box.cy - box.hy < CARGO_FLOOR_LOCAL_Y - 1e-4) throw new Error(`${label}: clips the floor`);
  if (box.cy + box.hy > CARGO_CEILING_LOCAL_Y + 1e-4) throw new Error(`${label}: clips the ceiling`);
  if (Math.abs(box.cz) + box.hz > CARGO_WALL_LOCAL_Z + 1e-4) throw new Error(`${label}: clips a side wall`);
  if (box.cx - box.hx < CARGO_FRONT_WALL_LOCAL_X - 1e-4) throw new Error(`${label}: clips the front wall`);
  if (box.cx + box.hx > CARGO_REAR_OPENING_LOCAL_X + 1e-4) throw new Error(`${label}: clips through the rear opening`);
});

for (let i = 0; i < CARGO_FIT.length; i++) {
  for (let j = i + 1; j < CARGO_FIT.length; j++) {
    const a = CARGO_FIT[i];
    const b = CARGO_FIT[j];
    const overlapX = Math.abs(a.cx - b.cx) < a.hx + b.hx;
    const overlapY = Math.abs(a.cy - b.cy) < a.hy + b.hy;
    const overlapZ = Math.abs(a.cz - b.cz) < a.hz + b.hz;
    if (overlapX && overlapY && overlapZ) {
      throw new Error(`BoxStack cargo fit: box ${i} and box ${j} intersect at rest`);
    }
  }
}
// ------------------------------------------------------------------------

function CardboardBox({
  size,
  color,
  groupRef,
}: {
  size: Vec3;
  color: string;
  groupRef: (el: THREE.Group | null) => void;
}) {
  const [w, h, d] = size;
  return (
    <group ref={groupRef}>
      <RoundedBox args={size} radius={Math.min(0.045, h * 0.08)} smoothness={3}>
        <meshStandardMaterial color={color} roughness={0.92} metalness={0.02} />
      </RoundedBox>

      {/* Packing tape: across the top seam and down the front face. */}
      <mesh position={[0, h / 2 + 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w * 0.22, d + 0.01]} />
        <meshStandardMaterial color={COLORS.packingTape} roughness={0.35} metalness={0.05} />
      </mesh>
      <mesh position={[0, 0, d / 2 + 0.002]}>
        <planeGeometry args={[w * 0.22, h + 0.01]} />
        <meshStandardMaterial color={COLORS.packingTape} roughness={0.35} metalness={0.05} />
      </mesh>

      {/* Flap seam lines on the top face, so it reads as a closed carton. */}
      <mesh position={[0, h / 2 + 0.003, d * 0.28]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w * 0.96, 0.012]} />
        <meshStandardMaterial color={COLORS.boxSeam} roughness={0.9} />
      </mesh>
      <mesh position={[0, h / 2 + 0.003, -d * 0.28]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w * 0.96, 0.012]} />
        <meshStandardMaterial color={COLORS.boxSeam} roughness={0.9} />
      </mesh>
    </group>
  );
}

export function BoxStack() {
  const pathname = usePathname();
  const boxRefs = useRef<(THREE.Group | null)[]>([]);

  useFrame((state) => {
    // The opening pin (and its GSAP ScrollTrigger) only exists on the
    // home route, so getMoveAsOneProgress() is never reset when
    // navigating to /about — it just holds whatever value it last had.
    // The canvas is shared across routes, so route-gate visibility
    // explicitly instead of trusting a progress value that only home
    // ever advances.
    if (pathname === '/about') {
      boxRefs.current.forEach((g) => {
        if (g) g.visible = false;
      });
      return;
    }

    const local = getMoveAsOneProgress();

    // The truck's whole-group transform (position/yaw/scale), read from
    // the same function TruckAssembly's own group uses. During assembly
    // + load this is static (exit progress is 0 until EXIT_START, long
    // after the boxes finish arriving); once departure begins, reusing
    // this function every frame is what lets the resting boxes ride
    // along with the truck instead of being left behind on the road.
    const truckT = computeTruckGroupTransform(local, state.clock.elapsedTime);
    const truckOrigin: Vec3 = truckT.position;
    const doorWorld = truckLocalToWorld(DOOR_ENTRY_LOCAL, truckT.rotationY, truckT.scale, truckOrigin);

    // Overall progress across the whole load-in window, finishing by
    // local = 0.75 — the same progress at which the rear door starts
    // rolling shut (see TruckAssembly's DOOR_CLOSE_START) — so all three
    // boxes have fully "become" the truck's cargo, resting still, before
    // the door closes and the truck drives off.
    const p = clamp01(local / 0.75);

    BOX_SPECS.forEach((spec, i) => {
      const g = boxRefs.current[i];
      if (!g) return;
      // Past local >= 1 the truck (and everything it carried off) is
      // gone — hide explicitly rather than leaving the boxes floating
      // on the road after the truck itself disappears (see
      // TruckAssembly's own `local < 1` gate).
      g.visible = local < 1;

      // Each box gets its own delayed, re-normalised progress so box 0
      // travels and settles, then box 1 follows, then box 2 — they are
      // never mid-flight at the same time, which is what keeps them
      // from passing through each other en route (the client's second
      // complaint). Before its delay elapses a box simply hasn't left
      // the hero stack yet.
      const delayedP = clamp01((p - spec.loadDelay) / (1 - spec.loadDelay));
      const approachEase = 1 - Math.pow(1 - clamp01(delayedP / 0.6), 3);
      const enterT = clamp01((delayedP - 0.55) / 0.45);
      const enterEase = enterT * enterT * (3 - 2 * enterT);

      const bob = Math.sin(state.clock.elapsedTime * 0.5 + i) * 0.06 * (1 - approachEase);
      const idleSpin = state.clock.elapsedTime * 0.12 * (1 - approachEase);

      const stackLocal = HERO_STACK_LOCAL[i];
      const heroWorld: Vec3 = [
        HERO_OFFSET[0] + stackLocal[0],
        HERO_OFFSET[1] + stackLocal[1] + bob,
        HERO_OFFSET[2] + stackLocal[2],
      ];
      // Each box has its own waypoint near the door rather than
      // literally the same point — offset both along the approach axis
      // (so later boxes queue further back, not stacked on the doorway
      // itself) and to the side (so a queued box and an entering box
      // never share a footprint). QUEUE_OFFSET is sized against the
      // boxes' own (unshrunk, pre-entry) half-depths — see its
      // definition above BOX_SPECS — so two boxes waiting at their
      // waypoints simultaneously still clear each other by construction,
      // independent of how well the loadDelay timing staggers them.
      const queue = QUEUE_OFFSET[i];
      const doorSlot: Vec3 = [
        doorWorld[0] + queue[0],
        doorWorld[1],
        doorWorld[2] + queue[1],
      ];
      const restWorld = truckLocalToWorld(CARGO_REST_LOCAL[i], truckT.rotationY, truckT.scale, truckOrigin);

      const approached: Vec3 = [
        lerp(heroWorld[0], doorSlot[0], approachEase),
        lerp(heroWorld[1], doorSlot[1], approachEase),
        lerp(heroWorld[2], doorSlot[2], approachEase),
      ];

      g.position.set(
        lerp(approached[0], restWorld[0], enterEase),
        lerp(approached[1], restWorld[1], enterEase),
        lerp(approached[2], restWorld[2], enterEase),
      );

      // Rotation settles from its carried tilt/spin to the truck's own
      // current heading as it lands, then keeps tracking that heading
      // (which only itself changes once departure's yaw-lock and turn
      // happen) so the box turns with the truck instead of staying
      // fixed while the truck rotates out from under it.
      const restingYaw = truckT.rotationY + spec.restRotationY;
      g.rotation.y = lerp(spec.restRotationY + idleSpin, restingYaw, enterEase);

      // Boxes shrink from hero scale (1) to LOAD_SHRINK as they settle
      // into the truck — the hero stack is deliberately large to fill
      // the frame, but the fixed cargo-bay interior can't grow to
      // match, so this reads as natural perspective/settling instead of
      // clipping through a wall (see CARGO_FIT above, which verifies
      // every box fits at exactly this shrunk size).
      g.scale.setScalar(lerp(1, LOAD_SHRINK, enterEase));
    });
  });

  return (
    <group>
      {BOX_SPECS.map((spec, i) => (
        <CardboardBox
          key={i}
          size={spec.size}
          color={spec.color}
          groupRef={(el) => {
            boxRefs.current[i] = el;
          }}
        />
      ))}
      {/* Contact shadow at the hero rest position: sells the grounding
          before the boxes start moving. */}
      <mesh position={[HERO_OFFSET[0], 0.005, HERO_OFFSET[2]]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[STACK_FOOTPRINT_RADIUS, 24]} />
        <meshBasicMaterial color={COLORS.asphaltDark} transparent opacity={0.35} />
      </mesh>
    </group>
  );
}
