import { Nav } from '@/components/ui/Nav';
import { Footer } from '@/components/ui/Footer';
import { Opening } from '@/components/sections/Opening';
import { HeroCopy } from '@/components/sections/HeroCopy';
import { Services } from '@/components/sections/Services';
import { Guarantees } from '@/components/sections/Guarantees';
import { Testimonials } from '@/components/sections/Testimonials';
import { ClosingCTA } from '@/components/sections/ClosingCTA';
import { Process } from '@/components/sections/Process';
import { ServiceArea } from '@/components/sections/ServiceArea';
import { Faq } from '@/components/sections/Faq';
import { SceneAudio } from '@/components/scene/SceneAudio';
import { Ribbon } from '@/components/ui/Ribbon';
import { PageField } from '@/components/ui/PageField';

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Opening heroCopy={<HeroCopy />} />
        <SceneAudio />
        {/* Everything after the pinned opening shares one background
            world: the ribbon threading between sections, over the
            drifting field. Both are absolutely positioned against this
            wrapper, so the ribbon's path spans exactly the run of the
            page it is meant to connect. */}
        <div className="relative z-10">
          <PageField />
          {/* Seeded so Home and About get visibly different roads. */}
          <Ribbon seed={918273} />
          <Services />
          <Process />
          <Guarantees />
          <ServiceArea />
          <Testimonials />
          <Faq />
          <ClosingCTA />
        </div>
      </main>
      <Footer />
    </>
  );
}
