import { TransitionLink } from '@/components/ui/RouteTransition';
import { GlyphField } from '@/components/ui/GlyphField';
import { BUSINESS } from '@/lib/constants';

/**
 * The footer, and the field of cartons it stands in.
 *
 * The field used to sit behind the closing CTA, where it tangled with
 * the ribbon road running through that section — two dense patterns in
 * the same space, each making the other harder to read. Down here it
 * has the page to itself: the road has already driven off the edge by
 * the time the footer starts, so the marks are the only thing in the
 * frame and the tide reads as the end of the page rather than as
 * texture over the middle of it.
 *
 * The footer is taller than a footer needs to be, and that is the
 * point. It is now a closing panel with room for the field to actually
 * pour in — at the old height there was nowhere for a surface and a
 * depth to happen.
 */
export function Footer() {
  return (
    // Opaque, unlike every other section on the page. The persistent
    // WebGL scene is a fixed background layer and everything above it
    // is transparent, so the 3D highway was still drawing its lane
    // markings straight through the field down here — the same
    // collision of two patterns that made this unreadable behind the
    // closing CTA, just moved. The footer is the end of the page and
    // has nothing to gain from the scene behind it.
    <footer className="relative overflow-hidden border-t border-current/15 bg-dark-bg px-6 pt-40 pb-16">
      <GlyphField className="pointer-events-none absolute inset-0 h-full w-full" />
      <div className="relative mx-auto grid max-w-7xl gap-10 md:grid-cols-3">
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
      <p className="relative mx-auto mt-16 max-w-7xl text-xs opacity-40">
        © {new Date().getFullYear()} {BUSINESS.name}. Licensed and insured for
        interstate moving.
      </p>
    </footer>
  );
}
