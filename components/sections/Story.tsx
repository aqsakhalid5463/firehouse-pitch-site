"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { PILLARS } from "@/lib/content";
import { RevealText } from "@/components/ui/RevealText";
import { useReducedMotion } from "@/lib/use-reduced-motion";

gsap.registerPlugin(ScrollTrigger);

export function Story() {
  const root = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced || !root.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        "[data-rule]",
        { scaleY: 0 },
        {
          scaleY: 1,
          ease: "none",
          scrollTrigger: {
            trigger: root.current,
            start: "top 70%",
            end: "bottom 80%",
            scrub: true,
          },
        },
      );

      gsap.utils.toArray<HTMLElement>("[data-entry]").forEach((entry) => {
        gsap.from(entry, {
          opacity: 0,
          y: 40,
          duration: 0.8,
          ease: "power3.out",
          scrollTrigger: { trigger: entry, start: "top 82%" },
        });
      });
    }, root);
    return () => ctx.revert();
  }, [reduced]);

  return (
    <section
      ref={root}
      data-ribbon-zone="circles"
      className="relative px-6 py-32"
    >
      <div className="mx-auto max-w-4xl">
        <div data-route-rider>
          <RevealText
            as="h2"
            variant="fall"
            className="mb-20 text-[clamp(2rem,4.5vw,3.5rem)]"
          >
            What Firehouse actually is
          </RevealText>
        </div>

        {/* The vertical rule draws down as you scroll. It reads as a
            spine connecting the four pillars, not as a timeline — these
            are deliberately not chronological, so nothing here is
            labelled with a date or an era. */}
        <div className="relative pl-10">
          <div
            data-rule
            aria-hidden="true"
            className="bg-fire absolute top-0 left-0 h-full w-px origin-top"
          />
          {PILLARS.map((entry) => (
            <div key={entry.label} data-entry className="relative pb-20">
              {/* Each pillar rides separately, so they arrive at the
                  road at different moments instead of the block moving
                  as one slab. The rider is inside data-entry because
                  that element already carries an entrance tween. */}
              <div data-route-rider>
                <span className="bg-fire absolute top-2 -left-10 block h-2 w-2 -translate-x-1/2 rounded-full" />
                <p className="text-xs font-semibold tracking-[0.2em] uppercase opacity-40">
                  {entry.label}
                </p>
                <RevealText
                  as="h3"
                  variant="rise"
                  className="mt-4 text-3xl font-semibold tracking-tight"
                >
                  {entry.title}
                </RevealText>
                <p className="mt-4 text-lg leading-relaxed opacity-70">
                  {entry.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
