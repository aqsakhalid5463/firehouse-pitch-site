'use client';

import { create } from 'zustand';

/**
 * The three things the first paint actually waits on. There are no
 * models, HDRIs or image textures to download — every box, wheel and
 * road surface in the scene is generated procedurally at runtime — so
 * there is no byte count to measure a percentage against. These are the
 * real checkpoints that exist:
 *
 *  - `fonts`: document.fonts.ready, so headings don't reflow after the
 *    curtain lifts.
 *  - `logo`: the 290KB logo SVG. The preloader awaits the same memoised
 *    promise lib/textures.ts uses, so this genuinely gates the truck's
 *    livery rather than being a decorative wait.
 *  - `frame`: the R3F canvas has rendered once. This is the expensive
 *    one — it covers shader compilation and the procedural texture
 *    canvases — which is why it carries half the weight.
 */
export type PreloadSignal = 'fonts' | 'logo' | 'frame';

const WEIGHTS: Record<PreloadSignal, number> = {
  fonts: 0.3,
  logo: 0.2,
  frame: 0.5,
};

export function preloadProgress(done: Partial<Record<PreloadSignal, boolean>>): number {
  let total = 0;
  for (const key of Object.keys(WEIGHTS) as PreloadSignal[]) {
    if (done[key]) total += WEIGHTS[key];
  }
  // Floating-point sums of the weights can land a hair under 1; the
  // caller treats >= 1 as "complete", so snap the full set to exactly 1.
  return total > 0.999 ? 1 : total;
}

type PreloadState = {
  done: Partial<Record<PreloadSignal, boolean>>;
  markReady: (signal: PreloadSignal) => void;
};

export const usePreloadStore = create<PreloadState>((set) => ({
  done: {},
  markReady: (signal) =>
    set((state) =>
      state.done[signal] ? state : { done: { ...state.done, [signal]: true } },
    ),
}));

export function markReady(signal: PreloadSignal): void {
  usePreloadStore.getState().markReady(signal);
}
