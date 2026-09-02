'use client';

import Image from 'next/image';
import { useState } from 'react';
import { EXTRAS } from '@/lib/content';
import { RevealText } from '@/components/ui/RevealText';

/**
 * The things they offer beyond the move: inspection, supplies, uniformed
 * crews, gift cards.
 *
 * Built as a hover-linked list rather than another card grid — the page
 * already has one of those for services, and repeating it would make the
 * two sections read as the same content twice. Pointing at a row swaps
 * the image, which lets four items share one large photograph instead of
 * four small ones competing.
 *
 * The image panel is absent below `lg`, where there is no room for it
 * beside the list; the rows carry their own copy, so nothing is lost.
 */
export function Extras() {
  const [active, setActive] = useState(0);

  return (
    <section className="relative px-6 py-32">
      <div className="mx-auto max-w-7xl">
        <p className="text-xs font-semibold tracking-[0.3em] text-fire uppercase">
          Beyond the move
        </p>
        <RevealText
          as="h2"
          className="mt-6 max-w-3xl text-[clamp(2rem,4.5vw,3.5rem)] leading-tight font-semibold tracking-tight"
        >
          The parts people forget to ask about
        </RevealText>

        <div className="mt-20 grid gap-14 lg:grid-cols-2">
          <ul className="order-2 lg:order-1">
            {EXTRAS.map((item, i) => {
              const on = active === i;
              return (
                <li key={item.title}>
                  <button
                    type="button"
                    // Pointer for mice, focus for keyboards: the panel
                    // should follow whichever the visitor is using.
                    onPointerEnter={() => setActive(i)}
                    onFocus={() => setActive(i)}
                    onClick={() => setActive(i)}
                    aria-current={on}
                    className="group w-full border-t border-bone/12 py-7 text-left last:border-b"
                  >
                    <div className="flex items-baseline gap-5">
                      <span
                        className={`font-mono text-xs transition-colors duration-300 ${
                          on ? 'text-fire' : 'text-bone/35'
                        }`}
                      >
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <h3
                        className={`text-[clamp(1.35rem,2.4vw,1.9rem)] font-semibold tracking-tight transition-colors duration-300 ${
                          on ? 'text-bone' : 'text-bone/55'
                        }`}
                      >
                        {item.title}
                      </h3>
                    </div>
                    {/* Collapses to nothing when inactive. Animating
                        grid-template-rows rather than max-height keeps
                        the timing identical for a two-line and a
                        four-line body. */}
                    <div
                      className={`grid transition-[grid-template-rows,opacity] duration-500 ease-out ${
                        on ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                      }`}
                    >
                      <div className="overflow-hidden">
                        <p className="max-w-xl pt-4 pl-10 leading-relaxed text-bone/60">
                          {item.body}
                        </p>
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="relative order-1 hidden aspect-4/5 overflow-hidden rounded-3xl ring-1 ring-bone/10 lg:order-2 lg:block">
            {EXTRAS.map((item, i) => (
              <Image
                key={item.image}
                src={item.image}
                alt={item.alt}
                fill
                sizes="(min-width: 1024px) 46vw, 0px"
                // All four stay mounted and cross-fade. Swapping the
                // src instead would decode on every hover and flash a
                // gap on a cold cache.
                className={`object-cover brightness-[0.85] transition-opacity duration-500 ${
                  active === i ? 'opacity-100' : 'opacity-0'
                }`}
              />
            ))}
            <div
              aria-hidden="true"
              className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-dark-bg/80 to-transparent"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
