import type { LevelDef } from "../core/types";

// Sequence levels, written by tools/gen-levels.ts (npm run gen-levels sequence). Names and hints
// can be edited here; to change a layout, change its recipe in the tool and re-run it.
export const SEQUENCE: LevelDef[] = [
  //  1. difficulty 5: 5 presses, 2 beats
  {
    id: "s1",
    name: "One Two",
    mode: "sequence",
    beat: 6,
    hint: "Pick up the lights in order. Touch the wrong one and you restart",
    map: [
      "......",
      ".2.1..",
      "......",
      "..AB..",
    ],
    proof: "L1R1R1R1R",
  },
  //  2. difficulty 7: 7 presses, 2 beats
  {
    id: "s2",
    name: "Count Up",
    mode: "sequence",
    beat: 6,
    map: [
      "......",
      ".1....",
      "...AB.",
      ".2....",
    ],
    proof: "R1R1L1R1R1R1R",
  },
  //  3. difficulty 10: 9 presses, 3 beats
  {
    id: "s3",
    name: "Zig Zag",
    mode: "sequence",
    beat: 6,
    map: [
      ".AB....",
      ".......",
      "..2.1..",
      ".......",
    ],
    proof: "R1L1L1R1L1L1L1L1L",
  },
  //  4. difficulty 13: 11 presses, 4 beats
  {
    id: "s4",
    name: "Watch the Order",
    mode: "sequence",
    beat: 6,
    hint: "Sentries step on the beat. The faint tile is where they go next",
    map: [
      ".......",
      ".......",
      "2...AB.",
      "..1....",
    ],
    sentries: [{ path: "0,1 6,1", phase: 12 }],
    proof: "R1R1L1R1R1R1L1L1L1R1R",
  },
  //  5. difficulty 19: 17 presses, 6 beats
  {
    id: "s5",
    name: "Steady Count",
    mode: "sequence",
    beat: 6,
    map: [
      ".3.1..",
      "......",
      "....AB",
      "..2...",
      "......",
    ],
    sentries: [{ path: "0,3 5,3", phase: 8 }],
    proof: "L1R1R1R1R1R1L1R1L1L1L1L1L1R1R1R1R",
  },
  //  6. difficulty 21: 17 presses, 8 beats
  {
    id: "s6",
    name: "Choreography",
    mode: "sequence",
    beat: 6,
    map: [
      "......",
      ".3.AB.",
      "......",
      "......",
      "2.1...",
    ],
    sentries: [{ path: "0,0 5,0", phase: 3 }],
    proof: "12R1R1R1R1L1R1L1L1R1R1L1L1L1L1L1R1R",
  },
  //  7. difficulty 26: 19 presses, 8 beats
  {
    id: "s7",
    name: "Step Pattern",
    mode: "sequence",
    beat: 6,
    map: [
      "....AB..",
      "........",
      "..2.....",
      "3....1..",
    ],
    sentries: [{ path: "5,0 5,3", phase: 7 }],
    proof: "8L1R1R1R1L1R1R1R1L1L1R1L1L1R1L1R1L1R1L",
  },
  //  8. difficulty 31: 19 presses, 11 beats
  {
    id: "s8",
    name: "Routine",
    mode: "sequence",
    beat: 5,
    map: [
      ".....2.",
      ".AB....",
      "....1..",
      ".......",
      "...3...",
    ],
    sentries: [{ path: "0,3 6,3", phase: 7 }, { path: "0,0 6,0", phase: 11 }],
    proof: "7L1L4L4L4R1R1L1R1R1R1R1R1R1R1L1R1R1L1R",
  },
  //  9. difficulty 36: 31 presses, 13 beats
  {
    id: "s9",
    name: "Counterpoint",
    mode: "sequence",
    beat: 5,
    map: [
      "AB.....",
      "...2...",
      ".....4.",
      "3......",
      "..1....",
    ],
    sentries: [{ path: "0,3 6,3", phase: 12 }, { path: "0,1 6,1", phase: 2 }],
    proof: "2R1L1L1L1L1R1R1L1R1R1R1R1L1R1R1R1L1R1R1R1R1R1R1R1L1L1L1R1L1R1R",
  },
  // 10. difficulty 42: 27 presses, 13 beats
  {
    id: "s10",
    name: "Call and Response",
    mode: "sequence",
    beat: 5,
    map: [
      "....2.4",
      ".......",
      "AB..1..",
      "......3",
    ],
    sentries: [{ path: "4,2 6,2 6,0 4,0", phase: 2 }, { path: "5,0 5,3", phase: 2 }],
    proof: "1L1L1L1R1L1R1R1R1R1R8R1R1L1R1R1R1L1R1R1L1R1R1L1L5L1R1R",
  },
  // 11. difficulty 49: 43 presses, 18 beats
  {
    id: "s11",
    name: "Combination",
    mode: "sequence",
    beat: 5,
    map: [
      ".........",
      "AB.......",
      "......4..",
      "...1.....",
      ".3.....2.",
      ".........",
    ],
    sentries: [{ path: "4,1 8,1 8,5 4,5", phase: 7 }, { path: "3,0 7,0 7,2 3,2", phase: 7 }],
    proof: "6L1L1L1L1L1R1R1R1L1L1L1R1R1R1R1L1L1R1L1R1R1R1R1R1L1R1L1R1L1R1L1R1L1L1L1L1R1L1L1R1L1R1L",
  },
  // 12. difficulty 53: 35 presses, 19 beats
  {
    id: "s12",
    name: "Rehearsal",
    mode: "sequence",
    beat: 5,
    map: [
      ".........",
      "...1.....",
      ".........",
      "3...4....",
      ".........",
      "2......AB",
    ],
    sentries: [{ path: "0,2 8,2", phase: 13 }, { path: "0,3 8,3", phase: 2 }, { path: "2,0 2,5", phase: 11 }],
    proof: "13R1R1L1R1L1R1L1R1L1R1L1L1L1R1L1R1R1R1R2R1L2R1L2R1L4L9L1L1L1L1L1R1L1R1L",
  },
  // 13. difficulty 61: 53 presses, 34 beats
  {
    id: "s13",
    name: "Syncopation",
    mode: "sequence",
    map: [
      "..2.....1",
      "5........",
      "..AB.....",
      ".......3.",
      "..4......",
    ],
    sentries: [{ path: "5,0 5,4", phase: 2 }, { path: "4,4 8,4 8,2 4,2", phase: 4 }, { path: "5,4 8,4 8,1 5,1", phase: 3 }],
    proof: "30L1L1L1R1L1R1L1R1L1R1R1R1R1R1L1R1R1L1L1R1L1R1R1R1R1R1L1R1R1L1L1R1L1L1L1L1R1L1L1R1L1R1L1R1R1R1L1L1L1L1L1R1L",
  },
  // 14. difficulty 65: 49 presses, 28 beats
  {
    id: "s14",
    name: "Cascade",
    mode: "sequence",
    map: [
      "..5..4.2",
      "........",
      "AB......",
      "...3....",
      "........",
      "....1...",
    ],
    sentries: [{ path: "0,4 7,4", phase: 12 }, { path: "3,0 3,5", phase: 5 }, { path: "6,0 6,5", phase: 10 }],
    proof: "7L1L1L1L1L1R1R1L1R1R1L1R1L1R1R1R1L1R1L1R1L1L1L1R1R1R1L1L1R1L1L1L1L3R1L1R1R1R1R1R6R1R1L1R1R1R1R1L1R",
  },
  // 15. difficulty 72: 51 presses, 39 beats
  {
    id: "s15",
    name: "Off Beat",
    mode: "sequence",
    hint: "Glowing tiles warn you. They only kill when they flash solid",
    map: [
      "..2.......",
      ".....1....",
      ".......AB.",
      "4.........",
      "..5.....3.",
      "..........",
    ],
    sweeps: [{ dir: "antidiag", start: 5, every: 12, warn: 4, speed: 1, gaps: [[0, 1, 2, 3], [2, 3, 4, 5], [0, 1, 2, 3], [0, 1, 2, 3]] }],
    proof: "23R1R1L1R1L1R1L1R1L1R1L1L1R32L1R1L1L1R1L1R1L1L1L1R1L1R1R1R1L1R1R1R1R1R1L1R1L1R1L1R1L1R1L1R1L1R1R1R1R1R1R",
  },
  // 16. difficulty 78: 57 presses, 39 beats
  {
    id: "s16",
    name: "Rondo",
    mode: "sequence",
    map: [
      "....1.....",
      ".......2..",
      "..........",
      "4..3..AB..",
      "..........",
      "........5.",
    ],
    sweeps: [{ dir: "antidiag", start: 5, every: 12, warn: 4, speed: 1, gaps: [[11, 12, 13, 14], [10, 11, 12, 13], [9, 10, 11, 12], [11, 12, 13, 14]] }],
    proof: "1R1R1L1L1L1R1R1R1R1R1R1R1L1R1L1L3L1L1R1R1L1R1L3R1L1R40R1R1R1R1L1R1L1R1L1R1L1R1L1R1R1R1R1R1L1R1L1R1L1R1L1R1L1R1L1R1R",
  },
  // 17. difficulty 85: 67 presses, 40 beats
  {
    id: "s17",
    name: "Crescendo",
    mode: "sequence",
    map: [
      "4.........",
      "......2...",
      ".AB.......",
      ".......3..",
      ".1........",
      "...5.....6",
    ],
    sentries: [{ path: "0,4 9,4", phase: 18 }, { path: "3,1 5,1 5,3 3,3", phase: 5 }],
    sweeps: [{ dir: "right", start: 5, every: 10, warn: 3, speed: 1, gaps: [[3, 4, 5], [1, 2, 3], [0, 1, 2], [3, 4, 5]] }],
    proof: "19L1L1L1L1R3L3L5L1L1L1L1L1L1R1R1R1L1L1L1R1L1R1L1L1L1L1L1R1L1R1L1L1L1R1R1R1L1R1L1R1R1R1L1R1L1R1R1R1L1R1L1L1L2R1L1R1L1R1L1R1L1R1L1R1L1R1R",
  },
  // 18. difficulty 90: 57 presses, 38 beats
  {
    id: "s18",
    name: "Polyrhythm",
    mode: "sequence",
    map: [
      ".....2...",
      ".4......3",
      ".....1...",
      "..AB.....",
      "......6..",
      "..5......",
    ],
    sentries: [{ path: "1,4 6,4 6,1 1,1", phase: 5 }, { path: "5,5 8,5 8,2 5,2", phase: 0 }],
    sweeps: [{ dir: "right", start: 5, every: 10, warn: 3, speed: 1, gaps: [[3, 4, 5], [3, 4, 5], [3, 4, 5], [3, 4, 5]] }],
    proof: "11L1L1L1R1L1R1R1R1L1R1L1L1L1L1R1R1L1L1R1L1R1R1L1R1R1R1L1R1L3R1R1R11L3L13L1R1L1L2L1R1R1R1R1R1L1R1L1R1R1R1L1R1L1R1L1R1L",
  },
  // 19. difficulty 98: 73 presses, 61 beats
  {
    id: "s19",
    name: "Showcase",
    mode: "sequence",
    map: [
      "...........",
      ".3....4....",
      "...1.....5.",
      "...........",
      ".......2..6",
      "...........",
      "........AB.",
    ],
    sentries: [{ path: "5,5 7,5 7,2 5,2", phase: 7 }, { path: "0,4 10,4", phase: 10 }],
    sweeps: [{ dir: "diag", start: 5, every: 10, warn: 3, speed: 1, gaps: [[7, 8, 9], [6, 7, 8], [7, 8, 9], [6, 7, 8]] }],
    proof: "73R1R3L1R1L1R1L1R1R3R1L1R3R1R1L1R1R1R1L1R1L1L1L22L1L1L1L1R1R1R1L1R1R1R1R1R1L1R1L1L1L1R1L1R1R1R1L1R1L1R1R1R1R1R1L1R1L1R1L1R1L1R1L1R1L1R1L1L1R1R1L1L1L",
  },
  // 20. difficulty 104: 71 presses, 66 beats
  {
    id: "s20",
    name: "Curtain Call",
    mode: "sequence",
    map: [
      ".........3",
      ".5........",
      "...1....4.",
      "2.........",
      "...AB.....",
      ".........6",
    ],
    sentries: [{ path: "8,0 8,5", phase: 5 }, { path: "1,0 1,5", phase: 12 }],
    sweeps: [{ dir: "down", start: 5, every: 10, warn: 3, speed: 1, gaps: [[2, 3, 4], [1, 2, 3], [1, 2, 3], [2, 3, 4]] }],
    proof: "69R1R15L1L1R1R1L1R1L3R1L1R3R3R7L1R1L1R1R1R1L1R1L1R1L1L1L1R1L1R1L1R1L1R1L1L1L1L1L1R1L1R1L1R1R3L17L1R1L1R1R1R1R1R10L1L1L1R1R1R1L1R1L1R1L1R1L1R1L1R1R",
  },
];
