# Firehouse Movers — Pitch Site Design

Date: 2026-09-01
Status: Approved

## Context

Firehouse Movers Inc. is a residential/commercial moving company in
Lewisville, TX (2535-B Texas 121 E, State #140, Lewisville, TX 75056 ·
(972) 992-1969 · support@firehousemovers.com). They offer local moves,
long-distance interstate moving (federally licensed), residential and
commercial relocation, packing, and climate-controlled storage.

Their current site is at
https://fire-house-movers-7f0b30006c85.herokuapp.com/ — generic
professional-blue, template-feeling.

This build is a **pitch**: a speculative redesign intended to win the
business. It is judged in a meeting, on a laptop, in the first ten
seconds. Visual impact outranks conversion optimization. It is not
(yet) the production site.

Scope: two pages — Home and About.

## Goals

- Produce an unmistakably custom, memorable site that wins the pitch.
- Demonstrate real 3D capability, not CSS tricks dressed up as 3D.
- Remain deployable to a live URL so the client gets a link, not a
  screen-share.

## Non-goals

- Production CMS, booking flow, auth, or quote backend. CTAs are
  visual and link to `tel:`/`mailto:`/anchors.
- Conversion-rate optimization and local SEO tuning. Noted as
  follow-up work if the pitch lands.
- Comprehensive automated visual testing.

## Art direction

**Split: dark cinematic → light editorial.**

The page opens near-black with volumetric fog, drifting embers, and
heavy bloom. Across the Guarantees section it dissolves into a cream,
editorial, daylight palette with deep charcoal type. The transition
itself is the centerpiece trick — no hard cut, every value
interpolated against scroll.

Accent: fire-red, drawn from the existing brand.

All 3D is **procedural**. No GLTF models, no stock photography, no
downloaded assets. Every object is built from three.js primitives and
custom shaders. This keeps the repo self-contained and license-clean,
keeps the bundle honest, and reads as more deliberate than stock
geometry.

## Stack

- Next.js 16, App Router, TypeScript
- Tailwind CSS v4
- `three`, `@react-three/fiber`, `@react-three/drei`,
  `@react-three/postprocessing`
- `gsap` with ScrollTrigger — page choreography
- `motion` — component-level transitions
- `lenis` — smooth scroll
- `zustand` — shared scroll-progress store

## Architecture

### One persistent canvas

A single fixed, full-viewport `<Canvas>` is mounted in the root layout
at `z-0`. All HTML content scrolls above it at `z-10` in normal
document flow. There is no per-section canvas.

Consequences, and the reason for the decision:

- The site reads as one continuous 3D space rather than a page with
  3D widgets attached.
- three.js initializes exactly once. No WebGL context churn between
  sections, which is the usual source of stutter in builds like this.
- Camera motion is continuous across section boundaries.

### Scroll pipeline

Lenis drives a normalized scroll progress value (0→1 per page) into a
Zustand store. That value is consumed in two places:

1. Inside R3F's `useFrame`, to sample a camera spline and to
   interpolate scene values.
2. On the HTML side, written to a CSS custom property on a rAF loop,
   so text, borders, and backgrounds shift in lockstep with the 3D.

Both readers consume the same source, so the two layers can never
drift apart.

### Theme interpolation

Background color, fog color, light intensity, bloom strength, and the
HTML palette are all functions of scroll progress, interpolated over
the Guarantees section's range (`p` 0.60–0.75 on Home). `lib/theme.ts`
owns this mapping and is the single definition of the dark→light
dissolve.

### File layout

```
app/
  layout.tsx          Lenis provider + <SceneCanvas/> (fixed, z-0) + children (z-10)
  page.tsx            Home sections
  about/page.tsx      About sections
components/
  scene/              SceneCanvas, CameraRig, Embers, BoxStack,
                      TruckAssembly, Fog, Effects
  sections/           Hero, Services, MoveAsOne, Guarantees,
                      Testimonials, CTA
  ui/                 Nav, Button, TiltCard, RevealText, Counter
lib/
  scroll-store.ts     shared normalized scroll progress
  theme.ts            dark→light interpolation
```

Each scene component owns one visual element and reads scroll progress
from the store rather than receiving it through props, so sections can
be built and viewed independently.

## Home page storyboard

Camera follows one continuous spline. `p` is scroll progress 0→1.

**1. Hero — `p 0.00–0.15` — deep dark.**
Near-black with volumetric fog. GPU-instanced ember particles drift
upward on a custom shader. Center: a slowly rotating stack of boxes
built from primitives, one a `MeshTransmissionMaterial` glass box that
catches ember light. Camera has subtle mouse-parallax.

Headline: "The moving service we needed, so we built it for you."
Masked line-by-line reveal. Primary CTA *Get a Quote*; secondary is
the phone number.

**Requirement:** hero copy, CTA, and phone number are server-rendered
HTML present in the initial payload. The canvas fades in behind them.
The hero must never be blank, on any connection.

**2. Services — `p 0.15–0.35` — dark to dusk.**
Camera pulls back and up; fog thins. Six service cards (local,
long-distance, residential, commercial, packing, storage) in an
asymmetric grid. Each is a `TiltCard`: cursor-tracked 3D rotation with
a pointer-following light sweep. GSAP stagger on entry. The box stack
recedes but stays visible behind the layout.

**3. Move as One — `p 0.35–0.60` — set-piece, stays dark.**
Pinned section; scroll drives assembly rather than page translation. A
low-poly moving truck, built entirely from primitives, assembles in
sequence: chassis, cab, box body, then boxes flying in and stacking
inside. Labels crossfade: **Pack → Move → Settle**. Bloom peaks here.

**4. Guarantees — `p 0.60–0.75` — the dissolve.**
Background, fog, and lights interpolate to cream across this section's
scroll range; bloom falls off; type inverts to deep charcoal. Three
guarantees — fast moves, safe handling, on-time delivery — in large
editorial type separated by thin rules. The truck, now in daylight,
drives slowly out of frame to the left.

**5. Testimonials — `p 0.75–0.90` — full light.**
Cream background. Four 5-star reviews in a horizontally drifting
marquee whose speed responds subtly to Lenis scroll velocity.

**6. Closing CTA — `p 0.90–1.00` — light.**
"1 million users, plus you" with a counter that animates on entry.
Fire-red primary button. Footer carries the real address, phone, and
email.

## About page storyboard

Same persistent canvas, a different and shorter camera path that stays
mostly in the light palette — related to Home, not a repeat of it.

- Hero with the ember field at low intensity.
- Company story, presented as a scroll-scrubbed vertical timeline.
- Values grid.
- Credentials: federally licensed for interstate moving, insured,
  franchise footprint. A real trust signal, deliberately foregrounded.
- The same closing CTA and footer as Home.

## Performance and accessibility

Built in from the first phase, not retrofitted:

- DPR clamped to `[1, 2]`.
- drei `<PerformanceMonitor>` steps quality down on weak GPUs.
- `frameloop="demand"` where nothing is animating.
- `prefers-reduced-motion`: canvas is replaced by a static gradient;
  GSAP timelines resolve to their end state; the marquee stops.
- Below 768px viewport width: no WebGL. A static gradient plus the
  full HTML content, which must stand on its own as a good-looking
  page.
- All content is real HTML — headings, links, and copy are readable
  and crawlable with JavaScript disabled.

## Build phases

Each phase ends in a state that can be viewed in a browser.

1. **Foundation** — scaffold, Tailwind, Lenis, scroll store, persistent
   canvas with a placeholder mesh proving scroll drives the camera.
2. **Dark hero** — ember shader, fog, box stack, postprocessing, hero
   copy and reveal.
3. **Light half** — theme interpolation, Guarantees, testimonials
   marquee, closing CTA. Ends with the dark→light dissolve working end
   to end.
4. **Set-piece** — pinned truck assembly. Highest-risk item,
   deliberately sequenced after the shell works so it never blocks
   progress.
5. **About page** — second camera path, timeline, credentials.
6. **Polish** — reduced-motion and mobile fallbacks, Lighthouse pass,
   nav, 404, metadata, deploy.

## Testing

The deliverable is visual, so exhaustive unit tests would be theater.
Test what is genuinely testable and verify the rest by eye.

- **Vitest** — scroll-progress normalization, theme interpolation
  (correct endpoint colors at `p=0` and `p=1`, monotonic between),
  camera spline sampling.
- **Playwright smoke tests** — both pages render; hero copy, CTA, and
  phone number are present in server HTML; no console errors on load.
- **Manual** — everything visual.

## Done

- Both pages complete and matching this storyboard.
- Smooth 60fps on a MacBook.
- Hero LCP under 1.5s.
- `prefers-reduced-motion` degrades cleanly.
- Mobile renders a good-looking non-WebGL version.
- `npm run build` passes clean.
- Deployed to Vercel, so the client receives a live URL.

## Open questions

None. Art direction (split dark→light), asset strategy (fully
procedural), and scope (Home + About) are settled.
