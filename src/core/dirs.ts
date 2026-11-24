import type { Vec } from "./types";

// The eight neighbours, in clockwise order on screen (y grows downward):
// 0 E, 1 SE, 2 S, 3 SW, 4 W, 5 NW, 6 N, 7 NE. A clockwise swing is +1, counterclockwise -1.
export const DIRS: readonly Vec[] = [
  { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }, { x: -1, y: 1 },
  { x: -1, y: 0 }, { x: -1, y: -1 }, { x: 0, y: -1 }, { x: 1, y: -1 },
];

export function rot(d: number, turn: number): number { return (((d + turn) % 8) + 8) % 8; }

/** direction index from a to b; they must be neighbours */
export function dirBetween(a: Vec, b: Vec): number {
  for (let i = 0; i < 8; i++) if (a.x + DIRS[i].x === b.x && a.y + DIRS[i].y === b.y) return i;
  throw new Error(`not neighbours: ${a.x},${a.y} and ${b.x},${b.y}`);
}

export function isNeighbour(a: Vec, b: Vec): boolean {
  const dx = Math.abs(a.x - b.x), dy = Math.abs(a.y - b.y);
  return Math.max(dx, dy) === 1;
}

export function same(a: Vec, b: Vec): boolean { return a.x === b.x && a.y === b.y; }
