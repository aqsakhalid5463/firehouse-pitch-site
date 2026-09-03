'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { usePreloadStore } from '@/lib/preload-store';

gsap.registerPlugin(ScrollTrigger);

/**
 * Entrance styles. Every heading on the site used the same one, which
 * made a long page feel like one effect repeating rather than a sequence
 * of moments — the thing lusion.co gets right is that each section
 * arrives its own way.
 *
 * All of them are per-character and all of them resolve to the same
 * resting state, so they can be swapped per section without touching
 * layout, and the scroll-driven wave and velocity lean below apply
 * regardless of which one played.
 */
export type RevealVariant = 'flip' | 'rise' | 'fall' | 'wipe';

type Props = {
  children: string;
  as?: 'h1' | 'h2' | 'h3' | 'p';
  className?: string;
  delay?: number;
  variant?: RevealVariant;
};

export function RevealText({
  children,
  as: Tag = 'h2',
  className = '',
  delay = 0,
  variant = 'flip',
}: Props) {
  const root = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  // A heading that is on screen at load must wait for the curtain. Its
  // entrance used to run on mount, which is behind the preloader, so by
  // the time anyone could see the page the animation had already
  // finished and the hero arrived static. 'idle' means no preloader is
  // in play, so nothing is held back.
  const held = usePreloadStore((s) => s.curtain === 'up');

  useEffect(() => {
    if (reduced || !root.current) return;
    const chars = root.current.querySelectorAll('[data-char]');
    // Listeners added inside the context below; gsap.context only
    // reverts what it created, so these are torn down by hand.
    const cleanups: (() => void)[] = [];
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
      // Built as a paused timeline driven by explicit ScrollTrigger
      // callbacks rather than a one-shot `scrollTrigger` on the tween,
      // so it replays every time the heading comes back into view. A
      // once-per-load entrance meant scrolling up and back down showed
      // nothing, and a heading scrolled past quickly was simply missed
      // for the rest of the session.
      const tl = gsap.timeline({ paused: true });

      // `amount` rather than `each`, and capped: the cascade should read
      // as one gesture travelling along the line, and a per-character
      // interval means a long heading takes proportionally longer — the
      // 42-character hero headline spent 0.67s on the stagger alone, so
      // half of it was still missing a beat after landing. This spreads
      // the same gesture over a fixed window however long the line is.
      const spread = Math.min(0.42, chars.length * 0.016);

      const entrances: Record<RevealVariant, gsap.TweenVars> = {
        // Letters hinged on their baseline, swinging up from flat.
        flip: {
          yPercent: 120,
          rotateX: -92,
          opacity: 0,
          duration: 0.85,
          ease: 'expo.out',
          transformOrigin: '50% 100%',
          stagger: { amount: spread, from: 'start', ease: 'power2.in' },
        },
        // Straight up out of the mask, overlapping and quick — the
        // quietest of the four, for sections whose heading is not the
        // moment.
        rise: {
          yPercent: 110,
          opacity: 0,
          duration: 0.7,
          ease: 'power4.out',
          stagger: { amount: spread * 0.8, from: 'start' },
        },
        // Dropped in from above with a little scale, ordered from the
        // middle outward so the line assembles around its centre.
        fall: {
          yPercent: -110,
          scale: 1.3,
          opacity: 0,
          duration: 0.8,
          ease: 'back.out(1.4)',
          transformOrigin: '50% 50%',
          stagger: { amount: spread * 1.1, from: 'center' },
        },
        // A sideways wipe: letters slide in from the left, close
        // together, so the line reads as being swept on.
        wipe: {
          xPercent: -60,
          opacity: 0,
          duration: 0.62,
          ease: 'power3.out',
          stagger: { amount: spread * 0.9, from: 'start' },
        },
      };

      tl.from(chars, { ...entrances[variant], delay });

      const st = ScrollTrigger.create({
        trigger: root.current,
        // Starts earlier and ends later than the visible band: a fast
        // scroll should have the animation already running by the time
        // the heading is properly in frame, and should not reset it
        // until the heading is genuinely gone.
        start: 'top 92%',
        end: 'bottom 8%',
        // Both directions play, so coming back up a page is not a
        // silent stretch of already-resolved headings.
        // Scrolling is locked while the curtain is up, so an enter
        // callback can only mean the page is genuinely visible.
        onEnter: () => tl.restart(true),
        onEnterBack: () => tl.restart(true),
        // Reset only once the heading is off screen, so nobody ever
        // sees it snap back to its start state.
        onLeave: () => tl.pause(0),
        onLeaveBack: () => tl.pause(0),
      });

      // A heading already in view when this mounts (anything above the
      // fold) gets no enter callback, so set its state explicitly
      // instead of leaving it at whatever the markup rendered. While the
      // curtain is up it is parked at the start of the animation; this
      // effect re-runs when the curtain lifts and plays it then.
      if (st.isActive && !held) tl.restart(true);
      else tl.pause(0);

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
      // Paint that follows the pointer through the letters.
      //
      // Done per character rather than with a gradient clipped to the
      // text: `background-clip: text` paints one background in the
      // heading's own box, and every character here sits in its own
      // transformed layer for the entrance, so the clip and the
      // transforms fight. Colouring the characters directly is immune to
      // that, and it is the same set of nodes the entrance already uses.
      const el = root.current!;
      const PAINT_RADIUS = 130;
      let rects: { x: number; y: number }[] = [];
      let painting = 0;

      const measure = () => {
        rects = [...chars].map((c) => {
          const r = (c as HTMLElement).getBoundingClientRect();
          return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        });
      };

      const paint = (px: number, py: number) => {
        chars.forEach((c, i) => {
          const p = rects[i];
          if (!p) return;
          const d = Math.hypot(p.x - px, p.y - py);
          // A soft edge rather than a hard circle: characters at the rim
          // of the brush take a partial red, so the paint has a bleed
          // instead of a cut-out.
          const t = gsap.utils.clamp(0, 1, 1 - d / PAINT_RADIUS);
          (c as HTMLElement).style.color =
            t <= 0.01
              ? ''
              : `color-mix(in srgb, var(--color-fire) ${(t * 100).toFixed(0)}%, currentColor)`;
        });
      };

      const onMove = (e: PointerEvent) => {
        if (e.pointerType !== 'mouse') return;
        // Rects are measured on the frame the pointer arrives, not on
        // every move: the heading does not reflow while it is hovered,
        // and reading 40 bounding boxes per mousemove would.
        if (!painting) measure();
        painting = 1;
        paint(e.clientX, e.clientY);
      };
      const onLeave = () => {
        painting = 0;
        chars.forEach((c) => ((c as HTMLElement).style.color = ''));
      };

      el.addEventListener('pointermove', onMove);
      el.addEventListener('pointerleave', onLeave);
      cleanups.push(() => {
        el.removeEventListener('pointermove', onMove);
        el.removeEventListener('pointerleave', onLeave);
      });

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
    return () => {
      cleanups.forEach((fn) => fn());
      ctx.revert();
    };
  }, [reduced, delay, held, variant]);

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
                  {/* The colour transition is what turns a per-frame
                      colour assignment into paint that bleeds through
                      the letters rather than switching them on. */}
                  <span
                    data-char
                    className="inline-block transition-colors duration-300 ease-out"
                  >
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
