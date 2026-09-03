import { BUSINESS, HERO_HEADLINE } from "@/lib/constants";
import { RevealText } from "@/components/ui/RevealText";
import { Button } from "@/components/ui/Button";

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
        <RevealText
          as="h1"
          variant="flip"
          className="text-[clamp(2.5rem,6vw,4.25rem)] leading-[0.95] font-semibold tracking-tight"
        >
          {HERO_HEADLINE}
        </RevealText>
        {/* Round 18: raised from opacity-70 — at 70% this mid-grey text
            washed out against the road's light-grey surface and lane
            markings it crosses (the client's "not as readable because of
            Road" complaint). Still kept short of the headline's full
            strength so it reads as clearly secondary. Paired with a
            strengthened/reshaped scrim in Opening.tsx so the text sits on
            a genuinely darker field rather than relying on opacity alone.
            Round 19 (this round): the client asked for something more
            definite behind this specific paragraph — a "silvery
            transparent background" — because the wide dark scrim alone
            still let the road's surface/markings show faintly through
            during the set-piece. positioned panel below give the paragraph its own frosted
            backing without touching layout (the panel is a padded, content-sized
            paragraph's own box via inset, not a fixed size). This whole
            block sits inside the parent's [data-hero-copy] wrapper, so it
            fades out on the exact same GSAP-driven opacity as the rest of
            the hero copy (see Opening.tsx's applyProgress) — no separate
            fade logic needed here, and it is therefore already gone
            before the loading beat and never present in the light half. */}
        <div className="mt-[clamp(1rem,4vh,2rem)] w-fit max-w-[34rem] rounded-2xl bg-silver-glass/10 px-5 py-4 ring-1 ring-silver-glass/20 backdrop-blur-md">
          <p className="text-lg leading-relaxed opacity-90">
            Local and long-distance movers for homes and offices across the DFW
            area. Packing, storage, and a crew that shows up when we said we
            would.
          </p>
        </div>
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
