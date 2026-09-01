'use client';

import { useEffect, useState } from 'react';

const MOBILE_BREAKPOINT = 768;

/**
 * WebGL is disabled under reduced-motion and on narrow viewports. Starts
 * false so the server render and first client render agree; the canvas
 * only ever appears after mount.
 */
export function useCanvasEnabled(): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const wide = window.matchMedia(`(min-width: ${MOBILE_BREAKPOINT}px)`);

    const update = () => setEnabled(!motion.matches && wide.matches);
    update();

    motion.addEventListener('change', update);
    wide.addEventListener('change', update);
    return () => {
      motion.removeEventListener('change', update);
      wide.removeEventListener('change', update);
    };
  }, []);

  return enabled;
}
