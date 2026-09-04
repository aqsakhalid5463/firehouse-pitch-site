'use client';

import { useEffect, useRef } from 'react';
import { loadPortrait, sampleFigure, samplePortrait } from '@/lib/silhouettes';
import type { CrewFigure } from '@/lib/content';

/**
 * Particle budget.
 *
 * Fixed, and redistributed across whichever figure is showing, so the
 * cost of the section does not change with who is on screen — a count
 * that grew with the figure would make the heaviest silhouette the one
 * that also janks. The mobile figure is not a scaled-down desktop one:
 * a phone is doing this over a live WebGL background too.
 */
const COUNT_DESKTOP = 5200;
const COUNT_SMALL = 1800;

/**
 * Spring toward the target, and the velocity kept each frame.
 *
 * These two are one setting, not two: together they are the damping
 * ratio, and the figure is only legible if the cloud actually arrives.
 * At the first values I tried the system was underdamped enough to
 * still be oscillating around every target, which reads as a haze
 * rather than a silhouette — the edge of the figure is the whole point,
 * and an edge made of particles that are still moving is not an edge.
 * These land just under critical damping: a change of figure is a
 * visible flow, and about twenty frames later it is sharp.
 */
const PULL = 0.06;
const DRAG = 0.72;

/** Cursor repulsion: how far it reaches, and how hard it pushes. */
const PUSH_RADIUS = 110;
const PUSH_FORCE = 26;

/** Dot size in CSS pixels. Below 1 the field turns to mush on a
 *  non-retina screen; above 2 it stops reading as particles. */
const DOT = 1.6;

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /**
   * Where this particle sits in the target list, as a fraction.
   *
   * A fraction rather than an index, because the number of targets is
   * different for every figure. Indexing by `i % targets` looks right
   * and is not: with 5200 particles against 9001 targets it packs them
   * into targets 0-5199, and the list is in raster order — so the
   * bottom 42% of every figure had no particles in it at all, which is
   * exactly why the silhouette read as a blob. Kept across changes, so
   * a particle in the head stays in the head and the swap is one cloud
   * rearranging rather than two clouds trading places.
   */
  at: number;
  /** Per-particle drift, so a settled figure still breathes. */
  phase: number;
};

/**
 * A crowd of particles that resolves into a figure, scatters under the
 * cursor, and flows into the next figure when `figure` changes.
 *
 * Deliberately its own 2D canvas rather than geometry in the site's
 * persistent R3F scene. That scene is a fixed full-viewport background
 * with a perspective camera driven by the home page's set-piece;
 * pinning particles to a DOM element's box inside it means fighting
 * that camera every frame for no gain, because none of this needs 3D.
 * The cost of a second renderer is paid back by the canvas only
 * existing, and only drawing, while the section is on screen.
 */
export function ParticlePortrait({
  figure,
  photo,
  className,
}: {
  figure: CrewFigure;
  /** A real photograph of this person, sampled into the cloud. Where one
   *  exists it replaces the generated figure entirely; the figure stays
   *  as the fallback for a photograph that fails to load. */
  photo?: string;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Read inside the frame loop rather than closed over, so changing
  // figure does not tear down and rebuild the whole system — a change
  // of person must flow through the existing cloud, and reseeding it
  // would make every change a hard cut.
  const wanted = useRef({ figure, photo });
  useEffect(() => {
    wanted.current = { figure, photo };
  }, [figure, photo]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const small = window.matchMedia('(max-width: 767px)').matches;
    const count = small ? COUNT_SMALL : COUNT_DESKTOP;

    let width = 0;
    let height = 0;
    let particles: Particle[] = [];
    // Sampled point lists, one per figure, built on first use and kept.
    // Re-sampling on every change would mean a canvas allocation and a
    // getImageData — a synchronous readback — in the middle of a scroll.
    // Keyed by figure name or photo path, because both kinds of target
    // live in the same cloud.
    const cache = new Map<string, Float32Array>();
    // Photographs are decoded asynchronously, so a request can be in
    // flight while the previous person is still on screen. Tracked so a
    // fast scroll cannot queue the same load repeatedly.
    const loading = new Set<string>();
    let targets: Float32Array = new Float32Array(0);
    let showing: string | null = null;
    let pointerX = -9999;
    let pointerY = -9999;
    let raf = 0;
    let visible = true;

    const figureTargets = (which: CrewFigure) => {
      const hit = cache.get(which);
      if (hit) return hit;
      // Step chosen so a figure yields roughly the particle budget:
      // too fine and most points go unused, too coarse and particles
      // double up and the figure looks sparse.
      const step = Math.max(1, Math.round(Math.sqrt((width * height * 0.22) / count)));
      const made = sampleFigure(which, width, height, step);
      cache.set(which, made);
      return made;
    };

    /**
     * Targets for whoever is wanted, and whether they are ready.
     *
     * A photograph that has not decoded yet returns null rather than
     * falling back to the generated figure: showing a stand-in for a
     * frame and then swapping to the real portrait would read as the
     * cloud changing its mind. The previous person simply stays up
     * until the photograph is in.
     */
    const targetsFor = (which: { figure: CrewFigure; photo?: string }) => {
      if (!which.photo) return figureTargets(which.figure);
      const hit = cache.get(which.photo);
      if (hit) return hit;
      const src = which.photo;
      if (!loading.has(src)) {
        loading.add(src);
        loadPortrait(src)
          .then((img) => {
            cache.set(src, samplePortrait(img, width, height, count));
          })
          .catch(() => {
            // The photograph is unavailable; fall back to the drawn
            // figure so the section is never empty.
            cache.set(src, figureTargets(which.figure));
          })
          .finally(() => loading.delete(src));
      }
      return null;
    };

    const layout = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      width = Math.max(1, Math.round(rect.width));
      height = Math.max(1, Math.round(rect.height));
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Geometry changed, so every sampled figure is stale.
      cache.clear();
      showing = null;
    };

    const seed = () => {
      particles = Array.from({ length: count }, (_, i) => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: 0,
        vy: 0,
        at: i / count,
        phase: Math.random() * Math.PI * 2,
      }));
    };

    const onPointer = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointerX = event.clientX - rect.left;
      pointerY = event.clientY - rect.top;
    };
    const onLeave = () => {
      pointerX = -9999;
      pointerY = -9999;
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (!visible) return;

      const key = wanted.current.photo ?? wanted.current.figure;
      if (showing !== key) {
        const next = targetsFor(wanted.current);
        // Null means a photograph is still decoding. Hold the current
        // figure and try again next frame.
        if (next) {
          showing = key;
          targets = next;
        }
        if (next && next.length) {
          // Kick the cloud apart on a change, so the new figure is
          // arrived at rather than morphed into. Without this the swap
          // reads as the old figure sagging into the new one.
          for (const p of particles) {
            p.vx += (Math.random() - 0.5) * 14;
            p.vy += (Math.random() - 0.5) * 14;
          }
        }
      }

      const pairs = targets.length / 2;
      if (!pairs) return;

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = 'rgba(240,240,238,0.85)';

      const t = now / 1000;
      for (const p of particles) {
        const at = Math.min(pairs - 1, Math.floor(p.at * pairs)) * 2;
        // Breathing: a small circular wander around the target, unique
        // per particle, so a settled figure is never perfectly still.
        // Amplitude under the target spacing, or the wander smears the
        // edge it is supposed to be sitting on.
        const tx = targets[at] + Math.cos(t * 0.7 + p.phase) * 0.8;
        const ty = targets[at + 1] + Math.sin(t * 0.9 + p.phase) * 0.8;

        p.vx += (tx - p.x) * PULL;
        p.vy += (ty - p.y) * PULL;

        const dx = p.x - pointerX;
        const dy = p.y - pointerY;
        const distSq = dx * dx + dy * dy;
        if (distSq < PUSH_RADIUS * PUSH_RADIUS) {
          const dist = Math.sqrt(distSq) || 1;
          // Falls off toward the edge of the radius, so there is no ring
          // where the push switches off.
          const falloff = 1 - dist / PUSH_RADIUS;
          const force = (PUSH_FORCE * falloff * falloff) / dist;
          p.vx += dx * force;
          p.vy += dy * force;
        }

        p.vx *= DRAG;
        p.vy *= DRAG;
        p.x += p.vx;
        p.y += p.vy;

        ctx.fillRect(p.x, p.y, DOT, DOT);
      }
    };

    layout();
    seed();

    // Reduced motion gets the figure, held still, with no wander and no
    // repulsion: the shape is information, the movement is not.
    if (reduced) {
      let cancelled = false;
      const paintStill = () => {
        const still = targetsFor(wanted.current);
        if (cancelled) return;
        if (!still) {
          // Still decoding a photograph. Poll on a frame rather than
          // rendering the fallback and then replacing it.
          requestAnimationFrame(paintStill);
          return;
        }
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = 'rgba(240,240,238,0.85)';
        for (let i = 0; i < still.length; i += 2) {
          ctx.fillRect(still[i], still[i + 1], DOT, DOT);
        }
      };
      paintStill();
      return () => {
        cancelled = true;
      };
    }

    // Only draw while the section is actually on screen. Everything in
    // this file is cheap per particle and expensive per frame, and a
    // canvas that keeps running under three screens of other content is
    // the whole reason a second renderer is a fair thing to worry about.
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
      },
      { rootMargin: '200px' },
    );
    observer.observe(canvas);

    const onResize = () => {
      layout();
      seed();
    };
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
      data-particle-portrait
      className={className}
      // The names and roles beside this are real text; the portrait is
      // decoration.
      aria-hidden="true"
    />
  );
}
