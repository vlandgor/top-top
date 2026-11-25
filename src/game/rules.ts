import { DIRS, dirBetween, rot } from "../core/dirs";
import type { Boot, Item, Level, Run, Vec } from "../core/types";
import { beatOf, lethalAt } from "./hazards";

// ---------------------------------------------------------------------------
// RULES — the whole game in pure functions. Time moves in ticks; hazards step once per beat
// (lv.beat ticks). The player gets at most one press per tick. The live game (session.ts)
// and the solver (solver.ts) both drive these, so whatever the solver proves, a player can do.
//
// Movement, based on Chick Mates (applyJump in chick-mates-sandbox):
//   - two buttons, one per boot. Pressing a boot swings it one place around the other boot,
//     which stays put as the anchor
//   - the left boot always turns clockwise, the right one always counterclockwise, so
//     alternating presses walks the pair. Directions never change
//   - if the next place is off the board, the boot steps BACK along its circle instead,
//     as many places as it takes to find a tile. That makes room for the other boot to
//     swing into its old spot
// ---------------------------------------------------------------------------

export function newRun(lv: Level): Run {
  const r: Run = {
    lv, tick: 0,
    boots: [{ ...lv.start[0] }, { ...lv.start[1] }],
    taken: lv.items.map(() => false), got: 0, nextOrder: 1,
    status: "play", cause: "", lastMoveTick: -1, moves: 0, last: null,
  };
  resolve(r);
  return r;
}

export function inBounds(lv: Level, p: Vec): boolean { return p.x >= 0 && p.y >= 0 && p.x < lv.w && p.y < lv.h; }

/** the turn of each boot: left clockwise (+1), right counterclockwise (-1) */
export const TURN = [1, -1] as const;

/**
 * Where pressing this boot sends it, and whether that is a step back off an edge. `ahead` is
 * the next tile on its normal path, even when that is off the board: the boot always faces
 * it, so a step back is a step backwards, not a turn around.
 */
export function nextTile(r: Run, who: Boot): Vec & { back: boolean; ahead: Vec } {
  const mv = r.boots[who], an = r.boots[1 - who];
  const d = dirBetween(an, mv), t = TURN[who];
  const at = (k: number) => ({ x: an.x + DIRS[rot(d, k)].x, y: an.y + DIRS[rot(d, k)].y });
  const ahead = at(t);
  if (inBounds(r.lv, ahead)) return { ...ahead, back: false, ahead };
  // blocked ahead: back around the other boot until there is a tile
  for (let k = 1; k < 8; k++) { const p = at(-t * k); if (inBounds(r.lv, p)) return { ...p, back: true, ahead }; }
  return { ...mv, back: true, ahead };            // unreachable on a 2x2 board or bigger
}

export function canPress(r: Run): boolean { return r.status === "play" && r.lastMoveTick !== r.tick; }

/** press a boot's button. false if not allowed this tick */
export function press(r: Run, who: Boot): boolean {
  if (!canPress(r)) return false;
  const t = nextTile(r, who);
  r.boots[who] = { x: t.x, y: t.y };
  r.last = { boot: who, result: t.back ? "back" : "move" };
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
