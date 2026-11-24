import { describe, expect, it } from "vitest";
import { LEVELS } from "../src/levels/levels";
import { parseLevel } from "../src/levels/parse";
import { replay, solve } from "../src/game/solver";

// Every level must parse, must not kill you on the first tick, and must be beatable. The solver
// plays it perfectly; replaying its answer through the rules checks the two agree.
describe("levels", () => {
  it("have unique ids", () => {
    expect(new Set(LEVELS.map(l => l.id)).size).toBe(LEVELS.length);
  });

  for (const def of LEVELS) {
    it(`${def.id} "${def.name}" can be beaten`, () => {
      const lv = parseLevel(def);
      // at a human pace: at most one swing every 2 ticks (4 a second)
      const sol = solve(lv, { cooldown: 2 });
      expect(sol, `${def.id} has no solution`).not.toBeNull();
      expect(replay(lv, sol!.actions).status).toBe("won");
      if (process.env.LEVEL_REPORT) console.log(`${def.id.padEnd(4)} ${def.name.padEnd(18)} ${String(sol!.presses).padStart(3)} presses, ${(sol!.ticks / lv.beat).toFixed(1)} beats`);
    });
  }
});
