'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { getVanishingPoint } from '@/lib/vanishing-store';

/**
 * Sends the page's content away down the 3D road as you scroll.
 *
 * The road in the background recedes upward to a horizon, and scrolling
 * already carries content upward. Those two agree, so the honest
 * reading of "the content moves along the road" is that a block travels
 * *away* from the viewer: it arrives at the bottom of the screen at
 * full size, is read, and then — as it continues up — recedes toward
 * the vanishing point, shrinking and fading as though driving off into
 * the distance.
 *
 * The alternative, having content approach from the horizon, would have
 * to fight the scroll direction rather than use it, and would put every
 * block at its smallest and faintest exactly when the reader first
 * meets it.
 *
 * Nothing here is a timeline. Every value is a function of where a
 * block currently is on screen, so it tracks scroll exactly and
 * reverses perfectly when you scroll back up.
 */

/**
 * Fraction of the viewport height above which a block starts receding.
 *
 * Everything below this is untouched: full size, full opacity, square
 * to the reader. That band is deliberately most of the screen, because
 * this is real copy and the effect must not begin until it has been
 * read. A block only leaves once it is on its way out anyway.
 */
const RECEDE_FROM = 0.62;

/** How small a block gets by the time it reaches the horizon. Not
 *  tiny: it is still legible on its way out, which keeps the effect a
 *  recession rather than a disappearing trick. */
const SCALE_AT_HORIZON = 0.72;

/**
 * Opacity by the time a block leaves the top of the screen.
 *
 * The fade is deliberately measured against the top edge and not
 * against the horizon, which is what the recession uses. Tying both to
 * the horizon meant copy hit zero opacity at 46% of the screen height,
 * and since the sections here are separated by a lot of vertical space,
 * the result was whole viewports with nothing on them at all — the road
 * on its own and no page. Fading over the full run to the top edge
 * keeps something legible on screen the whole way up while the block is
 * still visibly travelling away.
 */
const FADE_TO = 0.05;

/**
 * Where the horizon sits if the scene never reports one — the canvas
 * is disabled on low-power devices and narrow screens, where the page
 * falls back to a static gradient. Roughly where the real road's
 * horizon sits, so the effect degrades to the same gesture rather than
 * to nothing.
 */
const FALLBACK_VP = { x: 0.55, y: 0.46 };

type Rider = {
  el: HTMLElement;
  /** Centre of the element in page coordinates, measured with any
   *  transform of ours removed. Held rather than read per frame: a
   *  getBoundingClientRect for every block on every frame forces a
   *  layout, and this is the one loop that must not. */
  x: number;
  y: number;
};

export function RoadTravel() {
  const measured = useRef<Rider[]>([]);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;

    const collect = () => {
      const nodes = [
        ...document.querySelectorAll<HTMLElement>('[data-route-rider]'),
      ];
      // Cleared before measuring: a rect read through our own transform
      // would fold this frame's offset into the base position, and the
      // block would walk a little further away every time the page was
      // re-measured.
      for (const el of nodes) el.style.transform = '';
      const riders = nodes.map((el) => {
        const rect = el.getBoundingClientRect();
        return {
          el,
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2 + window.scrollY,
        };
      });
      measured.current = riders;
      for (const rider of riders) {
        rider.el.style.willChange = 'transform, opacity';
      }
    };

    collect();

    const tick = () => {
      const vh = window.innerHeight;
      const point = getVanishingPoint();
      const vp = point ?? {
        x: window.innerWidth * FALLBACK_VP.x,
        y: vh * FALLBACK_VP.y,
      };
      const from = vh * RECEDE_FROM;
      // Distance over which the recession happens. Guarded because the
      // camera can, mid-transition, put the horizon below the band.
      const run = Math.max(1, from - vp.y);

      for (const rider of measured.current) {
        const cy = rider.y - window.scrollY;
        if (cy >= from) {
          rider.el.style.transform = '';
          rider.el.style.opacity = '';
          continue;
        }

        // 0 as the block leaves the reading band, 1 at the horizon.
        const t = Math.min(1, (from - cy) / run);
        // Eased so the block holds its size for a moment after it
        // starts leaving, then falls away — linear made it shrink
        // fastest exactly where the reader was still looking.
        const u = t * t;

        // Fade runs on its own clock, all the way to the top edge. See
        // FADE_TO.
        const gone = Math.min(1, Math.max(0, (from - cy) / Math.max(1, from)));

        const scale = 1 - u * (1 - SCALE_AT_HORIZON);
        // Position lerps toward the vanishing point by the same amount
        // it shrinks, which is what makes it read as distance rather
        // than as a block that merely got smaller in place.
        const dx = (vp.x - rider.x) * (1 - scale);
        const dy = (vp.y - cy) * (1 - scale);

        rider.el.style.transform = `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0) scale(${scale.toFixed(4)})`;
        rider.el.style.opacity = `${(1 - gone * (1 - FADE_TO)).toFixed(3)}`;
      }
    };

    // On GSAP's ticker, so this advances on the same frame as Lenis and
    // ScrollTrigger rather than in a competing loop.
    gsap.ticker.add(tick);
    tick();

    // The page's height changes as ScrollTrigger builds the crew
    // section's pin, and every base position moves with it.
    const observer = new ResizeObserver(collect);
    observer.observe(document.body);
    window.addEventListener('resize', collect);

    return () => {
      gsap.ticker.remove(tick);
      observer.disconnect();
      window.removeEventListener('resize', collect);
      for (const rider of measured.current) {
        rider.el.style.transform = '';
        rider.el.style.opacity = '';
        rider.el.style.willChange = '';
      }
    };
  }, []);

  return null;
}
