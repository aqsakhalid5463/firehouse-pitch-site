'use client';

import { useEffect, useRef } from 'react';
import { useReducedMotion } from '@/lib/use-reduced-motion';

/**
 * Tyre tracks left behind the cursor.
 *
 * The site's whole world is a truck on a road at night, so the pointer
 * behaves like one: it lays a twin tread behind it that fades out the
 * way tracks in dust do, smears on a hard turn, and kicks up a puff of
 * dust when you click.
 *
 * Two decisions worth recording, because both are the opposite of the
 * obvious thing:
 *
 *  - The marks are drawn *light*, on `screen` blending. Real tyre tracks
 *    are darker than the road, but this road is nearly black, so dark
 *    ink on it is invisible. What you actually see at night is the dust
 *    the tread throws up catching the headlight — which is light, warm,
 *    and reads correctly over both the dark hero and the lighter panels.
 *
 *  - The tread rungs come from a dash pattern whose offset is driven by
 *    total distance travelled, not by time or by segment index. Anchoring
 *    it to distance is what makes the rungs sit still on the page as the
 *    track is extended; anything else makes the ladder crawl along its
 *    own length, which instantly reads as a screensaver rather than a
 *    tyre.
 *
 * Cost is the reason for the rest of the shape. The backing store is
 * half resolution (the marks are soft, so nothing is lost), and the rAF
 * loop stops itself once the canvas has faded empty, so an idle pointer
 * on a page with a live WebGL scene behind it costs zero frames.
 *
 * Gated exactly like the cursor itself: fine pointer only, and nothing
 * at all under reduced motion.
 */

/** Backing-store scale. Soft marks survive this; it quarters fill cost. */
const RES = 0.5;
/** Half the distance between the two tracks, in CSS pixels. */
const GAUGE = 11;
/** Movement below this in a frame is jitter, not travel. */
const MIN_STEP = 0.7;
/** Speed, in px/frame, at which tread width and darkness top out. */
const FULL_SPEED = 22;
/** Alpha removed from the whole canvas each frame. */
const FADE = 0.045;
/** Frames the loop keeps running after the last mark, to fade it out. */
const FADE_FRAMES = 90;

type Puff = { x: number; y: number; vx: number; vy: number; r: number; life: number };

export function CursorTrail() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;
    // `pointer: fine` is a mouse or trackpad. On touch the element is
    // also hidden in CSS, so nothing here composites either.
    if (!window.matchMedia('(pointer: fine)').matches) return;

    const el = canvas.current;
    if (!el) return;

    const ctx = el.getContext('2d');
    if (!ctx) return;

    let w = 0;
    let h = 0;
    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      el.width = Math.max(1, Math.round(w * RES));
      el.height = Math.max(1, Math.round(h * RES));
      // One scale for the life of the context, so every coordinate below
      // is a plain CSS pixel and the resolution stays an implementation
      // detail of this function.
      ctx.setTransform(RES, 0, 0, RES, 0, 0);
      ctx.lineCap = 'butt';
    };
    resize();

    // Pointer position, last position a mark was drawn from, and the
    // unit direction of that last mark.
    let px = -200;
    let py = -200;
    let lx = px;
    let ly = py;
    let dirX = 0;
    let dirY = 0;
    let travelled = 0;
    let seeded = false;
    let alive = 0;
    let raf = 0;
    const puffs: Puff[] = [];

    const onMove = (e: PointerEvent) => {
      px = e.clientX;
      py = e.clientY;
      if (!seeded) {
        // First sighting of the pointer: adopt its position without
        // drawing, or a track is struck across the page from -200,-200.
        lx = px;
        ly = py;
        seeded = true;
      }
      wake();
    };

    const onDown = (e: PointerEvent) => {
      for (let i = 0; i < 12; i += 1) {
        const a = Math.random() * Math.PI * 2;
        const s = 0.8 + Math.random() * 3.2;
        puffs.push({
          x: e.clientX,
          y: e.clientY,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s,
          r: 2 + Math.random() * 4,
          life: 1,
        });
      }
      wake();
    };

    // Tracks laid before the pointer left are still fading, so the loop
    // is not stopped here — only the seed is dropped, so re-entering the
    // window somewhere else does not draw a line across to it.
    const onLeave = () => {
      seeded = false;
    };

    function wake() {
      alive = FADE_FRAMES;
      if (!raf) raf = requestAnimationFrame(tick);
    }

    function stroke(a: number, width: number, dashed: boolean) {
      ctx!.strokeStyle = `rgba(255, 233, 210, ${a})`;
      ctx!.lineWidth = width;
      if (dashed) {
        // Rungs anchored to distance travelled — see the note above.
        ctx!.setLineDash([4.5, 3.5]);
        ctx!.lineDashOffset = -travelled;
      } else {
        ctx!.setLineDash([]);
      }
      ctx!.stroke();
    }

    function tick() {
      // Fade the whole surface by removing alpha, rather than painting
      // black over it: the canvas is transparent and sits above the
      // page, so painting would leave a grey film across everything.
      ctx!.save();
      ctx!.setTransform(1, 0, 0, 1, 0, 0);
      ctx!.globalCompositeOperation = 'destination-out';
      ctx!.fillStyle = `rgba(0, 0, 0, ${FADE})`;
      ctx!.fillRect(0, 0, el!.width, el!.height);
      ctx!.restore();
      ctx!.globalCompositeOperation = 'source-over';

      const dx = px - lx;
      const dy = py - ly;
      const step = Math.hypot(dx, dy);

      if (seeded && step > MIN_STEP) {
        const nx = dx / step;
        const ny = dy / step;
        // 0 when carrying straight on, 2 when doubling back.
        const turn = dirX || dirY ? 1 - (nx * dirX + ny * dirY) : 0;
        const speed = Math.min(step / FULL_SPEED, 1);
        // A fast, sharp change of direction is a skid: the tread stops
        // printing and starts smearing.
        const skid = Math.min(turn * speed * 1.6, 1);

        travelled += step;

        const ox = -ny * GAUGE;
        const oy = nx * GAUGE;
        ctx!.beginPath();
        ctx!.moveTo(lx + ox, ly + oy);
        ctx!.lineTo(px + ox, py + oy);
        ctx!.moveTo(lx - ox, ly - oy);
        ctx!.lineTo(px - ox, py - oy);

        // Tread, then the skid smear over it as a wider solid pass.
        stroke(0.14 + speed * 0.2, 4 + speed * 3.5, true);
        if (skid > 0.05) stroke(0.2 * skid, 6 + skid * 5, false);

        lx = px;
        ly = py;
        dirX = nx;
        dirY = ny;
        alive = FADE_FRAMES;
      }

      for (let i = puffs.length - 1; i >= 0; i -= 1) {
        const p = puffs[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.9;
        p.vy *= 0.9;
        p.r += 0.55;
        p.life -= 0.035;
        if (p.life <= 0) {
          puffs.splice(i, 1);
          continue;
        }
        const g = ctx!.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        g.addColorStop(0, `rgba(255, 233, 210, ${0.16 * p.life})`);
        g.addColorStop(1, 'rgba(255, 233, 210, 0)');
        ctx!.fillStyle = g;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx!.fill();
        alive = FADE_FRAMES;
      }

      alive -= 1;
      if (alive <= 0) {
        // Nothing left to fade. Clear the last near-invisible residue and
        // give the frame budget back until the pointer moves again.
        ctx!.save();
        ctx!.setTransform(1, 0, 0, 1, 0, 0);
        ctx!.clearRect(0, 0, el!.width, el!.height);
        ctx!.restore();
        raf = 0;
        return;
      }
      raf = requestAnimationFrame(tick);
    }

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('resize', resize, { passive: true });
    document.addEventListener('pointerleave', onLeave);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('resize', resize);
      document.removeEventListener('pointerleave', onLeave);
    };
  }, [reduced]);

  // Always rendered, rather than gated on a state flag set after mount:
  // the element is identical on the server and the client, so there is
  // no hydration mismatch to work around, and an empty transparent
  // canvas that never starts its loop costs nothing.
  return <canvas ref={canvas} aria-hidden="true" className="cursor-trail" />;
}
