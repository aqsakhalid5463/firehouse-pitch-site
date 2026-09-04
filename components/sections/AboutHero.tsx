import { ABOUT } from "@/lib/content";
import { RevealText } from "@/components/ui/RevealText";
import { FadeUp } from "@/components/ui/FadeUp";

export function AboutHero() {
  return (
    <section className="relative flex min-h-[80vh] items-center px-6 pt-32">
      {/* Rides the road. A wrapper of its own rather than the
          animated elements inside it: the entrance tweens write their
          own transforms, and two writers on one element fight. */}
      <div data-route-rider className="mx-auto w-full max-w-7xl">
        <p className="mb-8 font-mono text-[0.7rem] tracking-[0.24em] uppercase opacity-45">
          {ABOUT.eyebrow}
        </p>
        <RevealText
          as="h1"
          variant="flip"
          className="max-w-4xl text-[clamp(2.25rem,6vw,5rem)] "
        >
          {ABOUT.headline}
        </RevealText>
        {/* The client's own About copy, taken from their reference
            build. It used to open with the tagline off their home page,
            which is a statement about the service rather than about who
            is behind it — the question this page exists to answer. An
            earlier version than that invented a founding story they
            never told us. */}
        <FadeUp delay={0.3}>
          <p className="mt-8 max-w-2xl text-lg leading-relaxed opacity-70">
            {ABOUT.intro}
          </p>
        </FadeUp>
      </div>
    </section>
  );
}
