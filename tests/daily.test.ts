import { describe, expect, it } from "vitest";
import { buildDaily, dailyPlan, dayAdd, dayKey } from "../src/levels/daily";
import { parseLevel } from "../src/levels/parse";
import { decodeProof, replay } from "../src/game/solver";
import { dailyStreak } from "../src/game/daily";
import { save } from "../src/storage/save";

describe("daily level", () => {
  it("is the same level for everyone on the same day, and a new one the next", () => {
    const a = buildDaily("2026-11-27"), b = buildDaily("2026-11-27"), c = buildDaily("2026-11-28");
    expect(a).toEqual(b);
    expect(a.map).not.toEqual(c.map);
    expect(a.id).toBe("daily-2026-11-27");
  });

  it("goes round all five modes, gentle on Monday and hardest on Sunday", () => {
    let k = "2026-11-23";                                   // a Monday
    const modes = new Set<string>();
    for (let i = 0; i < 5; i++, k = dayAdd(k, 1)) modes.add(dailyPlan(k).mode);
    expect(modes.size).toBe(5);
    expect(dailyPlan("2026-11-23").slot).toBeLessThan(dailyPlan("2026-11-29").slot);
  });

  it("can always be beaten: two weeks of dailies replay their proof to a win", () => {
    let k = "2026-12-01";
    for (let i = 0; i < 14; i++, k = dayAdd(k, 1)) {
      const def = buildDaily(k);
      expect(replay(parseLevel(def), decodeProof(def.proof!)).status, k).toBe("won");
    }
  }, 60000);

  it("counts a streak of days in a row, which today not being cleared yet doesn't break", () => {
    const today = dayKey(), win = { presses: 1, ticks: 1 };
    save.done = {};
    expect(dailyStreak()).toBe(0);
    save.done["daily-" + dayAdd(today, -1)] = win; save.done["daily-" + dayAdd(today, -2)] = win;
    expect(dailyStreak()).toBe(2);
    save.done["daily-" + today] = win;
    expect(dailyStreak()).toBe(3);
    delete save.done["daily-" + dayAdd(today, -1)];
    expect(dailyStreak()).toBe(1);
    delete save.done;
  });
});
