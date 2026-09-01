'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { MeshTransmissionMaterial } from '@react-three/drei';
import * as THREE from 'three';
import { getMoveAsOneProgress } from '@/lib/move-as-one-progress';
import { clamp01, lerp } from '@/lib/scroll-math';
import { COLORS } from '@/lib/constants';

type Box = {
  position: [number, number, number];
  size: [number, number, number];
  rotation: number;
  glass?: boolean;
};

const BOXES: Box[] = [
  { position: [0, -1.05, 0], size: [1.5, 0.9, 1.3], rotation: 0.04 },
  { position: [-0.75, -0.3, 0.2], size: [1.1, 0.7, 1.0], rotation: -0.12 },
  { position: [0.62, -0.32, -0.15], size: [1.0, 0.66, 0.95], rotation: 0.18 },
  { position: [-0.1, 0.32, 0.05], size: [1.25, 0.62, 1.05], rotation: 0.07, glass: true },
  { position: [0.7, 0.86, 0.3], size: [0.8, 0.5, 0.75], rotation: -0.25 },
  { position: [-0.66, 0.9, -0.2], size: [0.9, 0.55, 0.8], rotation: 0.3 },
  { position: [0.05, 1.42, 0.1], size: [0.7, 0.45, 0.68], rotation: -0.08 },
  { position: [-1.35, -0.85, -0.55], size: [0.75, 0.5, 0.7], rotation: 0.42 },
  { position: [1.4, -0.9, -0.4], size: [0.85, 0.55, 0.78], rotation: -0.36 },
];

export function BoxStack() {
  const group = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    if (!group.current) return;
    const local = getMoveAsOneProgress();
    group.current.rotation.y += delta * 0.12;

    // These are the hero boxes becoming the truck's cargo, not a separate
    // prop that has to get out of the truck's way — so instead of
    // fading, the stack physically drifts and converges on the truck's
    // cargo bay (see TruckAssembly's box-body position) across the whole
    // load-in window, easing in so the carry reads as continuous.
    const driftT = clamp01(local / 0.75);
    const eased = 1 - Math.pow(1 - driftT, 2);
    const bob = Math.sin(state.clock.elapsedTime * 0.5) * 0.06;
    group.current.position.x = lerp(0, 1.9, eased);
    group.current.position.y = lerp(0, 0.55, eased) + bob;
    group.current.position.z = lerp(0, -0.2, eased);

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
      {BOXES.map((box, i) =>
        box.glass ? (
          <mesh key={i} position={box.position} rotation={[0, box.rotation, 0]}>
            <boxGeometry args={box.size} />
            <MeshTransmissionMaterial
              thickness={0.6}
              roughness={0.08}
              transmission={1}
              ior={1.4}
              chromaticAberration={0.06}
              backside
              color={COLORS.glassTint}
            />
          </mesh>
        ) : (
          <mesh key={i} position={box.position} rotation={[0, box.rotation, 0]}>
            <boxGeometry args={box.size} />
            <meshStandardMaterial
              color={COLORS.crateWood}
              roughness={0.85}
              metalness={0.05}
              emissive={COLORS.fireRed}
              emissiveIntensity={0.04}
            />
          </mesh>
        ),
      )}
    </group>
  );
}
