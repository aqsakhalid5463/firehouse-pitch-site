'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { getMoveAsOneProgress } from '@/lib/move-as-one-progress';
import { clamp01, lerp } from '@/lib/scroll-math';
import { COLORS } from '@/lib/constants';

type Box = {
  position: [number, number, number];
  size: [number, number, number];
  rotation: [number, number, number];
  color: string;
};

// The stack lives in the right third of the hero frame so it never
// collides with the left-aligned headline. The whole group starts here
// at rest, then drifts + converges on the truck's cargo bay exactly as
// before (see useFrame below) — only the starting point moved, the
// converged endpoint (1.9, 0.55, -0.2) is unchanged, so the truck
// handoff still lands where TruckAssembly expects it.
const HERO_OFFSET: [number, number, number] = [1.7, 0, 0.15];

// Four boxes, each individually detailed rather than nine identical
// blocks. Positions/rotations are hand-placed with small irregularities
// (uneven rotation, boxes not quite grid-aligned) so the stack reads as
// carried and set down by a person, not snapped into place.
const BOXES: Box[] = [
  {
    position: [-0.05, -1.0, 0.05],
    size: [1.55, 0.95, 1.35],
    rotation: [0, 0.06, 0],
    color: COLORS.cardboardTan,
  },
  {
    position: [-0.85, -0.28, 0.28],
    size: [1.1, 0.72, 1.0],
    rotation: [0.015, -0.22, -0.01],
    color: COLORS.cardboardTanDark,
  },
  {
    position: [0.02, 0.34, -0.08],
    size: [1.2, 0.6, 1.02],
    rotation: [-0.01, 0.16, 0.01],
    color: COLORS.cardboardTan,
  },
  {
    position: [0.72, 0.72, 0.22],
    size: [0.82, 0.5, 0.76],
    rotation: [0.02, -0.3, 0],
    color: COLORS.cardboardTanDark,
  },
];

function CardboardBox({ box }: { box: Box }) {
  const [w, h, d] = box.size;
  return (
    <group position={box.position} rotation={box.rotation}>
      <RoundedBox args={box.size} radius={Math.min(0.045, h * 0.08)} smoothness={3}>
        <meshStandardMaterial color={box.color} roughness={0.92} metalness={0.02} />
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
  const group = useRef<THREE.Group>(null);

  // Built once — no per-frame allocation in useFrame.
  const boxes = useMemo(() => BOXES, []);

  useFrame((state, delta) => {
    if (!group.current) return;
    const local = getMoveAsOneProgress();
    group.current.rotation.y += delta * 0.12;

    // These are the hero boxes becoming the truck's cargo, not a separate
    // prop that has to get out of the truck's way — so instead of
    // fading, the stack physically drifts and converges on the truck's
    // cargo bay (see TruckAssembly's box-body position) across the whole
    // load-in window, easing in so the carry reads as continuous. The
    // stack now starts offset to the right (HERO_OFFSET) instead of dead
    // centre, but the converged endpoint is unchanged so the handoff into
    // the truck is identical to before.
    const driftT = clamp01(local / 0.75);
    const eased = 1 - Math.pow(1 - driftT, 2);
    const bob = Math.sin(state.clock.elapsedTime * 0.5) * 0.06;
    group.current.position.x = lerp(HERO_OFFSET[0], 1.9, eased);
    group.current.position.y = lerp(HERO_OFFSET[1], 0.55, eased) + bob;
    group.current.position.z = lerp(HERO_OFFSET[2], -0.2, eased);

    // Scales away as it settles into the bay. Timed to finish at
    // local = 0.75 — the same progress at which TruckAssembly's own
    // CARGO boxes finish arriving (see its `at` values) and at which its
    // EXIT_START begins the departure — so the hero stack has fully
    // "become" the truck's cargo before the truck moves, with neither a
    // pop nor an empty gap at the handoff.
    const scaleT = clamp01((local - 0.4) / 0.35);
    const easedScale = scaleT * scaleT * (3 - 2 * scaleT); // smoothstep
    const scale = lerp(1, 0, easedScale);
    group.current.visible = scale > 0.01;
    group.current.scale.setScalar(scale);
  });

  return (
    <group ref={group}>
      {boxes.map((box, i) => (
        <CardboardBox key={i} box={box} />
      ))}
    </group>
  );
}
