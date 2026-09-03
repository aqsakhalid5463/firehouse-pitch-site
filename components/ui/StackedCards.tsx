'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useReducedMotion } from '@/lib/use-reduced-motion';

gsap.registerPlugin(ScrollTrigger);

/**
 * A scroll-driven 3D card stack.
 *
 * The section pins and the cards occupy depth layers rather than a
 * grid: the active card sits at the front, the ones behind it recede
 * into the stack, and the ones already read lift up and out of frame.
 * Scrolling moves a continuous position through the stack, so the cards
 * are always part-way between states rather than snapping between them,
 * and it reads the same in both directions.
 *
 * This component owns the motion and nothing else. Cards are passed in
 * as children and marked with `data-stack-card`; their content, type and
 * styling are entirely the caller's, so the same motion can be reused
 * for a different kind of card without touching this file.
 *
 * Two things keep it smooth rather than merely scroll-linked:
 *
 *  - Position is eased toward the scroll's own value every frame rather
 *    than being read straight off it, which gives the stack weight and
 *    means a flick of the wheel arrives as momentum instead of a jump.
 *  - Scroll velocity feeds a small extra tilt that decays on its own, so
 *    the stack leans into fast scrolling and settles when it stops.
 *
 * Nothing here goes through React state: the scroll handler writes to a
 * ref and one ticker writes transforms, so a scroll costs no renders.
 */
export function StackedCards({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  // Below this the stack falls back to a plain vertical list: a pinned
  // 3D stack on a phone means a section the reader cannot scroll past
  // at the exact moment their gesture is least precise.
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const sync = () => setEnabled(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    if (reduced || !enabled || !root.current || !stage.current) return;

    const ctx = gsap.context(() => {
      const cards = gsap.utils.toArray<HTMLElement>('[data-stack-card]');
      if (cards.length === 0) return;
      const last = cards.length - 1;

      // Stacking is part of the motion, not the card's own styling, so
      // it is applied here: the caller's markup stays a plain list and
      // reads correctly if this never runs. Written directly rather than
      // through gsap so the fallback path needs no knowledge of it —
      // cleared by hand below, since gsap.context only reverts what it
      // created itself.
      cards.forEach((card) => {
        card.style.position = 'absolute';
      });

      // Where the scroll says we are in the stack, and where the stack
      // has actually got to. The gap between them is the inertia.
      const target = { at: 0, lean: 0 };
      let at = 0;
      let lean = 0;

      const trigger = ScrollTrigger.create({
        trigger: root.current,
        start: 'top top',
        // One viewport of scroll per card, plus a little at the end so
        // the last card has time to sit before the section releases.
        end: () => `+=${window.innerHeight * (cards.length + 0.4)}`,
        pin: stage.current,
        pinSpacing: true,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          target.at = self.progress * last;
          // Velocity is in px/s and signed by direction. Divided down
          // hard and clamped: this is a lean, not a throw.
          target.lean = gsap.utils.clamp(-1, 1, self.getVelocity() / 2600);
        },
      });

      const render = () => {
        // Frame-rate independent approach, so the stack settles at the
        // same rate on a 60Hz and a 120Hz display.
        const k = 1 - Math.exp(-gsap.ticker.deltaRatio() * 0.16);
        at += (target.at - at) * k;
        // The lean decays toward zero on its own rather than tracking
        // velocity directly, which is what makes it read as momentum
        // rather than as the cards being dragged.
        lean += (target.lean - lean) * k * 0.8;
        target.lean *= 0.9;

        cards.forEach((card, i) => {
          // Signed distance from the front of the stack: negative once
          // the card has been read, positive while it is still waiting.
          const d = i - at;

          let y: number;
          let z: number;
          let scale: number;
          let rotateX: number;
          let opacity: number;

          if (d >= 0) {
            // Waiting its turn: sunk into the stack, tipped slightly
            // away, each one a little smaller than the one in front.
            const s = Math.min(d, 4);
            // Offset downward so each card behind shows an edge under
            // the one in front — with opaque cards that edge is the
            // whole read on depth. Kept nearly fully opaque for the
            // first couple: they are occluded, not faded, which is how
            // real stacked objects behave.
            y = s * 46;
            z = -s * 190;
            scale = 1 - s * 0.05;
            rotateX = -Math.min(s, 2) * 4;
            opacity = Math.max(0, 1 - Math.max(0, s - 1.6) * 0.6);
          } else {
            // Already read: lifts up and toward the reader as it leaves,
            // so it exits past the camera rather than shrinking away —
            // the difference between a card being taken off a stack and
            // one falling down a hole.
            //
            // It stays opaque while it goes.
            //
            // Fading a card that is still on top of the next one is what
            // produced the muddle the client screenshotted: two promises
            // legible through each other at once. Speeding the fade up
            // does not fix it, it just shortens it — any partial opacity
            // over another card is a double read. So the card holds full
            // opacity until it is most of the way out of frame and only
            // then fades. The card underneath is revealed the way a card
            // lifted off a deck reveals the next one: by being uncovered,
            // not by being seen through.
            const s = Math.min(-d, 2);
            y = -s * 620;
            z = s * 200;
            scale = 1 + s * 0.05;
            rotateX = s * 14;
            opacity = s < 0.8 ? 1 : Math.max(0, 1 - (s - 0.8) * 3.4);
          }

          card.style.opacity = opacity.toFixed(3);
          // Hidden outright once invisible: a stack of transparent but
          // painted layers is still a stack of layers to composite.
          card.style.visibility = opacity < 0.01 ? 'hidden' : 'visible';
          // A card on its way out travels toward the reader, so it has
          // to be painted over the one arriving. Ordering by distance
          // alone drew it behind, which reads as the card sinking while
          // its transform says it is rising.
          card.style.zIndex = d < 0 ? '200' : String(Math.round(100 - d * 10));
          card.style.transform =
            `translate3d(0, ${y.toFixed(1)}px, ${z.toFixed(1)}px) ` +
            `rotateX(${(rotateX + lean * 4).toFixed(2)}deg) ` +
            `rotateZ(${(lean * 1.2).toFixed(2)}deg) ` +
            `scale(${scale.toFixed(3)})`;
        });
      };

      render();
      gsap.ticker.add(render);

      // Pinning changes the height of everything below it, so triggers
      // created earlier are holding stale positions.
      requestAnimationFrame(() => ScrollTrigger.refresh());

      return () => {
        gsap.ticker.remove(render);
        trigger.kill();
        cards.forEach((card) => {
          card.style.position = '';
          card.style.transform = '';
          card.style.opacity = '';
          card.style.visibility = '';
          card.style.zIndex = '';
        });
      };
    }, root);

    return () => ctx.revert();
  }, [reduced, enabled]);

  return (
    <div ref={root} className={className}>
      <div
        ref={stage}
        // Perspective on the stage rather than the cards: one shared
        // vanishing point, so the layers read as one object seen in
        // depth instead of several unrelated ones.
        style={enabled && !reduced ? { perspective: '1600px' } : undefined}
        className={
          enabled && !reduced
            ? 'relative flex h-screen items-center justify-center'
            : 'flex flex-col gap-6'
        }
      >
        {children}
      </div>
    </div>
  );
}
