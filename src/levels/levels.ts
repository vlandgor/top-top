import type { LevelDef, Mode } from "../core/types";

// ---------------------------------------------------------------------------
// LEVELS — authored by hand. Map legend is in core/types.ts (LevelDef.map).
// Coordinates in sentry paths and drops are "x,y" from the top-left, starting at 0.
// tests/levels.test.ts runs the solver on every level: an impossible level fails the build.
// ---------------------------------------------------------------------------

export const MODES: { id: Mode; name: string; blurb: string }[] = [
  { id: "destination", name: "Destination", blurb: "Walk the boots to the goal" },
  { id: "collect", name: "Collect All", blurb: "Pick up every light" },
  { id: "sequence", name: "Sequence", blurb: "Collect in order. One wrong step and you restart" },
  { id: "survival", name: "Survival", blurb: "Stay alive until the clock runs out" },
  { id: "waves", name: "Waves", blurb: "Grab what each wave leaves, then get clear of the next" },
];

export const LEVELS: LevelDef[] = [
  // ---- Destination ------------------------------------------------------------------------
  {
    id: "d1", name: "First Steps", mode: "destination",
    hint: "Tap left or right to swing the lit boot around the planted one",
    map: [
      "..G..",
      ".....",
      ".....",
      ".....",
      ".AB..",
      ".....",
    ],
  },
  {
    id: "d2", name: "Into the Corner", mode: "destination",
    hint: "At the edge, the planted boot shuffles in to make room",
    map: [
      "G.....",
      "......",
      "......",
      "......",
      "......",
      "......",
      "....AB",
    ],
  },
  {
    id: "d3", name: "Patrol", mode: "destination",
    hint: "Sentries step on the beat. The faint tile is where they go next",
    map: [
      "...G...",
      ".......",
      ".......",
      ".......",
      ".......",
      ".......",
      ".......",
      ".......",
      "..AB...",
    ],
    sentries: [{ path: "0,4 6,4" }],
  },
  {
    id: "d4", name: "Two Guards", mode: "destination",
    map: [
      "G......",
      ".......",
      ".......",
      ".......",
      ".......",
      ".......",
      ".......",
      ".......",
      "....AB.",
    ],
    sentries: [{ path: "0,3 6,3" }, { path: "6,5 0,5" }, { path: "3,1 3,7", phase: 2 }],
  },
  {
    id: "d5", name: "Ring", mode: "destination",
    map: [
      ".......",
      ".......",
      ".......",
      "...G...",
      ".......",
      ".......",
      ".......",
      ".......",
      "...AB..",
    ],
    sentries: [{ path: "1,1 5,1 5,5 1,5" }, { path: "5,5 1,5 1,1 5,1" }],
  },
  {
    id: "d6", name: "Waterfall", mode: "destination",
    hint: "Glowing tiles warn you. They only kill when they flash solid",
    map: [
      "......G",
      ".......",
      ".......",
      ".......",
      ".......",
      ".......",
      ".......",
      ".......",
      "AB.....",
    ],
    sweeps: [{ dir: "diag", start: 4, every: 8, warn: 3, gaps: [6, 7] }],
  },

  // ---- Collect All ------------------------------------------------------------------------
  {
    id: "c1", name: "Pick Up", mode: "collect",
    map: [
      "o....o",
      "......",
      "......",
      "..o...",
      "......",
      "......",
      "..AB.o",
    ],
  },
  {
    id: "c2", name: "Orbit", mode: "collect",
    map: [
      ".......",
      ".o...o.",
      ".......",
      "...o...",
      ".......",
      ".o...o.",
      ".......",
      ".......",
      "...AB..",
    ],
    sentries: [{ path: "2,2 4,2 4,4 2,4" }, { path: "0,0 6,0 6,6 0,6", phase: 5 }],
  },
  {
    id: "c3", name: "Rain", mode: "collect",
    map: [
      "o.....o",
      ".......",
      ".......",
      "...o...",
      ".......",
      ".......",
      "o.....o",
      ".......",
      "..AB...",
    ],
    sweeps: [{ dir: "down", start: 3, every: 6, speed: 0.5, warn: 2, gaps: [3], gapShift: 2 }],
  },

  // ---- Sequence ---------------------------------------------------------------------------
  {
    id: "s1", name: "One Two Three", mode: "sequence",
    hint: "Lights are collected in order. Touch the wrong one and you restart",
    map: [
      "......",
      ".3..2.",
      "......",
      "......",
      ".1..4.",
      "......",
      "..AB..",
    ],
  },
  {
    id: "s2", name: "Crossing", mode: "sequence",
    map: [
      "4.....3",
      ".......",
      ".......",
      ".......",
      ".......",
      ".......",
      ".......",
      ".......",
      "1..AB.2",
    ],
    sentries: [{ path: "0,4 6,4" }, { path: "3,1 3,7" }],
  },
  {
    id: "s3", name: "Countdown", mode: "sequence",
    map: [
      ".......",
      ".5...1.",
      ".......",
      "...3...",
      ".......",
      ".2...4.",
      ".......",
      ".......",
      "...AB..",
    ],
    sweeps: [{ dir: "all", start: 6, every: 6, speed: 0, warn: 3, gaps: [0, 3, 6] }],
  },

  // ---- Survival ---------------------------------------------------------------------------
  {
    id: "r1", name: "Hold On", mode: "survival", survive: 24,
    hint: "Keep moving. When the clock hits zero, you win",
    map: [
      ".......",
      ".......",
      ".......",
      ".......",
      "...AB..",
      ".......",
      ".......",
      ".......",
      ".......",
    ],
    sweeps: [{ dir: "all", start: 5, every: 8, speed: 0, warn: 4, gaps: [3, 4, 5], gapShift: 3 }],
    sentries: [{ path: "1,1 5,1 5,7 1,7" }],
  },
  {
    id: "r2", name: "Pulse", mode: "survival", survive: 32,
    map: [
      ".......",
      ".......",
      ".......",
      ".......",
      "...AB..",
      ".......",
      ".......",
      ".......",
      ".......",
    ],
    sweeps: [{ dir: "all", start: 4, every: 6, speed: 0, warn: 3, gaps: [2, 3], gapShift: 2 }],
  },
  {
    id: "r3", name: "Storm", mode: "survival", survive: 40,
    map: [
      ".......",
      ".......",
      ".......",
      ".......",
      "...AB..",
      ".......",
      ".......",
      ".......",
      ".......",
    ],
    sweeps: [
      { dir: "diag", start: 3, every: 8, warn: 3, gaps: [[7, 8], [5, 6], [9, 10]] },
      { dir: "antidiag", start: 7, every: 8, warn: 3, gaps: [[7, 8], [9, 10], [6, 7]] },
    ],
    sentries: [{ path: "0,0 6,0" }, { path: "6,8 0,8" }, { path: "0,2 6,2" }],
  },

  // ---- Waves (in progress) ----------------------------------------------------------------
  {
    id: "w1", name: "First Wave", mode: "waves", need: 6,
    hint: "Each wave leaves lights behind it. Grab them, then find the gap in the next",
    map: [
      ".......",
      ".......",
      ".......",
      ".......",
      ".......",
      ".......",
      ".......",
      "...AB..",
      ".......",
    ],
    sweeps: [{ dir: "down", start: 2, every: 14, warn: 3, gaps: [3, 4], gapShift: 2 }],
    drops: ["1,2 5,6", "5,1 1,5", "3,3 6,7"],
  },
  {
    id: "w2", name: "Undertow", mode: "waves", need: 8,
    map: [
      ".......",
      ".......",
      ".......",
      ".......",
      ".......",
      ".......",
      ".......",
      "...AB..",
      ".......",
    ],
    sweeps: [{ dir: "down", start: 2, every: 11, speed: 0.5, warn: 2, gaps: [2], gapShift: 3 }],
    drops: ["0,1 6,4 3,7", "6,2 0,6", "2,0 5,5 1,7"],
  },
];

export function levelsOf(mode: Mode): LevelDef[] { return LEVELS.filter(l => l.mode === mode); }
export function levelById(id: string): LevelDef | undefined { return LEVELS.find(l => l.id === id); }
