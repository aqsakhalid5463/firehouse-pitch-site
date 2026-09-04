import Image from 'next/image';
import Link from 'next/link';
import { TransitionLink } from '@/components/ui/RouteTransition';
import { BUSINESS } from '@/lib/constants';
import { SoundToggle } from '@/components/ui/SoundToggle';

export function Nav() {
  return (
    // The nav floats over whatever is beneath it — the 3D scene at the
    // top, then photographs and headings further down — so it carries
    // its own scrim. Without it the links collided illegibly with the
    // service headings and card images.
    <header
      className="fixed inset-x-0 top-0 z-50 bg-gradient-to-b from-dark-bg/85 via-dark-bg/50 to-transparent pb-4 backdrop-blur-[2px]"
      style={{ color: 'var(--page-ink)' }}
    >
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <Link href="/" className="flex items-center gap-2.5">
          {/* The official badge. It is white-on-red artwork, so it needs
              no plate behind it on the dark nav. */}
          <Image
            src="/fire_house_logo.svg"
            alt=""
            width={30}
            height={30}
            priority
            className="size-[30px]"
          />
          <span className="text-sm font-bold tracking-[0.2em] uppercase">
            Firehouse
          </span>
        </Link>
        <div className="flex items-center gap-8 text-sm">
          {/* These two are the only in-site routes, and the only links
              that close the bay door on the way out. The logo above is a
              plain Link on purpose: it is also the home link, but it is
              hit reflexively and mid-scroll, where a 1.5s cover reads as
              the site hanging rather than as a transition. */}
          <TransitionLink href="/" className="hidden sm:inline hover:opacity-70">
            Home
          </TransitionLink>
          <TransitionLink
            href="/about"
            className="hidden sm:inline hover:opacity-70"
          >
            About
          </TransitionLink>
          <a href={BUSINESS.phoneHref} className="hover:opacity-70">
            {BUSINESS.phone}
          </a>
          <SoundToggle />
        </div>
      </nav>
    </header>
  );
}
