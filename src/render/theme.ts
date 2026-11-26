import type { Mode } from "../core/types";

// The palette: a dark LED dance floor. Teal is the game's colour; each mode has an accent.
export const C = {
  bg: "#05080a",
  tile: "#0a1113",
  tileEdge: "#132024",
  teal: "#19e3c8",
  boot: "#e9fffb",
  hazard: "#ff3b4e",
};

export const ACCENT: Record<Mode, string> = {
  destination: "#19e3c8",
  collect: "#ff7a5c",
  sequence: "#a77bff",
  survival: "#ff3b4e",
  waves: "#4db8ff",
};

/** "#rrggbb" + alpha 0..1 -> rgba() */
export function rgba(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
}

/** a blend of two "#rrggbb" colours: k = 0 gives a, 1 gives b */
export function mix(a: string, b: string, k: number): string {
  const p = parseInt(a.slice(1), 16), q = parseInt(b.slice(1), 16);
  const ch = (sh: number) => Math.round(((p >> sh) & 255) * (1 - k) + ((q >> sh) & 255) * k);
  return "#" + ((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1);
}
