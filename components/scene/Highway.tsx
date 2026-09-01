'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getScrollProgress } from '@/lib/scroll-store';
import { themeAt } from '@/lib/theme';
import { COLORS } from '@/lib/constants';

// Three lanes: a dashed centre line and two edge-reflector lines. Kept
// well under the old 2,600-point budget — two draw calls total, no
// per-frame allocation, all motion driven by uTime in the vertex shader.
const DASH_COUNT = 260;
const MOTE_COUNT = 220;

const DASH_RANGE = 60; // depth span the dashes loop across
const DASH_NEAR = 9; // z at which dashes fade out (closest to camera)
const DASH_FAR = -DASH_RANGE + DASH_NEAR; // z at which dashes fade back in

const MOTE_RANGE = 44;
const MOTE_NEAR = 7;
const MOTE_FAR = -MOTE_RANGE + MOTE_NEAR;

const dashVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  attribute vec3 aOffset; // x, zSeed, laneKind (0 = centre dash, 1 = edge reflector)
  attribute float aSpeed;
  varying float vAlpha;
  varying float vLane;
  varying vec2 vUv;

  void main() {
    float z = mod(aOffset.y + uTime * aSpeed, ${DASH_RANGE.toFixed(1)}) - ${(DASH_RANGE - DASH_NEAR).toFixed(1)};
    vec3 worldPos = position + vec3(aOffset.x, -1.35, z);
    vec4 mv = modelViewMatrix * vec4(worldPos, 1.0);
    gl_Position = projectionMatrix * mv;

    float fadeNear = smoothstep(${DASH_NEAR.toFixed(1)}, ${(DASH_NEAR - 6.0).toFixed(1)}, z);
    float fadeFar = smoothstep(${DASH_FAR.toFixed(1)}, ${(DASH_FAR + 12.0).toFixed(1)}, z);
    vAlpha = fadeNear * fadeFar * uOpacity;
    vLane = aOffset.z;
    vUv = uv;
  }
`;

const dashFragmentShader = /* glsl */ `
  uniform vec3 uColorHot;
  uniform vec3 uColorCool;
  varying float vAlpha;
  varying float vLane;
  varying vec2 vUv;

  void main() {
    float edgeFade = 1.0 - smoothstep(0.25, 0.5, abs(vUv.x - 0.5));
    vec3 color = mix(uColorCool, uColorHot, vLane > 0.5 ? 0.85 : 0.35);
    float glow = mix(0.55, 1.0, edgeFade);
    gl_FragColor = vec4(color * glow, edgeFade * vAlpha);
  }
`;

const moteVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  attribute vec3 aOffset; // x, y, zSeed
  attribute float aSpeed;
  attribute float aScale;
  varying float vAlpha;
  varying vec2 vUv;

  void main() {
    float z = mod(aOffset.z + uTime * aSpeed, ${MOTE_RANGE.toFixed(1)}) - ${(MOTE_RANGE - MOTE_NEAR).toFixed(1)};
    vec3 worldCenter = vec3(aOffset.x, aOffset.y, z);
    vec4 mv = modelViewMatrix * vec4(worldCenter, 1.0);
    // Billboard by displacing in view space so the streak always faces
    // the camera, elongated along local x to read as a passing light
    // rather than a round spark.
    mv.xy += position.xy * vec2(aScale * 1.6, aScale * 0.16);
    gl_Position = projectionMatrix * mv;

    float fadeNear = smoothstep(${MOTE_NEAR.toFixed(1)}, ${(MOTE_NEAR - 4.0).toFixed(1)}, z);
    float fadeFar = smoothstep(${MOTE_FAR.toFixed(1)}, ${(MOTE_FAR + 10.0).toFixed(1)}, z);
    vAlpha = fadeNear * fadeFar * uOpacity;
    vUv = uv;
  }
`;

const moteFragmentShader = /* glsl */ `
  uniform vec3 uColorHot;
  uniform vec3 uColorWhite;
  varying float vAlpha;
  varying vec2 vUv;

  void main() {
    float lengthFade = 1.0 - smoothstep(0.1, 0.5, abs(vUv.x - 0.5));
    float widthFade = 1.0 - smoothstep(0.15, 0.5, abs(vUv.y - 0.5));
    float streak = lengthFade * widthFade;
    vec3 color = mix(uColorHot, uColorWhite, lengthFade);
    gl_FragColor = vec4(color, streak * streak * vAlpha);
  }
`;

export function Highway() {
  const dashPoints = useRef<THREE.Mesh>(null);
  const motePoints = useRef<THREE.Mesh>(null);

  const dashGeometry = useMemo(() => {
    const base = new THREE.PlaneGeometry(0.14, 1.1);
    base.rotateX(-Math.PI / 2);

    const geometry = new THREE.InstancedBufferGeometry();
    geometry.index = base.index;
    geometry.attributes.position = base.attributes.position;
    geometry.attributes.uv = base.attributes.uv;

    const offsets = new Float32Array(DASH_COUNT * 3);
    const speeds = new Float32Array(DASH_COUNT);
    const lanePositions = [-1.7, 0, 1.7];

    for (let i = 0; i < DASH_COUNT; i++) {
      const laneIndex = i % 3;
      const isCentre = laneIndex === 1;
      offsets[i * 3] = lanePositions[laneIndex] + (isCentre ? 0 : (Math.random() - 0.5) * 0.08);
      offsets[i * 3 + 1] = Math.random() * DASH_RANGE;
      offsets[i * 3 + 2] = isCentre ? 0 : 1;
      speeds[i] = isCentre ? 7 + Math.random() * 1.5 : 6.4 + Math.random() * 1.2;
    }

    geometry.setAttribute('aOffset', new THREE.InstancedBufferAttribute(offsets, 3));
    geometry.setAttribute('aSpeed', new THREE.InstancedBufferAttribute(speeds, 1));
    geometry.instanceCount = DASH_COUNT;
    return geometry;
  }, []);

  const moteGeometry = useMemo(() => {
    const base = new THREE.PlaneGeometry(1, 1);
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.index = base.index;
    geometry.attributes.position = base.attributes.position;
    geometry.attributes.uv = base.attributes.uv;

    const offsets = new Float32Array(MOTE_COUNT * 3);
    const speeds = new Float32Array(MOTE_COUNT);
    const scales = new Float32Array(MOTE_COUNT);

    for (let i = 0; i < MOTE_COUNT; i++) {
      offsets[i * 3] = (Math.random() - 0.5) * 9;
      offsets[i * 3 + 1] = -0.6 + Math.random() * 2.2;
      offsets[i * 3 + 2] = Math.random() * MOTE_RANGE;
      speeds[i] = 3.5 + Math.random() * 4;
      scales[i] = 0.05 + Math.random() * 0.09;
    }

    geometry.setAttribute('aOffset', new THREE.InstancedBufferAttribute(offsets, 3));
    geometry.setAttribute('aSpeed', new THREE.InstancedBufferAttribute(speeds, 1));
    geometry.setAttribute('aScale', new THREE.InstancedBufferAttribute(scales, 1));
    geometry.instanceCount = MOTE_COUNT;
    return geometry;
  }, []);

  const dashUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uOpacity: { value: 1 },
      uColorHot: { value: new THREE.Color(COLORS.emberAmber) },
      uColorCool: { value: new THREE.Color(COLORS.fireRed) },
    }),
    [],
  );

  const moteUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uOpacity: { value: 1 },
      uColorHot: { value: new THREE.Color(COLORS.emberAmber) },
      uColorWhite: { value: new THREE.Color(COLORS.headlightWhite) },
    }),
    [],
  );

  useFrame((_, delta) => {
    const opacity = themeAt(getScrollProgress()).emberOpacity;

    const dashMat = dashPoints.current?.material as THREE.ShaderMaterial | undefined;
    if (dashMat) {
      dashMat.uniforms.uTime.value += delta;
      dashMat.uniforms.uOpacity.value = opacity;
    }

    const moteMat = motePoints.current?.material as THREE.ShaderMaterial | undefined;
    if (moteMat) {
      moteMat.uniforms.uTime.value += delta;
      moteMat.uniforms.uOpacity.value = opacity;
    }
  });

  return (
    <>
      <mesh ref={dashPoints} frustumCulled={false}>
        <primitive object={dashGeometry} attach="geometry" />
        <shaderMaterial
          uniforms={dashUniforms}
          vertexShader={dashVertexShader}
          fragmentShader={dashFragmentShader}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <mesh ref={motePoints} frustumCulled={false}>
        <primitive object={moteGeometry} attach="geometry" />
        <shaderMaterial
          uniforms={moteUniforms}
          vertexShader={moteVertexShader}
          fragmentShader={moteFragmentShader}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </>
  );
}
