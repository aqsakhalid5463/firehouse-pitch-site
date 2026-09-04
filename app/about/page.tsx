import type { Metadata } from 'next';
import { Nav } from '@/components/ui/Nav';
import { Footer } from '@/components/ui/Footer';
import { AboutHero } from '@/components/sections/AboutHero';
import { Manifesto } from '@/components/sections/Manifesto';
import { Story } from '@/components/sections/Story';
import { Crew } from '@/components/sections/Crew';
import { Network } from '@/components/sections/Network';
import { ClosingCTA } from '@/components/sections/ClosingCTA';
import { Ribbon } from '@/components/ui/Ribbon';
import { PageField } from '@/components/ui/PageField';
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
        {/* Same background world as the home page: About has no 3D
            set-piece of its own, so the ribbon starts at the top and
            carries the whole page rather than picking up from a road. */}
        <div className="relative z-10">
          <PageField />
          {/* A different seed from the home page's, so the two pages do
              not repeat the same road. */}
          <Ribbon seed={5512094} />
          <AboutHero />
          <Manifesto />
          <Story />
          <Network />
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
