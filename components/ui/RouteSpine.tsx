'use client';

import { useEffect, useId, useRef, useState } from 'react';
import gsap from 'gsap';
import { TruckGlyph } from './TruckGlyph';

/**
 * A road running the length of the page, with the copy riding it.
 *
 * The ribbon on the home page threads a road *between* the content. This
 * is the opposite arrangement: the road is a spine down the left of the
 * page and every block of copy is attached to it, so the road never
 * crosses the text — the text travels with the road instead.
 *
 * The movement is the point, and it comes from one idea. A block does
 * not sample the road at its own height; it samples it at a height that
 * leads or lags depending on where the block currently sits on screen.
 * At the centre of the viewport the offset is zero and the block sits
 * exactly on the road. Above and below it, the sample slides along the
 * curve, so scrolling drags each block sideways as though it were being
 * carried along the route. Nothing is animated on a timeline: the
 * position is a pure function of scroll, which is why it tracks the
 * scroll exactly instead of chasing it.
 */

/** Where the road may wander, as fractions of the width. Kept inside the
 *  left gutter: the content column is inset to the right of it, so the
 *  road has the margin to itself. */
const ROAD_MIN = 0.035;
const ROAD_MAX = 0.155;

/** How far the sampling point leads or lags, per pixel the block is from
 *  the centre of the viewport. This is what turns the road's shape into
 *  motion — at 0 the layout is a static curve and nothing moves. */
const FOLLOW = 0.55;

/** How much of the road's sideways travel the copy takes on. At 1 the
 *  copy sways exactly as far as the road does. */
const PULL = 0.9;

/** Points sampled along the road when drawing it. Dense enough that the
 *  polyline reads as a curve without needing bezier fitting — the shape
 *  is already smooth by construction. */
const STEP_PX = 14;

const ROAD_WIDTH = 22;

/**
 * Wavelengths of the road's two weaves, in pixels.
 *
 * Pixels, not fractions of the page. The first version phrased these as
 * cycles across the whole document, which on a ten-thousand-pixel page
 * meant a bend every few thousand pixels — the road was geometrically a
 * curve and visually a straight vertical bar, because no single screen
 * ever contained enough of one bend to see it. A road has to turn on
 * the scale of the window someone is looking through, so the period is
 * fixed in pixels and the page simply contains however many of them it
 * contains.
 */
const LONG_WAVE = 1500;
const SHORT_WAVE = 610;

/**
 * The road's horizontal position at a page height, as a fraction of the
 * width.
 *
 * Two sine waves of unrelated periods rather than a random walk: it is
 * smooth by construction, which matters because this function is
 * sampled independently by the drawing code and by every block on the
 * page — a walk would need a shared lookup table to stay consistent,
 * and any interpolation error between the two would show up as copy
 * sitting slightly off its own road.
 */
function roadAt(y: number, seed: number): number {
  const mid = (ROAD_MIN + ROAD_MAX) / 2;
  const amp = (ROAD_MAX - ROAD_MIN) / 2;
  const a = Math.sin((y / LONG_WAVE) * Math.PI * 2 + seed);
  const b = Math.sin((y / SHORT_WAVE) * Math.PI * 2 + seed * 1.7);
  return mid + amp * (a * 0.7 + b * 0.3);
}

export function RouteSpine({ seed = 1.9 }: { seed?: number }) {
  const host = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const glowRef = useRef<SVGPathElement>(null);
  const edgeRef = useRef<SVGPathElement>(null);
  const truckRef = useRef<SVGGElement>(null);
  const maskRef = useRef<SVGPathElement>(null);
  const maskId = useId();
  const [box, setBox] = useState({ w: 0, h: 0 });

  // Remeasure whenever the page's height changes. It changes a lot here:
  // the crew section is pinned, and its spacer only exists once
  // ScrollTrigger has built it.
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const measure = () => {
      const parent = el.parentElement;
      if (!parent) return;
      const w = parent.clientWidth;
      const h = parent.scrollHeight;
      setBox((current) =>
        current.w === w && current.h === h ? current : { w, h },
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (el.parentElement) observer.observe(el.parentElement);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  const { w, h } = box;

  const d =
    w > 0 && h > 0
      ? (() => {
          const points: string[] = [];
          const steps = Math.max(2, Math.ceil(h / STEP_PX));
          for (let i = 0; i <= steps; i++) {
            const y = (i / steps) * h;
            const x = roadAt(y, seed) * w;
            points.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`);
          }
          return points.join(' ');
        })()
      : '';

  useEffect(() => {
    const el = host.current;
    const path = pathRef.current;
    if (!el || !path || !d) return;

    // Below md the content column has no inset, so there is no margin
    // for the road to live in and nothing to ride it. Bailing out here
    // rather than hiding the element matters: a hidden road would still
    // be writing a sideways transform onto every block of copy.
    const narrow = window.matchMedia('(max-width: 767px)').matches;
    const reduced =
      narrow || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const length = path.getTotalLength();
    const strokes = [
      path,
      glowRef.current,
      edgeRef.current,
      maskRef.current,
    ].filter(Boolean) as SVGPathElement[];

    if (reduced) {
      // The road, drawn, and nothing that moves. The layout still reads
      // as a route; it simply is not travelled.
      for (const stroke of strokes) {
        stroke.style.strokeDasharray = '';
        stroke.style.strokeDashoffset = '';
      }
      return;
    }

    for (const stroke of strokes) {
      stroke.style.strokeDasharray = `${length}`;
      stroke.style.strokeDashoffset = `${length}`;
    }

    const riders = [
      ...(el.parentElement?.querySelectorAll<HTMLElement>(
        '[data-route-rider]',
      ) ?? []),
    ];
    for (const rider of riders) rider.style.willChange = 'transform';

    const midX = ((ROAD_MIN + ROAD_MAX) / 2) * w;

    const tick = () => {
      const rect = el.getBoundingClientRect();
      const top = rect.top + window.scrollY;
      const vh = window.innerHeight;

      // How far down the route the visitor has driven. Anchored to the
      // middle of the viewport at both ends, so the road is being drawn
      // where the visitor is looking rather than off the bottom of the
      // screen.
      const from = top - vh * 0.5;
      const span = Math.max(1, h);
      const progress = Math.min(
        1,
        Math.max(0, (window.scrollY - from) / span),
      );

      for (const stroke of strokes) {
        stroke.style.strokeDashoffset = `${length * (1 - progress)}`;
      }

      const truck = truckRef.current;
      if (truck) {
        const at = path.getPointAtLength(length * progress);
        const ahead = path.getPointAtLength(
          Math.min(length, length * progress + 2),
        );
        const angle =
          (Math.atan2(ahead.y - at.y, ahead.x - at.x) * 180) / Math.PI;
        truck.setAttribute(
          'transform',
          `translate(${at.x.toFixed(1)} ${at.y.toFixed(1)}) rotate(${angle.toFixed(1)})`,
        );
        // Hidden at the very ends, where it would sit parked on the
        // first or last pixel of road.
        truck.style.opacity = progress > 0.004 && progress < 0.997 ? '1' : '0';
      }

      for (const rider of riders) {
        const r = rider.getBoundingClientRect();
        const centre = r.top + r.height / 2;
        // Lead or lag by how far this block is from the middle of the
        // screen. Zero at the centre — that is the moment the block is
        // exactly on its road.
        const drift = (vh * 0.5 - centre) * FOLLOW;
        const sampleY = centre + window.scrollY - top + drift;
        const x = roadAt(Math.min(h, Math.max(0, sampleY)), seed) * w;
        rider.style.transform = `translate3d(${((x - midX) * PULL).toFixed(1)}px, 0, 0)`;
      }
    };

    // On GSAP's ticker rather than a private rAF loop, so this advances
    // on the same frame as Lenis and ScrollTrigger. Two competing loops
    // is what desyncs pinning elsewhere in this codebase.
    gsap.ticker.add(tick);
    tick();

    return () => {
      gsap.ticker.remove(tick);
      for (const rider of riders) {
        rider.style.transform = '';
        rider.style.willChange = '';
      }
    };
  }, [d, w, h, seed]);

  return (
    <div
      ref={host}
      data-route-spine
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 hidden overflow-hidden md:block"
    >
      {w > 0 && h > 0 && (
        <svg
          width={w}
          height={h}
          viewBox={`0 0 ${w} ${h}`}
          fill="none"
          className="absolute inset-0"
        >
          {/* Dimmed as a group, the way the home page's ribbon is: the
              road is background, and the truck on it is not. */}
          <defs>
            {/* The revealed road, reused as a mask. The lane markings
                need their own dasharray for the dashes themselves, so
                they cannot also use it to animate the draw-on; masking
                them with the revealed stroke gets both. */}
            <mask id={maskId}>
              <path
                ref={maskRef}
                d={d}
                stroke="#fff"
                strokeWidth={ROAD_WIDTH}
                strokeLinecap="round"
                fill="none"
              />
            </mask>
          </defs>

          <g opacity={0.5}>
            <path
              ref={glowRef}
              d={d}
              stroke="var(--color-ribbon-asphalt)"
              strokeWidth={ROAD_WIDTH + 14}
              strokeLinecap="round"
              fill="none"
              opacity={0.18}
              style={{ filter: 'blur(16px)' }}
            />
            <path
              ref={pathRef}
              d={d}
              stroke="var(--color-ribbon-asphalt)"
              strokeWidth={ROAD_WIDTH}
              strokeLinecap="round"
              fill="none"
            />
            <path
              ref={edgeRef}
              d={d}
              stroke="var(--color-ribbon-edge)"
              strokeWidth={ROAD_WIDTH - 3}
              strokeLinecap="round"
              fill="none"
              opacity={0.5}
            />

            {/* Dashed centre line. Without it the road reads as a bar. */}
            <path
              d={d}
              stroke="#E8EAEE"
              strokeWidth={2.5}
              strokeDasharray="14 20"
              strokeLinecap="butt"
              fill="none"
              opacity={0.7}
              mask={`url(#${maskId})`}
            />
          </g>

          <g ref={truckRef} style={{ opacity: 0 }}>
            <g transform="translate(-24 -17) scale(1.5)">
              <TruckGlyph />
            </g>
          </g>
        </svg>
      )}
    </div>
  );
}
