import type { LevelDef } from "../core/types";

// Destination levels, written by tools/gen-levels.ts (npm run gen-levels destination). Names and hints
// can be edited here; to change a layout, change its recipe in the tool and re-run it.
export const DESTINATION: LevelDef[] = [
  //  1. difficulty 7: 7 presses, 2 beats
  {
    id: "d1",
    name: "First Steps",
    mode: "destination",
    beat: 6,
    hint: "Left button swings the left boot, right button the right one. Alternate them to walk",
    map: [
      "......",
      ".....G",
      ".AB...",
      "......",
    ],
    proof: "L1L1L1R1L1R1L",
  },
  //  2. difficulty 7: 7 presses, 2 beats
  {
    id: "d2",
    name: "Side Step",
    mode: "destination",
    beat: 6,
    map: [
      "......",
      "......",
      ".....G",
      ".AB...",
    ],
    proof: "L1L1L1R1L1R1L",
  },
  //  3. difficulty 9: 9 presses, 3 beats
  {
    id: "d3",
    name: "Into the Corner",
    mode: "destination",
    beat: 6,
    map: [
      "......G",
      ".AB....",
      ".......",
      ".......",
    ],
    proof: "L1L1L1R1L1R1L1R1L",
  },
  //  4. difficulty 13: 9 presses, 5 beats
  {
    id: "d4",
    name: "Patrol",
    mode: "destination",
    beat: 6,
    hint: "Sentries step on the beat. The faint tile is where they go next",
    map: [
      "......",
      "AB...G",
      "......",
      "......",
    ],
    sentries: [{ path: "4,0 4,3", phase: 4 }],
    proof: "10L1L1L1R1L1R1L1R1R",
  },
  //  5. difficulty 13: 11 presses, 4 beats
  {
    id: "d5",
    name: "Crosswalk",
    mode: "destination",
    beat: 6,
    map: [
      ".....G",
      "......",
      "AB....",
      "......",
    ],
    sentries: [{ path: "2,0 2,3", phase: 7 }],
    proof: "L1R1L1L1L1R1L1R1L1R1L",
  },
  //  6. difficulty 13: 9 presses, 4 beats
  {
    id: "d6",
    name: "Night Shift",
    mode: "destination",
    beat: 6,
    map: [
      "......",
      "......",
      "AB...G",
      "......",
      "......",
    ],
    sentries: [{ path: "2,0 2,4", phase: 1 }],
    proof: "6L1L1L1R1L1R1L1R1R",
  },
  //  7. difficulty 13: 11 presses, 4 beats
  {
    id: "d7",
    name: "Two Step",
    mode: "destination",
    beat: 6,
    map: [
      ".......",
      ".......",
      ".......",
      "AB....G",
      ".......",
    ],
    sentries: [{ path: "0,2 6,2", phase: 3 }],
    proof: "L1L1L1R1L1R1L1R1R1L1R",
  },
  //  8. difficulty 17: 13 presses, 5 beats
  {
    id: "d8",
    name: "Double Guard",
    mode: "destination",
    beat: 5,
    map: [
      ".......",
      "AB.....",
      "......G",
      ".......",
    ],
    sentries: [{ path: "2,0 2,3", phase: 2 }, { path: "5,0 5,3", phase: 0 }],
    proof: "L1L1L1R1L1R1L1R1L1R1L1L1L",
  },
  //  9. difficulty 17: 11 presses, 6 beats
  {
    id: "d9",
    name: "Back and Forth",
    mode: "destination",
    beat: 5,
    map: [
      "........",
      "........",
      "......G.",
      "AB......",
    ],
    sentries: [{ path: "5,0 5,3", phase: 0 }, { path: "0,1 7,1", phase: 5 }],
    proof: "7L1L1L1R1L1R1L1R1R1L1L",
  },
  // 10. difficulty 17: 13 presses, 5 beats
  {
    id: "d10",
    name: "Checkpoint",
    mode: "destination",
    beat: 5,
    map: [
      "........",
      "......G.",
      "........",
      "AB......",
      "........",
    ],
    sentries: [{ path: "0,1 7,1", phase: 3 }, { path: "0,3 7,3", phase: 8 }],
    proof: "L1L1L1R1R1R1L1L1L1R1L1R1L",
  },
  // 11. difficulty 17: 13 presses, 5 beats
  {
    id: "d11",
    name: "Box Step",
    mode: "destination",
    beat: 5,
    map: [
      "........",
      "........",
      ".AB....G",
      "........",
      "........",
    ],
    sentries: [{ path: "0,0 7,0", phase: 4 }, { path: "1,3 5,3 5,1 1,1", phase: 4 }],
    proof: "L1L1L1L1R1R1L1R1L1R1L1R1L",
  },
  // 12. difficulty 21: 13 presses, 6 beats
  {
    id: "d12",
    name: "Ring Road",
    mode: "destination",
    beat: 5,
    map: [
      ".........",
      ".........",
      "........G",
      ".AB......",
      ".........",
      ".........",
    ],
    sentries: [{ path: "0,5 5,5 5,2 0,2", phase: 1 }, { path: "2,3 7,3 7,1 2,1", phase: 2 }, { path: "5,1 8,1 8,5 5,5", phase: 6 }],
    proof: "3L1L1L1R1L1R1L1R1L1R1R1L1L",
  },
  // 13. difficulty 21: 13 presses, 9 beats
  {
    id: "d13",
    name: "Gridlock",
    mode: "destination",
    map: [
      ".........",
      "AB.....G.",
      ".........",
      ".........",
      ".........",
      ".........",
    ],
    sentries: [{ path: "2,0 2,5", phase: 8 }, { path: "3,3 5,3 5,5 3,5", phase: 3 }, { path: "1,2 4,2 4,4 1,4", phase: 2 }],
    proof: "10L1L1L1R1L1R1L1R1L1R1L1R1R",
  },
  // 14. difficulty 23: 19 presses, 9 beats
  {
    id: "d14",
    name: "Waterfall",
    mode: "destination",
    hint: "Glowing tiles warn you. They only kill when they flash solid",
    map: [
      ".........",
      "........G",
      ".........",
      ".........",
      ".AB......",
    ],
    sweeps: [{ dir: "antidiag", start: 5, every: 12, warn: 4, speed: 1, gaps: [[4, 5, 6, 7], [2, 3, 4, 5], [0, 1, 2, 3], [0, 1, 2, 3]] }],
    proof: "L1L1L1R1L1R1L1R1R1R1L1R1L1R1L1L1L1R1R",
  },
  // 15. difficulty 25: 19 presses, 15 beats
  {
    id: "d15",
    name: "Undercurrent",
    mode: "destination",
    map: [
      "..........",
      ".........G",
      "AB........",
      "..........",
      "..........",
      "..........",
    ],
    sweeps: [{ dir: "antidiag", start: 5, every: 12, warn: 4, speed: 1, gaps: [[2, 3, 4, 5], [3, 4, 5, 6], [6, 7, 8, 9], [3, 4, 5, 6]] }],
    proof: "22L1L1L1R1L1R1R1R1L1L1L1R1L1R1L1R1L1R1R",
  },
  // 16. difficulty 25: 15 presses, 10 beats
  {
    id: "d16",
    name: "Downpour",
    mode: "destination",
    map: [
      ".........",
      ".........",
      "........G",
      ".........",
      ".AB......",
      ".........",
    ],
    sentries: [{ path: "6,0 6,5", phase: 11 }, { path: "0,1 8,1", phase: 11 }],
    sweeps: [{ dir: "diag", start: 5, every: 10, warn: 3, speed: 1, gaps: [[6, 7, 8], [6, 7, 8], [7, 8, 9], [9, 10, 11]] }],
    proof: "10L1L1L1R1L1R1L1R1R1L1L1R1R1R1R",
  },
  // 17. difficulty 27: 17 presses, 12 beats
  {
    id: "d17",
    name: "Floodlight",
    mode: "destination",
    map: [
      "..........",
      "..........",
      ".........G",
      "..........",
      ".AB.......",
      "..........",
    ],
    sentries: [{ path: "7,3 9,3 9,1 7,1", phase: 4 }, { path: "2,0 2,5", phase: 7 }],
    sweeps: [{ dir: "down", start: 5, every: 10, warn: 3, speed: 1, gaps: [[3, 4, 5], [4, 5, 6], [1, 2, 3], [0, 1, 2]] }],
    proof: "14L1L1L1R1L1R1R1R1L1L1L1R1L1R1L1R1L",
  },
  // 18. difficulty 29: 19 presses, 10 beats
  {
    id: "d18",
    name: "Last Dance",
    mode: "destination",
    map: [
      "..........",
      "..........",
      "........G.",
      "..........",
      "AB........",
      "..........",
    ],
    sentries: [{ path: "5,3 9,3 9,5 5,5", phase: 4 }, { path: "0,0 9,0", phase: 18 }],
    sweeps: [{ dir: "down", start: 5, every: 10, warn: 3, speed: 1, gaps: [[3, 4, 5], [6, 7, 8], [5, 6, 7], [7, 8, 9]] }],
    proof: "2L1L1L1R1L1R1L1R1R1R1L1R1L1L1L1R1L1R1R",
  },
  // 19. difficulty 29: 19 presses, 14 beats
  {
    id: "d19",
    name: "Stage Dive",
    mode: "destination",
    map: [
      "...........",
      "...........",
      "...........",
      "AB.........",
      ".........G.",
      "...........",
      "...........",
    ],
    sentries: [{ path: "7,0 10,0 10,2 7,2", phase: 3 }, { path: "0,2 10,2", phase: 19 }],
    sweeps: [{ dir: "down", start: 5, every: 10, warn: 3, speed: 1, gaps: [[2, 3, 4], [2, 3, 4], [4, 5, 6], [2, 3, 4]] }],
    proof: "18L1L1L1L1R1R1L1R1L1R1L1R1L1R1L1R1L1R1R",
  },
  // 20. difficulty 33: 25 presses, 12 beats
  {
    id: "d20",
    name: "Encore",
    mode: "destination",
    map: [
      "..........",
      ".........G",
      "..........",
      "..........",
      "..........",
      "..........",
      "AB........",
    ],
    sentries: [{ path: "2,6 6,6 6,4 2,4", phase: 3 }, { path: "0,3 9,3", phase: 18 }],
    sweeps: [{ dir: "right", start: 5, every: 10, warn: 3, speed: 1, gaps: [[4, 5, 6], [3, 4, 5], [1, 2, 3], [0, 1, 2]] }],
    proof: "L1L1L1R1L1R1L1R1L1R1L1R1R1R1L1R1L1R1L1R1L1L1L1R1L",
  },
];
