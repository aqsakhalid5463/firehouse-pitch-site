'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useReducedMotion } from '@/lib/use-reduced-motion';

gsap.registerPlugin(ScrollTrigger);

type Props = {
  children: string;
  as?: 'h1' | 'h2' | 'h3' | 'p';
  className?: string;
  delay?: number;
};

export function RevealText({
  children,
  as: Tag = 'h2',
  className = '',
  delay = 0,
}: Props) {
  const root = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced || !root.current) return;
    const words = root.current.querySelectorAll('[data-word]');
    const ctx = gsap.context(() => {
      // Words rise out of their own overflow-hidden mask, so the motion
      // reads as type being set rather than a block sliding in. The
      // rotation and the slight horizontal offset are what stop it
      // looking mechanical: each word arrives on a marginally different
      // path, so a long heading does not resolve as one rigid row.
      //
      // `stagger.from: 'start'` with an ease means the first few words
      // land close together and the tail spreads out, which reads much
      // more like natural phrasing than an even cadence.
      gsap.from(words, {
        yPercent: 118,
        rotate: 4,
        x: -6,
        opacity: 0,
        duration: 1.05,
        ease: 'expo.out',
        stagger: { each: 0.045, from: 'start', ease: 'power2.in' },
        delay,
        scrollTrigger: { trigger: root.current, start: 'top 85%' },
      });
    }, root);
    return () => ctx.revert();
  }, [reduced, delay]);

  return (
    <Tag ref={root as never} className={className}>
      {children.split(' ').flatMap((word, i, words) => {
        const wrapped = (
          <span
            key={`word-${i}`}
            className="inline-block overflow-hidden pb-[0.12em] align-bottom"
          >
            <span data-word className="inline-block">
              {word}
            </span>
          </span>
        );
        // The trailing space must live outside the overflow-hidden wrapper,
        // or the browser collapses it and words run together.
        return i < words.length - 1 ? [wrapped, ' '] : [wrapped];
      })}
    </Tag>
  );
}
