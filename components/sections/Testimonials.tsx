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
      <h2 className="mx-auto mb-16 max-w-7xl px-6 text-xs font-semibold tracking-[0.3em] uppercase opacity-50">
        What our customers say
      </h2>
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
              className="w-[min(88vw,26rem)] shrink-0 rounded-2xl border border-current/15 p-8"
            >
              <div aria-hidden="true" className="text-fire">
                ★★★★★
              </div>
              <blockquote className="mt-6 text-lg leading-relaxed">
                “{t.quote}”
              </blockquote>
              <figcaption className="mt-6 text-sm opacity-60">
                {t.name} · {t.detail}
              </figcaption>
            </figure>
          );
        })}
      </div>
    </section>
  );
}
