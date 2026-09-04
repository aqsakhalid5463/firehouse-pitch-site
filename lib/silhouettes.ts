/**
 * The figures this file knows how to draw.
 *
 * Declared here rather than derived from the roster. It used to be
 * `CrewFigure`, which is inferred from whoever happens to be in CREW —
 * so removing two people from the crew list deleted two shapes from the
 * drawing vocabulary and broke the type check on functions that still
 * draw them. What can be drawn is a property of this file; who is on
 * the page is not.
 */
export type FigureKind = 'plain' | 'cap' | 'hat' | 'headset' | 'crew';

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
  figure: FigureKind,
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
  figure: FigureKind,
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

  /**
   * The backdrop, found by flooding inward from the frame edge.
   *
   * The first version defined background as "bright and flat", which is
   * only true of a white studio wall. The moment a portrait arrived
   * that was shot against the side of a red truck, that rule matched
   * nothing and the whole rectangle came back as subject. Brightness
   * was never the property that mattered.
   *
   * What is actually true of a backdrop is that it touches the edge of
   * the picture and the person does not. So the fill starts from the
   * border and spreads through pixels close in colour to the border's
   * own, and stops where the colour changes — at the edge of a head,
   * whatever colour is behind it. Interior highlights are safe by
   * construction: a bright patch on a cheek is enclosed by skin, so the
   * fill never reaches it, which is the failure the brightness rule
   * had.
   */
  const at = (x: number, y: number) => (y * W + x) * 4;

  /*
   * The backdrop's own colour, as the median of the top edge.
   *
   * The comparison has to be against this rather than against each
   * pixel's neighbour. Comparing neighbours is a gradient-following
   * fill, and a photograph is locally smooth almost everywhere — every
   * step from skin to skin, shirt to shirt, passes a
   * similar-to-my-neighbour test, so the fill walked the entire frame
   * and classified 100% of all three portraits as backdrop. Measured,
   * not guessed: that is exactly what it reported.
   *
   * Against a fixed reference the fill stops where the colour stops
   * being the backdrop, which is the edge of the person. Median rather
   * than mean so a stray dark pixel on the top edge cannot drag the
   * reference off the wall.
   */
  const edgeR: number[] = [];
  const edgeG: number[] = [];
  const edgeB: number[] = [];
  for (let x = 0; x < W; x += 2) {
    const i = at(x, 0);
    edgeR.push(data[i]);
    edgeG.push(data[i + 1]);
    edgeB.push(data[i + 2]);
  }
  const mid = (list: number[]) => {
    list.sort((a, b) => a - b);
    return list[Math.floor(list.length / 2)];
  };
  const keyR = mid(edgeR);
  const keyG = mid(edgeG);
  const keyB = mid(edgeB);

  /** Tolerance around the backdrop colour, as a squared RGB distance.
   *  Wide enough to absorb a lit wall's shading and a truck panel's
   *  seams, well inside the distance from any backdrop to skin. */
  const near = (i: number) => {
    const dr = data[i] - keyR;
    const dg = data[i + 1] - keyG;
    const db = data[i + 2] - keyB;
    return dr * dr + dg * dg + db * db < 62 * 62;
  };
  const backdrop = new Uint8Array(W * H);
  const queue: number[] = [];
  const push = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const cell = y * W + x;
    if (backdrop[cell]) return;
    // Seeds are checked too: an edge pixel that is already part of the
    // person — hair running off the side of the frame — must not start
    // a fill inside them.
    if (!near(at(x, y))) return;
    backdrop[cell] = 1;
    queue.push(x, y);
  };
  /*
   * Seeded from the top edge and the upper sides only — never the
   * bottom, and never the lower sides.
   *
   * Seeding from every border flooded the subject. In a head-and-
   * shoulders portrait the shoulders run off the bottom of the frame
   * and usually off both sides as well, so a fill starting there walks
   * straight into the person: Leon's grey shirt touches three borders,
   * and filling from them erased all of him but a dozen particles.
   *
   * What is reliably backdrop is above and beside the head. Everything
   * below that is reached only if it is genuinely connected by colour,
   * which is what the fill is for.
   */
  const SEED_DEPTH = Math.floor(H * 0.45);
  for (let x = 0; x < W; x++) push(x, 0);
  for (let y = 0; y < SEED_DEPTH; y++) {
    push(0, y);
    push(W - 1, y);
  }
  while (queue.length) {
    const y = queue.pop()!;
    const x = queue.pop()!;
    if (x > 0 && near(at(x - 1, y))) push(x - 1, y);
    if (x < W - 1 && near(at(x + 1, y))) push(x + 1, y);
    if (y > 0 && near(at(x, y - 1))) push(x, y - 1);
    if (y < H - 1 && near(at(x, y + 1))) push(x, y + 1);
  }
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
      if (backdrop[y * W + x]) continue;
      const l = luma(x, y);
      const gradient =
        Math.abs(luma(x + 2, y) - luma(x - 2, y)) +
        Math.abs(luma(x, y + 2) - luma(x, y - 2));
      // Tone is raised to a power so flat mid-tones thin out, and the
      // gradient term is weighted well above it. A stipple portrait is
      // legible because of where the marks *cluster*, and what should
      // cluster is the features — eyes, mouth, the line of the jaw —
      // not the even expanse of a cheek or a shirt.
      // The tone term is capped. Without a ceiling, a large flat dark
      // mass — a head of dark hair, the body of a red shirt — claims a
      // share of the budget in proportion to its area, and it is the
      // least informative part of the picture. Capping it leaves those
      // regions read as solid while freeing particles for the places
      // that actually carry a likeness.
      const weight = Math.min(
        1,
        Math.min(0.24, Math.pow(1 - l, 1.7) * 0.35) + gradient * 3.2,
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
