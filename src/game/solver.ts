import type { Level, Run, Turn } from "../core/types";
import { beatOf } from "./hazards";
import { advance, itemLive, newRun, swing } from "./rules";

// ---------------------------------------------------------------------------
// SOLVER — breadth-first search over every tick: at each one the player can wait or swing
// either way. Proves a level can be beaten and finds the shortest way (fewest ticks, then
// fewest swings). Used by the tests today, and meant for the level editor later, to refuse
// levels nobody can finish.
// ---------------------------------------------------------------------------

/** one action per tick: 0 wait, 1 clockwise, -1 counterclockwise */
export type Action = 0 | Turn;

export interface Solution { actions: Action[]; ticks: number; swings: number }

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
function key(r: Run): string {
  const a = r.boots[r.anchor], m = r.boots[1 - r.anchor];
  let k = `${a.x},${a.y},${m.x},${m.y},${r.got},${Math.min(r.tick - r.lastMoveTick, 9)},`;
  for (const i of liveItems(r.lv, beatOf(r.lv, r.tick))) k += r.taken[i] ? "1" : "0";
  return k;
}

export interface SolveOpts {
  /** give up after this many ticks */
  maxTicks?: number;
  /** ticks that must pass between swings. 1 = as fast as the game allows; 2 = a human pace */
  cooldown?: number;
}

export function solve(lv: Level, opts: SolveOpts = {}): Solution | null {
  const maxTicks = opts.maxTicks ?? 1200, cooldown = opts.cooldown ?? 1;
  const start = newRun(lv);
  if (start.status === "won") return { actions: [], ticks: 0, swings: 0 };
  if (start.status === "dead") return null;
  // nodes link back to their parent instead of copying the path at every tick
  type Node = { r: Run; parent: Node | null; act: Action; swings: number };
  const pathOf = (n: Node): Action[] => { const p: Action[] = []; for (let c: Node | null = n; c && c.parent; c = c.parent) p.push(c.act); return p.reverse(); };
  let layer: Node[] = [{ r: start, parent: null, act: 0, swings: 0 }];
  for (let t = 0; t < maxTicks && layer.length; t++) {
    const next = new Map<string, Node>();
    let winner: Node | null = null;
    for (const n of layer) {
      for (const act of [0, 1, -1] as Action[]) {
        if (act && n.r.lastMoveTick >= 0 && n.r.tick - n.r.lastMoveTick < cooldown) continue;
        const r = clone(n.r);
        if (act) swing(r, act);
        if (r.status === "play") advance(r);
        if (r.status === "dead") continue;
        const node: Node = { r, parent: n, act, swings: n.swings + (act ? 1 : 0) };
        if (r.status === "won") {
          if (!winner || node.swings < winner.swings) winner = node;
          continue;
        }
        const k = key(r);
        const old = next.get(k);
        if (!old || node.swings < old.swings) next.set(k, node);
      }
    }
    if (winner) { const actions = pathOf(winner); return { actions, ticks: actions.length, swings: winner.swings }; }
    layer = [...next.values()];
  }
  return null;
}

/** replays a solution through the rules: the test that solver and game agree */
export function replay(lv: Level, actions: Action[]): Run {
  const r = newRun(lv);
  for (const a of actions) {
    if (r.status !== "play") break;
    if (a) swing(r, a);
    if (r.status === "play") advance(r);
  }
  return r;
}
