'use client';

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '@/lib/use-reduced-motion';

/**
 * A custom cursor built as a headlight, to match the night-road world
 * the rest of the site lives in.
 *
 * Three layers, deliberately moving at different rates:
 *
 *  - a small dot pinned exactly to the pointer, with no smoothing, so
 *    aiming at a link is no harder than with the native cursor. This is
 *    the part that makes hiding the system cursor acceptable at all.
 *  - a ring that trails behind on a lerp, which is what gives the
 *    movement weight.
 *  - a wide, very soft warm glow trailing further still — the headlight
 *    washing over a dark surface.
 *
 * Over anything clickable the ring swells and picks up the brand red, so
 * hit targets announce themselves before the click.
 *
 * Only ever active for a fine pointer (a real mouse or trackpad) and
 * only when the visitor has not asked for reduced motion. On touch, or
 * under that setting, the component renders nothing and the native
 * cursor is left completely alone — a lagging custom cursor is exactly
 * the kind of effect that setting exists to switch off.
 */

/** Fraction of the remaining distance closed per frame. */
const RING_EASE = 0.18;
const GLOW_EASE = 0.09;

export function Cursor() {
  const dot = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const glow = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;
    // `pointer: fine` is true for mouse and trackpad, false for touch.
    // Checked here rather than in CSS because the whole rAF loop and the
    // system-cursor override should not exist at all on a phone.
    if (!window.matchMedia('(pointer: fine)').matches) return;
    setActive(true);
    document.documentElement.classList.add('has-custom-cursor');

    // Start off-screen so nothing flashes at 0,0 before the first move.
    let px = -100;
    let py = -100;
    let rx = px;
    let ry = py;
    let gx = px;
    let gy = py;
    let raf = 0;

    const onMove = (e: PointerEvent) => {
      px = e.clientX;
      py = e.clientY;
    };

    const onOver = (e: PointerEvent) => {
      const el = e.target as Element | null;
      const hit = el?.closest?.('a, button, [role="button"], summary');
      ring.current?.classList.toggle('is-hot', Boolean(hit));
    };

    // Leaving the window should take the cursor with it, or it freezes
    // mid-page while the real pointer is somewhere else entirely.
    const onLeave = () => {
      dot.current?.style.setProperty('opacity', '0');
      ring.current?.style.setProperty('opacity', '0');
      glow.current?.style.setProperty('opacity', '0');
    };
    const onEnter = () => {
      dot.current?.style.removeProperty('opacity');
      ring.current?.style.removeProperty('opacity');
      glow.current?.style.removeProperty('opacity');
    };

    const onDown = () => ring.current?.classList.add('is-down');
    const onUp = () => ring.current?.classList.remove('is-down');

    const tick = () => {
      rx += (px - rx) * RING_EASE;
      ry += (py - ry) * RING_EASE;
      gx += (px - gx) * GLOW_EASE;
      gy += (py - gy) * GLOW_EASE;

      // translate3d keeps all three layers on the compositor; animating
      // left/top here would relayout the page every frame.
      if (dot.current)
        dot.current.style.transform = `translate3d(${px}px, ${py}px, 0)`;
      if (ring.current)
        ring.current.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
      if (glow.current)
        glow.current.style.transform = `translate3d(${gx}px, ${gy}px, 0)`;

      raf = requestAnimationFrame(tick);
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerover', onOver, { passive: true });
    window.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('pointerup', onUp, { passive: true });
    document.addEventListener('pointerleave', onLeave);
    document.addEventListener('pointerenter', onEnter);
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerover', onOver);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointerleave', onLeave);
      document.removeEventListener('pointerenter', onEnter);
      document.documentElement.classList.remove('has-custom-cursor');
    };
  }, [reduced]);

  if (!active) return null;

  return (
    <div aria-hidden="true" className="cursor-layer">
      <div ref={glow} className="cursor-glow" />
      <div ref={ring} className="cursor-ring" />
      <div ref={dot} className="cursor-dot" />
    </div>
  );
}
