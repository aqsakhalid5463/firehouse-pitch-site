import { BUSINESS } from '@/lib/constants';
import { RevealText } from '@/components/ui/RevealText';
import { Counter } from '@/components/ui/Counter';
import { Button } from '@/components/ui/Button';

export function ClosingCTA() {
  return (
    <section id="quote" className="relative px-6 py-40">
      <div className="mx-auto max-w-7xl text-center">
        <p className="text-[clamp(3rem,10vw,8rem)] leading-none font-semibold tracking-tight">
          <Counter to={1000000} />
        </p>
        <RevealText
          as="h2"
          className="mt-6 text-[clamp(1.5rem,3vw,2.5rem)] font-semibold tracking-tight"
        >
          moves behind us. Yours is next.
        </RevealText>
        <div className="mt-12 flex flex-wrap justify-center gap-4">
          <Button href={BUSINESS.phoneHref}>Call {BUSINESS.phone}</Button>
          <Button href={`mailto:${BUSINESS.email}`} variant="ghost">
            Email us
          </Button>
        </div>
      </div>
    </section>
  );
}
