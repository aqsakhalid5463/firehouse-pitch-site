'use client';

import { useEffect } from 'react';
import { audio } from '@/lib/audio';
import { getMoveAsOneProgress, EXIT_START } from '@/lib/move-as-one-progress';
import { getScrollVelocity } from '@/lib/scroll-store';
import { BOX_LANDING_LOCALS } from '@/components/scene/BoxStack';

/**
 * Turns the opening set-piece's scroll position into sound events.
 *
 * All the audio triggering lives here rather than inside the 3D
 * components, for two reasons. The scene components run inside `useFrame`
 * and would each need their own edge-detection state to avoid re-firing
 * a one-shot every frame; and keeping it separate means the truck, the
 * boxes, and the door know nothing about audio at all.
 *
 * Everything is edge-triggered off a remembered previous progress, so
 * each sound fires once per crossing — and scrubbing backwards re-arms
 * it, which matters because the whole set-piece is scroll-driven and a
 * visitor can and will scroll back up.
 */

// Pin-local progress at which the rear door starts each movement. These
// mirror TruckAssembly's DOOR_OPEN_START / DOOR_CLOSE_START. They are
// duplicated rather than exported because they are timing cues, not
// geometry: audio wants to fire as the door *begins* to move.
const DOOR_OPEN_AT = 0.33;
const DOOR_CLOSE_AT = 0.75;

export function SceneAudio() {
  useEffect(() => {
    let raf = 0;
    let prev = getMoveAsOneProgress();
    let engineRunning = false;

    // Rising-edge test: fired only when this frame crossed `mark` going
    // forward. The backwards case is handled implicitly — `prev` moves
    // back below the mark, re-arming it.
    const crossed = (now: number, mark: number) => prev < mark && now >= mark;

    const tick = () => {
      const local = getMoveAsOneProgress();

      if (audio.enabled) {
        // The engine idles for as long as the truck is on screen. It is
        // started lazily rather than on mount so enabling sound halfway
        // down the page does not begin with a truck that is not there.
        const truckVisible = local > 0.02 && local < 1;
        if (truckVisible && !engineRunning) {
          audio.startEngine();
          engineRunning = true;
        } else if (!truckVisible && engineRunning) {
          audio.stopEngine();
          engineRunning = false;
        }

        if (engineRunning) {
          // Throttle comes from scroll speed, so working the wheel
          // audibly works the truck; the departure pins it wide open.
          const speed = Math.min(1, Math.abs(getScrollVelocity()) / 60);
          const departing =
            local > EXIT_START ? (local - EXIT_START) / (1 - EXIT_START) : 0;
          audio.setThrottle(Math.max(speed * 0.7, departing));
        }

        if (crossed(local, DOOR_OPEN_AT)) audio.rollerDoor();
        for (const mark of BOX_LANDING_LOCALS) {
          if (crossed(local, mark)) audio.thud();
        }
        if (crossed(local, DOOR_CLOSE_AT)) audio.rollerDoor();
        if (crossed(local, EXIT_START)) audio.airBrake();
      }

      prev = local;
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      audio.stopEngine();
    };
  }, []);

  return null;
}
