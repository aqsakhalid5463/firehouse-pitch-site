'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getMoveAsOneProgress } from '@/lib/move-as-one-progress';
import { getScrollProgress } from '@/lib/scroll-store';
import { clamp01, lerp } from '@/lib/scroll-math';
import { COLORS } from '@/lib/constants';

type Part = {
  position: [number, number, number];
  size: [number, number, number];
  from: [number, number, number];
  at: number; // local progress at which this part starts arriving
  color: string;
};

const PARTS: Part[] = [
  // Chassis
  { position: [0, -0.55, 0], size: [4.6, 0.22, 1.8], from: [0, -6, 0], at: 0.0, color: COLORS.truckChassis },
  // Cab
  { position: [-1.75, 0.15, 0], size: [1.2, 1.2, 1.7], from: [-8, 0, 0], at: 0.1, color: COLORS.fireRed },
  { position: [-1.2, 0.35, 0], size: [0.3, 0.7, 1.6], from: [-8, 0, 0], at: 0.14, color: COLORS.truckWindshield },
  // Box body
  { position: [0.7, 0.5, 0], size: [3.0, 1.9, 1.75], from: [8, 0, 0], at: 0.22, color: COLORS.truckBoxBody },
  // Wheels rendered separately below
];

const WHEELS: [number, number, number][] = [
  [-1.7, -0.75, 0.9],
  [-1.7, -0.75, -0.9],
  [1.2, -0.75, 0.9],
  [1.2, -0.75, -0.9],
];

const CARGO: { position: [number, number, number]; size: [number, number, number]; at: number }[] = [
  { position: [0.0, -0.15, 0], size: [0.6, 0.45, 0.55], at: 0.44 },
  { position: [0.7, -0.15, 0.35], size: [0.5, 0.4, 0.5], at: 0.51 },
  { position: [0.7, -0.15, -0.35], size: [0.5, 0.4, 0.5], at: 0.57 },
  { position: [0.0, 0.35, 0], size: [0.55, 0.4, 0.5], at: 0.64 },
  { position: [0.75, 0.32, 0], size: [0.5, 0.36, 0.48], at: 0.7 },
  { position: [0.35, 0.75, 0], size: [0.45, 0.34, 0.44], at: 0.76 },
];

/** 0 at `at`, 1 by `at + 0.12`, eased. */
function partProgress(local: number, at: number): number {
  const t = clamp01((local - at) / 0.12);
  return 1 - Math.pow(1 - t, 3);
}

export function TruckAssembly() {
  const group = useRef<THREE.Group>(null);
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  const cargoRefs = useRef<(THREE.Mesh | null)[]>([]);
  const wheelRefs = useRef<(THREE.Mesh | null)[]>([]);

  useFrame(() => {
    // Real pin-relative progress from ScrollTrigger (0 before the pin is
    // reached, 1 once it releases) — robust to the page's total height
    // changing as later tasks add sections after this one.
    const local = getMoveAsOneProgress();
    // The exit is deliberately driven off the *global* dissolve clock
    // (same range themeAt uses), not pin-local progress: it must stay
    // welded to the background turning cream at any page height, and the
    // pin's release point is not guaranteed to coincide with that.
    const globalP = getScrollProgress();
    const exit = clamp01((globalP - 0.68) / 0.07);

    if (group.current) {
      // Fades in quickly once the pin engages (individual parts also start
      // invisible at local=0, this just softens the whole-group pop-in).
      const show = clamp01(local / 0.03);
      // Past local >= 1 (pin released) the truck has fully driven off;
      // switch it off explicitly rather than relying on frustum culling.
      group.current.visible = show > 0.01 && local < 1;
      group.current.scale.setScalar(0.85 * show);
      // Drives out of frame left as the background dissolves to the light
      // theme, in lockstep with themeAt over SECTIONS.guarantees.
      group.current.position.x = -12 * exit;
      group.current.rotation.y = lerp(-0.5, -0.15, local);
    }

    PARTS.forEach((part, i) => {
      const mesh = refs.current[i];
      if (!mesh) return;
      const t = partProgress(local, part.at);
      mesh.position.set(
        lerp(part.from[0], part.position[0], t),
        lerp(part.from[1], part.position[1], t),
        lerp(part.from[2], part.position[2], t),
      );
      (mesh.material as THREE.MeshStandardMaterial).opacity = t;
      mesh.visible = t > 0.001;
    });

    wheelRefs.current.forEach((mesh, i) => {
      if (!mesh) return;
      const t = partProgress(local, 0.32 + i * 0.02);
      mesh.scale.setScalar(t);
      mesh.visible = t > 0.001;
    });

    CARGO.forEach((box, i) => {
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
      {PARTS.map((part, i) => (
        <mesh
          key={`part-${i}`}
          ref={(el) => {
            refs.current[i] = el;
          }}
        >
          <boxGeometry args={part.size} />
          <meshStandardMaterial
            color={part.color}
            roughness={0.5}
            metalness={0.2}
            transparent
          />
        </mesh>
      ))}

      {WHEELS.map((pos, i) => (
        <mesh
          key={`wheel-${i}`}
          ref={(el) => {
            wheelRefs.current[i] = el;
          }}
          position={pos}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <cylinderGeometry args={[0.36, 0.36, 0.22, 24]} />
          <meshStandardMaterial color={COLORS.truckWheel} roughness={0.9} />
        </mesh>
      ))}

      {CARGO.map((box, i) => (
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
