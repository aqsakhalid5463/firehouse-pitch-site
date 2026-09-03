'use client';

import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { PROCESS } from '@/lib/content';
import { RevealText } from '@/components/ui/RevealText';
import { TruckGlyph } from '@/components/ui/TruckGlyph';
import { useReducedMotion } from '@/lib/use-reduced-motion';

gsap.registerPlugin(ScrollTrigger);

/**
 * "How your move works" — the six steps, driven as a route.
 *
 * This was a vertical list of six rows: a number, a title, a paragraph
 * in a panel, repeated. Legible, and completely inert — the client's
 * "very boring", and they were right. A list of six things that happen
 * in order was being presented as six things that happen at once.
 *
 * So it travels instead. The section pins and the steps move sideways
 * as the page scrolls, with a route rail underneath and the truck
 * driving from stop to stop. It is the one horizontal moment on an
 * otherwise vertical page, which is what makes it land, and it is the
 * same metaphor the rest of the site already runs on: scrolling the
 * page moves the truck along a road.
 *
 * Below `md`, and under reduced motion, the whole thing falls back to a
 * plain vertical list. Horizontal scroll-jacking on a phone fights the
 * gesture the reader is already making, and a pinned section that
 * cannot be scrolled past is the worst failure mode on this page.
 */
export function Process() {
  const root = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const progress = useRef<HTMLDivElement>(null);
  const truck = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  // Matches the `md` breakpoint the layout below switches at. Resolved
  // in an effect rather than during render, so the server and the first
  // client render agree.
  const [horizontal, setHorizontal] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const sync = () => setHorizontal(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    if (reduced || !horizontal || !root.current || !track.current) return;

    const ctx = gsap.context(() => {
      const el = track.current!;

      // How far the track has to travel: its own width less one
      // viewport, so the last card ends flush with the right edge
      // rather than being dragged past it.
      const distance = () => Math.max(0, el.scrollWidth - window.innerWidth);

      const tween = gsap.to(el, {
        x: () => -distance(),
        ease: 'none',
        scrollTrigger: {
          trigger: root.current,
          pin: true,
          // Scroll distance is tied to the actual travel, not a fixed
          // multiple of the viewport: at 1440px there is far more track
          // to cover than at 800px, and a fixed `+=300%` makes the same
          // section feel slow on one and frantic on the other.
          end: () => `+=${distance()}`,
          scrub: 0.8,
          // The pin measures the track, and the track's width depends on
          // the font being loaded. Without this the section pins for a
          // distance computed from fallback metrics.
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            if (progress.current) {
              progress.current.style.transform = `scaleX(${self.progress})`;
            }
            if (truck.current) {
              // The truck runs the rail rather than sitting on the
              // moving track: the rail is the thing that represents the
              // whole job, so its position is the honest progress.
              truck.current.style.transform = `translate3d(calc(${(self.progress * 100).toFixed(2)}cqw - 50%), -50%, 0)`;
            }
          },
        },
      });

      // Cards dim and shrink slightly away from the centre of the
      // screen, so there is always one obvious place for the eye. This
      // reads the card's live screen position rather than its index, so
      // it stays correct however far the track has travelled.
      const cards = gsap.utils.toArray<HTMLElement>('[data-step]');
      const focus = () => {
        const mid = window.innerWidth / 2;
        cards.forEach((card) => {
          const r = card.getBoundingClientRect();
          const d = Math.abs(r.left + r.width / 2 - mid) / window.innerWidth;
          const t = gsap.utils.clamp(0, 1, 1 - d * 1.6);
          card.style.opacity = String(0.3 + t * 0.7);
          card.style.transform = `scale(${(0.94 + t * 0.06).toFixed(3)})`;
        });
      };
      focus();
      const ticker = () => focus();
      gsap.ticker.add(ticker);

      // Pinning inserts a spacer and changes the height of the document
      // below it, so every trigger created before this one — including
      // this section's own heading — is holding start/end positions
      // measured against the old layout. Measured: the heading sat in
      // full view with its characters still at opacity 0, because its
      // enter callback had already been evaluated against a page that no
      // longer existed. Deferred a frame so the pin's own layout has
      // settled before everything re-measures.
      requestAnimationFrame(() => ScrollTrigger.refresh());

      return () => {
        gsap.ticker.remove(ticker);
        tween.kill();
      };
    }, root);

    return () => ctx.revert();
  }, [reduced, horizontal]);

  return (
    <section id="process" className="relative overflow-hidden py-32 md:py-0">
      {/* Marked so headings inside can tell ScrollTrigger they are
          being held still by a pin — see RevealText. */}
      <div
        ref={root}
        data-pinned-container
        className="md:flex md:h-screen md:flex-col md:justify-center"
      >
        <div className="mx-auto w-full max-w-7xl px-6">
          <p className="text-xs font-semibold tracking-[0.3em] text-fire uppercase">
            How it works
          </p>
          <RevealText
            as="h2"
            variant="wipe"
            className="mt-6 max-w-3xl text-[clamp(2rem,4.5vw,3.5rem)]"
          >
            Six steps, and none of them are a surprise
          </RevealText>
        </div>

        {/* The track. On desktop this is one long horizontal row that
            GSAP translates; below `md` the same markup is a plain
            vertical stack, which is why the cards carry their own width
            rather than the row carrying a column count. */}
        <div
          ref={track}
          className="mt-14 flex flex-col gap-6 px-6 md:mt-20 md:w-max md:flex-row md:items-stretch md:gap-8 md:pr-[20vw] md:pl-[8vw]"
        >
          {PROCESS.map((p, i) => (
            <article
              key={p.step}
              data-step
              className="relative flex w-full shrink-0 flex-col justify-between rounded-3xl border border-bone/12 bg-bone/[0.03] p-8 backdrop-blur-sm md:h-[46vh] md:w-[clamp(20rem,26vw,26rem)] md:p-10"
            >
              <div>
                <span className="font-mono text-sm text-fire">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h3 className="mt-6 text-[clamp(1.75rem,2.6vw,2.5rem)] leading-none font-semibold tracking-tight uppercase">
                  {p.step}
                </h3>
              </div>
              <p className="mt-8 leading-relaxed text-bone/60">{p.body}</p>

              {/* A hairline that fills as the card takes focus, tying
                  each card back to the rail below. */}
              <span
                aria-hidden="true"
                className="absolute inset-x-8 bottom-0 h-px bg-bone/10 md:inset-x-10"
              />
            </article>
          ))}
        </div>

        {/* The route rail. Hidden below `md`, where there is no travel
            for it to describe. */}
        <div
          aria-hidden="true"
          className="mx-auto hidden w-full max-w-7xl px-6 md:mt-16 md:block"
          style={{ containerType: 'inline-size' }}
        >
          <div className="relative h-px w-full bg-bone/15">
            <div
              ref={progress}
              className="bg-fire absolute inset-0 h-px origin-left"
              style={{ transform: 'scaleX(0)' }}
            />
            {/* Stops. Evenly spaced rather than measured off the cards:
                the rail is a schematic of the job, not a scale drawing
                of the track. */}
            {PROCESS.map((p, i) => (
              <span
                key={p.step}
                className="bg-dark-bg absolute top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-1 ring-bone/25"
                style={{ left: `${(i / (PROCESS.length - 1)) * 100}%` }}
              />
            ))}
            <div
              ref={truck}
              className="absolute top-1/2 h-[26px] w-[38px]"
              style={{ transform: 'translate3d(-50%, -50%, 0)' }}
            >
              <svg viewBox="0 0 32 22" className="h-full w-full overflow-visible">
                <TruckGlyph />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
