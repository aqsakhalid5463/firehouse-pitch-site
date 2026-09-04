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

/** Jump to an absolute position with no smoothing, whether or not Lenis
 *  is running. */
export function jumpTo(y: number): void {
  const lenis = getLenis();
  if (!lenis) {
    window.scrollTo(0, y);
    return;
  }
  // Re-measure first. Lenis caches the document's dimensions and clamps
  // every scrollTo against the cached limit, and a client-side route
  // change never invalidates that cache — so jumping to the bottom of a
  // 16000px page immediately after arriving from a 5300px one was
  // silently clamped to 4416, a third of the way down. Nothing about
  // the call looks wrong; it just quietly lands somewhere else.
  lenis.resize();
  lenis.scrollTo(y, { immediate: true, force: true });
}

export function jumpToTop(): void {
  jumpTo(0);
}

/** The far end of the document. Used when a visitor arrives by scrolling
 *  *up* out of the page below: dropping them at the top of the page they
 *  were reversing into would undo the gesture they just made. */
export function jumpToBottom(): void {
  jumpTo(
    Math.max(0, document.documentElement.scrollHeight - window.innerHeight),
  );
}
