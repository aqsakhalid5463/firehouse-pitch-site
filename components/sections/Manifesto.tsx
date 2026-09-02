import { MANIFESTO, TRUST_MARKS } from '@/lib/content';
import { RevealText } from '@/components/ui/RevealText';
import { ScrubText } from '@/components/ui/ScrubText';
import { FadeUp } from '@/components/ui/FadeUp';

/**
 * The company in its own words, immediately after the 3D opening.
 *
 * The page went from the set-piece straight into a grid of services,
 * which meant a visitor was being sold to before being told who was
 * selling. This is the one place on the page using the scrubbed
 * word-by-word reveal — the reader's scroll uncovers the sentence — and
 * it earns it by being the statement the page most wants read.
 */
export function Manifesto() {
  return (
    <section className="relative px-6 py-32">
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-semibold tracking-[0.3em] text-fire uppercase">
          Who we are
        </p>
        <RevealText
          as="h2"
          className="mt-6 max-w-3xl text-[clamp(1.75rem,3.6vw,2.75rem)] leading-tight font-semibold tracking-tight"
        >
          A moving company built by people who kept needing one
        </RevealText>

        <ScrubText className="mt-12 text-[clamp(1.4rem,3vw,2.4rem)] leading-[1.35] font-medium tracking-tight text-bone">
          {MANIFESTO}
        </ScrubText>

        {/* The client's own trust marks, run as a band rather than a
            list so they read as a single credential line. */}
        <FadeUp
          stagger
          className="mt-16 flex flex-wrap gap-x-3 gap-y-3 border-t border-bone/12 pt-8"
        >
          {TRUST_MARKS.map((mark) => (
            <span
              key={mark}
              className="rounded-full border border-bone/15 px-4 py-2 text-xs font-medium tracking-wide text-bone/70"
            >
              {mark}
            </span>
          ))}
        </FadeUp>
      </div>
    </section>
  );
}
