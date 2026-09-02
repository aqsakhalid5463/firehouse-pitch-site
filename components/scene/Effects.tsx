'use client';

import { EffectComposer, Bloom, ChromaticAberration, Vignette } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { THEME } from '@/lib/theme';

export function Effects() {
  // Bloom used to be animated down to 0 across the dark-to-light
  // dissolve. The page is dark throughout now (lib/theme.ts), so it is a
  // fixed prop and the per-frame ref write is gone.
  return (
    <EffectComposer multisampling={0}>
      <Bloom
        intensity={THEME.bloomIntensity}
        luminanceThreshold={0.25}
        luminanceSmoothing={0.9}
        mipmapBlur
      />
      <ChromaticAberration
        blendFunction={BlendFunction.NORMAL}
        offset={[0.00018, 0.00028]}
      />
      <Vignette eskil={false} offset={0.25} darkness={0.6} />
    </EffectComposer>
  );
}
