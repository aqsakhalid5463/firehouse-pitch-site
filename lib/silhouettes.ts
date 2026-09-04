import type { CrewFigure } from './content';

/**
 * Procedural crew silhouettes, drawn as flat shapes and then sampled
 * into particles.
 *
 * These are figures, not likenesses. That is a deliberate limit rather
 * than a shortcut: a portrait of a real person assembled from a
 * generated shape would be a picture of someone who does not look like
 * that, which is worse than an obvious abstraction. The variants differ
 * only by headwear and build, so each person reads as a distinct figure
 * without any of them claiming to be a photograph.
 *
 * Drawn into a unit box and scaled by the caller, so one description
 * serves every size the section renders at.
 */
export function drawFigure(
  ctx: CanvasRenderingContext2D,
  figure: CrewFigure,
  w: number,
  h: number,
): void {
  const cx = w / 2;
  // Everything below is a fraction of the box, so the figure keeps its
  // proportions at any resolution.
  const u = h / 100;

  ctx.fillStyle = '#fff';

  const headR = 11 * u;
  const headY = 22 * u;

  // Shoulders and torso. A trapezoid with rounded corners reads as a
  // body far better than a rectangle does, and the width is where most
  // of the difference between figures lives.
  const shoulder = (figure === 'hat' || figure === 'crew' ? 27 : 23) * u;
  const waist = shoulder * 0.82;
  const top = headY + headR + 4 * u;
  const bottom = h;

  ctx.beginPath();
  ctx.moveTo(cx - shoulder, top + 6 * u);
  ctx.quadraticCurveTo(cx - shoulder, top, cx - shoulder * 0.55, top);
  ctx.lineTo(cx + shoulder * 0.55, top);
  ctx.quadraticCurveTo(cx + shoulder, top, cx + shoulder, top + 6 * u);
  ctx.lineTo(cx + waist, bottom);
  ctx.lineTo(cx - waist, bottom);
  ctx.closePath();
  ctx.fill();

  // Neck.
  ctx.fillRect(cx - 4 * u, headY + headR - 2 * u, 8 * u, 8 * u);

  // Head.
  ctx.beginPath();
  ctx.arc(cx, headY, headR, 0, Math.PI * 2);
  ctx.fill();

  if (figure === 'hat') {
    // Hard hat: dome plus a brim wider than the head.
    ctx.beginPath();
    ctx.arc(cx, headY - 3 * u, headR * 0.95, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(cx - headR * 1.45, headY - 4 * u, headR * 2.9, 2.6 * u);
  } else if (figure === 'cap') {
    // Ball cap: dome plus a peak thrown forward.
    ctx.beginPath();
    ctx.arc(cx, headY - 2 * u, headR * 0.98, Math.PI, 0);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx - 1 * u, headY - 4 * u);
    ctx.lineTo(cx + headR * 1.8, headY - 3 * u);
    ctx.lineTo(cx + headR * 1.8, headY - 0.6 * u);
    ctx.lineTo(cx - 1 * u, headY - 1 * u);
    ctx.closePath();
    ctx.fill();
  } else if (figure === 'headset') {
    // Headset: a band over the crown and an earpiece on the boom.
    ctx.lineWidth = 2.2 * u;
    ctx.strokeStyle = '#fff';
    ctx.beginPath();
    ctx.arc(cx, headY, headR + 2.4 * u, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx - headR - 1.5 * u, headY + 1 * u, 3.2 * u, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx - headR - 1 * u, headY + 3 * u);
    ctx.quadraticCurveTo(cx - 6 * u, headY + 11 * u, cx - 1 * u, headY + 10 * u);
    ctx.lineWidth = 1.6 * u;
    ctx.stroke();
  } else if (figure === 'crew') {
    // A moving pad over one shoulder — the thing a crew lead is most
    // often actually carrying.
    ctx.beginPath();
    ctx.moveTo(cx + shoulder * 0.2, top + 2 * u);
    ctx.lineTo(cx + shoulder * 1.5, top - 5 * u);
    ctx.lineTo(cx + shoulder * 1.75, top + 6 * u);
    ctx.lineTo(cx + shoulder * 0.45, top + 12 * u);
    ctx.closePath();
    ctx.fill();
  }
}

/**
 * Every opaque pixel in a drawn figure, as points, thinned by `step`.
 *
 * Sampling a drawing rather than describing the points directly is what
 * lets the figures stay ordinary canvas paths — the shape is authored
 * once, in the function above, and the particle layout falls out of it.
 */
export function sampleFigure(
  figure: CrewFigure,
  w: number,
  h: number,
  step: number,
): Float32Array {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w));
  canvas.height = Math.max(1, Math.round(h));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return new Float32Array(0);

  drawFigure(ctx, figure, canvas.width, canvas.height);
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);

  const points: number[] = [];
  for (let y = 0; y < canvas.height; y += step) {
    for (let x = 0; x < canvas.width; x += step) {
      // Alpha only: the figure is drawn flat white, so anything painted
      // is part of it.
      if (data[(y * canvas.width + x) * 4 + 3] > 128) {
        points.push(x, y);
      }
    }
  }
  return new Float32Array(points);
}

/** Memoised image loads, so switching back to a crew member does not
 *  re-fetch and re-decode their photograph. */
const images = new Map<string, Promise<HTMLImageElement>>();

export function loadPortrait(src: string): Promise<HTMLImageElement> {
  const cached = images.get(src);
  if (cached) return cached;
  const pending = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
  images.set(src, pending);
  return pending;
}

/**
 * A photograph, as particles.
 *
 * The generated figures elsewhere in this file are shapes, so sampling
 * them is just "is this pixel painted". A photograph has no such
 * answer: every pixel is painted, and taking all of them gives a grey
 * rectangle rather than a person. What makes a face legible in a
 * stipple is where the particles are *dense*, so each candidate point
 * gets a weight and is kept in proportion to it.
 *
 * The weight is darkness plus local gradient, and the gradient term is
 * the one that does the work. Darkness alone finds the hair and the
 * shirt and almost nothing else — skin is bright, so a face weighted
 * only by tone comes out as a hole between two dark masses. Gradient
 * finds the edges: the jaw against the background, the line of the
 * nose, the eyes, the mouth. Together they read as a portrait.
 */
export function samplePortrait(
  img: HTMLImageElement,
  w: number,
  h: number,
  count: number,
): Float32Array {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w));
  canvas.height = Math.max(1, Math.round(h));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return new Float32Array(0);

  // Cover-fit, top-aligned: portraits are framed head-first, so when
  // the box is narrower than the photograph the crop should lose the
  // bottom of the torso rather than the top of the head.
  const scale = Math.max(canvas.width / img.width, canvas.height / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, (canvas.width - dw) / 2, 0, dw, dh);

  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const W = canvas.width;
  const H = canvas.height;
  const luma = (x: number, y: number) => {
    const i = (y * W + x) * 4;
    return (
      (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255
    );
  };

  // Step 2 keeps the candidate grid fine enough to catch an eye without
  // making the calibration below expensive.
  const STEP = 2;
  const xs: number[] = [];
  const ys: number[] = [];
  const weights: number[] = [];
  for (let y = 2; y < H - 2; y += STEP) {
    for (let x = 2; x < W - 2; x += STEP) {
      const l = luma(x, y);
      const gradient =
        Math.abs(luma(x + 2, y) - luma(x - 2, y)) +
        Math.abs(luma(x, y + 2) - luma(x, y - 2));
      // Flat and bright is the studio backdrop. The thresholds are
      // measured, not guessed: the backdrop in this photograph reads
      // 0.96 luma with a gradient of exactly zero, while the lit side
      // of a face reaches 0.97 with an average gradient of 0.033. A
      // looser rule — the first version used gradient < 0.05 — deleted
      // the brightest 80% of the face along with the wall behind it.
      if (l > 0.9 && gradient < 0.012) continue;
      // Tone is raised to a power so flat mid-tones thin out, and the
      // gradient term is weighted well above it. A stipple portrait is
      // legible because of where the marks *cluster*, and what should
      // cluster is the features — eyes, mouth, the line of the jaw —
      // not the even expanse of a cheek or a shirt.
      const weight = Math.min(
        1,
        Math.pow(1 - l, 1.7) * 0.35 + gradient * 3.2,
      );
      if (weight <= 0.02) continue;
      xs.push(x);
      ys.push(y);
      weights.push(weight);
    }
  }
  if (!xs.length) return new Float32Array(0);

  // Deterministic per-point value, so the portrait does not fizz when
  // it is re-sampled — Math.random here would reshuffle which points
  // survive on every resize.
  const noise = (x: number, y: number) => {
    const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return n - Math.floor(n);
  };

  // Find the gain that keeps roughly `count` points. Solved rather than
  // guessed: the right gain depends on how much of the frame the
  // subject fills, which differs per photograph.
  let low = 0;
  let high = 6;
  let gain = 1;
  for (let pass = 0; pass < 24; pass++) {
    gain = (low + high) / 2;
    let kept = 0;
    for (let i = 0; i < xs.length; i++) {
      if (noise(xs[i], ys[i]) < weights[i] * gain) kept++;
    }
    if (kept > count) high = gain;
    else low = gain;
  }

  const points: number[] = [];
  for (let i = 0; i < xs.length; i++) {
    if (noise(xs[i], ys[i]) < weights[i] * gain) points.push(xs[i], ys[i]);
  }
  return new Float32Array(points);
}
