'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useReducedMotion } from '@/lib/use-reduced-motion';

gsap.registerPlugin(ScrollTrigger);

/**
 * Lifts its children into place as they enter view.
 *
 * The counterpart to RevealText: that one animates a heading word by
 * word, this one moves a whole block. Body copy, buttons, and list rows
 * were arriving with no transition at all, so headings animated into a
 * page whose supporting content had simply appeared — which drew
 * attention to the join.
 *
 * `stagger` walks direct children when there is more than one, so a row
 * of cards can be wrapped once instead of each child wrapped
 * individually.
 */
export function FadeUp({
  children,
  className = '',
  delay = 0,
  stagger = false,
  y = 26,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  stagger?: boolean;
  y?: number;
}) {
  const root = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced || !root.current) return;
    const el = root.current;
    const targets = stagger ? Array.from(el.children) : [el];
    if (targets.length === 0) return;

    const ctx = gsap.context(() => {
      gsap.from(targets, {
        y,
        opacity: 0,
        duration: 0.85,
        ease: 'power3.out',
        stagger: stagger ? 0.09 : 0,
        delay,
        scrollTrigger: { trigger: el, start: 'top 88%' },
      });
    }, root);
    return () => ctx.revert();
  }, [reduced, delay, stagger, y]);

  return (
    <div ref={root} className={className}>
      {children}
    </div>
  );
}
