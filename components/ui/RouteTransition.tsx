'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef } from 'react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { jumpToTop } from '@/lib/lenis-ref';
import {
  transitionInFlight,
  useTransitionStore,
  type TransitionPhase,
} from '@/lib/transition-store';
import { TruckGlyph } from './TruckGlyph';

/* Timings, in the order they fire.
 *
 * Every one of these is a CSS transition on `transform` or `opacity`,
 * for the same reason the preloader's exit is: those two properties are
 * the only ones the compositor can animate on its own. A route change is
 * the single worst moment on the page to depend on the main thread — it
 * is rendering a whole new tree, re-running ScrollTrigger and rebuilding
 * pins — so nothing here writes a property per frame. Handing the
 * browser one transform and letting go is what keeps the door moving
 * through that work. */

/** The truck's run for the edge. It starts the moment the link is
 *  clicked, so the click has an immediate consequence. */
const DRIVE_MS = 560;
/** The door waits a beat, so it is closing *behind* the truck rather
 *  than on top of it. */
const SHUTTER_DELAY_MS = 140;
const CLOSE_MS = 560;
/** Fully covered. Nothing may touch the page's visible state before
 *  this. */
const COVER_AT_MS = SHUTTER_DELAY_MS + CLOSE_MS;

/**
 * How long the new route is given to paint under the cover before the
 * door starts back up.
 *
 * The push is made inside a React transition and we wait on it, so this
 * is not the mechanism that waits for the page — it is the settle after
 * it: one beat for the scroll reset and ScrollTrigger's re-measure to
 * land, so the door does not open on a page that then jumps.
 */
const SETTLE_MS = 140;
const OPEN_MS = 680;

/**
 * Ceiling on how long the door may stay shut waiting for a route that
 * is not arriving.
 *
 * A slow network, a chunk that fails to load, an error boundary — none
 * of them should be able to leave a visitor sealed behind a black
 * rectangle. Past this the door opens regardless, which at worst shows a
 * page mid-load. That is strictly better than a page that never returns.
 */
const COVER_LIMIT_MS = 2400;

/** Seams painted across the door, matching the preloader's curtain so
 *  the two read as the same piece of hardware. */
const SLATS = 5;

/**
 * Runs the choreography. Exposed as a hook rather than a context because
 * the overlay lives in the root layout while the links that trigger it
 * live inside the page tree — there is no common provider between them
 * short of wrapping the whole app, and the store already carries the one
 * piece of state they share.
 */
export function useRouteTransition() {
  const router = useRouter();
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
    },
    [],
  );

  return useCallback(
    (href: string, label: string) => {
      const { setPhase, begin } = useTransitionStore.getState();
      const after = (ms: number, fn: () => void) => {
        timers.current.push(setTimeout(fn, ms));
      };

      // Reduced motion gets the navigation and none of the theatre. A
      // full-viewport panel sweeping over the page twice is exactly the
      // kind of motion the setting exists to suppress.
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        router.push(href);
        return;
      }

      begin(label);

      after(COVER_AT_MS, () => {
        setPhase('covered');

        // Under the cover, in this order: swap the route, put the page
        // back to the top, then let ScrollTrigger re-measure against the
        // new document. Doing any of it a frame earlier would be visible
        // as a jump.
        let opened = false;
        const open = () => {
          if (opened) return;
          opened = true;
          // Wrapped because nothing here is allowed to strand the
          // visitor. If the scroll reset or the re-measure throws on a
          // half-built tree, the door still has to come up — a page
          // that measures wrong is recoverable, a page sealed behind a
          // black rectangle is not.
          try {
            jumpToTop();
            ScrollTrigger.refresh();
          } catch {
            /* opening regardless */
          }
          after(SETTLE_MS, () => {
            setPhase('opening');
            after(OPEN_MS, () => setPhase('idle'));
          });
        };

        router.push(href);

        // `router.push` does not resolve, and a frame or two after the
        // call is not the same thing as the new route being on screen —
        // opening on a rAF pair lifted the door over a tree React had
        // not committed yet. The address bar is the one signal that
        // actually says the swap happened, so poll it on frames, with a
        // deadline behind it.
        const startedAt = performance.now();
        const settled = () => {
          if (
            window.location.pathname === href ||
            performance.now() - startedAt > COVER_LIMIT_MS
          ) {
            requestAnimationFrame(open);
            return;
          }
          requestAnimationFrame(settled);
        };
        requestAnimationFrame(settled);
        // And a plain timer behind the frame loop, because browsers halt
        // rAF outright in a backgrounded tab. Switching away mid-click
        // would otherwise leave the frame poll — deadline included —
        // frozen, and the door shut for the rest of the session. This is
        // the same failure the preloader guards against, for the same
        // reason.
        after(COVER_LIMIT_MS, open);
      });
    },
    [router],
  );
}

/**
 * A `<Link>` that closes the bay door on the way out.
 *
 * It stays a real anchor with a real `href`, so it is still a crawlable
 * link, still opens in a new tab on middle-click or ⌘-click, and still
 * navigates with JavaScript off — the handler only takes over the plain
 * left-click it is able to animate.
 */
export function TransitionLink({
  href,
  label,
  children,
  ...rest
}: {
  href: string;
  /** Stencilled on the door. Defaults to the link's own text where that
   *  is a plain string. */
  label?: string;
  children: React.ReactNode;
} & Omit<React.ComponentProps<typeof Link>, 'href' | 'onClick'>) {
  const run = useRouteTransition();

  return (
    <Link
      href={href}
      {...rest}
      onClick={(event) => {
        if (
          event.defaultPrevented ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          event.button !== 0
        ) {
          return;
        }
        // Already where we are going, or already going somewhere.
        if (window.location.pathname === href || transitionInFlight()) {
          event.preventDefault();
          return;
        }
        event.preventDefault();
        run(href, label ?? (typeof children === 'string' ? children : ''));
      }}
    >
      {children}
    </Link>
  );
}

/** Where the door sits, per phase. `closing` is the position it starts
 *  from, not the one it moves to — see the effect below. */
const DOOR_AT: Record<TransitionPhase, string> = {
  idle: 'translate3d(0, -100%, 0)',
  closing: 'translate3d(0, -100%, 0)',
  covered: 'translate3d(0, 0, 0)',
  opening: 'translate3d(0, -100%, 0)',
};

/**
 * The door itself. Mounted once in the root layout, above everything
 * including the cursor, and renders nothing at all when idle.
 */
export function RouteTransition() {
  const phase = useTransitionStore((s) => s.phase);
  const label = useTransitionStore((s) => s.label);
  const door = useRef<HTMLDivElement>(null);
  const truck = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = door.current;
    if (!el || phase === 'idle') return;

    if (phase === 'closing') {
      // Start from open, with no transition, and commit the closed
      // position in a later frame. Setting both in one frame is
      // coalesced into a single style and the door would simply appear
      // shut. Reading a layout property forces the first one to stick.
      el.style.transition = 'none';
      el.style.transform = DOOR_AT.closing;
      void el.offsetHeight;
      el.style.transition = `transform ${CLOSE_MS}ms cubic-bezier(0.76, 0, 0.24, 1) ${SHUTTER_DELAY_MS}ms`;
      el.style.transform = DOOR_AT.covered;

      // The truck runs out from under the closing door.
      const rig = truck.current;
      if (rig) {
        rig.style.transition = 'none';
        rig.style.transform = 'translate3d(-30vw, -50%, 0)';
        void rig.offsetHeight;
        rig.style.transition = `transform ${DRIVE_MS}ms cubic-bezier(0.4, 0, 0.7, 0.35)`;
        rig.style.transform = 'translate3d(115vw, -50%, 0)';
      }
      return;
    }

    if (phase === 'opening') {
      el.style.transition = `transform ${OPEN_MS}ms cubic-bezier(0.76, 0, 0.24, 1)`;
      el.style.transform = DOOR_AT.opening;
    }
  }, [phase]);

  if (phase === 'idle') return null;

  return (
    <div
      className="fixed inset-0 z-[150] overflow-hidden"
      // The door is decoration over a navigation that is happening
      // anyway; a screen reader should hear the new page, not this.
      aria-hidden="true"
      // Swallows clicks for the ~1.5s it is in play, so a second
      // navigation cannot be fired at a page that is mid-swap.
      style={{ pointerEvents: 'auto' }}
    >
      {/* The truck is a sibling of the door and painted beneath it:
          it runs across the live page and the door comes down over it,
          which is the order the gesture reads in. As a child of the
          panel it would ride up and down with it instead of driving. */}
      {phase === 'closing' && (
        <div
          ref={truck}
          data-route-truck
          className="absolute top-1/2 h-[44px] w-[64px]"
          style={{
            transform: 'translate3d(-30vw, -50%, 0)',
            willChange: 'transform',
          }}
        >
          <svg viewBox="0 0 32 22" className="h-full w-full overflow-visible">
            <TruckGlyph />
          </svg>
          <div
            className="pointer-events-none absolute top-1/2 left-full h-[60px] w-[170px] -translate-y-1/2"
            style={{
              clipPath: 'polygon(0 40%, 100% 0, 100% 100%, 0 60%)',
              background:
                'linear-gradient(90deg, rgba(255,226,182,0.55), rgba(255,226,182,0.06) 55%, transparent)',
              mixBlendMode: 'screen',
            }}
          />
        </div>
      )}
      <div
        ref={door}
        data-route-door
        data-phase={phase}
        className="absolute inset-0 bg-dark-bg"
        style={{
          transform: DOOR_AT[phase],
          willChange: 'transform',
          backgroundImage: `repeating-linear-gradient(180deg, rgba(255,255,255,0.022) 0, rgba(255,255,255,0.022) 1px, transparent 1px, transparent calc(100% / ${SLATS}))`,
        }}
      >
        {/* The destination, stencilled on the panel. */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="text-[clamp(2.5rem,11vw,7rem)] leading-none font-thin tracking-[0.22em] uppercase"
            style={{
              color: 'transparent',
              WebkitTextStroke: '1px rgba(255,255,255,0.28)',
            }}
          >
            {label}
          </span>
        </div>

        {/* The leading rail, lit — the same edge the preloader's curtain
            carries. It is at the bottom because this door travels down:
            the lit edge is the part the eye tracks, so it has to be the
            edge that is actually moving into the page. */}
        <div
          className="absolute bottom-0 left-0 h-px w-full"
          style={{
            background:
              'linear-gradient(90deg, transparent, color-mix(in srgb, var(--color-fire) 60%, white) 50%, transparent)',
            boxShadow:
              '0 0 18px 2px color-mix(in srgb, var(--color-fire) 30%, transparent)',
          }}
        />
      </div>

    </div>
  );
}
