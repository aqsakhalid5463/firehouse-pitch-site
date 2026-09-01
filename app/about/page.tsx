import type { Metadata } from 'next';
import { Nav } from '@/components/ui/Nav';
import { Footer } from '@/components/ui/Footer';
import { AboutHero } from '@/components/sections/AboutHero';
import { Story } from '@/components/sections/Story';
import { Values } from '@/components/sections/Values';
import { Credentials } from '@/components/sections/Credentials';
import { ClosingCTA } from '@/components/sections/ClosingCTA';

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
        <AboutHero />
        <Story />
        <Values />
        <Credentials />
        <ClosingCTA />
      </main>
      <Footer />
    </>
  );
}
