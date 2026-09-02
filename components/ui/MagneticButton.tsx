'use client';

import { useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { audio } from '@/lib/audio';

/**
 * A button that leans toward the cursor as it approaches.
 *
 * The pull is capped well below the button's own radius so it never
 * detaches from where it appears to be — the point is that the control
 * feels weighted, not that it chases the pointer. Movement is written
 * straight to a transform rather than animated through state, since this
 * runs on every pointermove.
 *
 * Disabled entirely under prefers-reduced-motion: this is exactly the
 * kind of unrequested movement that setting exists to suppress.
 */
const PULL = 0.32;
const MAX = 12;

export function MagneticButton({
  href,
  children,
  variant = 'primary',
}: {
  href: string;
  children: React.ReactNode;
  variant?: 'primary' | 'ghost';
}) {
  const wrap = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();

  const move = (e: React.PointerEvent<HTMLSpanElement>) => {
    const el = wrap.current;
    if (reduced || !el) return;
    const r = el.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    const x = Math.max(-MAX, Math.min(MAX, dx * PULL));
    const y = Math.max(-MAX, Math.min(MAX, dy * PULL));
    el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  };

  const reset = () => {
    const el = wrap.current;
    if (!el) return;
    el.style.transform = 'translate3d(0, 0, 0)';
  };

  return (
    <span
      ref={wrap}
      onPointerMove={move}
      onPointerEnter={() => audio.tick()}
      onPointerLeave={reset}
      className="inline-block transition-transform duration-500 ease-out"
    >
      <Button href={href} variant={variant}>
        {children}
      </Button>
    </span>
  );
}
