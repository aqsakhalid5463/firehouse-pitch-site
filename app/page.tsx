import { Nav } from '@/components/ui/Nav';
import { Footer } from '@/components/ui/Footer';
import { Opening } from '@/components/sections/Opening';
import { HeroCopy } from '@/components/sections/HeroCopy';
import { Services } from '@/components/sections/Services';
import { Guarantees } from '@/components/sections/Guarantees';
import { Testimonials } from '@/components/sections/Testimonials';
import { ClosingCTA } from '@/components/sections/ClosingCTA';

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Opening heroCopy={<HeroCopy />} />
        <Services />
        <Guarantees />
        <Testimonials />
        <ClosingCTA />
      </main>
      <Footer />
    </>
  );
}
