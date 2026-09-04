'use client';

import { useEffect } from 'react';
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useScrollStore } from '@/lib/scroll-store';
import { normalizeScroll } from '@/lib/scroll-math';
import { setLenis } from '@/lib/lenis-ref';
import { THEME } from '@/lib/theme';

gsap.registerPlugin(ScrollTrigger);

export function SmoothScrollProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const setScroll = useScrollStore.getState().setScroll;

    // The palette no longer moves with scroll (see lib/theme.ts), so it
    // is written once here rather than on every scroll event.
    const root = document.documentElement;
    root.style.setProperty('--page-bg', THEME.bg);
    root.style.setProperty('--page-ink', THEME.ink);

    const publish = (progress: number, velocity: number) => {
      setScroll(progress, velocity);
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

    // ScrollTrigger's default autoRefreshEvents includes a native 'resize'
    // listener that fires on every pixel of a drag-resize, and on mobile
    // fires when the URL bar shows/hides on scroll — refreshing on every
    // one of those is expensive and, on mobile, would rebuild the pin on
    // essentially every scroll. Drop 'resize' from the default set and
    // drive refreshes ourselves below, debounced and width-gated.
    ScrollTrigger.config({
      autoRefreshEvents: 'DOMContentLoaded,load,visibilitychange',
    });

    let resizeTimer: ReturnType<typeof setTimeout> | undefined;
    let lastWidth = window.innerWidth;
    const onResize = () => {
      // Mobile browsers resize the viewport (innerHeight) when the URL bar
      // shows/hides while scrolling. That is not a layout change our
      // viewport-relative pins care about, so only refresh when the width
      // actually changes (real resize / rotation), not on every height wobble.
      if (window.innerWidth === lastWidth) return;
      lastWidth = window.innerWidth;
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => ScrollTrigger.refresh(), 200);
    };
    window.addEventListener('resize', onResize);

    const lenis = new Lenis({ duration: 1.1, smoothWheel: true });
    // Published so the route transition can put the page back to the top
    // instantly while the shutter covers it. See lib/lenis-ref.ts.
    setLenis(lenis);

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
      gsap.ticker.lagSmoothing(500, 33);
      setLenis(null);
      lenis.destroy();
      window.removeEventListener('resize', onResize);
      clearTimeout(resizeTimer);
    };
  }, []);

  return <>{children}</>;
}
