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
