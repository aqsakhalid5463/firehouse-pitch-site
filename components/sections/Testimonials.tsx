'use client';

import { useEffect, useRef } from 'react';
import { TESTIMONIALS } from '@/lib/content';
import { getScrollVelocity } from '@/lib/scroll-store';
import { useReducedMotion } from '@/lib/use-reduced-motion';

export function Testimonials() {
  const track = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced || !track.current) return;
    let raf = 0;
    let offset = 0;

    const tick = () => {
      const el = track.current;
      if (el) {
        const boost = Math.min(4, Math.abs(getScrollVelocity()) * 0.06);
        offset -= 0.6 + boost;
        const half = el.scrollWidth / 2;
        if (half > 0 && Math.abs(offset) >= half) offset += half;
        el.style.transform = `translate3d(${offset}px, 0, 0)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced]);

  // Duplicated once so the translate can loop seamlessly. The duplicate
  // set is presentational only — it's hidden from assistive tech so
  // screen readers don't read every testimonial twice.
  const items = [...TESTIMONIALS, ...TESTIMONIALS];

  return (
    <section className="relative overflow-hidden py-32">
      <h2 className="mx-auto mb-16 max-w-7xl px-6 text-xs font-semibold tracking-[0.3em] uppercase text-bone/50">
        What our customers say
      </h2>

      {/* The marquee runs edge to edge, so without these the cards get
          guillotined by the viewport. Fading them into the page colour
          reads as the row continuing off-screen instead. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-dark-bg to-transparent"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-dark-bg to-transparent"
      />
      <div
        ref={track}
        className="flex w-max gap-6 px-6 will-change-transform"
      >
        {items.map((t, i) => {
          const isDuplicate = i >= TESTIMONIALS.length;
          return (
            <figure
              key={i}
              aria-hidden={isDuplicate || undefined}
              className="group relative flex w-[min(88vw,28rem)] shrink-0 flex-col justify-between overflow-hidden rounded-3xl bg-bone/[0.04] p-9 ring-1 ring-bone/10 transition-colors duration-500 hover:bg-bone/[0.07] hover:ring-fire/40"
            >
              {/* Oversized punctuation as a graphic element rather than
                  a glyph to read — hence aria-hidden and the low
                  opacity; the quote itself is in the blockquote. */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -top-8 right-4 font-serif text-[9rem] leading-none text-fire/15 transition-colors duration-500 group-hover:text-fire/25"
              >
                &rdquo;
              </span>

              <blockquote className="relative text-xl leading-relaxed text-bone/90">
                {t.quote}
              </blockquote>

              <figcaption className="relative mt-10 flex items-center gap-4 border-t border-bone/10 pt-6">
                <span
                  aria-hidden="true"
                  className="flex size-10 shrink-0 items-center justify-center rounded-full bg-fire/15 text-sm font-semibold text-fire"
                >
                  {t.name.charAt(0)}
                </span>
                <span className="text-sm leading-snug">
                  <span className="block font-medium text-bone/90">{t.name}</span>
                  <span className="block text-bone/50">{t.detail}</span>
                </span>
              </figcaption>
            </figure>
          );
        })}
      </div>
    </section>
  );
}
