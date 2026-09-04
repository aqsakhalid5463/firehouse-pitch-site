import { TransitionLink } from '@/components/ui/RouteTransition';
import { BUSINESS } from '@/lib/constants';

export function Footer() {
  return (
    <footer className="relative border-t border-current/15 px-6 py-16">
      <div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-3">
        <div>
          <p className="text-sm font-bold tracking-[0.2em] uppercase">
            {BUSINESS.name}
          </p>
          <p className="mt-4 text-sm leading-relaxed opacity-60">
            {BUSINESS.address}
          </p>
        </div>
        <div className="text-sm">
          <a href={BUSINESS.phoneHref} className="block hover:opacity-70">
            {BUSINESS.phone}
          </a>
          <a
            href={`mailto:${BUSINESS.email}`}
            className="mt-2 block hover:opacity-70"
          >
            {BUSINESS.email}
          </a>
        </div>
        <div className="text-sm">
          <TransitionLink href="/" className="block hover:opacity-70">
            Home
          </TransitionLink>
          <TransitionLink href="/about" className="mt-2 block hover:opacity-70">
            About
          </TransitionLink>
        </div>
      </div>
      <p className="mx-auto mt-12 max-w-7xl text-xs opacity-40">
        © {new Date().getFullYear()} {BUSINESS.name}. Licensed and insured for
        interstate moving.
      </p>
    </footer>
  );
}
