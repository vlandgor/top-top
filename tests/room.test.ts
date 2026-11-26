import { describe, expect, it } from "vitest";
import type { LevelDef } from "../src/core/types";
import { parseLevel } from "../src/levels/parse";
import { forPlayers, ROOMS } from "../src/levels/rooms";
import { advanceRoom, newRoom, pressPair, RESPAWN_TICKS } from "../src/game/room";
import { Bot, botsAct, SKILLS, type SkillId } from "../src/game/bot";

const room = (map: string[], starts: string[], extra: Partial<LevelDef> = {}) =>
  parseLevel({ id: "t", name: "t", mode: "collect", map, starts, ...extra });

describe("room levels", () => {
  it("list a start per player instead of A / B", () => {
    const lv = room(["o....", ".....", "....o"], ["0,1 1,1", "3,1 4,1"]);
    expect(lv.starts).toEqual([[{ x: 0, y: 1 }, { x: 1, y: 1 }], [{ x: 3, y: 1 }, { x: 4, y: 1 }]]);
    expect(lv.start).toEqual(lv.starts[0]);
  });

  it("refuse A / B on the map, and starts whose boots aren't neighbours", () => {
    expect(() => room(["AB..", "...."], ["0,1 1,1"])).toThrow(/no A \/ B/);
    expect(() => room(["....", "...."], ["0,0 2,0"])).toThrow(/neighbours/);
  });
});

describe("co-op rules", () => {
  it("lights are shared: one player's pickup counts for the team", () => {
    const lv = room([".o...", ".....", "....."], ["0,1 1,1", "3,1 4,1"]);
    const r = newRoom(lv, 2);
    pressPair(r, 0, 1);                       // pair 0's right boot, counterclockwise: north-east of A = 1,0
    expect(r.taken[0]).toBe(true);
    expect([r.got, r.pairs[0].got, r.pairs[1].got]).toEqual([1, 1, 0]);
    expect(r.status).toBe("won");
  });

  it("pairs don't block each other: they can stand on the same tiles", () => {
    const lv = room([".....", ".....", ".....", "o...o"], ["1,1 2,1", "1,2 2,2"]);
    const r = newRoom(lv, 2);
    expect(pressPair(r, 1, 1)).toBe(true);    // pair 1's right boot swings to 2,1: pair 0's right boot is there
    expect(r.pairs[1].boots[1]).toEqual({ x: 2, y: 1 });
  });

  it("each player gets one press per tick, independently", () => {
    const lv = room([".....", ".....", "....o"], ["0,1 1,1", "3,1 4,1"]);
    const r = newRoom(lv, 2);
    expect(pressPair(r, 0, 0)).toBe(true);
    expect(pressPair(r, 0, 1)).toBe(false);
    expect(pressPair(r, 1, 0)).toBe(true);
  });

  it("a death costs a shared life; the pair comes back at its start", () => {
    // a sentry standing on 1,0: pair 0's left boot swings clockwise from west of B onto it
    const lv = room([".....", ".....", "....o"], ["0,1 1,1", "3,1 4,1"], { sentries: [{ path: "0,0" }], lives: 3 });
    const r = newRoom(lv, 2);
    pressPair(r, 0, 0);
    expect(r.pairs[0].alive).toBe(false);
    expect(r.lives).toBe(2);
    expect(r.status).toBe("play");            // the team plays on
    expect(pressPair(r, 0, 1)).toBe(false);   // no presses while out
    for (let i = 0; i < RESPAWN_TICKS; i++) advanceRoom(r);
    expect(r.pairs[0].alive).toBe(true);
    expect(r.pairs[0].boots).toEqual([{ x: 0, y: 1 }, { x: 1, y: 1 }]);
  });

  it("the run is lost when the lives run out", () => {
    const lv = room([".....", ".....", "....o"], ["0,1 1,1", "3,1 4,1"], { sentries: [{ path: "0,0" }], lives: 1 });
    const r = newRoom(lv, 2);
    pressPair(r, 0, 0);
    expect([r.status, r.why]).toEqual(["lost", "lives"]);
  });

  it("the run is lost when the clock runs out", () => {
    const lv = room([".....", ".....", "....o"], ["0,1 1,1", "3,1 4,1"], { limit: 2, beat: 4 });
    const r = newRoom(lv, 2);
    for (let i = 0; i < 8; i++) advanceRoom(r);
    expect([r.status, r.why]).toEqual(["lost", "time"]);
  });
});

describe("room levels for more players", () => {
  it("add their extra lights", () => {
    const def = ROOMS.find(r => r.more?.length)!;
    const lights = (n: number) => parseLevel(forPlayers(def, n)).items.length;
    expect(lights(3)).toBeGreaterThan(lights(2));
    expect(lights(4)).toBeGreaterThan(lights(3));
  });
});

// A room has no proof: it is proven by bot teams clearing it, at every player count and skill.
// Normal and Hard teams must win every run; Easy bots are meant to be a liability, so an Easy
// team only has to win at least half of its runs.
describe("rooms can be cleared by bot teams", () => {
  for (const def of ROOMS) {
    for (const skill of ["hard", "normal", "easy"] as SkillId[]) {
      for (let n = 2; n <= (def.starts?.length || 0); n++) {
        it(`${def.id} "${def.name}": ${n} ${skill} bots`, () => {
          const lv = parseLevel(forPlayers(def, n));
          const runs: string[] = [];
          let wins = 0;
          for (let seed = 1; seed <= 4; seed++) {
            const r = newRoom(lv, n);
            const bots = r.pairs.map((_, i) => new Bot(i, SKILLS[skill], seed * 100 + i));
            while (r.status === "play") { botsAct(r, bots); advanceRoom(r); }
            if (r.status === "won") wins++;
            else if (skill !== "easy") expect(r.status, `seed ${seed}: ${r.why}, ${r.got}/${lv.items.length} lights`).toBe("won");
            runs.push(`${r.status === "won" ? "" : "LOST "}` + `${(r.tick / 8).toFixed(1)}s/${r.pairs.reduce((s, p) => s + p.deaths, 0)}fell`);
          }
          if (process.env.ROOM_STATS) console.log(def.id, skill, n, runs.join(" "));
          expect(wins, runs.join(" ")).toBeGreaterThanOrEqual(2);
        });
      }
    }
  }
});
