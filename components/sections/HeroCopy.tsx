import { BUSINESS, HERO_HEADLINE } from '@/lib/constants';
import { RevealText } from '@/components/ui/RevealText';
import { Button } from '@/components/ui/Button';

/**
 * The hero headline, copy, and CTAs — kept as a plain server component so
 * this text is server-rendered HTML, not just something a client
 * component paints in after hydration. `tests/e2e/home.spec.ts` asserts
 * the headline and phone number are literally in the raw HTML response.
 *
 * It is composed *into* the client-side pinned `Opening` section from the
 * server-component page tree (passed as `children`), rather than being
 * written directly inside `Opening` (a `'use client'` component) — a
 * server component passed as children like this keeps its own subtree
 * server-rendered even though its parent is a client component. Writing
 * this markup inline inside `Opening` instead would cross the client
 * boundary and strip it out of server rendering, breaking that e2e test.
 * `Opening` only ever touches this content's opacity via a CSS selector;
 * it never needs to own the markup itself.
 */
export function HeroCopy() {
  return (
    <div className="mx-auto w-full max-w-7xl">
      {/* Capped so the copy column can never run under the box stack,
          which sits in the right third of the frame — checked at
          several viewport widths, not just the design width. */}
      <div className="max-w-xl lg:max-w-2xl">
        {/* Vertical spacing here is clamped to viewport height, not a
            fixed rem value — on a tall window it reads exactly as
            before, but on a short one (e.g. 1512x700) it shrinks in
            step so this whole block stays short enough to leave the
            process block's grid row (and its gap) genuine room below.
            Without this the block's fixed-height spacing could hold at
            its generous size while its own grid row shrank around it,
            spilling "Move as One" into the CTAs below (round 17
            regression). */}
        <p className="mb-[clamp(1rem,4vh,2rem)] text-xs font-semibold tracking-[0.3em] uppercase opacity-60">
          Lewisville, Texas · Licensed &amp; Insured
        </p>
        <RevealText
          as="h1"
          className="text-[clamp(2.5rem,6vw,4.25rem)] leading-[0.95] font-semibold tracking-tight"
        >
          {HERO_HEADLINE}
        </RevealText>
        <p className="mt-[clamp(1rem,4vh,2rem)] text-lg leading-relaxed opacity-70">
          Local and long-distance movers for homes and offices across the DFW
          area. Packing, storage, and a crew that shows up when we said we
          would.
        </p>
        <div className="mt-[clamp(1rem,5vh,3rem)] flex flex-wrap items-center gap-4">
          <Button href="#quote">Get a Quote</Button>
          <Button href={BUSINESS.phoneHref} variant="ghost">
            {BUSINESS.phone}
          </Button>
        </div>
      </div>
    </div>
  );
}
