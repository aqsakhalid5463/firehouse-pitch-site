'use client';

import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { usePathname } from 'next/navigation';
import * as THREE from 'three';
import { getScrollProgress } from '@/lib/scroll-store';
import { sampleHomeCamera, sampleAboutCamera } from '@/lib/camera-path';

const target = new THREE.Vector3();
const look = new THREE.Vector3();

export function CameraRig() {
  const { camera } = useThree();
  const pathname = usePathname();
  const pointer = useRef({ x: 0, y: 0 });

  useFrame((state, delta) => {
    const p = getScrollProgress();
    const sample =
      pathname === '/about' ? sampleAboutCamera(p) : sampleHomeCamera(p);

    // Mouse parallax, deliberately small — it reads as depth, not motion.
    pointer.current.x += (state.pointer.x * 0.35 - pointer.current.x) * 0.05;
    pointer.current.y += (state.pointer.y * 0.2 - pointer.current.y) * 0.05;

    target.set(
      sample.position[0] + pointer.current.x,
      sample.position[1] + pointer.current.y,
      sample.position[2],
    );
    camera.position.lerp(target, Math.min(1, delta * 4));

    look.set(...sample.lookAt);
    camera.lookAt(look);

    const cam = camera as THREE.PerspectiveCamera;
    if (cam.isPerspectiveCamera && Math.abs(cam.fov - sample.fov) > 0.01) {
      cam.fov += (sample.fov - cam.fov) * Math.min(1, delta * 4);
      cam.updateProjectionMatrix();
    }
  });

  return null;
}
