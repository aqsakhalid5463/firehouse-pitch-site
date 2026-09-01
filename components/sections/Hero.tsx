import { BUSINESS, HERO_HEADLINE } from '@/lib/constants';
import { RevealText } from '@/components/ui/RevealText';
import { Button } from '@/components/ui/Button';

export function Hero() {
  return (
    <section className="relative flex min-h-screen items-center px-6">
      <div className="mx-auto w-full max-w-7xl">
        <p className="mb-8 text-xs font-semibold tracking-[0.3em] uppercase opacity-60">
          Lewisville, Texas · Licensed & Insured
        </p>
        <RevealText
          as="h1"
          className="max-w-5xl text-[clamp(2.5rem,7vw,6rem)] leading-[0.95] font-semibold tracking-tight"
        >
          {HERO_HEADLINE}
        </RevealText>
        <p className="mt-8 max-w-xl text-lg leading-relaxed opacity-70">
          Local and long-distance movers for homes and offices across the DFW
          area. Packing, storage, and a crew that shows up when we said we
          would.
        </p>
        <div className="mt-12 flex flex-wrap items-center gap-4">
          <Button href="#quote">Get a Quote</Button>
          <Button href={BUSINESS.phoneHref} variant="ghost">
            {BUSINESS.phone}
          </Button>
        </div>
      </div>
    </section>
  );
}
