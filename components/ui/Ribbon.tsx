'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { clamp01 } from '@/lib/scroll-math';
import { TruckGlyph } from './TruckGlyph';

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
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/**
 * Waypoints, walked like a vehicle rather than picked point by point.
 *
 * Choosing each x independently — however well randomised — produces a
 * snake. Independent draws from the same range keep landing on opposite
 * sides of the middle, so the line crosses the centre on almost every
 * leg and the eye reads a regular left-right weave no matter how varied
 * the individual numbers are.
 *
 * This instead carries a heading and perturbs it. Turns accumulate, so
 * the road can hold a direction for two or three legs, bend gradually,
 * or double back — the things an actual route does and a per-point
 * random never produces. Occasionally the perturbation is large enough
 * to be a real change of direction; usually it is not.
 *
 * Seeded, so the road is identical on every load and between server and
 * client. Each page passes its own seed, so Home and About get visibly
 * different roads out of the same generator.
 */
function buildWaypoints(seed: number): [number, number][] {
  const rand = seeded(seed);
  const pts: [number, number][] = [];

  let x = -0.22;
  let y = 0.005;
  // Heading measured from straight-down, so 0 runs down the page. It
  // starts angled right because the road enters from off the left edge.
  let heading = 0.3;
  pts.push([x, y]);

  while (y < 0.9) {
    // Most steps bend the heading a little; the tail of the
    // distribution supplies the occasional hard turn.
    const swing = rand();
    heading += (rand() - 0.5) * (swing > 0.75 ? 3.6 : 1.9);
    // A gentle pull back toward the middle of the page. Without it the
    // heading saturates: a run of same-signed perturbations sends the
    // road off to one side and nothing ever brings it back, so it
    // becomes a long diagonal drift. The pull is proportional to how
    // far out it already is, so it curves the road back the way a real
    // route bends around terrain — and because it competes with a much
    // larger random term it never turns into a regular oscillation.
    heading -= (x - 0.5) * 0.75;
    // Never let the road head back up the page: it has to keep making
    // downward progress or the walk stalls and crosses itself. This is
    // also what makes the arc-length bisection below valid.
    heading = Math.max(-1.2, Math.min(1.2, heading));

    const step = 0.05 + rand() * 0.085;
    x += Math.sin(heading) * step * 2.1;
    y += Math.cos(heading) * step;

    // Bounce off the edges rather than clamping flat against them,
    // which would leave the road running along the margin.
    if (x < 0.06) {
      x = 0.06 + (0.06 - x);
      heading = Math.abs(heading);
    } else if (x > 0.94) {
      x = 0.94 - (x - 0.94);
      heading = -Math.abs(heading);
    }

    pts.push([x, Math.min(y, 0.92)]);
  }

  // Leaves past the right edge, so the tail is not seen to stop.
  pts.push([1.22, Math.min(0.99, y + 0.07)]);
  return pts;
}

/**
 * Eight points around an ellipse, entered and left at its top.
 *
 * Catmull-Rom through these reads as a genuine loop in the road — the
 * kind a cloverleaf makes — rather than a kink. Eight is the fewest that
 * stays circular once smoothed; fewer looks like a rounded diamond.
 */
function loopPoints(
  cx: number,
  cy: number,
  r: number,
  aspect: number,
  dir: 1 | -1,
): [number, number][] {
  const out: [number, number][] = [];
  for (let k = 1; k <= 8; k++) {
    const a = -Math.PI / 2 + dir * ((k * Math.PI * 2) / 8);
    out.push([cx + r * Math.cos(a), cy + r * aspect * Math.sin(a)]);
  }
  return out;
}

/**
 * A route that actually visits things.
 *
 * The random walk above produces a plausible road but an indifferent
 * one: it has no idea the page has content in it, so it wanders past the
 * photographs as often as through them. Where the page provides
 * checkpoints — elements marked `data-ribbon-checkpoint`, currently the
 * service photographs — the road is built to pass through the centre of
 * each one in turn, approaching from alternating sides so the run
 * between them reads as a deliberate zig-zag rather than a drift.
 *
 * Between some checkpoints it puts in a full loop. Those are seeded, not
 * random per load, so the road is identical on every visit and between
 * server and client.
 */
function buildCheckpointWaypoints(
  seed: number,
  w: number,
  h: number,
  checkpoints: readonly (readonly [number, number])[],
): [number, number][] {
  const rand = seeded(seed);
  const pts: [number, number][] = [[-0.22, 0.005]];

  // Sideways reach of the approach, as a fraction of width. Big enough
  // that the zig-zag is legible at a glance; the checkpoints themselves
  // are what stop it becoming a uniform weave.
  const SWING = 0.3;
  const loopR = 0.075;
  // Loops are drawn in width fractions and squashed by the container's
  // aspect so they come out round on screen rather than as tall ovals.
  const aspect = h > 0 ? w / h : 1;

  checkpoints.forEach(([cx, cy], i) => {
    const side = i % 2 === 0 ? -1 : 1;
    const prevY = pts[pts.length - 1][1];
    const gap = cy - prevY;

    // A loop needs vertical room, or it collides with the checkpoint it
    // is meant to sit between.
    if (i > 0 && gap > 0.1 && rand() > 0.45) {
      const ly = prevY + gap * 0.45;
      const lx = Math.min(0.86, Math.max(0.14, cx - side * SWING * 0.7));
      pts.push([lx, ly - loopR * aspect]);
      pts.push(...loopPoints(lx, ly, loopR, aspect, side > 0 ? 1 : -1));
    }

    // Swing wide of the checkpoint, then run through its centre. The
    // pair is what makes the arrival read as a turn into the card
    // instead of the line happening to cross it.
    pts.push([
      Math.min(0.94, Math.max(0.06, cx + side * SWING)),
      Math.max(prevY + 0.01, cy - Math.min(0.09, Math.max(0.03, gap * 0.45))),
    ]);
    pts.push([cx, cy]);
  });

  // Past the last checkpoint the page still runs on for several
  // sections, so the road keeps going on the seeded walk rather than
  // stopping where the photographs do — which left the whole lower half
  // of the page with no ribbon at all.
  let [x, y] = pts[pts.length - 1];
  let heading = 0.2;
  while (y < 0.9) {
    heading += (rand() - 0.5) * 1.9;
    heading -= (x - 0.5) * 0.75;
    heading = Math.max(-1.2, Math.min(1.2, heading));

    const step = 0.02 + rand() * 0.035;
    x += Math.sin(heading) * step * 2.1;
    y += Math.cos(heading) * step;

    // Bounce off the edges rather than running along the margin.
    if (x < 0.06) {
      x = 0.06 + (0.06 - x);
      heading = Math.abs(heading);
    } else if (x > 0.94) {
      x = 0.94 - (x - 0.94);
      heading = -Math.abs(heading);
    }

    pts.push([x, Math.min(y, 0.92)]);

    // The occasional loop out here too, so the lower half of the page
    // gets the same treatment as the run between the photographs.
    if (y < 0.82 && rand() > 0.86) {
      const dir: 1 | -1 = x > 0.5 ? -1 : 1;
      const lx = Math.min(0.86, Math.max(0.14, x));
      pts.push(...loopPoints(lx, y + loopR * aspect, loopR, aspect, dir));
      y += loopR * aspect * 2;
    }
  }

  // Leaves past the right edge, so the tail is not seen to stop.
  pts.push([1.22, Math.min(0.995, y + 0.06)]);
  return pts;
}

/**
 * Builds a smooth cubic path through every waypoint using Catmull-Rom
 * control points converted to beziers. Chaining hand-written curves
 * would not guarantee tangent continuity at the joins, and any kink
 * shows up as a visible corner in a stroke this heavy.
 */
function buildPath(
  w: number,
  h: number,
  waypoints: readonly (readonly [number, number])[],
): string {
  const pts = waypoints.map(([fx, fy]) => [fx * w, fy * h] as const);
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

export function Ribbon({ seed = 918273 }: { seed?: number }) {
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

  // Checkpoint centres as fractions of the container, measured from the
  // live DOM. Re-measured whenever the container resizes, which also
  // covers the reflow that image loading causes.
  const [checkpoints, setCheckpoints] = useState<[number, number][]>([]);
  useEffect(() => {
    const el = host.current;
    if (!el || size.w === 0) return;
    const measure = () => {
      const box = el.getBoundingClientRect();
      const found: [number, number][] = [];
      document
        .querySelectorAll<HTMLElement>('[data-ribbon-checkpoint]')
        .forEach((node) => {
          const r = node.getBoundingClientRect();
          const x = (r.left + r.width / 2 - box.left) / box.width;
          const y = (r.top + r.height / 2 - box.top) / box.height;
          // Only checkpoints inside this ribbon's own span: the About
          // page mounts its own Ribbon, and a stray element from
          // elsewhere in the document would drag the road off the page.
          if (y > 0.02 && y < 0.98) found.push([x, y]);
        });
      found.sort((a, b) => a[1] - b[1]);
      setCheckpoints(found);
    };
    measure();
    // Fonts and lazy images land after first paint and move the cards.
    const id = window.setTimeout(measure, 600);
    return () => window.clearTimeout(id);
  }, [size]);

  const waypoints = useMemo(
    () =>
      checkpoints.length >= 2
        ? buildCheckpointWaypoints(seed, size.w, size.h, checkpoints)
        : // No checkpoints (About has no service photographs): fall back
          // to the seeded random walk, which needs no page content.
          buildWaypoints(seed),
    [seed, size.w, size.h, checkpoints],
  );
  const d = useMemo(
    () => (size.w > 0 ? buildPath(size.w, size.h, waypoints) : ''),
    [size.w, size.h, waypoints],
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

    // The path is sampled once into a table of points, and each sample
    // carries the greatest y reached at or before it. That running
    // maximum is monotonic by construction, which is what makes a
    // forward-only lookup possible on a road that is no longer monotonic
    // itself: it now contains full loops, where the same y occurs at
    // several different arc lengths.
    //
    // The previous version bisected the path directly for the arc length
    // level with the viewport centre. That is only valid while y always
    // increases along the path — with a loop in the road it has several
    // answers and the search returns whichever one it stumbles into, so
    // the truck teleports around the loop.
    const STEP = 6;
    const count = Math.max(2, Math.ceil(length / STEP));
    const xs = new Float32Array(count + 1);
    const ys = new Float32Array(count + 1);
    const runMax = new Float32Array(count + 1);
    for (let i = 0; i <= count; i++) {
      const pt = path.getPointAtLength((i / count) * length);
      xs[i] = pt.x;
      ys[i] = pt.y;
      runMax[i] = i === 0 ? pt.y : Math.max(runMax[i - 1], pt.y);
    }

    /** Arc length at which the road has first reached this far down. */
    const lengthAtY = (targetY: number) => {
      let lo = 0;
      let hi = count;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (runMax[mid] < targetY) lo = mid + 1;
        else hi = mid;
      }
      return (lo / count) * length;
    };

    // Where the truck actually is, chased toward where the scroll says
    // it should be. Inside a loop the target jumps by the loop's whole
    // circumference — the loop occupies almost no height, so scrolling a
    // few pixels asks the truck to cover all of it. Chasing rather than
    // snapping turns that into the truck driving round the loop.
    let at = -1;

    const tick = () => {
      const r = el.getBoundingClientRect();
      // The viewport's vertical centre, expressed in the container's
      // own coordinates. Solving for the arc length that sits level with
      // it — rather than mapping scroll depth onto path length — is what
      // keeps the truck at the middle of the screen however sideways the
      // road happens to be running locally.
      const targetY = window.innerHeight / 2 - r.top;
      const want = lengthAtY(targetY);
      // Snap on the first frame so the road does not draw itself in from
      // zero on a page loaded part-way down.
      at = at < 0 ? want : at + (want - at) * 0.18;
      const progress = clamp01(at / (length || 1));

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
        // it sits parked at the top waiting to be noticed — and also
        // whenever it is outside the frame horizontally. The road enters
        // and leaves past the left and right edges, so being on the path
        // is not the same as being on screen: without the second test
        // the truck sat off-frame at full opacity for the whole entry
        // run, and any stray shadow of it showed at the margin.
        const onScreen = at.x > -20 && at.x < size.w + 20;
        g.style.opacity =
          progress > 0.005 && progress < 0.999 && onScreen ? '1' : '0';
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // `d` matters: the checkpoints are measured after first paint, so
    // the path is rebuilt on a later render than the one that sized the
    // container. Without it this effect kept the sample table and total
    // length of the *previous* path while the DOM drew the new one, and
    // the truck tracked a road that was no longer there.
  }, [size, reduced, d]);

  return (
    <div
      ref={host}
      aria-hidden="true"
      // Extended upward past the section's own top edge: the road used
      // to begin level with the first service card, which read as it
      // starting halfway down the page. Reaching up into the dark space
      // under the pinned opening means it is already established by the
      // time the first heading arrives.
      className="pointer-events-none absolute -top-[38vh] right-0 bottom-0 left-0 -z-10 overflow-hidden"
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
              <TruckGlyph />
            </g>
          </g>
        </svg>
      )}
    </div>
  );
}
