'use client';

/**
 * Where the 3D highway's vanishing point currently sits on screen, in
 * viewport pixels.
 *
 * Published by the scene and read by the DOM. It cannot be a constant:
 * the About camera travels along a spline as you scroll, so the horizon
 * moves. Anything positioning itself against the road has to ask the
 * road where it is, every frame.
 *
 * A module-level value rather than a store, for the same reason
 * lib/lenis-ref.ts is: nothing renders off this, it changes every
 * frame, and a subscription would re-render the tree at 60fps for no
 * gain.
 */
let x = 0;
let y = 0;
let known = false;

export function setVanishingPoint(nextX: number, nextY: number): void {
  x = nextX;
  y = nextY;
  known = true;
}

/** Null until the scene has rendered a frame, and forever if the canvas
 *  is disabled — callers must have a fallback. */
export function getVanishingPoint(): { x: number; y: number } | null {
  return known ? { x, y } : null;
}
