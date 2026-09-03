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
  /**
   * True once the curtain is off the screen.
   *
   * The scene subscribes to this so it can render cheaply while nobody
   * can see it. Measured on a production build, the canvas was rendering
   * full-quality frames — postprocessing at up to 2x device pixel ratio
   * — behind an opaque curtain, at ~68ms a frame back to back. That is
   * the main thread saturated at ~14fps for the entire load, which is
   * what made the loader's own animation stutter. Nothing rendered in
   * that window is ever seen.
   */
  lifted: boolean;
  /**
   * Where the curtain is: 'idle' before the preloader has mounted, 'up'
   * while it covers the page, 'gone' once the page is visible.
   *
   * Entrance animations above the fold read this. Without it they ran
   * on mount — behind the curtain — and were finished before anyone
   * could see them, so the page arrived static. The three states matter:
   * anything gating on this must animate normally when the preloader is
   * not in play at all, so 'idle' has to be distinguishable from 'up'.
   * A plain boolean would leave every heading permanently hidden if the
   * preloader never ran.
   */
  curtain: 'idle' | 'up' | 'gone';
  markReady: (signal: PreloadSignal) => void;
  setLifted: () => void;
  setCurtain: (state: 'up' | 'gone') => void;
};

export const usePreloadStore = create<PreloadState>((set) => ({
  done: {},
  lifted: false,
  curtain: 'idle',
  markReady: (signal) =>
    set((state) =>
      state.done[signal] ? state : { done: { ...state.done, [signal]: true } },
    ),
  setLifted: () => set((state) => (state.lifted ? state : { lifted: true })),
  setCurtain: (curtain) => set((state) => (state.curtain === curtain ? state : { curtain })),
}));

export function setCurtain(state: 'up' | 'gone'): void {
  usePreloadStore.getState().setCurtain(state);
}

export function setLifted(): void {
  usePreloadStore.getState().setLifted();
}

export function markReady(signal: PreloadSignal): void {
  usePreloadStore.getState().markReady(signal);
}
