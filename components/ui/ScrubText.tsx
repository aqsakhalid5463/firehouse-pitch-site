'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useReducedMotion } from '@/lib/use-reduced-motion';

gsap.registerPlugin(ScrollTrigger);

/**
 * A paragraph whose words brighten one by one as you scroll through it.
 *
 * Unlike RevealText and FadeUp, this is *scrubbed*: it is tied to scroll
 * position rather than fired once on entry, so the reader's own pace
 * drives it and scrolling back dims the words again. That makes it worth
 * using exactly once — on the statement the page most wants read — and
 * a poor choice everywhere else, because scrub-linked motion on every
 * block would make the page feel like it is fighting the scroll.
 *
 * Words start dim rather than invisible so the paragraph still occupies
 * its final layout immediately: nothing reflows, and a reader who lands
 * mid-section is not looking at a blank space.
 */
export function ScrubText({
  children,
  className = '',
}: {
  children: string;
  className?: string;
}) {
  const root = useRef<HTMLParagraphElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced || !root.current) return;
    const el = root.current;
    const words = el.querySelectorAll('[data-scrub-word]');

    const ctx = gsap.context(() => {
      gsap.to(words, {
        opacity: 1,
        ease: 'none',
        stagger: 0.4,
        scrollTrigger: {
          trigger: el,
          // Runs from the paragraph entering the lower half of the
          // screen until it has cleared the upper third, so it finishes
          // while still comfortably readable rather than at the moment
          // it leaves.
          start: 'top 78%',
          end: 'bottom 42%',
          scrub: 0.6,
        },
      });
    }, root);
    return () => ctx.revert();
  }, [reduced]);

  return (
    <p ref={root} className={className}>
      {children.split(' ').flatMap((word, i, all) => {
        const span = (
          <span
            key={`w-${i}`}
            data-scrub-word
            className="opacity-25"
          >
            {word}
          </span>
        );
        // The space sits outside the animated span, or the browser
        // collapses it and the words run together.
        return i < all.length - 1 ? [span, ' '] : [span];
      })}
    </p>
  );
}
