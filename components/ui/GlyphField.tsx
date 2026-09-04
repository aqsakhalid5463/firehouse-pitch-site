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

/* The physics of being shoved.
 *
 * A mark is a mass on a spring back to the cell it belongs in. The
 * cursor does two things to it: pushes it away, and — the part that
 * makes this feel like throwing rather than repelling — hands it a
 * share of the cursor's own velocity. Flicking through the field
 * therefore sprays marks in the direction of the flick, while resting
 * the cursor just parts them. */
const REACH = 110;
/** Straight shove away from the cursor. */
const SHOVE = 2.2;
/** Share of the cursor's velocity handed over. Above about 0.5 a fast
 *  flick launches marks clean off the canvas and the field visibly
 *  empties before they return. */
const THROW = 0.34;
/** Spring home, and velocity retained per frame. Loose and floaty —
 *  these drift back over about a second rather than snapping home on
 *  elastic — but not so loose that the hole a flick tears in the field
 *  is still sitting there when the visitor has moved on. */
const RETURN = 0.02;
const DRAG = 0.9;

type Mark = {
  /** The cell this mark belongs to. Membership of the field, and its
   *  fade, are decided from here rather than from where it currently
   *  is — a thrown mark must not blink out because it flew above the
   *  surface. */
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
          marks.push({
            homeX: x,
            homeY: y,
            x,
            y,
            vx: 0,
            vy: 0,
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
        // Membership and fade come from the home cell, so a thrown mark
        // keeps its identity wherever it happens to be.
        const surface = surfaceAt(m.homeX, t) * height;
        if (m.homeY < surface) continue;
        const depth = (m.homeY - surface) / feather;
        if (depth < 1 && m.rank > depth * depth) continue;

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

          m.vx += (m.homeX - m.x) * RETURN;
          m.vy += (m.homeY - m.y) * RETURN;
          m.vx *= DRAG;
          m.vy *= DRAG;
          m.x += m.vx;
          m.y += m.vy;
        }

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
