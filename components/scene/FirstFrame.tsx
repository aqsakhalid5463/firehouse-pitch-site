'use client';

import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { markReady } from '@/lib/preload-store';

/**
 * Reports that the scene has actually rendered, which is the preloader's
 * heaviest signal. It fires on the *second* frame rather than the first:
 * the first useFrame callback runs before that frame's draw call, so
 * lifting the curtain on it can reveal a canvas that has compiled its
 * shaders but not yet put pixels on screen.
 */
export function FirstFrame() {
  const frames = useRef(0);

  useFrame(() => {
    frames.current += 1;
    if (frames.current === 2) markReady('frame');
  });

  return null;
}
