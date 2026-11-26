import type { LevelDef } from "../core/types";

// ---------------------------------------------------------------------------
// ROOMS — co-op levels for 2-4 players, kept apart from the solo levels in LEVELS. One room
// per mode for now. A room lists one start per player ("ax,ay bx,by", left boot first)
// instead of putting A / B on the map; with fewer players the first starts are used. `more`
// adds lights for a 3rd and 4th player. There's no proof: tests/room.test.ts proves a room
// by having bot teams clear it at every player count and skill.
// ---------------------------------------------------------------------------

export const ROOMS: LevelDef[] = [
  {
    id: "room-c1",
    name: "Light Hunt",
    mode: "collect",
    beat: 4,
    lives: 5,
    limit: 120,                                  // 60 s at 120 bpm
    hint: "Pick up every light as a team. Any player's pickup counts",
    map: [
      "o....o....o",
      "..o.....o..",
      "...........",
      "o....o....o",
      "...........",
      "..o.....o..",
      "o....o....o",
    ],
    more: ["3,0 7,6 5,2", "7,0 3,6 5,4"],
    starts: ["1,2 2,2", "8,2 9,2", "1,4 2,4", "8,4 9,4"],
    sentries: [
      { path: "1,3 9,3", pingpong: true },
      { path: "5,0 5,6", pingpong: true, phase: 3 },
    ],
  },
  {
    id: "room-r1",
    name: "Hot Floor",
    mode: "survival",
    beat: 4,
    lives: 5,
    survive: 88,                                 // 44 s at 120 bpm: ends just before the next pulse
    hint: "Stay alive together until the clock runs out. Every fall costs a shared life",
    map: [
      "...........",
      "...........",
      "...........",
      "...........",
      "...........",
      "...........",
      "...........",
    ],
    starts: ["1,2 2,2", "8,2 9,2", "1,4 2,4", "8,4 9,4"],
    sentries: [
      { path: "0,3 10,3", pingpong: true },
      { path: "5,0 5,6", pingpong: true, phase: 3 },
    ],
    sweeps: [
      // pulses: the safe columns swap between the sides and the middle
      { dir: "all", start: 10, every: 16, warn: 4, gaps: [[1, 2, 8, 9], [3, 4, 6, 7]] },
      // from halfway, a wave down the board with two safe columns that move each pass
      { dir: "down", start: 46, every: 16, warn: 4, gaps: [2, 8], gapShift: 1 },
    ],
  },
];

export function roomById(id: string): LevelDef | undefined { return ROOMS.find(r => r.id === id); }

/** a room as played by this many players: its `more` lights added to the map */
export function forPlayers(def: LevelDef, players: number): LevelDef {
  const extra = (def.more || []).slice(0, Math.max(0, players - 2)).join(" ").trim();
  if (!extra) return def;
  const map = def.map.map(r => [...r]);
  for (const p of extra.split(/\s+/)) {
    const [x, y] = p.split(",").map(Number);
    if (map[y]?.[x] !== ".") throw new Error(`${def.id}: extra light ${p} isn't on an empty tile`);
    map[y][x] = "o";
  }
  return { ...def, map: map.map(r => r.join("")) };
}
