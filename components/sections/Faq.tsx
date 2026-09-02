'use client';

import { useRef, useState, useId } from 'react';
import { FAQ } from '@/lib/content';
import { RevealText } from '@/components/ui/RevealText';

/**
 * The questions people ask before booking a mover.
 *
 * Built on real buttons and `aria-expanded`/`aria-controls` rather than
 * <details>, so the open/close can be animated and only one panel can
 * be open at a time. The panel animates `grid-template-rows` between
 * 0fr and 1fr instead of a hardcoded max-height: the answers differ in
 * length, and a max-height large enough for the longest one makes the
 * short ones snap open at the wrong speed.
 */
function Item({
  q,
  a,
  open,
  onToggle,
}: {
  q: string;
  a: string;
  open: boolean;
  onToggle: () => void;
}) {
  const id = useId();

  return (
    <div className="border-t border-bone/12">
      <h3>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={id}
          className="group flex w-full items-center justify-between gap-6 py-7 text-left"
        >
          <span
            className={`text-xl font-medium tracking-tight transition-colors duration-300 md:text-2xl ${
              open ? 'text-bone' : 'text-bone/75 group-hover:text-bone'
            }`}
          >
            {q}
          </span>
          {/* A plus that rotates into a minus: one bar is always
              horizontal, the other rotates 90deg to meet it. */}
          <span
            aria-hidden="true"
            className="relative size-6 shrink-0 text-fire"
          >
            <span className="absolute top-1/2 left-0 h-[2px] w-full -translate-y-1/2 bg-current" />
            <span
              className={`absolute top-0 left-1/2 h-full w-[2px] -translate-x-1/2 bg-current transition-transform duration-300 ease-out ${
                open ? 'rotate-90' : 'rotate-0'
              }`}
            />
          </span>
        </button>
      </h3>

      <div
        id={id}
        className={`grid transition-[grid-template-rows,opacity] duration-400 ease-out ${
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        {/* The overflow-hidden child is required: a 0fr grid row still
            lets its content paint unless something clips it. */}
        <div className="overflow-hidden">
          <p className="max-w-3xl pb-8 leading-relaxed text-bone/60">{a}</p>
        </div>
      </div>
    </div>
  );
}

export function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const root = useRef<HTMLDivElement>(null);

  return (
    <section id="faq" className="relative px-6 py-32">
      <div ref={root} className="mx-auto max-w-7xl">
        <p className="text-xs font-semibold tracking-[0.3em] text-fire uppercase">
          Questions
        </p>
        <RevealText
          as="h2"
          className="mt-6 max-w-3xl text-[clamp(2rem,4.5vw,3.5rem)] leading-tight font-semibold tracking-tight"
        >
          The things people ask before they book
        </RevealText>

        <div className="mt-16 border-b border-bone/12">
          {FAQ.map((item, i) => (
            <Item
              key={item.q}
              q={item.q}
              a={item.a}
              open={openIndex === i}
              onToggle={() => setOpenIndex(openIndex === i ? null : i)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
