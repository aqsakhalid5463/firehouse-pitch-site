'use client';

import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { loadLogo } from '@/lib/textures';
import {
  markReady,
  preloadProgress,
  setLifted,
  usePreloadStore,
} from '@/lib/preload-store';
import { TruckGlyph } from './TruckGlyph';

gsap.registerPlugin(ScrollTrigger);

/** Seams painted across the curtain, so it reads as the truck's roller
 *  door — the same gesture the cargo bay makes in the hero, which is why
 *  it is a door and not a fade. These are painted lines on one element,
 *  not separate panels: see the note on the curtain markup below. */
const SLATS = 5;

/** Digits on the odometer. Three gets us 000-100 with the leading zeros
 *  a real trip meter would show. */
const REELS = 3;

/** The counter is only worth showing if it is legible. On a warm cache
 *  every signal can resolve inside a couple of frames, which would flash
 *  a "97" for one frame and then a bare page. */
const MIN_VISIBLE_MS = 900;

/** WebGL can fail to acquire a context, and fonts.ready can hang behind
 *  a stalled stylesheet. Neither should be able to trap a visitor behind
 *  a curtain, so the loader always resolves. */
const SAFETY_MS = 6000;

/**
 * How long to wait for the scene's first rendered frame before going
 * without it.
 *
 * Measured on a production build: every signal was in by ~2s, but the
 * curtain did not lift for 6.4s. The scene's own initialisation runs
 * behind the curtain at ~14fps, and waiting on it for as long as it
 * likes is what made the loader feel stuck. Past this deadline the page
 * is handed over anyway — the canvas is a fixed background layer behind
 * the hero copy, so it arriving a beat late costs far less than seconds
 * of a frozen counter.
 */
const FRAME_DEADLINE_MS = 1600;

/**
 * Slowest the counter may move, in progress per second, while it still
 * has ground to cover. An exponential approach alone spends over a
 * second crawling the last few percent — mathematically still moving,
 * visually stopped.
 */
const MIN_RATE = 0.28;

/**
 * While a signal is genuinely outstanding the bar is allowed to creep
 * this far past what has actually completed, at CREEP_RATE per second.
 * It keeps the counter alive during a real wait without ever letting it
 * claim to be finished before it is.
 */
const CREEP_MAX = 0.14;
const CREEP_RATE = 0.05;

/**
 * Gap between handing the page over and letting the scene go back to
 * full quality. See the note where it is used.
 */
const UPGRADE_DELAY_MS = 400;

/**
 * How often the loader hands a new position to the browser, and how long
 * the browser is given to move there.
 *
 * The loader used to write a transform on every animation frame, which
 * means its motion is only as smooth as the main thread — and the main
 * thread during a page load is exactly where the work is. Even after
 * cutting the scene's cost there is ~1.1s of blocking left in a
 * production load, with single tasks over 400ms, and every millisecond
 * of that froze the truck and the digits solid.
 *
 * Instead, positions are committed occasionally and interpolated by a
 * CSS transition, which runs on the compositor. The transition window is
 * deliberately longer than the commit interval, so there is always
 * runway left: when a long task stops the commits, the browser is still
 * mid-transition and keeps moving without us.
 */
const COMMIT_MS = 120;
const TRANSITION_MS = 320;

/**
 * The transition itself, as a string, because the wrap handling below
 * has to put it back after switching it off for one frame. Restoring it
 * to `''` would clear the inline style outright and leave that digit
 * column with no transition for the rest of the load — which is exactly
 * what happened on the first wrap of the units wheel.
 */
const ROLL_TRANSITION = `transform ${TRANSITION_MS}ms linear`;

export function Preloader() {
  const root = useRef<HTMLDivElement>(null);
  const reelsRef = useRef<HTMLDivElement>(null);
  const truckRef = useRef<HTMLDivElement>(null);
  const roadRef = useRef<HTMLDivElement>(null);
  const tintRef = useRef<HTMLDivElement>(null);
  const [gone, setGone] = useState(false);

  // Collect the real signals.
  useEffect(() => {
    let cancelled = false;
    const ready = (s: Parameters<typeof markReady>[0]) => {
      if (!cancelled) markReady(s);
    };

    document.fonts.ready.then(() => ready('fonts'));
    // The same memoised promise lib/textures.ts awaits, so waiting here
    // genuinely front-loads the truck's livery rather than duplicating
    // the fetch.
    loadLogo().then(
      () => ready('logo'),
      () => ready('logo'),
    );

    // The scene gets a deadline of its own, well short of the blanket
    // safety net below.
    const frameDeadline = setTimeout(() => ready('frame'), FRAME_DEADLINE_MS);

    const safety = setTimeout(() => {
      ready('fonts');
      ready('logo');
      ready('frame');
    }, SAFETY_MS);

    return () => {
      cancelled = true;
      clearTimeout(frameDeadline);
      clearTimeout(safety);
    };
  }, []);

  // Hold the visitor at the top. A reload restores the previous scroll
  // position, which would otherwise put them mid-page the instant the
  // curtain lifts.
  //
  // Keyed on `gone` rather than mounting once: the component stays
  // mounted after it finishes (it just renders null), so an unmount
  // cleanup would never run and the page would stay unscrollable for
  // the rest of the session.
  useEffect(() => {
    const html = document.documentElement;
    if (gone) {
      // ScrollTrigger measured the page while the root was
      // overflow:hidden. Re-measure now that it can scroll, or the
      // pinned opening section starts out mis-measured.
      ScrollTrigger.refresh();
      return;
    }

    const previous = history.scrollRestoration;
    history.scrollRestoration = 'manual';
    html.classList.add('is-loading');
    window.scrollTo(0, 0);
    return () => {
      html.classList.remove('is-loading');
      history.scrollRestoration = previous;
    };
  }, [gone]);

  // Drive the odometer and lift the door.
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const started = performance.now();
    let shown = 0;
    let last = performance.now();
    let lastCommit = 0;
    // Last offset written to each digit column, so a wheel wrapping from
    // 10 back to 0 can be snapped instead of transitioned — a transition
    // would run the whole column backwards past every digit.
    const lastOffsets = new Array<number>(REELS).fill(0);
    let raf = 0;
    let exiting = false;

    // Handing the page over is deliberately split from the last frame of
    // the animation: hide, clear the promoted properties, then unmount
    // two frames later, so the compositor gets a clean frame to settle
    // on rather than losing the layer mid-update.
    const handOver = () => {
      const el = root.current;
      if (el) {
        el.style.visibility = 'hidden';
        gsap.set(el.querySelectorAll('[data-curtain]'), {
          clearProps: 'clipPath,transform,willChange',
        });
      }
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          setGone(true);
          // Tells the scene it is visible now, so it can go back to full
          // resolution and switch its postprocessing on — but not in the
          // same breath as the hand-over. Mounting the postprocessing
          // pipeline and doubling the render resolution is an ~800ms
          // task; doing it on the reveal frame simply moved the freeze
          // from behind the curtain to the moment the page appears. A
          // beat later, the visitor is looking at a page that is already
          // there, and the upgrade lands under a scroll rather than
          // under a curtain.
          // Belt and braces against the same artifact: ask the page
          // itself for a fresh paint once the curtain is gone. Reading a
          // layout property between the two writes is what forces them
          // to be two separate styles rather than one coalesced no-op.
          const html = document.documentElement;
          html.style.opacity = '0.999';
          void html.offsetHeight;
          html.style.opacity = '';

          setTimeout(setLifted, UPGRADE_DELAY_MS);
        }),
      );
    };

    const exit = () => {
      if (exiting) return;
      exiting = true;

      // The run used CSS transitions to stay smooth under load; the
      // drive-off is a GSAP tween on the same property, and leaving the
      // transition in place would make every frame of that tween chase a
      // 320ms interpolation of its own.
      if (truckRef.current) truckRef.current.style.transition = 'none';

      if (reduced) {
        gsap.to(root.current, { opacity: 0, duration: 0.3, onComplete: handOver });
        return;
      }

      gsap.context(() => {
        const tl = gsap.timeline({ onComplete: handOver });
        // The truck finishes its run off the right-hand edge before
        // anything else moves, so the door opens on an empty road
        // rather than closing over a truck still sitting on it.
        // Timings trimmed (the whole exit ran 1.7s): the counter is
        // pinned at 100 for the entire sequence, so every frame of it is
        // a frame the visitor spends looking at a finished loader. The
        // drive-off is also a transform now rather than `left`, for the
        // same reason as the run itself.
        const road = roadRef.current;
        tl.to('[data-truck]', {
          x: road ? road.clientWidth * 1.25 : 600,
          duration: 0.42,
          ease: 'power2.in',
        })
          .to(
            '[data-preload-copy]',
            {
              y: -18,
              opacity: 0,
              duration: 0.3,
              ease: 'power3.in',
              stagger: 0.04,
            },
            '-=0.22',
          )
          .to(
            '[data-curtain]',
            {
              // Clipping from the top edge downward: the door's visible
              // area shrinks upward, which is the same gesture the
              // stacked slats made when they translated off the top.
              clipPath: 'inset(100% 0 0 0)',
              duration: 0.62,
              ease: 'power4.inOut',
            },
            '-=0.16',
          );
      }, root);
    };

    const tick = (now: number) => {
      // Elapsed time, not frames. The old form advanced by a fixed
      // fraction per *frame*, so while the scene was initialising — and
      // frames were 70ms apart, with one gap of 890ms — the counter
      // barely moved, then lurched. Clamped, so one long stall cannot
      // turn into a jump either.
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      const target = preloadProgress(usePreloadStore.getState().done);
      // Ease toward the target instead of snapping (three signals
      // landing at once would jump 0 → 100 in a frame), but never slower
      // than MIN_RATE: an exponential approach on its own spends more
      // than a second crawling the last few percent, which reads as
      // stopped.
      const gap = target - shown;
      if (gap > 0) {
        const eased = gap * (1 - Math.exp(-dt * 6));
        shown = Math.min(target, shown + Math.max(eased, dt * MIN_RATE));
      } else if (target < 1) {
        // Nothing left to move toward, but something is still loading.
        // Creep, so the counter is alive rather than frozen on a number.
        shown = Math.min(shown + dt * CREEP_RATE, target + CREEP_MAX, 0.97);
      }
      if (target >= 1 && shown > 0.995) shown = 1;

      // Commit on a schedule rather than every frame; the CSS transition
      // set up on these elements covers the gaps.
      if (now - lastCommit < COMMIT_MS && shown !== 1) {
        raf = requestAnimationFrame(tick);
        return;
      }
      lastCommit = now;

      const value = shown * 100;

      // Odometer. Each reel carries 0-9 plus a repeated 0 to wrap
      // against, and rolls by the *fractional* place value the way a
      // real trip meter does — so the tens reel is already turning
      // while the units reel runs out its last digit, instead of every
      // wheel snapping at once.
      const reels = reelsRef.current;
      if (reels) {
        for (let i = 0; i < REELS; i++) {
          const place = value / 10 ** i;
          let offset: number;
          if (i === 0) {
            // The units wheel spins continuously, and blurs while the
            // number is climbing fast — which is what an odometer
            // actually does.
            offset = place % 10;
          } else {
            // Every higher wheel sits still and only turns through its
            // carry, in the last tenth of the wheel below it. Rolling
            // all three at once read as a slot machine, not a counter.
            const whole = Math.floor(place) % 10;
            const frac = place - Math.floor(place);
            offset = whole + (frac > 0.9 ? (frac - 0.9) / 0.1 : 0);
          }
          // The child is the clipping window; its own child is the
          // column of digits that actually rolls.
          const column = reels.children[REELS - 1 - i]
            ?.firstElementChild as HTMLElement | undefined;
          if (column) {
            const wrapped = offset < lastOffsets[i] - 0.001;
            if (wrapped) {
              // 10 and 0 are the same digit — the column carries a
              // repeated 0 to wrap against — so jumping between them is
              // invisible, while transitioning between them is not.
              column.style.transition = 'none';
            }
            column.style.transform = `translateY(${(-offset / 11) * 100}%)`;
            if (wrapped) {
              // Force the jump to be applied before the transition is
              // restored, or it is simply coalesced into the next one.
              void column.offsetHeight;
              column.style.transition = ROLL_TRANSITION;
            }
            lastOffsets[i] = offset;
          }
        }
      }

      // Travel is inset from both ends: at a literal 0% / 100% the
      // glyph is half-clipped by the road's own edges.
      //
      // Driven by transform rather than `left`. Animating `left` forces
      // layout and a repaint of the road on every single frame of the
      // loader — the one moment in the page's life when the main thread
      // is already saturated compiling shaders and building textures.
      // A transform is composited and costs the main thread nothing.
      if (truckRef.current && roadRef.current) {
        const travel = roadRef.current.clientWidth * 0.88 * shown;
        truckRef.current.style.transform = `translate3d(${travel.toFixed(1)}px, -50%, 0)`;
      }
      if (tintRef.current) tintRef.current.style.transform = `scaleX(${shown})`;

      if (shown === 1 && performance.now() - started >= MIN_VISIBLE_MS) {
        exit();
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    // Everything above runs on rAF, which browsers halt entirely in a
    // backgrounded tab — so a page opened in a background tab would sit
    // behind the curtain indefinitely, and the signal-level safety net
    // above cannot rescue it because the exit itself is rAF-driven.
    // This one is a plain timer, which does still fire, and removes the
    // curtain outright. In a visible tab the normal path always
    // finishes long before this, so it never fires.
    const hardStop = setTimeout(() => {
      setGone(true);
      setLifted();
    }, SAFETY_MS + 1200);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(hardStop);
    };
  }, []);

  if (gone) return null;

  return (
    <div
      ref={root}
      // Above the custom cursor layer (z-100) — nothing should draw over
      // the curtain while it is up.
      className="preloader fixed inset-0 z-[200]"
      role="status"
      aria-label="Loading"
    >
      {/* The curtain is server-rendered so the page never flashes
          behind it — which also means that without JS it would render
          and never lift. */}
      <noscript>
        <style>{'.preloader{display:none!important}'}</style>
      </noscript>

      {/* The door itself: ONE element, not a stack of slats.
          
          It used to be five full-screen absolutely-positioned divs, each
          promoted to its own compositor layer by the transform lifting
          it. Removing that many composited layers in a single frame is
          what left the page behind them rendered in horizontal bands of
          stale black — the artifact reported twice, and the reason the
          slat count was already cut from seven to five as a mitigation.
          It was never a real fix, because the cause is the number of
          layers being torn down at once, not how many there are.
          
          One layer cannot band against itself. The roller-door gesture
          is kept by animating this element's own `clip-path` upward
          instead of translating separate panels, and the seams between
          the slats are painted into it as a gradient, so it still reads
          as a segmented door. clip-path animates on the main thread
          rather than the compositor, which is affordable precisely
          because the exit now runs with no long tasks left (see the
          measurements on COMMIT_MS). */}
      <div aria-hidden="true" className="absolute inset-0">
        <div
          data-curtain
          className="absolute inset-0 bg-dark-bg"
          style={{
            clipPath: 'inset(0% 0 0 0)',
            backgroundImage: `repeating-linear-gradient(180deg, rgba(255,255,255,0.022) 0, rgba(255,255,255,0.022) 1px, transparent 1px, transparent calc(100% / ${SLATS}))`,
            backgroundSize: `100% 100%`,
          }}
        />
        {/* A single low glow behind the centre, so the panel is not a
            flat rectangle of pure black before anything moves. */}
        <div
          className="absolute top-1/2 left-1/2 h-[70vmin] w-[70vmin] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            background:
              'radial-gradient(circle, color-mix(in srgb, var(--color-fire) 7%, transparent) 0%, transparent 70%)',
          }}
        />
      </div>

      <div className="relative flex h-full w-full flex-col items-center justify-center gap-12 px-6">
        <div data-preload-copy className="flex flex-col items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/fire_house_logo.svg"
            alt="Firehouse Movers"
            className="h-16 w-16 sm:h-20 sm:w-20"
          />
          <span className="text-[0.65rem] tracking-[0.42em] opacity-45">
            LEWISVILLE, TEXAS
          </span>
        </div>

        {/* Odometer. Digits are laid out right-to-left in the DOM
            (hundreds first) and addressed in reverse by the tick above. */}
        <div
          data-preload-copy
          className="flex items-end gap-1"
          // The reels are decorative motion; the live number is not
          // useful to a screen reader, which already has "Loading".
          aria-hidden="true"
        >
          <div
            ref={reelsRef}
            className="flex text-[clamp(3.5rem,10vw,6.5rem)] leading-none font-semibold tracking-tighter tabular-nums"
            // Digits enter and leave into shadow, the way they do
            // rolling past the window of a real drum counter.
            style={{
              maskImage:
                'linear-gradient(180deg, transparent 0%, #000 22%, #000 78%, transparent 100%)',
            }}
          >
            {Array.from({ length: REELS }, (_, i) => (
              <span key={i} className="block h-[1em] overflow-hidden">
                {/* Linear, and longer than the commit interval: this is
                    what keeps the drum turning while the main thread is
                    busy. See COMMIT_MS. */}
                <span
                  className="block"
                  style={{
                    transition: ROLL_TRANSITION,
                    willChange: 'transform',
                  }}
                >
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((d, j) => (
                    <span key={j} className="block h-[1em]">
                      {d}
                    </span>
                  ))}
                </span>
              </span>
            ))}
          </div>
          <span className="pb-3 text-sm tracking-[0.3em] opacity-40">%</span>
        </div>

        {/* The road, seen from above — the same view the scroll ribbon
            takes, which is why the truck glyph is shared with it. */}
        <div
          ref={roadRef}
          data-preload-copy
          className="relative h-14 w-[min(440px,84vw)] overflow-hidden rounded-[3px] border-y border-ribbon-edge/25 bg-[#16161A]"
        >
          {/* Ground already covered, as a wash rather than a bar. */}
          <div
            ref={tintRef}
            className="absolute inset-0 origin-left bg-linear-to-r from-transparent to-fire/12"
            style={{
              transform: 'scaleX(0)',
              transition: ROLL_TRANSITION,
              willChange: 'transform',
            }}
          />
          {/* Centre line. Static, not scrolling: the camera is fixed on
              the road and the truck is what moves, so sliding the
              markings would read as the road itself travelling. */}
          <div
            className="absolute top-1/2 left-0 h-[2px] w-full -translate-y-1/2 opacity-30"
            style={{
              backgroundImage:
                'repeating-linear-gradient(90deg, var(--color-bone) 0 18px, transparent 18px 38px)',
            }}
          />
          <div
            data-truck
            ref={truckRef}
            // Round 21: centred on the road and enlarged. It used to sit
            // in the right-hand lane at 22x32, which is lane-accurate but
            // reads as a detail at this size — the truck is the one thing
            // in the curtain that says "movers", so it takes the middle of
            // the road and most of its height. The road grew to h-14 to
            // keep a margin above and below rather than the glyph running
            // edge to edge.
            className="absolute top-1/2 h-[34px] w-[50px] -translate-x-1/2"
            // `left` is the fixed start of the run; the travel along it
            // is a transform (see the tick above). `will-change` keeps
            // the glyph on its own compositor layer for the whole load
            // rather than being promoted and dropped repeatedly.
            style={{
              left: '6%',
              willChange: 'transform',
              transform: 'translate3d(0, -50%, 0)',
              transition: ROLL_TRANSITION,
            }}
          >
            <svg viewBox="0 0 32 22" className="h-full w-full overflow-visible">
              <TruckGlyph />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
