'use client';

import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { loadLogo } from '@/lib/textures';
import { markReady, preloadProgress, usePreloadStore } from '@/lib/preload-store';
import { TruckGlyph } from './TruckGlyph';

gsap.registerPlugin(ScrollTrigger);

/** Slats the curtain is cut into. They lift in sequence like the truck's
 *  roller door — the same gesture the cargo bay makes in the hero, which
 *  is why it is a door and not a fade. Kept low deliberately: each slat
 *  is a full-viewport composited layer, and removing a pile of those in
 *  one frame is what makes compositors drop tiles. */
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

export function Preloader() {
  const root = useRef<HTMLDivElement>(null);
  const reelsRef = useRef<HTMLDivElement>(null);
  const truckRef = useRef<HTMLDivElement>(null);
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

    const safety = setTimeout(() => {
      ready('fonts');
      ready('logo');
      ready('frame');
    }, SAFETY_MS);

    return () => {
      cancelled = true;
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
    let raf = 0;
    let exiting = false;

    // Handing the page over is deliberately split from the last frame
    // of the animation. Unmounting a stack of composited full-screen
    // layers in the same frame their transform lands can leave Chrome
    // compositing a half-updated screen — the page comes back in
    // horizontal bands of stale black. Hiding first, clearing the
    // promoted transforms, then unmounting two frames later gives the
    // compositor a clean frame to settle on.
    const handOver = () => {
      const el = root.current;
      if (el) {
        el.style.visibility = 'hidden';
        gsap.set(el.querySelectorAll('[data-slat]'), {
          clearProps: 'transform,willChange',
        });
      }
      requestAnimationFrame(() => requestAnimationFrame(() => setGone(true)));
    };

    const exit = () => {
      if (exiting) return;
      exiting = true;

      if (reduced) {
        gsap.to(root.current, { opacity: 0, duration: 0.3, onComplete: handOver });
        return;
      }

      gsap.context(() => {
        const tl = gsap.timeline({ onComplete: handOver });
        // The truck finishes its run off the right-hand edge before
        // anything else moves, so the door opens on an empty road
        // rather than closing over a truck still sitting on it.
        tl.to('[data-truck]', {
          left: '135%',
          duration: 0.55,
          ease: 'power2.in',
        })
          .to(
            '[data-preload-copy]',
            {
              y: -18,
              opacity: 0,
              duration: 0.4,
              ease: 'power3.in',
              stagger: 0.05,
            },
            '-=0.2',
          )
          .to(
            '[data-slat]',
            {
              yPercent: -101,
              duration: 0.75,
              ease: 'power4.inOut',
              // Top slat first, so the curtain reads as a door rolling
              // up rather than every panel dropping at once.
              stagger: 0.05,
            },
            '-=0.15',
          );
      }, root);
    };

    const tick = () => {
      const target = preloadProgress(usePreloadStore.getState().done);
      // Ease toward the target instead of snapping: three checkpoints
      // landing at once would otherwise jump 0 → 100 in one frame.
      shown += (target - shown) * 0.13;
      if (target >= 1 && shown > 0.995) shown = 1;

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
          if (column) column.style.transform = `translateY(${(-offset / 11) * 100}%)`;
        }
      }

      // Travel is inset from both ends: at a literal 0% / 100% the
      // glyph is half-clipped by the road's own edges.
      if (truckRef.current) truckRef.current.style.left = `${6 + shown * 88}%`;
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
    const hardStop = setTimeout(() => setGone(true), SAFETY_MS + 1200);

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

      {/* The door itself. Overlapping heights (calc + 1px) hide the
          sub-pixel seams that show between neighbouring slats at
          fractional viewport heights. */}
      <div aria-hidden="true" className="absolute inset-0">
        {Array.from({ length: SLATS }, (_, i) => (
          <div
            key={i}
            data-slat
            className="absolute left-0 w-full bg-dark-bg"
            style={{
              top: `${(i * 100) / SLATS}%`,
              height: `calc(${100 / SLATS}% + 1px)`,
            }}
          />
        ))}
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
                <span className="block">
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
          data-preload-copy
          className="relative h-11 w-[min(440px,84vw)] overflow-hidden rounded-[3px] border-y border-ribbon-edge/25 bg-[#16161A]"
        >
          {/* Ground already covered, as a wash rather than a bar. */}
          <div
            ref={tintRef}
            className="absolute inset-0 origin-left bg-linear-to-r from-transparent to-fire/12"
            style={{ transform: 'scaleX(0)' }}
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
            // Sitting in the right-hand lane rather than straddling the
            // centre line: travelling left-to-right in a top-down view,
            // that is the lower half of the road.
            className="absolute top-[72%] h-[22px] w-[32px] -translate-x-1/2 -translate-y-1/2"
            style={{ left: '6%' }}
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
