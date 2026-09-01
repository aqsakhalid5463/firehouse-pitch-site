'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { TIMELINE } from '@/lib/content';
import { useReducedMotion } from '@/lib/use-reduced-motion';

gsap.registerPlugin(ScrollTrigger);

export function Story() {
  const root = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced || !root.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '[data-rule]',
        { scaleY: 0 },
        {
          scaleY: 1,
          ease: 'none',
          scrollTrigger: {
            trigger: root.current,
            start: 'top 70%',
            end: 'bottom 80%',
            scrub: true,
          },
        },
      );

      gsap.utils.toArray<HTMLElement>('[data-entry]').forEach((entry) => {
        gsap.from(entry, {
          opacity: 0,
          y: 40,
          duration: 0.8,
          ease: 'power3.out',
          scrollTrigger: { trigger: entry, start: 'top 82%' },
        });
      });
    }, root);
    return () => ctx.revert();
  }, [reduced]);

  return (
    <section ref={root} className="relative px-6 py-32">
      <div className="mx-auto max-w-4xl">
        <div className="relative pl-10">
          <div
            data-rule
            aria-hidden="true"
            className="bg-fire absolute top-0 left-0 h-full w-px origin-top"
          />
          {TIMELINE.map((entry) => (
            <div key={entry.year} data-entry className="relative pb-20">
              <span className="bg-fire absolute top-2 -left-10 block h-2 w-2 -translate-x-1/2 rounded-full" />
              <p className="text-xs font-semibold tracking-[0.2em] uppercase opacity-40">
                {entry.year}
              </p>
              <h3 className="mt-4 text-3xl font-semibold tracking-tight">
                {entry.title}
              </h3>
              <p className="mt-4 text-lg leading-relaxed opacity-70">
                {entry.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
