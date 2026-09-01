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
  truckLocalToWorld,
  computeTruckGroupTransform,
  type Vec3,
} from './TruckAssembly';

// The stack lives in the right third of the hero frame so it never
// collides with the left-aligned headline. It starts here at rest, then
// travels through the truck's open rear door and comes to rest as the
// truck's own cargo (see useFrame below) — there is exactly one set of
// boxes; nothing is duplicated in TruckAssembly and nothing fades away.
const HERO_OFFSET: Vec3 = [1.7, ROAD_SURFACE_Y, 0.15];

type BoxSpec = {
  size: Vec3;
  color: string;
  restRotationY: number;
};

// Two large boxes (down from four) — big enough to read clearly as hero
// props, and sized to actually fit through the truck's rear door
// opening and sit on its cargo floor once they arrive (see
// TruckAssembly's CARGO_REST_LOCAL / door geometry).
const BOX_SPECS: BoxSpec[] = [
  { size: [0.95, 0.8, 0.9], color: COLORS.cardboardTan, restRotationY: 0.08 },
  { size: [0.78, 0.64, 0.74], color: COLORS.cardboardTanDark, restRotationY: -0.16 },
];

// Hero "at rest" local offsets — box 2 stacked on box 1, exactly as a
// stack a person would build (no hand-placed Y: derived from box 1's
// top face plus box 2's own half-height).
const HERO_STACK_LOCAL: Vec3[] = (() => {
  const [w1, h1, d1] = BOX_SPECS[0].size;
  const [, h2] = BOX_SPECS[1].size;
  void w1;
  void d1;
  return [
    [0, h1 / 2, 0],
    [-0.08, h1 + h2 / 2, 0.06],
  ];
})();

const STACK_FOOTPRINT_RADIUS = Math.max(BOX_SPECS[0].size[0], BOX_SPECS[0].size[2]) * 0.7;

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
    // rolling shut (see TruckAssembly's DOOR_CLOSE_START) — so the
    // boxes are fully "become" the truck's cargo, resting still, before
    // the door closes and the truck drives off.
    const p = clamp01(local / 0.75);
    // Phase 1 (0..~0.55 of p): carried as a stack from the hero rest
    // position to a waypoint just outside the open rear door — reads as
    // "carried over", not yet loaded.
    const approachEase = 1 - Math.pow(1 - clamp01(p / 0.6), 3);
    // Phase 2 (~0.55..1 of p): each box leaves the stack and travels the
    // rest of the way through the door opening to its own resting slot
    // on the cargo floor — this is what makes the trajectory read as
    // loading through the opening rather than teleporting.
    const enterT = clamp01((p - 0.55) / 0.45);
    const enterEase = enterT * enterT * (3 - 2 * enterT);

    const bob = Math.sin(state.clock.elapsedTime * 0.5) * 0.06 * (1 - approachEase);
    const idleSpin = state.clock.elapsedTime * 0.12 * (1 - approachEase);

    BOX_SPECS.forEach((spec, i) => {
      const g = boxRefs.current[i];
      if (!g) return;
      // Past local >= 1 the truck (and everything it carried off) is
      // gone — hide explicitly rather than leaving the boxes floating
      // on the road after the truck itself disappears (see
      // TruckAssembly's own `local < 1` gate).
      g.visible = local < 1;

      const stackLocal = HERO_STACK_LOCAL[i];
      const heroWorld: Vec3 = [
        HERO_OFFSET[0] + stackLocal[0],
        HERO_OFFSET[1] + stackLocal[1] + bob,
        HERO_OFFSET[2] + stackLocal[2],
      ];
      // Two boxes converge on the same door waypoint (with a small
      // separation so they don't overlap) before diverging to their own
      // resting slots — this is what sells "loaded one after another
      // through the opening" rather than a single rigid block passing
      // through the wall.
      const doorSlot: Vec3 = [doorWorld[0], doorWorld[1], doorWorld[2] + (i === 0 ? 0.25 : -0.25)];
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

      // Scale stays at 1 throughout — these boxes never fade away, they
      // simply arrive and stay as the truck's visible cargo. (The truck
      // itself shrinks with perspective during departure, but the boxes
      // are hidden by the closed door by then, so no visible mismatch.)
      g.scale.setScalar(1);
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
