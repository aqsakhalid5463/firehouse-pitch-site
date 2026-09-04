'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef } from 'react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { jumpToBottom, jumpToTop } from '@/lib/lenis-ref';
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

/**
 * Deadline for the door reporting itself shut, after which the
 * navigation happens anyway.
 *
 * A deadline, not a schedule. The swap used to be fired by a timer set
 * to the animation's nominal length, which is wrong for a reason that
 * only shows under load: the timer starts when the click is handled,
 * but the transition starts when React commits the phase change and the
 * browser takes the style. Measured on a busy page those were 600ms
 * apart — the timer said "covered" with the door still 185px short, the
 * route swapped 100ms later with a 42px strip of the new page showing,
 * and the door finished 180ms after that. The new page was visible
 * mid-navigation, which is the one thing this component exists to
 * prevent.
 *
 * So the door itself now says when it is shut, and this only catches
 * the case where that signal never arrives.
 */
const COVER_DEADLINE_MS = 2500;

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

/**
 * How long the door is held shut while a page entered at its bottom
 * finishes measuring itself. See settleAtBottom below — this is entirely
 * invisible, so it costs nothing but the wait.
 */
const BOTTOM_SETTLE_MS = 420;
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
 * The door is painted red, not black.
 *
 * The preloader's curtain is black because it is the first thing anyone
 * sees and it has to hand over to a dark page without a seam. This door
 * is the opposite situation: it arrives over a page already on screen
 * and its whole job is to be unmistakably an event. Black over a black
 * site reads as the page going out; the company's red reads as
 * something closing over it.
 *
 * It is a gradient rather than a flat fill because a single flat red at
 * this size is a wall of colour with no form — the darker top and
 * brighter leading edge give it the light a real shutter has, lit from
 * the opening it is closing over.
 */
const DOOR_PAINT =
  'linear-gradient(180deg, #6E1710 0%, #A82718 38%, #CE3421 72%, #E23D28 100%)';

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
  const watchers = useRef<(() => void)[]>([]);

  useEffect(() => {
    const pendingTimers = timers.current;
    const pendingWatchers = watchers.current;
    return () => {
      pendingTimers.forEach(clearTimeout);
      pendingWatchers.forEach((off) => off());
    };
  }, []);

  return useCallback(
    (
      href: string,
      label: string,
      /** Where the visitor is put down on the new page. `bottom` is for
       *  arriving by scrolling *up* out of the page below — dropping
       *  them at the top would undo the gesture they just made. */
      landAt: 'top' | 'bottom' = 'top',
    ) => {
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

      let swapped = false;
      const onCovered = () => {
        if (swapped) return;
        swapped = true;
        unwatch();

        // Under the cover, in this order: swap the route, put the page
        // back to the top, then let ScrollTrigger re-measure against the
        // new document. Doing any of it a frame earlier would be visible
        // as a jump.
        let opened = false;

        const raise = () => {
          after(SETTLE_MS, () => {
            setPhase('opening');
            after(OPEN_MS, () => setPhase('idle'));
          });
        };

        /**
         * Put the visitor at the far end of the new page and keep them
         * there while it finishes growing.
         *
         * One refresh-and-jump is not enough. The home page's height is
         * mostly pin spacers that ScrollTrigger creates from the
         * sections' own effects, which have not all run at the moment
         * the route commits — jumping once landed 29% down a page that
         * was still a third of its final height. So the jump is
         * re-asserted on every frame the height changes, behind the shut
         * door, until it stops moving or the deadline is up.
         */
        const settleAtBottom = () => {
          ScrollTrigger.refresh();
          jumpToBottom();
          let lastHeight = document.documentElement.scrollHeight;
          const from = performance.now();
          const step = () => {
            const height = document.documentElement.scrollHeight;
            if (height !== lastHeight) {
              lastHeight = height;
              jumpToBottom();
            }
            if (performance.now() - from < BOTTOM_SETTLE_MS) {
              requestAnimationFrame(step);
              return;
            }
            // A last refresh once the tree is done, so the new page's
            // own scroll-driven pieces are measured against the height
            // it actually ended up with, then one final jump against
            // that measurement.
            ScrollTrigger.refresh();
            jumpToBottom();
            raise();
          };
          requestAnimationFrame(step);
        };

        const open = () => {
          if (opened) return;
          opened = true;
          // Wrapped because nothing here is allowed to strand the
          // visitor. If the scroll reset or the re-measure throws on a
          // half-built tree, the door still has to come up — a page
          // that measures wrong is recoverable, a page sealed behind a
          // black rectangle is not.
          try {
            if (landAt === 'bottom') {
              settleAtBottom();
              return;
            }
            jumpToTop();
            ScrollTrigger.refresh();
          } catch {
            /* opening regardless */
          }
          raise();
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
      };

      // The door reports itself shut by moving to the covered phase,
      // which the overlay does on the transition actually ending.
      const unwatch = useTransitionStore.subscribe((state) => {
        if (state.phase === 'covered') onCovered();
      });
      watchers.current.push(unwatch);
      after(COVER_DEADLINE_MS, () => {
        if (!swapped) setPhase('covered');
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

      // Say when the door is actually shut, rather than letting anything
      // predict it from a duration. The route swap hangs off this.
      const onShut = (event: TransitionEvent) => {
        if (event.target !== el || event.propertyName !== 'transform') return;
        el.removeEventListener('transitionend', onShut);
        useTransitionStore.getState().setPhase('covered');
      };
      el.addEventListener('transitionend', onShut);
      return () => el.removeEventListener('transitionend', onShut);
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
        className="absolute inset-0"
        style={{
          transform: DOOR_AT[phase],
          willChange: 'transform',
          // Seams first, paint behind it. They are dark here rather than
          // light: on a black door a seam is a highlight, on a red one
          // it is a shadow between panels.
          backgroundImage: `repeating-linear-gradient(180deg, rgba(0,0,0,0.22) 0, rgba(0,0,0,0.22) 1px, transparent 1px, transparent calc(100% / ${SLATS})), ${DOOR_PAINT}`,
        }}
      >
        {/* The destination, stencilled on the panel. */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="text-[clamp(2.5rem,11vw,7rem)] leading-none font-thin tracking-[0.22em] uppercase"
            style={{
              color: 'transparent',
              // Heavier than it would need to be on black: the red is
              // bright enough that a hairline outline at low opacity
              // simply disappears into it.
              WebkitTextStroke: '1.5px rgba(255,255,255,0.6)',
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
            // White, not fire: the preloader's rail is red because it
            // travels over black. Red on red is invisible.
            background:
              'linear-gradient(90deg, transparent, rgba(255,240,232,0.95) 50%, transparent)',
            boxShadow: '0 0 22px 3px rgba(255,180,150,0.45)',
          }}
        />
      </div>

    </div>
  );
}
