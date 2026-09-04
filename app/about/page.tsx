import type { Metadata } from 'next';
import { Nav } from '@/components/ui/Nav';
import { Footer } from '@/components/ui/Footer';
import { AboutHero } from '@/components/sections/AboutHero';
import { Manifesto } from '@/components/sections/Manifesto';
import { Story } from '@/components/sections/Story';
import { Crew } from '@/components/sections/Crew';
import { ClosingCTA } from '@/components/sections/ClosingCTA';
import { PageField } from '@/components/ui/PageField';
import { RouteSpine } from '@/components/ui/RouteSpine';
import { ScrollHandoff } from '@/components/ui/ScrollHandoff';

export const metadata: Metadata = {
  title: 'About — Firehouse Movers Inc.',
  description:
    'How Firehouse Movers started, what we hold ourselves to, and the credentials behind every move.',
};

export default function About() {
  return (
    <>
      <Nav />
      <main>
        {/* About's road runs down the left margin rather than through
            the middle of the page, and the content column is inset to
            the right of it — the arrangement the home page's ribbon
            cannot use, because there the road has to thread between
            cards. Here nothing is crossed: the copy rides the road
            instead. The inset only applies from md up; on a phone
            there is no margin to give away, so the road is not drawn
            at all. */}
        <div className="relative z-10 md:pl-[15%] lg:pl-[17%]">
          <PageField />
          <RouteSpine seed={2.4} />
          <AboutHero />
          <Manifesto />
          <Story />
          <Crew />
          <ClosingCTA />
        </div>
      </main>
      <Footer />
      {/* The other end of the same chain: scrolling up off the top of
          About carries back into the home page, entered at its bottom
          so the visitor keeps going the way they were already going. */}
      <ScrollHandoff href="/" label="Home" edge="top" />
    </>
  );
}
