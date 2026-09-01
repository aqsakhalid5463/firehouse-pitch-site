'use client';

import { useEffect } from 'react';
import Lenis from 'lenis';
import { useScrollStore } from '@/lib/scroll-store';
import { normalizeScroll } from '@/lib/scroll-math';
import { themeAt } from '@/lib/theme';

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
    });

    let raf = 0;
    const loop = (time: number) => {
      lenis.raf(time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
    };
  }, []);

  return <>{children}</>;
}
