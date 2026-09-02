import Image from 'next/image';
import Link from 'next/link';
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
          <Link href="/" className="hidden sm:inline hover:opacity-70">
            Home
          </Link>
          <Link href="/about" className="hidden sm:inline hover:opacity-70">
            About
          </Link>
          <a href={BUSINESS.phoneHref} className="hover:opacity-70">
            {BUSINESS.phone}
          </a>
          <SoundToggle />
        </div>
      </nav>
    </header>
  );
}
