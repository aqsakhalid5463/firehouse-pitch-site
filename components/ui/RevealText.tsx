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
      // Hover swaps the whole heading for its ghost.
      //
      // Two tweens on two elements: the line moves as a body, the way a
      // printed word does, instead of forty characters each doing
      // something of their own. `power3.inOut` rather than a bounce or
      // an elastic — the gesture should feel weighted and deliberate,
      // which is most of what separates this from the version the client
      // called childish.
      const el = root.current!;
      const roll = el.querySelector<HTMLElement>('[data-roll]');
      const ghost = el.querySelector<HTMLElement>('[data-roll-ghost]');
      if (display && roll && ghost) {
        const swap = (over: boolean) => {
          gsap.to(roll, {
            y: over ? -10 : 0,
            opacity: over ? 0 : 1,
            duration: 0.42,
            ease: 'power3.inOut',
            overwrite: 'auto',
          });
          gsap.fromTo(
            ghost,
            { y: over ? 10 : 0 },
            {
              y: over ? 0 : 10,
              opacity: over ? 1 : 0,
              duration: 0.42,
              ease: 'power3.inOut',
              overwrite: 'auto',
            },
          );
        };
        const onEnter = (e: PointerEvent) => {
          if (e.pointerType !== 'mouse') return;
          swap(true);
        };
        const onLeaveHover = () => swap(false);

        el.addEventListener('pointerenter', onEnter);
        el.addEventListener('pointerleave', onLeaveHover);
        cleanups.push(() => {
          el.removeEventListener('pointerenter', onEnter);
          el.removeEventListener('pointerleave', onLeaveHover);
        });
      }

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

  // h1 and h2 are the display headings; h3 and p keep their own
  // typography, because the negative tracking and sub-1 leading of the
  // display style only work on short uppercase runs.
  const display = Tag === 'h1' || Tag === 'h2';

  return (
    // The visible text is now one span per character, which a screen
    // reader can announce letter by letter. `aria-label` restores the
    // heading as a single string and the split-up copy is hidden from
    // the accessibility tree.
    <Tag
      ref={root as never}
      className={`${display ? 'heading-display relative block ' : ''}${className}`}
      aria-label={children}
    >
      {/* On hover the heading swaps as one body: this copy lifts and
          fades while the ghost rises into its place. Moving the whole
          line rather than the characters individually is the difference
          between a piece of typography moving and a row of letters doing
          tricks.
          
          A cross-fade rather than a roll inside a mask, which is the
          more obvious way to do this: the mask needs `overflow: hidden`
          on the heading, and that clips the entrance — characters
          pivoting up from flat, and the scroll wave that lifts each word
          16px, both travel outside the text box by design. Measured, it
          cut the bottom off any heading that was still animating in. */}
      <span data-roll className="block will-change-transform">
      <span aria-hidden="true">
      {children.split(' ').flatMap((word, i, words) => {
        // The last word carries the accent colour. It is the word the
        // line lands on, so emphasis there reads as intent; picking one
        // at random would read as a bug.
        const accent = words.length > 2 && i === words.length - 1;
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
                  <span
                    data-char
                    data-accent={accent ? '1' : undefined}
                    className="inline-block"
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
      </span>

      {/* The ghost. Same text, same metrics, colours swapped — so what
          arrives is recognisably the same heading rather than a second
          one. Positioned exactly one height below, so a -100% roll lands
          it precisely where the original sat. It is inert: no data
          attributes, so neither the entrance nor the scroll effects
          touch it. */}
      {display && (
        <span
          data-roll-ghost
          aria-hidden="true"
          // Sitting exactly on top of the original rather than below it,
          // so the two are interchangeable and the swap has no travel to
          // resolve.
          className="pointer-events-none absolute inset-x-0 top-0 block opacity-0"
        >
          {children.split(' ').map((word, i, words) => {
            const accent = words.length > 2 && i === words.length - 1;
            return (
              <span
                key={`ghost-${i}`}
                // The padding and baseline alignment mirror the word
                // masks in the original exactly. Without them the ghost
                // sets on tighter leading than the copy it replaces, and
                // the whole heading visibly closes up on hover — the
                // client's "congested". A swap only reads as a swap if
                // both halves occupy identical space.
                className="inline-block pb-[0.12em] align-bottom"
                style={{
                  color: accent ? 'var(--page-ink)' : 'var(--color-fire)',
                }}
              >
                {word}
                {i < words.length - 1 ? '\u00A0' : ''}
              </span>
            );
          })}
        </span>
      )}
    </Tag>
  );
}
