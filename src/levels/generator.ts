// ---------------------------------------------------------------------------
// LEVEL RECIPES — how a level of each mode is built for a slot on the difficulty curve (0 is
// the first, COUNT - 1 the last), and the judge that throws away unfair or unbeatable ones.
// Pure and seeded: tools/gen-levels.ts uses it to make the 100 levels, and the daily level
// (daily.ts) to make one level a day, the same on every phone.
// ---------------------------------------------------------------------------
import type { LevelDef, Mode, SentryDef, SweepDef } from "../core/types";
import { parseLevel } from "./parse";
import { lethalAt } from "../game/hazards";
import { encodeProof, replay, solve } from "../game/solver";
import { advance, newRun, press } from "../game/rules";

export const COUNT = 20;

// ---- seeded randomness --------------------------------------------------------------------
export function rngOf(seed: number){
  let a = seed >>> 0;
  const next = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return {
    next,
    int: (lo: number, hi: number) => lo + Math.floor(next() * (hi - lo + 1)),   // inclusive
    pick: <T>(xs: T[]) => xs[Math.floor(next() * xs.length)],
    chance: (p: number) => next() < p,
  };
}
export type Rng = ReturnType<typeof rngOf>;

// ---- building blocks ----------------------------------------------------------------------
interface Board { w: number; h: number; ax: number; ay: number; marks: Map<string, string> }
const k = (x: number, y: number) => `${x},${y}`;

/** board size grows from 6x4 to 11x7 across the 20 slots */
function boardFor(i: number, rng: Rng, minW = 6, minH = 4): { w: number; h: number } {
  const t = i / (COUNT - 1);
  const w = Math.min(11, Math.max(minW, Math.round(6 + 5 * t) + rng.int(-1, 0)));
  const h = Math.min(7, Math.max(minH, Math.round(4 + 3 * t) + rng.int(-1, 0)));
  return { w, h };
}
/** the boots side by side, left boot at (ax, ay) */
function placeBoots(b: { w: number; h: number }, rng: Rng, side: "left" | "any" | "middle"): Board {
  const ax = side === "left" ? rng.int(0, 1) : side === "middle" ? Math.floor(b.w / 2) - 1 : rng.int(0, b.w - 2);
  const ay = side === "middle" ? Math.floor(b.h / 2) : rng.int(0, b.h - 1);
  return { ...b, ax, ay, marks: new Map() };
}
const isStart = (bd: Board, x: number, y: number) => y === bd.ay && (x === bd.ax || x === bd.ax + 1);
/** a free tile at least `minDist` (king moves) from the boots */
function freeTile(bd: Board, rng: Rng, minDist: number, avoid = 1): [number, number] | null {
  for (let tries = 0; tries < 200; tries++) {
    const x = rng.int(0, bd.w - 1), y = rng.int(0, bd.h - 1);
    if (isStart(bd, x, y) || bd.marks.has(k(x, y))) continue;
    const d = Math.min(Math.max(Math.abs(x - bd.ax), Math.abs(y - bd.ay)), Math.max(Math.abs(x - bd.ax - 1), Math.abs(y - bd.ay)));
    if (d < minDist) continue;
    let near = false;
    for (const key of bd.marks.keys()) { const [mx, my] = key.split(",").map(Number); if (Math.max(Math.abs(mx - x), Math.abs(my - y)) < avoid) near = true; }
    if (near) continue;
    return [x, y];
  }
  return null;
}
function mapOf(bd: Board): string[] {
  const rows: string[] = [];
  for (let y = 0; y < bd.h; y++) {
    let r = "";
    for (let x = 0; x < bd.w; x++) r += isStart(bd, x, y) ? (x === bd.ax ? "A" : "B") : bd.marks.get(k(x, y)) || ".";
    rows.push(r);
  }
  return rows;
}

/** a sentry walking a straight line across the board, or a small loop */
function sentry(bd: Board, rng: Rng, kind: "line" | "loop"): SentryDef {
  if (kind === "loop") {
    const x0 = rng.int(0, bd.w - 3), y0 = rng.int(0, bd.h - 3);
    const x1 = rng.int(x0 + 2, Math.min(bd.w - 1, x0 + 5)), y1 = rng.int(y0 + 2, Math.min(bd.h - 1, y0 + 4));
    const pts = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
    if (rng.chance(0.5)) pts.reverse();
    return { path: pts.map(p => p.join(",")).join(" "), phase: rng.int(0, 7) };
  }
  if (rng.chance(0.5)) {                                   // a column, up and down
    const x = rng.int(1, bd.w - 2);
    return { path: `${x},0 ${x},${bd.h - 1}`, phase: rng.int(0, 2 * bd.h) };
  }
  const y = rng.int(0, bd.h - 1);                          // a row, side to side
  return { path: `0,${y} ${bd.w - 1},${y}`, phase: rng.int(0, 2 * bd.w) };
}

/** gap sets for a repeating sweep: each pass's gap a few lanes from the last */
function gapSets(rng: Rng, span: number, width: number, passes: number): number[][] {
  const sets: number[][] = [];
  let at = rng.int(0, span - width);
  for (let p = 0; p < passes; p++) {
    sets.push(Array.from({ length: width }, (_, j) => at + j));
    at = Math.max(0, Math.min(span - width, at + rng.int(-3, 3)));
  }
  return sets;
}
function sweep(bd: Board, rng: Rng, dir: SweepDef["dir"], o: { start: number; every: number; warn: number; gap: number; speed?: number }): SweepDef {
  const span = dir === "left" || dir === "right" ? bd.h : dir === "diag" || dir === "antidiag" ? bd.w + bd.h - 1 : bd.w;
  return { dir, start: o.start, every: o.every, warn: o.warn, speed: o.speed ?? (dir === "all" ? 0 : 1), gaps: gapSets(rng, span, Math.min(o.gap, span - 1), 4) };
}

// ---- the recipes: what each slot of each mode may contain ----------------------------------
// t runs 0..1 over the 20 slots. Each hazard type arrives alone, slowly, before it is mixed.
type Recipe = (i: number, rng: Rng) => LevelDef | null;

function hazardsFor(i: number, bd: Board, rng: Rng, d: LevelDef, plan: { sentryFrom: number; sweepFrom: number }){
  const s = i - plan.sentryFrom, w = i - plan.sweepFrom;
  const sentries: SentryDef[] = [];
  const sweeps: SweepDef[] = [];
  if (s >= 0) {
    const n = s < 4 ? 1 : s < 8 ? 2 : 3;
    for (let j = 0; j < n; j++) sentries.push(sentry(bd, rng, s >= 6 && rng.chance(0.4) ? "loop" : "line"));
  }
  if (w >= 0) {
    const dir = rng.pick(w < 2 ? ["diag", "antidiag"] as const : ["diag", "antidiag", "down", "right"] as const);
    sweeps.push(sweep(bd, rng, dir, { start: 5, every: w < 2 ? 12 : 10, warn: w < 2 ? 4 : 3, gap: w < 2 ? 4 : 3 }));
    if (w < 2) sentries.splice(0);                         // a new hazard is met on its own first
    else if (sentries.length > 2) sentries.splice(2);
  }
  if (sentries.length) d.sentries = sentries;
  if (sweeps.length) d.sweeps = sweeps;
  // slow beats while hazards are new
  d.beat = i < plan.sentryFrom + 4 ? 6 : i < plan.sentryFrom + 9 ? 5 : 4;
}

export const RECIPES: Record<Mode, Recipe> = {
  destination: (i, rng) => {
    const bd = placeBoots(boardFor(i, rng), rng, "left");
    const g = freeTile(bd, rng, Math.max(3, Math.round(bd.w * (i < 3 ? 0.5 : 0.65))));
    if (!g) return null;
    bd.marks.set(k(g[0], g[1]), "G");
    const d: LevelDef = { id: "", name: "", mode: "destination", map: [] };
    hazardsFor(i, bd, rng, d, { sentryFrom: 3, sweepFrom: 13 });
    d.map = mapOf(bd);
    return d;
  },
  collect: (i, rng) => {
    const bd = placeBoots(boardFor(i, rng), rng, "any");
    const n = 2 + Math.floor(i / 4);
    for (let j = 0; j < n; j++) { const p = freeTile(bd, rng, 2, 2); if (!p) return null; bd.marks.set(k(p[0], p[1]), "o"); }
    const d: LevelDef = { id: "", name: "", mode: "collect", map: [] };
    hazardsFor(i, bd, rng, d, { sentryFrom: 3, sweepFrom: 14 });
    d.map = mapOf(bd);
    return d;
  },
  sequence: (i, rng) => {
    const bd = placeBoots(boardFor(i, rng), rng, "any");
    const n = 2 + Math.floor(i / 4);
    for (let j = 1; j <= n; j++) { const p = freeTile(bd, rng, 2, 2); if (!p) return null; bd.marks.set(k(p[0], p[1]), String(j)); }
    const d: LevelDef = { id: "", name: "", mode: "sequence", map: [] };
    hazardsFor(i, bd, rng, d, { sentryFrom: 3, sweepFrom: 14 });
    d.map = mapOf(bd);
    return d;
  },
  survival: (i, rng) => {
    const bd = placeBoots(boardFor(i, rng, 7, 5), rng, "middle");
    const d: LevelDef = { id: "", name: "", mode: "survival", map: [], survive: Math.round(14 + 26 * i / (COUNT - 1)) };
    const sentries: SentryDef[] = [], sweeps: SweepDef[] = [];
    if (i < 4) {                                           // sentries only, slow, crossing where you stand
      sentries.push({ path: `0,${bd.ay} ${bd.w - 1},${bd.ay}`, phase: rng.int(0, 2 * bd.w) });
      if (i >= 2) { const x = rng.pick([bd.ax - 1, bd.ax + 2]); sentries.push({ path: `${x},0 ${x},${bd.h - 1}`, phase: rng.int(0, 2 * bd.h) }); }
      d.beat = 6;
    } else if (i < 8) {                                    // whole-board pulses with wide gaps
      sweeps.push(sweep(bd, rng, "all", { start: 5, every: 9, warn: 4, gap: 3 }));
      d.beat = 5;
    } else if (i < 12) {                                   // pulses plus a sentry
      sweeps.push(sweep(bd, rng, "all", { start: 5, every: 8, warn: 3, gap: 2 }));
      sentries.push(sentry(bd, rng, "line"));
      d.beat = 5;
    } else if (i < 16) {                                   // waterfalls
      sweeps.push(sweep(bd, rng, rng.pick(["diag", "antidiag"] as const), { start: 4, every: 9, warn: 3, gap: 3 }));
      if (i >= 14) sweeps.push(sweep(bd, rng, rng.pick(["down", "right"] as const), { start: 8, every: 9, warn: 3, gap: 3 }));
      d.beat = 4;
    } else {                                               // everything
      sweeps.push(sweep(bd, rng, rng.pick(["diag", "antidiag", "all"] as const), { start: 4, every: 8, warn: 3, gap: 3 }));
      sweeps.push(sweep(bd, rng, rng.pick(["down", "right", "up", "left"] as const), { start: 8, every: 8, warn: 3, gap: 2 }));
      sentries.push(sentry(bd, rng, rng.pick(["line", "loop"] as const)));
      d.beat = 4;
    }
    if (sentries.length) d.sentries = sentries;
    if (sweeps.length) d.sweeps = sweeps;
    d.map = mapOf(bd);
    return d;
  },
  waves: (i, rng) => {
    const t = i / (COUNT - 1);
    const b = { w: Math.min(11, 7 + Math.round(4 * t)), h: Math.min(7, 5 + Math.round(2 * t)) };
    const bd = placeBoots(b, rng, "middle");
    bd.ay = b.h - 2;
    const span = b.w, gap = i < 8 ? 3 : 2;
    const sets = gapSets(rng, span, gap, 4);
    const sw: SweepDef = { dir: "down", start: 3, every: Math.round(14 - 4 * t), warn: i < 6 ? 4 : i < 14 ? 3 : 2, speed: i < 10 ? 1 : 0.5, gaps: sets };
    const drops: string[] = [];
    for (let p = 0; p < 4; p++) {
      const n = i < 8 || i >= 15 ? 2 : 3, pts: string[] = [];
      for (let j = 0; j < n; j++) pts.push(`${rng.int(0, b.w - 1)},${rng.int(0, b.h - 1)}`);
      drops.push([...new Set(pts)].join(" "));
    }
    const d: LevelDef = { id: "", name: "", mode: "waves", map: mapOf(bd), need: 3 + Math.floor(i / 4), sweeps: [sw], drops, beat: i < 6 ? 5 : 4 };
    if (i >= 14) { const y = rng.int(0, 1); d.sentries = [{ path: `0,${y} ${b.w - 1},${y}`, phase: rng.int(0, 8) }]; }
    return d;
  },
};

// ---- judging a candidate ------------------------------------------------------------------
export interface Judged { def: LevelDef; score: number; presses: number; beats: number; proof: string; bumps: number }

/** null if the level is unfair or can't be beaten; `scored: false` skips the slower-player solves that only rank levels */
export function judge(def: LevelDef, i: number, scored = true): Judged | null {
  let lv;
  try { lv = parseLevel({ ...def, id: "gen" }); } catch { return null; }
  // fair start: standing still is safe for 3 s in the first ten levels of a mode, 2 s after,
  // so there is time to read the board (and the tip) before anything arrives
  const graceTicks = (i < 10 ? 3000 : 2000) / 125;
  for (let t = 0; t < graceTicks; t++)
    for (const [x, y] of [[lv.start[0].x, lv.start[0].y], [lv.start[1].x, lv.start[1].y]])
      if (lethalAt(lv, x, y, t)) return null;
  const sol = solve(lv, { cooldown: 2, maxTicks: 900 });
  if (!sol) return null;
  if (replay(lv, sol.actions).status !== "won") return null;
  const hasHazards = !!(def.sentries?.length || def.sweeps?.length);
  // the hazards must matter: the best route on an empty board has to die on this one
  if (hasHazards && def.mode !== "survival" && def.mode !== "waves") {
    const calm = solve(parseLevel({ ...def, id: "gen", sentries: [], sweeps: [] }), { cooldown: 2, maxTicks: 900 });
    if (calm && replay(lv, calm.actions).status === "won") return null;
  }
  // survival has to make you move
  if (def.mode === "survival" && sol.presses < 2) return null;
  // timing pressure: harder if a slower player (a press every 3 or 4 ticks) could not make it
  let score = sol.presses;
  if (scored && hasHazards && def.mode !== "waves") {
    if (!solve(lv, { cooldown: 3, maxTicks: 900 })) score += 12;
    else if (!solve(lv, { cooldown: 4, maxTicks: 900 })) score += 6;
  }
  // and every time the best route has to stop and wait for something to pass
  const proof = encodeProof(sol.actions).replace(/\d+$/, "");
  score += 2 * (proof.match(/(?:[2-9]|\d\d+)(?=[LR])/g) || []).length;
  score += (def.sentries?.length || 0) * 2 + (def.sweeps?.length || 0) * 4;
  // how often the winning route bumps into the edge (for the hint that explains it)
  const r = newRun(lv); let bumps = 0;
  for (const a of sol.actions) { if (a) { press(r, a === 1 ? 0 : 1); if (r.last?.result === "back") bumps++; } if (r.status === "play") advance(r); }
  return { def, score, presses: sol.presses, beats: sol.ticks / lv.beat, proof: encodeProof(sol.actions), bumps };
}

