import type { LevelDef, Mode } from "../core/types";
import { judge, RECIPES, rngOf } from "./generator";

// ---------------------------------------------------------------------------
// DAILY LEVEL — one new level a day, built on the phone from the date with the same recipes
// and the same judge as the 100 levels. The date is the seed, so everyone gets the same level
// on the same day, and like every level it is proven beatable at a human pace.
//
// The mode goes round all five, one a day. The weekday sets how hard it is: gentle on Monday,
// harder through the week, the hardest on Sunday (slots on the solo curve, 0..19).
// ---------------------------------------------------------------------------

export const DAILY_PREFIX = "daily-";
const MODES: Mode[] = ["destination", "collect", "sequence", "survival", "waves"];
/** Sunday .. Saturday, as in Date.getDay() */
const SLOT_BY_WEEKDAY = [13, 4, 6, 8, 9, 10, 12];

/** the local calendar day as "YYYY-MM-DD" */
export function dayKey(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
/** the date of a key, at local midnight */
export function dayDate(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}
/** the key of the day `n` days after (or before) this one */
export function dayAdd(key: string, n: number): string {
  const d = dayDate(key); d.setDate(d.getDate() + n); return dayKey(d);
}
/** days since 2026-01-01, whatever the time zone */
function dayIndex(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(2026, 0, 1)) / 86400000);
}

export const isDaily = (def: LevelDef | null | undefined) => !!def?.id.startsWith(DAILY_PREFIX);
export const dailyId = (key: string) => DAILY_PREFIX + key;

/** which mode and how hard, for a day */
export function dailyPlan(key: string): { mode: Mode; slot: number } {
  return { mode: MODES[((dayIndex(key) % 5) + 5) % 5], slot: SLOT_BY_WEEKDAY[dayDate(key).getDay()] };
}

function seedOf(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** build the day's level. Takes from a few milliseconds to a few seconds: run it off the main thread */
export function buildDaily(key: string): LevelDef {
  const { mode, slot } = dailyPlan(key), rng = rngOf(seedOf(key));
  // if a slot can't give a fair level in a few tries, an easier one will
  for (let s = slot; s >= 0; s--) {
    for (let tries = 0; tries < 30; tries++) {
      const d = RECIPES[mode](s, rng);
      const j = d && judge(d, s, false);
      if (j) return { ...j.def, id: dailyId(key), name: key, proof: j.proof };
    }
  }
  throw new Error(`no daily level for ${key}`);
}
