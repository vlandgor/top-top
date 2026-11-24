// ---------------------------------------------------------------------------
// SAVE — cleared levels, attempts and settings, kept in localStorage. How progression and
// saves should finally work is still open; this is the simplest thing that works offline.
// ---------------------------------------------------------------------------
export interface Save {
  /** best clear per level: fewest presses, then fewest ticks */
  done?: Record<string, { presses: number; ticks: number }>;
  attempts?: Record<string, number>;
  /** the game mode last chosen on the modes screen */
  lastMode?: "destination" | "collect" | "sequence" | "survival" | "waves";
  /** 0 = sound off */
  sfx?: number;
}

const SAVE_KEY = "topTop.v1";
export const save: Save = loadSave();

function loadSave(): Save {
  try { const s = JSON.parse(localStorage.getItem(SAVE_KEY) || "{}"); return s && typeof s === "object" ? s : {}; }
  catch { return {}; }                    // storage can be blocked or empty: play on without it
}
export function writeSave(){ try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* full or blocked */ } }
export function resetSave(){
  const sfx = save.sfx;
  for (const k of Object.keys(save) as (keyof Save)[]) delete save[k];
  if (sfx !== undefined) save.sfx = sfx;
  writeSave();
}
