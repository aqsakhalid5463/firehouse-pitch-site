import { COLORS } from './constants';
import { clamp01 } from './scroll-math';

/**
 * The page is dark end-to-end.
 *
 * Earlier rounds dissolved from a dark hero into a light editorial half.
 * That was dropped deliberately: the red ribbon (components/ui/Ribbon)
 * now runs the full length of the page as the connecting motif, and it
 * only reads against a dark field. Committing to one world — the way the
 * Lusion reference does — also removed a whole class of contrast bugs
 * where nav and body copy had to stay legible against a moving
 * background whose luminance inverted mid-scroll.
 *
 * These are constants rather than functions of scroll on purpose: there
 * is nothing left to interpolate, and the per-frame `themeAt(progress)`
 * calls that used to drive fog, bloom, and the CSS custom properties are
 * now one-time assignments.
 */
export const THEME = {
  bg: COLORS.darkBg,
  fog: COLORS.darkFog,
  ink: COLORS.bone,
  lightIntensity: 0.6,
  bloomIntensity: 1.15,
} as const;

/**
 * Fraction of the pin's departure at which the road begins dimming out.
 * Deliberately later than the departure's start so the truck is never
 * seen driving on a road that is already half-faded — the road holds at
 * full strength while the truck pulls away, then dissolves behind it.
 */
export const ROAD_FADE_START = 0.55;

/**
 * Road opacity as a function of the truck's departure progress
 * (`getExitProgress()`), not global scroll. The road is a set-piece
 * belonging to the pinned opening; once the truck has gone, the road
 * goes with it and the SVG ribbon takes over as the through-line for the
 * rest of the page. Smoothstepped so the dissolve has no visible corner.
 */
export function roadOpacityAt(exit: number): number {
  const t = clamp01((exit - ROAD_FADE_START) / (1 - ROAD_FADE_START));
  return 1 - t * t * (3 - 2 * t);
}
