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

      // Cards dim and shrink away from the centre of the screen, and
      // tilt toward the cursor when hovered.
      //
      // Both are written from one place. The focus scale and the hover
      // tilt are the same CSS property, so two independent tweens would
      // overwrite each other every frame and which one you saw would
      // depend on ordering — the same trap the service cards hit, where
      // scroll parallax and a hover push fought over one transform.
      const cards = gsap.utils.toArray<HTMLElement>('[data-step]');
      const hover = cards.map(() => ({ x: 0, y: 0, on: 0, tx: 0, ty: 0, ton: 0 }));

      cards.forEach((card, i) => {
        const h = hover[i];
        card.addEventListener('pointermove', (e) => {
          // Coarse pointers send one synthetic move on tap, which would
          // leave a card stuck tilted with nothing to un-tilt it.
          if ((e as PointerEvent).pointerType !== 'mouse') return;
          const r = card.getBoundingClientRect();
          h.tx = ((e as PointerEvent).clientX - r.left) / r.width - 0.5;
          h.ty = ((e as PointerEvent).clientY - r.top) / r.height - 0.5;
          h.ton = 1;
        });
        card.addEventListener('pointerleave', () => {
          h.ton = 0;
          h.tx = 0;
          h.ty = 0;
        });
      });

      const TILT = 9;
      const LIFT = 26;
      const focus = () => {
        const mid = window.innerWidth / 2;
        cards.forEach((card, i) => {
          const r = card.getBoundingClientRect();
          const d = Math.abs(r.left + r.width / 2 - mid) / window.innerWidth;
          const t = gsap.utils.clamp(0, 1, 1 - d * 1.6);

          const h = hover[i];
          h.x += (h.tx - h.x) * 0.12;
          h.y += (h.ty - h.y) * 0.12;
          h.on += (h.ton - h.on) * 0.12;
          if (Math.abs(h.ton - h.on) < 0.001) h.on = h.ton;

          card.style.opacity = String(0.3 + t * 0.7 + h.on * 0.2);
          // `translateZ` is what makes this read as the card coming
          // toward the reader rather than just getting bigger: with the
          // perspective on the track, moving in Z changes the card's
          // size *and* how much of its sides you see.
          card.style.transform =
            `translate3d(0, ${(-h.on * LIFT).toFixed(1)}px, ${(h.on * 90).toFixed(1)}px) ` +
            `rotateX(${(-h.y * TILT).toFixed(2)}deg) ` +
            `rotateY(${(h.x * TILT).toFixed(2)}deg) ` +
            `scale(${(0.94 + t * 0.06).toFixed(3)})`;
          card.style.zIndex = h.on > 0.02 ? '10' : '0';

          // The contents sit at their own depths, so the card has an
          // inside rather than being a picture of a card. Without this
          // the tilt reads as a sheet of paper turning.
          const layers = card.querySelectorAll<HTMLElement>('[data-depth]');
          layers.forEach((layer) => {
            const depth = Number(layer.dataset.depth ?? 0);
            layer.style.transform =
              `translate3d(${(-h.x * depth * 26).toFixed(1)}px, ${(-h.y * depth * 18).toFixed(1)}px, ${(h.on * depth * 40).toFixed(1)}px)`;
          });
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
          // Perspective lives on the track, not the cards: one shared
          // vanishing point means neighbouring cards tilt as though they
          // are in the same room. Per-card perspective gives each its own
          // camera, which is what makes a row of tilting cards look like
          // a row of unrelated animations.
          style={{ perspective: '1400px', transformStyle: 'preserve-3d' }}
          className="mt-14 flex flex-col gap-6 px-6 md:mt-20 md:w-max md:flex-row md:items-stretch md:gap-8 md:pr-[20vw] md:pl-[8vw]"
        >
          {PROCESS.map((p, i) => (
            <article
              key={p.step}
              data-step
              style={{ transformStyle: 'preserve-3d' }}
              className="group relative isolate flex w-full shrink-0 flex-col overflow-hidden rounded-3xl border border-bone/10 bg-linear-to-b from-bone/[0.055] to-bone/[0.015] p-8 shadow-[0_18px_40px_-24px_rgba(0,0,0,0.9)] transition-[border-color,box-shadow] duration-500 ease-out hover:border-fire/40 hover:shadow-[0_50px_90px_-40px_rgba(0,0,0,1)] md:h-[46vh] md:w-[clamp(20rem,26vw,26rem)] md:p-10"
            >
              {/* The step number, set enormous and nearly invisible. It
                  fills the card's middle — which was dead space with the
                  body pinned to the bottom — and being the deepest layer
                  it is what you see move most when the card tilts. */}
              {/* Clipped by its own wrapper rather than by the card.
                  `transform-style: preserve-3d` on the card disables
                  overflow clipping there — measured: the numeral spilled
                  out and sat on the page behind its neighbours — so the
                  clip has to happen inside a flat context. */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-3xl"
              >
                <span
                  data-depth="-0.6"
                  className="absolute -right-4 -bottom-12 block text-[11rem] leading-none font-semibold tracking-tighter text-bone/[0.045] transition-colors duration-500 group-hover:text-fire/[0.09]"
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
              </span>

              {/* A red edge along the top, drawn on from the left as the
                  card takes focus — the same gesture the route rail
                  below makes, so the card reads as part of the journey
                  rather than a tile. */}
              <span
                aria-hidden="true"
                className="bg-fire absolute inset-x-0 top-0 h-[2px] origin-left scale-x-0 transition-transform duration-500 ease-out group-hover:scale-x-100"
              />

              <div data-depth="0.35" className="flex-1">
                <span className="font-mono text-sm text-fire">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h3 className="mt-6 text-[clamp(1.75rem,2.6vw,2.5rem)] leading-none font-semibold tracking-tight uppercase">
                  {p.step}
                </h3>
              </div>

              <div data-depth="0.15">
                <span
                  aria-hidden="true"
                  className="mb-5 block h-px w-full bg-bone/10"
                />
                <p className="leading-relaxed text-bone/60">{p.body}</p>
              </div>
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
