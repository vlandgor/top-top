import { DIRS, dirBetween, rot } from "../core/dirs";
import type { Item, Level, Run, Turn, Vec } from "../core/types";
import { beatOf, lethalAt } from "./hazards";

// ---------------------------------------------------------------------------
// RULES — the whole game in pure functions. Time moves in ticks; hazards step once per beat
// (lv.beat ticks). The player gets at most one swing per tick. The live game (session.ts)
// and the solver (solver.ts) both drive these, so whatever the solver proves, a player can do.
// ---------------------------------------------------------------------------

export function newRun(lv: Level): Run {
  const r: Run = {
    lv, tick: 0,
    boots: [{ ...lv.start[0] }, { ...lv.start[1] }], anchor: 0,
    taken: lv.items.map(() => false), got: 0, nextOrder: 1,
    status: "play", cause: "", lastTurn: -1, lastMoveTick: -1, moves: 0, shuffled: false,
  };
  // the boots face (and the stronger ghost points) where an alternating tap goes; start with
  // that pointing into the board rather than at an edge
  if (swingTarget(lv, r.boots[0], r.boots[1], 1).shuffled && !swingTarget(lv, r.boots[0], r.boots[1], -1).shuffled) r.lastTurn = 1;
  resolve(r);
  return r;
}

export function mover(r: Run): Vec { return r.boots[1 - r.anchor]; }
export function planted(r: Run): Vec { return r.boots[r.anchor]; }

/**
 * Where a swing would land, without doing it: the mover steps one place around the anchor.
 * If that is off the board, the planted boot shuffles one step inward so the pair stays legal.
 */
export function swingTarget(lv: Level, anchor: Vec, mov: Vec, turn: Turn): { anchor: Vec; mover: Vec; shuffled: boolean } {
  const d = rot(dirBetween(anchor, mov), turn);
  const t = { x: anchor.x + DIRS[d].x, y: anchor.y + DIRS[d].y };
  const sx = t.x < 0 ? 1 : t.x >= lv.w ? -1 : 0;
  const sy = t.y < 0 ? 1 : t.y >= lv.h ? -1 : 0;
  return {
    anchor: { x: anchor.x + sx, y: anchor.y + sy },
    mover: { x: t.x + sx, y: t.y + sy },
    shuffled: !!(sx || sy),
  };
}

export function canSwing(r: Run): boolean { return r.status === "play" && r.lastMoveTick !== r.tick; }

/** swing the mover; it lands and becomes the planted boot. false if not allowed this tick */
export function swing(r: Run, turn: Turn): boolean {
  if (!canSwing(r)) return false;
  const m = 1 - r.anchor as 0 | 1;
  const t = swingTarget(r.lv, r.boots[r.anchor], r.boots[m], turn);
  r.boots[r.anchor] = t.anchor;
  r.boots[m] = t.mover;
  r.anchor = m;                               // the boot that just landed is planted now
  r.shuffled = t.shuffled;
  r.lastTurn = turn; r.lastMoveTick = r.tick; r.moves++;
  resolve(r);
  return true;
}

/** one tick of time passes */
export function advance(r: Run): void {
  if (r.status !== "play") return;
  r.tick++;
  resolve(r);
}

export function itemLive(it: Item, beat: number): boolean { return beat >= it.from && beat < it.until; }

/** deaths, pickups and the win check, after anything changed */
export function resolve(r: Run): void {
  if (r.status !== "play") return;
  const lv = r.lv, b = beatOf(lv, r.tick);
  for (const boot of r.boots) {
    const why = lethalAt(lv, boot.x, boot.y, r.tick);
    if (why) { r.status = "dead"; r.cause = why; return; }
  }
  for (const boot of r.boots) {
    for (const i of lv.itemsAt.get(boot.y * lv.w + boot.x) || []) {
      const it = lv.items[i];
      if (r.taken[i] || !itemLive(it, b)) continue;
      if (it.order && it.order !== r.nextOrder) { r.status = "dead"; r.cause = "order"; return; }
      r.taken[i] = true; r.got++;
      if (it.order) r.nextOrder++;
    }
  }
  if (r.status !== "play") return;
  if (won(r)) r.status = "won";
}

function won(r: Run): boolean {
  const lv = r.lv;
  switch (lv.def.mode) {
    case "destination": return !!lv.goal && r.boots.some(p => p.x === lv.goal!.x && p.y === lv.goal!.y);
    case "collect": case "sequence": return r.got === lv.items.length;
    case "survival": return beatOf(lv, r.tick) >= lv.survive;
    case "waves": return r.got >= lv.need;
  }
}

/** objective progress for the HUD: [done, total] */
export function progress(r: Run): [number, number] {
  const lv = r.lv;
  switch (lv.def.mode) {
    case "destination": return [r.status === "won" ? 1 : 0, 1];
    case "collect": case "sequence": return [r.got, lv.items.length];
    case "survival": return [Math.min(lv.survive, beatOf(lv, r.tick)), lv.survive];
    case "waves": return [Math.min(r.got, lv.need), lv.need];
  }
}
