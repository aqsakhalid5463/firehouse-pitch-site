'use client';

import { useEffect, useRef, useState } from 'react';
import { transitionInFlight } from '@/lib/transition-store';
import { usePreloadStore } from '@/lib/preload-store';
import { useRouteTransition } from './RouteTransition';

/**
 * How much further the visitor has to push, past the end of the page,
 * before it hands them to the next one.
 *
 * This is the whole design of the thing. Too small and the page steals a
 * navigation from anyone who lands hard at the bottom — momentum
 * scrolling on a trackpad delivers a long tail of events after the
 * fingers have left the glass, so a low threshold fires on a flick the
 * visitor considers finished. Too large and nobody discovers it. 420px
 * is roughly half a viewport of deliberate additional scrolling: past
 * anything a momentum tail supplies on its own, well short of a chore.
 */
const PULL_PX = 420;

/**
 * A pause this long empties the meter.
 *
 * Without it the pull accumulates across the whole session: someone who
 * bumps the bottom five times over two minutes, reading the footer each
 * time, would be thrown to the next page on the fifth bump with no idea
 * why. The intent has to be one continuous push, not a running total.
 */
const IDLE_RESET_MS = 700;

/**
 * How long the page must have been sitting at the bottom before any of
 * it counts.
 *
 * The threshold alone is not enough of a guard. A hard flick on a
 * trackpad keeps delivering wheel events for a second or more after the
 * fingers have left the glass, and that tail is easily longer than
 * PULL_PX — so without a dwell the mechanic fires on a scroll the
 * visitor considered finished before they hit the bottom, which reads
 * as the site navigating on its own. Waiting for the page to settle
 * first means the pull has to come from a hand that is still moving.
 */
const SETTLE_MS = 400;

/** Below this the page is treated as scrolled to the end. Not zero:
 *  fractional device pixel ratios and Lenis's own sub-pixel position
 *  mean the arithmetic lands a hair short of the limit. */
const BOTTOM_SLOP_PX = 4;

/**
 * Hands the visitor to the next page when they keep scrolling past the
 * end of this one.
 *
 * Mounted per page with its own destination rather than living in the
 * layout, because "what comes next" is a property of the page you are
 * on, and the last page in the chain has no next.
 */
export function ScrollToNext({ href, label }: { href: string; label: string }) {
  const run = useRouteTransition();
  // Only the affordance re-renders on these; the accumulator itself is
  // a ref, because it changes on every wheel event and re-rendering a
  // React tree at that rate is exactly what the rest of this codebase
  // goes out of its way to avoid.
  const [pull, setPull] = useState(0);
  const [atEnd, setAtEnd] = useState(false);

  const pulled = useRef(0);
  const lastAt = useRef(0);
  const touchY = useRef(0);
  const fired = useRef(false);
  /** When the page first arrived at the bottom, for SETTLE_MS. */
  const restingSince = useRef(0);

  useEffect(() => {
    const atBottom = () =>
      window.scrollY + window.innerHeight >=
      document.documentElement.scrollHeight - BOTTOM_SLOP_PX;

    // Wheel deltas arrive in three different units depending on the
    // device and the OS. Treating a `lines` delta as pixels would make a
    // classic mouse wheel need dozens of clicks.
    const toPixels = (event: WheelEvent) =>
      event.deltaMode === 1
        ? event.deltaY * 16
        : event.deltaMode === 2
          ? event.deltaY * window.innerHeight
          : event.deltaY;

    const push = (delta: number) => {
      if (fired.current || transitionInFlight()) return;
      // Nothing counts while the curtain is up: the preloader holds the
      // page at the top, where scrollHeight is briefly small enough that
      // the document reads as already at its end.
      if (usePreloadStore.getState().curtain === 'up') return;

      if (!atBottom()) {
        if (pulled.current !== 0) {
          pulled.current = 0;
          setPull(0);
        }
        restingSince.current = 0;
        setAtEnd(false);
        return;
      }
      setAtEnd(true);

      const now = performance.now();
      if (!restingSince.current) restingSince.current = now;
      // Still inside the settle window: this is momentum from the scroll
      // that brought them here, not a fresh push.
      if (now - restingSince.current < SETTLE_MS) {
        lastAt.current = now;
        return;
      }
      // Scrolling back up, or stopping for a beat, abandons the attempt.
      if (delta <= 0 || now - lastAt.current > IDLE_RESET_MS) {
        pulled.current = 0;
      }
      lastAt.current = now;
      if (delta <= 0) {
        setPull(0);
        return;
      }

      pulled.current += delta;
      setPull(Math.min(1, pulled.current / PULL_PX));

      if (pulled.current >= PULL_PX) {
        fired.current = true;
        run(href, label);
      }
    };

    const onWheel = (event: WheelEvent) => push(toPixels(event));

    const onTouchStart = (event: TouchEvent) => {
      touchY.current = event.touches[0]?.clientY ?? 0;
    };
    const onTouchMove = (event: TouchEvent) => {
      const y = event.touches[0]?.clientY ?? 0;
      // Dragging the finger *up* scrolls the page down, so the sign
      // flips relative to the wheel.
      push(touchY.current - y);
      touchY.current = y;
    };

    // A plain scroll listener as well, so the affordance appears when
    // the visitor arrives at the bottom rather than only once they push
    // against it — an invitation nobody sees is not an invitation.
    const onScroll = () => {
      const end = atBottom();
      if (!end) restingSince.current = 0;
      setAtEnd(end);
    };

    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('scroll', onScroll);
    };
  }, [href, label, run]);

  return (
    <div
      data-scroll-to-next
      data-at-end={atEnd ? 'true' : 'false'}
      className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center"
      style={{
        opacity: atEnd ? 1 : 0,
        transition: 'opacity 320ms ease-out',
      }}
      // The mechanic is a shortcut, not the only way through: the nav
      // and footer both carry a real link to the same page, so this is
      // decoration to a screen reader.
      aria-hidden="true"
    >
      <div
        className="flex items-center gap-3 rounded-full border border-white/10 px-5 py-2.5 backdrop-blur-md"
        style={{ background: 'rgba(10,10,12,0.55)' }}
      >
        <span className="text-[0.65rem] tracking-[0.28em] uppercase opacity-60">
          Keep scrolling
        </span>
        <span className="relative block h-px w-16 overflow-hidden bg-white/15">
          <span
            className="absolute inset-0 origin-left"
            style={{
              background: 'var(--color-fire)',
              transform: `scaleX(${pull})`,
              // No transition: this tracks the wheel directly, and
              // smoothing it would make the meter lag behind the hand
              // that is filling it.
              willChange: 'transform',
            }}
          />
        </span>
        <span className="text-[0.65rem] font-semibold tracking-[0.28em] uppercase">
          {label}
        </span>
      </div>
    </div>
  );
}
