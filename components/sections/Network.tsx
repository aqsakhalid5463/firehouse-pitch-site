import { PARTNERS, NETWORK_MARQUEE } from '@/lib/content';
import { RevealText } from '@/components/ui/RevealText';
import { FadeUp } from '@/components/ui/FadeUp';

/**
 * Who stands behind the move.
 *
 * Replaces the two card grids that were here — one listing what you get,
 * one listing credentials — which said what any mover's site says. This
 * says something only this company can: that the fleet is on a named
 * maintenance programme and that the after-work is done by a sister
 * company rather than a subcontractor.
 */
export function Network() {
  return (
    <section data-ribbon-zone="drift" className="relative px-6 py-32">
      <div className="mx-auto max-w-7xl">
        {/* The band. Duplicated once and translated by half its own
            width, which is what makes a marquee loop seamlessly — the
            copy scrolls into exactly where the original was. Hidden
            from screen readers on the second pass so the names are not
            announced twice. */}
        <div className="relative mb-24 flex overflow-hidden border-y border-bone/12 py-6">
          {[0, 1].map((pass) => (
            <div
              key={pass}
              data-network-marquee
              aria-hidden={pass === 1 ? 'true' : undefined}
              // The same class the service-area band uses, rather than a
              // second definition of the same animation: it already
              // translates by exactly -100% of one copy's width, which
              // is what makes two identical copies loop seamlessly, and
              // it is already switched off under reduced motion.
              className="animate-marquee flex shrink-0 items-baseline gap-16 pr-16"
            >
              {NETWORK_MARQUEE.map((entry) => (
                <span key={entry.name} className="flex items-baseline gap-3">
                  <span className="text-sm font-bold tracking-[0.2em] whitespace-nowrap uppercase">
                    {entry.name}
                  </span>
                  <span className="font-mono text-[0.65rem] tracking-[0.18em] whitespace-nowrap uppercase opacity-45">
                    {entry.role}
                  </span>
                </span>
              ))}
            </div>
          ))}
        </div>

        <p className="text-xs font-semibold tracking-[0.3em] text-fire uppercase">
          The network
        </p>
        <RevealText
          as="h2"
          variant="fall"
          className="mt-6 max-w-3xl text-[clamp(2rem,4.5vw,3.5rem)]"
        >
          Who stands behind the move.
        </RevealText>
        <FadeUp delay={0.15}>
          <p className="mt-8 max-w-2xl text-lg leading-relaxed opacity-60">
            Firehouse doesn&rsquo;t stop at the truck. These are the partners
            that keep every job running the way it should.
          </p>
        </FadeUp>

        <FadeUp stagger className="mt-20 grid gap-10 md:grid-cols-2">
          {PARTNERS.map((partner) => (
            <article
              key={partner.title}
              data-partner
              className="border-t border-bone/15 pt-6"
            >
              <p className="font-mono text-[0.65rem] tracking-[0.24em] text-fire uppercase">
                {partner.label}
              </p>
              {/* Animated like every other heading on the page. A
                  plain h3 here would leave the section going flat
                  below its title, which is the bug the sub-heading
                  test exists to catch. */}
              <RevealText
                as="h3"
                variant="flip"
                className="mt-4 text-[clamp(1.25rem,2.4vw,1.75rem)] leading-tight font-medium"
              >
                {partner.title}
              </RevealText>
              <p className="mt-4 max-w-md leading-relaxed opacity-60">
                {partner.body}
              </p>
            </article>
          ))}
        </FadeUp>
      </div>
    </section>
  );
}
