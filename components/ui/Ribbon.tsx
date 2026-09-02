'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { clamp01 } from '@/lib/scroll-math';

/**
 * The red ribbon: one continuous line running from the end of the 3D
 * road down through the rest of the page, drawing itself as you scroll,
 * with a truck at the drawing tip.
 *
 * Deliberately SVG rather than an extension of the R3F scene. The truck
 * in the hero lives in world space under a moving camera; making it
 * follow a *page-space* path would mean unprojecting layout coordinates
 * into the scene every frame and fighting the camera rig for control of
 * the same object. A flat path gives exact control over where the line
 * sits relative to the cards, costs one `<path>`, and stays crisp at any
 * zoom.
 *
 * Geometry is computed in real CSS pixels (not a normalised viewBox with
 * preserveAspectRatio="none") so that the stroke keeps a constant weight
 * and the truck glyph never shears as the container's aspect ratio
 * changes with viewport width.
 */

/**
 * Waypoints as fractions of the container's width and height. The x
 * values alternate sides to weave between the two staggered service
 * columns; the first point starts centred because that is where the 3D
 * road's vanishing point sits, so the ribbon reads as the road
 * continuing rather than as a new element appearing.
 */
const WAYPOINTS: readonly (readonly [number, number])[] = [
  // Enters from off the left edge rather than the centre-top. Starting
  // mid-frame made the line appear to begin in mid-air; coming in past
  // the edge means it is already travelling when it first becomes
  // visible, the way a road arrives from somewhere off-screen.
  [-0.18, 0.03],
  // Irregular on purpose. An earlier version alternated left-right on an
  // even vertical pitch, which read as a decorative snake rather than a
  // route: the eye predicted every turn. These vary both how far the
  // line swings and how long it runs before the next turn, including a
  // couple of shallow stretches that barely move at all.
  [0.34, 0.08],
  [0.79, 0.15],
  [0.62, 0.24],
  [0.16, 0.33],
  [0.28, 0.42],
  [0.74, 0.5],
  [0.9, 0.59],
  [0.47, 0.67],
  [0.19, 0.75],
  [0.55, 0.84],
  // Leaves past the right edge, so the tail is not seen to stop.
  [1.18, 0.92],
];

/**
 * Builds a smooth cubic path through every waypoint using Catmull-Rom
 * control points converted to beziers. Chaining hand-written curves
 * would not guarantee tangent continuity at the joins, and any kink
 * shows up as a visible corner in a stroke this heavy.
 */
function buildPath(w: number, h: number): string {
  const pts = WAYPOINTS.map(([fx, fy]) => [fx * w, fy * h] as const);
  let d = `M ${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
  }
  return d;
}

/** Stroke width of the road surface itself, in CSS pixels. */
const ROAD_WIDTH = 22;

export function Ribbon() {
  const host = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const maskPathRef = useRef<SVGPathElement>(null);
  const glowPathRef = useRef<SVGPathElement>(null);
  const edgePathRef = useRef<SVGPathElement>(null);
  const truckRef = useRef<SVGGElement>(null);
  // useId keeps the mask reference unique when both pages mount a Ribbon.
  const maskId = `ribbon-reveal-${useId().replace(/:/g, '')}`;
  const [size, setSize] = useState({ w: 0, h: 0 });
  const reduced = useReducedMotion();

  // Track the container's pixel size so the path can be rebuilt on
  // resize and on the reflows that image loading causes.
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize((prev) =>
        Math.abs(prev.w - width) < 1 && Math.abs(prev.h - height) < 1
          ? prev
          : { w: width, h: height },
      );
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const d = useMemo(
    () => (size.w > 0 ? buildPath(size.w, size.h) : ''),
    [size.w, size.h],
  );

  useEffect(() => {
    const el = host.current;
    const path = pathRef.current;
    if (!el || !path || size.w === 0) return;

    const length = path.getTotalLength();
    // Every layer that makes up the road is revealed by the same
    // stroke-dasharray trick, so they are collected once and written
    // together — the surface, the kerb, the glow, and the mask that
    // clips the centre-line dashes to the drawn length.
    const revealed = [
      path,
      maskPathRef.current,
      glowPathRef.current,
      edgePathRef.current,
    ].filter((p): p is SVGPathElement => p !== null);
    revealed.forEach((p) => {
      p.style.strokeDasharray = `${length}`;
    });

    if (reduced) {
      // Show the finished line with no animation and park the truck at
      // its end, so the composition still reads.
      revealed.forEach((p) => {
        p.style.strokeDashoffset = '0';
      });
      const end = path.getPointAtLength(length);
      truckRef.current?.setAttribute(
        'transform',
        `translate(${end.x} ${end.y})`,
      );
      return;
    }

    let raf = 0;
    const tick = () => {
      const r = el.getBoundingClientRect();
      // Draw against the viewport's midpoint rather than its top edge,
      // so the tip of the line sits where the reader is actually
      // looking instead of racing ahead off-screen.
      const mid = window.innerHeight / 2;
      const progress = clamp01((mid - r.top) / (r.height || 1));

      const offset = `${length * (1 - progress)}`;
      revealed.forEach((p) => {
        p.style.strokeDashoffset = offset;
      });

      const g = truckRef.current;
      if (g) {
        const d = length * progress;
        const at = path.getPointAtLength(d);
        // Sample a short distance either side for the tangent; using the
        // point itself and one neighbour biases the heading by half a
        // sample and makes the truck visibly lag on tight curves.
        const back = path.getPointAtLength(Math.max(0, d - 2));
        const fwd = path.getPointAtLength(Math.min(length, d + 2));
        const angle =
          (Math.atan2(fwd.y - back.y, fwd.x - back.x) * 180) / Math.PI;
        g.setAttribute(
          'transform',
          `translate(${at.x} ${at.y}) rotate(${angle})`,
        );
        // Hide the truck until the line has actually started, otherwise
        // it sits parked at the top waiting to be noticed.
        g.style.opacity = progress > 0.005 && progress < 0.999 ? '1' : '0';
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [size, reduced]);

  return (
    <div
      ref={host}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      {size.w > 0 && (
        <svg
          width={size.w}
          height={size.h}
          viewBox={`0 0 ${size.w} ${size.h}`}
          fill="none"
          className="absolute inset-0"
        >
          <defs>
            {/* The revealed length of the road, reused as a mask.
                The lane markings need their own stroke-dasharray for the
                dashes themselves, so they cannot also use dasharray to
                animate the draw-on. Masking them with the road's
                revealed stroke gets both: the dashes stay dashes, and
                they only appear where road already exists. */}
            <mask id={maskId}>
              <path
                d={d}
                stroke="#fff"
                strokeWidth={ROAD_WIDTH}
                strokeLinecap="round"
                fill="none"
                ref={maskPathRef}
              />
            </mask>
          </defs>

          {/* Soft glow under the road, so it sits in the page rather
              than on top of it. */}
          <path
            d={d}
            stroke="var(--color-ribbon-asphalt)"
            strokeWidth={ROAD_WIDTH + 16}
            strokeLinecap="round"
            fill="none"
            opacity={0.18}
            style={{ filter: 'blur(18px)' }}
            ref={glowPathRef}
          />

          {/* The road surface. */}
          <path
            ref={pathRef}
            d={d}
            stroke="var(--color-ribbon-asphalt)"
            strokeWidth={ROAD_WIDTH}
            strokeLinecap="round"
            fill="none"
          />

          {/* Kerb lines down both edges, drawn as one stroke sitting
              just inside the road's own width. */}
          <path
            d={d}
            stroke="var(--color-ribbon-edge)"
            strokeWidth={ROAD_WIDTH - 3}
            strokeLinecap="round"
            fill="none"
            opacity={0.55}
            ref={edgePathRef}
          />

          {/* Dashed centre line. */}
          <path
            d={d}
            stroke="#E8EAEE"
            strokeWidth={2.5}
            strokeDasharray="14 20"
            strokeLinecap="butt"
            fill="none"
            opacity={0.75}
            mask={`url(#${maskId})`}
          />

          {/* Top-down truck at the drawing tip. Drawn pointing along +X
              so the tangent angle can be applied directly. */}
          <g ref={truckRef} style={{ opacity: 0 }}>
            {/* Drawn at 32x22 in its own coordinates, then scaled up
                and re-centred on the path. At 1x it read as an
                indistinct blob against a 10px stroke. */}
            <g transform="translate(-27 -19) scale(1.7)">
              <rect
                x="0"
                y="3"
                width="21"
                height="16"
                rx="2"
                fill="var(--color-silver-glass)"
              />
              <rect
                x="20"
                y="1"
                width="12"
                height="20"
                rx="3"
                fill="var(--color-fire)"
              />
              <rect x="28" y="5" width="3" height="12" rx="1.5" fill="#0A0A0C" />
              <rect x="2" y="0" width="15" height="3" rx="1.5" fill="#0A0A0C" />
              <rect x="2" y="19" width="15" height="3" rx="1.5" fill="#0A0A0C" />
            </g>
          </g>
        </svg>
      )}
    </div>
  );
}
