import type { Level, Run } from "../core/types";
import { beatOf } from "./hazards";
import { advance, itemLive, newRun, press } from "./rules";

// ---------------------------------------------------------------------------
// SOLVER — breadth-first search over every tick: at each one the player can wait or press
// either boot. Proves a level can be beaten and finds the shortest way (fewest ticks, then
// fewest presses). Used by the tests today, and meant for the level editor later, to refuse
// levels nobody can finish.
// ---------------------------------------------------------------------------

/** one action per tick: 0 wait, 1 press the left boot, 2 press the right boot */
export type Action = 0 | 1 | 2;

export interface Solution { actions: Action[]; ticks: number; presses: number }

function clone(r: Run): Run {
  return { ...r, boots: [{ ...r.boots[0] }, { ...r.boots[1] }], taken: r.taken.slice() };
}

// only the pickups on the board right now can still change anything, so only they go in the key
const liveCache = new WeakMap<Level, Map<number, number[]>>();
function liveItems(lv: Level, beat: number): number[] {
  let m = liveCache.get(lv); if (!m) liveCache.set(lv, m = new Map());
  let l = m.get(beat);
  if (!l) { l = []; lv.items.forEach((it, i) => { if (itemLive(it, beat)) l!.push(i); }); m.set(beat, l); }
  return l;
}
function key(r: Run, cooldown: number): string {
  const a = r.boots[0], b = r.boots[1];
  let k = `${a.x},${a.y},${b.x},${b.y},${r.got},${Math.min(r.tick - r.lastMoveTick, cooldown)},`;
  for (const i of liveItems(r.lv, beatOf(r.lv, r.tick))) k += r.taken[i] ? "1" : "0";
  return k;
}

export interface SolveOpts {
  /** give up after this many ticks */
  maxTicks?: number;
  /** ticks that must pass between presses. 1 = as fast as the game allows; 2 = a human pace */
  cooldown?: number;
}

export function solve(lv: Level, opts: SolveOpts = {}): Solution | null {
  const maxTicks = opts.maxTicks ?? 1200, cooldown = opts.cooldown ?? 1;
  const start = newRun(lv);
  if (start.status === "won") return { actions: [], ticks: 0, presses: 0 };
  if (start.status === "dead") return null;
  // nodes link back to their parent instead of copying the path at every tick
  type Node = { r: Run; parent: Node | null; act: Action; presses: number };
  const pathOf = (n: Node): Action[] => { const p: Action[] = []; for (let c: Node | null = n; c && c.parent; c = c.parent) p.push(c.act); return p.reverse(); };
  let layer: Node[] = [{ r: start, parent: null, act: 0, presses: 0 }];
  for (let t = 0; t < maxTicks && layer.length; t++) {
    const next = new Map<string, Node>();
    let winner: Node | null = null;
    for (const n of layer) {
      for (const act of [0, 1, 2] as Action[]) {
        if (act && n.r.lastMoveTick >= 0 && n.r.tick - n.r.lastMoveTick < cooldown) continue;
        const r = clone(n.r);
        if (act) press(r, act === 1 ? 0 : 1);
        if (r.status === "play") advance(r);
        if (r.status === "dead") continue;
        const node: Node = { r, parent: n, act, presses: n.presses + (act ? 1 : 0) };
        if (r.status === "won") {
          if (!winner || node.presses < winner.presses) winner = node;
          continue;
        }
        const k = key(r, cooldown);
        const old = next.get(k);
        if (!old || node.presses < old.presses) next.set(k, node);
      }
    }
    if (winner) { const actions = pathOf(winner); return { actions, ticks: actions.length, presses: winner.presses }; }
    layer = [...next.values()];
  }
  return null;
}

/** replays a solution through the rules: the test that solver and game agree */
export function replay(lv: Level, actions: Action[]): Run {
  const r = newRun(lv);
  for (const a of actions) {
    if (r.status !== "play") break;
    if (a) press(r, a === 1 ? 0 : 1);
    if (r.status === "play") advance(r);
  }
  return r;
}

/** actions to the compact proof format of LevelDef.proof */
export function encodeProof(actions: Action[]): string {
  let out = "", wait = 0;
  for (const a of actions) {
    if (!a) { wait++; continue; }
    if (wait) { out += wait; wait = 0; }
    out += a === 1 ? "L" : "R";
  }
  return wait ? out + wait : out;                 // trailing waits matter: Survival ends standing still
}
export function decodeProof(proof: string): Action[] {
  const out: Action[] = [];
  for (const m of proof.matchAll(/(\d+)|L|R/g)) {
    if (m[1]) for (let i = 0; i < +m[1]; i++) out.push(0);
    else out.push(m[0] === "L" ? 1 : 2);
  }
  return out;
}
