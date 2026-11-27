import type { LevelDef } from "../core/types";
import { buildDaily, dailyId, dayAdd, dayKey } from "../levels/daily";
import { save, writeSave } from "../storage/save";

// ---------------------------------------------------------------------------
// TODAY'S DAILY — the day's level is built once, in a worker, and kept in the save; until it
// is ready the menu says so. Clears go in save.done like any level ("daily-2026-11-27"), so the
// streak is just how many days in a row have one.
// ---------------------------------------------------------------------------

let building = "";
let onReady: () => void = () => {};
/** called when a day's level has been built (the menu redraws its row) */
export function onDailyReady(fn: () => void){ onReady = fn; }

/** today's level, or null while it is being built (it starts building now) */
export function todaysDaily(): LevelDef | null {
  const key = dayKey();
  if (save.daily?.key === key) return save.daily.def;
  build(key);
  return null;
}

function done(key: string, def: LevelDef | null){
  building = "";
  if (!def) return;
  save.daily = { key, def }; writeSave();
  onReady();
}

function build(key: string){
  if (building === key) return;
  building = key;
  try {
    const w = new Worker(new URL("../levels/daily.worker.ts", import.meta.url), { type: "module" });
    w.onmessage = (e: MessageEvent<LevelDef | null>) => { w.terminate(); done(key, e.data); };
    w.onerror = () => { w.terminate(); buildHere(key); };
    w.postMessage(key);
  } catch { buildHere(key); }
}
/** no workers here: build on the main thread, after the menu has drawn */
function buildHere(key: string){
  setTimeout(() => { let def = null; try { def = buildDaily(key); } catch { /* none today */ } done(key, def); }, 60);
}

/** the best clear of a day's daily, if any */
export const dailyBest = (key = dayKey()) => save.done?.[dailyId(key)];

/** days in a row with a clear, up to today; today not cleared yet doesn't break it */
export function dailyStreak(): number {
  let key = dayKey(), n = 0;
  if (!dailyBest(key)) key = dayAdd(key, -1);
  while (dailyBest(key)) { n++; key = dayAdd(key, -1); }
  return n;
}

/** hours until the next daily */
export function hoursToNext(): number {
  const now = new Date(), next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return Math.max(1, Math.ceil((next.getTime() - now.getTime()) / 3600000));
}
