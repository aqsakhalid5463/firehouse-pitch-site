import { Nav } from '@/components/ui/Nav';
import { Hero } from '@/components/sections/Hero';
import { Services } from '@/components/sections/Services';
import { MoveAsOne } from '@/components/sections/MoveAsOne';

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Services />
        <MoveAsOne />
        {/* Remaining sections land in Tasks 10-11. */}
      </main>
    </>
  );
}
