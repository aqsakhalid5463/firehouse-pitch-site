'use client';

import { useEffect, useState } from 'react';

export function useReducedMotion(): boolean {
  // Lazy-init reads the media query synchronously on the client (SSR has
  // no window, so it still resolves false there). This avoids a mount
  // render where `reduced` is briefly false before the effect below
  // corrects it — consumers that gate a GSAP timeline creation on this
  // value would otherwise flash the timeline's initial state for one
  // frame before reverting.
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return reduced;
}
