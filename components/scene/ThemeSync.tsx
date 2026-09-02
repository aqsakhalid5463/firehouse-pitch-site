'use client';

import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { THEME } from '@/lib/theme';
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

  // Fog and background are constants now that the dark-to-light
  // dissolve is gone (lib/theme.ts), so this runs on mount instead of
  // re-setting identical values every frame.
  useEffect(() => {
    fog.current.color.set(THEME.fog);
    bg.current.set(THEME.bg);
    scene.fog = fog.current;
    scene.background = bg.current;
  }, [scene]);

  return null;
}
