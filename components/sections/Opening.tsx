'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { setMoveAsOneProgress } from '@/lib/move-as-one-progress';

gsap.registerPlugin(ScrollTrigger);

const STEPS = [
  { label: 'Pack', body: 'Every item wrapped, boxed, and logged before it moves an inch.' },
  { label: 'Move', body: 'Loaded tight, driven careful, tracked the whole way.' },
  { label: 'Settle', body: 'Unloaded and placed where you want it, not just inside the door.' },
];

/**
 * The opening set-piece: hero copy, then the truck assembling and loading
 * with the hero's own box stack, then the truck driving off. This is one
 * pinned section (not Hero followed by a separate Move-as-One section) so
 * the hero's boxes can visibly become the truck's cargo instead of two
 * unrelated beats stitched together.
 *
 * `heroCopy` is composed in from the server-component page tree rather
 * than written inline here — see the comment on HeroCopy for why.
 */
export function Opening({ heroCopy }: { heroCopy: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!root.current) return;
    // Reduced motion starts `false` on first render (the media query is
    // read after mount), so without this guard the timeline below would
    // be created and the opacity sets below would paint one frame before
    // this effect re-runs and reverts it — a visible flash. Skip entirely
    // once we know reduced motion is on; the copy then keeps its natural
    // (visible, static) markup opacity.
    if (reduced) return;
    const ctx = gsap.context(() => {
      const steps = gsap.utils.toArray<HTMLElement>('[data-step]');
      const hero = root.current!.querySelector<HTMLElement>('[data-hero-copy]');

      // Each step's visible window as a fraction of the pin's own 0..1
      // progress (not the section's raw height — see note below).
      const stepWindows: [number, number][] = [
        [0.4, 0.62],
        [0.5, 0.72],
        [0.6, 0.85],
      ];

      gsap.set(steps, { opacity: 0, y: 30 });

      const applyProgress = (progress: number) => {
        setMoveAsOneProgress(progress);

        // Hero copy is visible at rest and fades out as the truck takes
        // over the frame, fully gone before the boxes finish loading.
        if (hero) {
          const heroT = 1 - gsap.utils.clamp(0, 1, (progress - 0.18) / (0.4 - 0.18));
          gsap.set(hero, { opacity: heroT });
        }

        steps.forEach((step, i) => {
          const [start, end] = stepWindows[i];
          const t = gsap.utils.clamp(0, 1, (progress - start) / (end - start));
          gsap.set(step, { opacity: t, y: 30 * (1 - t) });
        });
      };

      const trigger = ScrollTrigger.create({
        trigger: root.current,
        start: 'top top',
        end: '+=250%',
        pin: '[data-pin]',
        scrub: true,
        // Feeds the truck assembly (and the box stack's load-in) the
        // section's own real pin-relative progress instead of them
        // re-deriving an approximation from the global page fraction
        // (see lib/move-as-one-progress.ts).
        //
        // The step labels are driven from this same callback rather than
        // their own percentage-based ScrollTriggers: a percentage offset
        // like `top+=80% top` resolves against the *trigger element's*
        // height (this section's 350vh), not the pin's 250vh scroll
        // distance, so triggers built that way fire well after the pin
        // has already released and never become visible. Tying opacity
        // directly to the pin's progress keeps the labels perfectly
        // synced to the truck, which reads the same progress.
        onUpdate: (self) => applyProgress(self.progress),
      });
      applyProgress(trigger.progress);
    }, root);
    return () => {
      // `gsap.set` calls inside `applyProgress` fire from ScrollTrigger's
      // `onUpdate`, outside gsap.context's synchronous collection window,
      // so ctx.revert() does not know about them and won't undo them.
      // Clear the inline styles it left behind explicitly, or toggling
      // reduced motion mid-scroll (or unmounting mid-scroll) can strand
      // the copy/steps at opacity 0 / offset.
      const steps = gsap.utils.toArray<HTMLElement>('[data-step]', root.current ?? undefined);
      const hero = root.current?.querySelector<HTMLElement>('[data-hero-copy]');
      gsap.set(steps, { clearProps: 'opacity,y' });
      if (hero) gsap.set(hero, { clearProps: 'opacity' });
      ctx.revert();
      // The truck must not render fully assembled (and the box stack must
      // not sit mid-load) after this section unmounts (e.g. reduced
      // motion toggled mid-scroll) — reset the shared bridge value so the
      // scene reads 0 again.
      setMoveAsOneProgress(0);
    };
  }, [reduced]);

  return (
    <section ref={root} className="relative h-[350vh] px-6">
      <div data-pin className="relative flex h-screen flex-col justify-center overflow-hidden pb-24">
        <div data-hero-copy>{heroCopy}</div>

        <div id="process" className="mx-auto mt-auto w-full max-w-7xl">
          <p className="mb-10 text-xs font-semibold tracking-[0.3em] uppercase opacity-50">
            Move as One
          </p>
          <div className="grid gap-10 md:grid-cols-3">
            {STEPS.map((step) => (
              <div key={step.label} data-step className="max-w-xs">
                <h3 className="text-4xl font-semibold tracking-tight">
                  {step.label}
                </h3>
                <p className="mt-4 leading-relaxed opacity-70">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
