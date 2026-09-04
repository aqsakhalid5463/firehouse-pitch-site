'use client';

import type Lenis from 'lenis';

/**
 * A handle on the live Lenis instance.
 *
 * Lenis keeps its own virtual scroll position and writes it to the
 * window every frame, so a bare `window.scrollTo(0, 0)` is overwritten
 * on the very next tick — the page appears to refuse to go back to the
 * top. Anything that needs to move the page instantly (a route change
 * happening under a closed shutter) has to tell Lenis, not the window.
 *
 * A module-level holder rather than a store: nothing renders off this,
 * and a zustand subscription would re-render on every mount/unmount of
 * the provider for no gain.
 */
let current: Lenis | null = null;

export function setLenis(instance: Lenis | null): void {
  current = instance;
}

/** Null before the provider's effect has run, and when reduced motion is
 *  on — Lenis is not created at all in that case. Callers must handle it. */
export function getLenis(): Lenis | null {
  return current;
}

/** Jump to the top with no smoothing, whether or not Lenis is running. */
export function jumpToTop(): void {
  const lenis = getLenis();
  if (lenis) lenis.scrollTo(0, { immediate: true, force: true });
  else window.scrollTo(0, 0);
}
