'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { getMoveAsOneProgress, getExitProgress } from '@/lib/move-as-one-progress';
import { clamp01, lerp } from '@/lib/scroll-math';
import { COLORS } from '@/lib/constants';

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

// Cargo loads in 0.40..0.75 of the pin's progress, in lockstep with the
// hero box stack scaling down into the bay in BoxStack — the two should
// read as one continuous load, not two independent animations.
const CARGO: { position: Vec3; size: Vec3; at: number }[] = [
  { position: [0.0, -0.15, 0], size: [0.6, 0.45, 0.55], at: 0.4 },
  { position: [0.7, -0.15, 0.35], size: [0.5, 0.4, 0.5], at: 0.45 },
  { position: [0.7, -0.15, -0.35], size: [0.5, 0.4, 0.5], at: 0.5 },
  { position: [0.0, 0.35, 0], size: [0.55, 0.4, 0.5], at: 0.55 },
  { position: [0.75, 0.32, 0], size: [0.5, 0.36, 0.48], at: 0.6 },
  { position: [0.35, 0.75, 0], size: [0.45, 0.34, 0.44], at: 0.63 },
];

/** 0 at `at`, 1 by `at + 0.12`, eased. */
function partProgress(local: number, at: number): number {
  const t = clamp01((local - at) / 0.12);
  return 1 - Math.pow(1 - t, 3);
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
  const cargoRefs = useRef<(THREE.Mesh | null)[]>([]);
  const tailLightRefs = useRef<(THREE.MeshStandardMaterial | null)[]>([]);

  // Built once — no per-frame allocation in useFrame.
  const cargoBoxes = useMemo(() => CARGO, []);

  useFrame(() => {
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
    // the truck turns to face down the highway (the same axis Highway.tsx
    // streams its dashes along), accelerates into the distance with an
    // eased-in (ease-in-cubic) recession so it reads as pulling away
    // rather than drifting, and fades out over the back half of the
    // departure so it never dwindles to an unreadable speck before it's
    // gone — the fade finishes and the pin releases before the shrink
    // would otherwise make it disappear.
    const exit = getExitProgress();
    const exitEase = exit * exit * exit; // ease-in: accelerates

    if (group.current) {
      // Fades in quickly once the pin engages (individual parts also start
      // invisible at local=0, this just softens the whole-group pop-in).
      const show = clamp01(local / 0.03);
      // Past local >= 1 (pin released) the truck has fully driven off;
      // switch it off explicitly rather than relying on frustum culling.
      group.current.visible = show > 0.01 && local < 1;

      const baseScale = 0.85 * show;
      // Recedes down the road (world -z, the same direction Highway's
      // dashes stream toward) while shrinking with perspective — but the
      // fade below finishes well before the scale would read as a speck.
      const recedeScale = baseScale * lerp(1, 0.22, exitEase);
      group.current.scale.setScalar(recedeScale);

      group.current.position.x = lerp(0, -0.6, exitEase);
      group.current.position.z = lerp(0, -34, exitEase);

      // Turns from its assembly-facing angle to face straight down the
      // road as it commits to leaving.
      const assemblyYaw = lerp(-0.5, -0.15, local);
      group.current.rotation.y = lerp(assemblyYaw, -Math.PI / 2 - 0.06, exitEase);
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

    // Tail lights glow up as the truck commits to leaving, on top of
    // their always-on low idle emissive.
    const tailGlow = 0.35 + exitEase * 3.2;
    tailLightRefs.current.forEach((mat) => {
      if (mat) mat.emissiveIntensity = tailGlow;
    });

    cargoBoxes.forEach((box, i) => {
      const mesh = cargoRefs.current[i];
      if (!mesh) return;
      const t = partProgress(local, box.at);
      mesh.position.set(
        lerp(box.position[0] + 5, box.position[0], t),
        lerp(box.position[1] + 3, box.position[1], t),
        box.position[2],
      );
      mesh.rotation.z = lerp(1.2, 0, t);
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

      {/* Box body */}
      <group ref={bodyRef}>
        <RoundedBox args={[3.0, 1.9, 1.75]} radius={0.08} smoothness={3}>
          <meshStandardMaterial color={COLORS.truckBoxBody} roughness={0.55} metalness={0.15} />
        </RoundedBox>

        {/* Panel line running along the body */}
        <mesh position={[0, 0.05, 0.876]}>
          <boxGeometry args={[2.9, 0.03, 0.01]} />
          <meshStandardMaterial color={COLORS.truckChassis} roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.05, -0.876]}>
          <boxGeometry args={[2.9, 0.03, 0.01]} />
          <meshStandardMaterial color={COLORS.truckChassis} roughness={0.7} />
        </mesh>

        {/* Rear roller-door: a stack of thin horizontal slats */}
        <group position={[1.51, 0, 0]}>
          {Array.from({ length: 7 }).map((_, i) => (
            <mesh key={i} position={[0, -0.8 + i * 0.24, 0]}>
              <boxGeometry args={[0.02, 0.2, 1.6]} />
              <meshStandardMaterial color={COLORS.truckGrille} roughness={0.6} metalness={0.2} />
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

      {/* Wheels: dark tyre + lighter rim, instanced per corner */}
      {WHEEL_POSITIONS.map((pos, i) => (
        <group
          key={`wheel-${i}`}
          ref={(el) => {
            wheelRefs.current[i] = el;
          }}
          position={pos}
        >
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.36, 0.36, 0.24, 20]} />
            <meshStandardMaterial color={COLORS.truckTyre} roughness={0.95} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, pos[2] > 0 ? 0.135 : -0.135]}>
            <cylinderGeometry args={[0.19, 0.19, 0.05, 16]} />
            <meshStandardMaterial color={COLORS.truckRim} roughness={0.35} metalness={0.75} />
          </mesh>
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
          <meshStandardMaterial color={COLORS.truckCargo} roughness={0.85} />
        </mesh>
      ))}
    </group>
  );
}
