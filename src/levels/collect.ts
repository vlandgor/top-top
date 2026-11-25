import type { LevelDef } from "../core/types";

// Collect levels, written by tools/gen-levels.ts (npm run gen-levels collect). Names and hints
// can be edited here; to change a layout, change its recipe in the tool and re-run it.
export const COLLECT: LevelDef[] = [
  //  1. difficulty 5: 5 presses, 2 beats
  {
    id: "c1",
    name: "Pick Up",
    mode: "collect",
    beat: 6,
    hint: "Pick up every light. Either boot can grab them",
    map: [
      "o.o...",
      "......",
      ".AB...",
      "......",
    ],
    proof: "L1R1R1R1R",
  },
  //  2. difficulty 7: 7 presses, 2 beats
  {
    id: "c2",
    name: "Pair of Lights",
    mode: "collect",
    beat: 6,
    map: [
      ".o....",
      "...o..",
      "......",
      "..AB..",
    ],
    proof: "L1R1L1R1R1R1R",
  },
  //  3. difficulty 9: 9 presses, 3 beats
  {
    id: "c3",
    name: "Scatter",
    mode: "collect",
    beat: 6,
    map: [
      ".......",
      "AB.o...",
      ".......",
      "...o...",
    ],
    proof: "L1L1L1L1R1R1L1L1L",
  },
  //  4. difficulty 11: 7 presses, 4 beats
  {
    id: "c4",
    name: "Watchman",
    mode: "collect",
    beat: 6,
    hint: "Sentries step on the beat. The faint tile is where they go next",
    map: [
      ".......",
      "..o....",
      ".....o.",
      "..AB...",
    ],
    sentries: [{ path: "0,2 6,2", phase: 14 }],
    proof: "12L1R1L1L1L1R1R",
  },
  //  5. difficulty 13: 11 presses, 4 beats
  {
    id: "c5",
    name: "Lantern Walk",
    mode: "collect",
    beat: 6,
    map: [
      ".......",
      ".......",
      ".o..o.o",
      ".......",
      ".AB....",
    ],
    sentries: [{ path: "4,0 4,4", phase: 10 }],
    proof: "L1R1L1L1L1R1L1R1R1L1L",
  },
  //  6. difficulty 15: 13 presses, 4 beats
  {
    id: "c6",
    name: "Fireflies",
    mode: "collect",
    beat: 6,
    map: [
      "..o..o.",
      ".......",
      "AB..o..",
      ".......",
    ],
    sentries: [{ path: "3,0 3,3", phase: 8 }],
    proof: "L1L1L1R1R1R1L1L1R1L1L1L1R",
  },
  //  7. difficulty 17: 15 presses, 5 beats
  {
    id: "c7",
    name: "Spotlights",
    mode: "collect",
    beat: 6,
    map: [
      ".......",
      "..o.o..",
      ".......",
      ".o...AB",
      ".......",
    ],
    sentries: [{ path: "2,0 2,4", phase: 2 }],
    proof: "L1R1R1R1L1R1L1R1L1R1L1R1R1R1L",
  },
  //  8. difficulty 19: 13 presses, 5 beats
  {
    id: "c8",
    name: "Night Market",
    mode: "collect",
    beat: 5,
    map: [
      "...o....",
      "......AB",
      "..o.....",
      "....o...",
      "........",
    ],
    sentries: [{ path: "0,2 7,2", phase: 15 }, { path: "0,4 7,4", phase: 3 }],
    proof: "2R1R1L1R1L1R1R1R1R1L1L1L1R",
  },
  //  9. difficulty 22: 16 presses, 7 beats
  {
    id: "c9",
    name: "Glow Sticks",
    mode: "collect",
    beat: 5,
    map: [
      ".o...AB.",
      "...o....",
      "o....o..",
      "........",
    ],
    sentries: [{ path: "0,3 7,3", phase: 2 }, { path: "6,0 6,3", phase: 1 }],
    proof: "3L1R1R1L1L1R1R1L1R1L1R1L1R1R1R1L",
  },
  // 10. difficulty 25: 21 presses, 8 beats
  {
    id: "c10",
    name: "Two Patrols",
    mode: "collect",
    beat: 5,
    map: [
      "....o.o",
      ".AB....",
      "......o",
      "...o...",
    ],
    sentries: [{ path: "2,3 4,3 4,1 2,1", phase: 7 }, { path: "0,1 6,1", phase: 5 }],
    proof: "L1L1L1R1L1L1L1L1R1R1R1R1R1L1L1R1R1R1L1R1R",
  },
  // 11. difficulty 27: 23 presses, 9 beats
  {
    id: "c11",
    name: "Neon Garden",
    mode: "collect",
    beat: 5,
    map: [
      "...o..o..",
      "........o",
      ".........",
      ".........",
      "..o..AB..",
    ],
    sentries: [{ path: "0,2 8,2", phase: 4 }, { path: "1,0 4,0 4,4 1,4", phase: 4 }],
    proof: "R1R1L1R1R1L1L1L1L1L1R1R1L1R1L1L1L1R1L1R1L1R1R",
  },
  // 12. difficulty 31: 21 presses, 13 beats
  {
    id: "c12",
    name: "Light Show",
    mode: "collect",
    beat: 5,
    map: [
      "........",
      "........",
      "...o..o.",
      "AB......",
      "...o..o.",
    ],
    sentries: [{ path: "0,4 7,4", phase: 13 }, { path: "0,0 3,0 3,3 0,3", phase: 1 }, { path: "0,2 7,2", phase: 14 }],
    proof: "19L1L1R1R1L1L1L1L1L1R1R1R1L1R1R1R5L1L1L1L1L",
  },
  // 13. difficulty 34: 28 presses, 14 beats
  {
    id: "c13",
    name: "Laser Grid",
    mode: "collect",
    map: [
      "....AB.o.",
      "o........",
      "....o..o.",
      ".........",
      ".....o...",
    ],
    sentries: [{ path: "4,4 7,4 7,2 4,2", phase: 0 }, { path: "4,4 7,4 7,2 4,2", phase: 0 }, { path: "7,0 7,4", phase: 9 }],
    proof: "L1L1L1L1R1R1R1R1R1L1L1R1R1L1L1R1R1L1R1L1R1L1R1R1R1L1R1R",
  },
  // 14. difficulty 37: 29 presses, 15 beats
  {
    id: "c14",
    name: "Strobe",
    mode: "collect",
    map: [
      "........",
      "AB.o..o.",
      "........",
      "..o.....",
      "........",
      ".o....o.",
    ],
    sentries: [{ path: "4,0 7,0 7,2 4,2", phase: 6 }, { path: "5,0 7,0 7,4 5,4", phase: 7 }, { path: "0,4 5,4 5,1 0,1", phase: 4 }],
    proof: "2L1L1L1L1L1R1L1R1L1R1R1R1L1R1L1R1L1R1R1R1L1R1R1L1R1R1L1R1R",
  },
  // 15. difficulty 41: 37 presses, 18 beats
  {
    id: "c15",
    name: "Rain Lights",
    mode: "collect",
    hint: "Glowing tiles warn you. They only kill when they flash solid",
    map: [
      "o....o...",
      ".........",
      "..o......",
      ".........",
      "o.....o..",
      "..AB.....",
    ],
    sweeps: [{ dir: "diag", start: 5, every: 12, warn: 4, speed: 1, gaps: [[0, 1, 2, 3], [3, 4, 5, 6], [1, 2, 3, 4], [0, 1, 2, 3]] }],
    proof: "L1L1L1R1L1R1R1R1R1R1L1R1L1R1L1R1L1R1L1L1L1L1R1R1R1R1L1L1L1L1L1R1L1R1L1R1L",
  },
  // 16. difficulty 45: 33 presses, 18 beats
  {
    id: "c16",
    name: "Sweep Up",
    mode: "collect",
    map: [
      ".....o...",
      ".......o.",
      "..o......",
      ".........",
      "o...AB...",
      ".......o.",
    ],
    sweeps: [{ dir: "diag", start: 5, every: 12, warn: 4, speed: 1, gaps: [[9, 10, 11, 12], [10, 11, 12, 13], [10, 11, 12, 13], [8, 9, 10, 11]] }],
    proof: "6L1L1L1L1R1R1R1R1L1R1L1R1L1R1R1R1L1R1R1L1L1R1L1R1R1R1L1L1R1R1L1R1R",
  },
  // 17. difficulty 48: 38 presses, 19 beats
  {
    id: "c17",
    name: "Afterglow",
    mode: "collect",
    map: [
      "AB.o....o.",
      "..........",
      ".........o",
      "....o.....",
      "......o...",
      ".........o",
    ],
    sentries: [{ path: "3,0 3,5", phase: 10 }, { path: "2,0 2,5", phase: 1 }],
    sweeps: [{ dir: "right", start: 5, every: 10, warn: 3, speed: 1, gaps: [[1, 2, 3], [3, 4, 5], [0, 1, 2], [1, 2, 3]] }],
    proof: "2L1L1L1L1R1L1R1L1R1R1R1L1R1L1L1L1R1R1R1L1L1L1L1L1R1L1R1R1R1R1R1L1R1L1R1L1R1R",
  },
  // 18. difficulty 50: 40 presses, 22 beats
  {
    id: "c18",
    name: "Full House",
    mode: "collect",
    map: [
      "o......AB",
      "...o.o...",
      ".........",
      ".........",
      "........o",
      "o...o....",
      ".........",
    ],
    sentries: [{ path: "0,0 8,0", phase: 3 }, { path: "0,3 8,3", phase: 14 }],
    sweeps: [{ dir: "down", start: 5, every: 10, warn: 3, speed: 1, gaps: [[4, 5, 6], [1, 2, 3], [1, 2, 3], [0, 1, 2]] }],
    proof: "8L1L1R1L1R1L1R1L1R1R1R1L1R1L1R1R1R1L1R1L1R1L1L1L1R1L1R1R1R1L1L1L1L1L1R1L1R1L1R1L",
  },
  // 19. difficulty 55: 45 presses, 24 beats
  {
    id: "c19",
    name: "Blackout",
    mode: "collect",
    map: [
      "...........",
      ".....o...o.",
      "...........",
      "...AB.....o",
      "...........",
      ".o.......o.",
      "...o.......",
    ],
    sentries: [{ path: "4,4 8,4 8,6 4,6", phase: 4 }, { path: "0,5 3,5 3,3 0,3", phase: 7 }],
    sweeps: [{ dir: "diag", start: 5, every: 10, warn: 3, speed: 1, gaps: [[9, 10, 11], [8, 9, 10], [7, 8, 9], [6, 7, 8]] }],
    proof: "6R1R1L1R1R1R1L1R1R1L1R1R1L1R1L1R1L1R1L1R1R1R1L1R1L1R1R1R1L1L1L1L1L1R1L1R1L1L1L1R1R1R1L1L1R",
  },
  // 20. difficulty 59: 43 presses, 25 beats
  {
    id: "c20",
    name: "Grand Finale",
    mode: "collect",
    map: [
      "...........",
      "o.......o.o",
      "......o....",
      "...........",
      "........o..",
      ".....o.....",
      ".........AB",
    ],
    sentries: [{ path: "0,5 10,5", phase: 9 }, { path: "0,6 10,6", phase: 2 }],
    sweeps: [{ dir: "antidiag", start: 5, every: 10, warn: 3, speed: 1, gaps: [[7, 8, 9], [10, 11, 12], [11, 12, 13], [10, 11, 12]] }],
    proof: "14L1R1R1R1L1R1L1R1L1R1L1L1L1R1L1L1L1R1L1R1L1R1R1R1R1R1L1R1R1L1R1L1R1L1R1L1R1L1R1L1R1L1R",
  },
];
