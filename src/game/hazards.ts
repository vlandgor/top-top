import type { Level, Sentry, Sweep, SweepDir, Vec } from "../core/types";

// HAZARDS — where danger is at any moment. Pure functions of the level and the beat, so the
// patterns are exactly the same on every attempt.

export function beatOf(lv: Level, tick: number): number { return Math.floor(tick / lv.beat); }

// ---- sentries: one step along their loop per beat ----------------------------------------
export function sentryAt(s: Sentry, beat: number): Vec {
  const n = s.tiles.length;
  return s.tiles[(((beat + s.phase) % n) + n) % n];
}

// ---- sweeps: a front that crosses the board lane by lane ---------------------------------
/** how far along the sweep a tile is: the front reaches lane L at start + L*speed */
export function laneOf(dir: SweepDir, x: number, y: number, w: number, h: number): number {
  switch (dir) {
    case "down": return y;
    case "up": return h - 1 - y;
    case "right": return x;
    case "left": return w - 1 - x;
    case "diag": return x + y;
    case "antidiag": return (w - 1 - x) + y;
    case "all": return 0;
  }
}
/** position across the sweep, which is what `gaps` refers to */
function crossOf(dir: SweepDir, x: number, y: number, w: number, h: number): [number, number] {
  switch (dir) {
    case "left": case "right": return [y, h];
    case "diag": return [x - y + h - 1, w + h - 1];
    case "antidiag": return [x + y, w + h - 1];
    default: return [x, w];
  }
}
export function sweepHit(sw: Sweep, cycle: number, lane: number): number {
  return sw.start + cycle * sw.every + lane * sw.speed;
}
function inGap(sw: Sweep, cycle: number, x: number, y: number, w: number, h: number): boolean {
  if (!sw.gaps.length) return false;
  const [c, span] = crossOf(sw.dir, x, y, w, h);
  const shifted = (((c - cycle * sw.gapShift) % span) + span) % span;
  return sw.gaps[cycle % sw.gaps.length].includes(shifted);
}

export interface SweepState {
  /** lethal right now */
  lethal: boolean;
  /** 0..1 warning glow (1 = about to turn lethal), 0 when quiet */
  warn: number;
}
const QUIET: SweepState = { lethal: false, warn: 0 };

/** state of one tile for one sweep at a (fractional) beat */
export function sweepAt(sw: Sweep, x: number, y: number, beat: number, w: number, h: number): SweepState {
  const lane = laneOf(sw.dir, x, y, w, h);
  const base = beat - sw.start - lane * sw.speed;
  if (base < -sw.warn) return QUIET;
  const c0 = sw.every ? Math.floor(base / sw.every) : 0;
  let best = QUIET;
  for (let c = c0 - 1; c <= c0 + 1; c++) {
    if (c < 0 || c >= sw.count) continue;
    const hit = sweepHit(sw, c, lane);
    if (beat < hit - sw.warn || beat >= hit + sw.lethal) continue;
    if (inGap(sw, c, x, y, w, h)) continue;
    if (beat >= hit) return { lethal: true, warn: 1 };
    const wv = 1 - (hit - beat) / sw.warn;
    if (wv > best.warn) best = { lethal: false, warn: wv };
  }
  return best;
}

// Danger depends only on the level and the beat, so each beat's map of deadly tiles is worked
// out once and kept (1 = sentry, 2 = sweep). The solver asks millions of times; this makes
// every ask after the first a lookup.
const maskCache = new WeakMap<Level, Map<number, Uint8Array>>();
function dangerMap(lv: Level, b: number): Uint8Array {
  let byBeat = maskCache.get(lv); if (!byBeat) maskCache.set(lv, byBeat = new Map());
  let m = byBeat.get(b);
  if (!m) {
    m = new Uint8Array(lv.w * lv.h);
    for (const sw of lv.sweeps) for (let y = 0; y < lv.h; y++) for (let x = 0; x < lv.w; x++)
      if (sweepAt(sw, x, y, b, lv.w, lv.h).lethal) m[y * lv.w + x] = 2;
    for (const s of lv.sentries) { const p = sentryAt(s, b); m[p.y * lv.w + p.x] = 1; }
    byBeat.set(b, m);
  }
  return m;
}

/** is this tile deadly at this tick? the one rule every death goes through */
export function lethalAt(lv: Level, x: number, y: number, tick: number): "" | "sentry" | "sweep" {
  const v = dangerMap(lv, beatOf(lv, tick))[y * lv.w + x];
  return v === 1 ? "sentry" : v === 2 ? "sweep" : "";
}
