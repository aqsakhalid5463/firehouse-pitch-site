'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { EffectComposer, Bloom, ChromaticAberration, Vignette } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { getScrollProgress } from '@/lib/scroll-store';
import { themeAt } from '@/lib/theme';

export function Effects() {
  const bloom = useRef<{ intensity: number }>(null);

  useFrame(() => {
    if (bloom.current) {
      bloom.current.intensity = themeAt(getScrollProgress()).bloomIntensity;
    }
  });

  return (
    <EffectComposer multisampling={0}>
      <Bloom
        ref={bloom as never}
        intensity={1.15}
        luminanceThreshold={0.25}
        luminanceSmoothing={0.9}
        mipmapBlur
      />
      <ChromaticAberration
        blendFunction={BlendFunction.NORMAL}
        offset={[0.0004, 0.0006]}
      />
      <Vignette eskil={false} offset={0.25} darkness={0.6} />
    </EffectComposer>
  );
}
