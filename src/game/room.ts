import type { Boot, Level, Vec } from "../core/types";
import { beatOf, lethalAt } from "./hazards";
import { itemLive, nextTileOf } from "./rules";

// ---------------------------------------------------------------------------
// ROOM — the co-op rules, as pure functions next to rules.ts. Like a Grid room at Activate:
// 2-4 players on one floor, working together. Each player steers their own pair of boots with
// the same movement as solo; pairs never block each other, they just overlap.
//
//   - the lights are shared: whoever touches one picks it up for the team
//   - the team shares a pool of lives: lv.lives is for two players, and it grows in proportion
//     (5 lives: 8 for three players, 10 for four). A pair that
//     dies loses one, waits RESPAWN_TICKS and comes back at its start, once nothing will hit
//     the start for SPAWN_SAFE ticks. When the pool is empty, the run is lost
//   - an optional time limit (lv.limit, in beats): the clock running out loses too
//
// Every player gets at most one press per tick, like solo. Who presses doesn't matter to these
// rules: the match (match.ts) feeds presses from the local player and from bots, and later
// from the network, all through pressPair().
// ---------------------------------------------------------------------------

/** how long a pair is out after dying: 8 ticks, 1 s */
export const RESPAWN_TICKS = 8;
/** a pair only comes back when its start stays safe this long: 12 ticks, 1.5 s to get moving */
export const SPAWN_SAFE = 12;

export interface Pair {
  boots: [Vec, Vec];
  start: [Vec, Vec];
  lastMoveTick: number;
  moves: number;
  last: { boot: Boot; result: "move" | "back" } | null;
  /** false while waiting to respawn */
  alive: boolean;
  /** the tick it comes back on, while dead */
  backAt: number;
  /** where and how it last died, for the death effect */
  diedAt: [Vec, Vec] | null;
  cause: "" | "sentry" | "sweep";
  deaths: number;
  /** lights this pair picked up */
  got: number;
}

export type RoomStatus = "play" | "won" | "lost";

export interface Room {
  lv: Level;
  tick: number;
  pairs: Pair[];
  /** shared by the whole team */
  taken: boolean[];
  got: number;
  nextOrder: number;
  lives: number;
  status: RoomStatus;
  /** why it was lost */
  why: "" | "lives" | "time";
}

export function newRoom(lv: Level, players: number): Room {
  if (players < 1 || players > lv.starts.length) throw new Error(`${lv.def.id}: room has ${lv.starts.length} starts, not ${players}`);
  const pairs: Pair[] = lv.starts.slice(0, players).map(s => ({
    boots: [{ ...s[0] }, { ...s[1] }], start: s,
    lastMoveTick: -1, moves: 0, last: null,
    alive: true, backAt: 0, diedAt: null, cause: "", deaths: 0, got: 0,
  }));
  const room: Room = {
    lv, tick: 0, pairs, taken: lv.items.map(() => false), got: 0, nextOrder: 1,
    lives: teamLives(lv, players), status: "play", why: "",
  };
  resolveRoom(room);
  return room;
}

/** the shared lives for a team of this size */
export function teamLives(lv: Level, players: number): number { return Math.ceil(lv.lives * Math.max(2, players) / 2); }

export function canPressPair(room: Room, i: number): boolean {
  const p = room.pairs[i];
  return room.status === "play" && p.alive && p.lastMoveTick !== room.tick;
}

/** a player presses one of their boots. false if not allowed this tick */
export function pressPair(room: Room, i: number, who: Boot): boolean {
  if (!canPressPair(room, i)) return false;
  const p = room.pairs[i], t = nextTileOf(room.lv, p.boots, who);
  p.boots[who] = { x: t.x, y: t.y };
  p.last = { boot: who, result: t.back ? "back" : "move" };
  p.lastMoveTick = room.tick; p.moves++;
  resolveRoom(room);
  return true;
}

/** one tick of time passes for everyone */
export function advanceRoom(room: Room): void {
  if (room.status !== "play") return;
  room.tick++;
  for (const p of room.pairs) {
    if (p.alive || room.tick < p.backAt) continue;
    // back at the start, unless a hazard is on it or about to be: then wait a tick more
    if (!startSafe(room, p)) { p.backAt = room.tick + 1; continue; }
    p.boots = [{ ...p.start[0] }, { ...p.start[1] }];
    p.alive = true; p.last = null; p.lastMoveTick = -1;
  }
  resolveRoom(room);
}

function startSafe(room: Room, p: Pair): boolean {
  for (let t = room.tick; t <= room.tick + SPAWN_SAFE; t++)
    if (p.start.some(s => lethalAt(room.lv, s.x, s.y, t))) return false;
  return true;
}

/** deaths, pickups and the end of the run, after anything changed */
export function resolveRoom(room: Room): void {
  if (room.status !== "play") return;
  const lv = room.lv, b = beatOf(lv, room.tick);
  for (const p of room.pairs) {
    if (!p.alive) continue;
    for (const boot of p.boots) {
      const why = lethalAt(lv, boot.x, boot.y, room.tick);
      if (!why) continue;
      p.alive = false; p.cause = why; p.deaths++;
      p.diedAt = [{ ...p.boots[0] }, { ...p.boots[1] }];
      p.backAt = room.tick + RESPAWN_TICKS;
      room.lives--;
      break;
    }
  }
  if (room.lives <= 0) { room.status = "lost"; room.why = "lives"; return; }
  for (const p of room.pairs) {
    if (!p.alive) continue;
    for (const boot of p.boots) {
      for (const i of lv.itemsAt.get(boot.y * lv.w + boot.x) || []) {
        if (room.taken[i] || !itemLive(lv.items[i], b)) continue;
        room.taken[i] = true; room.got++; p.got++;
      }
    }
  }
  if (won(room)) { room.status = "won"; return; }
  if (lv.limit && b >= lv.limit) { room.status = "lost"; room.why = "time"; }
}

function won(room: Room): boolean {
  const lv = room.lv;
  switch (lv.def.mode) {
    case "collect": return room.got === lv.items.length;
    // the team survives the clock: any lives left when it runs out is a win
    case "survival": return beatOf(lv, room.tick) >= lv.survive;
    // the other modes get their co-op rules when they get rooms
    default: return false;
  }
}

/** the clock for the HUD, in beats: Survival's goal, or the time limit. null when there is none */
export function beatsLeft(room: Room): number | null {
  const end = room.lv.def.mode === "survival" ? room.lv.survive : room.lv.limit;
  return end ? Math.max(0, end - beatOf(room.lv, room.tick)) : null;
}
