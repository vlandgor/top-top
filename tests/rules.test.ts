import { describe, expect, it } from "vitest";
import type { LevelDef } from "../src/core/types";
import { parseLevel, sentryTiles } from "../src/levels/parse";
import { advance, newRun, swing } from "../src/game/rules";

const open = (map: string[], extra: Partial<LevelDef> = {}) =>
  parseLevel({ id: "t", name: "t", mode: "destination", map, ...extra });

describe("swinging", () => {
  it("swings the mover one place around the anchor, then plants it", () => {
    const r = newRun(open(["....", ".AB.", "...."]));
    swing(r, 1);                               // B at east of A swings clockwise to south-east
    expect(r.boots[1]).toEqual({ x: 2, y: 2 });
    expect(r.boots[0]).toEqual({ x: 1, y: 1 });
    expect(r.anchor).toBe(1);                  // B is planted now, A swings next
  });

  it("walks: alternating directions moves the pair sideways one row per two taps", () => {
    const r = newRun(open([".....", ".....", ".AB..", ".....", "....."]));
    swing(r, 1); advance(r); swing(r, -1);
    expect(r.boots).toEqual([{ x: 1, y: 3 }, { x: 2, y: 3 }]);
  });

  it("allows one swing per tick", () => {
    const r = newRun(open(["....", ".AB.", "...."]));
    expect(swing(r, 1)).toBe(true);
    expect(swing(r, 1)).toBe(false);
    advance(r);
    expect(swing(r, 1)).toBe(true);
  });

  it("shuffles the planted boot inward at the edge", () => {
    const r = newRun(open(["AB..", "....", "...."]));
    swing(r, -1);                              // B would go to north-east of A: off the board
    expect(r.shuffled).toBe(true);
    expect(r.boots[0]).toEqual({ x: 0, y: 1 });
    expect(r.boots[1]).toEqual({ x: 1, y: 0 });
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
    swing(r, -1);
    expect(r.status).toBe("won");
  });

  it("restarts on a wrong step in a sequence", () => {
    const lv = parseLevel({ id: "t", name: "t", mode: "sequence", map: ["..2.", ".AB.", "..1."] });
    const r = newRun(lv);
    swing(r, -1);                              // onto 2 before 1
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
