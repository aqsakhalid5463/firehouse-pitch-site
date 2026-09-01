import { Nav } from '@/components/ui/Nav';
import { Hero } from '@/components/sections/Hero';
import { Services } from '@/components/sections/Services';

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Services />
        {/* Remaining sections land in Tasks 9-11. */}
        <div className="h-screen" />
      </main>
    </>
  );
}
