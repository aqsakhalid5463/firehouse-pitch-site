import { RevealText } from '@/components/ui/RevealText';

export function AboutHero() {
  return (
    <section className="relative flex min-h-[80vh] items-center px-6 pt-32">
      <div className="mx-auto w-full max-w-7xl">
        <p className="mb-8 text-xs font-semibold tracking-[0.3em] uppercase opacity-60">
          About us
        </p>
        <RevealText
          as="h1"
          className="max-w-4xl text-[clamp(2.25rem,6vw,5rem)] leading-[1] font-semibold tracking-tight"
        >
          The moving service we needed, so we built it for you
        </RevealText>
        {/* The headline is the client's own tagline, and this paragraph
            paraphrases their own description of the business. The
            previous version invented a founding story — one truck, one
            crew — that they never told us. */}
        <p className="mt-8 max-w-xl text-lg leading-relaxed opacity-70">
          A growing franchise moving company in Lewisville, Texas, offering a
          full range of services to households and businesses across
          Dallas-Fort Worth and beyond. We are here to take the stress out of
          relocating.
        </p>
      </div>
    </section>
  );
}
