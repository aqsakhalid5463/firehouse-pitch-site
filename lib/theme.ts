import { COLORS, SECTIONS } from './constants';
import { rangeProgress, lerp } from './scroll-math';

export type ThemeValues = {
  bg: string;
  fog: string;
  ink: string;
  lightIntensity: number;
  bloomIntensity: number;
  emberOpacity: number;
};

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function toHex(n: number): string {
  return Math.round(n).toString(16).padStart(2, '0');
}

export function mixHex(a: string, b: string, t: number): string {
  if (t <= 0) return a;
  if (t >= 1) return `#${hexToRgb(b).map(toHex).join('')}`;
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return `#${toHex(lerp(ar, br, t))}${toHex(lerp(ag, bg, t))}${toHex(lerp(ab, bb, t))}`;
}

/**
 * The dark to light dissolve. Every value is a function of scroll
 * progress, interpolated across the Guarantees range and nowhere else.
 */
export function themeAt(p: number): ThemeValues {
  const t = rangeProgress(p, SECTIONS.guarantees);
  return {
    bg: mixHex(COLORS.darkBg, COLORS.lightBg, t),
    fog: mixHex(COLORS.darkFog, COLORS.lightFog, t),
    ink: mixHex(COLORS.bone, COLORS.ink, t),
    lightIntensity: lerp(0.6, 2.4, t),
    bloomIntensity: lerp(1.15, 0, t),
    emberOpacity: lerp(1, 0, t),
  };
}
