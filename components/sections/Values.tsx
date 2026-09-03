import { VALUES } from "@/lib/content";
import { RevealText } from "@/components/ui/RevealText";
import { TiltCard } from "@/components/ui/TiltCard";
import { FadeUp } from "@/components/ui/FadeUp";

export function Values() {
  return (
    <section className="relative px-6 py-32">
      <div className="mx-auto max-w-7xl">
        <RevealText
          as="h2"
          variant="rise"
          className="max-w-3xl text-[clamp(2rem,4.5vw,3.5rem)] leading-tight font-semibold tracking-tight"
        >
          What you actually get
        </RevealText>
        <FadeUp stagger className="mt-20 grid gap-6 md:grid-cols-2">
          {VALUES.map((value) => (
            <TiltCard key={value.title}>
              <div className="p-8">
                <RevealText
                  as="h3"
                  variant="rise"
                  className="text-2xl font-semibold"
                >
                  {value.title}
                </RevealText>
                <p className="mt-4 leading-relaxed opacity-70">{value.body}</p>
              </div>
            </TiltCard>
          ))}
        </FadeUp>
      </div>
    </section>
  );
}
