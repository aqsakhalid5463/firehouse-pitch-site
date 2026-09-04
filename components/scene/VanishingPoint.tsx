'use client';

import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { ROAD_SURFACE_Y } from '@/lib/constants';
import { setVanishingPoint } from '@/lib/vanishing-store';

/** A point far enough down the road that its projection is the horizon
 *  for all practical purposes. The road runs along -Z from the origin. */
const FAR_DOWN_THE_ROAD = new THREE.Vector3(0, ROAD_SURFACE_Y, -400);

const projected = new THREE.Vector3();

/**
 * Projects the road's far point into screen space every frame and
 * publishes it, so DOM content can be positioned against the actual
 * horizon rather than against a guess at where it is.
 */
export function VanishingPoint() {
  const { camera, size } = useThree();

  useFrame(() => {
    projected.copy(FAR_DOWN_THE_ROAD).project(camera);
    // NDC to viewport pixels. The canvas is fixed at inset-0, so its
    // size is the viewport's and no offset is needed.
    setVanishingPoint(
      (projected.x * 0.5 + 0.5) * size.width,
      (-projected.y * 0.5 + 0.5) * size.height,
    );
  });

  return null;
}
