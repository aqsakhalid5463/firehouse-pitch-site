import { Nav } from '@/components/ui/Nav';
import { Footer } from '@/components/ui/Footer';
import { Hero } from '@/components/sections/Hero';
import { Services } from '@/components/sections/Services';
import { MoveAsOne } from '@/components/sections/MoveAsOne';
import { Guarantees } from '@/components/sections/Guarantees';
import { Testimonials } from '@/components/sections/Testimonials';
import { ClosingCTA } from '@/components/sections/ClosingCTA';

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Services />
        <MoveAsOne />
        <Guarantees />
        <Testimonials />
        <ClosingCTA />
      </main>
      <Footer />
    </>
  );
}
