import * as THREE from 'three';
import { COLORS, BUSINESS } from './constants';

/**
 * Procedurally drawn textures, painted into a canvas at runtime.
 *
 * Still no external assets: every pixel here is generated from code, the
 * same rule the geometry follows. Canvas is the right tool rather than a
 * fragment shader because both of these need *text* — a phone number, a
 * company name around a circular badge — which is painful in GLSL and
 * trivial with fillText.
 *
 * Each builder is called once and memoised by its component. They are
 * browser-only (they need a real canvas), which is fine because every
 * caller is inside the R3F tree and therefore client-side.
 */

function makeCanvas(w: number, h: number) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');
  return { canvas, ctx };
}

/** Deterministic value noise, so a texture looks the same every reload. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/**
 * Kraft cardboard: fibre speckle, broad mottling, and a printed
 * recycling-style mark. This replaces a flat matte colour that read as
 * moulded plastic — real cartons have visible fibre grain and uneven dye
 * uptake, and it is the grain more than anything that sells the material.
 */
export function cardboardTexture(base: string): THREE.CanvasTexture {
  const S = 512;
  const { canvas, ctx } = makeCanvas(S, S);
  const rand = seeded(20260902);

  ctx.fillStyle = base;
  ctx.fillRect(0, 0, S, S);

  // Broad mottling: large soft blotches of slightly different dye
  // strength, which is what stops the surface reading as a solid fill.
  for (let i = 0; i < 90; i++) {
    const x = rand() * S;
    const y = rand() * S;
    const r = 30 + rand() * 90;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const dark = rand() > 0.5;
    g.addColorStop(0, dark ? 'rgba(90,60,30,0.05)' : 'rgba(255,225,185,0.05)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // Fibre speckle: short strokes at shallow random angles, the paper
  // grain itself.
  for (let i = 0; i < 5200; i++) {
    const x = rand() * S;
    const y = rand() * S;
    const len = 1 + rand() * 7;
    const a = (rand() - 0.5) * 0.9;
    ctx.strokeStyle =
      rand() > 0.5 ? 'rgba(255,238,205,0.16)' : 'rgba(96,62,32,0.16)';
    ctx.lineWidth = rand() > 0.85 ? 1.6 : 0.8;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    ctx.stroke();
  }

  // A small printed mark, the sort stamped on any shipping carton. Kept
  // low-contrast so it reads at a glance without becoming a logo.
  ctx.save();
  ctx.translate(S * 0.5, S * 0.5);
  ctx.strokeStyle = 'rgba(70,45,22,0.22)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(0, 0, 34, 0, Math.PI * 2);
  ctx.stroke();
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(70,45,22,0.22)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('FH', 0, 1);
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Cardboard roughness map, derived from the same fibre pattern.
 *
 * A single roughness value makes every part of a face catch the light
 * identically, which is the other half of why the boxes looked moulded.
 * Varying it breaks the highlight up along the grain.
 */
export function cardboardRoughness(): THREE.CanvasTexture {
  const S = 256;
  const { canvas, ctx } = makeCanvas(S, S);
  const rand = seeded(776);

  ctx.fillStyle = '#d8d8d8'; // mostly rough
  ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 2600; i++) {
    const x = rand() * S;
    const y = rand() * S;
    const len = 1 + rand() * 6;
    ctx.strokeStyle = rand() > 0.5 ? 'rgba(255,255,255,0.5)' : 'rgba(150,150,150,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y + (rand() - 0.5) * 2);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** Path to the official badge, served from /public. */
const LOGO_SRC = '/fire_house_logo.svg';

/**
 * Loads the official logo once and shares the single decoded image
 * between every texture that needs it.
 *
 * The logo is a 290KB SVG of 219 paths; decoding it per texture would
 * do the same work twice for the truck's two sides.
 */
let logoPromise: Promise<HTMLImageElement> | null = null;
function loadLogo(): Promise<HTMLImageElement> {
  if (!logoPromise) {
    logoPromise = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = LOGO_SRC;
    });
  }
  return logoPromise;
}

/**
 * The trailer's side livery: deep red with the badge centred, a phone
 * number either side of it, and the web address small at the front.
 *
 * `mirrored` draws the whole thing flipped. BoxGeometry's two large
 * faces have opposite-handed UVs, so without a mirrored copy the text
 * would read backwards on one side of the truck.
 */
export function truckLiveryTexture(mirrored: boolean): THREE.CanvasTexture {
  // 3.0 x 1.9 world units; this aspect keeps the badge circular.
  const W = 1024;
  const H = 648;
  const { canvas, ctx } = makeCanvas(W, H);

  // Everything except the badge is painted synchronously, so the truck
  // is never seen with a blank trailer while the logo decodes.
  const paintBase = () => {
    ctx.save();
    if (mirrored) {
      ctx.translate(W, 0);
      ctx.scale(-1, 1);
    }

    ctx.fillStyle = COLORS.truckBodyRed;
    ctx.fillRect(0, 0, W, H);

    // Faint vertical panel seams, the way a real box body is ribbed.
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 2;
    for (let i = 1; i < 8; i++) {
      const x = (W / 8) * i;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }

    ctx.fillStyle = '#FFFFFF';
    ctx.textBaseline = 'middle';
    // Set outboard of the badge and sized to clear it.
    ctx.font = `bold ${H * 0.06}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('972-412-6033', W * 0.14, H * 0.4);
    ctx.fillText('817-572-9797', W * 0.86, H * 0.4);

    ctx.font = `${H * 0.05}px system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText('firehousemovers.com', W * 0.05, H * 0.14);

    // The registrations, small and low, exactly where they sit on the
    // real vehicle — and they are what makes the licensing claim
    // checkable.
    ctx.font = `${H * 0.038}px system-ui, sans-serif`;
    ctx.fillText(BUSINESS.usdot, W * 0.05, H * 0.86);
    ctx.fillText(BUSINESS.txdmv, W * 0.05, H * 0.92);

    ctx.restore();
  };

  paintBase();

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;

  // The official badge replaces a hand-traced approximation. It is a
  // white-on-red disc in its own right, so it is drawn straight onto the
  // body with no plate behind it.
  void loadLogo()
    .then((img) => {
      // Sized to leave the phone numbers clear: the badge is drawn over
      // them, so any overlap eats their digits.
      const d = H * 0.7;
      ctx.save();
      if (mirrored) {
        ctx.translate(W, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(img, W * 0.5 - d / 2, H * 0.5 - d / 2, d, d);
      ctx.restore();
      // Without this the GPU keeps the copy uploaded before the logo
      // arrived, and the trailer stays blank for the whole session.
      tex.needsUpdate = true;
    })
    .catch(() => {
      // If the logo cannot be fetched the trailer still reads as a
      // liveried vehicle — body colour, phone numbers, and web address
      // are all already painted.
    });

  return tex;
}

/**
 * The rear roller door: horizontal slats with rolled ribs, a pull
 * handle, and a kick plate.
 *
 * This replaces a row of 0.001-unit-thick box meshes that scored the
 * slat lines geometrically. At any realistic distance those were well
 * under a pixel wide, so they aliased into dashed fragments and the
 * post-processing chromatic aberration fringed them red and blue —
 * bright coloured threads across an otherwise plain panel. Shading the
 * slats into a texture removes the sub-pixel geometry entirely and
 * gives each slat a proper rolled highlight and shadow, which is what
 * makes it read as pressed steel rather than a drawn-on line.
 */
export function rollerDoorTexture(): THREE.CanvasTexture {
  const W = 512;
  const H = 512;
  const { canvas, ctx } = makeCanvas(W, H);
  const SLATS = 9;
  const pitch = H / SLATS;

  ctx.fillStyle = COLORS.truckChrome;
  ctx.fillRect(0, 0, W, H);

  for (let i = 0; i < SLATS; i++) {
    const top = i * pitch;
    // Each slat is a shallow cylinder in cross-section: dark in the
    // valley at its top edge, brightest a third of the way down, easing
    // back to mid-tone at the bottom.
    const g = ctx.createLinearGradient(0, top, 0, top + pitch);
    g.addColorStop(0, 'rgba(0,0,0,0.42)');
    g.addColorStop(0.12, 'rgba(0,0,0,0.16)');
    g.addColorStop(0.36, 'rgba(255,255,255,0.3)');
    g.addColorStop(0.72, 'rgba(255,255,255,0.06)');
    g.addColorStop(1, 'rgba(0,0,0,0.2)');
    ctx.fillStyle = g;
    ctx.fillRect(0, top, W, pitch);
  }

  // Vertical stiffening ribs, faint.
  ctx.fillStyle = 'rgba(0,0,0,0.07)';
  for (let x = 0; x < W; x += W / 12) ctx.fillRect(x, 0, 2, H);

  // Kick plate along the bottom, scuffed the way a loading door is.
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(0, H * 0.9, W, H * 0.1);

  // Pull handle, centred low.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(W * 0.42, H * 0.8, W * 0.16, H * 0.028);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(W * 0.42, H * 0.8, W * 0.16, H * 0.008);

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
