'use client';

import Image from 'next/image';
import { useEffect, useRef } from 'react';
import { useReducedMotion } from '@/lib/use-reduced-motion';

/**
 * A large editorial service card: photograph first, copy underneath.
 *
 * The photographs are the client's own, and they were shot in mixed
 * lighting on a bright day — dropped straight onto a near-black page
 * they read as six glowing rectangles and pull focus from the ribbon.
 * So they sit dimmed and desaturated at rest and resolve to full
 * strength on hover, which also gives the grid something to reward
 * pointer exploration with.
 *
 * `priority` is threaded through for the first row only; the rest are
 * lazy by default, since six 2048px-wide JPEGs above the fold would
 * dominate the page's loading budget.
 */
/** Peak vertical travel, in px, at the extremes of the viewport. */
const PARALLAX_PX = 26;

export function ServiceCard({
  index,
  title,
  body,
  image,
  alt,
  priority = false,
}: {
  index: number;
  title: string;
  body: string;
  image: string;
  alt: string;
  priority?: boolean;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const img = useRef<HTMLImageElement>(null);
  const reduced = useReducedMotion();

  // Drifts the photograph vertically inside its frame as the card
  // crosses the viewport. The image is rendered oversized (scale below)
  // so there is real material to move without exposing an edge, and the
  // travel is small — this should register as depth, not as a moving
  // picture competing with the ribbon.
  useEffect(() => {
    if (reduced) return;
    const el = frame.current;
    const target = img.current;
    if (!el || !target) return;

    let raf = 0;
    const tick = () => {
      const r = el.getBoundingClientRect();
      if (r.bottom > 0 && r.top < window.innerHeight) {
        // -1 when the card sits at the bottom of the viewport, +1 at the
        // top, 0 when centred.
        const centre = (r.top + r.height / 2) / window.innerHeight;
        const offset = (0.5 - centre) * 2 * PARALLAX_PX;
        target.style.transform = `translate3d(0, ${offset.toFixed(2)}px, 0)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced]);

  return (
    <article className="group relative">
      {/* 4:3 matches the source photographs' native 2048x1536, so
          object-cover has nothing to crop. Every card shares it: an
          earlier version alternated tall and short by index, but in a
          two-column grid even indices are always the left column, so
          the alternation read as "the left column is bigger" rather
          than as rhythm. The vertical stagger in Services carries the
          asymmetry instead, and uniform cards keep the six services
          reading as equal offerings. */}
      <div
        ref={frame}
        className="relative aspect-4/3 overflow-hidden rounded-3xl ring-1 ring-bone/10"
      >
        <Image
          ref={img}
          src={image}
          alt={alt}
          fill
          priority={priority}
          sizes="(min-width: 1024px) 46vw, (min-width: 768px) 90vw, 100vw"
          // scale-110 gives the parallax somewhere to travel: without the
          // overscan, drifting the image would slide its own edge into
          // the frame.
          className="scale-110 object-cover brightness-[0.8] saturate-[0.65] transition-[filter,scale] duration-700 ease-out group-hover:scale-[1.16] group-hover:brightness-105 group-hover:saturate-100"
        />

        {/* Grounds the image into the page so its bottom edge doesn't
            cut a hard rectangle against the dark background. Confined to
            the bottom third: spanning the full height buried more than
            half of some photographs in black, since these are dim,
            overcast shots to begin with. */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-dark-bg/85 to-transparent"
        />

        {/* The ribbon runs down the page in brand red; this edge marker
            is the card acknowledging it on hover. */}
        <div
          aria-hidden="true"
          className="absolute inset-y-0 left-0 w-[3px] origin-top scale-y-0 bg-fire transition-transform duration-500 ease-out group-hover:scale-y-100"
        />

        <span
          aria-hidden="true"
          className="absolute top-6 left-6 text-xs font-semibold tracking-[0.25em] text-bone/70"
        >
          {String(index + 1).padStart(2, '0')}
        </span>
      </div>

      <h3 className="mt-7 text-[clamp(1.5rem,2.4vw,2rem)] font-semibold tracking-tight">
        {title}
      </h3>
      <p className="mt-3 max-w-md leading-relaxed text-bone/60">{body}</p>
    </article>
  );
}
