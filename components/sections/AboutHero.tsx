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
          We started this because we needed it ourselves
        </RevealText>
        <p className="mt-8 max-w-xl text-lg leading-relaxed opacity-70">
          Firehouse Movers began with one truck, one crew, and one rule: show up
          when you said you would. Everything since has been built on that.
        </p>
      </div>
    </section>
  );
}
