'use client';

import { useState } from 'react';
import { audio } from '@/lib/audio';

/**
 * The one control that lets any of the audio happen.
 *
 * Sound is off until this is clicked, on every visit. A previous "on"
 * choice is persisted (lib/audio) so it survives navigation between the
 * two pages, but it never starts playback on its own: browsers refuse to
 * start an AudioContext outside a user gesture, and silently
 * autoplaying on a stranger's laptop is exactly what this control
 * exists to prevent.
 */
export function SoundToggle() {
  const [on, setOn] = useState(false);

  const toggle = () => {
    if (on) {
      audio.disable();
      setOn(false);
      return;
    }
    if (audio.enable()) {
      setOn(true);
      audio.tick();
    }
  };

  const label = on ? 'Turn sound off' : 'Turn sound on';

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={on}
      aria-label={label}
      title={label}
      className={`group flex items-center gap-2 rounded-full border px-3 py-1.5 transition-colors duration-300 ${
        on
          ? 'border-fire/60 text-fire'
          : 'border-current/25 text-current/70 hover:border-current/60 hover:text-current'
      }`}
    >
      {/* Three bars that animate only while sound is on, so the control
          reads as live rather than as a static icon. */}
      <span aria-hidden="true" className="flex h-3.5 items-end gap-[2px]">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={`w-[2px] bg-current ${
              on ? 'animate-eq' : 'h-[4px] opacity-60'
            }`}
            style={on ? { animationDelay: `${i * 0.16}s` } : undefined}
          />
        ))}
      </span>
      <span className="hidden text-xs font-medium tracking-wide sm:inline">
        {on ? 'Sound on' : 'Sound'}
      </span>
    </button>
  );
}
