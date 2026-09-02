'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
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
  // The pinned-scroll height only ever applies when GSAP is actually
  // driving the pin. `reduced` itself resolves synchronously on the
  // client (see use-reduced-motion.ts), which is one render ahead of the
  // server's always-false HTML — using it directly in this section's
  // className would hydrate mismatched. `collapsed` instead starts false
  // (matching the server) and is only ever set inside an effect, so the
  // dead-scroll fix lands after hydration completes.
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(reduced);
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
      const scrim = root.current!.querySelector<HTMLElement>('[data-scrim]');

      // Two windows per step, both as a fraction of the pin's own 0..1
      // progress (not the section's raw height — see note below).
      //
      // `enter` is when the step arrives. `active` is when the truck is
      // actually doing that thing, and it is deliberately aligned to the
      // real beats of the set-piece rather than chosen to look evenly
      // spaced: Pack runs across the box load-in (BoxStack's travel
      // window), Move begins as the rear door finishes closing and
      // carries the departure (EXIT_START), and Settle lands as the
      // truck clears the frame. The labels narrate the animation instead
      // of just appearing beside it.
      const enterWindows: [number, number][] = [
        [0.2, 0.36],
        [0.29, 0.45],
        [0.38, 0.54],
      ];
      const activeWindows: [number, number][] = [
        [0.3, 0.75],
        [0.75, 0.93],
        [0.93, 1.0],
      ];

      gsap.set(steps, { opacity: 0, y: 30 });

      const applyProgress = (progress: number) => {
        setMoveAsOneProgress(progress);

        // Hero copy is visible at rest and fades out as the truck takes
        // over the frame. Round 19 pulled this window earlier so the
        // copy could not still be legible while boxes swept through it.
        // Round 20 relaxed it again (0.04->0.14 became 0.10->0.26): the
        // glass panel now hugs its text rather than spanning the column,
        // so the copy occupies less width and the boxes have further to
        // travel before they reach it — which buys the text a longer
        // dwell without reintroducing the overlap. The copy is fully
        // gone by progress 0.26, still ahead of BoxStack's own travel
        // start at BOX_TRAVEL_START (0.28, see BoxStack.tsx), instead of
        // still being half-opaque while box 0 was already most of the
        // way through its sweep across the text column. This is the
        // "clean handoff": copy fades out completely, only then do the
        // boxes begin moving.
        if (hero) {
          const heroT = 1 - gsap.utils.clamp(0, 1, (progress - 0.10) / (0.26 - 0.10));
          gsap.set(hero, { opacity: heroT });
          // The scrim exists only to help the hero copy read against the
          // road; once that copy is gone (loading/departure beats) there
          // is no text left for it to protect, so it fades out with it
          // rather than dimming the rest of the set-piece.
          if (scrim) gsap.set(scrim, { opacity: heroT });
        }

        steps.forEach((step, i) => {
          const [eStart, eEnd] = enterWindows[i];
          const enter = gsap.utils.clamp(
            0,
            1,
            (progress - eStart) / (eEnd - eStart),
          );
          const [aStart, aEnd] = activeWindows[i];
          const active = gsap.utils.clamp(
            0,
            1,
            (progress - aStart) / (aEnd - aStart),
          );
          // Dim until this step's turn, full while it is happening, and
          // held slightly up afterwards — a completed step should read
          // as done, not as switched off.
          const emphasis = active >= 1 ? 0.62 : 0.42 + active * 0.58;
          gsap.set(step, { opacity: enter * emphasis, y: 26 * (1 - enter) });

          // The label's characters cascade in rather than the whole word
          // arriving at once. Each one gets its own slice of the entry
          // window, so the cascade is driven by scroll position and
          // scrubs backwards cleanly.
          const chars = step.querySelectorAll<HTMLElement>('[data-step-char]');
          chars.forEach((ch, ci) => {
            const span = 1 / (chars.length + 3);
            const cT = gsap.utils.clamp(0, 1, (enter - ci * span) / (1 - ci * span));
            gsap.set(ch, { yPercent: 100 * (1 - cT), opacity: cT });
          });

          // A rule that fills across the step while it is the live one.
          const fill = step.querySelector<HTMLElement>('[data-step-fill]');
          if (fill) gsap.set(fill, { scaleX: active });

          const num = step.querySelector<HTMLElement>('[data-step-num]');
          if (num) gsap.set(num, { opacity: 0.3 + active * 0.7 });
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
      const scrim = root.current?.querySelector<HTMLElement>('[data-scrim]');
      gsap.set(steps, { clearProps: 'opacity,y' });
      if (hero) gsap.set(hero, { clearProps: 'opacity' });
      if (scrim) gsap.set(scrim, { clearProps: 'opacity' });
      ctx.revert();
      // The truck must not render fully assembled (and the box stack must
      // not sit mid-load) after this section unmounts (e.g. reduced
      // motion toggled mid-scroll) — reset the shared bridge value so the
      // scene reads 0 again.
      setMoveAsOneProgress(0);
    };
  }, [reduced]);

  return (
    <section
      ref={root}
      className={
        collapsed
          ? 'relative min-h-screen px-6 sm:px-10 lg:px-16 xl:px-24 2xl:px-32'
          : 'relative h-[350vh] px-6 sm:px-10 lg:px-16 xl:px-24 2xl:px-32'
      }
    >
      {/* A soft dark falloff from the left edge, sitting strictly behind
          the hero copy/steps (both plain in-flow children below, so they
          paint above this negative-z, absolutely-positioned layer within
          this section's own stacking context — see the comment on
          layout.tsx for why that's already enough to keep it under the
          canvas's z-10 wrapper too). It exists to make the road/scene
          read less brightly behind the left-column text, not to be
          visible as its own shape, so it is a wide, low-opacity gradient
          rather than a hard-edged band. Its opacity is driven down in
          lockstep with the hero copy's own fade (see applyProgress
          below) so it never dims the loading/departure beats once the
          hero copy itself is gone. */}
      {/* Round 18: the via stop's 25% opacity was too weak across the
          horizontal band where the subhead extends (roughly 55% of
          viewport width) — the road's light-grey surface and lane
          markings showed straight through it, which is why the subhead
          disappeared (the client's "not as readable because of Road"
          complaint). Strengthened to 50% and pushed the via stop out to
          65% width so the darker field covers the subhead's full run,
          then falls to transparent by 90% — well short of the boxes/road
          on the right, which keep their punch. Still a soft gradient, not
          a hard-edged band, so it stays tasteful and doesn't read as a
          visible dark rectangle. */}
      <div
        data-scrim
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-r from-dark-bg/70 via-dark-bg/50 via-65% to-transparent to-90%"
      />
      <div
        data-pin
        className={
          collapsed
            ? 'relative flex flex-col gap-16 py-24'
            : 'relative flex h-screen flex-col overflow-hidden pt-[clamp(3rem,10vh,7rem)] pb-[clamp(2rem,6vh,4rem)]'
        }
      >
        {/* The hero copy gets its own flexible region so it can stay
            vertically centred within whatever space is left above the
            process block. The two live in separate grid rows — the copy
            row is `1fr` (grows/shrinks with whatever space is left) and
            the process row is `auto` (sized to its own content) — with
            a `gap` between them. A grid gap is a hard, guaranteed
            separator regardless of how tall either row's content is; a
            margin (mt-auto included) is not — it only pushes against
            genuinely leftover flex space, which is exactly what
            collapsed to zero and let "Move as One" collide with the CTA
            buttons once the copy row's own content grew to fill its
            flex-1 region (round 17 regression). `min-h-0` on the copy
            row lets it shrink below its content's natural height at
            short viewport heights rather than forcing the whole grid
            (and the gap with it) to overflow. */}
        <div
          data-pin-copy-grid
          className={
            collapsed
              ? // Reduced motion (and any other collapsed state) has no
                // h-screen pin to derive a percentage height from, and
                // needs none — content just flows normally, so this is
                // a plain stack with its own gap rather than the
                // 1fr/auto row split below.
                'grid gap-16'
              : 'grid h-full grid-rows-[1fr_auto] gap-[clamp(1rem,4vh,3.5rem)]'
          }
        >
          <div data-hero-copy className="flex min-h-0 flex-col justify-center">
            {heroCopy}
          </div>

          <div id="process" className="mx-auto w-full max-w-7xl">
            <p className="mb-10 text-xs font-semibold tracking-[0.3em] uppercase opacity-50">
              Move as One
            </p>
            <div className="grid gap-10 md:grid-cols-3">
              {STEPS.map((step, i) => (
                <div key={step.label} data-step className="max-w-xs">
                  {/* The rule sits above the step and fills left to
                      right while that step is the live one, so the three
                      of them read as a progress track across the whole
                      set-piece. */}
                  <div className="mb-5 h-px w-full origin-left bg-bone/15">
                    <div
                      data-step-fill
                      className="h-px w-full origin-left scale-x-0 bg-fire"
                    />
                  </div>
                  <div className="flex items-baseline gap-4">
                    <span
                      data-step-num
                      className="font-mono text-xs text-fire opacity-30"
                    >
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <h3 className="text-4xl font-semibold tracking-tight">
                      {/* Per-character spans so the label can cascade.
                          Each sits in its own overflow-hidden mask, so
                          characters rise out of the line rather than
                          fading in place. */}
                      {step.label.split('').map((ch, ci) => (
                        <span
                          key={`${step.label}-${ci}`}
                          className="inline-block overflow-hidden align-bottom"
                        >
                          <span data-step-char className="inline-block">
                            {ch}
                          </span>
                        </span>
                      ))}
                    </h3>
                  </div>
                  <p className="mt-4 leading-relaxed opacity-70">{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
