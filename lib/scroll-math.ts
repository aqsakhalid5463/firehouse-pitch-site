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
