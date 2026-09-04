'use client';

import { useEffect, useRef } from 'react';

/**
 * A rising tide of small marks under a wave-shaped surface, that you
 * can shove around.
 *
 * The gesture is borrowed from the reference the client sent: a dense
 * scatter of tiny shapes reading as a mass of *things* rather than as
 * texture, with an uneven top edge so the field looks poured in rather
 * than cropped. The shapes are the ones a moving company actually has —
 * cartons square-on and on-corner, discs, crossed straps — so the mass
 * says "everything you own, boxed" instead of being confetti.
 */

/**
 * Marks across the width.
 *
 * Density is set by column count rather than a raw total, so the field
 * looks the same on a phone and a 27" monitor instead of thinning out
 * on one of them. Everything about a mark's size derives from the cell
 * this gives it, so raising this is how the marks get smaller — there
 * is no separate size to keep in sync.
 */
const COLUMNS = 150;
const COLUMNS_SMALL = 74;

/** Mark size as a fraction of its cell. Small enough that the field
 *  reads as grain rather than as objects you could count. */
const SIZE_MIN = 0.16;
const SIZE_VAR = 0.16;

/** How far a mark is knocked off the centre of its cell. A jittered
 *  grid rather than pure random: uniform noise clumps, leaving bald
 *  patches that read as a mistake. */
const JITTER = 0.44;

/** Where the surface sits, as a fraction of the height, and how far the
 *  wave travels either side of it. */
const SURFACE = 0.3;
const WAVE = 0.08;

/** Depth over which marks fade and thin in below the surface, so the
 *  edge is a scatter rather than a cut. */
const FEATHER = 0.18;

const SWELL_SPEED = 0.00022;

/* The physics.
 *
 * These float. There is no home position and no spring back to one —
 * that is what made the first version feel sticky: every mark was on
 * elastic, so a shove produced a bulge that snapped flat the moment you
 * left, and the field read as a rubber sheet rather than as a mass of
 * loose objects. A mark here is a body drifting in a vacuum. It has a
 * velocity, it keeps it, and the only things that ever change it are
 * the cursor and the two soft boundaries.
 *
 * The one thing a pure drift cannot do is heal. A flick tears a hole
 * two hundred pixels wide, and marks moving at a tenth of a pixel a
 * frame take a minute to wander back into it — measured: one column
 * still at 15% of its neighbours' density after two and a half
 * seconds. So each mark keeps a leash to the cell it started in, with
 * a long slack radius inside which no force acts at all. Inside the
 * slack it is genuinely free, which is what "floating" has to mean;
 * outside it, something eventually brings it home. */

/** Speed each mark is born with, in pixels per frame, and the speed it
 *  never drops below. Slow — the field should look becalmed until
 *  something disturbs it — but never zero, or the drag below would
 *  bring the whole field to a stop within a couple of seconds and the
 *  floating would be a thing that happened once, on load. */
const FLOAT_SPEED = 0.13;

/** Velocity retained per frame, applied above the floor speed. A thrown
 *  mark loses its throw over about a second; the drift underneath it is
 *  untouched. */
const DRAG = 0.97;

/** How far a mark may wander from where it started before anything
 *  pulls on it, and how hard the pull is per pixel beyond that. Slack
 *  enough that ordinary drifting never feels it. */
const LEASH = 80;
const LEASH_PULL = 0.004;

/** Ceiling on speed, so no single flick can fire a mark across the
 *  canvas in a couple of frames and leave a streak. */
const MAX_SPEED = 5;

const REACH = 110;
/** Straight shove away from the cursor. */
const SHOVE = 1.6;
/** Share of the cursor's velocity handed over — the part that makes
 *  this a throw rather than a repulsion. */
const THROW = 0.3;

/**
 * How hard the surface and the floor push a mark back into the field,
 * per pixel it has strayed past them.
 *
 * Soft on purpose. A hard boundary reads as a wall, and these are meant
 * to be drifting in something, not bouncing off glass — a mark that
 * wanders up through the surface should slow, hang, and sink back.
 */
const CONTAIN = 0.008;

type Mark = {
  /** Where this mark started. Not its position and not its identity —
   *  only the far end of its leash. */
  homeX: number;
  homeY: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  kind: number;
  size: number;
  alpha: number;
  /** Stable threshold for thinning in through the feather band. Rolled
   *  once, not per frame: re-rolling it every frame made the surface
   *  fizz. */
  rank: number;
};

export function GlyphField({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let width = 0;
    let height = 0;
    let marks: Mark[] = [];
    let raf = 0;
    let visible = true;

    // Cursor, in canvas space, plus the velocity it arrived with.
    let px = -9999;
    let py = -9999;
    let pvx = 0;
    let pvy = 0;
    let lastMove = 0;

    /** Height of the surface at x. Two waves of different wavelengths,
     *  so the edge never repeats visibly across the width. */
    const surfaceAt = (x: number, t: number) =>
      SURFACE +
      Math.sin(x * 0.0055 + t) * WAVE +
      Math.sin(x * 0.0131 - t * 0.7) * WAVE * 0.45;

    const build = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      width = Math.max(1, Math.round(rect.width));
      height = Math.max(1, Math.round(rect.height));
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const columns = width < 768 ? COLUMNS_SMALL : COLUMNS;
      const cell = width / columns;
      const rows = Math.ceil(height / cell) + 1;
      marks = [];
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < columns; col++) {
          const x = (col + 0.5 + (Math.random() - 0.5) * JITTER * 2) * cell;
          const y = (row + 0.5 + (Math.random() - 0.5) * JITTER * 2) * cell;
          const heading = Math.random() * Math.PI * 2;
          const speed = FLOAT_SPEED * (0.4 + Math.random());
          marks.push({
            homeX: x,
            homeY: y,
            x,
            y,
            vx: Math.cos(heading) * speed,
            vy: Math.sin(heading) * speed,
            kind: Math.floor(Math.random() * 5),
            size: cell * (SIZE_MIN + Math.random() * SIZE_VAR),
            alpha: 0.25 + Math.random() * 0.55,
            rank: Math.random(),
          });
        }
      }
    };

    const shape = (m: Mark) => {
      const { x, y, size: s } = m;
      ctx.beginPath();
      if (m.kind === 0) {
        ctx.rect(x - s / 2, y - s / 2, s, s);
        ctx.fill();
      } else if (m.kind === 1) {
        ctx.arc(x, y, s * 0.45, 0, Math.PI * 2);
        ctx.fill();
      } else if (m.kind === 2) {
        ctx.lineWidth = Math.max(0.7, s * 0.18);
        ctx.moveTo(x - s / 2, y - s / 2);
        ctx.lineTo(x + s / 2, y + s / 2);
        ctx.moveTo(x + s / 2, y - s / 2);
        ctx.lineTo(x - s / 2, y + s / 2);
        ctx.stroke();
      } else if (m.kind === 3) {
        ctx.moveTo(x, y - s * 0.55);
        ctx.lineTo(x + s * 0.55, y);
        ctx.lineTo(x, y + s * 0.55);
        ctx.lineTo(x - s * 0.55, y);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.lineWidth = Math.max(0.7, s * 0.18);
        ctx.moveTo(x - s / 2, y);
        ctx.lineTo(x + s / 2, y);
        ctx.moveTo(x, y - s / 2);
        ctx.lineTo(x, y + s / 2);
        ctx.stroke();
      }
    };

    const paint = (t: number, simulate: boolean) => {
      ctx.clearRect(0, 0, width, height);
      ctx.strokeStyle = 'rgba(240,240,238,1)';
      ctx.fillStyle = 'rgba(240,240,238,1)';

      const feather = height * FEATHER;

      for (const m of marks) {
        if (simulate) {
          const dx = m.x - px;
          const dy = m.y - py;
          const distSq = dx * dx + dy * dy;
          if (distSq < REACH * REACH) {
            const dist = Math.sqrt(distSq) || 1;
            const falloff = 1 - dist / REACH;
            // Squared falloff, so there is no ring at the edge of the
            // reach where the push switches on.
            const weight = falloff * falloff;
            m.vx += (dx / dist) * SHOVE * weight;
            m.vy += (dy / dist) * SHOVE * weight;
            m.vx += pvx * THROW * weight;
            m.vy += pvy * THROW * weight;
          }

          // The leash. Nothing at all inside the slack radius.
          const hx = m.homeX - m.x;
          const hy = m.homeY - m.y;
          const strayed = Math.hypot(hx, hy);
          if (strayed > LEASH) {
            const pull = (strayed - LEASH) * LEASH_PULL;
            m.vx += (hx / strayed) * pull;
            m.vy += (hy / strayed) * pull;
          }

          // The surface is a soft ceiling and the bottom of the canvas
          // a soft floor.
          const above = surfaceAt(m.x, t) * height - m.y;
          if (above > 0) m.vy += Math.min(above, 80) * CONTAIN;
          const below = m.y - height;
          if (below > 0) m.vy -= Math.min(below, 80) * CONTAIN;

          m.vx *= DRAG;
          m.vy *= DRAG;
          const speed = Math.hypot(m.vx, m.vy) || 1;
          if (speed > MAX_SPEED) {
            m.vx = (m.vx / speed) * MAX_SPEED;
            m.vy = (m.vy / speed) * MAX_SPEED;
          } else if (speed < FLOAT_SPEED) {
            // Held at the floor speed rather than allowed to settle, so
            // the field keeps moving forever. Direction is whatever it
            // already had, so this is a floor on the drift and not a
            // force with an opinion.
            m.vx = (m.vx / speed) * FLOAT_SPEED;
            m.vy = (m.vy / speed) * FLOAT_SPEED;
          }
          m.x += m.vx;
          m.y += m.vy;

          // Sideways the field is unbounded and wraps, so marks blown
          // off one edge arrive at the other instead of piling up
          // against an invisible wall and thinning the far side out.
          if (m.x < -m.size) m.x = width + m.size;
          else if (m.x > width + m.size) m.x = -m.size;
        }

        // Fade and thinning come from where the mark actually is, so a
        // mark rising through the surface dims and drops out on its own
        // way up rather than at a boundary it carries with it.
        const depth = (m.y - surfaceAt(m.x, t) * height) / feather;
        if (depth <= 0) continue;
        if (depth < 1 && m.rank > depth * depth) continue;

        ctx.globalAlpha = m.alpha * Math.min(1, depth);
        shape(m);
      }
      ctx.globalAlpha = 1;
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (!visible) return;
      // The cursor's velocity is only good for the frame it was
      // measured on. Without this a mark that wanders into the reach
      // long after the cursor stopped is thrown by a stale flick.
      if (now - lastMove > 90) {
        pvx = 0;
        pvy = 0;
      }
      paint(now * SWELL_SPEED, true);
    };

    const onPointer = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      // Velocity from the step just taken, clamped: a pointer jumping
      // across the canvas (a tab switch, a window drag) would otherwise
      // deliver one enormous impulse.
      if (px > -9000) {
        pvx = Math.max(-60, Math.min(60, x - px));
        pvy = Math.max(-60, Math.min(60, y - py));
      }
      px = x;
      py = y;
      lastMove = performance.now();
    };
    const onLeave = () => {
      px = -9999;
      py = -9999;
      pvx = 0;
      pvy = 0;
    };

    build();

    if (reduced) {
      // The field is the point; the swell and the shoving are not.
      paint(0, false);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
      },
      { rootMargin: '200px' },
    );
    observer.observe(canvas);

    const onResize = () => build();
    window.addEventListener('resize', onResize);
    window.addEventListener('pointermove', onPointer, { passive: true });
    window.addEventListener('pointerleave', onLeave);
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      data-glyph-field
      className={className}
      aria-hidden="true"
    />
  );
}
