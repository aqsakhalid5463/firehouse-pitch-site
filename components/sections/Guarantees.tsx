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
      <div className="mx-auto max-w-7xl px-6 pt-40">
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

      <StackedCards className="mt-16 px-6">
        {GUARANTEES.map((g, i) => (
          <article
            key={g.title}
            data-stack-card
            // Opaque, not translucent. These sit on top of each other:
            // a see-through card lets the one behind read straight
            // through it, so what should be a stack of objects becomes
            // two paragraphs printed on the same sheet. The gradient is
            // painted over an opaque base instead, and the cards behind
            // are seen by their edges — which is what makes it a stack.
            className="group relative flex w-full max-w-3xl flex-col overflow-hidden rounded-[2rem] border border-bone/12 bg-[#0E0D12] bg-linear-to-br from-bone/[0.07] to-transparent p-10 shadow-[0_40px_100px_-40px_rgba(0,0,0,1)] md:p-16"
          >
            {/* A red rule across the top, the same marker the process
                cards and the route rail use. */}
            <span
              aria-hidden="true"
              className="bg-fire absolute inset-x-0 top-0 h-[3px]"
            />

            <div className="flex items-start justify-between gap-8">
              <span className="font-mono text-sm text-fire">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="font-mono text-xs tracking-[0.3em] text-bone/35 uppercase">
                Promise
              </span>
            </div>

            <h3 className="mt-10 text-[clamp(2rem,4.4vw,3.5rem)] leading-[0.95] font-semibold tracking-tight uppercase">
              {g.title}
            </h3>

            <p className="mt-8 max-w-xl text-lg leading-relaxed text-bone/65 md:text-xl">
              {g.body}
            </p>

            <a
              href="#quote"
              className="mt-12 inline-flex w-fit items-center gap-3 text-sm font-semibold tracking-wide text-bone/70 transition-colors duration-300 hover:text-fire"
            >
              Get this in writing
              <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">
                →
              </span>
            </a>

            {/* The promise number again, enormous and nearly invisible,
                filling the space a card this size would otherwise leave
                empty. */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -right-6 -bottom-16 text-[14rem] leading-none font-semibold tracking-tighter text-bone/[0.04]"
            >
              {String(i + 1).padStart(2, '0')}
            </span>
          </article>
        ))}
      </StackedCards>
    </section>
  );
}
