import { SERVICE_AREA } from "@/lib/content";
import { RevealText } from "@/components/ui/RevealText";

/**
 * Where they actually go, plus the registrations that let a visitor
 * check the business independently.
 *
 * Local movers get chosen on coverage as much as on price, and the
 * client's own site only ever said "across the state". Two rows drift
 * in opposite directions purely as CSS animation — no scroll listener
 * and no JS — so the section stays alive while off-screen work costs
 * nothing.
 *
 * Each row's list is duplicated so the translation can wrap seamlessly
 * at -50%; the duplicate is hidden from assistive tech so the city
 * names are not announced twice.
 */
function Row({
  cities,
  reverse = false,
}: {
  cities: readonly string[];
  reverse?: boolean;
}) {
  return (
    <div className="flex w-max">
      <ul
        className={`flex shrink-0 items-center gap-4 pr-4 ${
          reverse ? "animate-marquee-reverse" : "animate-marquee"
        }`}
      >
        {cities.map((c) => (
          <li
            key={c}
            className="rounded-full border border-bone/12 px-6 py-3 text-lg whitespace-nowrap text-bone/75"
          >
            {c}
          </li>
        ))}
      </ul>
      <ul
        aria-hidden="true"
        className={`flex shrink-0 items-center gap-4 pr-4 ${
          reverse ? "animate-marquee-reverse" : "animate-marquee"
        }`}
      >
        {cities.map((c) => (
          <li
            key={c}
            className="rounded-full border border-bone/12 px-6 py-3 text-lg whitespace-nowrap text-bone/75"
          >
            {c}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ServiceArea() {
  const half = Math.ceil(SERVICE_AREA.length / 2);
  const top = SERVICE_AREA.slice(0, half);
  const bottom = SERVICE_AREA.slice(half);

  return (
    <section data-ribbon-zone="circles" className="relative overflow-hidden py-32">
      <div className="mx-auto mb-16 max-w-7xl px-6">
        <p className="text-xs font-semibold tracking-[0.3em] text-fire uppercase">
          Service area
        </p>
        <RevealText
          as="h2"
          variant="rise"
          className="mt-6 max-w-3xl text-[clamp(2rem,4.5vw,3.5rem)]"
        >
          All across Dallas-Fort Worth, and out of state when you are
        </RevealText>
      </div>

      <div className="relative flex flex-col gap-4">
        {/* Fades the rows into the page colour at both edges so they
            read as continuing off-screen rather than being cut off. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-32 bg-gradient-to-r from-dark-bg to-transparent"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-32 bg-gradient-to-l from-dark-bg to-transparent"
        />
        <Row cities={top} />
        <Row cities={bottom} reverse />
      </div>
    </section>
  );
}
