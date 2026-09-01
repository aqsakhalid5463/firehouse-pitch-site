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
