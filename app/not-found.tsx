import { Nav } from '@/components/ui/Nav';
import { Footer } from '@/components/ui/Footer';
import { Button } from '@/components/ui/Button';
import { BUSINESS } from '@/lib/constants';

export default function NotFound() {
  return (
    <>
      <Nav />
      <main className="flex min-h-[70vh] items-center px-6 pt-32">
        <div className="mx-auto w-full max-w-7xl">
          <p className="text-xs font-semibold tracking-[0.3em] uppercase opacity-50">
            404
          </p>
          <h1 className="mt-6 text-[clamp(2rem,6vw,4.5rem)] leading-tight font-semibold tracking-tight">
            This one did not make it onto the truck
          </h1>
          <div className="mt-10 flex flex-wrap gap-4">
            <Button href="/">Back home</Button>
            <Button href={BUSINESS.phoneHref} variant="ghost">
              {BUSINESS.phone}
            </Button>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
