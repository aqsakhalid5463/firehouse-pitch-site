# Firehouse Movers Pitch Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a two-page (Home, About) Next.js pitch site for Firehouse Movers featuring a single persistent React Three Fiber canvas whose camera and palette are driven by scroll, dissolving from a dark cinematic hero into a light editorial close.

**Architecture:** One fixed full-viewport `<Canvas>` lives in the root layout at `z-0`; all HTML scrolls above it at `z-10`. Lenis writes a normalized scroll progress (0→1 per page) into a Zustand store. That single value is read in two places — inside R3F's `useFrame` to sample a camera spline and interpolate scene colors, and on a rAF loop that writes CSS custom properties so the HTML palette shifts in lockstep. All 3D geometry is procedural: primitives and custom shaders only, no external model or image assets.

**Tech Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · three · @react-three/fiber · @react-three/drei · @react-three/postprocessing · gsap (ScrollTrigger) · motion · lenis · zustand · Vitest · Playwright

**Spec:** `docs/superpowers/specs/2026-09-01-firehouse-movers-pitch-site-design.md`

## Global Constraints

- This is a **pitch build**, not production. No CMS, auth, booking flow, or quote backend. CTAs link to `tel:`, `mailto:`, or in-page anchors only.
- **All 3D is procedural.** No GLTF/GLB models, no stock photography, no downloaded textures or HDRIs. Geometry comes from three.js primitives; surface detail comes from shaders. Any drei helper that fetches a remote asset (e.g. `<Environment preset=...>`) is disallowed — use in-scene lights or a procedurally generated environment.
- **Exactly one `<Canvas>` in the entire app.** It is mounted in `app/layout.tsx`. No component below the layout may create another.
- Hero headline, primary CTA, and the phone number must be present in server-rendered HTML in the initial payload. The canvas fades in behind them. The hero must never be blank.
- `prefers-reduced-motion: reduce` → no WebGL canvas (static gradient instead), GSAP timelines resolve immediately to their end state, marquee does not move.
- Viewport width below `768px` → no WebGL canvas. Static gradient plus the full HTML content, which must stand alone as a good-looking page.
- Device pixel ratio clamped to `[1, 2]` on the canvas.
- All copy is real HTML — headings, links, and text readable and crawlable with JavaScript disabled.
- Real business details, used verbatim wherever contact info appears:
  - Name: `Firehouse Movers Inc.`
  - Address: `2535-B Texas 121 E, State #140, Lewisville, TX 75056`
  - Phone: `(972) 992-1969` (link as `tel:+19729921969`)
  - Email: `support@firehousemovers.com`
  - Hero headline: `The moving service we needed, so we built it for you`
- Scroll progress `p` is always normalized `0→1` across the full scrollable height of the current page, clamped at both ends.
- Home section scroll ranges (used for camera and theme interpolation):
  - Hero `0.00–0.15` · Services `0.15–0.35` · Move as One `0.35–0.60` · Guarantees `0.60–0.75` · Testimonials `0.75–0.90` · CTA `0.90–1.00`
- The dark→light dissolve happens across `0.60–0.75` and nowhere else.
- Palette (exact values):
  - Dark bg `#08070A` · Dark fog `#0D0B12` · Light bg `#F4F0E9` · Light fog `#E8E2D6`
  - Ink (light-mode text) `#1A1917` · Bone (dark-mode text) `#F4F0E9`
  - Fire red `#E23D28` · Ember amber `#FF8A3D`
- Commit after every task using Conventional Commits (`feat:`, `test:`, `chore:`, `fix:`).

---

### Task 1: Project scaffold and global constraints

Stands up the Next.js app with Tailwind, the full dependency set, the palette as design tokens, the test runners, and the shared business-detail constants. Nothing visual yet beyond a blank styled page — this task exists so every later task has a working, committable base.

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `.gitignore` (via scaffold)
- Create: `app/globals.css`
- Create: `lib/constants.ts`
- Create: `vitest.config.ts`
- Create: `tests/unit/constants.test.ts`
- Modify: `app/layout.tsx`, `app/page.tsx` (scaffold output)

**Interfaces:**
- Consumes: nothing (first task)
- Produces: `lib/constants.ts` exporting
  - `BUSINESS: { name: string; address: string; phone: string; phoneHref: string; email: string }`
  - `HERO_HEADLINE: string`
  - `COLORS: { darkBg: string; darkFog: string; lightBg: string; lightFog: string; ink: string; bone: string; fireRed: string; emberAmber: string }`
  - `SECTIONS: Record<'hero'|'services'|'moveAsOne'|'guarantees'|'testimonials'|'cta', [number, number]>`

- [ ] **Step 1: Scaffold the Next.js app**

Run in `/Users/hamzahmanzoor/Desktop/Firehouse`:

```bash
npx create-next-app@latest . --typescript --tailwind --app --no-src-dir --turbopack --import-alias "@/*" --yes
```

The directory already contains `docs/` and a `.git/`. If the scaffolder refuses to run in a non-empty directory, pass `--yes` and accept the overwrite prompt for files it owns; do not let it delete `docs/`.

- [ ] **Step 2: Install runtime and test dependencies**

```bash
npm install three @react-three/fiber @react-three/drei @react-three/postprocessing gsap motion lenis zustand
npm install -D @types/three vitest @vitejs/plugin-react jsdom @playwright/test
npx playwright install chromium
```

- [ ] **Step 3: Configure Vitest**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
});
```

Add to `package.json` scripts:

```json
"test": "vitest run",
"test:watch": "vitest",
"test:e2e": "playwright test"
```

- [ ] **Step 4: Write the failing constants test**

Create `tests/unit/constants.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { BUSINESS, HERO_HEADLINE, COLORS, SECTIONS } from '@/lib/constants';

describe('constants', () => {
  it('carries the real business details', () => {
    expect(BUSINESS.name).toBe('Firehouse Movers Inc.');
    expect(BUSINESS.address).toBe('2535-B Texas 121 E, State #140, Lewisville, TX 75056');
    expect(BUSINESS.phone).toBe('(972) 992-1969');
    expect(BUSINESS.phoneHref).toBe('tel:+19729921969');
    expect(BUSINESS.email).toBe('support@firehousemovers.com');
  });

  it('carries the hero headline', () => {
    expect(HERO_HEADLINE).toBe('The moving service we needed, so we built it for you');
  });

  it('carries the exact palette', () => {
    expect(COLORS.darkBg).toBe('#08070A');
    expect(COLORS.lightBg).toBe('#F4F0E9');
    expect(COLORS.fireRed).toBe('#E23D28');
    expect(COLORS.emberAmber).toBe('#FF8A3D');
  });

  it('defines contiguous section ranges covering 0 to 1', () => {
    const ranges = Object.values(SECTIONS);
    expect(ranges[0][0]).toBe(0);
    expect(ranges[ranges.length - 1][1]).toBe(1);
    for (let i = 1; i < ranges.length; i++) {
      expect(ranges[i][0]).toBeCloseTo(ranges[i - 1][1], 5);
    }
  });
});
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `npm test -- tests/unit/constants.test.ts`
Expected: FAIL — cannot resolve `@/lib/constants`.

- [ ] **Step 6: Write `lib/constants.ts`**

```ts
export const BUSINESS = {
  name: 'Firehouse Movers Inc.',
  address: '2535-B Texas 121 E, State #140, Lewisville, TX 75056',
  phone: '(972) 992-1969',
  phoneHref: 'tel:+19729921969',
  email: 'support@firehousemovers.com',
} as const;

export const HERO_HEADLINE =
  'The moving service we needed, so we built it for you';

export const COLORS = {
  darkBg: '#08070A',
  darkFog: '#0D0B12',
  lightBg: '#F4F0E9',
  lightFog: '#E8E2D6',
  ink: '#1A1917',
  bone: '#F4F0E9',
  fireRed: '#E23D28',
  emberAmber: '#FF8A3D',
} as const;

export const SECTIONS = {
  hero: [0.0, 0.15],
  services: [0.15, 0.35],
  moveAsOne: [0.35, 0.6],
  guarantees: [0.6, 0.75],
  testimonials: [0.75, 0.9],
  cta: [0.9, 1.0],
} as const satisfies Record<string, readonly [number, number]>;
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `npm test -- tests/unit/constants.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 8: Wire the palette into `app/globals.css`**

Replace the scaffold's `globals.css` body with:

```css
@import "tailwindcss";

@theme {
  --color-dark-bg: #08070A;
  --color-dark-fog: #0D0B12;
  --color-light-bg: #F4F0E9;
  --color-light-fog: #E8E2D6;
  --color-ink: #1A1917;
  --color-bone: #F4F0E9;
  --color-fire: #E23D28;
  --color-ember: #FF8A3D;
}

:root {
  /* Driven at runtime by the scroll pipeline (Task 3). */
  --page-bg: #08070A;
  --page-ink: #F4F0E9;
}

html {
  background-color: var(--page-bg);
  color: var(--page-ink);
}

body {
  margin: 0;
  min-height: 100vh;
  background-color: var(--page-bg);
  color: var(--page-ink);
  transition: none;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

- [ ] **Step 9: Verify the app builds and runs**

Run: `npm run build`
Expected: build completes with no errors.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app with palette tokens and business constants"
```

---

### Task 2: Scroll progress store and math

The single source of truth every later task reads. Pure functions first, tested in isolation, then the Zustand store that holds the value.

**Files:**
- Create: `lib/scroll-math.ts`
- Create: `lib/scroll-store.ts`
- Create: `tests/unit/scroll-math.test.ts`

**Interfaces:**
- Consumes: `SECTIONS` from `lib/constants.ts` (Task 1)
- Produces:
  - `lib/scroll-math.ts` exporting
    - `clamp01(n: number): number`
    - `normalizeScroll(scrollY: number, scrollHeight: number, viewportHeight: number): number`
    - `rangeProgress(p: number, range: readonly [number, number]): number` — 0 before the range, 1 after, linear within
    - `lerp(a: number, b: number, t: number): number`
  - `lib/scroll-store.ts` exporting
    - `useScrollStore` — Zustand store with `{ progress: number; velocity: number; setScroll(progress: number, velocity: number): void }`
    - `getScrollProgress(): number` — non-reactive read for use inside `useFrame`

- [ ] **Step 1: Write the failing scroll-math test**

Create `tests/unit/scroll-math.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { clamp01, normalizeScroll, rangeProgress, lerp } from '@/lib/scroll-math';

describe('clamp01', () => {
  it('clamps below zero and above one', () => {
    expect(clamp01(-3)).toBe(0);
    expect(clamp01(0.42)).toBe(0.42);
    expect(clamp01(9)).toBe(1);
  });
});

describe('normalizeScroll', () => {
  it('is 0 at the top and 1 at the bottom', () => {
    expect(normalizeScroll(0, 3000, 1000)).toBe(0);
    expect(normalizeScroll(2000, 3000, 1000)).toBe(1);
  });

  it('is linear in between', () => {
    expect(normalizeScroll(1000, 3000, 1000)).toBeCloseTo(0.5, 5);
  });

  it('returns 0 when the page does not scroll', () => {
    expect(normalizeScroll(0, 800, 1000)).toBe(0);
  });

  it('clamps overscroll', () => {
    expect(normalizeScroll(9999, 3000, 1000)).toBe(1);
    expect(normalizeScroll(-50, 3000, 1000)).toBe(0);
  });
});

describe('rangeProgress', () => {
  it('is 0 before the range and 1 after it', () => {
    expect(rangeProgress(0.1, [0.6, 0.75])).toBe(0);
    expect(rangeProgress(0.9, [0.6, 0.75])).toBe(1);
  });

  it('is linear within the range', () => {
    expect(rangeProgress(0.675, [0.6, 0.75])).toBeCloseTo(0.5, 5);
    expect(rangeProgress(0.6, [0.6, 0.75])).toBe(0);
    expect(rangeProgress(0.75, [0.6, 0.75])).toBe(1);
  });

  it('is monotonic across the range', () => {
    let prev = -1;
    for (let p = 0; p <= 1.0001; p += 0.01) {
      const v = rangeProgress(p, [0.6, 0.75]);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });
});

describe('lerp', () => {
  it('interpolates endpoints exactly', () => {
    expect(lerp(10, 20, 0)).toBe(10);
    expect(lerp(10, 20, 1)).toBe(20);
    expect(lerp(10, 20, 0.5)).toBe(15);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/unit/scroll-math.test.ts`
Expected: FAIL — cannot resolve `@/lib/scroll-math`.

- [ ] **Step 3: Write `lib/scroll-math.ts`**

```ts
export function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

export function normalizeScroll(
  scrollY: number,
  scrollHeight: number,
  viewportHeight: number,
): number {
  const scrollable = scrollHeight - viewportHeight;
  if (scrollable <= 0) return 0;
  return clamp01(scrollY / scrollable);
}

export function rangeProgress(
  p: number,
  range: readonly [number, number],
): number {
  const [start, end] = range;
  const span = end - start;
  if (span <= 0) return p >= end ? 1 : 0;
  return clamp01((p - start) / span);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- tests/unit/scroll-math.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Write `lib/scroll-store.ts`**

No test — this is a thin Zustand wrapper with no logic of its own; the math it depends on is covered above.

```ts
'use client';

import { create } from 'zustand';

type ScrollState = {
  progress: number;
  velocity: number;
  setScroll: (progress: number, velocity: number) => void;
};

export const useScrollStore = create<ScrollState>((set) => ({
  progress: 0,
  velocity: 0,
  setScroll: (progress, velocity) => set({ progress, velocity }),
}));

/**
 * Non-reactive read. Use inside useFrame and other rAF loops so they read
 * the live value without subscribing the component to re-renders.
 */
export function getScrollProgress(): number {
  return useScrollStore.getState().progress;
}

export function getScrollVelocity(): number {
  return useScrollStore.getState().velocity;
}
```

- [ ] **Step 6: Commit**

```bash
git add lib/scroll-math.ts lib/scroll-store.ts tests/unit/scroll-math.test.ts
git commit -m "feat: add scroll progress math and shared store"
```

---

### Task 3: Theme interpolation

The dark→light dissolve, defined once as a pure function of scroll progress and consumed by both the 3D scene and the HTML layer.

**Files:**
- Create: `lib/theme.ts`
- Create: `tests/unit/theme.test.ts`

**Interfaces:**
- Consumes: `COLORS`, `SECTIONS` (Task 1); `rangeProgress`, `lerp` (Task 2)
- Produces: `lib/theme.ts` exporting
  - `type ThemeValues = { bg: string; fog: string; ink: string; lightIntensity: number; bloomIntensity: number; emberOpacity: number }`
  - `themeAt(p: number): ThemeValues`
  - `mixHex(a: string, b: string, t: number): string`

- [ ] **Step 1: Write the failing theme test**

Create `tests/unit/theme.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { themeAt, mixHex } from '@/lib/theme';
import { COLORS } from '@/lib/constants';

describe('mixHex', () => {
  it('returns the endpoints exactly', () => {
    expect(mixHex('#000000', '#FFFFFF', 0)).toBe('#000000');
    expect(mixHex('#000000', '#FFFFFF', 1)).toBe('#ffffff');
  });

  it('mixes the midpoint', () => {
    expect(mixHex('#000000', '#FFFFFF', 0.5)).toBe('#808080');
  });
});

describe('themeAt', () => {
  it('is fully dark through the hero and the set-piece', () => {
    for (const p of [0, 0.1, 0.3, 0.5, 0.6]) {
      expect(themeAt(p).bg.toLowerCase()).toBe(COLORS.darkBg.toLowerCase());
    }
  });

  it('is fully light after the dissolve completes', () => {
    for (const p of [0.75, 0.85, 1]) {
      expect(themeAt(p).bg.toLowerCase()).toBe(COLORS.lightBg.toLowerCase());
    }
  });

  it('is partway through the dissolve at its midpoint', () => {
    const mid = themeAt(0.675).bg.toLowerCase();
    expect(mid).not.toBe(COLORS.darkBg.toLowerCase());
    expect(mid).not.toBe(COLORS.lightBg.toLowerCase());
  });

  it('drops bloom to zero in the light and peaks it in the dark', () => {
    expect(themeAt(0.5).bloomIntensity).toBeGreaterThan(themeAt(1).bloomIntensity);
    expect(themeAt(1).bloomIntensity).toBe(0);
  });

  it('fades embers out across the dissolve', () => {
    expect(themeAt(0.6).emberOpacity).toBe(1);
    expect(themeAt(0.75).emberOpacity).toBe(0);
  });

  it('moves bloom monotonically downward across the dissolve', () => {
    let prev = Infinity;
    for (let p = 0.6; p <= 0.7501; p += 0.01) {
      const v = themeAt(p).bloomIntensity;
      expect(v).toBeLessThanOrEqual(prev + 1e-9);
      prev = v;
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/unit/theme.test.ts`
Expected: FAIL — cannot resolve `@/lib/theme`.

- [ ] **Step 3: Write `lib/theme.ts`**

```ts
import { COLORS, SECTIONS } from './constants';
import { rangeProgress, lerp } from './scroll-math';

export type ThemeValues = {
  bg: string;
  fog: string;
  ink: string;
  lightIntensity: number;
  bloomIntensity: number;
  emberOpacity: number;
};

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function toHex(n: number): string {
  return Math.round(n).toString(16).padStart(2, '0');
}

export function mixHex(a: string, b: string, t: number): string {
  if (t <= 0) return a;
  if (t >= 1) return `#${hexToRgb(b).map(toHex).join('')}`;
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return `#${toHex(lerp(ar, br, t))}${toHex(lerp(ag, bg, t))}${toHex(lerp(ab, bb, t))}`;
}

/**
 * The dark to light dissolve. Every value is a function of scroll
 * progress, interpolated across the Guarantees range and nowhere else.
 */
export function themeAt(p: number): ThemeValues {
  const t = rangeProgress(p, SECTIONS.guarantees);
  return {
    bg: mixHex(COLORS.darkBg, COLORS.lightBg, t),
    fog: mixHex(COLORS.darkFog, COLORS.lightFog, t),
    ink: mixHex(COLORS.bone, COLORS.ink, t),
    lightIntensity: lerp(0.6, 2.4, t),
    bloomIntensity: lerp(1.15, 0, t),
    emberOpacity: lerp(1, 0, t),
  };
}
```

Note `mixHex` normalizes case at `t >= 1` so the endpoint comparison in the test is stable.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- tests/unit/theme.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/theme.ts tests/unit/theme.test.ts
git commit -m "feat: add scroll-driven dark to light theme interpolation"
```

---

### Task 4: Camera spline

The camera path both pages travel, expressed as a pure sampling function so it can be tested without a renderer.

**Files:**
- Create: `lib/camera-path.ts`
- Create: `tests/unit/camera-path.test.ts`

**Interfaces:**
- Consumes: `clamp01` (Task 2)
- Produces: `lib/camera-path.ts` exporting
  - `type CameraSample = { position: [number, number, number]; lookAt: [number, number, number]; fov: number }`
  - `sampleHomeCamera(p: number): CameraSample`
  - `sampleAboutCamera(p: number): CameraSample`

- [ ] **Step 1: Write the failing camera-path test**

Create `tests/unit/camera-path.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { sampleHomeCamera, sampleAboutCamera } from '@/lib/camera-path';

describe('sampleHomeCamera', () => {
  it('returns a finite sample across the whole range', () => {
    for (let p = 0; p <= 1.0001; p += 0.05) {
      const s = sampleHomeCamera(p);
      expect(s.position.every(Number.isFinite)).toBe(true);
      expect(s.lookAt.every(Number.isFinite)).toBe(true);
      expect(Number.isFinite(s.fov)).toBe(true);
    }
  });

  it('clamps out-of-range input to the endpoints', () => {
    expect(sampleHomeCamera(-1)).toEqual(sampleHomeCamera(0));
    expect(sampleHomeCamera(2)).toEqual(sampleHomeCamera(1));
  });

  it('pulls the camera back between the hero and the services grid', () => {
    expect(sampleHomeCamera(0.3).position[2]).toBeGreaterThan(
      sampleHomeCamera(0).position[2],
    );
  });

  it('is continuous — no jumps between adjacent samples', () => {
    let prev = sampleHomeCamera(0).position;
    for (let p = 0.01; p <= 1.0001; p += 0.01) {
      const cur = sampleHomeCamera(p).position;
      const d = Math.hypot(cur[0] - prev[0], cur[1] - prev[1], cur[2] - prev[2]);
      expect(d).toBeLessThan(1.5);
      prev = cur;
    }
  });
});

describe('sampleAboutCamera', () => {
  it('returns finite samples and is continuous', () => {
    let prev = sampleAboutCamera(0).position;
    for (let p = 0.01; p <= 1.0001; p += 0.01) {
      const cur = sampleAboutCamera(p).position;
      expect(cur.every(Number.isFinite)).toBe(true);
      const d = Math.hypot(cur[0] - prev[0], cur[1] - prev[1], cur[2] - prev[2]);
      expect(d).toBeLessThan(1.5);
      prev = cur;
    }
  });

  it('follows a different path from the home page', () => {
    expect(sampleAboutCamera(0.5).position).not.toEqual(
      sampleHomeCamera(0.5).position,
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/unit/camera-path.test.ts`
Expected: FAIL — cannot resolve `@/lib/camera-path`.

- [ ] **Step 3: Write `lib/camera-path.ts`**

Uses a Catmull-Rom evaluation over fixed control points. Kept dependency-free (no `three` import) so the tests run in plain jsdom.

```ts
import { clamp01 } from './scroll-math';

export type CameraSample = {
  position: [number, number, number];
  lookAt: [number, number, number];
  fov: number;
};

type Vec3 = [number, number, number];

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number) {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
}

function sampleSpline(points: Vec3[], p: number): Vec3 {
  const t = clamp01(p);
  const n = points.length - 1;
  const scaled = t * n;
  const i = Math.min(Math.floor(scaled), n - 1);
  const local = scaled - i;
  const p0 = points[Math.max(0, i - 1)];
  const p1 = points[i];
  const p2 = points[i + 1];
  const p3 = points[Math.min(n, i + 2)];
  return [
    catmullRom(p0[0], p1[0], p2[0], p3[0], local),
    catmullRom(p0[1], p1[1], p2[1], p3[1], local),
    catmullRom(p0[2], p1[2], p2[2], p3[2], local),
  ];
}

// Hero → services pullback → set-piece → dissolve → light close.
const HOME_POSITIONS: Vec3[] = [
  [0, 0.2, 6.0],
  [0.4, 0.8, 7.4],
  [-0.6, 1.2, 8.2],
  [0, 0.6, 7.0],
  [1.2, 0.9, 8.6],
  [0, 1.4, 10.0],
];

const HOME_TARGETS: Vec3[] = [
  [0, 0, 0],
  [0, 0.1, 0],
  [0, 0.2, 0],
  [0, 0.1, 0],
  [-0.8, 0.2, 0],
  [-1.6, 0.3, 0],
];

// Calmer, shorter, stays wide.
const ABOUT_POSITIONS: Vec3[] = [
  [1.4, 0.6, 7.2],
  [0.8, 1.0, 7.8],
  [-0.4, 1.1, 8.4],
  [-1.0, 1.3, 9.0],
];

const ABOUT_TARGETS: Vec3[] = [
  [0, 0.2, 0],
  [0, 0.3, 0],
  [0, 0.3, 0],
  [0, 0.4, 0],
];

export function sampleHomeCamera(p: number): CameraSample {
  const t = clamp01(p);
  return {
    position: sampleSpline(HOME_POSITIONS, t),
    lookAt: sampleSpline(HOME_TARGETS, t),
    fov: 42 + t * 6,
  };
}

export function sampleAboutCamera(p: number): CameraSample {
  const t = clamp01(p);
  return {
    position: sampleSpline(ABOUT_POSITIONS, t),
    lookAt: sampleSpline(ABOUT_TARGETS, t),
    fov: 46,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- tests/unit/camera-path.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/camera-path.ts tests/unit/camera-path.test.ts
git commit -m "feat: add home and about camera splines"
```

---

### Task 5: Capability detection, Lenis provider, and the persistent canvas

Mounts the one canvas the app is allowed to have, wires Lenis into the store, publishes theme values to CSS custom properties, and enforces the reduced-motion and mobile fallbacks. Ends with a placeholder mesh proving scroll drives the camera — the first thing you can look at.

**Files:**
- Create: `lib/use-canvas-enabled.ts`
- Create: `components/scene/SceneCanvas.tsx`
- Create: `components/scene/CameraRig.tsx`
- Create: `components/scene/ThemeSync.tsx`
- Create: `components/providers/SmoothScrollProvider.tsx`
- Modify: `app/layout.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `useScrollStore`, `getScrollProgress` (Task 2); `themeAt` (Task 3); `sampleHomeCamera`, `sampleAboutCamera` (Task 4); `COLORS` (Task 1)
- Produces:
  - `useCanvasEnabled(): boolean` — false under `prefers-reduced-motion` or below 768px, true otherwise; always false on the server render pass
  - `<SmoothScrollProvider>{children}</SmoothScrollProvider>`
  - `<SceneCanvas />` — the app's only `<Canvas>`; renders `null` when `useCanvasEnabled()` is false
  - `<CameraRig />` — drives the camera each frame from scroll progress
  - Scene components mount as children of `<SceneCanvas />` in later tasks

- [ ] **Step 1: Write `lib/use-canvas-enabled.ts`**

```ts
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
```

- [ ] **Step 2: Write the Lenis provider**

Create `components/providers/SmoothScrollProvider.tsx`. It owns the rAF loop, feeds the store, and publishes theme values to CSS custom properties so the HTML layer tracks the 3D exactly.

```tsx
'use client';

import { useEffect } from 'react';
import Lenis from 'lenis';
import { useScrollStore } from '@/lib/scroll-store';
import { normalizeScroll } from '@/lib/scroll-math';
import { themeAt } from '@/lib/theme';

export function SmoothScrollProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const setScroll = useScrollStore.getState().setScroll;

    const publish = (progress: number, velocity: number) => {
      setScroll(progress, velocity);
      const theme = themeAt(progress);
      const root = document.documentElement;
      root.style.setProperty('--page-bg', theme.bg);
      root.style.setProperty('--page-ink', theme.ink);
    };

    if (reduced) {
      const onScroll = () => {
        publish(
          normalizeScroll(
            window.scrollY,
            document.documentElement.scrollHeight,
            window.innerHeight,
          ),
          0,
        );
      };
      onScroll();
      window.addEventListener('scroll', onScroll, { passive: true });
      return () => window.removeEventListener('scroll', onScroll);
    }

    const lenis = new Lenis({ duration: 1.1, smoothWheel: true });

    lenis.on('scroll', ({ scroll, limit, velocity }) => {
      publish(limit > 0 ? Math.min(1, Math.max(0, scroll / limit)) : 0, velocity);
    });

    let raf = 0;
    const loop = (time: number) => {
      lenis.raf(time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
    };
  }, []);

  return <>{children}</>;
}
```

- [ ] **Step 3: Write the camera rig**

Create `components/scene/CameraRig.tsx`:

```tsx
'use client';

import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { usePathname } from 'next/navigation';
import * as THREE from 'three';
import { getScrollProgress } from '@/lib/scroll-store';
import { sampleHomeCamera, sampleAboutCamera } from '@/lib/camera-path';

const target = new THREE.Vector3();
const look = new THREE.Vector3();

export function CameraRig() {
  const { camera } = useThree();
  const pathname = usePathname();
  const pointer = useRef({ x: 0, y: 0 });

  useFrame((state, delta) => {
    const p = getScrollProgress();
    const sample =
      pathname === '/about' ? sampleAboutCamera(p) : sampleHomeCamera(p);

    // Mouse parallax, deliberately small — it reads as depth, not motion.
    pointer.current.x += (state.pointer.x * 0.35 - pointer.current.x) * 0.05;
    pointer.current.y += (state.pointer.y * 0.2 - pointer.current.y) * 0.05;

    target.set(
      sample.position[0] + pointer.current.x,
      sample.position[1] + pointer.current.y,
      sample.position[2],
    );
    camera.position.lerp(target, Math.min(1, delta * 4));

    look.set(...sample.lookAt);
    camera.lookAt(look);

    const cam = camera as THREE.PerspectiveCamera;
    if (cam.isPerspectiveCamera && Math.abs(cam.fov - sample.fov) > 0.01) {
      cam.fov += (sample.fov - cam.fov) * Math.min(1, delta * 4);
      cam.updateProjectionMatrix();
    }
  });

  return null;
}
```

- [ ] **Step 4: Write the theme sync for the scene side**

Create `components/scene/ThemeSync.tsx`. This is the 3D half of the dissolve — the CSS half already runs in the provider.

```tsx
'use client';

import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { getScrollProgress } from '@/lib/scroll-store';
import { themeAt } from '@/lib/theme';

export function ThemeSync() {
  const { scene } = useThree();
  const fog = useRef(new THREE.Fog('#0D0B12', 6, 22));
  const bg = useRef(new THREE.Color('#08070A'));

  useFrame(() => {
    const theme = themeAt(getScrollProgress());
    fog.current.color.set(theme.fog);
    bg.current.set(theme.bg);
    scene.fog = fog.current;
    scene.background = bg.current;
  });

  return null;
}
```

- [ ] **Step 5: Write the canvas**

Create `components/scene/SceneCanvas.tsx`. This is the only `<Canvas>` in the app. The placeholder mesh is removed in Task 6.

```tsx
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
```

- [ ] **Step 6: Wire both into the root layout**

Replace `app/layout.tsx`:

```tsx
import type { Metadata } from 'next';
import './globals.css';
import { SmoothScrollProvider } from '@/components/providers/SmoothScrollProvider';
import { SceneCanvas } from '@/components/scene/SceneCanvas';
import { BUSINESS } from '@/lib/constants';

export const metadata: Metadata = {
  title: `${BUSINESS.name} — Moving, Packing & Storage in Lewisville, TX`,
  description:
    'Local and long-distance movers serving Lewisville and the greater DFW area. Residential, commercial, packing, and climate-controlled storage.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="relative">
        <SmoothScrollProvider>
          <SceneCanvas />
          <div className="relative z-10">{children}</div>
        </SmoothScrollProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 7: Give the page enough height to scroll**

Replace `app/page.tsx` with a temporary scaffold so the camera has something to travel against:

```tsx
export default function Home() {
  return (
    <main>
      {['Hero', 'Services', 'Move as One', 'Guarantees', 'Testimonials', 'CTA'].map(
        (name) => (
          <section
            key={name}
            className="flex h-screen items-center justify-center"
          >
            <h2 className="text-4xl font-semibold">{name}</h2>
          </section>
        ),
      )}
    </main>
  );
}
```

- [ ] **Step 8: Verify by eye**

Run `npm run dev` and open the page. Confirm all of:
- The red placeholder cube is visible behind the section labels.
- Scrolling moves the camera — the cube changes position and size.
- Scrolling past roughly 60% fades the background from near-black to cream, and the text flips from bone to dark ink at the same time.
- Moving the mouse produces a small parallax shift.
- With the browser window narrowed below 768px, the canvas disappears and the text remains readable.
- With reduced motion enabled at the OS level, the canvas disappears and scrolling still updates the background color.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: add persistent canvas, Lenis scroll pipeline, and camera rig"
```

---

### Task 6: Dark scene — embers and the box stack

Replaces the placeholder with the real hero scene: a GPU-instanced ember field on a custom shader and a slowly rotating stack of procedural boxes with one glass box among them.

**Files:**
- Create: `components/scene/Embers.tsx`
- Create: `components/scene/BoxStack.tsx`
- Create: `components/scene/Effects.tsx`
- Modify: `components/scene/SceneCanvas.tsx`

**Interfaces:**
- Consumes: `getScrollProgress` (Task 2); `themeAt` (Task 3); `COLORS` (Task 1)
- Produces: `<Embers />`, `<BoxStack />`, `<Effects />` — all mount as children of `<SceneCanvas />` and read scroll progress from the store; none take props

- [ ] **Step 1: Write the ember field**

Create `components/scene/Embers.tsx`. Points with a custom shader — a few thousand particles, one draw call.

```tsx
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
```

- [ ] **Step 2: Write the box stack**

Create `components/scene/BoxStack.tsx`. Nine boxes from primitives, one of them glass.

```tsx
'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { MeshTransmissionMaterial } from '@react-three/drei';
import * as THREE from 'three';
import { getScrollProgress } from '@/lib/scroll-store';
import { COLORS } from '@/lib/constants';

type Box = {
  position: [number, number, number];
  size: [number, number, number];
  rotation: number;
  glass?: boolean;
};

const BOXES: Box[] = [
  { position: [0, -1.05, 0], size: [1.5, 0.9, 1.3], rotation: 0.04 },
  { position: [-0.75, -0.3, 0.2], size: [1.1, 0.7, 1.0], rotation: -0.12 },
  { position: [0.62, -0.32, -0.15], size: [1.0, 0.66, 0.95], rotation: 0.18 },
  { position: [-0.1, 0.32, 0.05], size: [1.25, 0.62, 1.05], rotation: 0.07, glass: true },
  { position: [0.7, 0.86, 0.3], size: [0.8, 0.5, 0.75], rotation: -0.25 },
  { position: [-0.66, 0.9, -0.2], size: [0.9, 0.55, 0.8], rotation: 0.3 },
  { position: [0.05, 1.42, 0.1], size: [0.7, 0.45, 0.68], rotation: -0.08 },
  { position: [-1.35, -0.85, -0.55], size: [0.75, 0.5, 0.7], rotation: 0.42 },
  { position: [1.4, -0.9, -0.4], size: [0.85, 0.55, 0.78], rotation: -0.36 },
];

export function BoxStack() {
  const group = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    if (!group.current) return;
    const p = getScrollProgress();
    group.current.rotation.y += delta * 0.12;
    group.current.position.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.06;
    // Recedes as the camera pulls back toward the services grid.
    const scale = 1 - p * 0.45;
    group.current.scale.setScalar(Math.max(0.4, scale));
  });

  return (
    <group ref={group}>
      {BOXES.map((box, i) =>
        box.glass ? (
          <mesh key={i} position={box.position} rotation={[0, box.rotation, 0]}>
            <boxGeometry args={box.size} />
            <MeshTransmissionMaterial
              thickness={0.6}
              roughness={0.08}
              transmission={1}
              ior={1.4}
              chromaticAberration={0.06}
              backside
              color="#FFE7D2"
            />
          </mesh>
        ) : (
          <mesh key={i} position={box.position} rotation={[0, box.rotation, 0]}>
            <boxGeometry args={box.size} />
            <meshStandardMaterial
              color="#8A6B4F"
              roughness={0.85}
              metalness={0.05}
              emissive={COLORS.fireRed}
              emissiveIntensity={0.04}
            />
          </mesh>
        ),
      )}
    </group>
  );
}
```

- [ ] **Step 3: Write the postprocessing stack**

Create `components/scene/Effects.tsx`. Bloom intensity is driven by the theme, so it falls away as the page turns light.

```tsx
'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { EffectComposer, Bloom, ChromaticAberration, Vignette } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { getScrollProgress } from '@/lib/scroll-store';
import { themeAt } from '@/lib/theme';

export function Effects() {
  const bloom = useRef<{ intensity: number }>(null);

  useFrame(() => {
    if (bloom.current) {
      bloom.current.intensity = themeAt(getScrollProgress()).bloomIntensity;
    }
  });

  return (
    <EffectComposer multisampling={0}>
      <Bloom
        ref={bloom as never}
        intensity={1.15}
        luminanceThreshold={0.25}
        luminanceSmoothing={0.9}
        mipmapBlur
      />
      <ChromaticAberration
        blendFunction={BlendFunction.NORMAL}
        offset={[0.0004, 0.0006]}
      />
      <Vignette eskil={false} offset={0.25} darkness={0.6} />
    </EffectComposer>
  );
}
```

- [ ] **Step 4: Replace the placeholder in the canvas**

In `components/scene/SceneCanvas.tsx`, delete the placeholder `<mesh>` block and its comment, add the three imports, and render the scene:

```tsx
        <ThemeSync />
        <CameraRig />
        <ambientLight intensity={0.4} />
        <pointLight position={[2, 3, 4]} intensity={8} color="#FF8A3D" />
        <pointLight position={[-3, -1, 2]} intensity={4} color="#E23D28" />
        <directionalLight position={[0, 6, 3]} intensity={0.8} />
        <BoxStack />
        <Embers />
        {!degraded && <Effects />}
```

Imports to add at the top:

```tsx
import { BoxStack } from './BoxStack';
import { Embers } from './Embers';
import { Effects } from './Effects';
```

- [ ] **Step 5: Verify by eye**

Run `npm run dev`. Confirm:
- Embers drift upward continuously and glow additively.
- The box stack rotates slowly; the glass box refracts what is behind it.
- Bloom is visible in the dark section and gone by the time the page is cream.
- Embers fade out across the dissolve.
- Frame rate holds at 60fps.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add ember shader, procedural box stack, and postprocessing"
```

---

### Task 7: UI primitives

The reusable pieces every section needs. Built once here so section tasks stay short.

**Files:**
- Create: `components/ui/RevealText.tsx`
- Create: `components/ui/TiltCard.tsx`
- Create: `components/ui/Counter.tsx`
- Create: `components/ui/Button.tsx`
- Create: `lib/use-reduced-motion.ts`

**Interfaces:**
- Consumes: `COLORS` (Task 1)
- Produces:
  - `useReducedMotion(): boolean`
  - `<RevealText as?: 'h1'|'h2'|'h3'|'p'; className?: string; delay?: number>{string}</RevealText>` — splits on words, masked line reveal via GSAP; renders the full string in the server HTML
  - `<TiltCard className?: string>{children}</TiltCard>` — cursor-tracked 3D tilt with a pointer-following light sweep
  - `<Counter to: number; suffix?: string; className?: string />` — counts up when scrolled into view
  - `<Button href: string; variant?: 'primary'|'ghost'; className?: string>{children}</Button>`

- [ ] **Step 1: Write the reduced-motion hook**

Create `lib/use-reduced-motion.ts`:

```ts
'use client';

import { useEffect, useState } from 'react';

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return reduced;
}
```

- [ ] **Step 2: Write `RevealText`**

Create `components/ui/RevealText.tsx`. The full text is always in the DOM — the animation only moves it.

```tsx
'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useReducedMotion } from '@/lib/use-reduced-motion';

gsap.registerPlugin(ScrollTrigger);

type Props = {
  children: string;
  as?: 'h1' | 'h2' | 'h3' | 'p';
  className?: string;
  delay?: number;
};

export function RevealText({
  children,
  as: Tag = 'h2',
  className = '',
  delay = 0,
}: Props) {
  const root = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced || !root.current) return;
    const words = root.current.querySelectorAll('[data-word]');
    const ctx = gsap.context(() => {
      gsap.from(words, {
        yPercent: 110,
        opacity: 0,
        duration: 0.9,
        ease: 'power3.out',
        stagger: 0.035,
        delay,
        scrollTrigger: { trigger: root.current, start: 'top 85%' },
      });
    }, root);
    return () => ctx.revert();
  }, [reduced, delay]);

  return (
    <Tag ref={root as never} className={className}>
      {children.split(' ').map((word, i) => (
        <span key={i} className="inline-block overflow-hidden align-bottom">
          <span data-word className="inline-block">
            {word}
            {' '}
          </span>
        </span>
      ))}
    </Tag>
  );
}
```

- [ ] **Step 3: Write `TiltCard`**

Create `components/ui/TiltCard.tsx`:

```tsx
'use client';

import { useRef } from 'react';
import { useReducedMotion } from '@/lib/use-reduced-motion';

export function TiltCard({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (reduced || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    ref.current.style.transform = `perspective(900px) rotateY(${(x - 0.5) * 10}deg) rotateX(${(0.5 - y) * 10}deg) translateZ(0)`;
    ref.current.style.setProperty('--mx', `${x * 100}%`);
    ref.current.style.setProperty('--my', `${y * 100}%`);
  };

  const onLeave = () => {
    if (!ref.current) return;
    ref.current.style.transform =
      'perspective(900px) rotateY(0deg) rotateX(0deg)';
  };

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={`relative overflow-hidden rounded-2xl border border-current/10 bg-current/[0.03] backdrop-blur-sm transition-transform duration-300 ease-out ${className}`}
      style={
        {
          '--mx': '50%',
          '--my': '50%',
        } as React.CSSProperties
      }
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 hover:opacity-100"
        style={{
          background:
            'radial-gradient(400px circle at var(--mx) var(--my), rgba(255,138,61,0.14), transparent 60%)',
        }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}
```

- [ ] **Step 4: Write `Counter`**

Create `components/ui/Counter.tsx`:

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '@/lib/use-reduced-motion';

export function Counter({
  to,
  suffix = '',
  className = '',
}: {
  to: number;
  suffix?: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) {
      setValue(to);
      return;
    }
    const el = ref.current;
    if (!el) return;

    let raf = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / 1800);
          const eased = 1 - Math.pow(1 - t, 3);
          setValue(Math.round(to * eased));
          if (t < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    observer.observe(el);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [to, reduced]);

  return (
    <span ref={ref} className={className}>
      {value.toLocaleString('en-US')}
      {suffix}
    </span>
  );
}
```

- [ ] **Step 5: Write `Button`**

Create `components/ui/Button.tsx`:

```tsx
import Link from 'next/link';

export function Button({
  href,
  children,
  variant = 'primary',
  className = '',
}: {
  href: string;
  children: React.ReactNode;
  variant?: 'primary' | 'ghost';
  className?: string;
}) {
  const base =
    'inline-flex items-center justify-center rounded-full px-7 py-3.5 text-sm font-semibold tracking-wide transition-all duration-300';
  const styles =
    variant === 'primary'
      ? 'bg-fire text-white hover:brightness-110 hover:shadow-[0_0_36px_-6px_#E23D28]'
      : 'border border-current/30 hover:border-current/70';

  const external = href.startsWith('tel:') || href.startsWith('mailto:');
  const Cmp = external ? 'a' : Link;

  return (
    <Cmp href={href} className={`${base} ${styles} ${className}`}>
      {children}
    </Cmp>
  );
}
```

- [ ] **Step 6: Verify it compiles**

Run: `npm run build`
Expected: build completes with no type errors.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add RevealText, TiltCard, Counter, and Button primitives"
```

---

### Task 8: Home — Hero and Services sections

The first two real sections, plus the nav.

**Files:**
- Create: `components/ui/Nav.tsx`
- Create: `components/sections/Hero.tsx`
- Create: `components/sections/Services.tsx`
- Create: `lib/content.ts`
- Modify: `app/page.tsx`
- Create: `tests/e2e/home.spec.ts`
- Create: `playwright.config.ts`

**Interfaces:**
- Consumes: `BUSINESS`, `HERO_HEADLINE` (Task 1); `RevealText`, `TiltCard`, `Button` (Task 7)
- Produces:
  - `lib/content.ts` exporting `SERVICES`, `GUARANTEES`, `TESTIMONIALS`, `TIMELINE`, `VALUES` — all typed arrays consumed by Tasks 8–11
  - `<Nav />`, `<Hero />`, `<Services />`

- [ ] **Step 1: Write the content file**

Create `lib/content.ts` — all page copy in one place so later section tasks only handle layout.

```ts
export const SERVICES = [
  {
    title: 'Local Moving',
    body: 'Same-day and next-day moves across Lewisville and the greater DFW area, with crews who know the neighborhoods.',
  },
  {
    title: 'Long-Distance',
    body: 'Federally licensed for interstate relocation. One crew, one truck, one point of contact from door to door.',
  },
  {
    title: 'Residential',
    body: 'Apartments to estates. We wrap, pad, load, and place every piece exactly where you want it.',
  },
  {
    title: 'Commercial',
    body: 'Office and retail relocations planned around your downtime, executed after hours and over weekends.',
  },
  {
    title: 'Packing',
    body: 'Full or partial packing with materials rated for fragile, high-value, and oversized items.',
  },
  {
    title: 'Storage',
    body: 'Climate-controlled short and long-term storage with full inventory tracking on every item.',
  },
] as const;

export const GUARANTEES = [
  {
    title: 'Fast moves',
    body: 'Crews sized to the job so your move finishes in a day, not a weekend.',
  },
  {
    title: 'Safe handling',
    body: 'Every item padded, inventoried, and inspected before it leaves and after it arrives.',
  },
  {
    title: 'On-time delivery',
    body: 'A delivery window we commit to in writing, and hit.',
  },
] as const;

export const TESTIMONIALS = [
  {
    quote:
      'The crew showed up early, wrapped everything, and had us unloaded before dinner. Not a single scratch.',
    name: 'Danielle R.',
    detail: 'Residential move, Lewisville',
  },
  {
    quote:
      'We moved a twelve-person office over one weekend and opened Monday like nothing happened.',
    name: 'Marcus T.',
    detail: 'Commercial relocation, Plano',
  },
  {
    quote:
      'They packed the whole kitchen, including my grandmother’s china. Everything arrived perfect.',
    name: 'Priya S.',
    detail: 'Packing & storage, Frisco',
  },
  {
    quote:
      'Quoted honestly, arrived on time, and stayed until every box was where I wanted it.',
    name: 'James O.',
    detail: 'Long-distance move, TX to CO',
  },
] as const;

export const TIMELINE = [
  {
    year: 'The start',
    title: 'Built out of frustration',
    body: 'We moved one too many times with crews who showed up late, quoted low, and billed high. So we built the company we kept wishing we could hire.',
  },
  {
    year: 'Growing',
    title: 'From one truck to a fleet',
    body: 'Word travelled through Lewisville faster than any advertising could. We added trucks, crews, and a climate-controlled facility to keep up.',
  },
  {
    year: 'Licensed',
    title: 'Cleared for the long haul',
    body: 'Federal licensing for interstate moving meant we could follow our customers wherever they were headed, not just across town.',
  },
  {
    year: 'Today',
    title: 'A franchise, still local',
    body: 'We have grown into a franchise without giving up the thing that started it — crews who treat your things like their own.',
  },
] as const;

export const VALUES = [
  {
    title: 'Show up',
    body: 'On the day we said, at the hour we said. The whole business rests on this one.',
  },
  {
    title: 'Quote it straight',
    body: 'The number we give you is the number you pay. No day-of surprises.',
  },
  {
    title: 'Handle it like ours',
    body: 'Padded, wrapped, inventoried. If it matters to you, it gets handled like it matters.',
  },
  {
    title: 'Finish the job',
    body: 'We are not done when the truck is empty. We are done when your home works.',
  },
] as const;
```

- [ ] **Step 2: Write the nav**

Create `components/ui/Nav.tsx`:

```tsx
import Link from 'next/link';
import { BUSINESS } from '@/lib/constants';
import { Button } from './Button';

export function Nav() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 mix-blend-difference">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 text-white">
        <Link href="/" className="text-sm font-bold tracking-[0.2em] uppercase">
          Firehouse
        </Link>
        <div className="flex items-center gap-8 text-sm">
          <Link href="/" className="hidden sm:inline hover:opacity-70">
            Home
          </Link>
          <Link href="/about" className="hidden sm:inline hover:opacity-70">
            About
          </Link>
          <a href={BUSINESS.phoneHref} className="hover:opacity-70">
            {BUSINESS.phone}
          </a>
        </div>
      </nav>
    </header>
  );
}
```

- [ ] **Step 3: Write the hero**

Create `components/sections/Hero.tsx`. The headline, CTA, and phone number are plain server-rendered markup — no client gating.

```tsx
import { BUSINESS, HERO_HEADLINE } from '@/lib/constants';
import { RevealText } from '@/components/ui/RevealText';
import { Button } from '@/components/ui/Button';

export function Hero() {
  return (
    <section className="relative flex min-h-screen items-center px-6">
      <div className="mx-auto w-full max-w-7xl">
        <p className="mb-8 text-xs font-semibold tracking-[0.3em] uppercase opacity-60">
          Lewisville, Texas · Licensed & Insured
        </p>
        <RevealText
          as="h1"
          className="max-w-5xl text-[clamp(2.5rem,7vw,6rem)] leading-[0.95] font-semibold tracking-tight"
        >
          {HERO_HEADLINE}
        </RevealText>
        <p className="mt-8 max-w-xl text-lg leading-relaxed opacity-70">
          Local and long-distance movers for homes and offices across the DFW
          area. Packing, storage, and a crew that shows up when we said we
          would.
        </p>
        <div className="mt-12 flex flex-wrap items-center gap-4">
          <Button href="#quote">Get a Quote</Button>
          <Button href={BUSINESS.phoneHref} variant="ghost">
            {BUSINESS.phone}
          </Button>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Write the services section**

Create `components/sections/Services.tsx`:

```tsx
import { SERVICES } from '@/lib/content';
import { RevealText } from '@/components/ui/RevealText';
import { TiltCard } from '@/components/ui/TiltCard';

export function Services() {
  return (
    <section id="services" className="relative px-6 py-32">
      <div className="mx-auto max-w-7xl">
        <RevealText
          as="h2"
          className="max-w-3xl text-[clamp(2rem,4.5vw,3.5rem)] leading-tight font-semibold tracking-tight"
        >
          Everything a move needs, under one roof
        </RevealText>
        <div className="mt-20 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((service, i) => (
            <TiltCard
              key={service.title}
              className={i % 4 === 0 ? 'lg:row-span-1 lg:mt-12' : ''}
            >
              <div className="p-8">
                <span className="text-xs font-semibold tracking-[0.2em] opacity-40">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h3 className="mt-6 text-2xl font-semibold">{service.title}</h3>
                <p className="mt-4 leading-relaxed opacity-70">{service.body}</p>
              </div>
            </TiltCard>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Wire them into the page**

Replace `app/page.tsx`:

```tsx
import { Nav } from '@/components/ui/Nav';
import { Hero } from '@/components/sections/Hero';
import { Services } from '@/components/sections/Services';

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Services />
        {/* Remaining sections land in Tasks 9-11. */}
        <div className="h-screen" />
      </main>
    </>
  );
}
```

- [ ] **Step 6: Configure Playwright**

Create `playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  use: { baseURL: 'http://localhost:3000' },
  webServer: {
    command: 'npm run build && npm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
```

- [ ] **Step 7: Write the failing smoke test**

Create `tests/e2e/home.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test('hero copy, CTA, and phone number are in the server HTML', async ({
  request,
}) => {
  const res = await request.get('/');
  const html = await res.text();
  expect(html).toContain('The moving service we needed');
  expect(html).toContain('(972) 992-1969');
  expect(html).toContain('tel:+19729921969');
  expect(html).toContain('Get a Quote');
});

test('home page renders with no console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  expect(errors).toEqual([]);
});
```

- [ ] **Step 8: Run the e2e tests**

Run: `npm run test:e2e`
Expected: both tests PASS. If the server-HTML test fails, the hero has been made client-only — fix the component, not the test.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: add nav, hero, and services sections with smoke tests"
```

---

### Task 9: Home — the Move as One set-piece

The pinned scroll-driven truck assembly. Highest-risk item, sequenced after the shell works so it never blocks anything.

**Files:**
- Create: `components/scene/TruckAssembly.tsx`
- Create: `components/sections/MoveAsOne.tsx`
- Modify: `components/scene/SceneCanvas.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `getScrollProgress` (Task 2); `rangeProgress` (Task 2); `SECTIONS`, `COLORS` (Task 1); `RevealText` (Task 7)
- Produces: `<TruckAssembly />` (mounts in `<SceneCanvas />`), `<MoveAsOne />` (mounts in `app/page.tsx`)

- [ ] **Step 1: Write the truck**

Create `components/scene/TruckAssembly.tsx`. Every part is a primitive. Parts fly in from offsets as the section's local progress advances.

```tsx
'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getScrollProgress } from '@/lib/scroll-store';
import { rangeProgress, clamp01, lerp } from '@/lib/scroll-math';
import { SECTIONS, COLORS } from '@/lib/constants';

type Part = {
  position: [number, number, number];
  size: [number, number, number];
  from: [number, number, number];
  at: number; // local progress at which this part starts arriving
  color: string;
};

const PARTS: Part[] = [
  // Chassis
  { position: [0, -0.55, 0], size: [4.6, 0.22, 1.8], from: [0, -6, 0], at: 0.0, color: '#2A2A2F' },
  // Cab
  { position: [-1.75, 0.15, 0], size: [1.2, 1.2, 1.7], from: [-8, 0, 0], at: 0.1, color: COLORS.fireRed },
  { position: [-1.2, 0.35, 0], size: [0.3, 0.7, 1.6], from: [-8, 0, 0], at: 0.14, color: '#12121A' },
  // Box body
  { position: [0.7, 0.5, 0], size: [3.0, 1.9, 1.75], from: [8, 0, 0], at: 0.22, color: '#D8D2C6' },
  // Wheels rendered separately below
];

const WHEELS: [number, number, number][] = [
  [-1.7, -0.75, 0.9],
  [-1.7, -0.75, -0.9],
  [1.2, -0.75, 0.9],
  [1.2, -0.75, -0.9],
];

const CARGO: { position: [number, number, number]; size: [number, number, number]; at: number }[] = [
  { position: [0.0, -0.15, 0], size: [0.6, 0.45, 0.55], at: 0.46 },
  { position: [0.7, -0.15, 0.35], size: [0.5, 0.4, 0.5], at: 0.54 },
  { position: [0.7, -0.15, -0.35], size: [0.5, 0.4, 0.5], at: 0.6 },
  { position: [0.0, 0.35, 0], size: [0.55, 0.4, 0.5], at: 0.68 },
  { position: [0.75, 0.32, 0], size: [0.5, 0.36, 0.48], at: 0.76 },
  { position: [0.35, 0.75, 0], size: [0.45, 0.34, 0.44], at: 0.84 },
];

/** 0 at `at`, 1 by `at + 0.12`, eased. */
function partProgress(local: number, at: number): number {
  const t = clamp01((local - at) / 0.12);
  return 1 - Math.pow(1 - t, 3);
}

export function TruckAssembly() {
  const group = useRef<THREE.Group>(null);
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  const cargoRefs = useRef<(THREE.Mesh | null)[]>([]);
  const wheelRefs = useRef<(THREE.Mesh | null)[]>([]);

  useFrame(() => {
    const p = getScrollProgress();
    const local = rangeProgress(p, SECTIONS.moveAsOne);

    if (group.current) {
      // Visible only during the set-piece and the dissolve that follows.
      const show = clamp01((p - 0.32) / 0.05) * (1 - clamp01((p - 0.72) / 0.06));
      group.current.visible = show > 0.01;
      group.current.scale.setScalar(0.85 * show);
      // Drives out of frame left as the page turns light.
      group.current.position.x = -12 * clamp01((p - 0.68) / 0.07);
      group.current.rotation.y = lerp(-0.5, -0.15, local);
    }

    PARTS.forEach((part, i) => {
      const mesh = refs.current[i];
      if (!mesh) return;
      const t = partProgress(local, part.at);
      mesh.position.set(
        lerp(part.from[0], part.position[0], t),
        lerp(part.from[1], part.position[1], t),
        lerp(part.from[2], part.position[2], t),
      );
      (mesh.material as THREE.MeshStandardMaterial).opacity = t;
      mesh.visible = t > 0.001;
    });

    wheelRefs.current.forEach((mesh, i) => {
      if (!mesh) return;
      const t = partProgress(local, 0.32 + i * 0.02);
      mesh.scale.setScalar(t);
      mesh.visible = t > 0.001;
    });

    CARGO.forEach((box, i) => {
      const mesh = cargoRefs.current[i];
      if (!mesh) return;
      const t = partProgress(local, box.at);
      mesh.position.set(
        lerp(box.position[0] + 5, box.position[0], t),
        lerp(box.position[1] + 3, box.position[1], t),
        box.position[2],
      );
      mesh.rotation.z = lerp(1.2, 0, t);
      mesh.scale.setScalar(t);
      mesh.visible = t > 0.001;
    });
  });

  return (
    <group ref={group} position={[0, 0, 0]}>
      {PARTS.map((part, i) => (
        <mesh
          key={`part-${i}`}
          ref={(el) => {
            refs.current[i] = el;
          }}
        >
          <boxGeometry args={part.size} />
          <meshStandardMaterial
            color={part.color}
            roughness={0.5}
            metalness={0.2}
            transparent
          />
        </mesh>
      ))}

      {WHEELS.map((pos, i) => (
        <mesh
          key={`wheel-${i}`}
          ref={(el) => {
            wheelRefs.current[i] = el;
          }}
          position={pos}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <cylinderGeometry args={[0.36, 0.36, 0.22, 24]} />
          <meshStandardMaterial color="#141418" roughness={0.9} />
        </mesh>
      ))}

      {CARGO.map((box, i) => (
        <mesh
          key={`cargo-${i}`}
          ref={(el) => {
            cargoRefs.current[i] = el;
          }}
        >
          <boxGeometry args={box.size} />
          <meshStandardMaterial color="#9C7B5C" roughness={0.85} />
        </mesh>
      ))}
    </group>
  );
}
```

- [ ] **Step 2: Write the pinned section**

Create `components/sections/MoveAsOne.tsx`. GSAP pins the section; the labels crossfade against the same scroll.

```tsx
'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useReducedMotion } from '@/lib/use-reduced-motion';

gsap.registerPlugin(ScrollTrigger);

const STEPS = [
  { label: 'Pack', body: 'Every item wrapped, boxed, and logged before it moves an inch.' },
  { label: 'Move', body: 'Loaded tight, driven careful, tracked the whole way.' },
  { label: 'Settle', body: 'Unloaded and placed where you want it, not just inside the door.' },
];

export function MoveAsOne() {
  const root = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced || !root.current) return;
    const ctx = gsap.context(() => {
      const steps = gsap.utils.toArray<HTMLElement>('[data-step]');

      ScrollTrigger.create({
        trigger: root.current,
        start: 'top top',
        end: '+=250%',
        pin: '[data-pin]',
        scrub: true,
      });

      steps.forEach((step, i) => {
        gsap.fromTo(
          step,
          { opacity: 0, y: 30 },
          {
            opacity: 1,
            y: 0,
            scrollTrigger: {
              trigger: root.current,
              start: `top+=${i * 80}% top`,
              end: `top+=${(i + 1) * 80}% top`,
              scrub: true,
            },
          },
        );
      });
    }, root);
    return () => ctx.revert();
  }, [reduced]);

  return (
    <section ref={root} id="process" className="relative h-[350vh] px-6">
      <div
        data-pin
        className="flex h-screen items-end pb-24"
      >
        <div className="mx-auto w-full max-w-7xl">
          <p className="mb-10 text-xs font-semibold tracking-[0.3em] uppercase opacity-50">
            Move as One
          </p>
          <div className="grid gap-10 md:grid-cols-3">
            {STEPS.map((step) => (
              <div key={step.label} data-step className="max-w-xs">
                <h3 className="text-4xl font-semibold tracking-tight">
                  {step.label}
                </h3>
                <p className="mt-4 leading-relaxed opacity-70">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
```

Note the reduced-motion path: the timelines never run, so the steps keep their natural static layout and stay fully visible.

- [ ] **Step 3: Mount the truck and section**

In `components/scene/SceneCanvas.tsx`, add the import and render `<TruckAssembly />` after `<BoxStack />`:

```tsx
import { TruckAssembly } from './TruckAssembly';
```

```tsx
        <BoxStack />
        <TruckAssembly />
        <Embers />
```

In `app/page.tsx`, add `<MoveAsOne />` after `<Services />` and delete the temporary `<div className="h-screen" />`:

```tsx
import { MoveAsOne } from '@/components/sections/MoveAsOne';
```

- [ ] **Step 4: Verify by eye**

Run `npm run dev` and scroll slowly through the section. Confirm:
- The section pins and the page stops translating while the truck assembles.
- Parts arrive in order: chassis, cab, box body, wheels, then cargo boxes stacking.
- Pack / Move / Settle fade in one after another as their part of the assembly happens.
- The truck drives out to the left as the background turns cream.
- Scrolling back up reverses the assembly cleanly with no stuck parts.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add pinned Move as One set-piece with procedural truck assembly"
```

---

### Task 10: Home — Guarantees, Testimonials, and closing CTA

The light half of the page.

**Files:**
- Create: `components/sections/Guarantees.tsx`
- Create: `components/sections/Testimonials.tsx`
- Create: `components/sections/ClosingCTA.tsx`
- Create: `components/ui/Footer.tsx`
- Modify: `app/page.tsx`
- Modify: `tests/e2e/home.spec.ts`

**Interfaces:**
- Consumes: `GUARANTEES`, `TESTIMONIALS` (Task 8); `BUSINESS` (Task 1); `RevealText`, `Counter`, `Button` (Task 7); `getScrollVelocity` (Task 2)
- Produces: `<Guarantees />`, `<Testimonials />`, `<ClosingCTA />`, `<Footer />`

- [ ] **Step 1: Write the guarantees section**

Create `components/sections/Guarantees.tsx`. Large editorial type with thin rules — this is where the palette flips.

```tsx
import { GUARANTEES } from '@/lib/content';
import { RevealText } from '@/components/ui/RevealText';

export function Guarantees() {
  return (
    <section className="relative px-6 py-40">
      <div className="mx-auto max-w-7xl">
        <RevealText
          as="h2"
          className="max-w-4xl text-[clamp(2rem,5vw,4rem)] leading-[1.05] font-semibold tracking-tight"
        >
          Three promises we put in writing
        </RevealText>
        <div className="mt-24">
          {GUARANTEES.map((g, i) => (
            <div
              key={g.title}
              className="grid gap-6 border-t border-current/15 py-12 md:grid-cols-12"
            >
              <span className="text-xs font-semibold tracking-[0.2em] opacity-40 md:col-span-2">
                {String(i + 1).padStart(2, '0')}
              </span>
              <h3 className="text-3xl font-semibold tracking-tight md:col-span-4">
                {g.title}
              </h3>
              <p className="text-lg leading-relaxed opacity-70 md:col-span-6">
                {g.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Write the testimonials marquee**

Create `components/sections/Testimonials.tsx`. Speed responds to scroll velocity.

```tsx
'use client';

import { useEffect, useRef } from 'react';
import { TESTIMONIALS } from '@/lib/content';
import { getScrollVelocity } from '@/lib/scroll-store';
import { useReducedMotion } from '@/lib/use-reduced-motion';

export function Testimonials() {
  const track = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced || !track.current) return;
    let raf = 0;
    let offset = 0;

    const tick = () => {
      const el = track.current;
      if (el) {
        const boost = Math.min(4, Math.abs(getScrollVelocity()) * 0.06);
        offset -= 0.6 + boost;
        const half = el.scrollWidth / 2;
        if (half > 0 && Math.abs(offset) >= half) offset += half;
        el.style.transform = `translate3d(${offset}px, 0, 0)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced]);

  // Duplicated once so the translate can loop seamlessly.
  const items = [...TESTIMONIALS, ...TESTIMONIALS];

  return (
    <section className="relative overflow-hidden py-32">
      <h2 className="mx-auto mb-16 max-w-7xl px-6 text-xs font-semibold tracking-[0.3em] uppercase opacity-50">
        What our customers say
      </h2>
      <div ref={track} className="flex w-max gap-6 px-6 will-change-transform">
        {items.map((t, i) => (
          <figure
            key={i}
            className="w-[min(88vw,26rem)] shrink-0 rounded-2xl border border-current/15 p-8"
          >
            <div aria-hidden="true" className="text-fire">
              ★★★★★
            </div>
            <blockquote className="mt-6 text-lg leading-relaxed">
              “{t.quote}”
            </blockquote>
            <figcaption className="mt-6 text-sm opacity-60">
              {t.name} · {t.detail}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Write the closing CTA**

Create `components/sections/ClosingCTA.tsx`:

```tsx
import { BUSINESS } from '@/lib/constants';
import { RevealText } from '@/components/ui/RevealText';
import { Counter } from '@/components/ui/Counter';
import { Button } from '@/components/ui/Button';

export function ClosingCTA() {
  return (
    <section id="quote" className="relative px-6 py-40">
      <div className="mx-auto max-w-7xl text-center">
        <p className="text-[clamp(3rem,10vw,8rem)] leading-none font-semibold tracking-tight">
          <Counter to={1000000} />
        </p>
        <RevealText
          as="h2"
          className="mt-6 text-[clamp(1.5rem,3vw,2.5rem)] font-semibold tracking-tight"
        >
          moves behind us. Yours is next.
        </RevealText>
        <div className="mt-12 flex flex-wrap justify-center gap-4">
          <Button href={BUSINESS.phoneHref}>Call {BUSINESS.phone}</Button>
          <Button href={`mailto:${BUSINESS.email}`} variant="ghost">
            Email us
          </Button>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Write the footer**

Create `components/ui/Footer.tsx`:

```tsx
import Link from 'next/link';
import { BUSINESS } from '@/lib/constants';

export function Footer() {
  return (
    <footer className="relative border-t border-current/15 px-6 py-16">
      <div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-3">
        <div>
          <p className="text-sm font-bold tracking-[0.2em] uppercase">
            {BUSINESS.name}
          </p>
          <p className="mt-4 text-sm leading-relaxed opacity-60">
            {BUSINESS.address}
          </p>
        </div>
        <div className="text-sm">
          <a href={BUSINESS.phoneHref} className="block hover:opacity-70">
            {BUSINESS.phone}
          </a>
          <a
            href={`mailto:${BUSINESS.email}`}
            className="mt-2 block hover:opacity-70"
          >
            {BUSINESS.email}
          </a>
        </div>
        <div className="text-sm">
          <Link href="/" className="block hover:opacity-70">
            Home
          </Link>
          <Link href="/about" className="mt-2 block hover:opacity-70">
            About
          </Link>
        </div>
      </div>
      <p className="mx-auto mt-12 max-w-7xl text-xs opacity-40">
        © {new Date().getFullYear()} {BUSINESS.name}. Licensed and insured for
        interstate moving.
      </p>
    </footer>
  );
}
```

- [ ] **Step 5: Complete the home page**

`app/page.tsx` in full:

```tsx
import { Nav } from '@/components/ui/Nav';
import { Footer } from '@/components/ui/Footer';
import { Hero } from '@/components/sections/Hero';
import { Services } from '@/components/sections/Services';
import { MoveAsOne } from '@/components/sections/MoveAsOne';
import { Guarantees } from '@/components/sections/Guarantees';
import { Testimonials } from '@/components/sections/Testimonials';
import { ClosingCTA } from '@/components/sections/ClosingCTA';

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Services />
        <MoveAsOne />
        <Guarantees />
        <Testimonials />
        <ClosingCTA />
      </main>
      <Footer />
    </>
  );
}
```

- [ ] **Step 6: Extend the smoke test**

Append to `tests/e2e/home.spec.ts`:

```ts
test('footer carries the real contact details', async ({ request }) => {
  const html = await (await request.get('/')).text();
  expect(html).toContain('2535-B Texas 121 E, State #140, Lewisville, TX 75056');
  expect(html).toContain('support@firehousemovers.com');
  expect(html).toContain('Firehouse Movers Inc.');
});

test('all six service names are in the server HTML', async ({ request }) => {
  const html = await (await request.get('/')).text();
  for (const name of [
    'Local Moving',
    'Long-Distance',
    'Residential',
    'Commercial',
    'Packing',
    'Storage',
  ]) {
    expect(html).toContain(name);
  }
});
```

- [ ] **Step 7: Run the tests**

Run: `npm run test:e2e`
Expected: all tests PASS.

- [ ] **Step 8: Verify by eye**

Confirm the palette is fully cream by the testimonials, the marquee drifts and speeds up as you scroll, and the counter ticks to 1,000,000 when it enters view.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: add guarantees, testimonials marquee, closing CTA, and footer"
```

---

### Task 11: About page

Second page, second camera path, calmer and mostly in the light.

**Files:**
- Create: `app/about/page.tsx`
- Create: `components/sections/AboutHero.tsx`
- Create: `components/sections/Story.tsx`
- Create: `components/sections/Values.tsx`
- Create: `components/sections/Credentials.tsx`
- Create: `tests/e2e/about.spec.ts`

**Interfaces:**
- Consumes: `TIMELINE`, `VALUES` (Task 8); `BUSINESS` (Task 1); `RevealText`, `TiltCard`, `Button` (Task 7); `<Nav />`, `<Footer />`, `<ClosingCTA />` (Tasks 8, 10)
- Produces: the `/about` route. No new shared interfaces.

The camera already branches on `pathname === '/about'` (Task 5), so this task adds no scene code.

- [ ] **Step 1: Write the about hero**

Create `components/sections/AboutHero.tsx`:

```tsx
import { RevealText } from '@/components/ui/RevealText';

export function AboutHero() {
  return (
    <section className="relative flex min-h-[80vh] items-center px-6 pt-32">
      <div className="mx-auto w-full max-w-7xl">
        <p className="mb-8 text-xs font-semibold tracking-[0.3em] uppercase opacity-60">
          About us
        </p>
        <RevealText
          as="h1"
          className="max-w-4xl text-[clamp(2.25rem,6vw,5rem)] leading-[1] font-semibold tracking-tight"
        >
          We started this because we needed it ourselves
        </RevealText>
        <p className="mt-8 max-w-xl text-lg leading-relaxed opacity-70">
          Firehouse Movers began with one truck, one crew, and one rule: show up
          when you said you would. Everything since has been built on that.
        </p>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Write the scroll-scrubbed timeline**

Create `components/sections/Story.tsx`. A vertical rule fills as the section scrolls.

```tsx
'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { TIMELINE } from '@/lib/content';
import { useReducedMotion } from '@/lib/use-reduced-motion';

gsap.registerPlugin(ScrollTrigger);

export function Story() {
  const root = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced || !root.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '[data-rule]',
        { scaleY: 0 },
        {
          scaleY: 1,
          ease: 'none',
          scrollTrigger: {
            trigger: root.current,
            start: 'top 70%',
            end: 'bottom 80%',
            scrub: true,
          },
        },
      );

      gsap.utils.toArray<HTMLElement>('[data-entry]').forEach((entry) => {
        gsap.from(entry, {
          opacity: 0,
          y: 40,
          duration: 0.8,
          ease: 'power3.out',
          scrollTrigger: { trigger: entry, start: 'top 82%' },
        });
      });
    }, root);
    return () => ctx.revert();
  }, [reduced]);

  return (
    <section ref={root} className="relative px-6 py-32">
      <div className="mx-auto max-w-4xl">
        <div className="relative pl-10">
          <div
            data-rule
            aria-hidden="true"
            className="bg-fire absolute top-0 left-0 h-full w-px origin-top"
          />
          {TIMELINE.map((entry) => (
            <div key={entry.year} data-entry className="relative pb-20">
              <span className="bg-fire absolute top-2 -left-10 block h-2 w-2 -translate-x-1/2 rounded-full" />
              <p className="text-xs font-semibold tracking-[0.2em] uppercase opacity-40">
                {entry.year}
              </p>
              <h3 className="mt-4 text-3xl font-semibold tracking-tight">
                {entry.title}
              </h3>
              <p className="mt-4 text-lg leading-relaxed opacity-70">
                {entry.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Write the values grid**

Create `components/sections/Values.tsx`:

```tsx
import { VALUES } from '@/lib/content';
import { RevealText } from '@/components/ui/RevealText';
import { TiltCard } from '@/components/ui/TiltCard';

export function Values() {
  return (
    <section className="relative px-6 py-32">
      <div className="mx-auto max-w-7xl">
        <RevealText
          as="h2"
          className="max-w-3xl text-[clamp(2rem,4.5vw,3.5rem)] leading-tight font-semibold tracking-tight"
        >
          What we hold ourselves to
        </RevealText>
        <div className="mt-20 grid gap-6 md:grid-cols-2">
          {VALUES.map((value) => (
            <TiltCard key={value.title}>
              <div className="p-8">
                <h3 className="text-2xl font-semibold">{value.title}</h3>
                <p className="mt-4 leading-relaxed opacity-70">{value.body}</p>
              </div>
            </TiltCard>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Write the credentials section**

Create `components/sections/Credentials.tsx`:

```tsx
import { BUSINESS } from '@/lib/constants';
import { RevealText } from '@/components/ui/RevealText';

const CREDENTIALS = [
  {
    title: 'Federally licensed',
    body: 'Licensed for interstate moving, so we can follow you out of Texas, not just across it.',
  },
  {
    title: 'Fully insured',
    body: 'Coverage on every move, every crew, every item on the inventory.',
  },
  {
    title: 'Climate-controlled storage',
    body: 'Our own facility, with inventory tracking on every item that goes in.',
  },
];

export function Credentials() {
  return (
    <section className="relative px-6 py-32">
      <div className="mx-auto max-w-7xl">
        <RevealText
          as="h2"
          className="text-[clamp(1.75rem,4vw,3rem)] font-semibold tracking-tight"
        >
          Credentials that matter on moving day
        </RevealText>
        <div className="mt-16 grid gap-12 md:grid-cols-3">
          {CREDENTIALS.map((c) => (
            <div key={c.title} className="border-t border-current/15 pt-6">
              <h3 className="text-xl font-semibold">{c.title}</h3>
              <p className="mt-3 leading-relaxed opacity-70">{c.body}</p>
            </div>
          ))}
        </div>
        <p className="mt-16 text-sm opacity-50">
          {BUSINESS.name} · {BUSINESS.address}
        </p>
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Assemble the route**

Create `app/about/page.tsx`:

```tsx
import type { Metadata } from 'next';
import { Nav } from '@/components/ui/Nav';
import { Footer } from '@/components/ui/Footer';
import { AboutHero } from '@/components/sections/AboutHero';
import { Story } from '@/components/sections/Story';
import { Values } from '@/components/sections/Values';
import { Credentials } from '@/components/sections/Credentials';
import { ClosingCTA } from '@/components/sections/ClosingCTA';

export const metadata: Metadata = {
  title: 'About — Firehouse Movers Inc.',
  description:
    'How Firehouse Movers started, what we hold ourselves to, and the credentials behind every move.',
};

export default function About() {
  return (
    <>
      <Nav />
      <main>
        <AboutHero />
        <Story />
        <Values />
        <Credentials />
        <ClosingCTA />
      </main>
      <Footer />
    </>
  );
}
```

- [ ] **Step 6: Write the about smoke test**

Create `tests/e2e/about.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test('about page renders its story and credentials in server HTML', async ({
  request,
}) => {
  const html = await (await request.get('/about')).text();
  expect(html).toContain('We started this because we needed it ourselves');
  expect(html).toContain('Federally licensed');
  expect(html).toContain('(972) 992-1969');
});

test('about page loads with no console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  await page.goto('/about');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  expect(errors).toEqual([]);
});

test('nav links move between the two pages', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'About' }).first().click();
  await expect(page).toHaveURL(/\/about$/);
  await page.getByRole('link', { name: 'Home' }).first().click();
  await expect(page).toHaveURL(/\/$/);
});
```

- [ ] **Step 7: Run the tests**

Run: `npm run test:e2e`
Expected: all tests across both spec files PASS.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add about page with story timeline, values, and credentials"
```

---

### Task 12: Fallbacks, polish, and deploy

The last pass: the non-WebGL experience, a 404, metadata, a performance check, and a live URL.

**Files:**
- Create: `components/scene/StaticBackdrop.tsx`
- Create: `app/not-found.tsx`
- Modify: `components/scene/SceneCanvas.tsx`
- Modify: `app/globals.css`
- Create: `README.md`

**Interfaces:**
- Consumes: `useCanvasEnabled` (Task 5); `COLORS` (Task 1)
- Produces: `<StaticBackdrop />` — the fixed gradient shown wherever WebGL is disabled

- [ ] **Step 1: Write the static backdrop**

Create `components/scene/StaticBackdrop.tsx`. Pure CSS, no JS cost. It must look deliberate, not like a broken canvas.

```tsx
export function StaticBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0"
      style={{
        background:
          'radial-gradient(120% 80% at 20% 10%, rgba(226,61,40,0.22), transparent 55%), radial-gradient(90% 70% at 85% 25%, rgba(255,138,61,0.16), transparent 60%), var(--page-bg)',
      }}
    />
  );
}
```

- [ ] **Step 2: Render it whenever the canvas is off**

In `components/scene/SceneCanvas.tsx`, replace the early return:

```tsx
  if (!enabled) return <StaticBackdrop />;
```

and add the import:

```tsx
import { StaticBackdrop } from './StaticBackdrop';
```

- [ ] **Step 3: Add the 404**

Create `app/not-found.tsx`:

```tsx
import { Nav } from '@/components/ui/Nav';
import { Footer } from '@/components/ui/Footer';
import { Button } from '@/components/ui/Button';
import { BUSINESS } from '@/lib/constants';

export default function NotFound() {
  return (
    <>
      <Nav />
      <main className="flex min-h-[70vh] items-center px-6 pt-32">
        <div className="mx-auto w-full max-w-7xl">
          <p className="text-xs font-semibold tracking-[0.3em] uppercase opacity-50">
            404
          </p>
          <h1 className="mt-6 text-[clamp(2rem,6vw,4.5rem)] leading-tight font-semibold tracking-tight">
            This one did not make it onto the truck
          </h1>
          <div className="mt-10 flex flex-wrap gap-4">
            <Button href="/">Back home</Button>
            <Button href={BUSINESS.phoneHref} variant="ghost">
              {BUSINESS.phone}
            </Button>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
```

- [ ] **Step 4: Make the light palette readable on the HTML side**

The `--page-ink` property is set at runtime, but the first paint and the no-JS case need a sensible default. Confirm `app/globals.css` still declares `--page-bg: #08070A` and `--page-ink: #F4F0E9` on `:root` (from Task 1) and add a no-JS guard so a JS-disabled visitor gets the readable light version rather than dark text on a dark page:

```css
@media (scripting: none) {
  :root {
    --page-bg: #F4F0E9;
    --page-ink: #1A1917;
  }
}
```

- [ ] **Step 5: Verify every fallback**

Confirm each of these by hand:
- Narrow the window below 768px: no canvas, the gradient backdrop shows, all copy is readable, nav and CTAs work.
- Enable OS-level reduced motion and reload: no canvas, no marquee movement, all text visible at full opacity, counter shows 1,000,000 immediately, the Move as One steps are all readable without pinning.
- Disable JavaScript and reload: both pages render with readable dark text on cream.

- [ ] **Step 6: Run the full test suite**

```bash
npm test
npm run test:e2e
npm run build
```

Expected: unit tests pass, e2e tests pass, build completes clean with no type errors.

- [ ] **Step 7: Check performance**

Run `npm run build && npm run start`, open the home page, and run Lighthouse in Chrome DevTools on desktop. Record LCP. Target is under 1.5s; the hero is static server HTML, so if LCP exceeds this the cause is a blocking resource, not the 3D — investigate before moving on. Separately, watch the DevTools FPS meter while scrolling through the set-piece and confirm it holds near 60.

- [ ] **Step 8: Write the README**

Create `README.md`:

```markdown
# Firehouse Movers — Pitch Site

A speculative redesign of firehousemovers.com. Two pages, one persistent
WebGL canvas, scroll-driven camera and palette.

## Running it

```bash
npm install
npm run dev
```

## Testing

```bash
npm test        # unit — scroll math, theme interpolation, camera spline
npm run test:e2e  # Playwright smoke tests on both pages
```

## How it works

A single `<Canvas>` lives in `app/layout.tsx` behind all page content.
Lenis writes a normalized scroll progress (0→1) into a Zustand store
(`lib/scroll-store.ts`). That one value drives both halves of the page:
`useFrame` samples the camera spline (`lib/camera-path.ts`) and
interpolates scene colors, while a rAF loop writes the same theme values
(`lib/theme.ts`) to CSS custom properties so the HTML tracks the 3D
exactly.

All 3D geometry is procedural — three.js primitives and custom shaders,
no external models or textures.

WebGL is disabled under `prefers-reduced-motion` and below 768px, where a
static CSS gradient takes its place. All copy is server-rendered and
readable without JavaScript.

## Design docs

- Spec: `docs/superpowers/specs/2026-09-01-firehouse-movers-pitch-site-design.md`
- Plan: `docs/superpowers/plans/2026-09-01-firehouse-movers-pitch-site.md`
```

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: add static backdrop fallback, 404 page, and README"
```

- [ ] **Step 10: Deploy**

```bash
npx vercel --yes
```

Confirm the preview URL loads both pages correctly, then promote:

```bash
npx vercel --prod --yes
```

Report the live URL. This is what goes to the client.
