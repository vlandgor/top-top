import type { LevelDef, Mode } from "../core/types";

// ---------------------------------------------------------------------------
// LEVELS — authored by hand. Map legend is in core/types.ts (LevelDef.map).
// Coordinates in sentry paths and drops are "x,y" from the top-left, starting at 0.
// tests/levels.test.ts runs the solver on every level: an impossible level fails the build.
// ---------------------------------------------------------------------------

export interface ModeInfo {
  id: Mode;
  name: string;
  /** one line, for lists */
  blurb: string;
  /** a few sentences for the mode screen */
  about: string;
  /** the level shown, hazards running, as the mode's preview */
  preview: string;
  /** still being designed */
  wip?: boolean;
}

export const MODES: ModeInfo[] = [
  {
    id: "destination", name: "Destination", preview: "d3",
    blurb: "Walk the boots to the goal",
    about: "Get either boot onto the glowing goal. Read the sentries, time your presses and find the way through.",
  },
  {
    id: "collect", name: "Collect All", preview: "c2",
    blurb: "Pick up every light",
    about: "Every light on the board has to be picked up, in any order, by either boot. Plan a route that touches them all.",
  },
  {
    id: "sequence", name: "Sequence", preview: "s2",
    blurb: "Collect in order",
    about: "The lights are numbered. Pick them up in order: touch the wrong one and the level restarts.",
  },
  {
    id: "survival", name: "Survival", preview: "r2",
    blurb: "Stay alive until the clock runs out",
    about: "No goal, just a clock. The floor keeps lighting up red; stay on the safe tiles until time runs out.",
  },
  {
    id: "waves", name: "Waves", preview: "w1", wip: true,
    blurb: "Grab what each wave leaves, then get clear",
    about: "A wave sweeps down the board again and again. Each one leaves lights behind it; grab them before the next wave washes them away.",
  },
];

export const LEVELS: LevelDef[] = [
  // ---- Destination --------------------------------------------------------------------------
  {
    id: "d1", name: "First Steps", mode: "destination",
    hint: "Left button swings the left boot, right button the right one. Alternate them to walk",
    map: [
      ".......",
      ".......",
      ".AB...G",
      ".......",
      ".......",
    ],
  },
  {
    id: "d2", name: "Into the Corner", mode: "destination",
    hint: "When the edge is in the way, the boot stays put and both boots turn around",
    map: [
      "........G",
      ".........",
      ".........",
      ".........",
      ".........",
      "AB.......",
    ],
  },
  {
    id: "d3", name: "Patrol", mode: "destination",
    hint: "Sentries step on the beat. The faint tile is where they go next",
    map: [
      ".........",
      ".........",
      ".......AB",
      "G........",
      ".........",
      ".........",
      ".........",
    ],
    sentries: [{ path: "4,0 4,6" }],
  },
  {
    id: "d4", name: "Two Guards", mode: "destination",
    map: [
      "G........",
      ".........",
      ".........",
      ".........",
      ".......AB",
      ".........",
      ".........",
    ],
    sentries: [{ path: "3,0 3,6" }, { path: "5,6 5,0" }, { path: "1,3 7,3", phase: 2 }],
  },
  {
    id: "d5", name: "Ring", mode: "destination",
    map: [
      ".........",
      ".........",
      ".........",
      "...G...AB",
      ".........",
      ".........",
      ".........",
    ],
    sentries: [{ path: "1,1 1,5 5,5 5,1" }, { path: "5,5 5,1 1,1 1,5" }],
  },
  {
    id: "d6", name: "Waterfall", mode: "destination",
    hint: "Glowing tiles warn you. They only kill when they flash solid",
    map: [
      ".......AB",
      ".........",
      ".........",
      ".........",
      ".........",
      ".........",
      "G........",
    ],
    sweeps: [{ dir: "diag", start: 4, every: 8, warn: 3, gaps: [6, 7] }],
  },

  // ---- Collect All --------------------------------------------------------------------------
  {
    id: "c1", name: "Pick Up", mode: "collect",
    map: [
      "o......",
      ".......",
      "...o.AB",
      ".......",
      ".......",
      "o.....o",
    ],
  },
  {
    id: "c2", name: "Orbit", mode: "collect",
    map: [
      ".........",
      ".o...o...",
      ".........",
      "...o...AB",
      ".........",
      ".o...o...",
      ".........",
    ],
    sentries: [{ path: "2,2 2,4 4,4 4,2" }, { path: "0,0 0,6 6,6 6,0", phase: 5 }],
  },
  {
    id: "c3", name: "Rain", mode: "collect",
    map: [
      "o.....o..",
      ".........",
      ".......AB",
      "...o.....",
      ".........",
      ".........",
      "o.....o..",
    ],
    sweeps: [{ dir: "right", start: 3, every: 6, speed: 0.5, warn: 2, gaps: [3], gapShift: 2 }],
  },

  // ---- Sequence -----------------------------------------------------------------------------
  {
    id: "s1", name: "One Two Three", mode: "sequence",
    hint: "Lights are collected in order. Touch the wrong one and you restart",
    map: [
      ".......",
      ".3..1..",
      ".....AB",
      ".......",
      ".2..4..",
      ".......",
    ],
  },
  {
    id: "s2", name: "Crossing", mode: "sequence",
    map: [
      "4.......1",
      ".........",
      ".........",
      ".......AB",
      ".........",
      ".........",
      "3.......2",
    ],
    sentries: [{ path: "4,0 4,6" }, { path: "1,3 7,3" }],
  },
  {
    id: "s3", name: "Countdown", mode: "sequence",
    map: [
      ".........",
      ".2.....4.",
      ".........",
      "....3..AB",
      ".........",
      ".1.....5.",
      ".........",
    ],
    sweeps: [{ dir: "all", start: 6, every: 7, speed: 0, warn: 3, gaps: [[5, 6, 7, 8], [2, 3, 4, 5], [0, 1, 2, 3], [3, 4, 5, 6]] }],
  },

  // ---- Survival -----------------------------------------------------------------------------
  {
    id: "r1", name: "Hold On", mode: "survival", survive: 24,
    hint: "Keep moving. When the clock hits zero, you win",
    map: [
      ".........",
      ".........",
      ".........",
      "....AB...",
      ".........",
      ".........",
      ".........",
    ],
    sentries: [{ path: "1,1 1,5 7,5 7,1" }],
    sweeps: [{ dir: "all", start: 5, every: 8, speed: 0, warn: 4, gaps: [3, 4, 5], gapShift: 3 }],
  },
  {
    id: "r2", name: "Pulse", mode: "survival", survive: 32,
    map: [
      ".........",
      ".........",
      ".........",
      "....AB...",
      ".........",
      ".........",
      ".........",
    ],
    sweeps: [{ dir: "all", start: 4, every: 6, speed: 0, warn: 3, gaps: [3, 4], gapShift: 3 }],
  },
  {
    id: "r3", name: "Storm", mode: "survival", survive: 40,
    map: [
      ".........",
      ".........",
      ".........",
      "....AB...",
      ".........",
      ".........",
      ".........",
    ],
    sentries: [{ path: "0,0 0,6" }, { path: "8,6 8,0" }, { path: "2,0 2,6" }],
    sweeps: [
      { dir: "diag", start: 3, every: 8, warn: 3, gaps: [[6, 7], [8, 9], [5, 6]] },
      { dir: "antidiag", start: 7, every: 8, warn: 3, gaps: [[6, 7], [8, 9], [5, 6]] },
    ],
  },

  // ---- Waves (in progress) ------------------------------------------------------------------
  {
    id: "w1", name: "First Wave", mode: "waves", need: 6,
    hint: "Each wave leaves lights behind it. Grab them, then find the gap in the next",
    map: [
      "...........",
      "...........",
      "...........",
      "...........",
      "....AB.....",
      "...........",
    ],
    sweeps: [{ dir: "down", start: 3, every: 12, warn: 3, gaps: [[4, 5], [7, 8], [2, 3]] }],
    drops: ["2,1 8,4", "9,1 3,4", "5,2 1,3"],
  },
  {
    id: "w2", name: "Undertow", mode: "waves", need: 8,
    map: [
      "...........",
      "...........",
      "...........",
      "...........",
      "....AB.....",
      "...........",
    ],
    sweeps: [{ dir: "down", start: 3, every: 9, speed: 0.5, warn: 2, gaps: [[4, 5], [8, 9], [1, 2], [6, 7]] }],
    drops: ["1,0 7,3 4,5", "9,1 2,4", "6,0 0,5 10,2", "3,2 8,5"],
  },
];

export function levelsOf(mode: Mode): LevelDef[] { return LEVELS.filter(l => l.mode === mode); }
export function levelById(id: string): LevelDef | undefined { return LEVELS.find(l => l.id === id); }
