'use client';

import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { CREW } from '@/lib/content';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { ParticlePortrait } from '@/components/ui/ParticlePortrait';

gsap.registerPlugin(ScrollTrigger);

/** Viewport heights of scroll spent on each person while the section is
 *  pinned. Under about three-quarters of a screen each the roster runs
 *  past faster than the cloud can finish reforming. */
const SCROLL_PER_PERSON = 0.85;

/**
 * The crew, as a pinned roll-call.
 *
 * The section holds still while the scroll position advances through
 * the roster, and the cloud of particles flows from one figure into the
 * next rather than cutting. Scrolling back runs it in reverse.
 */
export function Crew() {
  const root = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced || !root.current) return;

    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: root.current,
        pin: true,
        end: () => `+=${window.innerHeight * SCROLL_PER_PERSON * CREW.length}`,
        scrub: true,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          // Floor rather than round, so each person owns an equal slice
          // and the first and last are not half-length.
          const at = Math.min(
            CREW.length - 1,
            Math.floor(self.progress * CREW.length),
          );
          setIndex((current) => (current === at ? current : at));
        },
      });
    }, root);

    return () => ctx.revert();
  }, [reduced]);

  const person = CREW[index];

  return (
    <section
      ref={root}
      data-crew
      className="relative flex min-h-screen items-center overflow-hidden py-24"
      aria-label="The crew"
    >
      <div className="mx-auto grid w-full max-w-7xl gap-12 px-6 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <p className="mb-6 font-mono text-xs tracking-[0.3em] text-fire uppercase">
            The crew
          </p>
          {/* The roster is a real list, always in the DOM, with the
              person under the cursor marked. A screen reader gets every
              name and role in order; the particles are decoration and
              are hidden from it. Rendering only the active person would
              mean the page's actual content depended on scroll
              position. */}
          <ul className="space-y-1">
            {CREW.map((member, i) => (
              <li
                key={member.name}
                data-crew-member
                aria-current={i === index ? 'true' : undefined}
                className="transition-opacity duration-500"
                style={{ opacity: i === index ? 1 : 0.22 }}
              >
                <span className="block text-[clamp(1.6rem,4vw,3rem)] leading-[1.15] font-thin tracking-tight uppercase">
                  {member.name}
                </span>
                <span className="block font-mono text-[0.7rem] tracking-[0.24em] uppercase opacity-60">
                  {member.role}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative mx-auto h-[46vh] w-[min(320px,70vw)] md:h-[60vh] md:w-[360px]">
          <ParticlePortrait
            figure={person.figure}
            className="absolute inset-0 h-full w-full"
          />
        </div>
      </div>
    </section>
  );
}
