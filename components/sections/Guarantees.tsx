import Image from 'next/image';
import { GUARANTEES } from '@/lib/content';
import { RevealText } from '@/components/ui/RevealText';
import { StackedCards } from '@/components/ui/StackedCards';

/**
 * The promises, dealt as a 3D stack.
 *
 * These were three rows of a table: a number, a heading, a paragraph in
 * a panel, repeated — the same shape as every other list on the page,
 * which is what made a section about the company's actual commitments
 * read as filler. Each promise now gets the whole frame to itself and
 * is dealt off the top of a stack as you scroll.
 *
 * The motion lives in StackedCards; everything below is content and
 * presentation, so the cards can be restyled without touching it.
 */
export function Guarantees() {
  return (
    <section className="relative">
      <div className="mx-auto max-w-7xl px-6 pt-28">
        <p className="text-xs font-semibold tracking-[0.3em] text-fire uppercase">
          Our promises
        </p>
        <RevealText
          as="h2"
          variant="fall"
          className="mt-6 max-w-4xl text-[clamp(2rem,5vw,4rem)]"
        >
          Three promises we put in writing
        </RevealText>
      </div>

      {/* Pulled up under the heading.
          
          The stage is a full viewport with the cards centred in it, so
          it carries half a screen of air above the first card — which
          landed directly under this heading and made the promises read
          as belonging to nothing. A negative margin closes that,
          and closes only that: the pin begins when this element reaches
          the top of the screen, so where it sits relative to the
          heading has no effect at all on the pinned view. */}
      <StackedCards className="-mt-28 px-6">
        {GUARANTEES.map((g, i) => (
          <article
            key={g.title}
            data-stack-card
            // Opaque, not translucent. These sit on top of each other: a
            // see-through card lets the one behind read straight through
            // it, so what should be a stack of objects becomes two
            // paragraphs printed on the same sheet.
            className="group relative grid w-full max-w-5xl overflow-hidden rounded-[1.75rem] bg-[#0C0B10] ring-1 ring-bone/12 shadow-[0_50px_120px_-40px_rgba(0,0,0,1)] md:grid-cols-[1.05fr_0.95fr]"
          >
            {/* Copy side. */}
            <div className="relative flex flex-col justify-between p-10 md:p-14">
              <div className="flex items-center gap-4">
                <span className="bg-fire inline-flex h-9 w-9 items-center justify-center rounded-full font-mono text-xs text-bone">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="h-px flex-1 bg-bone/15" />
                <span className="font-mono text-[0.65rem] tracking-[0.3em] text-bone/35 uppercase">
                  Promise {i + 1} / {GUARANTEES.length}
                </span>
              </div>

              <div className="mt-14 md:mt-0">
                <h3 className="text-[clamp(2rem,3.6vw,3.25rem)] leading-[0.92] font-semibold tracking-tight uppercase">
                  {g.title}
                </h3>
                <p className="mt-6 max-w-md text-lg leading-relaxed text-bone/60">
                  {g.body}
                </p>
              </div>

              <a
                href="#quote"
                className="mt-12 inline-flex w-fit items-center gap-3 border-b border-bone/20 pb-2 text-sm font-semibold tracking-wide text-bone/75 transition-colors duration-300 hover:border-fire hover:text-fire"
              >
                Get this in writing
                <span
                  aria-hidden="true"
                  className="transition-transform duration-300 group-hover:translate-x-1"
                >
                  →
                </span>
              </a>
            </div>

            {/* Photograph side. The client's own work, bled to the card's
                edge and faded into the copy so it reads as part of the
                card rather than a picture pasted onto it. */}
            <div className="relative hidden min-h-[22rem] md:block">
              <Image
                src={g.image}
                alt={g.alt}
                fill
                sizes="(min-width: 768px) 40vw, 100vw"
                className="object-cover brightness-[0.72] saturate-[0.8]"
              />
              {/* Fades the photograph into the card on its left edge, and
                  down into black at the bottom, so there is no hard
                  rectangle anywhere against the card's own surface. */}
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-linear-to-r from-[#0C0B10] via-[#0C0B10]/35 to-transparent"
              />
              <div
                aria-hidden="true"
                className="absolute inset-x-0 bottom-0 h-1/3 bg-linear-to-t from-[#0C0B10] to-transparent"
              />
              {/* The brand red, thrown across the image just enough to
                  tie it to the rest of the page. */}
              <div
                aria-hidden="true"
                className="from-fire/25 absolute inset-0 bg-linear-to-tr to-transparent mix-blend-screen"
              />
            </div>

            {/* A hairline of brand red down the card's leading edge —
                the marker the process cards and the route rail share. */}
            <span
              aria-hidden="true"
              className="bg-fire absolute inset-y-0 left-0 w-[3px]"
            />
          </article>
        ))}
      </StackedCards>
    </section>
  );
}
