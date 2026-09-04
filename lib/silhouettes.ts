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
