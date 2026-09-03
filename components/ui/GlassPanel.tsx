import type { ReactNode } from 'react';

/**
 * The frosted backing first built for the hero subhead, extracted so the
 * rest of the page can use the same one.
 *
 * The ribbon's road runs behind the whole page, and body copy sitting on
 * top of a pale asphalt stroke and its lane markings is genuinely hard
 * to read. Dimming the road helps but cannot fix it on its own: at some
 * scroll position the road crosses every column of text on the page.
 * Giving the copy its own slightly lifted, blurred panel means the
 * contrast behind a paragraph no longer depends on what the road happens
 * to be doing there.
 *
 * `w-fit` deliberately: the panel hugs its text rather than spanning the
 * column, so it reads as a plate the copy sits on instead of a filled
 * box. Callers that want it to fill a grid cell pass `w-full`.
 */
export function GlassPanel({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`w-fit rounded-2xl bg-silver-glass/8 px-5 py-4 ring-1 ring-silver-glass/15 backdrop-blur-md ${className}`}
    >
      {children}
    </div>
  );
}
