'use client';

import { useEffect, useRef } from 'react';
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

export function MoveAsOne() {
  const root = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!root.current) return;
    // Reduced motion starts `false` on first render (the media query is
    // read after mount), so without this guard the timeline below would
    // be created and `gsap.set(steps, { opacity: 0 })` would paint one
    // frame before this effect re-runs and reverts it — a visible flash.
    // Skip entirely once we know reduced motion is on; the steps then
    // keep their natural (visible, static) markup opacity.
    if (reduced) return;
    const ctx = gsap.context(() => {
      const steps = gsap.utils.toArray<HTMLElement>('[data-step]');

      // Each step's visible window as a fraction of the pin's own 0..1
      // progress (not the section's raw height — see note below).
      const windows: [number, number][] = [
        [0, 0.36],
        [0.32, 0.68],
        [0.64, 1.0],
      ];

      gsap.set(steps, { opacity: 0, y: 30 });

      const applyProgress = (progress: number) => {
        setMoveAsOneProgress(progress);
        steps.forEach((step, i) => {
          const [start, end] = windows[i];
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
        // Feeds the truck assembly the section's own real pin-relative
        // progress instead of it re-deriving an approximation from the
        // global page fraction (see lib/move-as-one-progress.ts).
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
      // the steps at opacity 0 / offset.
      const steps = gsap.utils.toArray<HTMLElement>('[data-step]', root.current ?? undefined);
      gsap.set(steps, { clearProps: 'opacity,y' });
      ctx.revert();
      // The truck must not render fully assembled after this section
      // unmounts (e.g. reduced motion toggled mid-scroll) — reset the
      // shared bridge value so TruckAssembly reads 0 again.
      setMoveAsOneProgress(0);
    };
  }, [reduced]);

  return (
    <section ref={root} id="process" className="relative h-[350vh] px-6">
      <div
        data-pin
        className="flex h-screen items-end pb-24"
      >
        <div className="mx-auto w-full max-w-7xl">
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
