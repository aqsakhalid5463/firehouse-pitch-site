import Image from "next/image";
import { NETWORK_MARQUEE } from "@/lib/content";

/**
 * How many times the list repeats inside a single pass.
 *
 * The loop works by sliding one pass out while an identical pass takes
 * its place, which only looks continuous if a pass is at least as wide
 * as the screen. Three partners come to about 1050px — narrower than
 * any desktop — so the band ran out and left a bare stretch at the
 * right-hand edge before the next pass arrived. Four repeats puts a
 * pass at roughly 4200px, wide enough for an ultrawide display, and
 * twenty-four small rows cost nothing.
 */
const REPEATS = 4;

/**
 * The companies behind a Firehouse move, as a band that keeps moving.
 *
 * A full-bleed strip rather than a section: it runs edge to edge, has
 * no heading of its own, and reads as a rule drawn across the page
 * between two pieces of writing. That is the point of it — it is not
 * an argument, it is a list of the names that back one, so it should
 * pass under the eye rather than ask for the frame.
 *
 * Deliberately not a route rider. Every other block on this page
 * travels away down the road as you scroll; this one holds still,
 * because it already has a motion of its own and two at once reads as
 * a fault rather than as a flourish.
 */
export function Integrations() {
  return (
    <section
      data-integrations
      aria-label="Companies we work with"
      // Opaque, like the footer and for the same reason: the WebGL
      // scene is a fixed layer behind everything, and at a near
      // transparent fill the 3D road drew its lane markings straight
      // through the logos and the names. A band of marks is only
      // legible against a ground of its own.
      className="relative z-20 overflow-hidden border-y border-bone/10 bg-[#0C0B10] py-7"
    >
      <div className="flex">
        {[0, 1].map((pass) => (
          <div
            key={pass}
            data-integrations-track
            // The second pass is the same list again, translated by
            // exactly its own width — that is what makes the loop
            // seamless — and hidden from screen readers so the names
            // are not announced twice.
            aria-hidden={pass === 1 ? "true" : undefined}
            className="animate-band flex shrink-0 items-center gap-14 pr-14"
          >
            {Array.from({ length: REPEATS }).flatMap((_, repeat) =>
              NETWORK_MARQUEE.map((entry) => (
                <span
                  key={`${repeat}-${entry.name}`}
                  className="flex items-center gap-4"
                >
                  {/* The mark on its own tile. The two partner logos are
                    photographs of logos with their own backgrounds
                    baked in, so a tile with rounded corners is the
                    honest way to show them — floating them on the page
                    would leave a hard square of someone else's brand
                    colour sitting on ours. */}
                  <span className="relative block size-11 shrink-0 overflow-hidden rounded-xl ring-1 ring-bone/12">
                    <Image
                      src={entry.logo}
                      alt=""
                      fill
                      sizes="44px"
                      className="object-cover"
                    />
                  </span>
                  <span className="flex flex-col">
                    <span className="text-sm font-bold tracking-[0.18em] whitespace-nowrap uppercase">
                      {entry.name}
                    </span>
                    <span className="mt-1 font-mono text-[0.65rem] tracking-[0.16em] whitespace-nowrap uppercase opacity-45">
                      {entry.role}
                    </span>
                  </span>
                </span>
              )),
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
