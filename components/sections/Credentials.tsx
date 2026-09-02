import { BUSINESS } from '@/lib/constants';
import { RevealText } from '@/components/ui/RevealText';

const CREDENTIALS = [
  {
    title: 'Federally licensed',
    body: 'Licensed for interstate moving, so we can follow you out of Texas, not just across it.',
  },
  {
    title: 'Fully insured',
    body: 'Coverage on every move, every crew, every item on the inventory.',
  },
  {
    title: 'Climate-controlled storage',
    body: 'Our own facility, with inventory tracking on every item that goes in.',
  },
];

export function Credentials() {
  return (
    <section className="relative px-6 py-32">
      <div className="mx-auto max-w-7xl">
        <RevealText
          as="h2"
          className="text-[clamp(1.75rem,4vw,3rem)] font-semibold tracking-tight"
        >
          Credentials that matter on moving day
        </RevealText>
        <div className="mt-16 grid gap-12 md:grid-cols-3">
          {CREDENTIALS.map((c) => (
            <div key={c.title} className="border-t border-current/15 pt-6">
              <h3 className="text-xl font-semibold">{c.title}</h3>
              <p className="mt-3 leading-relaxed opacity-70">{c.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-16 space-y-3 text-sm opacity-50">
          <p>
            {BUSINESS.name} · {BUSINESS.address}
          </p>
          {/* Public registrations, so the licensing claims above are
              checkable rather than asserted. */}
          <p className="font-mono tracking-wider">
            {BUSINESS.usdot} · {BUSINESS.txdmv}
          </p>
        </div>
      </div>
    </section>
  );
}
