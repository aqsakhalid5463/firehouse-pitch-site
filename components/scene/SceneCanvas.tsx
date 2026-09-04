'use client';

import { Canvas } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import { useEffect, useState } from 'react';
import { CameraRig } from './CameraRig';
import { ThemeSync } from './ThemeSync';
import { BoxStack } from './BoxStack';
import { TruckAssembly } from './TruckAssembly';
import { Highway } from './Highway';
import { Effects } from './Effects';
import { useCanvasEnabled } from '@/lib/use-canvas-enabled';
import { COLORS } from '@/lib/constants';
import { StaticBackdrop } from './StaticBackdrop';
import { FirstFrame } from './FirstFrame';
import { VanishingPoint } from './VanishingPoint';
import { markReady, usePreloadStore } from '@/lib/preload-store';

export function SceneCanvas() {
  const enabled = useCanvasEnabled();
  const [degraded, setDegraded] = useState(false);
  // While the curtain is up the canvas is completely hidden, so it
  // renders at 1x with no postprocessing. It still renders — the
  // preloader's heaviest signal is a real first frame, and shaders and
  // procedural textures still have to be built — but it does it at a
  // fraction of the cost, which leaves the main thread free for the
  // loader's own animation.
  const lifted = usePreloadStore((s) => s.lifted);

  // No canvas means FirstFrame never mounts and the preloader would sit
  // at 50% forever. The backdrop is a plain gradient, ready on mount.
  useEffect(() => {
    if (enabled) return;
    // useCanvasEnabled starts false and only flips true inside its own
    // mount effect, so checking synchronously here would report "no
    // canvas" on desktop as well. Deferring by a tick lets it settle —
    // if it does flip, this effect re-runs and the cleanup below cancels
    // the report before it fires.
    const id = setTimeout(() => markReady('frame'), 0);
    return () => clearTimeout(id);
  }, [enabled]);

  if (!enabled) return <StaticBackdrop />;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0"
    >
      <Canvas
        dpr={degraded || !lifted ? 1 : [1, 2]}
        gl={{ antialias: !degraded, powerPreference: 'high-performance' }}
        camera={{ position: [0, 0.2, 6], fov: 42 }}
        eventSource={typeof document !== 'undefined' ? document.body : undefined}
        eventPrefix="client"
      >
        <PerformanceMonitor
          onDecline={() => setDegraded(true)}
          onIncline={() => setDegraded(false)}
        />
        <FirstFrame />
        <VanishingPoint />
        <ThemeSync />
        <CameraRig />
        <ambientLight intensity={0.4} />
        <pointLight position={[2, 3, 4]} intensity={6} color={COLORS.headlightWhite} />
        <pointLight position={[-3, -1, 2]} intensity={4} color={COLORS.fireRed} />
        <directionalLight position={[0, 6, 3]} intensity={0.8} />
        <BoxStack />
        <TruckAssembly />
        <Highway />
        {!degraded && lifted && <Effects />}
      </Canvas>
    </div>
  );
}
