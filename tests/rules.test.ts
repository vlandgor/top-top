import { describe, expect, it } from "vitest";
import type { LevelDef } from "../src/core/types";
import { parseLevel, sentryTiles } from "../src/levels/parse";
import { advance, newRun, press } from "../src/game/rules";

const open = (map: string[], extra: Partial<LevelDef> = {}) =>
  parseLevel({ id: "t", name: "t", mode: "destination", map, ...extra });

// Movement is Chick Mates' (chick-mates-sandbox applyJump); these pin it down.
describe("movement", () => {
  it("swings the pressed boot one place around the other: the left boot clockwise", () => {
    const r = newRun(open([".....", ".AB..", "....."]));
    press(r, 0);                               // A is west of B; clockwise next is north-west
    expect(r.boots[0]).toEqual({ x: 1, y: 0 });
    expect(r.boots[1]).toEqual({ x: 2, y: 1 });
  });

  it("the right boot turns counterclockwise", () => {
    const r = newRun(open([".....", ".AB..", "....."]));
    press(r, 1);                               // B is east of A; counterclockwise next is north-east
    expect(r.boots[1]).toEqual({ x: 2, y: 0 });
  });

  it("walks: alternating presses move the pair", () => {
    const r = newRun(open([".....", ".....", ".AB..", ".....", "....."]));
    press(r, 0); advance(r);                   // A -> 1,1 (NW of B)
    press(r, 1); advance(r);                   // B, at SE of A, counterclockwise -> E of A: 2,1
    expect(r.boots).toEqual([{ x: 1, y: 1 }, { x: 2, y: 1 }]);
  });

  it("allows one press per tick", () => {
    const r = newRun(open(["....", ".AB.", "...."]));
    expect(press(r, 0)).toBe(true);
    expect(press(r, 1)).toBe(false);
    advance(r);
    expect(press(r, 1)).toBe(true);
  });

  it("off the edge: the boot steps back around the other one, and nothing flips", () => {
    const r = newRun(open(["AB..", "....", "...."]));
    press(r, 0);                               // A clockwise from west of B -> north-west: off the board
    expect(r.boots[0]).toEqual({ x: 0, y: 1 });// so it steps back to south-west of B
    expect(r.last).toEqual({ boot: 0, result: "back" });
    advance(r);
    press(r, 1);                               // B, north-east of A, counterclockwise -> north: A's old spot
    expect(r.boots[1]).toEqual({ x: 0, y: 0 });
    advance(r);
    press(r, 0);                               // A still turns clockwise: from south of B -> south-west: off, back -> south-east
    expect(r.boots[0]).toEqual({ x: 1, y: 1 });
  });

  it("every press from every placement lands on the board, next to the other boot", () => {
    // on any board at least 2x2, one step back is always enough; this checks all of them on a small one
    const W = 4, H = 3, lv = open(["AB..", "....", "...."]);
    for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      if ((!dx && !dy) || x + dx < 0 || y + dy < 0 || x + dx >= W || y + dy >= H) continue;
      for (const who of [0, 1] as const) {
        const r = newRun(lv);
        r.boots = [{ x, y }, { x: x + dx, y: y + dy }];
        press(r, who);
        const [p, q] = r.boots;
        expect(p.x >= 0 && p.y >= 0 && p.x < W && p.y < H && q.x >= 0 && q.y >= 0 && q.x < W && q.y < H).toBe(true);
        expect(Math.max(Math.abs(p.x - q.x), Math.abs(p.y - q.y))).toBe(1);
      }
    }
  });
});

describe("hazards and goals", () => {
  it("dies when a sentry steps onto a boot", () => {
    const r = newRun(open(["....", "AB..", "...."], { sentries: [{ path: "3,1 0,1" }], beat: 1 }));
    advance(r);                                // sentry 3,1 -> 2,1
    expect(r.status).toBe("play");
    advance(r);                                // -> 1,1, where B stands
    expect(r.status).toBe("dead");
    expect(r.cause).toBe("sentry");
  });

  it("wins on reaching the goal", () => {
    const r = newRun(open(["..G.", ".AB.", "...."]));
    press(r, 1);                               // B counterclockwise -> north-east of A: 2,0
    expect(r.status).toBe("won");
  });

  it("restarts on a wrong step in a sequence", () => {
    const lv = parseLevel({ id: "t", name: "t", mode: "sequence", map: ["..2.", ".AB.", "..1."] });
    const r = newRun(lv);
    press(r, 1);                               // onto 2 before 1
    expect(r.status).toBe("dead");
    expect(r.cause).toBe("order");
  });

  it("sweeps only kill in their lethal window", () => {
    const r = newRun(open(["....", ".AB.", "...."], { sweeps: [{ dir: "all", start: 2, warn: 1, lethal: 1, speed: 0 }], beat: 1 }));
    advance(r); expect(r.status).toBe("play"); // beat 1: warning
    advance(r); expect(r.status).toBe("dead"); // beat 2: lethal
  });
});

describe("sentry paths", () => {
  it("loops a closed path without repeating the corner", () => {
    expect(sentryTiles("0,0 1,0 1,1", false, "t").length).toBe(3);
  });
  it("ping-pongs a line", () => {
    expect(sentryTiles("0,0 3,0", false, "t").map(p => p.x)).toEqual([0, 1, 2, 3, 2, 1]);
  });
});
