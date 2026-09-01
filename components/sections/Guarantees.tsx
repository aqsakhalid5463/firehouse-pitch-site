import { GUARANTEES } from '@/lib/content';
import { RevealText } from '@/components/ui/RevealText';

export function Guarantees() {
  return (
    <section className="relative px-6 py-40">
      <div className="mx-auto max-w-7xl">
        <RevealText
          as="h2"
          className="max-w-4xl text-[clamp(2rem,5vw,4rem)] leading-[1.05] font-semibold tracking-tight"
        >
          Three promises we put in writing
        </RevealText>
        <div className="mt-24">
          {GUARANTEES.map((g, i) => (
            <div
              key={g.title}
              className="grid gap-6 border-t border-current/15 py-12 md:grid-cols-12"
            >
              <span className="text-xs font-semibold tracking-[0.2em] opacity-40 md:col-span-2">
                {String(i + 1).padStart(2, '0')}
              </span>
              <h3 className="text-3xl font-semibold tracking-tight md:col-span-4">
                {g.title}
              </h3>
              <p className="text-lg leading-relaxed opacity-70 md:col-span-6">
                {g.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
