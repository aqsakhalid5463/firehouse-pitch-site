'use client';

import { useEffect, useRef } from 'react';

/**
 * A rising tide of small marks, filling the lower part of a section
 * under a wave-shaped surface.
 *
 * The gesture is borrowed from the reference the client sent: a dense
 * scatter of tiny shapes that reads as a mass of *things* rather than
 * as texture, with an uneven top edge so the field looks poured in
 * rather than cropped. The shapes here are the ones a moving company
 * actually has — cartons, discs, crossed straps — so the mass says
 * "everything you own, boxed" instead of being confetti.
 */

/** Marks across the widest part of the field. Density is set by column
 *  count rather than a raw total so the field looks the same on a phone
 *  and a 27" monitor instead of thinning out on one of them. */
const COLUMNS = 78;
/** Rows are derived from the columns' spacing, so cells stay square. */
const JITTER = 0.42;

/** Where the surface sits, as a fraction of the height, and how far the
 *  wave moves either side of it. */
const SURFACE = 0.34;
const WAVE = 0.075;

/** Marks in the top band are thinned and faded, so the surface is a
 *  scatter rather than a cut line. */
const FEATHER = 0.16;

const DRIFT_SPEED = 0.00022;

type Mark = {
  x: number;
  y: number;
  kind: number;
  size: number;
  phase: number;
  alpha: number;
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

    /** Height of the surface at x, as a fraction of the canvas. Two
     *  waves of different wavelengths, so the edge never repeats
     *  visibly across the width. */
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

      const cell = width / COLUMNS;
      const rows = Math.ceil(height / cell) + 1;
      marks = [];
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < COLUMNS; col++) {
          // Jittered grid rather than pure random: uniform noise
          // clumps, leaving bald patches that read as a mistake. A grid
          // with each mark knocked off its cell keeps the density even
          // while looking scattered.
          const x = (col + 0.5 + (Math.random() - 0.5) * JITTER * 2) * cell;
          const y = (row + 0.5 + (Math.random() - 0.5) * JITTER * 2) * cell;
          marks.push({
            x,
            y,
            kind: Math.floor(Math.random() * 5),
            size: cell * (0.2 + Math.random() * 0.22),
            phase: Math.random() * Math.PI * 2,
            alpha: 0.25 + Math.random() * 0.55,
          });
        }
      }
    };

    const paint = (t: number) => {
      ctx.clearRect(0, 0, width, height);
      ctx.strokeStyle = 'rgba(240,240,238,1)';
      ctx.fillStyle = 'rgba(240,240,238,1)';

      for (const m of marks) {
        const surface = surfaceAt(m.x, t) * height;
        if (m.y < surface) continue;
        // Fade in across the feather band below the surface.
        const depth = (m.y - surface) / (height * FEATHER);
        if (depth < 1 && Math.random() > depth * depth) {
          // Thinned as well as faded: a band that only dims still reads
          // as a hard edge because the count does not change.
          continue;
        }
        const fade = Math.min(1, depth);
        ctx.globalAlpha = m.alpha * fade;

        // A slow bob, phase-shifted per mark, so the mass breathes
        // without anything visibly travelling.
        const bob = Math.sin(t * 2.2 + m.phase) * m.size * 0.35;
        const x = m.x;
        const y = m.y + bob;
        const s = m.size;

        ctx.beginPath();
        if (m.kind === 0) {
          // Carton, seen square on.
          ctx.rect(x - s / 2, y - s / 2, s, s);
          ctx.fill();
        } else if (m.kind === 1) {
          ctx.arc(x, y, s * 0.45, 0, Math.PI * 2);
          ctx.fill();
        } else if (m.kind === 2) {
          // Crossed straps.
          ctx.lineWidth = Math.max(0.8, s * 0.16);
          ctx.moveTo(x - s / 2, y - s / 2);
          ctx.lineTo(x + s / 2, y + s / 2);
          ctx.moveTo(x + s / 2, y - s / 2);
          ctx.lineTo(x - s / 2, y + s / 2);
          ctx.stroke();
        } else if (m.kind === 3) {
          // Carton on its corner.
          ctx.moveTo(x, y - s * 0.55);
          ctx.lineTo(x + s * 0.55, y);
          ctx.lineTo(x, y + s * 0.55);
          ctx.lineTo(x - s * 0.55, y);
          ctx.closePath();
          ctx.fill();
        } else {
          ctx.lineWidth = Math.max(0.8, s * 0.16);
          ctx.moveTo(x - s / 2, y);
          ctx.lineTo(x + s / 2, y);
          ctx.moveTo(x, y - s / 2);
          ctx.lineTo(x, y + s / 2);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (!visible) return;
      paint(now * DRIFT_SPEED);
    };

    build();

    if (reduced) {
      // The field is the point; the swell is not. Painted once, at rest.
      paint(0);
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
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener('resize', onResize);
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
