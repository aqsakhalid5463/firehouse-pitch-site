'use client';

import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { getScrollProgress } from '@/lib/scroll-store';
import { themeAt } from '@/lib/theme';
import { COLORS } from '@/lib/constants';

export function ThemeSync() {
  const { scene } = useThree();
  const fog = useRef(new THREE.Fog(COLORS.darkFog, 6, 22));
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
