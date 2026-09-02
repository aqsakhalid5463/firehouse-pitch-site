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

/**
 * Draws the company's circular badge: a white ring carrying the name,
 * with a fire helmet at its centre. Traced from the livery in
 * public/images/two_trucks.jpg.
 */
function drawBadge(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.save();
  ctx.translate(cx, cy);

  // White disc with a red rim.
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = COLORS.truckBodyRed;
  ctx.lineWidth = r * 0.07;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.93, 0, Math.PI * 2);
  ctx.stroke();

  // "FIREHOUSE" arched over the top, "MOVERS" along the bottom. Each
  // glyph is rotated to sit on the circle's tangent.
  // Top of the ring: each glyph is rotated onto the circle's tangent,
  // so the word arches over the badge.
  const arcTop = (text: string, radius: number) => {
    ctx.save();
    ctx.fillStyle = COLORS.truckBodyRed;
    ctx.font = `bold ${r * 0.2}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const step = (r * 0.145) / radius;
    const start = -(step * (text.length - 1)) / 2;
    for (let i = 0; i < text.length; i++) {
      ctx.save();
      ctx.rotate(start + step * i);
      ctx.translate(0, -radius);
      ctx.fillText(text[i], 0, 0);
      ctx.restore();
    }
    ctx.restore();
  };

  // Bottom of the ring: glyphs follow the arc's *position* but stay
  // upright. Rotating them onto the tangent the way the top word does
  // turns each letter through 180 degrees down here, which renders the
  // word upside down.
  const arcBottom = (text: string, radius: number) => {
    ctx.save();
    ctx.fillStyle = COLORS.truckBodyRed;
    ctx.font = `bold ${r * 0.2}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const step = (r * 0.15) / radius;
    const start = -(step * (text.length - 1)) / 2;
    for (let i = 0; i < text.length; i++) {
      const a = start + step * i;
      ctx.fillText(text[i], Math.sin(a) * radius, Math.cos(a) * radius);
    }
    ctx.restore();
  };

  arcTop('FIREHOUSE', r * 0.74);
  arcBottom('MOVERS', r * 0.72);

  // Fire helmet, drawn as a silhouette in three parts: the wide brim
  // that sweeps up at the sides, the domed crown, and the front shield.
  // An earlier version stacked an ellipse, a half-disc and a triangle,
  // which fused into a shapeless blob at badge size — the brim's upward
  // sweep and the shield are what actually make it read as a fire
  // helmet rather than a hat.
  ctx.fillStyle = COLORS.truckBodyRed;

  // Brim: flat underside, curved top, tips lifted.
  ctx.beginPath();
  ctx.moveTo(-r * 0.46, r * 0.16);
  ctx.quadraticCurveTo(0, r * 0.3, r * 0.46, r * 0.16);
  ctx.quadraticCurveTo(0, r * 0.08, -r * 0.46, r * 0.16);
  ctx.closePath();
  ctx.fill();

  // Crown: dome rising from the brim.
  ctx.beginPath();
  ctx.moveTo(-r * 0.29, r * 0.17);
  ctx.quadraticCurveTo(-r * 0.3, -r * 0.2, 0, -r * 0.24);
  ctx.quadraticCurveTo(r * 0.3, -r * 0.2, r * 0.29, r * 0.17);
  ctx.closePath();
  ctx.fill();

  // Front shield, in white so it separates from the crown behind it.
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.moveTo(-r * 0.12, -r * 0.13);
  ctx.lineTo(r * 0.12, -r * 0.13);
  ctx.lineTo(r * 0.1, r * 0.05);
  ctx.lineTo(0, r * 0.13);
  ctx.lineTo(-r * 0.1, r * 0.05);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
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

  if (mirrored) {
    ctx.translate(W, 0);
    ctx.scale(-1, 1);
  }

  ctx.fillStyle = COLORS.truckBodyRed;
  ctx.fillRect(0, 0, W, H);

  // Faint horizontal panel seams, the way a real box body is ribbed.
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 2;
  for (let i = 1; i < 8; i++) {
    const x = (W / 8) * i;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }

  drawBadge(ctx, W * 0.5, H * 0.47, H * 0.3);

  ctx.fillStyle = '#FFFFFF';
  ctx.textBaseline = 'middle';
  // Set outboard of the badge and sized to clear it — at the previous
  // size and position both numbers ran under the disc and lost their
  // last digits.
  ctx.font = `bold ${H * 0.068}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('972-412-6033', W * 0.17, H * 0.4);
  ctx.fillText('817-572-9797', W * 0.83, H * 0.4);

  ctx.font = `${H * 0.05}px system-ui, sans-serif`;
  ctx.textAlign = 'left';
  ctx.fillText('firehousemovers.com', W * 0.05, H * 0.14);

  // The registrations, small and low, exactly where they sit on the real
  // vehicle — and they are what makes the licensing claim checkable.
  ctx.font = `${H * 0.038}px system-ui, sans-serif`;
  ctx.fillText(BUSINESS.usdot, W * 0.05, H * 0.86);
  ctx.fillText(BUSINESS.txdmv, W * 0.05, H * 0.92);

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
