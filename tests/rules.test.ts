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

  it("blocked by the edge: the boot stays and both boots flip direction", () => {
    const r = newRun(open(["AB..", "....", "...."]));
    press(r, 0);                               // A clockwise from west of B -> north-west: off the board
    expect(r.boots[0]).toEqual({ x: 0, y: 0 });
    expect(r.cw).toEqual([false, true]);
    expect(r.last).toEqual({ boot: 0, result: "blocked" });
    expect(r.moves).toBe(1);                   // the press still counts
    advance(r);
    press(r, 0);                               // now counterclockwise: south-west of B
    expect(r.boots[0]).toEqual({ x: 0, y: 1 });
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
