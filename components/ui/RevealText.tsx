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

      // Then the heading stays alive for as long as it is on screen.
      // Each word drifts and tilts as the block crosses the viewport,
      // staggered so the movement travels along the line as a wave
      // instead of the whole row sliding as one rigid object.
      //
      // This is applied to the mask wrappers, not the words inside
      // them: the entrance above owns the inner transform, and the two
      // would fight over it. Moving the mask also means the drift can
      // never clip, since the word travels together with its window.
      //
      // Scrubbed rather than looped on a ticker. An idle tab costs
      // nothing, which matters on a page already running a WebGL scene,
      // and tying it to scroll keeps it feeling like a response to the
      // reader rather than decoration running on its own clock.
      const masks = root.current!.querySelectorAll('[data-word-mask]');
      gsap.to(masks, {
        // Vertical travel only. An earlier pass also tilted each word,
        // and that is what made a heading look broken rather than
        // alive: words at staggered *heights* read as a wave, but words
        // at staggered *angles* read as a typesetting mistake. With the
        // rotation gone the travel can be large enough to actually
        // notice.
        y: -16,
        rotate: 0,
        ease: 'none',
        stagger: { each: 0.05, from: 'start' },
        scrollTrigger: {
          trigger: root.current,
          start: 'top bottom',
          end: 'bottom top',
          // A little lag, so the wave keeps travelling for a moment
          // after the wheel stops instead of freezing dead.
          scrub: 0.6,
        },
      });

      // And the block itself leans into the scroll, then springs back.
      // Skew is driven by scroll *velocity* rather than position, so
      // the heading reacts to how hard the reader throws the page and
      // settles the moment they stop.
      //
      // Velocity-driven and self-cancelling is the point: the target is
      // always 0, so at rest every heading is guaranteed to sit
      // perfectly straight. That is what makes this safe to do at an
      // amplitude you can actually see, where the fixed per-word
      // rotation it replaced was not — a permanent tilt reads as a
      // typesetting bug, a transient lean reads as weight.
      const spring = { skew: 0 };
      const setSkew = gsap.quickSetter(root.current!, 'skewY', 'deg');
      const clampSkew = gsap.utils.clamp(-5, 5);
      ScrollTrigger.create({
        trigger: root.current,
        start: 'top bottom',
        end: 'bottom top',
        onUpdate: (self) => {
          const target = clampSkew(self.getVelocity() / -420);
          // Only ever take a *bigger* lean than the one already
          // decaying, so a fast flick is not immediately flattened by
          // the slower frames that follow it.
          if (Math.abs(target) <= Math.abs(spring.skew)) return;
          spring.skew = target;
          gsap.to(spring, {
            skew: 0,
            duration: 0.8,
            ease: 'power3.out',
            overwrite: true,
            onUpdate: () => setSkew(spring.skew),
          });
        },
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
            data-word-mask
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
