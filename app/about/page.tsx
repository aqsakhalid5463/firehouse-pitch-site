import type { Metadata } from 'next';
import { Nav } from '@/components/ui/Nav';
import { Footer } from '@/components/ui/Footer';
import { AboutHero } from '@/components/sections/AboutHero';
import { Manifesto } from '@/components/sections/Manifesto';
import { Story } from '@/components/sections/Story';
import { Crew } from '@/components/sections/Crew';
import { ClosingCTA } from '@/components/sections/ClosingCTA';
import { PageField } from '@/components/ui/PageField';
import { RoadTravel } from '@/components/ui/RoadTravel';
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
        {/* The road here is the 3D highway in the background, not a
            drawn one: the copy travels away along it as you scroll.
            See components/ui/RoadTravel.tsx. */}
        <div className="relative z-10">
          <PageField />
          <RoadTravel />
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
