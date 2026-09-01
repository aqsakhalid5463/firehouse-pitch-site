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

    setValue(0);
    let raf = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / 1800);
          const eased = 1 - Math.pow(1 - t, 3);
          setValue(Math.round(to * eased));
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
