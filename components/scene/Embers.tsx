'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getScrollProgress } from '@/lib/scroll-store';
import { themeAt } from '@/lib/theme';
import { COLORS } from '@/lib/constants';

const COUNT = 2600;

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  attribute float aSpeed;
  attribute float aScale;
  attribute float aOffset;
  varying float vAlpha;

  void main() {
    vec3 pos = position;
    float t = uTime * aSpeed + aOffset;
    pos.y = mod(pos.y + t, 16.0) - 8.0;
    pos.x += sin(t * 0.6) * 0.4;
    pos.z += cos(t * 0.4) * 0.3;

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aScale * (30.0 / -mv.z);

    float fade = smoothstep(8.0, 1.0, abs(pos.y));
    vAlpha = fade * uOpacity;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColorHot;
  uniform vec3 uColorCool;
  varying float vAlpha;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float glow = smoothstep(0.5, 0.0, d);
    vec3 color = mix(uColorCool, uColorHot, glow);
    gl_FragColor = vec4(color, glow * glow * vAlpha);
  }
`;

export function Embers() {
  const material = useRef<THREE.ShaderMaterial>(null);

  const { positions, speeds, scales, offsets } = useMemo(() => {
    const positions = new Float32Array(COUNT * 3);
    const speeds = new Float32Array(COUNT);
    const scales = new Float32Array(COUNT);
    const offsets = new Float32Array(COUNT);

    for (let i = 0; i < COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 22;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 16;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 14;
      speeds[i] = 0.15 + Math.random() * 0.5;
      scales[i] = 1.5 + Math.random() * 5;
      offsets[i] = Math.random() * 40;
    }
    return { positions, speeds, scales, offsets };
  }, []);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uOpacity: { value: 1 },
      uColorHot: { value: new THREE.Color(COLORS.emberAmber) },
      uColorCool: { value: new THREE.Color(COLORS.fireRed) },
    }),
    [],
  );

  useFrame((_, delta) => {
    if (!material.current) return;
    uniforms.uTime.value += delta;
    uniforms.uOpacity.value = themeAt(getScrollProgress()).emberOpacity;
  });

  return (
    <points frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aSpeed" args={[speeds, 1]} />
        <bufferAttribute attach="attributes-aScale" args={[scales, 1]} />
        <bufferAttribute attach="attributes-aOffset" args={[offsets, 1]} />
      </bufferGeometry>
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
