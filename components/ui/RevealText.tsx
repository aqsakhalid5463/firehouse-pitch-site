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
    const chars = root.current.querySelectorAll('[data-char]');
    const ctx = gsap.context(() => {
      // Characters flip up out of their word's mask, each one hinged on
      // its own baseline. Per-character rather than per-word, and a
      // rotation in depth rather than a slide, because the previous
      // word-level rise was the client's "boring and hard to notice":
      // at a 45px heading a word travelling its own height is a small
      // move that resolves in a few frames. A character pivoting up
      // from flat crosses far more of the frame for the same final
      // position, and the cascade across the line is what actually
      // reads as the heading being set rather than appearing.
      //
      // The hinge is the baseline (`transformOrigin` bottom), so the
      // letters swing up onto the line they will settle on instead of
      // pivoting about their middles and needing to correct downward.
      gsap.from(chars, {
        yPercent: 120,
        rotateX: -92,
        opacity: 0,
        duration: 1,
        ease: 'expo.out',
        transformOrigin: '50% 100%',
        // Tight enough that a long heading still resolves quickly — the
        // cascade should read as one gesture travelling along the line,
        // not as letters arriving one at a time.
        stagger: { each: 0.018, from: 'start', ease: 'power2.in' },
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
    // The visible text is now one span per character, which a screen
    // reader can announce letter by letter. `aria-label` restores the
    // heading as a single string and the split-up copy is hidden from
    // the accessibility tree.
    <Tag ref={root as never} className={className} aria-label={children}>
      <span aria-hidden="true">
      {children.split(' ').flatMap((word, i, words) => {
        const wrapped = (
          <span
            key={`word-${i}`}
            data-word-mask
            className="inline-block overflow-hidden pb-[0.12em] align-bottom"
          >
            <span data-word className="inline-block">
              {/* Each character gets its own perspective container.
                  Perspective only applies to an element's direct
                  children, and the word mask above cannot carry it —
                  `overflow: hidden` forces a flat transform style, so a
                  perspective set there would be discarded and the flip
                  would collapse into a plain vertical squash. */}
              {[...word].map((ch, ci) => (
                <span
                  key={`char-${ci}`}
                  className="inline-block"
                  style={{ perspective: '520px' }}
                >
                  <span data-char className="inline-block">
                    {ch}
                  </span>
                </span>
              ))}
            </span>
          </span>
        );
        // The trailing space must live outside the overflow-hidden wrapper,
        // or the browser collapses it and words run together.
        return i < words.length - 1 ? [wrapped, ' '] : [wrapped];
      })}
      </span>
    </Tag>
  );
}
