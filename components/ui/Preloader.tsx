"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { loadLogo } from "@/lib/textures";
import {
  markReady,
  preloadProgress,
  setCurtain,
  setLifted,
  usePreloadStore,
} from "@/lib/preload-store";
import { TruckGlyph } from "./TruckGlyph";

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
const TRANSITION_MS = 380;

/**
 * Each commit is aimed at where the loader expects to be one transition
 * from now, not at where it is.
 *
 * Committing the *current* value means the element is always chasing a
 * position it has already left, and — the part that actually shows — it
 * arrives at that position and stops. Any main-thread stall longer than
 * the transition window is therefore a visible freeze, and stalls of
 * 400ms+ are exactly what a page load has. Aiming one window ahead, at
 * the current rate, means a stalled commit loop leaves the element
 * already travelling at the right speed with a full window of runway:
 * the compositor keeps it moving without us for the whole gap.
 */
const LOOKAHEAD = TRANSITION_MS / 1000;

/* The exit, as CSS transition timings. Every one of these runs on the
 * compositor: nothing below writes a property per frame, so a long task
 * landing mid-exit cannot stutter it. This is the reason the exit is no
 * longer a GSAP timeline — a timeline is only as smooth as the main
 * thread, and clip-path could not be composited at all. */
const DRIVE_MS = 440;
const COPY_DELAY_MS = 90;
const COPY_MS = 260;
const SHUTTER_DELAY_MS = 400;
const SHUTTER_MS = 760;
/** Curtain released partway up the shutter's travel, so the hero's
 *  headline is already arriving as the door clears it. */
const REVEAL_AT_MS = SHUTTER_DELAY_MS + 300;
const HAND_OVER_AT_MS = SHUTTER_DELAY_MS + SHUTTER_MS + 60;

const ROLL_TRANSITION = `transform ${TRANSITION_MS}ms linear`;

export function Preloader() {
  const root = useRef<HTMLDivElement>(null);
  const reelsRef = useRef<HTMLDivElement>(null);
  const truckRef = useRef<HTMLDivElement>(null);
  const roadRef = useRef<HTMLDivElement>(null);
  const tintRef = useRef<HTMLDivElement>(null);
  const beamRef = useRef<HTMLDivElement>(null);
  const [gone, setGone] = useState(false);

  // Collect the real signals.
  useEffect(() => {
    // Tells above-the-fold entrance animations to hold: they would
    // otherwise play out behind the curtain and be over before the page
    // is visible.
    setCurtain("up");
    let cancelled = false;
    const ready = (s: Parameters<typeof markReady>[0]) => {
      if (!cancelled) markReady(s);
    };

    document.fonts.ready.then(() => ready("fonts"));
    // The same memoised promise lib/textures.ts awaits, so waiting here
    // genuinely front-loads the truck's livery rather than duplicating
    // the fetch.
    loadLogo().then(
      () => ready("logo"),
      () => ready("logo"),
    );

    // The scene gets a deadline of its own, well short of the blanket
    // safety net below.
    const frameDeadline = setTimeout(() => ready("frame"), FRAME_DEADLINE_MS);

    const safety = setTimeout(() => {
      ready("fonts");
      ready("logo");
      ready("frame");
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
    history.scrollRestoration = "manual";
    html.classList.add("is-loading");
    window.scrollTo(0, 0);
    return () => {
      html.classList.remove("is-loading");
      history.scrollRestoration = previous;
    };
  }, [gone]);

  // Drive the odometer and lift the door.
  useEffect(() => {
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const started = performance.now();
    let shown = 0;
    let last = performance.now();
    let lastCommit = 0;
    let lastShown = 0;
    // Last offset written to each digit column, so a wheel wrapping from
    // 10 back to 0 can be snapped instead of transitioned — a transition
    // would run the whole column backwards past every digit.
    const lastOffsets = new Array<number>(REELS).fill(0);
    let raf = 0;
    let exiting = false;
    // Every stage of the exit is a timer rather than a timeline, so they
    // all have to be cancellable if the component goes away mid-exit.
    const timers: ReturnType<typeof setTimeout>[] = [];

    // Handing the page over is deliberately split from the last frame of
    // the animation: hide, clear the promoted properties, then unmount
    // two frames later, so the compositor gets a clean frame to settle
    // on rather than losing the layer mid-update.
    const handOver = () => {
      const el = root.current;
      if (el) {
        el.style.visibility = "hidden";
        gsap.set(el.querySelectorAll("[data-curtain]"), {
          clearProps: "transform,willChange",
        });
      }
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          setGone(true);
          // Released in the same frame the page becomes visible, so the
          // hero's entrance starts exactly as the visitor first sees it.
          setCurtain("gone");
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
          html.style.opacity = "0.999";
          void html.offsetHeight;
          html.style.opacity = "";

          setTimeout(setLifted, UPGRADE_DELAY_MS);
        }),
      );
    };

    const exit = () => {
      if (exiting) return;
      exiting = true;

      const el = root.current;
      if (!el) return;

      // The run drove the truck with a short CSS transition; the exit
      // needs a much longer one on the same property, so the old timing
      // is replaced rather than left to fight it.
      const truck = truckRef.current;
      const road = roadRef.current;
      const shutter = el.querySelector<HTMLElement>("[data-curtain]");
      const copy = el.querySelectorAll<HTMLElement>("[data-preload-copy]");

      if (reduced) {
        el.style.transition = "opacity 300ms linear";
        el.style.opacity = "0";
        timers.push(setTimeout(handOver, 320));
        return;
      }

      // 1. The truck drives off the right-hand edge, headlights coming
      //    up to full as it goes, so the door opens on an empty road
      //    rather than closing over a truck still sitting on it.
      if (truck) {
        truck.style.transition = `transform ${DRIVE_MS}ms cubic-bezier(0.45, 0, 0.85, 0.4)`;
        truck.style.transform = `translate3d(${
          road ? road.clientWidth * 1.35 : 700
        }px, -50%, 0)`;
      }
      if (beamRef.current) {
        beamRef.current.style.transition = `opacity ${DRIVE_MS}ms ease-out`;
        beamRef.current.style.opacity = "1";
      }

      // 2. The copy lifts away underneath it.
      copy.forEach((node, i) => {
        const delay = COPY_DELAY_MS + i * 40;
        node.style.transition = `opacity ${COPY_MS}ms ease-in ${delay}ms, transform ${COPY_MS}ms ease-in ${delay}ms`;
        node.style.opacity = "0";
        node.style.transform = "translate3d(0, -20px, 0)";
      });

      // 3. The shutter rolls up and takes the whole loader with it.
      //    One transform on one composited layer — see the markup note.
      timers.push(
        setTimeout(() => {
          if (!shutter) return;
          shutter.style.transition = `transform ${SHUTTER_MS}ms cubic-bezier(0.76, 0, 0.24, 1)`;
          shutter.style.transform = "translate3d(0, -100%, 0)";
        }, SHUTTER_DELAY_MS),
      );

      timers.push(setTimeout(() => setCurtain("gone"), REVEAL_AT_MS));
      timers.push(setTimeout(handOver, HAND_OVER_AT_MS));
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
      // Rate over the interval just closed, used to aim this commit one
      // transition window into the future. See LOOKAHEAD.
      const span = (now - lastCommit) / 1000;
      const rate = span > 0 ? (shown - lastShown) / span : 0;
      lastCommit = now;
      lastShown = shown;
      // Never past 1: overshooting the end would drive the truck off the
      // road and wind the counter past 100 before the exit takes over.
      const aimed = Math.min(1, shown + Math.max(0, rate) * LOOKAHEAD);

      const value = aimed * 100;

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
          const column = reels.children[REELS - 1 - i]?.firstElementChild as
            HTMLElement | undefined;
          if (column) {
            const wrapped = offset < lastOffsets[i] - 0.001;
            if (wrapped) {
              // 10 and 0 are the same digit — the column carries a
              // repeated 0 to wrap against — so jumping between them is
              // invisible, while transitioning between them is not.
              column.style.transition = "none";
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
        const travel = roadRef.current.clientWidth * 0.88 * aimed;
        truckRef.current.style.transform = `translate3d(${travel.toFixed(1)}px, -50%, 0)`;
      }
      if (tintRef.current) tintRef.current.style.transform = `scaleX(${aimed})`;
      // Headlights warm up as the run goes on, rather than being on full
      // from a standing start.
      if (beamRef.current)
        beamRef.current.style.opacity = (0.25 + aimed * 0.6).toFixed(3);

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
      setCurtain("gone");
      setLifted();
    }, SAFETY_MS + 1200);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(hardStop);
      timers.forEach(clearTimeout);
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
        <style>{".preloader{display:none!important}"}</style>
      </noscript>

      {/* The door itself: ONE element, not a stack of slats, and it is
          the parent of the entire loader rather than a backdrop behind
          it.

          It used to be five full-screen absolutely-positioned divs, each
          promoted to its own compositor layer by the transform lifting
          it. Removing that many composited layers in a single frame is
          what left the page behind them rendered in horizontal bands of
          stale black — the artifact reported twice, and the reason the
          slat count was already cut from seven to five as a mitigation.
          It was never a real fix, because the cause is the number of
          layers being torn down at once, not how many there are. One
          layer cannot band against itself.

          That single layer used to open by animating its own `clip-path`
          upward, which keeps the gesture but is not a compositable
          property: every frame of the opening was main-thread work, at
          the one moment in the page's life when the main thread is
          busiest. It now genuinely travels — `translate3d` up and off —
          which is both the real roller-door movement and a transform the
          compositor can run on its own. Because it is the parent, the
          logo, counter and road ride up with it, so nothing can be left
          behind on the page.

          The seams between the slats stay painted in as a gradient, so
          it still reads as a segmented door rather than a black sheet. */}
      <div
        data-curtain
        aria-hidden="true"
        className="absolute inset-0 bg-dark-bg"
        style={{
          transform: "translate3d(0, 0, 0)",
          willChange: "transform",
          backgroundImage: `repeating-linear-gradient(180deg, rgba(255,255,255,0.022) 0, rgba(255,255,255,0.022) 1px, transparent 1px, transparent calc(100% / ${SLATS}))`,
          backgroundSize: `100% 100%`,
        }}
      >
        {/* A single low glow behind the centre, so the panel is not a
            flat rectangle of pure black before anything moves. */}
        <div
          className="absolute top-1/2 left-1/2 h-[70vmin] w-[70vmin] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            background:
              "radial-gradient(circle, color-mix(in srgb, var(--color-fire) 7%, transparent) 0%, transparent 70%)",
          }}
        />

        {/* The door's leading rail, lit. Without an edge the shutter
            reads as the page fading rather than as something moving:
            this is the part the eye actually tracks on the way up. */}
        <div
          className="absolute bottom-0 left-0 h-px w-full"
          style={{
            background:
              "linear-gradient(90deg, transparent, color-mix(in srgb, var(--color-fire) 60%, white) 50%, transparent)",
            boxShadow:
              "0 0 18px 2px color-mix(in srgb, var(--color-fire) 30%, transparent)",
          }}
        />

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
                  "linear-gradient(180deg, transparent 0%, #000 22%, #000 78%, transparent 100%)",
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
                      willChange: "transform",
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
                transform: "scaleX(0)",
                transition: ROLL_TRANSITION,
                willChange: "transform",
              }}
            />
            {/* Centre line. Static, not scrolling: the camera is fixed on
              the road and the truck is what moves, so sliding the
              markings would read as the road itself travelling. */}
            <div
              className="absolute top-1/2 left-0 h-[2px] w-full -translate-y-1/2 opacity-30"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(90deg, var(--color-bone) 0 18px, transparent 18px 38px)",
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
                left: "6%",
                willChange: "transform",
                transform: "translate3d(0, -50%, 0)",
                transition: ROLL_TRANSITION,
              }}
            >
              <svg
                viewBox="0 0 32 22"
                className="h-full w-full overflow-visible"
              >
                <TruckGlyph />
              </svg>

              {/* Headlights. A child of the truck, so the beam travels
                with it for free off the same composited transform —
                nothing here is positioned per frame. `screen` is what
                makes it read as light falling on the road rather than a
                pale wedge painted over it, and the road's own
                `overflow-hidden` clips the throw at the far end, which
                is what a beam running out of road looks like. */}
              <div
                ref={beamRef}
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-full"
                style={{ opacity: 0.25, willChange: "opacity" }}
              >
                <div
                  className="absolute top-0 left-0 h-[54px] w-[150px] -translate-y-1/2"
                  style={{
                    clipPath: "polygon(0 40%, 100% 0, 100% 100%, 0 60%)",
                    background:
                      "linear-gradient(90deg, rgba(255,226,182,0.5), rgba(255,226,182,0.06) 55%, transparent)",
                    mixBlendMode: "screen",
                  }}
                />
                {/* The lamps themselves, hot at the source. */}
                <div
                  className="absolute top-0 left-[-6px] h-[22px] w-[26px] -translate-y-1/2 rounded-full"
                  style={{
                    background:
                      "radial-gradient(circle, rgba(255,240,214,0.75), transparent 70%)",
                    mixBlendMode: "screen",
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
