"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { PROCESS } from "@/lib/content";
import { RevealText } from "@/components/ui/RevealText";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { GlassPanel } from "@/components/ui/GlassPanel";

gsap.registerPlugin(ScrollTrigger);

/**
 * "How your move works" — the six steps, revealed one at a time.
 *
 * The page used to go from a grid of services straight to a phone
 * number, which said what the company sells but never what hiring it
 * looks like. Each row starts dimmed and lifts to full contrast as it
 * reaches the middle of the viewport, so the reader's attention has a
 * single obvious place to be and the section reads as a sequence rather
 * than as another list.
 */
export function Process() {
  const root = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced || !root.current) return;
    const ctx = gsap.context(() => {
      const rows = gsap.utils.toArray<HTMLElement>("[data-step]");
      rows.forEach((row) => {
        gsap.fromTo(
          row,
          { opacity: 0.25, x: -18 },
          {
            opacity: 1,
            x: 0,
            duration: 0.7,
            ease: "power3.out",
            scrollTrigger: {
              trigger: row,
              // Fires as the row crosses the lower-middle of the
              // screen, which is roughly where the eye already is when
              // scrolling steadily.
              start: "top 78%",
              toggleActions: "play none none reverse",
            },
          },
        );
      });
    }, root);
    return () => ctx.revert();
  }, [reduced]);

  return (
    <section id="process" className="relative px-6 py-32">
      <div ref={root} className="mx-auto max-w-7xl">
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

        <ol className="mt-20">
          {PROCESS.map((p, i) => (
            <li
              key={p.step}
              data-step
              className="group grid gap-x-8 gap-y-3 border-t border-bone/12 py-10 md:grid-cols-12 md:py-12"
            >
              <span className="font-mono text-sm text-fire md:col-span-2">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="text-2xl font-semibold tracking-tight md:col-span-3">
                {p.step}
              </h3>
              <GlassPanel className="md:col-span-7">
                <p className="max-w-2xl leading-relaxed text-bone/60">
                  {p.body}
                </p>
              </GlassPanel>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
