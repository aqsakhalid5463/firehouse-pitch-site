# Firehouse Movers — Website Direction Demo
### Reference build for the development team

This single HTML file is a **working reference implementation**, not production code.
Open it in a desktop browser (Chrome or Safari). Everything is self-contained; the only
external dependency is Three.js from a CDN, with two fallback tiers if it is unavailable.

---

## What to look at

| # | Mechanic | Where to see it |
|---|----------|-----------------|
| 01 | Preloader with live percentage counter, then the first screen reveals | On load |
| 02 | Inertia smooth scrolling across the whole site | Anywhere — scroll slowly |
| 03 | Real page transitions: panels sweep, destination name appears, page swaps behind the cover | Click any nav item |
| 04 | Continuous scroll between pages | Reach the bottom of a page and keep scrolling |
| 05 | Real-time 3D loading bay | Home — drag it to orbit the rig |
| 06 | Cursor that reacts to what it is over | Move the mouse; hover buttons and tiles |
| 07 | Masked headlines, scrolling text bands, logo marquee | Home and About |
| 08 | Service tiles with parallax and 3D hover tilt | Home and Services |
| 09 | Pinned horizontal process section | Home — "How a Firehouse move actually runs" |
| 10 | Pinned particle-portrait team section | About — scroll through it |
| 11 | Interactive particle crew bridging light into dark | Home — below "Founded by Firemen" |
| 12 | Mobile navigation | Narrow the window below 1000px, tap the menu |

---

## The 3D loading bay

Built from the yard photo of the rig: **white dually pickup towing the long red trailer**,
gooseneck hitch, tandem rear axles on duals, rear door open with the ramp down.

The **side decals are generated from the real logo file** at runtime — the logo is
knocked out to white vinyl and the phone number is drawn onto a canvas texture applied
to each flank.

### The rig is parked, and behaves like it
Wheels do not turn. The pickup carries a fine engine idle vibration, the trailer's amber
markers tick as hazards, the rear reds sit at a low steady level, and there are wheel
chocks at the tandems and mud flaps behind them.

### The crew is articulated
Each figure has a real skeleton — hip, knee, ankle, foot and shoulder, elbow, hand — driven
by two functions:

- **`stride()`** — the knee flexes through the swing phase and locks on the stance leg, the
  ankle rolls, the torso counter-rotates against the arm swing and drops on each footfall.
  Loaded walks are slower with a shorter stride and a forward lean; empty walks are quicker.
- **`squat()`** — hips and knees fold together with the torso pitching forward, so lifting
  comes from the legs rather than the back.

Four crew members run full loops. The **carrier** squats at the pile, takes a carton, hauls
it up the ramp leaning into the grade, squats inside the trailer and sets it down, turns on
the spot, and walks back empty. The pile drains and the load stack inside the trailer grows
one carton per trip, then resets. The **stacker's** carton is positioned from the hand
anchor's world transform every frame, so it tracks the hands exactly through the lift.
A **walker** patrols the flank and a **folder** shakes out, folds and stacks moving pads.

### Fallback tiers
1. Three.js scene (default on desktop)
2. Raymarched WebGL shader, if Three.js fails to load
3. Static gradient, on narrow screens, low-core devices, or reduced-motion

The HUD (bottom left) reports which tier is live and the current frame rate.
If the frame rate drops below 40, the renderer automatically lowers pixel ratio,
then disables shadows.

---

## The particle crew bridge — three switchable teams

The "Founded by Firemen" section opens with the particles **drifting freely**: every particle
carries its own slow-wandering anchor that bounces inside the stage, with light damping so
the cloud breathes rather than sits still.

Three buttons sit under the stage. Picking one assigns every particle a destination inside
that team's silhouettes and the cloud **resolves into the line-up**. Picking another team
re-targets them and they flow across. "Let them drift" releases them back to the cloud.

| Button | Team | Members |
|---|---|---|
| 01 | Operations | Nicole Ingram · Julian Hernandez · Peter Taylor · Leon Kaoma |
| 02 | Sales | Dyamon Cobb · Shadee Mounger · Briana Hager · Zenobia Rhodes |
| 03 | Crew Leaders | 16 leads, laid out 8 across in two rows |

Names are drawn on the canvas under each figure. The figure nearest the cursor brightens and
reveals its role underneath. Moving across them still pushes the particles apart and they
reassemble behind you; **clicking still scatters** whichever formation is active.

The 4-person teams render one row at full size; the 16 crew leaders switch to a two-row grid
with a denser sample step and smaller name type. Particle count is fixed (11,000 desktop /
4,200 mobile) and redistributed across whichever team is showing, so the cost does not change
between teams. Each team's sampled sheet is cached the first time it is selected.

The section background fades from paper to coal behind them and their feet dissolve into it,
so the light section hands off to the dark process section with no hard edge.

### Click to reveal the licence numbers
Clicking the stage bursts the particles and **reassembles them into the USDOT and TxDMV
numbers** — sampled as type through the same canvas-to-particle pipeline as the silhouettes,
so the numbers are made of the same cloud rather than overlaid as text. They hold for about
four seconds and then flow back into whatever formation was showing. Clicking again during
the hold sends them back early. Cursor repulsion still works while the numbers are up.

**The reveal is not the compliance copy.** TxDMV requires the licence number to appear in
advertising, and an interaction is not crawlable or readable by assistive tech, so the same
numbers also sit as plain selectable text in the footer and as `identifier` entries in the
`MovingCompany` JSON-LD block in the head. Keep all three in production. They are defined
once in the `CRED` object in `FHCrew` for the reveal, and hardcoded in the footer and schema.

### ⚠️ Silhouette assignment is placeholder
The silhouettes are generic vector figures, not likenesses. Each person is currently mapped to
a shape by role — headsets on the sales concierges, hard hats and vests on the crew leaders,
and so on. **Everyone should approve their own figure and role title before this is shown
externally**, and the mapping is a single `sil` field per person in the `TEAMS` object at the
top of the `FHCrew` module.

---

## The team section (About)

The section is **pinned**: it holds still while you scroll, and the scroll position
advances through the five crew members. Each portrait is drawn from ~6,500 particles
sampled from a procedurally generated silhouette. Moving the cursor across the portrait
pushes the particles apart; they reassemble behind you. Switching bursts them apart
and reforms them into the next person.

A second renderer — a volumetric point cloud built from signed distance fields — is
available via the HUD toggle.

**The bios are placeholder.** Each person must approve their own copy before this is
shown externally.

---

## Design and accessibility pass

Fixed in this revision — worth knowing so they are not reintroduced:

- **The logo is now a transparent PNG.** It was a JPEG with a white background sitting
  under a `mix-blend-mode: difference` header, which rendered it as a bright white box on
  the dark hero.
- **The header no longer uses difference blending.** It carries a soft top scrim and picks
  up a `.lt` class when a light section passes under it, flipping the text to ink. Detection
  runs off element rects in the existing scroll loop.
- **Mobile navigation exists.** Below 1000px the desktop nav was simply hidden with nothing
  in its place, so the only way to change pages on a phone was to scroll to the bottom.
  There is now a burger and a full-screen sheet.
- **Every phone number is a `tel:` link.** None of them were tappable.
- **`prefers-reduced-motion` is honoured in CSS** as well as JS — animations, marquees and
  the custom cursor all stand down.
- **Skip link, `::selection`, and metadata** (description, theme-color, Open Graph) added.

### ⚠️ One thing to confirm before this goes anywhere
The demo previously carried **three different phone numbers**: `(972) 992-1969` in the page
copy, and `817-572-9797` / `972-412-6033` on the trailer decals. Everything is now unified to
**(972) 992-1969**, which is the number on the current live site. **Confirm this is the
right line**, and if there is a second branch number it should be added deliberately rather
than left to drift. It appears in the head metadata, the contact page, the footer, the mobile
sheet, and the decal canvas.

---

## Notes for the build

- **Everything must server-render.** This demo fakes routing by toggling sections in one
  document. Production needs real Next.js routes so each URL returns crawlable HTML.
- **The service-area pages stay as they are** — fast, statically rendered, with
  LocalBusiness schema. They are not part of the continuous-scroll chain.
- **Core Web Vitals must be measured before and after.** This file is ~545 KB with the logos
  and no photography. Real footage will change the picture.
- **Mobile drops the 3D entirely** and serves the static hero treatment.
- **Every 3D scene pauses when it scrolls out of view** and resumes without resetting its
  animation clock, so only one WebGL scene is drawing at a time.
- The crew figures are box-and-capsule primitives. The gait now reads correctly, but
  production should use rigged GLB models with proper skinned animation — that is a 3D
  artist plus a WebGL developer, not a front-end task.
- **All copy is placeholder** and needs a marketing review before it is shown externally.

---

## Attribution

The flow and mechanics take reference from lusion.co. **No design assets were copied.**
Palette, type, logo, copy, geometry and photography direction are all Firehouse.
