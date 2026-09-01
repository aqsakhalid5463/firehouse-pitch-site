'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { usePathname } from 'next/navigation';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { getMoveAsOneProgress, getExitProgress } from '@/lib/move-as-one-progress';
import { clamp01, lerp } from '@/lib/scroll-math';
import { COLORS, ROAD_SURFACE_Y } from '@/lib/constants';

export type Vec3 = [number, number, number];

type AssemblyPiece = {
  from: Vec3;
  to: Vec3;
  at: number; // local progress at which this piece starts arriving
};

// Assembly runs roughly 0.15..0.45 of the pin's progress, after the hero
// copy has had its moment and while the hero box stack is still drifting
// in from centre-frame, so the truck is ready to receive it as cargo.
// These from/to/at values are unchanged from the previous build — the
// hero box stack's convergence target (BoxStack.tsx) is tuned against
// the box body's final position below, so moving it would reopen that
// handoff.
const CHASSIS: AssemblyPiece = { from: [0, -6, 0], to: [0, -0.55, 0], at: 0.15 };
const CAB: AssemblyPiece = { from: [-8, 0, 0], to: [-1.75, 0.15, 0], at: 0.22 };
const BODY: AssemblyPiece = { from: [8, 0, 0], to: [0.7, 0.5, 0], at: 0.32 };

const WHEEL_POSITIONS: Vec3[] = [
  [-1.7, -0.75, 0.9],
  [-1.7, -0.75, -0.9],
  [1.2, -0.75, 0.9],
  [1.2, -0.75, -0.9],
];
const WHEEL_RADIUS = 0.36;

// The whole assembly is built in local coordinates with its wheel
// centres at y = -0.75 (see WHEEL_POSITIONS), and the outer group is
// itself uniformly scaled (see baseScale/recedeScale below) rather than
// held at unit scale — so the vertical offset that puts the wheels on
// ROAD_SURFACE_Y has to scale with it too, not be a fixed constant.
// wheelBottomLocal is the unscaled distance from the group's own origin
// down to the tyre contact patch.
const wheelBottomLocal = WHEEL_POSITIONS[0][1] - WHEEL_RADIUS;
export function truckGroundY(scale: number): number {
  return ROAD_SURFACE_Y - scale * wheelBottomLocal;
}

// The base uniform scale the truck group sits at once its pop-in ramp
// (`show`) has finished (see useFrame below) and before departure's
// recede-scale kicks in — i.e. the scale in effect for the whole
// assembly + load window. Exported so BoxStack can convert truck-local
// cargo coordinates into world space for the same "at rest, mid-load"
// truck pose without duplicating the constant.
export const TRUCK_LOAD_SCALE = 0.62;

// The truck's local -X is its nose (cab, headlights face +X so the
// grille/lights point toward the tail — the truck's front is -X) and
// local +X is the rear roller door. DOWN_ROAD_YAW (-PI/2) is dead-parallel
// with the road: local -X points down world -Z (the same direction
// Highway streams its dashes and the departure recedes toward), the
// door faces world +Z straight at the camera, and no side wall is
// visible at all. That is the *only* orientation the truck may be at
// once it starts moving (see the exit block in useFrame) — the client
// was explicit that no side of the truck should ever be visible while
// it drives away.
//
// Held for the whole assembly + load, dead-on flattens the truck into a
// straight-on silhouette where the cab, sides and door all foreshorten
// onto the same sightline, so ASSEMBLY_YAW backs off 20° from dead-on
// for that earlier phase only — enough off-axis that the side wall and
// the open door are both legible together while boxes are loading in,
// which a flat rear view can make hard to read. The truck holds
// ASSEMBLY_YAW through assembly and loading, then eases the rest of the
// way to *exactly* DOWN_ROAD_YAW — not a nearby approximation — well
// before the departure move actually starts covering ground (see the
// fast, independent yawEase ramp below), so by the time it is visibly
// moving it is square to the road with only its rear face showing.
const DOWN_ROAD_YAW = -Math.PI / 2;
export const ASSEMBLY_YAW = -Math.PI / 2 + 0.35;

// Truck-local coordinates (pre-scale, pre-rotation) that the hero box
// stack's own convergence (see BoxStack.tsx) targets: a waypoint just
// outside the open rear door that the boxes pass through, then two
// distinct resting slots on the cargo floor. Owned here because they
// are defined relative to the body's own geometry (the door sits at
// truck-local x = 1.51 + the body's assembled x-offset 0.7 = 2.21; the
// floor sits at truck-local y = -0.91 + the body's y-offset 0.5 = -0.41
// — see the body group below), so if that geometry ever moves these
// move with it.
export const DOOR_ENTRY_LOCAL: Vec3 = [3.4, 0.15, 0];
// Truck-local Y for these rest slots has to land each box's *world*
// half-height on the truck-local floor (y = -0.41) after the truck
// group's own uniform scale (TRUCK_LOAD_SCALE) is applied — box
// geometry is authored directly in world units in BoxStack, not
// truck-local ones, so a naive "floor + local half-height" undershoots
// by exactly that scale factor and buries the box in the floor. The
// values below are floor (-0.41) plus each box's own world half-height
// divided by TRUCK_LOAD_SCALE, so the boxes actually sit on the floor,
// not embedded in it or floating above it.
//
// The z offsets (the bay's side-to-side axis) are kept well inside the
// interior side walls, which sit at local z = ±0.835 (± 0.518 world
// once TRUCK_LOAD_SCALE is applied): a box's world half-depth is never
// scaled down the way its position is, so these offsets were re-picked
// against BoxStack's current (smaller) box sizes to leave real
// clearance on both sides instead of poking through a wall — the
// previous, larger boxes at z = 0.22 / -0.28 cleared the wall by less
// than a box's own half-depth and clipped through it.
export const CARGO_REST_LOCAL: Vec3[] = [
  [0.55, -0.41 + 0.23 / TRUCK_LOAD_SCALE, 0.12],
  [-0.05, -0.41 + 0.18 / TRUCK_LOAD_SCALE, -0.15],
];

/** Rotates+scales a truck-local point into world space for a given yaw/scale/origin. */
export function truckLocalToWorld(local: Vec3, yaw: number, scale: number, origin: Vec3): Vec3 {
  const [lx, ly, lz] = local;
  const x = lx * Math.cos(yaw) + lz * Math.sin(yaw);
  const z = -lx * Math.sin(yaw) + lz * Math.cos(yaw);
  return [origin[0] + scale * x, origin[1] + scale * ly, origin[2] + scale * z];
}

export type TruckGroupTransform = {
  position: Vec3;
  rotationY: number;
  scale: number;
  visible: boolean;
};

/**
 * The truck's whole-group transform (position/yaw/scale/visibility) as a
 * pure function of the pin's local progress and elapsed time — the same
 * formula TruckAssembly's own useFrame applies to its outer group.
 * Exported so BoxStack can carry the cargo boxes through exactly the
 * same departure motion (and the same local >= 1 disappearance) once
 * they've become the truck's cargo, instead of drifting the two out of
 * sync or leaving the boxes behind on the road.
 */
export function computeTruckGroupTransform(local: number, elapsedTime: number): TruckGroupTransform {
  const exit = getExitProgress();
  const exitEase = exit * exit * exit;
  const bob = Math.sin(elapsedTime * 7.5) * 0.008 * (1 - exitEase * 0.6);
  const show = clamp01(local / 0.03);
  const baseScale = TRUCK_LOAD_SCALE * show;
  const recedeScale = baseScale * lerp(1, 0.22, exitEase);
  const yawT = clamp01(exit / 0.22);
  const yawEase = yawT * yawT * (3 - 2 * yawT);
  return {
    position: [lerp(0, -0.6, exitEase), truckGroundY(recedeScale) + bob, lerp(0, -34, exitEase)],
    rotationY: lerp(ASSEMBLY_YAW, DOWN_ROAD_YAW, yawEase),
    scale: recedeScale,
    visible: show > 0.01 && local < 1,
  };
}

// Rear roller-door: opens just before cargo starts arriving, stays open
// through the whole load, then rolls shut before the truck turns to
// leave — all before EXIT_START (see move-as-one-progress.ts) so the
// departure never shows an open door.
const DOOR_OPEN_START = 0.33;
const DOOR_OPEN_END = 0.4;
const DOOR_CLOSE_START = 0.75;
const DOOR_CLOSE_END = 0.82;
const DOOR_SLAT_COUNT = 7;
const DOOR_OPEN_LIFT = 2.05; // nominal travel; clamped per-slat by DOOR_COIL_Y below
// The body's roof sits at y = 0.91 (see the roof mesh below). A roller
// door coils onto a barrel just under that ceiling, not into open sky —
// DOOR_COIL_Y is where each slat's rise gets clamped so the coil forms
// flush against the underside of the roof instead of floating above it.
const DOOR_COIL_Y = 0.74;

// There is no truck-owned cargo array any more: the hero box stack IS
// the cargo (see BoxStack.tsx) — it travels through the open rear door
// itself and comes to rest at CARGO_REST_LOCAL above, and stays visible
// there. Nothing is duplicated, nothing fades out and back in.

/** 0 at `at`, 1 by `at + 0.12`, eased. */
function partProgress(local: number, at: number): number {
  const t = clamp01((local - at) / 0.12);
  return 1 - Math.pow(1 - t, 3);
}

/** 0 before `start`, 1 by `end`, smoothstepped. Used for the door. */
function windowProgress(local: number, start: number, end: number): number {
  const t = clamp01((local - start) / (end - start));
  return t * t * (3 - 2 * t);
}

function driveGroup(
  group: THREE.Group | null,
  piece: AssemblyPiece,
  local: number,
): number {
  if (!group) return 0;
  const t = partProgress(local, piece.at);
  group.position.set(
    lerp(piece.from[0], piece.to[0], t),
    lerp(piece.from[1], piece.to[1], t),
    lerp(piece.from[2], piece.to[2], t),
  );
  group.scale.setScalar(t);
  group.visible = t > 0.001;
  return t;
}

export function TruckAssembly() {
  const group = useRef<THREE.Group>(null);
  const pathname = usePathname();
  const chassisRef = useRef<THREE.Group>(null);
  const cabRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const wheelRefs = useRef<(THREE.Group | null)[]>([]);
  const wheelSpinRefs = useRef<(THREE.Group | null)[]>([]);
  const tailLightRefs = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const doorSlatRefs = useRef<(THREE.Mesh | null)[]>([]);
  const doorPanelRef = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    // Real pin-relative progress from ScrollTrigger (0 before the pin is
    // reached, 1 once it releases) — robust to the page's total height
    // changing as later tasks add sections after this one.
    const local = getMoveAsOneProgress();
    // The exit is driven off the pin's own local progress (see
    // getExitProgress / EXIT_START in lib/move-as-one-progress.ts), not
    // the dissolve — this set-piece opens the page, long before the
    // dissolve exists on screen, so the truck can't weld its exit to
    // "the background turning cream" the way an earlier build did.
    //
    // The departure itself is a drive-away rather than a sideways slide:
    // the truck, already oriented down the road (DOWN_ROAD_YAW) for the
    // whole assembly + load, commits fully to that heading, accelerates
    // into the distance with an eased-in (ease-in-cubic) recession so it
    // reads as pulling away rather than drifting, and fades out over the
    // back half of the departure so it never dwindles to an unreadable
    // speck before it's gone — the fade finishes and the pin releases
    // before the shrink would otherwise make it disappear.
    const exit = getExitProgress();
    const exitEase = exit * exit * exit; // ease-in: accelerates

    // Rolling + idle vibration: a wheel spin driven mostly by the
    // departure speed with a small ambient creep beforehand, plus a
    // subtle suspension pitch so the parked truck reads as sitting
    // on its suspension rather than a placed prop.
    const spinSpeed = 0.6 + exitEase * 22;
    // The idle suspension pitch is only for the parked/loading truck —
    // the client was explicit that the departing truck must show no
    // tilt at all, so this dies out completely well before the truck is
    // actually moving (see yawT below, which the pitch fade-out shares).
    const yawT = clamp01(exit / 0.22);
    const yawEase = yawT * yawT * (3 - 2 * yawT);
    const pitch = Math.sin(state.clock.elapsedTime * 5.1) * 0.004 * (1 - yawEase);

    if (group.current) {
      // Single source of truth for the whole-group transform, shared
      // with BoxStack (see computeTruckGroupTransform) so the cargo
      // boxes ride along with exactly this motion once they've become
      // the truck's cargo, instead of two independently-tuned copies
      // drifting out of sync.
      const t = computeTruckGroupTransform(local, state.clock.elapsedTime);
      // The opening pin's ScrollTrigger (and therefore local) only ever
      // advances on the home route, so it holds a stale value on
      // /about — route-gate explicitly rather than trust it there.
      group.current.visible = pathname !== '/about' && t.visible;
      group.current.scale.setScalar(t.scale);
      group.current.position.set(t.position[0], t.position[1], t.position[2]);
      group.current.rotation.y = t.rotationY;
      group.current.rotation.x = pitch;
    }

    driveGroup(chassisRef.current, CHASSIS, local);
    driveGroup(cabRef.current, CAB, local);
    driveGroup(bodyRef.current, BODY, local);

    wheelRefs.current.forEach((wheelGroup, i) => {
      if (!wheelGroup) return;
      const t = partProgress(local, 0.36 + i * 0.02);
      wheelGroup.scale.setScalar(t);
      wheelGroup.visible = t > 0.001;
    });
    // Spin is applied to a nested group so it composes cleanly with the
    // scale-in above instead of fighting it.
    wheelSpinRefs.current.forEach((spinGroup) => {
      if (!spinGroup) return;
      spinGroup.rotation.z += delta * spinSpeed;
    });

    // Tail lights glow up as the truck commits to leaving, on top of
    // their always-on low idle emissive.
    const tailGlow = 0.35 + exitEase * 3.2;
    tailLightRefs.current.forEach((mat) => {
      if (mat) mat.emissiveIntensity = tailGlow;
    });

    // Rear roller door: rolls up before cargo starts, rolls back down
    // once the last box has landed, well before EXIT_START so the truck
    // never drives off with the door showing open.
    const doorOpen = windowProgress(local, DOOR_OPEN_START, DOOR_OPEN_END);
    const doorClose = windowProgress(local, DOOR_CLOSE_START, DOOR_CLOSE_END);
    const doorT = clamp01(doorOpen - doorClose);
    doorSlatRefs.current.forEach((slat, i) => {
      if (!slat) return;
      const baseY = -0.8 + i * 0.24;
      // Each slat rises toward the coil under the roof, but is clamped
      // to DOOR_COIL_Y so it can never pass the ceiling and end up
      // floating in open air above the truck — it stacks into a coil
      // flush against the underside of the roof instead. Slats that
      // start higher up (larger i) reach the clamp sooner, which is
      // exactly how a real roller door's upper slats arrive at the
      // barrel first.
      slat.position.y = Math.min(baseY + doorT * DOOR_OPEN_LIFT, DOOR_COIL_Y);
      // Shrinking each slat toward the coil as it rises (real roller
      // doors wind onto a barrel above the opening) makes the door
      // visibly recede/compress into that coil instead of merely
      // relocating as a rigid block.
      slat.scale.y = lerp(1, 0.12, doorT);
    });
    // The solid closed-door panel (see JSX below) is the inverse of the
    // slats: fully covering the opening at doorT = 0, and gone by the
    // time the slats have visibly started coiling, so the two never
    // double up.
    if (doorPanelRef.current) {
      const panelVisible = doorT < 0.06;
      doorPanelRef.current.visible = panelVisible;
      const panelMat = doorPanelRef.current.material as THREE.MeshStandardMaterial;
      panelMat.opacity = clamp01(1 - doorT / 0.06);
    }
  });

  return (
    <group ref={group} position={[0, 0, 0]}>
      {/* Chassis */}
      <group ref={chassisRef}>
        <mesh>
          <boxGeometry args={[4.6, 0.22, 1.8]} />
          <meshStandardMaterial color={COLORS.truckChassis} roughness={0.6} metalness={0.35} />
        </mesh>
      </group>

      {/* Cab */}
      <group ref={cabRef}>
        <RoundedBox args={[1.3, 1.25, 1.7]} radius={0.12} smoothness={3}>
          <meshStandardMaterial color={COLORS.fireRed} roughness={0.45} metalness={0.25} />
        </RoundedBox>

        {/* Windshield — mounted on the cab's -X face, the true nose end
            (see the truck-local axis note above the CHASSIS/CAB/BODY
            consts): the previous build had this whole feature cluster
            mirrored onto +X, the face nearest the cargo body, which put
            the windshield/grille/headlights toward the tail instead of
            the nose and made the truck read as facing the camera
            (rather than away) during assembly. Rotation sign flipped to
            match the mirrored position so the rake still leans the
            right way. */}
        <mesh position={[-0.45, 0.32, 0]} rotation={[0, 0, 0.32]}>
          <boxGeometry args={[0.06, 0.62, 1.42]} />
          <meshStandardMaterial
            color={COLORS.truckGlass}
            roughness={0.12}
            metalness={0.6}
            envMapIntensity={1.2}
          />
        </mesh>
        {/* Side windows */}
        <mesh position={[-0.02, 0.34, 0.86]}>
          <boxGeometry args={[0.86, 0.42, 0.03]} />
          <meshStandardMaterial color={COLORS.truckGlass} roughness={0.15} metalness={0.55} />
        </mesh>
        <mesh position={[-0.02, 0.34, -0.86]}>
          <boxGeometry args={[0.86, 0.42, 0.03]} />
          <meshStandardMaterial color={COLORS.truckGlass} roughness={0.15} metalness={0.55} />
        </mesh>

        {/* Grille — nose face (-X), see note above. */}
        <mesh position={[-0.66, -0.28, 0]}>
          <boxGeometry args={[0.04, 0.34, 1.1]} />
          <meshStandardMaterial color={COLORS.truckGrille} roughness={0.5} metalness={0.6} />
        </mesh>

        {/* Headlights — nose face (-X), see note above. */}
        <mesh position={[-0.66, -0.1, 0.62]}>
          <boxGeometry args={[0.05, 0.16, 0.24]} />
          <meshStandardMaterial
            color={COLORS.headlightWhite}
            emissive={COLORS.headlightWhite}
            emissiveIntensity={1.6}
            roughness={0.3}
          />
        </mesh>
        <mesh position={[-0.66, -0.1, -0.62]}>
          <boxGeometry args={[0.05, 0.16, 0.24]} />
          <meshStandardMaterial
            color={COLORS.headlightWhite}
            emissive={COLORS.headlightWhite}
            emissiveIntensity={1.6}
            roughness={0.3}
          />
        </mesh>

        {/* Side mirrors — nose end (-X), see note above. */}
        <mesh position={[-0.55, 0.28, 0.92]}>
          <boxGeometry args={[0.16, 0.2, 0.04]} />
          <meshStandardMaterial color={COLORS.truckChrome} roughness={0.3} metalness={0.8} />
        </mesh>
        <mesh position={[-0.55, 0.28, -0.92]}>
          <boxGeometry args={[0.16, 0.2, 0.04]} />
          <meshStandardMaterial color={COLORS.truckChrome} roughness={0.3} metalness={0.8} />
        </mesh>
      </group>

      {/* Box body: built from separate panels (roof/floor/sides/front)
          rather than one sealed solid, deliberately leaving the rear
          (local +x) open — that opening is what the roller door
          actually covers/reveals. A single solid box could never show
          cargo passing through its rear face. */}
      <group ref={bodyRef}>
        {/* Roof */}
        <mesh position={[0, 0.91, 0]}>
          <boxGeometry args={[3.0, 0.08, 1.75]} />
          <meshStandardMaterial color={COLORS.truckBoxBody} roughness={0.55} metalness={0.15} />
        </mesh>
        {/* Floor */}
        <mesh position={[0, -0.91, 0]}>
          <boxGeometry args={[3.0, 0.08, 1.75]} />
          <meshStandardMaterial color={COLORS.truckBoxBody} roughness={0.55} metalness={0.15} />
        </mesh>
        {/* Front wall (toward the cab) */}
        <mesh position={[-1.46, 0, 0]}>
          <boxGeometry args={[0.08, 1.9, 1.75]} />
          <meshStandardMaterial color={COLORS.truckBoxBody} roughness={0.55} metalness={0.15} />
        </mesh>
        {/* Side walls */}
        <mesh position={[0, 0, 0.835]}>
          <boxGeometry args={[3.0, 1.9, 0.08]} />
          <meshStandardMaterial color={COLORS.truckBoxBody} roughness={0.55} metalness={0.15} />
        </mesh>
        <mesh position={[0, 0, -0.835]}>
          <boxGeometry args={[3.0, 1.9, 0.08]} />
          <meshStandardMaterial color={COLORS.truckBoxBody} roughness={0.55} metalness={0.15} />
        </mesh>

        {/* Cargo-hold back wall — the true far wall of the bay, near the
            cab end, not a shortcut backdrop propped up just inside the
            door. It used to sit at +1.2 (i.e. *closer to the door* than
            the resting cargo), which meant it silently occluded any box
            resting further inside the bay — every box behind it from
            the camera's viewpoint simply vanished. Negative x puts it
            at the actual back of the hold, so nothing loaded in front
            of it is ever hidden. panelGrey rather than near-black
            truckGlass — a near-black backing plus a weak light read as
            a black void that swallowed the boxes inside it; a lit
            dark-grey panel gives the interior a visible surface to fall
            off against instead. */}
        <mesh position={[-1.2, 0, 0]}>
          <boxGeometry args={[0.06, 1.7, 1.55]} />
          <meshStandardMaterial color={COLORS.panelGrey} roughness={0.85} metalness={0} />
        </mesh>

        {/* Interior cargo light: clean white (brand palette has no warm
            tones), positioned mid-bay and bright/broad enough to
            actually reach the floor, side walls and back wall — not
            just a hot spot near the door — so the cardboard boxes read
            clearly against a properly lit interior. Tuned between the
            two failure modes this build has hit before: dim enough
            (and with real decay) that it still falls off toward the
            front of the bay instead of flattening into a white
            lightbox. */}
        <pointLight
          position={[0.1, 0.75, 0]}
          intensity={1.8}
          distance={4}
          decay={1.6}
          color={COLORS.headlightWhite}
        />
        <pointLight
          position={[-0.9, 0.35, 0]}
          intensity={0.6}
          distance={2.8}
          decay={1.7}
          color={COLORS.headlightWhite}
        />

        {/* Panel line running along the body */}
        <mesh position={[0, 0.05, 0.876]}>
          <boxGeometry args={[2.9, 0.03, 0.01]} />
          <meshStandardMaterial color={COLORS.truckChassis} roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.05, -0.876]}>
          <boxGeometry args={[2.9, 0.03, 0.01]} />
          <meshStandardMaterial color={COLORS.truckChassis} roughness={0.7} />
        </mesh>

        {/* Rear roller-door: a stack of thin horizontal slats that rolls
            straight up (see doorT in useFrame) to reveal the opening.
            Brushed-aluminum grey (truckChrome), not the near-black
            grille colour — a real roller door reads lighter than the
            body's shadowed underside, and against this night scene a
            dark-on-dark door was unreadable regardless of angle.

            Each slat is taller (0.244) than the 0.24 pitch it's spaced
            on, so closed neighbours overlap by a hair instead of
            leaving a dark gap between them — reads as one solid panel,
            not a venetian blind — and the overlap also kills the
            z-fighting shimmer that showed along slat edges when they
            merely touched. A thin darker inset line near each slat's
            lower edge scores the segmentation into the surface instead
            of relying on a visible gap to read as a door made of
            slats. */}
        <group position={[1.51, 0, 0]}>
          {Array.from({ length: DOOR_SLAT_COUNT }).map((_, i) => (
            <mesh
              key={i}
              position={[0, -0.8 + i * 0.24, 0]}
              ref={(el) => {
                doorSlatRefs.current[i] = el;
              }}
            >
              <boxGeometry args={[0.02, 0.244, 1.6]} />
              <meshStandardMaterial color={COLORS.truckChrome} roughness={0.45} metalness={0.5} />
              {/* Scored line: sits just proud of the slat's own face so
                  it never shares an exact coplanar surface with it. */}
              <mesh position={[0.0105, -0.108, 0]}>
                <boxGeometry args={[0.001, 0.01, 1.58]} />
                <meshStandardMaterial color={COLORS.truckChassis} roughness={0.6} metalness={0.3} />
              </mesh>
            </mesh>
          ))}

          {/* Solid closed-door panel: covers the whole opening as one
              flush surface. Visible (and opaque) only while the slats
              are still essentially fully closed (see doorPanelRef in
              useFrame) — as soon as they start coiling, this fades out
              so the two never show at once, and the open state (fixed
              last round) is untouched. */}
          <mesh ref={doorPanelRef} position={[0.011, 0.005, 0]}>
            <boxGeometry args={[0.018, 1.84, 1.6]} />
            <meshStandardMaterial
              color={COLORS.truckChrome}
              roughness={0.45}
              metalness={0.5}
              transparent
            />
          </mesh>
          {/* Scored lines across the solid panel matching the slat
              pitch, so the closed door still reads as a segmented
              roller door rather than a featureless sheet. */}
          {Array.from({ length: DOOR_SLAT_COUNT - 1 }).map((_, i) => (
            <mesh key={`score-${i}`} position={[0.021, -0.68 + i * 0.24, 0]}>
              <boxGeometry args={[0.001, 0.01, 1.58]} />
              <meshStandardMaterial color={COLORS.truckChassis} roughness={0.6} metalness={0.3} />
            </mesh>
          ))}

          {/* Tail lights either side of the roller door */}
          {[0.68, -0.68].map((z, i) => (
            <mesh key={z} position={[0.02, -0.7, z]}>
              <boxGeometry args={[0.05, 0.24, 0.14]} />
              <meshStandardMaterial
                ref={(m) => {
                  tailLightRefs.current[i] = m;
                }}
                color={COLORS.tailLightRed}
                emissive={COLORS.tailLightGlow}
                emissiveIntensity={0.35}
                roughness={0.35}
              />
            </mesh>
          ))}
        </group>

        {/* Fenders / wheel arches, positioned relative to the assembled
            body so they read as part of it rather than floating props. */}
        <mesh position={[-2.45, -0.95, 0.9]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.44, 0.44, 0.22, 16, 1, false, 0, Math.PI]} />
          <meshStandardMaterial color={COLORS.truckChassis} roughness={0.7} metalness={0.2} />
        </mesh>
        <mesh position={[-2.45, -0.95, -0.9]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.44, 0.44, 0.22, 16, 1, false, 0, Math.PI]} />
          <meshStandardMaterial color={COLORS.truckChassis} roughness={0.7} metalness={0.2} />
        </mesh>
      </group>

      {/* Wheels: dark tyre + lighter rim, instanced per corner. An inner
          spin group carries the rolling rotation so it composes with the
          outer group's scale-in without fighting it. */}
      {WHEEL_POSITIONS.map((pos, i) => (
        <group
          key={`wheel-${i}`}
          ref={(el) => {
            wheelRefs.current[i] = el;
          }}
          position={pos}
        >
          <group
            ref={(el) => {
              wheelSpinRefs.current[i] = el;
            }}
          >
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[WHEEL_RADIUS, WHEEL_RADIUS, 0.24, 20]} />
              <meshStandardMaterial color={COLORS.truckTyre} roughness={0.95} />
            </mesh>
            <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, pos[2] > 0 ? 0.135 : -0.135]}>
              <cylinderGeometry args={[0.19, 0.19, 0.05, 16]} />
              <meshStandardMaterial color={COLORS.truckRim} roughness={0.35} metalness={0.75} />
            </mesh>
          </group>
        </group>
      ))}
      {/* No truck-owned cargo meshes here any more — the hero box stack
          (BoxStack.tsx) travels through the open door and rests inside
          the bay itself; see DOOR_ENTRY_LOCAL / CARGO_REST_LOCAL above. */}
    </group>
  );
}
