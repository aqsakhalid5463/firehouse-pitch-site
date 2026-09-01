'use client';

import { Canvas } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import { useState } from 'react';
import { CameraRig } from './CameraRig';
import { ThemeSync } from './ThemeSync';
import { BoxStack } from './BoxStack';
import { TruckAssembly } from './TruckAssembly';
import { Embers } from './Embers';
import { Effects } from './Effects';
import { useCanvasEnabled } from '@/lib/use-canvas-enabled';
import { COLORS } from '@/lib/constants';
import { StaticBackdrop } from './StaticBackdrop';

export function SceneCanvas() {
  const enabled = useCanvasEnabled();
  const [degraded, setDegraded] = useState(false);

  if (!enabled) return <StaticBackdrop />;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0"
    >
      <Canvas
        dpr={degraded ? 1 : [1, 2]}
        gl={{ antialias: !degraded, powerPreference: 'high-performance' }}
        camera={{ position: [0, 0.2, 6], fov: 42 }}
        eventSource={typeof document !== 'undefined' ? document.body : undefined}
        eventPrefix="client"
      >
        <PerformanceMonitor
          onDecline={() => setDegraded(true)}
          onIncline={() => setDegraded(false)}
        />
        <ThemeSync />
        <CameraRig />
        <ambientLight intensity={0.4} />
        <pointLight position={[2, 3, 4]} intensity={8} color={COLORS.emberAmber} />
        <pointLight position={[-3, -1, 2]} intensity={4} color={COLORS.fireRed} />
        <directionalLight position={[0, 6, 3]} intensity={0.8} />
        <BoxStack />
        <TruckAssembly />
        <Embers />
        {!degraded && <Effects />}
      </Canvas>
    </div>
  );
}
