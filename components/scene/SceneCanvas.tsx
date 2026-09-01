'use client';

import { Canvas } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import { useState } from 'react';
import { CameraRig } from './CameraRig';
import { ThemeSync } from './ThemeSync';
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
        {/* Placeholder — replaced by the real scene in Task 6. */}
        <mesh>
          <boxGeometry args={[1.2, 1.2, 1.2]} />
          <meshStandardMaterial color="#E23D28" roughness={0.4} />
        </mesh>
      </Canvas>
    </div>
  );
}
