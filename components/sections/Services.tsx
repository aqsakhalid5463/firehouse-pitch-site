import { SERVICES } from '@/lib/content';
import { RevealText } from '@/components/ui/RevealText';
import { TiltCard } from '@/components/ui/TiltCard';

export function Services() {
  return (
    <section id="services" className="relative px-6 py-32">
      <div className="mx-auto max-w-7xl">
        <RevealText
          as="h2"
          className="max-w-3xl text-[clamp(2rem,4.5vw,3.5rem)] leading-tight font-semibold tracking-tight"
        >
          Everything a move needs, under one roof
        </RevealText>
        <div className="mt-20 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((service, i) => (
            <TiltCard
              key={service.title}
              className={i % 4 === 0 ? 'lg:row-span-1 lg:mt-12' : ''}
            >
              <div className="p-8">
                <span className="text-xs font-semibold tracking-[0.2em] opacity-40">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h3 className="mt-6 text-2xl font-semibold">{service.title}</h3>
                <p className="mt-4 leading-relaxed opacity-70">{service.body}</p>
              </div>
            </TiltCard>
          ))}
        </div>
      </div>
    </section>
  );
}
