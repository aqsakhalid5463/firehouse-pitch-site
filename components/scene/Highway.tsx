'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { roadOpacityAt } from '@/lib/theme';
import { COLORS, ROAD_SURFACE_Y } from '@/lib/constants';
import { getExitProgress } from '@/lib/move-as-one-progress';

// Real road: a dark asphalt ground plane (subtle procedural sheen, no
// texture) plus painted, non-emissive lane markings — a dashed centre
// line and two solid edge lines. Everything streams toward the camera
// via uTime in the vertex shaders; nothing here uses additive/emissive
// blending, so it reads as lit paint and tarmac rather than glowing
// strips. 3 draw calls total (road, all lane markings, distant
// tail-lights), geometry/materials built once, no per-frame allocation.
const CENTRE_DASH_COUNT = 40;
const EDGE_SEGMENT_COUNT = 70; // per edge lane, densely packed (overlapping) to read as solid
const EDGE_LANE_X = 1.7;
const DASH_COUNT = CENTRE_DASH_COUNT + EDGE_SEGMENT_COUNT * 2;
const TAIL_LIGHT_COUNT = 14;

const DASH_RANGE = 60; // depth span the dashes loop across

/**
 * How far back the road surface stays visible, in world units.
 *
 * This used to be 34 while the lane markings loop across DASH_RANGE
 * (60), so the asphalt faded out a long way before the markings did and
 * the last stretch of dashes hung in black space. That mismatch is also
 * why the horizon glow kept reading as a band across the middle of the
 * frame: it was sitting at the end of the *road*, which was nowhere near
 * the end of the road as anyone looking at it would judge it. Matching
 * the two means the surface, the markings and the glow all run out
 * together, at the vanishing point.
 */
const ROAD_VISIBLE_DEPTH = DASH_RANGE - 4;
const DASH_NEAR = 11; // z at which dashes fade out (closest to camera)
const DASH_FAR = -DASH_RANGE + DASH_NEAR; // z at which dashes fade back in

const TAIL_RANGE = 50;
const TAIL_NEAR = 9;
const TAIL_FAR = -TAIL_RANGE + TAIL_NEAR;

const ROAD_HALF_WIDTH = 4.6;

// --- Road surface -----------------------------------------------------
// A single large ground plane. Surface "character" comes from a cheap
// value-noise field in the fragment shader, faked-lit against a fixed
// key-light direction that roughly matches SceneCanvas's directional
// light, so the sheen reads as wet asphalt catching the scene's lights
// rather than a flat, dead void.
const roadVertexShader = /* glsl */ `
  varying vec2 vWorldXZ;
  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldXZ = worldPos.xz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const roadFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uSheenColor;
  varying vec2 vWorldXZ;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 4; i++) {
      v += amp * noise(p);
      p *= 2.02;
      amp *= 0.5;
    }
    return v;
  }

  void main() {
    // Slow sheen crawl along the road so the wet-asphalt highlight
    // drifts, reinforcing the sense of travel without any glow.
    vec2 sampleP = vWorldXZ * vec2(0.6, 0.18) + vec2(0.0, uTime * 0.35);
    float grain = fbm(sampleP);
    float grainFine = fbm(vWorldXZ * 3.5) * 0.5;

    vec3 base = mix(uColorA, uColorB, grain);
    base = mix(base, base * 1.15, grainFine);

    // A faint sheen, kept far below the point where it reads as paint.
    //
    // This was a near-white highlight (headlight white at 0.5) driven by
    // the same scrolling noise field, which produced large pale patches
    // drifting up the asphalt — the road looked like it was crossfading
    // between dark tarmac and a light-coloured surface as you scrolled.
    // The exponent is raised so only the very top of the noise range
    // lights at all, the amount is cut hard, and the tint is now a cool
    // grey rather than white, so what is left reads as damp asphalt
    // catching a little light instead of a change of material.
    float sheen = pow(clamp(grain, 0.0, 1.0), 12.0);
    base += uSheenColor * sheen * 0.08;

    // Depth fade: the road dissolves at its far edge rather than
    // hard-clipping into the background.
    //
    // There was a red horizon glow here, folded into the surface as it
    // receded. Removed at the client's request after two attempts to
    // place it: wherever it sat it read as a band lying on the road
    // rather than as a horizon, because it is painted into the road
    // surface and a surface seen in perspective has no horizon of its
    // own to sit on. Doing it properly would mean a separate element
    // behind the road, not a term in this shader.
    float depth = clamp((-vWorldXZ.y) / ${ROAD_VISIBLE_DEPTH.toFixed(1)}, 0.0, 1.0);
    float farFade = 1.0 - smoothstep(0.9, 1.0, depth);

    gl_FragColor = vec4(base, uOpacity * farFade);
  }
`;

// --- Lane markings ------------------------------------------------------
// Instanced, non-emissive planes lying flat on the road. Alpha-blended
// paint, not additive glow. A cheap fixed-light diffuse + narrow
// specular term keeps them from reading as flat decals.
const markingVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  attribute vec3 aOffset; // x, zSeed, laneKind (0 = centre dash, 1 = edge)
  attribute float aSpeed;
  varying float vAlpha;
  varying float vLane;
  varying vec2 vUv;

  void main() {
    float z = mod(aOffset.y + uTime * aSpeed, ${DASH_RANGE.toFixed(1)}) - ${(DASH_RANGE - DASH_NEAR).toFixed(1)};
    vec3 worldPos = position + vec3(aOffset.x, ${ROAD_SURFACE_Y.toFixed(2)} + 0.004, z);
    vec4 mv = modelViewMatrix * vec4(worldPos, 1.0);
    gl_Position = projectionMatrix * mv;

    float fadeNear = smoothstep(${DASH_NEAR.toFixed(1)}, ${(DASH_NEAR - 6.0).toFixed(1)}, z);
    float fadeFar = smoothstep(${DASH_FAR.toFixed(1)}, ${(DASH_FAR + 12.0).toFixed(1)}, z);
    vAlpha = fadeNear * fadeFar * uOpacity;
    vLane = aOffset.z;
    vUv = uv;
  }
`;

const markingFragmentShader = /* glsl */ `
  uniform vec3 uPaintWhite;
  uniform vec3 uPaintDim;
  varying float vAlpha;
  varying float vLane;
  varying vec2 vUv;

  void main() {
    float edgeFade = 1.0 - smoothstep(0.28, 0.5, abs(vUv.x - 0.5));
    // Narrow specular streak down the middle of the line, like a wet
    // painted strip catching light, without ever emitting on its own.
    // Kept below ~0.8 luminance so it reads as lit paint rather than
    // tripping the scene's bloom threshold into a glowing beam.
    float highlight = pow(edgeFade, 4.0) * 0.18;
    vec3 paint = mix(uPaintWhite, uPaintDim, vLane);
    vec3 color = paint * (0.52 + highlight);
    gl_FragColor = vec4(color, edgeFade * vAlpha);
  }
`;

// --- Distant traffic ----------------------------------------------------
// A small number of brand-red tail-light streaks receding ahead of the
// viewer, on-palette and sparse — reads as distant traffic rather than
// floating embers. These are genuine emitters (real tail lights glow),
// so additive blending is appropriate here, unlike the road paint.
const tailVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  attribute vec3 aOffset; // x, y, zSeed
  attribute float aSpeed;
  attribute float aScale;
  varying float vAlpha;
  varying vec2 vUv;

  void main() {
    float z = mod(aOffset.z + uTime * aSpeed, ${TAIL_RANGE.toFixed(1)}) - ${(TAIL_RANGE - TAIL_NEAR).toFixed(1)};
    vec3 worldCenter = vec3(aOffset.x, aOffset.y, z);
    vec4 mv = modelViewMatrix * vec4(worldCenter, 1.0);
    mv.xy += position.xy * vec2(aScale * 1.1, aScale * 0.85);
    gl_Position = projectionMatrix * mv;

    float fadeNear = smoothstep(${TAIL_NEAR.toFixed(1)}, ${(TAIL_NEAR - 3.0).toFixed(1)}, z);
    float fadeFar = smoothstep(${TAIL_FAR.toFixed(1)}, ${(TAIL_FAR + 9.0).toFixed(1)}, z);
    vAlpha = fadeNear * fadeFar * uOpacity;
    vUv = uv;
  }
`;

const tailFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;
  varying vec2 vUv;

  void main() {
    float d = distance(vUv, vec2(0.5));
    float core = 1.0 - smoothstep(0.0, 0.5, d);
    gl_FragColor = vec4(uColor, core * core * vAlpha * 0.8);
  }
`;

export function Highway() {
  const roadMesh = useRef<THREE.Mesh>(null);
  const dashMesh = useRef<THREE.Mesh>(null);
  const tailMesh = useRef<THREE.Mesh>(null);

  const roadGeometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(ROAD_HALF_WIDTH * 2.6, DASH_RANGE + 20, 1, 1);
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, ROAD_SURFACE_Y, -(DASH_RANGE + 20) / 2 + DASH_NEAR);
    return geo;
  }, []);

  // A single instanced draw covers all lane markings: a dashed centre
  // line (real gaps) plus two densely-packed, near-continuous edge
  // lines, all sharing one small plane, one shader, one draw call. This
  // replaced an earlier attempt at a second, separately-instanced mesh
  // for the edge lines that silently failed to composite over the road
  // plane at some camera angles — folding everything into the
  // already-proven dash pipeline sidesteps that.
  const dashGeometry = useMemo(() => {
    const base = new THREE.PlaneGeometry(0.14, 0.9);
    base.rotateX(-Math.PI / 2);

    const geometry = new THREE.InstancedBufferGeometry();
    geometry.index = base.index;
    geometry.attributes.position = base.attributes.position;
    geometry.attributes.uv = base.attributes.uv;

    const offsets = new Float32Array(DASH_COUNT * 3);
    const speeds = new Float32Array(DASH_COUNT);
    // A uniform speed keeps every lane's spacing crisp as the markings
    // stream — per-instance speed variance would let segments drift
    // into or apart from each other over time and blur the pattern.
    const SPEED = 7.4;
    let i = 0;

    for (let c = 0; c < CENTRE_DASH_COUNT; c++, i++) {
      offsets[i * 3] = (Math.random() - 0.5) * 0.04;
      // Evenly spaced with slight jitter so real gaps show between
      // dashes (real spacing beats a fully random scatter, which
      // overlaps).
      offsets[i * 3 + 1] = (c / CENTRE_DASH_COUNT) * DASH_RANGE + (Math.random() - 0.5) * 0.3;
      offsets[i * 3 + 2] = 0;
      speeds[i] = SPEED;
    }

    for (const laneX of [-EDGE_LANE_X, EDGE_LANE_X]) {
      for (let e = 0; e < EDGE_SEGMENT_COUNT; e++, i++) {
        offsets[i * 3] = laneX;
        // Packed tighter than the segment length (0.9 vs ~0.86 pitch)
        // so consecutive segments overlap slightly — reads as a solid
        // painted edge line rather than a dashed one.
        offsets[i * 3 + 1] = (e / EDGE_SEGMENT_COUNT) * DASH_RANGE;
        offsets[i * 3 + 2] = 1;
        speeds[i] = SPEED;
      }
    }

    geometry.setAttribute('aOffset', new THREE.InstancedBufferAttribute(offsets, 3));
    geometry.setAttribute('aSpeed', new THREE.InstancedBufferAttribute(speeds, 1));
    geometry.instanceCount = DASH_COUNT;
    return geometry;
  }, []);

  const tailGeometry = useMemo(() => {
    const base = new THREE.PlaneGeometry(1, 1);
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.index = base.index;
    geometry.attributes.position = base.attributes.position;
    geometry.attributes.uv = base.attributes.uv;

    const offsets = new Float32Array(TAIL_LIGHT_COUNT * 3);
    const speeds = new Float32Array(TAIL_LIGHT_COUNT);
    const scales = new Float32Array(TAIL_LIGHT_COUNT);

    for (let i = 0; i < TAIL_LIGHT_COUNT; i++) {
      const pairX = (Math.random() < 0.5 ? -1 : 1) * (1.4 + Math.random() * 0.6);
      offsets[i * 3] = pairX;
      offsets[i * 3 + 1] = ROAD_SURFACE_Y + 0.22 + Math.random() * 0.1;
      offsets[i * 3 + 2] = Math.random() * TAIL_RANGE;
      speeds[i] = 2.2 + Math.random() * 2.0;
      scales[i] = 0.055 + Math.random() * 0.03;
    }

    geometry.setAttribute('aOffset', new THREE.InstancedBufferAttribute(offsets, 3));
    geometry.setAttribute('aSpeed', new THREE.InstancedBufferAttribute(speeds, 1));
    geometry.setAttribute('aScale', new THREE.InstancedBufferAttribute(scales, 1));
    geometry.instanceCount = TAIL_LIGHT_COUNT;
    return geometry;
  }, []);

  const roadUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uOpacity: { value: 1 },
      uColorA: { value: new THREE.Color(COLORS.asphaltDark) },
      uColorB: { value: new THREE.Color(COLORS.asphaltPanel) },
      // Cool grey, not headlight white: see the sheen term in the
      // road fragment shader for why this was toned down.
      uSheenColor: { value: new THREE.Color(COLORS.roadSheen) },
    }),
    [],
  );

  const dashUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uOpacity: { value: 1 },
      uPaintWhite: { value: new THREE.Color(COLORS.roadMarkingWhite) },
      uPaintDim: { value: new THREE.Color(COLORS.roadMarkingDim) },
    }),
    [],
  );

  const tailUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uOpacity: { value: 1 },
      uColor: { value: new THREE.Color(COLORS.fireRed) },
    }),
    [],
  );

  useFrame((_, delta) => {
    const exit = getExitProgress();
    // The road is a set-piece of the pinned opening: it dissolves behind
    // the departing truck rather than persisting down the page, handing
    // the through-line over to the SVG ribbon (components/ui/Ribbon).
    const opacity = roadOpacityAt(exit);
    // Ramps the marking/tail-light streaming speed up to 1.6x during the
    // truck's drive-away so the whole highway feels like it accelerates
    // with it — subtle (eased, capped), meant to register as energy
    // rather than a speed-up glitch.
    const speedBoost = 1 + 0.6 * (exit * exit);
    const boostedDelta = delta * speedBoost;

    const roadMat = roadMesh.current?.material as THREE.ShaderMaterial | undefined;
    if (roadMat) {
      roadMat.uniforms.uTime.value += boostedDelta;
      roadMat.uniforms.uOpacity.value = opacity;
    }

    const dashMat = dashMesh.current?.material as THREE.ShaderMaterial | undefined;
    if (dashMat) {
      dashMat.uniforms.uTime.value += boostedDelta;
      dashMat.uniforms.uOpacity.value = opacity;
    }

    const tailMat = tailMesh.current?.material as THREE.ShaderMaterial | undefined;
    if (tailMat) {
      tailMat.uniforms.uTime.value += boostedDelta;
      tailMat.uniforms.uOpacity.value = opacity;
    }
  });

  return (
    <>
      <mesh ref={roadMesh} frustumCulled={false} renderOrder={-1}>
        <primitive object={roadGeometry} attach="geometry" />
        <shaderMaterial
          uniforms={roadUniforms}
          vertexShader={roadVertexShader}
          fragmentShader={roadFragmentShader}
          transparent
          depthWrite={false}
        />
      </mesh>
      <mesh ref={dashMesh} frustumCulled={false}>
        <primitive object={dashGeometry} attach="geometry" />
        <shaderMaterial
          uniforms={dashUniforms}
          vertexShader={markingVertexShader}
          fragmentShader={markingFragmentShader}
          transparent
          depthWrite={false}
        />
      </mesh>
      <mesh ref={tailMesh} frustumCulled={false}>
        <primitive object={tailGeometry} attach="geometry" />
        <shaderMaterial
          uniforms={tailUniforms}
          vertexShader={tailVertexShader}
          fragmentShader={tailFragmentShader}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </>
  );
}
