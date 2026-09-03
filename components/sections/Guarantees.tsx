import { GUARANTEES } from "@/lib/content";
import { RevealText } from "@/components/ui/RevealText";
import { FadeUp } from "@/components/ui/FadeUp";
import { GlassPanel } from "@/components/ui/GlassPanel";

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
        {/* The rows used to appear with no transition while the heading
            above them animated in, which drew attention to the join. */}
        <FadeUp stagger className="mt-24">
          {GUARANTEES.map((g, i) => (
            <div
              key={g.title}
              className="grid gap-6 border-t border-current/15 py-12 md:grid-cols-12"
            >
              <span className="text-xs font-semibold tracking-[0.2em] opacity-40 md:col-span-2">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="text-3xl font-semibold tracking-tight md:col-span-4">
                {g.title}
              </h3>
              <GlassPanel className="md:col-span-6">
                <p className="text-lg leading-relaxed opacity-70">{g.body}</p>
              </GlassPanel>
            </div>
          ))}
        </FadeUp>
      </div>
    </section>
  );
}
