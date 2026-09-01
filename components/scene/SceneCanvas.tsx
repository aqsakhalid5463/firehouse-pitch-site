'use client';

import { Canvas } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import { useState } from 'react';
import { CameraRig } from './CameraRig';
import { ThemeSync } from './ThemeSync';
import { BoxStack } from './BoxStack';
import { Embers } from './Embers';
import { Effects } from './Effects';
import { useCanvasEnabled } from '@/lib/use-canvas-enabled';

export function SceneCanvas() {
  const enabled = useCanvasEnabled();
  const [degraded, setDegraded] = useState(false);

  if (!enabled) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0"
    >
      <Canvas
        dpr={degraded ? 1 : [1, 2]}
        gl={{ antialias: !degraded, powerPreference: 'high-performance' }}
        camera={{ position: [0, 0.2, 6], fov: 42 }}
      >
        <PerformanceMonitor
          onDecline={() => setDegraded(true)}
          onIncline={() => setDegraded(false)}
        />
        <ThemeSync />
        <CameraRig />
        <ambientLight intensity={0.4} />
        <pointLight position={[2, 3, 4]} intensity={8} color="#FF8A3D" />
        <pointLight position={[-3, -1, 2]} intensity={4} color="#E23D28" />
        <directionalLight position={[0, 6, 3]} intensity={0.8} />
        <BoxStack />
        <Embers />
        {!degraded && <Effects />}
      </Canvas>
    </div>
  );
}
