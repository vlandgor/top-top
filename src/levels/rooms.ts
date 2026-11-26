import type { LevelDef } from "../core/types";

// ---------------------------------------------------------------------------
// ROOMS — co-op levels for 2-4 players, kept apart from the solo levels in LEVELS. A room
// lists one start per player ("ax,ay bx,by", left boot first) instead of putting A / B on the
// map; with fewer players the first starts are used. There's no proof: tests/room.test.ts
// proves a room by having bot teams clear it.
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
    starts: ["1,2 2,2", "8,2 9,2", "1,4 2,4", "8,4 9,4"],
    sentries: [
      { path: "1,3 9,3", pingpong: true },
      { path: "5,0 5,6", pingpong: true, phase: 3 },
    ],
  },
];

export function roomById(id: string): LevelDef | undefined { return ROOMS.find(r => r.id === id); }
