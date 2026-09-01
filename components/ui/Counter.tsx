'use client';

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '@/lib/use-reduced-motion';

export function Counter({
  to,
  suffix = '',
  className = '',
}: {
  to: number;
  suffix?: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  // Start at the final value so the server-rendered (no-JS) markup is
  // readable. JS-enabled visitors get reset to 0 in the effect below and
  // animate back up once the counter scrolls into view.
  const [value, setValue] = useState(to);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) {
      setValue(to);
      return;
    }
    const el = ref.current;
    if (!el) return;

    // Check if element is already in viewport at mount.
    // Only reset to 0 if it's out of view; if already in view, leave at final value.
    const rect = el.getBoundingClientRect();
    const isInViewport = rect.top < window.innerHeight && rect.bottom > 0;
    const shouldAnimate = !isInViewport;

    if (!isInViewport) {
      setValue(0);
    }

    let raf = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();

        // Only run animation if the element was initially out of view.
        // If it was already in view, just leave the final value in place.
        if (!shouldAnimate) return;

        const start = performance.now();
        const tick = (now: number) => {
          // Clamp t to [0, 1] defensively to prevent negative easing values
          const t = Math.max(0, Math.min(1, (now - start) / 1800));
          const eased = 1 - Math.pow(1 - t, 3);
          // Clamp the displayed value to [0, to] to ensure it stays in valid range
          const displayValue = Math.max(0, Math.min(to, Math.round(to * eased)));
          setValue(displayValue);
          if (t < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    observer.observe(el);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [to, reduced]);

  return (
    <span ref={ref} className={className}>
      {value.toLocaleString('en-US')}
      {suffix}
    </span>
  );
}
