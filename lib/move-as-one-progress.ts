/**
 * Bridge between the opening set-piece's GSAP ScrollTrigger pin and the
 * R3F frame loop. `getScrollProgress()` / `SECTIONS.opening` give a
 * *global* page fraction, which only lines up with where this pinned
 * section actually sits in the DOM when the page's total height matches
 * the proportions `SECTIONS` assumes. Since the pinned section is
 * `h-[350vh]` and other sections sit after it, that assumption drifts as
 * the page grows. ScrollTrigger already computes the section's own 0..1
 * progress from the real DOM position (and, via the Lenis wiring in
 * SmoothScrollProvider, from the smoothed scroll position) — so both the
 * truck assembly and the hero box stack's load-in read that directly
 * instead of re-deriving it from the global fraction.
 */
let local = 0;

export function setMoveAsOneProgress(value: number): void {
  local = value;
}

export function getMoveAsOneProgress(): number {
  return local;
}

/**
 * Fraction of the pin's own local progress at which the truck starts
 * driving away down the road; it is fully gone by local = 1 (pin
 * release). Shared with Highway so the lane-dash streaming speed can
 * ramp up in lockstep with the truck's departure instead of the two
 * being tuned independently and drifting out of sync.
 *
 * Pushed from 0.75 to 0.85 (round 8) to make room for the rear door to
 * finish rolling closed (see TruckAssembly's DOOR_CLOSE_END) before the
 * truck turns and drives off — otherwise the departure would start with
 * the cargo door still visibly open.
 */
export const EXIT_START = 0.85;

/** 0 before the departure begins, 1 by the moment the pin releases. */
export function getExitProgress(): number {
  const span = 1 - EXIT_START;
  if (span <= 0) return local >= EXIT_START ? 1 : 0;
  return Math.min(1, Math.max(0, (local - EXIT_START) / span));
}
