import { SERVICES } from '@/lib/content';
import { RevealText } from '@/components/ui/RevealText';
import { ServiceCard } from '@/components/ui/ServiceCard';

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

        {/* Two wide columns rather than a three-up grid, with the right
            column dropped half a card. The offset is what lets the
            ribbon thread between the columns instead of running behind
            a solid wall of cards, and it keeps the eye moving down the
            page in a zigzag instead of scanning flat rows. */}
        <div className="mt-24 grid gap-x-12 gap-y-20 md:grid-cols-2">
          {SERVICES.map((service, i) => (
            <div key={service.title} className={i % 2 === 1 ? 'md:mt-28' : ''}>
              <ServiceCard
                index={i}
                title={service.title}
                body={service.body}
                image={service.image}
                alt={service.alt}
                priority={i < 2}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
