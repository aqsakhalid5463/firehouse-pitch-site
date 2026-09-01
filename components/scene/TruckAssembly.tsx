'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { getMoveAsOneProgress, getExitProgress } from '@/lib/move-as-one-progress';
import { clamp01, lerp } from '@/lib/scroll-math';
import { COLORS, ROAD_SURFACE_Y } from '@/lib/constants';

type Vec3 = [number, number, number];

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
function truckGroundY(scale: number): number {
  return ROAD_SURFACE_Y - scale * wheelBottomLocal;
}

// The truck's local -X is its nose (cab, headlights face +X so the
// grille/lights point toward the tail — the truck's front is -X) and
// local +X is the rear roller door. At rotation.y = -PI/2 the assembly
// is dead-parallel with the road (local -X points down world -Z, the
// same direction Highway streams its dashes and the departure recedes
// toward) with the door facing world +Z, straight at the camera. That
// reads correctly for the final departure commit, but held for the
// whole assembly + load it flattens the truck into a straight-on
// silhouette — the cab, sides and door all foreshorten onto the same
// sightline, so the tan body colour barely shows and the shot reads as
// a near-black slab. ASSEMBLY_YAW backs off 20° from dead-on: still
// unmistakably oriented along the road (nothing like the old ~-15°
// display pose), but enough off-axis that the side wall and the open
// door are both legible together, satisfying "immediately face the
// road" without sacrificing "the door should be visible" during the
// load. The truck holds ASSEMBLY_YAW for the whole assembly + load,
// then rotates the rest of the way to dead-parallel as it commits to
// leaving.
const DOWN_ROAD_YAW = -Math.PI / 2;
const ASSEMBLY_YAW = -Math.PI / 2 + 0.35;

// Rear roller-door: opens just before cargo starts arriving, stays open
// through the whole load, then rolls shut before the truck turns to
// leave — all before EXIT_START (see move-as-one-progress.ts) so the
// departure never shows an open door.
const DOOR_OPEN_START = 0.33;
const DOOR_OPEN_END = 0.4;
const DOOR_CLOSE_START = 0.75;
const DOOR_CLOSE_END = 0.82;
const DOOR_SLAT_COUNT = 7;
const DOOR_OPEN_LIFT = 2.05; // clears the 0.91-high roofline with margin

// Cargo loads in 0.40..0.75 of the pin's progress, in lockstep with the
// hero box stack scaling down into the bay in BoxStack — the two should
// read as one continuous load, not two independent animations. Each
// box's `from` is out past the rear door (along local +X, the same axis
// the door slats sit on) so it visibly travels in through the opening
// rather than falling in from off-frame.
const CARGO: { position: Vec3; size: Vec3; at: number }[] = [
  { position: [0.0, -0.15, 0], size: [0.6, 0.45, 0.55], at: 0.4 },
  { position: [0.7, -0.15, 0.35], size: [0.5, 0.4, 0.5], at: 0.45 },
  { position: [0.7, -0.15, -0.35], size: [0.5, 0.4, 0.5], at: 0.5 },
  { position: [0.0, 0.35, 0], size: [0.55, 0.4, 0.5], at: 0.55 },
  { position: [0.6, 0.32, 0], size: [0.5, 0.36, 0.48], at: 0.6 },
  { position: [0.2, 0.66, 0], size: [0.45, 0.3, 0.44], at: 0.63 },
];
const CARGO_ENTRY_OFFSET = 3; // world units outside the rear door the boxes travel in from

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
  const chassisRef = useRef<THREE.Group>(null);
  const cabRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const wheelRefs = useRef<(THREE.Group | null)[]>([]);
  const wheelSpinRefs = useRef<(THREE.Group | null)[]>([]);
  const cargoRefs = useRef<(THREE.Mesh | null)[]>([]);
  const tailLightRefs = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const doorSlatRefs = useRef<(THREE.Mesh | null)[]>([]);

  // Built once — no per-frame allocation in useFrame.
  const cargoBoxes = useMemo(() => CARGO, []);

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
    // subtle suspension bob/pitch so the parked truck reads as sitting
    // on its suspension rather than a placed prop.
    const spinSpeed = 0.6 + exitEase * 22;
    const bob = Math.sin(state.clock.elapsedTime * 7.5) * 0.008 * (1 - exitEase * 0.6);
    const pitch = Math.sin(state.clock.elapsedTime * 5.1) * 0.004 * (1 - exitEase * 0.6);

    if (group.current) {
      // Fades in quickly once the pin engages (individual parts also start
      // invisible at local=0, this just softens the whole-group pop-in).
      const show = clamp01(local / 0.03);
      // Past local >= 1 (pin released) the truck has fully driven off;
      // switch it off explicitly rather than relying on frustum culling.
      group.current.visible = show > 0.01 && local < 1;

      const baseScale = 0.62 * show;
      // Recedes down the road (world -z, the same direction Highway's
      // dashes stream toward) while shrinking with perspective — but the
      // fade below finishes well before the scale would read as a speck.
      const recedeScale = baseScale * lerp(1, 0.22, exitEase);
      group.current.scale.setScalar(recedeScale);

      group.current.position.x = lerp(0, -0.6, exitEase);
      group.current.position.y = truckGroundY(recedeScale) + bob;
      group.current.position.z = lerp(0, -34, exitEase);

      // Holds ASSEMBLY_YAW (already road-oriented, not a display pose)
      // for the whole assembly + load, then swings the rest of the way
      // to dead-parallel-with-the-road as it commits to leaving.
      group.current.rotation.y = lerp(ASSEMBLY_YAW, DOWN_ROAD_YAW - 0.06, exitEase);
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
      slat.position.y = baseY + doorT * DOOR_OPEN_LIFT;
      // A rigid vertical translate alone reads ambiguously — the whole
      // identically-striped block just shifts within the frame, which
      // doesn't obviously register as "opening" against the roofline
      // above it. Shrinking each slat toward the coil as it rises (real
      // roller doors wind onto a barrel above the opening) makes the
      // door visibly recede instead of merely relocate.
      slat.scale.y = lerp(1, 0.12, doorT);
    });

    cargoBoxes.forEach((box, i) => {
      const mesh = cargoRefs.current[i];
      if (!mesh) return;
      const t = partProgress(local, box.at);
      // Travels in from outside the rear door (+x, further than the
      // door itself) straight to its resting slot, so it visibly enters
      // through the opening rather than raining in from off-frame.
      mesh.position.set(
        lerp(box.position[0] + CARGO_ENTRY_OFFSET, box.position[0], t),
        box.position[1],
        box.position[2],
      );
      mesh.rotation.z = lerp(0.5, 0, t);
      mesh.scale.setScalar(t);
      mesh.visible = t > 0.001;
    });
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

        {/* Windshield */}
        <mesh position={[0.45, 0.32, 0]} rotation={[0, 0, -0.32]}>
          <boxGeometry args={[0.06, 0.62, 1.42]} />
          <meshStandardMaterial
            color={COLORS.truckGlass}
            roughness={0.12}
            metalness={0.6}
            envMapIntensity={1.2}
          />
        </mesh>
        {/* Side windows */}
        <mesh position={[0.02, 0.34, 0.86]}>
          <boxGeometry args={[0.86, 0.42, 0.03]} />
          <meshStandardMaterial color={COLORS.truckGlass} roughness={0.15} metalness={0.55} />
        </mesh>
        <mesh position={[0.02, 0.34, -0.86]}>
          <boxGeometry args={[0.86, 0.42, 0.03]} />
          <meshStandardMaterial color={COLORS.truckGlass} roughness={0.15} metalness={0.55} />
        </mesh>

        {/* Grille */}
        <mesh position={[0.66, -0.28, 0]}>
          <boxGeometry args={[0.04, 0.34, 1.1]} />
          <meshStandardMaterial color={COLORS.truckGrille} roughness={0.5} metalness={0.6} />
        </mesh>

        {/* Headlights */}
        <mesh position={[0.66, -0.1, 0.62]}>
          <boxGeometry args={[0.05, 0.16, 0.24]} />
          <meshStandardMaterial
            color={COLORS.headlightWhite}
            emissive={COLORS.headlightWhite}
            emissiveIntensity={1.6}
            roughness={0.3}
          />
        </mesh>
        <mesh position={[0.66, -0.1, -0.62]}>
          <boxGeometry args={[0.05, 0.16, 0.24]} />
          <meshStandardMaterial
            color={COLORS.headlightWhite}
            emissive={COLORS.headlightWhite}
            emissiveIntensity={1.6}
            roughness={0.3}
          />
        </mesh>

        {/* Side mirrors */}
        <mesh position={[0.55, 0.28, 0.92]}>
          <boxGeometry args={[0.16, 0.2, 0.04]} />
          <meshStandardMaterial color={COLORS.truckChrome} roughness={0.3} metalness={0.8} />
        </mesh>
        <mesh position={[0.55, 0.28, -0.92]}>
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

        {/* Dark cargo-hold cavity, visible through the rear opening once
            the door has rolled up. */}
        <mesh position={[1.2, 0, 0]}>
          <boxGeometry args={[0.06, 1.7, 1.55]} />
          <meshStandardMaterial color={COLORS.truckGlass} roughness={0.9} metalness={0} />
        </mesh>

        {/* Interior cargo light: a real truck's box has one, and without
            it the dark cavity swallows the boxes travelling into it —
            the loading beat needs them legible against the cavity, not
            just barely-lit dots. */}
        <pointLight
          position={[0.4, 0.6, 0]}
          intensity={3.5}
          distance={3}
          decay={2}
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
            dark-on-dark door was unreadable regardless of angle. */}
        <group position={[1.51, 0, 0]}>
          {Array.from({ length: DOOR_SLAT_COUNT }).map((_, i) => (
            <mesh
              key={i}
              position={[0, -0.8 + i * 0.24, 0]}
              ref={(el) => {
                doorSlatRefs.current[i] = el;
              }}
            >
              <boxGeometry args={[0.02, 0.2, 1.6]} />
              <meshStandardMaterial color={COLORS.truckChrome} roughness={0.45} metalness={0.5} />
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

      {cargoBoxes.map((box, i) => (
        <mesh
          key={`cargo-${i}`}
          ref={(el) => {
            cargoRefs.current[i] = el;
          }}
        >
          <boxGeometry args={box.size} />
          {/* Lighter than the old truckCargo brown, with a slight
              emissive kick — the cargo bay is intentionally dark, and a
              flat-lit dark-brown box nearly disappeared into it, which
              defeated the whole point of watching boxes travel in. */}
          <meshStandardMaterial
            color={COLORS.cardboardTanDark}
            emissive={COLORS.cardboardTanDark}
            emissiveIntensity={0.25}
            roughness={0.8}
          />
        </mesh>
      ))}
    </group>
  );
}
