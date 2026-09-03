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
          className="text-[clamp(2.5rem,7vw,5.5rem)] leading-[1.02] font-semibold tracking-tight"
        >
          Tell us what is moving. We will tell you what it costs.
        </RevealText>

        <FadeUp delay={0.15}>
          <GlassPanel className="mx-auto mt-8">
            <p className="max-w-xl text-lg leading-relaxed text-bone/60">
              A written quote, a crew sized to the job, and a delivery window we
              commit to. Local or long-distance, out of {BUSINESS.city}.
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
            Email us
          </MagneticButton>
        </FadeUp>

        <p className="mt-14 font-mono text-xs tracking-wider text-bone/40">
          {BUSINESS.usdot} · {BUSINESS.txdmv} · Licensed &amp; insured
        </p>
      </div>
    </section>
  );
}
