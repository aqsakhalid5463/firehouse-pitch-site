/**
 * The top-down truck used as a marker wherever a road is drawn flat on
 * the page — the scroll ribbon's drawing tip and the preloader's road.
 * Drawn at 32x22 in its own coordinates and pointing along +X, so a
 * tangent angle can be applied directly by the consumer.
 */
export function TruckGlyph() {
  return (
    <>
      <rect x="0" y="3" width="21" height="16" rx="2" fill="var(--color-silver-glass)" />
      <rect x="20" y="1" width="12" height="20" rx="3" fill="var(--color-fire)" />
      <rect x="28" y="5" width="3" height="12" rx="1.5" fill="#0A0A0C" />
      <rect x="2" y="0" width="15" height="3" rx="1.5" fill="#0A0A0C" />
      <rect x="2" y="19" width="15" height="3" rx="1.5" fill="#0A0A0C" />
    </>
  );
}
