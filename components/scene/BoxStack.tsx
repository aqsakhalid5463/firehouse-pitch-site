'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { usePathname } from 'next/navigation';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { getMoveAsOneProgress } from '@/lib/move-as-one-progress';
import { clamp01, lerp } from '@/lib/scroll-math';
import { COLORS, ROAD_SURFACE_Y } from '@/lib/constants';

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

// Each entry describes a box purely in terms of its own footprint offset
// from the box it rests on (xOffset/zOffset, relative to the *previous*
// box's centre) plus a little rotational character. Resting Y is never
// hand-placed: buildStack() below derives it from the supporting box's
// top face plus this box's own half-height, so boxes can never
// interpenetrate and every box's footprint offset is small enough that
// its centre of mass stays over its support (no cantilevering into thin
// air). Sizes shrink going up, like a real stack a person would build.
type BoxSpec = {
  size: [number, number, number];
  xOffset: number; // relative to the box below's centre (0 for the base box, relative to ground origin)
  zOffset: number;
  rotationY: number;
  tiltX?: number;
  tiltZ?: number;
  color: string;
};

const BOX_SPECS: BoxSpec[] = [
  // Base box: grounded on the road surface, dead centre of the stack's
  // local origin.
  {
    size: [1.6, 1.0, 1.4],
    xOffset: 0,
    zOffset: 0,
    rotationY: 0.05,
    color: COLORS.cardboardTan,
  },
  // Second box sits inset from the base box's edges on every side, so
  // its whole footprint — and therefore its centre of mass — is over
  // the base box, not hanging off it.
  {
    size: [1.15, 0.75, 1.05],
    xOffset: -0.15,
    zOffset: 0.1,
    rotationY: -0.18,
    tiltX: 0.012,
    tiltZ: -0.008,
    color: COLORS.cardboardTanDark,
  },
  {
    size: [0.85, 0.55, 0.8],
    xOffset: 0.25,
    zOffset: -0.15,
    rotationY: 0.14,
    tiltX: -0.008,
    tiltZ: 0.006,
    color: COLORS.cardboardTan,
  },
  {
    size: [0.55, 0.4, 0.5],
    xOffset: -0.05,
    zOffset: 0.05,
    rotationY: -0.22,
    tiltX: 0.01,
    color: COLORS.cardboardTanDark,
  },
];

function buildStack(specs: BoxSpec[], groundY: number): Box[] {
  let supportTop = groundY;
  let prevX = 0;
  let prevZ = 0;
  return specs.map((spec) => {
    const [, h] = spec.size;
    const x = prevX + spec.xOffset;
    const z = prevZ + spec.zOffset;
    const y = supportTop + h / 2; // rests exactly on the surface below — no overlap
    supportTop = y + h / 2;
    prevX = x;
    prevZ = z;
    return {
      position: [x, y, z],
      size: spec.size,
      rotation: [spec.tiltX ?? 0, spec.rotationY, spec.tiltZ ?? 0],
      color: spec.color,
    };
  });
}

// Computed once at module scope, not hand-placed — see buildStack above.
// groundY is 0 here (not ROAD_SURFACE_Y) because these are local-space
// box coordinates inside the drifting group; the group itself starts at
// world Y = HERO_OFFSET[1] which is set to ROAD_SURFACE_Y below so the
// base box's world position lands exactly on the road at rest.
const BOXES: Box[] = buildStack(BOX_SPECS, 0);

const STACK_FOOTPRINT_RADIUS = Math.max(BOX_SPECS[0].size[0], BOX_SPECS[0].size[2]) * 0.62;

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
  const pathname = usePathname();

  // Built once — no per-frame allocation in useFrame.
  const boxes = useMemo(() => BOXES, []);

  useFrame((state, delta) => {
    if (!group.current) return;

    // The opening pin (and its GSAP ScrollTrigger) only exists on the
    // home route, so getMoveAsOneProgress() is never reset when
    // navigating to /about — it just holds whatever value it last had,
    // which could park the stack mid-drift over the About copy (e.g.
    // "Climate-controlled storage"). The canvas is shared across
    // routes, so route-gate visibility explicitly instead of trusting
    // a progress value that only home ever advances.
    if (pathname === '/about') {
      group.current.visible = false;
      return;
    }

    const local = getMoveAsOneProgress();
    group.current.rotation.y += delta * 0.12;

    // These are the hero boxes becoming the truck's cargo, not a separate
    // prop that has to get out of the truck's way — so instead of
    // fading, the stack physically drifts and converges on the truck's
    // cargo bay (see TruckAssembly's box-body position) across the whole
    // load-in window, easing in so the carry reads as continuous. The
    // stack starts grounded on the road (HERO_OFFSET's Y is
    // ROAD_SURFACE_Y so the base box's world position sits on the road
    // surface, matching the truck's own grounding) and converges on the
    // same endpoint as before, so the handoff into the truck is
    // unchanged.
    const driftT = clamp01(local / 0.75);
    const eased = 1 - Math.pow(1 - driftT, 2);
    const bob = Math.sin(state.clock.elapsedTime * 0.5) * 0.06;
    group.current.position.x = lerp(HERO_OFFSET[0], 1.9, eased);
    group.current.position.y = lerp(ROAD_SURFACE_Y, 0.55, eased) + bob;
    group.current.position.z = lerp(HERO_OFFSET[2], -0.2, eased);

    // Scales away as it settles into the bay. Timed to finish at
    // local = 0.75 — the same progress at which TruckAssembly's own
    // CARGO boxes finish arriving (see its `at` values), which is also
    // when the rear door starts rolling shut — so the hero stack has
    // fully "become" the truck's cargo, with neither a pop nor an empty
    // gap, before the door closes and the truck drives off.
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
      {/* Contact shadow: sells the grounding by darkening the road patch
          directly under the stack's footprint, independent of the
          drifting group's scroll-driven bob. */}
      <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[STACK_FOOTPRINT_RADIUS, 24]} />
        <meshBasicMaterial color={COLORS.asphaltDark} transparent opacity={0.35} />
      </mesh>
    </group>
  );
}
