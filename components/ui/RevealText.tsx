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
      gsap.from(words, {
        yPercent: 110,
        opacity: 0,
        duration: 0.9,
        ease: 'power3.out',
        stagger: 0.035,
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
            className="inline-block overflow-hidden align-bottom"
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
