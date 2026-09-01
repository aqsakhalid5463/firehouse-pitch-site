'use client';

import { useEffect } from 'react';
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useScrollStore } from '@/lib/scroll-store';
import { normalizeScroll } from '@/lib/scroll-math';
import { themeAt } from '@/lib/theme';

gsap.registerPlugin(ScrollTrigger);

export function SmoothScrollProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const setScroll = useScrollStore.getState().setScroll;

    const publish = (progress: number, velocity: number) => {
      setScroll(progress, velocity);
      const theme = themeAt(progress);
      const root = document.documentElement;
      root.style.setProperty('--page-bg', theme.bg);
      root.style.setProperty('--page-ink', theme.ink);
    };

    if (reduced) {
      const onScroll = () => {
        publish(
          normalizeScroll(
            window.scrollY,
            document.documentElement.scrollHeight,
            window.innerHeight,
          ),
          0,
        );
      };
      onScroll();
      window.addEventListener('scroll', onScroll, { passive: true });
      return () => window.removeEventListener('scroll', onScroll);
    }

    const lenis = new Lenis({ duration: 1.1, smoothWheel: true });

    lenis.on('scroll', ({ scroll, limit, velocity }) => {
      publish(limit > 0 ? Math.min(1, Math.max(0, scroll / limit)) : 0, velocity);
      // Keep ScrollTrigger's pin/progress calculations synced to Lenis's
      // virtual scroll position on every Lenis tick, not just native
      // 'scroll' events, or pinning desyncs / stutters against the smoothing.
      ScrollTrigger.update();
    });

    // Drive Lenis from GSAP's own ticker (instead of a separate rAF loop) so
    // Lenis and ScrollTrigger advance on the exact same frame. Two competing
    // rAF loops is what causes janky pinning / early-late pin release.
    const tick = (time: number) => {
      lenis.raf(time * 1000);
    };
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(tick);
      lenis.destroy();
    };
  }, []);

  return <>{children}</>;
}
