import type { Boot, Vec } from "../core/types";
import { beatOf, lethalAt } from "./hazards";
import { itemLive, nextTileOf } from "./rules";
import { pressPair, type Room } from "./room";

// ---------------------------------------------------------------------------
// BOTS — stand-in teammates, so co-op rooms can be played and tested solo. A bot steers one
// pair through the same pressPair() a person does, one decision per tick.
//
// How it thinks: a short breadth-first look ahead (HORIZON ticks) over its own pair, using the
// real rules and the real hazard schedule, finds how soon it could reach each light. It goes
// for the soonest one that another bot hasn't claimed and that a teammate isn't clearly closer
// to, follows that route, and thinks again when the light is gone or it slipped. With nothing
// reachable it just finds a way to stay alive.
//
// Skill is three knobs: how fast it presses, how long it takes to react to a new goal, and how
// often a press goes to the wrong boot (which can cost the team a life, like a person's slip).
// Everything random comes from a seed, so a match replays the same way.
// ---------------------------------------------------------------------------

/** one decision per tick: 0 wait, 1 press the left boot, 2 press the right boot (as in the solver) */
export type Action = 0 | 1 | 2;

export type SkillId = "easy" | "normal" | "hard";
export interface Skill {
  /** ticks between presses at the fastest. 2 is a quick human */
  pace: number;
  /** ticks it waits before acting on a new goal */
  react: number;
  /** chance that a press goes to the wrong boot */
  slip: number;
}
// paces of 625 / 500 / 375 ms a press: Hard keeps up with a quick player, Normal with a relaxed one
export const SKILLS: Record<SkillId, Skill> = {
  easy: { pace: 5, react: 5, slip: 0.03 },
  normal: { pace: 4, react: 3, slip: 0.02 },
  hard: { pace: 3, react: 1, slip: 0 },
};

/** how far ahead a bot looks: 40 ticks, 5 s */
const HORIZON = 40;
/** extra ticks a light "costs" when someone else is on it */
const CLAIMED = 40, CLOSER = 16;

interface Node { a: Vec; b: Vec; since: number; parent: Node | null; act: Action; presses: number }
interface Plan { tick0: number; acts: Action[]; states: Node[]; target: number; i: number }

/** a small seeded random generator (mulberry32) */
export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const cheb = (p: Vec, q: Vec) => Math.max(Math.abs(p.x - q.x), Math.abs(p.y - q.y));
const same = (p: Vec, q: Vec) => p.x === q.x && p.y === q.y;

export class Bot {
  /** the light this bot is going for, or -1. Other bots read it to split the work */
  target = -1;
  private plan: Plan | null = null;
  private rand: () => number;

  constructor(readonly me: number, readonly skill: Skill, seed: number) { this.rand = rng(seed); }

  /** this tick's action. `team` is every bot in the room, for their claims */
  act(room: Room, team: readonly (Bot | null)[]): Action {
    const p = room.pairs[this.me];
    if (room.status !== "play" || !p.alive) { this.plan = null; this.target = -1; return 0; }
    if (!this.valid(room)) this.think(room, team);
    const pl = this.plan;
    if (!pl || pl.i >= pl.acts.length) { this.plan = null; return 0; }
    let a = pl.acts[pl.i++];
    if (a && this.rand() < this.skill.slip) { a = a === 1 ? 2 : 1; this.plan = null; }   // a slip: rethink after it
    return a;
  }

  /** is the plan still the one to follow: on schedule, where it expected, the light still there */
  private valid(room: Room): boolean {
    const pl = this.plan, p = room.pairs[this.me];
    if (!pl || pl.i >= pl.acts.length || pl.tick0 + pl.i !== room.tick) return false;
    if (pl.target >= 0 && room.taken[pl.target]) return false;
    const st = pl.states[pl.i];
    return same(st.a, p.boots[0]) && same(st.b, p.boots[1]);
  }

  /** plan a route. `react`: ticks of standing still first, the time it takes to decide */
  private think(room: Room, team: readonly (Bot | null)[], react = this.skill.react): void {
    const lv = room.lv, p = room.pairs[this.me], { pace } = this.skill;
    const T = room.tick;
    const wait = (t: number) => t < react;

    const root: Node = { a: { ...p.boots[0] }, b: { ...p.boots[1] }, since: p.lastMoveTick < 0 ? pace : Math.min(pace, T - p.lastMoveTick), parent: null, act: 0, presses: 0 };
    const first = new Map<number, { node: Node; t: number }>();    // light -> soonest node standing on it
    let layer: Node[] = [root];
    /** the deepest layer anything was still alive in, for when nothing lives to the horizon */
    let lastAlive: Node[] = [root];
    const deadly = (q: Vec, tick: number) => !!lethalAt(lv, q.x, q.y, tick);
    for (let t = 0; t < HORIZON && layer.length; t++) {
      const next = new Map<string, Node>();
      const tick = T + t, beat = beatOf(lv, tick);
      for (const n of layer) {
        // moving is tried before waiting, so of equally quick routes the kept one moves early
        for (const act of [1, 2, 0] as Action[]) {
          if (act && (n.since < pace || wait(t))) continue;
          let a = n.a, b = n.b;
          if (act) {
            const who: Boot = act === 1 ? 0 : 1, to = nextTileOf(lv, [a, b], who);
            if (who === 0) a = { x: to.x, y: to.y }; else b = { x: to.x, y: to.y };
            if (deadly(a, tick) || deadly(b, tick)) continue;
          }
          if (deadly(a, tick + 1) || deadly(b, tick + 1)) continue;
          const node: Node = { a, b, since: act ? 1 : Math.min(pace, n.since + 1), parent: n, act, presses: n.presses + (act ? 1 : 0) };
          for (const q of [a, b]) for (const i of lv.itemsAt.get(q.y * lv.w + q.x) || [])
            if (!room.taken[i] && !first.has(i) && itemLive(lv.items[i], beat)) first.set(i, { node, t });
          const k = `${a.x},${a.y},${b.x},${b.y},${node.since}`;
          const old = next.get(k);
          if (!old || node.presses < old.presses) next.set(k, node);   // same place, fewer presses wins
        }
      }
      layer = [...next.values()];
      if (layer.length) lastAlive = layer;
    }

    // pick a light: soonest, unless another bot has it or a teammate is clearly closer
    let best: { node: Node; score: number; item: number } | null = null;
    for (const [i, { node, t }] of first) {
      const it = lv.items[i];
      let score = t;
      if (team.some(o => o && o !== this && o.target === i)) score += CLAIMED;
      const myD = Math.min(cheb(p.boots[0], it), cheb(p.boots[1], it));
      room.pairs.forEach((o, j) => {
        if (j === this.me || !o.alive || team[j]) return;            // bots are handled by claims
        if (Math.min(cheb(o.boots[0], it), cheb(o.boots[1], it)) < myD) score += CLOSER;
      });
      if (!best || score < best.score) best = { node, score, item: i };
    }
    // nothing in reach: of the routes still alive at the horizon, the one that ends nearest an
    // open light (an unclaimed one if there is any), followed for a few steps
    let end: Node | null = best?.node ?? null;
    if (!end && layer.length) {
      const open = lv.items.map((_, i) => i).filter(i => !room.taken[i] && itemLive(lv.items[i], beatOf(lv, T)));
      const free = open.filter(i => !team.some(o => o && o !== this && o.target === i));
      const goals = (free.length ? free : open).map(i => lv.items[i]);
      const dist = (n: Node) => Math.min(...goals.map(g => Math.min(cheb(n.a, g), cheb(n.b, g))));
      // nothing to collect at all (Survival): the safe route with the fewest presses, so it holds still when it can
      end = goals.length ? layer.reduce((m, n) => (dist(n) < dist(m) ? n : m)) : layer.reduce((m, n) => (n.presses < m.presses ? n : m));
    }
    if (!end) {
      // no way to live through the next few seconds while standing still to decide: decide at once
      if (react) return this.think(room, team, 0);
      // still none: the route that lives longest, and think again on the way
      end = lastAlive.reduce((m, n) => (n.presses < m.presses ? n : m));
      if (end === root) { this.plan = null; this.target = -1; return; }
    }
    const path: Node[] = [];
    for (let c: Node | null = end; c && c.parent; c = c.parent) path.push(c);
    path.reverse();
    const acts = path.map(n => n.act), states = [root, ...path.slice(0, -1)];
    if (!best) acts.length = Math.min(acts.length, pace * 3);
    this.plan = { tick0: T, acts, states, target: best ? best.item : -1, i: 0 };
    this.target = best ? best.item : -1;
  }
}

/** every bot in the room takes its turn for this tick, through the same press a person uses */
export function botsAct(room: Room, bots: readonly (Bot | null)[]): void {
  bots.forEach((b, i) => {
    if (!b) return;
    const a = b.act(room, bots);
    if (a) pressPair(room, i, a === 1 ? 0 : 1);
  });
}
