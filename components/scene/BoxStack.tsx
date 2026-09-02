'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { usePathname } from 'next/navigation';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { getMoveAsOneProgress } from '@/lib/move-as-one-progress';
import { clamp01, lerp } from '@/lib/scroll-math';
import { COLORS, ROAD_SURFACE_Y } from '@/lib/constants';
import { cardboardTexture, cardboardRoughness } from '@/lib/textures';
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
const HERO_OFFSET_Y = ROAD_SURFACE_Y;
const HERO_OFFSET_Z = 0.15;

// Round 16 hand-tuned the stack's world X to 3.15 by eye at 1920/2000
// only. The camera is perspective, so the visible world width at any
// given depth grows with aspect ratio rather than staying fixed — a
// single world-X that clears the frame at a wide aspect runs the stack
// off the right edge at a narrower one (confirmed at 1512 wide). Instead
// of another fixed constant, the stack's X is derived every frame from
// the camera's own visible half-width at the stack's depth, so it stays
// a consistent *fraction* of frame width — reading as anchored in the
// right third — at any viewport size.
//
// The hero-rest camera pose is fixed (HOME_POSITIONS[0] / fov in
// lib/camera-path.ts: position [0, 0.65, 6.0], fov 42, looking straight
// down -Z since its look-at X also sits at 0) — this is the pose the
// hero-at-rest stack is composed against, so its geometry is used
// directly rather than sampled from the live (already-animating)
// camera.
const HERO_CAMERA_FOV_DEG = 42;
const HERO_CAMERA_DISTANCE = 6.0 - HERO_OFFSET_Z;

// Fraction of the camera's visible half-width, at the stack's depth,
// that the stack's right-hand extent (not its centre) is allowed to
// reach — i.e. how far inside the frame's right edge the stack's
// outermost box corner must stay. This is a margin fraction, not a
// centre-placement fraction, so it does not need re-tuning when
// BOX_SPECS changes size: the actual footprint (STACK_RIGHT_EXTENT,
// derived from the real box dimensions below) is subtracted from the
// visible half-width to find where the centre needs to sit. Verified at
// 1024/1440/1512/1920/2000 wide and at short/wide aspects (e.g.
// 1568x572) where a fixed centre-fraction previously ran the stack off
// the right edge once BOX_SPECS grew.
const HERO_STACK_MARGIN_FRACTION = 0.86;

function heroStackX(aspect: number): number {
  const halfHeight = Math.tan((HERO_CAMERA_FOV_DEG * Math.PI) / 360) * HERO_CAMERA_DISTANCE;
  const halfWidth = halfHeight * aspect;
  return halfWidth * HERO_STACK_MARGIN_FRACTION - STACK_RIGHT_EXTENT;
}

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
// units, scaled 1.5x from the previous hero size (round 18: "same boxes
// enlarged, cover up more space on the right") so the stack fills
// noticeably more of the frame at rest. They shrink by LOAD_SHRINK as
// they settle into the truck (see below) — LOAD_SHRINK was deepened by
// the same 1.5x factor so the final in-bay size is unchanged from before
// this round; only the hero-rest size grew.
const BOX_SPECS: BoxSpec[] = [
  { size: [1.29, 1.08, 1.17], color: COLORS.cardboardTan, restRotationY: 0.08, loadDelay: 0 },
  { size: [0.93, 0.78, 0.87], color: COLORS.cardboardTanDark, restRotationY: -0.16, loadDelay: 0.22 },
  { size: [1.05, 0.9, 0.99], color: COLORS.cardboardTan, restRotationY: 0.3, loadDelay: 0.44 },
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

// Bounds of the load-in window, in the pin's own local progress. Hoisted
// to module scope (they were local to useFrame) so the audio layer can
// derive when each box actually lands instead of re-typing the numbers
// and drifting out of sync with the animation.
const BOX_TRAVEL_START = 0.28;
const BOX_TRAVEL_END = 0.75;

// Fraction of a box's own delayed progress at which its approach eases
// out — the moment it has arrived in the bay and stops moving. This, not
// delayedP = 1, is when a box visually lands.
const APPROACH_COMPLETE = 0.6;

/**
 * The pin-local progress at which each box touches down, in order.
 * Consumed by the scene's audio layer so a thud fires on the frame a box
 * actually settles.
 */
export const BOX_LANDING_LOCALS: readonly number[] = BOX_SPECS.map((spec) => {
  const p = spec.loadDelay + APPROACH_COMPLETE * (1 - spec.loadDelay);
  return BOX_TRAVEL_START + p * (BOX_TRAVEL_END - BOX_TRAVEL_START);
});

// Each resting box scales down by this factor as it settles into the
// truck (enterEase 0 -> 1 below) — the hero sizes above are deliberately
// large for the empty-looking hero frame, but the cargo bay's *interior*
// is fixed geometry (see TruckAssembly's CARGO_* constants) that cannot
// grow to match. Shrinking on the way in reads as natural
// perspective/settling rather than boxes clipping through a wall, and
// keeps every rest slot verifiably inside the bay (see CARGO_FIT below).
// Round 18 enlarged BOX_SPECS by 1.5x, so this was deepened from 0.6 to
// 0.6 / 1.5 = 0.4 in lockstep — hero size * LOAD_SHRINK (the effective
// in-bay size) is unchanged from before this round, only the hero-rest
// size grew.
const LOAD_SHRINK = 0.4;

/**
 * Peak idle yaw sway of a resting hero box, in radians (~4.6°). Small on
 * purpose: these are cartons sitting on a road, not objects in orbit.
 */
const IDLE_SWAY = 0.08;

/**
 * Bob phase per box, keyed by which resting stack it belongs to.
 *
 * Boxes 0 and 1 are one stack (box 1 sits on box 0's top face), so they
 * share a phase and rise and fall together. Box 2 stands alone on the
 * ground beside them and gets its own phase, so the group still does not
 * pulse in unison.
 */
const BOB_PHASE = [0, 0, 1.6];

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

// The stack's own rightmost extent, in world units from its group
// origin: the outermost box's local x offset plus its own half-width.
// heroStackX() uses this — derived from the real BOX_SPECS/HERO_STACK_LOCAL
// geometry, not a re-tuned constant — to keep that actual right edge
// inside the frame, so a future resize of BOX_SPECS can't silently push
// the stack past the visible edge again.
const STACK_RIGHT_EXTENT = Math.max(
  ...BOX_SPECS.map((spec, i) => HERO_STACK_LOCAL[i][0] + spec.size[0] / 2)
);

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

  // One texture per box, built once. The colour tint is still applied
  // through `color`, so the two cardboard shades share a single grain
  // pattern rather than paying for two canvases.
  const map = useMemo(() => {
    const t = cardboardTexture('#FFFFFF');
    t.repeat.set(Math.max(1, w * 0.9), Math.max(1, h * 0.9));
    return t;
  }, [w, h]);
  const rough = useMemo(() => {
    const t = cardboardRoughness();
    t.repeat.set(Math.max(1, w * 0.9), Math.max(1, h * 0.9));
    return t;
  }, [w, h]);

  useEffect(() => {
    // Canvas textures hold a GPU allocation; drop it if the box unmounts.
    return () => {
      map.dispose();
      rough.dispose();
    };
  }, [map, rough]);

  return (
    <group ref={groupRef}>
      {/* The kraft texture and its matching roughness map are what stop
          these reading as moulded plastic: real cartons have visible
          fibre grain and uneven dye, and a single flat colour with one
          roughness value gave every face an identical, synthetic
          highlight. Repeats are scaled by the box's own dimensions so
          the grain stays the same physical size on a large box and a
          small one instead of stretching to fit. */}
      <RoundedBox args={size} radius={Math.min(0.045, h * 0.08)} smoothness={3}>
        <meshStandardMaterial
          map={map}
          roughnessMap={rough}
          color={color}
          roughness={0.95}
          metalness={0}
        />
      </RoundedBox>

      {/* Packing tape across the top seam only.
          There used to be a matching strip down the front face and two
          dark flap-seam lines on the top. Both were single-sided planes
          lying on a box that rotates: as soon as a face turned away from
          the key light, meshStandardMaterial lit it from ambient alone
          and the light-tan tape rendered as a dark band across the
          carton. The top strip is the one that survives every angle the
          boxes are actually seen from, so it is the one that stays. */}
      <mesh position={[0, h / 2 + 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w * 0.22, d + 0.01]} />
        <meshStandardMaterial color={COLORS.packingTape} roughness={0.35} metalness={0.05} />
      </mesh>
    </group>
  );
}

export function BoxStack() {
  const pathname = usePathname();
  const boxRefs = useRef<(THREE.Group | null)[]>([]);
  const shadowRef = useRef<THREE.Mesh | null>(null);
  const shadowMatRef = useRef<THREE.MeshBasicMaterial | null>(null);
  // Recomputed only when the canvas itself resizes (not every frame),
  // via `size` from R3F's reactive store — this is what keeps the
  // stack's X a consistent frame-fraction across viewport widths
  // instead of a value tuned to whichever size it was last measured at.
  const size = useThree((s) => s.size);
  const heroX = useMemo(() => heroStackX(size.width / size.height), [size.width, size.height]);

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
      if (shadowRef.current) shadowRef.current.visible = false;
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
    //
    // Round 19: the window's *start* is held back to BOX_TRAVEL_START
    // rather than beginning the instant local > 0 — previously box 0
    // (loadDelay 0) started sweeping toward the truck immediately, while
    // the hero copy (see Opening.tsx's applyProgress) was still fully or
    // mostly opaque, so a large box crossed directly through legible
    // text. BOX_TRAVEL_START sits just after the hero copy's own fade
    // finishes (opacity reaches 0 at progress 0.26), so no box begins
    // moving until the text column is already empty — a clean handoff
    // instead of an overlap. p still reaches 1 at local = 0.75 exactly
    // as before, so the door-close coupling is unaffected.
    const p = clamp01(
      (local - BOX_TRAVEL_START) / (BOX_TRAVEL_END - BOX_TRAVEL_START),
    );

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
      const approachEase = 1 - Math.pow(1 - clamp01(delayedP / APPROACH_COMPLETE), 3);
      // Round 19: enterT's start was brought forward from 0.55 to 0.32
      // (still finishing at delayedP = 1, so the final in-bay
      // position/size — verified by CARGO_FIT below — is unchanged) so
      // the LOAD_SHRINK scale-down begins well before the box reaches
      // the truck instead of mostly after. Previously a box was still at
      // ~full hero scale for most of its approach, so during the part of
      // the travel where the box and the truck were both in frame
      // together the box visibly dwarfed the whole vehicle. Shrinking
      // earlier means the box is already close to its believable in-bay
      // size by the time it's alongside the truck.
      const enterT = clamp01((delayedP - 0.32) / 0.68);
      const enterEase = enterT * enterT * (3 - 2 * enterT);

      // Boxes that rest on each other must bob as one body. This used
      // to be phased by `+ i`, which gave box 1 a different vertical
      // offset from the box 0 it is stacked on: the two drifted into and
      // out of each other by up to twice the bob amplitude, opening a
      // gap and then interpenetrating, once per cycle. Phase is per
      // stack, not per box, so a stack moves rigidly.
      const bob =
        Math.sin(state.clock.elapsedTime * 0.5 + BOB_PHASE[i]) *
        0.06 *
        (1 - approachEase);
      // A small bounded sway, not a rotation. This used to be
      // `elapsedTime * 0.12`, which accumulated without limit — a box
      // was a few degrees off after a second but several radians round
      // after a minute, so how much the boxes spun on their way into the
      // truck depended entirely on how long the page had been open. A
      // sine keeps the idle motion alive while never exceeding
      // IDLE_SWAY, and the phase offset keeps the three boxes from
      // swaying in lockstep.
      const idleSpin =
        Math.sin(state.clock.elapsedTime * 0.35 + i * 1.7) *
        IDLE_SWAY *
        (1 - approachEase);

      // The contact shadow belongs to the stack as it sits at the hero
      // position, not to any box once it starts travelling. Box 0
      // (loadDelay 0, the first to leave) sets the pace: its own
      // approachEase going from 0 -> 1 as it lifts off and heads for the
      // truck is exactly the signal that should fade the shadow out, so
      // it is gone by the time any box — let alone the page itself —
      // has moved past the hero rest position.
      if (i === 0 && shadowRef.current && shadowMatRef.current) {
        const shadowVisible = local < 1 && approachEase < 1;
        shadowRef.current.visible = shadowVisible;
        shadowMatRef.current.opacity = 0.35 * (1 - approachEase);
      }

      const stackLocal = HERO_STACK_LOCAL[i];
      const heroWorld: Vec3 = [
        heroX + stackLocal[0],
        HERO_OFFSET_Y + stackLocal[1] + bob,
        HERO_OFFSET_Z + stackLocal[2],
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
          before the boxes start moving. Visibility and opacity are
          driven every frame in useFrame above, tied to box 0's own
          approach progress — it only exists while the stack is actually
          resting at the hero position, fades as the boxes lift off, and
          is never visible once the page has moved past the hero (in
          particular never during the light/cream half of the page). */}
      <mesh
        ref={shadowRef}
        visible={false}
        // Sits just above the road surface. This used to be a bare
        // 0.005, which is 0.005 above the world origin — but the road is
        // at ROAD_SURFACE_Y (-1.35), so the disc floated ~1.35 units up,
        // at the exact height of the box resting on top of the stack.
        // A large translucent dark disc lying horizontally through a box
        // renders as a hard-edged dark band across it, which is what
        // looked like a strap around the carton. It came and went
        // between frames because this mesh's opacity is scroll-driven.
        position={[heroX, ROAD_SURFACE_Y + 0.005, HERO_OFFSET_Z]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <circleGeometry args={[STACK_FOOTPRINT_RADIUS, 24]} />
        <meshBasicMaterial
          ref={shadowMatRef}
          color={COLORS.asphaltDark}
          transparent
          opacity={0.35}
        />
      </mesh>
    </group>
  );
}
