import { describe, expect, it } from "vitest";
import { LEVELS, MODES, levelsOf } from "../src/levels/levels";
import { parseLevel } from "../src/levels/parse";
import { decodeProof, replay, solve } from "../src/game/solver";

// Every level must parse and must be beatable at a human pace. Each level carries a proof (a
// winning input found by tools/gen-levels.ts); replaying it through the rules proves the level
// can be won, quickly. SOLVE=1 also re-solves every level from scratch (slow).
describe("levels", () => {
  it("have unique ids", () => {
    expect(new Set(LEVELS.map(l => l.id)).size).toBe(LEVELS.length);
  });

  it("20 per mode", () => {
    for (const m of MODES) expect(levelsOf(m.id).length, m.id).toBe(20);
  });

  it("previews point at real levels", () => {
    for (const m of MODES) expect(LEVELS.some(l => l.id === m.preview), m.preview).toBe(true);
  });

  for (const def of LEVELS) {
    it(`${def.id} "${def.name}" can be beaten`, () => {
      const lv = parseLevel(def);
      expect(def.proof, `${def.id} has no proof`).toBeTruthy();
      const actions = decodeProof(def.proof!);
      expect(replay(lv, actions).status).toBe("won");
      // at a human pace: never two presses less than 2 ticks apart
      let last = -9;
      actions.forEach((a, t) => { if (a) { expect(t - last, `${def.id} presses too fast at tick ${t}`).toBeGreaterThanOrEqual(2); last = t; } });
      if (process.env.SOLVE) expect(solve(lv, { cooldown: 2 })).not.toBeNull();
    });
  }
});
