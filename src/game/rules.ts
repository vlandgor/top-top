import { DIRS, dirBetween, rot } from "../core/dirs";
import type { Boot, Item, Level, Run, Vec } from "../core/types";
import { beatOf, lethalAt } from "./hazards";

// ---------------------------------------------------------------------------
// RULES — the whole game in pure functions. Time moves in ticks; hazards step once per beat
// (lv.beat ticks). The player gets at most one press per tick. The live game (session.ts)
// and the solver (solver.ts) both drive these, so whatever the solver proves, a player can do.
//
// Movement is Chick Mates' (applyJump in chick-mates-sandbox):
//   - two buttons, one per boot. Pressing a boot swings it one place around the other boot,
//     which stays put as the anchor
//   - each boot has its own turn direction: the left boot starts clockwise, the right one
//     counterclockwise, so alternating presses walks the pair
//   - if the next place is blocked (off the board), the boot doesn't move and BOTH boots
//     flip their direction. The press still counts
// ---------------------------------------------------------------------------

export function newRun(lv: Level): Run {
  const r: Run = {
    lv, tick: 0,
    boots: [{ ...lv.start[0] }, { ...lv.start[1] }],
    cw: [true, false],
    taken: lv.items.map(() => false), got: 0, nextOrder: 1,
    status: "play", cause: "", lastMoveTick: -1, moves: 0, last: null,
  };
  resolve(r);
  return r;
}

export function inBounds(lv: Level, p: Vec): boolean { return p.x >= 0 && p.y >= 0 && p.x < lv.w && p.y < lv.h; }

/** where pressing this boot would send it (may be off the board, which means blocked) */
export function nextTile(r: Run, who: Boot): Vec {
  const mv = r.boots[who], an = r.boots[1 - who];
  const d = rot(dirBetween(an, mv), r.cw[who] ? 1 : -1);
  return { x: an.x + DIRS[d].x, y: an.y + DIRS[d].y };
}

export function canPress(r: Run): boolean { return r.status === "play" && r.lastMoveTick !== r.tick; }

/** press a boot's button. false if not allowed this tick */
export function press(r: Run, who: Boot): boolean {
  if (!canPress(r)) return false;
  const t = nextTile(r, who);
  if (inBounds(r.lv, t)) {
    r.boots[who] = t;
    r.last = { boot: who, result: "move" };
  } else {
    r.cw = [!r.cw[0], !r.cw[1]];                // shared turn: both boots turn around
    r.last = { boot: who, result: "blocked" };
  }
  r.lastMoveTick = r.tick; r.moves++;
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
