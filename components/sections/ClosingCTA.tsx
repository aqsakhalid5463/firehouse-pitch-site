import { BUSINESS } from "@/lib/constants";
import { RevealText } from "@/components/ui/RevealText";
import { MagneticButton } from "@/components/ui/MagneticButton";
import { FadeUp } from "@/components/ui/FadeUp";
import { GlassPanel } from "@/components/ui/GlassPanel";

/**
 * The closing call to action.
 *
 * This used to lead with a "1,000,000" counter. That number came from
 * the client's existing site, where it sits next to "Join thousands of
 * firehouses already transforming their operations" — unedited SaaS
 * template filler that was never a claim about this moving company. It
 * is replaced here with the registrations from their own truck livery,
 * which a visitor can actually look up. If the client wants a headline
 * number, it should be one they can stand behind.
 */
export function ClosingCTA() {
  return (
    <section id="quote" className="relative px-6 py-40">
      <div className="mx-auto max-w-4xl text-center">
        <RevealText
          as="h2"
          variant="fall"
          className="text-[clamp(2.5rem,7vw,5.5rem)] leading-[1.02] font-semibold tracking-tight"
        >
          Tell us what you are moving. We will tell you what it takes.
        </RevealText>

        <FadeUp delay={0.15}>
          <GlassPanel className="mx-auto mt-8">
            <p className="max-w-xl text-lg leading-relaxed text-bone/60">
              A written number, a crew sized to the job, and a delivery window
              we commit to in writing. Trained movers, uniformed and insured,
              out of {BUSINESS.city} — across town or across the country.
            </p>
          </GlassPanel>
        </FadeUp>

        <FadeUp
          delay={0.25}
          className="mt-12 flex flex-wrap justify-center gap-4"
        >
          <MagneticButton href={BUSINESS.phoneHref}>
            Call {BUSINESS.phone}
          </MagneticButton>
          <MagneticButton href={`mailto:${BUSINESS.email}`} variant="ghost">
            Send a quote
          </MagneticButton>
        </FadeUp>
      </div>
    </section>
  );
}
