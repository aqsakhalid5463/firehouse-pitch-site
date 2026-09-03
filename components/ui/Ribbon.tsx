"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { clamp01 } from "@/lib/scroll-math";
import { TruckGlyph } from "./TruckGlyph";

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
export type Rect = { x0: number; y0: number; x1: number; y1: number };

/**
 * Headings, body copy and panels the road is not allowed to cross,
 * in the same 0-1 fraction space as the waypoints.
 *
 * Routing around them at generation time rather than bending away from
 * them at runtime is a deliberate choice: a road that was laid around
 * the buildings reads as a route, while one that flinches as the truck
 * approaches reads as nervous — and a path that moves under text while
 * someone is reading it is exactly the motion that stops being charming
 * on a second visit. The cost is that avoidance is only as good as the
 * measurements, which is why they are re-taken on resize.
 */
function inside(o: Rect, x: number, y: number, px: number, py: number) {
  return x > o.x0 - px && x < o.x1 + px && y > o.y0 - py && y < o.y1 + py;
}

/**
 * Whether the leg from a to b touches anything. Sampled along its
 * length, not just tested at the ends: a single step can be a fifth of
 * the container wide, so both ends can sit clear either side of a
 * heading the middle runs straight through.
 */
function legBlocked(
  obstacles: readonly Rect[],
  ax: number,
  ay: number,
  bx: number,
  by: number,
  px: number,
  py: number,
) {
  if (obstacles.length === 0) return false;
  for (let i = 0; i <= 5; i++) {
    const t = i / 5;
    const x = ax + (bx - ax) * t;
    const y = ay + (by - ay) * t;
    for (const o of obstacles) if (inside(o, x, y, px, py)) return true;
  }
  return false;
}

/**
 * Deviations tried, in order, when the intended heading runs into
 * something. Smallest first, so the road gives way by as little as it
 * can and the detour looks intended rather than panicked; alternating
 * sides so it is equally willing to go either way round.
 */
const DODGE = [0, 0.28, -0.28, 0.58, -0.58, 0.92, -0.92, 1.25, -1.25];

/**
 * Step lengths tried alongside those deviations, as multiples of the
 * step the walk wanted.
 *
 * Deviation alone cannot get around a wide heading, and the reason is
 * worth writing down because it is not obvious: turning hard enough to
 * clear one sideways means heading nearly horizontal, and a nearly
 * horizontal step makes almost no downward progress — which the walk
 * rejects, because it has to keep descending. So every large deviation
 * was being discarded and the road had nothing left but to plough
 * straight through the text.
 *
 * Allowing the step to lengthen gives the walk the other way out: dive
 * under the obstacle in one longer leg and resume. Between the two it
 * can either go around the side or drop below, which is what routing
 * actually means.
 */
const STRIDE = [1, 1.7, 2.6];

/**
 * How far the road may lean from vertical, as a ratio of sideways travel
 * to downward travel *in pixels*, at full heading.
 *
 * The walk works in fractions of its container, and used to multiply its
 * sideways component by a flat 2.1. That was tuned when the ribbon was
 * one path down a 16,000px page: a fraction of the width is a small
 * distance next to a fraction of that height, so the road came out
 * gently raked. Split into zones a few hundred pixels tall, the same
 * constant asks for a 400px sideways move against an 87px drop — a 78
 * degree lean, which is a hairpin, and is where the 58 degree corner
 * came from. Converting through the zone's own aspect keeps the road
 * driving the same way whatever shape the section it is crossing.
 */
const LEAN = 0.9;

/** A loop chance no draw can beat, i.e. never loop. */
const NO_LOOPS = 1.1;

/**
 * Candidate legs, cheapest first. Cost weighs a turn against a longer
 * stride so the road gives way by as little as it can: it would rather
 * bend slightly than lengthen, and rather lengthen than swing hard.
 */
const CANDIDATES = DODGE.flatMap((dev) =>
  STRIDE.map((stride) => ({
    dev,
    stride,
    cost: Math.abs(dev) + (stride - 1) * 0.55,
  })),
).sort((a, b) => a.cost - b.cost);

/**
 * Margin kept from a measured box, in CSS pixels: half the road's own
 * width, plus slack for an element still sitting at its entrance offset
 * when it was measured from far up the page.
 *
 * Pixels, not a fraction of the zone. A fraction cannot do this job —
 * the zones are wildly different heights, so one fraction meant 99px of
 * clearance in the tall run of service photographs and 22px in the short
 * service-area strip, and 22px is less than an entrance offset. That is
 * exactly how the road ended up lying along the service-area eyebrow.
 */
const MARGIN_X = 16;
const MARGIN_Y = 34;

/**
 * Floor under that margin, as a fraction of the zone.
 *
 * It is larger than it looks like it needs to be, and the reason is the
 * smoothing: avoidance is checked on the straight legs between
 * waypoints, but the path drawn is a Chaikin-cut Catmull-Rom spline
 * through them, which cuts corners *inward*. Knots that clear a heading
 * by a hair therefore produce a curve that does not. Dropping this floor
 * to skim closer took the closing headline from 17 crossings to 87 for
 * exactly that reason. The margin is what absorbs the corner-cutting.
 */
const MIN_PAD_X = 0.035;
const MIN_PAD_Y = 0.035;

const padFor = (w: number, h: number) => ({
  padX: Math.max(MIN_PAD_X, MARGIN_X / w),
  padY: Math.max(MIN_PAD_Y, MARGIN_Y / h),
});

/**
 * Fractions of that margin tried in turn before the road gives up.
 *
 * Clearance cuts both ways, which is the whole reason this is a list
 * rather than a number: raising it uniformly to fix the eyebrow made the
 * two big headings *much* worse, because with a generous margin there is
 * no free leg anywhere near them and the walk falls back on ploughing
 * straight through. Squeezing past a heading with a few pixels to spare
 * is far better than crossing it, so a tight spot gets a tight route
 * instead of no route at all.
 */
const PADS = [1, 0.7, 0.45];

/**
 * How many routes to generate before choosing one.
 *
 * The walk is chaotic: it is deterministic for a given seed, but one
 * flipped avoidance decision reroutes everything after it, so tuning the
 * avoidance parameters was tuning *luck* — the same mechanism gave the
 * closing headline 17 crossings under one margin and 87 under a margin a
 * thousandth different. Rather than hunt for the lucky constant, each
 * zone draws several routes from neighbouring seeds, scores them against
 * the very geometry that will be drawn, and keeps the best. The route is
 * still identical on every load, because the seeds are.
 */
const ATTEMPTS = 20;

/**
 * What a route costs: how much of it lies over page copy, plus how badly
 * it drives.
 *
 * Both terms are needed. Scoring crossings alone picked a route that
 * dodged every heading and turned like a switchback — a 55 degree corner
 * in a road a truck is supposed to be driving — because nothing in the
 * score knew that mattered. Turns are weighted heavily: a visible kink
 * is worse than clipping a line of text, since one looks broken and the
 * other merely untidy.
 *
 * Measured on the *smoothed* points rather than the raw knots, because
 * the corner-cutting is the whole reason a route with clear knots can
 * still cross something.
 */
const TURN_LIMIT = (18 * Math.PI) / 180;
const TURN_COST = 8;

function scoreRoute(
  w: number,
  h: number,
  waypoints: readonly (readonly [number, number])[],
  obstacles: readonly Rect[],
  padX: number,
  padY: number,
) {
  const pts = controlNet(w, h, waypoints);
  let cost = 0;
  for (const [px, py] of pts) {
    const x = px / w;
    const y = py / h;
    for (const o of obstacles) {
      if (inside(o, x, y, padX * 0.5, padY * 0.5)) {
        cost += 1;
        break;
      }
    }
  }
  for (let i = 1; i < pts.length - 1; i++) {
    const a1 = Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0]);
    const a2 = Math.atan2(pts[i + 1][1] - pts[i][1], pts[i + 1][0] - pts[i][0]);
    const turn = Math.abs(((a2 - a1 + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    if (turn > TURN_LIMIT) cost += TURN_COST;
  }
  return cost;
}

/**
 * Slide a single knot sideways until it is clear, used where the route
 * is dictated by the page (the approach and exit swings around a service
 * photograph) and so cannot be re-steered. Whichever side is nearer
 * wins, so the detour is the smaller one.
 */
function nudge(
  obstacles: readonly Rect[],
  x: number,
  y: number,
  px: number,
  py: number,
) {
  // Past this, sliding the knot costs more than it saves: a large
  // sideways jump between two knots at similar heights is a hairpin, and
  // a kink in the road is more obviously wrong than a clipped line.
  const MAX_SHIFT = 0.12;
  let out = x;
  for (const o of obstacles) {
    if (!inside(o, out, y, px, py)) continue;
    const left = o.x0 - px;
    const right = o.x1 + px;
    // Only worth moving to a side that is actually on the page.
    const canLeft = left > 0.05;
    const canRight = right < 0.95;
    if (canLeft && (!canRight || out - left < right - out)) out = left;
    else if (canRight) out = right;
  }
  if (Math.abs(out - x) > MAX_SHIFT) return x;
  return Math.min(0.95, Math.max(0.05, out));
}

function buildWaypoints(
  seed: number,
  obstacles: readonly Rect[] = [],
  loopChance = 0.86,
  aspect = 1,
  padX = 0,
  padY = 0,
  lean = 2.1,
): [number, number][] {
  const rand = seeded(seed);
  const pts: [number, number][] = [];
  const loopR = 0.085;

  let x = -0.22;
  let y = 0.005;
  // Heading measured from straight-down, so 0 runs down the page. It
  // starts angled right because the road enters from off the left edge,
  // and the exact angle is drawn from the seed rather than fixed: the
  // entry angle decides which side of the copy at the top of a section
  // the road ends up on, so leaving it constant gave every candidate
  // route the same opening and the search nothing to choose between.
  let heading = -0.15 + rand() * 0.85;
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
    // Give way to page content by as little as possible: try the
    // intended heading first, then progressively larger deviations
    // either side, and take the first leg that touches nothing. If every
    // candidate is blocked — a heading running the full width, say — the
    // road takes the one it wanted, because a road that crosses some
    // text is better than a walk that stalls in place.
    let chosen = heading;
    // Last resort if nothing is clear at any margin: dive straight down
    // in the longest stride available. Crossing a block of text
    // square-on and quickly is much less damaging than running along its
    // length, which is what simply taking the intended heading did.
    let stride = STRIDE[STRIDE.length - 1];
    let found = false;
    for (const relax of PADS) {
      for (const c of CANDIDATES) {
        const h = heading + c.dev;
        const nx = x + Math.sin(h) * step * lean * c.stride;
        const ny = y + Math.cos(h) * step * c.stride;
        if (
          ny > y &&
          !legBlocked(obstacles, x, y, nx, ny, padX * relax, padY * relax)
        ) {
          chosen = h;
          stride = c.stride;
          found = true;
          break;
        }
      }
      if (found) break;
    }
    heading = chosen;
    x += Math.sin(heading) * step * lean * stride;
    y += Math.cos(heading) * step * stride;

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

    // Circles. This walk is what the zones between the photographs use,
    // and it is the one that is meant to be showy — so it loops far more
    // readily than the run between the service cards does. A loop needs
    // a clear disc to turn in: wrapped around a heading it looks like a
    // mistake rather than a flourish.
    if (y < 0.78 && rand() > loopChance) {
      const dir: 1 | -1 = x > 0.5 ? -1 : 1;
      const lx = Math.min(0.82, Math.max(0.18, x));
      const drop = loopR * aspect * 1.2;
      if (
        !legBlocked(obstacles, lx - loopR, y, lx + loopR, y + drop, padX, padY)
      ) {
        pts.push(...loopFrom(lx, y, loopR, aspect, dir, drop));
        x = lx;
        y += drop;
      }
    }
  }

  // Leaves past the right edge, so the tail is not seen to stop.
  pts.push([1.22, Math.min(0.99, y + 0.07)]);
  return pts;
}

/**
 * A loop in the road, entered and left travelling downward.
 *
 * Where a loop is joined matters more than how round it is. Entering at
 * the *top* of a circle — the obvious choice — is what produced the
 * sharp spike in the first version: the tangent at the top of a circle
 * is horizontal, so a road arriving vertically had to turn 90° to get on
 * to it and 90° again to get off. No amount of extra sample points or
 * smoothing fixes a join that is geometrically a corner.
 *
 * Entering at the *side* instead, where the circle's own tangent is
 * already vertical, means the road joins and leaves the loop travelling
 * the way it was already going. The coil also drifts downward as it
 * goes round, so it exits below where it entered rather than on top of
 * itself, which would leave two coincident knots and a cusp between
 * them.
 */
function loopFrom(
  x: number,
  y: number,
  r: number,
  aspect: number,
  dir: 1 | -1,
  drift: number,
): [number, number][] {
  // Centre placed so the entry point is exactly where the road already
  // is, at the circle's side.
  const cx = x - dir * r;
  const out: [number, number][] = [];
  // Enough samples to describe a circle, few enough that consecutive
  // knots are comfortably further apart than MIN_KNOT_GAP.
  //
  // At 14 samples an 86px-radius loop puts its knots 38px apart, against
  // a 34px pruning threshold — so some survived and some did not, and
  // the circle came out visibly lumpy with a lopsided crossing. The
  // radius below was raised at the same time: a bigger loop is both
  // rounder for the same sample count and better looking than a small
  // one squeezed between two lines of text.
  const STEPS = 11;
  for (let k = 1; k <= STEPS; k++) {
    const t = k / STEPS;
    const a = t * Math.PI * 2;
    out.push([
      cx + dir * r * Math.cos(a),
      y + r * aspect * Math.sin(a) + drift * t,
    ]);
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
  obstacles: readonly Rect[] = [],
  loopChance = 0.45,
  padX = 0,
  padY = 0,
  lean = 2.1,
): [number, number][] {
  const rand = seeded(seed);

  // Where the road enters from off the left edge.
  //
  // Entering level with the top of the section is what put it straight
  // through the section heading: the first photograph is a long way
  // down, so the lead-in is one long diagonal and the heading is in the
  // middle of it. Unlike the free walk, this route cannot steer — its
  // knots are dictated by the photographs — so the fix is to come in
  // underneath the copy at the top instead, which also reads better:
  // the road arrives below the title rather than across it.
  let entryY = 0.005;
  const firstY = checkpoints.length
    ? Math.min(...checkpoints.map((c) => c[1]))
    : 0.3;
  for (const o of obstacles) {
    if (o.y0 < firstY * 0.9 && o.x0 < 0.6)
      entryY = Math.max(entryY, o.y1 + padY);
  }
  entryY = Math.min(entryY, firstY * 0.75);

  const pts: [number, number][] = [[-0.22, entryY]];

  // Sideways reach of the approach, as a fraction of width. Big enough
  // that the zig-zag is legible at a glance; the checkpoints themselves
  // are what stop it becoming a uniform weave.
  const SWING = 0.22;
  const loopR = 0.085;
  // Loops are drawn in width fractions and squashed by the container's
  // aspect so they come out round on screen rather than as tall ovals.
  const aspect = h > 0 ? w / h : 1;

  // Cards come in rows of two. Threading through *both* centres of a
  // row is geometrically a hairpin and nothing downstream can smooth it
  // away: the pair is ~660px apart horizontally and ~120px apart
  // vertically, so the road would have to run almost level, stop, and
  // double back. One card per row — alternating sides down the page —
  // gives every leg the full height of a row to make its sideways move
  // in, which is what turns the route into a real zig-zag. The road
  // still passes close to the skipped card, because its neighbour's
  // approach and exit swing out across that column.
  // How close in height two cards must be to count as the same row.
  //
  // In pixels, because it is a fact about the layout, not about the
  // container. It used to be a fraction, which was 480px when the ribbon
  // was one path down the whole page and 85px once it was split into
  // zones — and the service grid staggers its columns by about 120px, so
  // at 85px a left/right pair stopped reading as one row. The road then
  // threaded through *both* centres of a pair, which is the hairpin this
  // grouping exists to prevent: the pair is ~660px apart sideways and
  // ~120px apart vertically, so the road has to run almost level, stop,
  // and double back. That is where the 57 degree corner came from.
  const ROW_TOLERANCE = 420 / (h || 1);
  const rows: [number, number][][] = [];
  checkpoints.forEach((cp) => {
    const row = rows[rows.length - 1];
    if (row && Math.abs(cp[1] - row[0][1]) < ROW_TOLERANCE)
      row.push([...cp] as [number, number]);
    else rows.push([[...cp] as [number, number]]);
  });
  const visited = rows.map((row, i) => {
    // Alternate which side of the row is visited, so consecutive legs
    // cross the page instead of running down one column.
    const wantLeft = i % 2 === 0;
    const sorted = [...row].sort((a, b) => a[0] - b[0]);
    return wantLeft ? sorted[0] : sorted[sorted.length - 1];
  });

  visited.forEach(([cx, cy], i) => {
    // Approach from the side the road is actually coming from, so the
    // visit continues the crossing rather than reversing it.
    //
    // This used to be inferred from the card's own position — left half
    // of the page, approach from the right — which is only the same
    // thing when the road happens to be on that side already. It was not
    // for the first card: the road enters from off the left edge, so it
    // ran *past* the card to a knot on its right, doubled back left
    // through the centre, then turned right again. A 149 degree spike,
    // and the corner the smoothing could never get out.
    const prev = pts[pts.length - 1];
    const side = prev[0] < cx ? -1 : 1;
    const prevY = prev[1];
    const gap = cy - prevY;

    // A loop needs vertical room, or it collides with the checkpoint it
    // is meant to sit between.
    if (i > 0 && gap > 0.16 && rand() > loopChance) {
      const dir: 1 | -1 = side > 0 ? 1 : -1;
      const ly = prevY + gap * 0.4;
      const lx = Math.min(0.82, Math.max(0.18, cx - side * SWING * 0.7));
      // A knot directly above the entry, so the road is already running
      // vertically when it meets the loop's own vertical tangent.
      pts.push([lx, ly - loopR * aspect * 1.2]);
      pts.push(...loopFrom(lx, ly, loopR, aspect, dir, loopR * aspect * 1.2));
    }

    // Three knots per checkpoint, not two: swing wide, run through the
    // centre, then swing wide again on the *other* side. Stopping at the
    // centre left the road turning at the card, which is a corner; the
    // exit knot turns the visit into one continuous S through it, and
    // the alternating sides are what make the run of cards read as a
    // zig-zag rather than a weave.
    // How far sideways the swing may reach is set by how much vertical
    // room there is before the card, not by a fixed number. A wide swing
    // with little height between two cards is exactly what the spline
    // has to draw as a hairpin U-turn — the road doubling back beside a
    // card. Trading swing for gentleness where the cards are close makes
    // every leg a gradual diagonal instead, which is what a zig-zag
    // actually is. (`aspect` converts a width fraction to the vertical
    // scale so the two are comparable.)
    const room = Math.max(0.03, gap);
    const swing = Math.min(SWING, (room * 0.55) / aspect);
    const approachY = cy - room * 0.5;

    // The whole visit is one straight crossing.
    //
    // Approach, centre and exit used to be placed independently — swing
    // out to one side, drop to the centre, swing out again — and the
    // road then had to bend at the card itself to join them up. That
    // bend is a corner in the middle of the thing the road is supposed
    // to be visiting, and it is the one the eye lands on, because the
    // photograph draws it there. It measured 27 degrees and looked it.
    //
    // Aiming the crossing at where the road is going next instead puts
    // all three knots on one line through the centre, so the visit is
    // dead straight and every change of direction happens in the open
    // between cards, where there is room to make it gently.
    const nextPt = visited[i + 1];
    const toX = nextPt ? nextPt[0] : 1.15;
    const toY = nextPt ? nextPt[1] : cy + 0.18;
    let dirX = (toX - prev[0]) * w;
    let dirY = (toY - prev[1]) * h;
    const mag = Math.hypot(dirX, dirY) || 1;
    dirX /= mag;
    dirY /= mag;

    // How far the straight run extends either side of the centre, in
    // pixels: as much as the sideways swing allows, but never more than
    // the vertical room before the card, or the run overshoots into its
    // neighbour.
    const reach = Math.min(swing * w, room * 0.45 * h);
    const ax = cx - (dirX * reach) / w;
    const ay = cy - (dirY * reach) / h;
    const ex = cx + (dirX * reach * 0.7) / w;
    const ey = cy + (dirY * reach * 0.7) / h;

    // Only the ends may be nudged clear of copy; moving the centre would
    // stop the road visiting the photograph, which is the entire point.
    pts.push([nudge(obstacles, ax, ay, padX, padY), ay]);
    pts.push([cx, cy]);
    pts.push([nudge(obstacles, ex, ey, padX, padY), ey]);
  });

  // Past the last checkpoint the page still runs on for several
  // sections, so the road keeps going on the seeded walk rather than
  // stopping where the photographs do — which left the whole lower half
  // of the page with no ribbon at all.
  let [x, y] = pts[pts.length - 1];
  let heading = 0.2;
  while (y < 0.9) {
    // Gentler than the standalone walk's: out here the road is between
    // sections rather than visiting anything, and a hard turn every
    // couple of steps reads as jitter rather than as route.
    // Gentler again than it was. The perturbation is applied per step,
    // and a step is a fraction of the container — which used to be the
    // whole page and is now one section, so the same number turns the
    // road five times as often per pixel travelled. Left alone it put a
    // 70 degree V in the run below the last photograph.
    heading += (rand() - 0.5) * 0.5;
    heading -= (x - 0.5) * 0.5;
    heading = Math.max(-0.8, Math.min(0.8, heading));

    const step = 0.03 + rand() * 0.04;
    x += Math.sin(heading) * step * lean;
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
    // A loop needs a clear disc to turn in, or it wraps around a
    // heading — which is the one place a loop looks like a mistake
    // rather than a flourish.
    if (y < 0.82 && rand() > loopChance) {
      const dir: 1 | -1 = x > 0.5 ? -1 : 1;
      const lx = Math.min(0.82, Math.max(0.18, x));
      const clear = !legBlocked(
        obstacles,
        lx - loopR,
        y,
        lx + loopR,
        y + loopR * aspect * 1.2,
        padX,
        padY,
      );
      if (clear) {
        pts.push(...loopFrom(lx, y, loopR, aspect, dir, loopR * aspect * 1.2));
        x = lx;
        y += loopR * aspect * 1.2;
      }
    }
  }

  // Leaves past the right edge, so the tail is not seen to stop.
  pts.push([1.22, Math.min(0.995, y + 0.06)]);
  return pts;
}

/**
 * Waypoints scaled to pixels, de-duplicated, and corner-cut — the points
 * the spline is actually drawn through.
 *
 * Shared with the route scorer rather than duplicated there. Scoring a
 * route on the raw fraction-space waypoints was measuring angles in a
 * space where x and y have different scales, which made every turn
 * reading meaningless: the scorer happily chose routes with 58 degree
 * hairpins while reporting them as smooth.
 */
function controlNet(
  w: number,
  h: number,
  waypoints: readonly (readonly [number, number])[],
) {
  const scaled = waypoints.map(
    ([fx, fy]) => [fx * w, fy * h] as [number, number],
  );
  const pruned: [number, number][] = [scaled[0]];
  for (let i = 1; i < scaled.length; i++) {
    const last = pruned[pruned.length - 1];
    const far =
      Math.hypot(scaled[i][0] - last[0], scaled[i][1] - last[1]) >=
      MIN_KNOT_GAP;
    // The final knot is off-screen and defines where the road leaves, so
    // it is kept whether or not it clears the gap.
    if (far || i === scaled.length - 1) pruned.push(scaled[i]);
  }
  return chaikin(chaikin(chaikin(pruned)));
}

/**
 * Builds a smooth cubic path through every waypoint, using *centripetal*
 * Catmull-Rom (alpha = 0.5) rather than the uniform variant.
 *
 * Uniform Catmull-Rom assumes the waypoints are evenly spaced. This road
 * is anything but: an approach swing can be 400px long while two points
 * around a loop are 60px apart. Where spacing changes sharply the
 * uniform form overshoots, and the overshoot shows up as the cusp at the
 * top of a loop and the hard corner where the road rejoins itself — a
 * kink no vehicle could drive.
 *
 * Centripetal parameterisation weights each segment by the square root
 * of its length, which is provably free of cusps and self-intersections
 * within a segment, so the road stays drivable regardless of how
 * unevenly the route is sampled.
 */
/**
 * Minimum spacing between consecutive waypoints, in CSS pixels. Two
 * knots closer than this carry no useful shape information but do force
 * the curve through a very tight radius — which is where the hairpins
 * came from, not from the loops themselves.
 */
const MIN_KNOT_GAP = 34;

/**
 * One round of Chaikin corner-cutting: every interior corner is replaced
 * by the two points a quarter and three quarters along its edges.
 *
 * Run before the spline, this caps how sharply the route can turn no
 * matter what produced it — an edge bounce in the walk, two cards at
 * nearly the same height, a loop rejoining the road. Endpoints are kept
 * exactly, so the road still enters and leaves off-screen.
 */
function chaikin(pts: readonly (readonly [number, number])[]) {
  if (pts.length < 3) return pts.map((p) => [p[0], p[1]] as [number, number]);
  const out: [number, number][] = [[pts[0][0], pts[0][1]]];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);
    out.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
  }
  out.push([pts[pts.length - 1][0], pts[pts.length - 1][1]]);
  return out;
}

function buildPath(
  w: number,
  h: number,
  waypoints: readonly (readonly [number, number])[],
): string {
  // Scale, then drop knots that sit on top of each other, then round off
  // the corners twice. Only after that is the spline asked to draw
  // anything — smoothing the route is a property of the route, not
  // something the spline can be tuned into rescuing.
  const pts = controlNet(w, h, waypoints);
  const dist = (a: readonly number[], b: readonly number[]) =>
    Math.sqrt((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2) ** 0.5;

  let d = `M ${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;

    // Knot spacings. A zero (two coincident waypoints) would divide by
    // zero below, so it falls back to the uniform weight.
    const d1 = dist(p0, p1) || 1;
    const d2 = dist(p1, p2) || 1;
    const d3 = dist(p2, p3) || 1;

    const c1: [number, number] = [0, 0];
    const c2: [number, number] = [0, 0];
    for (let k = 0; k < 2; k++) {
      c1[k] =
        (d1 * d1 * p2[k] -
          d2 * d2 * p0[k] +
          (2 * d1 * d1 + 3 * d1 * d2 + d2 * d2) * p1[k]) /
        (3 * d1 * (d1 + d2));
      c2[k] =
        (d3 * d3 * p1[k] -
          d2 * d2 * p3[k] +
          (2 * d3 * d3 + 3 * d3 * d2 + d2 * d2) * p2[k]) /
        (3 * d3 * (d3 + d2));
    }
    d += ` C ${c1[0].toFixed(2)} ${c1[1].toFixed(2)}, ${c2[0].toFixed(2)} ${c2[1].toFixed(2)}, ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
  }
  return d;
}

/** Stroke width of the road surface itself, in CSS pixels. */
const ROAD_WIDTH = 22;

type Zone = {
  /** Band of the ribbon container this road occupies, as fractions. */
  top: number;
  bottom: number;
  mode: "zigzag" | "circles" | "drift";
  seed: number;
};

/**
 * One stretch of road.
 *
 * The ribbon used to be a single path spanning everything below the
 * hero, which meant it necessarily crossed every section between its
 * ends — including the two pinned ones, where a road running over a
 * horizontally-scrolling track or a 3D card stack has nothing to do with
 * what is happening on screen. Sections now opt in, and between them
 * there is simply no road: the truck drives out of one zone and turns up
 * again in a later one.
 *
 * Each zone is its own absolutely-positioned SVG over its own band, so
 * all the geometry below stays local to the stretch it draws and the
 * existing arc-length machinery needs no notion of zones at all. Only
 * one truck can be visible at a time because the zones do not overlap
 * vertically: every road is either finished (progress 1) or not started
 * (progress 0) except the one being driven.
 */
function RoadSegment({
  zone,
  w,
  h,
  top,
  checkpoints,
  obstacles,
  reduced,
}: {
  zone: Zone;
  w: number;
  h: number;
  top: number;
  checkpoints: readonly (readonly [number, number])[];
  obstacles: readonly Rect[];
  reduced: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const maskPathRef = useRef<SVGPathElement>(null);
  const glowPathRef = useRef<SVGPathElement>(null);
  const edgePathRef = useRef<SVGPathElement>(null);
  const truckRef = useRef<SVGGElement>(null);
  const maskId = `ribbon-reveal-${useId().replace(/:/g, "")}`;

  const waypoints = useMemo(() => {
    const aspect = h > 0 ? w / h : 1;
    const { padX, padY } = padFor(w, h);
    const best = (make: (s: number) => [number, number][]) => {
      let chosen: [number, number][] | null = null;
      let bestScore = Infinity;
      for (let i = 0; i < ATTEMPTS; i++) {
        const route = make(zone.seed + i * 1013);
        const sc = scoreRoute(w, h, route, obstacles, padX, padY);
        if (sc < bestScore) {
          bestScore = sc;
          chosen = route;
          if (sc === 0) break;
        }
      }
      return chosen!;
    };

    if (zone.mode === "zigzag" && checkpoints.length >= 2)
      return best((sd) =>
        buildCheckpointWaypoints(
          sd,
          w,
          h,
          checkpoints,
          obstacles,
          // No loops among the photographs. They never used to appear
          // here: the gap test is in fractions of the container, and
          // when the ribbon was one path down the whole page the gaps
          // between cards were far too small to qualify. Split into
          // zones, the same gaps are a third of a zone and every one
          // qualified — and a loop's join is where the road turns
          // sharpest, which is what put a 59 degree corner beside the
          // fourth card. The zig-zag through the work is meant to read
          // as a route between jobs; the circling belongs in the
          // stretches where there is nothing to visit.
          NO_LOOPS,
          padX,
          padY,
          (LEAN * h) / w,
        ),
      );
    // Away from the photographs there is nothing to visit, so the road
    // is free to be showy: `circles` loops readily, `drift` rarely.
    return best((sd) =>
      buildWaypoints(
        sd,
        obstacles,
        zone.mode === "circles" ? 0.45 : 0.9,
        aspect,
        padX,
        padY,
        (LEAN * h) / w,
      ),
    );
  }, [zone.seed, zone.mode, w, h, checkpoints, obstacles]);

  const d = useMemo(
    () => (w > 0 ? buildPath(w, h, waypoints) : ""),
    [w, h, waypoints],
  );
  useEffect(() => {
    const el = host.current;
    const path = pathRef.current;
    if (!el || !path || w === 0) return;

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
        p.style.strokeDashoffset = "0";
      });
      const end = path.getPointAtLength(length);
      truckRef.current?.setAttribute(
        "transform",
        `translate(${end.x} ${end.y})`,
      );
      return;
    }

    let raf = 0;

    // Where the truck actually is, chased toward where the scroll says
    // it should be.
    let at = -1;

    const tick = () => {
      const r = el.getBoundingClientRect();

      // Scroll mapped straight onto arc length.
      //
      // This used to solve for the arc length sitting level with the
      // middle of the screen, which kept the truck pinned there however
      // sideways the road ran. That pinning is exactly what made the
      // speed wrong: the truck's position along the road is then set by
      // how much road there is per pixel of *page*, and through a bend
      // or a loop that is enormous — hundreds of pixels of road for a
      // few pixels of scroll — so the truck bolted through every turn
      // and crawled down every straight. Capping the speed only clamped
      // the bolt; it could not make it even, because the underlying
      // mapping was uneven.
      //
      // Proportional mapping makes the truck's speed along the road
      // depend only on how fast the page is being scrolled, which is
      // what driving at a consistent speed means. It costs the exact
      // centring — on a sideways stretch the truck sits a little above
      // or below the middle — and that is a good trade: nobody notices
      // the truck being 80px high, everybody notices it teleporting
      // through a corner.
      //
      // The span is the zone's height plus a viewport, which is the
      // distance scrolled between the stretch first appearing at the
      // bottom of the screen and its end leaving the top.
      const span = r.height + window.innerHeight;
      const want = length * clamp01((window.innerHeight - r.top) / (span || 1));

      // Snap on the first frame so the road does not draw itself in from
      // zero on a page loaded part-way down.
      if (at < 0) {
        at = want;
      } else {
        // A light chase, only to take the jitter out of the wheel — not
        // a speed limit. The target now moves at a rate proportional to
        // the scroll, so there is nothing left to limit.
        at += (want - at) * 0.2;
      }
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
          "transform",
          `translate(${at.x} ${at.y}) rotate(${angle})`,
        );
        // Hide the truck until the line has actually started, otherwise
        // it sits parked at the top waiting to be noticed — and also
        // whenever it is outside the frame horizontally. The road enters
        // and leaves past the left and right edges, so being on the path
        // is not the same as being on screen: without the second test
        // the truck sat off-frame at full opacity for the whole entry
        // run, and any stray shadow of it showed at the margin.
        // Horizontally, because the road enters and leaves past the
        // left and right edges — being on the path is not the same as
        // being on screen. Vertically too, now that the truck is driven
        // by arc length rather than pinned to the viewport centre: it
        // can sit well above or below the middle on a sideways stretch,
        // and on a short zone that is enough to put it past an edge.
        const top = r.top + at.y;
        const onScreen =
          at.x > -20 &&
          at.x < w + 20 &&
          top > -40 &&
          top < window.innerHeight + 40;
        g.style.opacity =
          progress > 0.005 && progress < 0.999 && onScreen ? "1" : "0";
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
  }, [w, h, reduced, d]);

  return (
    <div
      ref={host}
      data-ribbon-road={zone.mode}
      className="pointer-events-none absolute right-0 left-0 overflow-hidden"
      style={{ top, height: h }}
    >
      {w > 0 && (
        <svg
          width={w}
          height={h}
          viewBox={`0 0 ${w} ${h}`}
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

          {/* Every layer of the road sits in one group at reduced
              opacity, and the truck is deliberately outside it. The road
              crosses body copy at some point on nearly every section, and
              at full strength the asphalt and its lane markings competed
              with the text on top of them. Dimming the group rather than
              each stroke keeps their relationship — surface, kerb, glow,
              markings — exactly as tuned, and dimming the road rather
              than everything leaves the truck, which is the thing worth
              looking at, at full strength. */}
          <g opacity={0.5}>
            {/* Soft glow under the road, so it sits in the page rather
              than on top of it. */}
            <path
              d={d}
              stroke="var(--color-ribbon-asphalt)"
              strokeWidth={ROAD_WIDTH + 16}
              strokeLinecap="round"
              fill="none"
              opacity={0.18}
              style={{ filter: "blur(18px)" }}
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
          </g>

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

/** Sections opt in by tagging themselves; anything untagged gets no road. */
const MODES: Record<string, Zone["mode"]> = {
  zigzag: "zigzag",
  circles: "circles",
  drift: "drift",
};

export function Ribbon({ seed = 918273 }: { seed?: number }) {
  const host = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const reduced = useReducedMotion();

  // Track the container's pixel size so the paths can be rebuilt on
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

  // Everything the roads are built from, measured together from the live
  // DOM: which sections want a road, where the photographs to visit are,
  // and what the road has to keep out of.
  const [layout, setLayout] = useState<{
    zones: Zone[];
    checkpoints: [number, number][];
    obstacles: Rect[];
  }>({ zones: [], checkpoints: [], obstacles: [] });

  useEffect(() => {
    const el = host.current;
    if (!el || size.w === 0) return;

    // The ribbon's own host is an empty overlay — the sections it has to
    // measure are its siblings, so the search is scoped to the wrapper
    // that holds both. Scoped rather than document-wide because the
    // About page mounts its own Ribbon, and a section from elsewhere in
    // the document would drag this road off the page.
    const scope: ParentNode = el.parentElement ?? document;

    const measure = () => {
      const box = el.getBoundingClientRect();
      const fy = (v: number) => (v - box.top) / box.height;
      const fx = (v: number) => (v - box.left) / box.width;

      const zones: Zone[] = [];
      scope
        .querySelectorAll<HTMLElement>("[data-ribbon-zone]")
        .forEach((node, i) => {
          const mode = MODES[node.dataset.ribbonZone ?? ""] ?? "drift";
          const r = node.getBoundingClientRect();
          zones.push({
            top: fy(r.top),
            bottom: fy(r.bottom),
            mode,
            // Each zone draws from its own stream, so they do not all
            // come out as the same shape at different sizes.
            seed: seed + i * 7717,
          });
        });

      const checkpoints: [number, number][] = [];
      scope
        .querySelectorAll<HTMLElement>("[data-ribbon-checkpoint]")
        .forEach((node) => {
          const r = node.getBoundingClientRect();
          checkpoints.push([
            fx(r.left + r.width / 2),
            fy(r.top + r.height / 2),
          ]);
        });
      checkpoints.sort((a, b) => a[1] - b[1]);

      // What the road routes around. Collected by selector rather than
      // by tagging every block of copy on the site: the point is that
      // the road adapts to whatever the page happens to say, and a
      // section added later should be respected without anyone having to
      // remember to mark it.
      const obstacles: Rect[] = [];
      scope
        .querySelectorAll<HTMLElement>(
          "h1, h2, h3, p, blockquote, [data-ribbon-avoid]",
        )
        .forEach((node) => {
          // Text inside a photograph is not an obstacle — the road is
          // meant to drive through those.
          if (node.closest("[data-ribbon-checkpoint]")) return;
          const r = node.getBoundingClientRect();
          // Skip anything too small to be worth a detour; a road that
          // gives way to every caption cannot go anywhere.
          if (r.width < 90 || r.height < 18) return;
          obstacles.push({
            x0: fx(r.left),
            y0: fy(r.top),
            x1: fx(r.right),
            y1: fy(r.bottom),
          });
        });

      setLayout({ zones, checkpoints, obstacles });
    };

    measure();
    // Fonts and lazy images land after first paint and move everything.
    const id = window.setTimeout(measure, 600);
    return () => window.clearTimeout(id);
  }, [size, seed]);

  return (
    <div
      ref={host}
      aria-hidden="true"
      // Extended upward past the section's own top edge: the road used
      // to begin level with the first service card, which read as it
      // starting halfway down the page. Reaching up into the dark space
      // under the pinned opening means it is already established by the
      // time the first heading arrives.
      className="pointer-events-none absolute -top-[38vh] right-0 bottom-0 left-0 -z-10"
    >
      {size.w > 0 &&
        layout.zones.map((zone, i) => {
          const top = zone.top * size.h;
          const height = (zone.bottom - zone.top) * size.h;
          if (height < 200) return null;
          // Re-expressed in the segment's own fraction space, so every
          // builder below works in one coordinate system.
          const local = (y: number) => (y * size.h - top) / height;
          return (
            <RoadSegment
              key={i}
              zone={zone}
              w={size.w}
              h={height}
              top={top}
              reduced={reduced}
              checkpoints={layout.checkpoints
                .filter((c) => c[1] >= zone.top && c[1] <= zone.bottom)
                .map((c) => [c[0], local(c[1])] as [number, number])}
              obstacles={layout.obstacles
                .filter((o) => o.y1 > zone.top && o.y0 < zone.bottom)
                .map((o) => ({
                  x0: o.x0,
                  x1: o.x1,
                  y0: local(o.y0),
                  y1: local(o.y1),
                }))}
            />
          );
        })}
    </div>
  );
}
