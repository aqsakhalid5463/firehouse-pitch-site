'use client';

import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { getScrollProgress } from '@/lib/scroll-store';
import { themeAt } from '@/lib/theme';
import { COLORS } from '@/lib/constants';

export function ThemeSync() {
  const { scene } = useThree();
  // Far bound raised from 22 (round 8): the truck now holds a constant
  // down-road heading (TruckAssembly's DOWN_ROAD_YAW) which puts its
  // nose-to-tail length along the camera's view axis instead of across
  // it, and the camera itself sits further back for that same framing
  // (see camera-path's HOME_POSITIONS) — both push the truck's own
  // depth further from the camera than a side-on pose did, so the old
  // far bound was fogging it out almost to black before it was legible.
  const fog = useRef(new THREE.Fog(COLORS.darkFog, 6, 30));
  const bg = useRef(new THREE.Color(COLORS.darkBg));

  useFrame(() => {
    const theme = themeAt(getScrollProgress());
    fog.current.color.set(theme.fog);
    bg.current.set(theme.bg);
    scene.fog = fog.current;
    scene.background = bg.current;
  });

  return null;
}
