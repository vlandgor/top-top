// ---------------------------------------------------------------------------
// SAVE — cleared levels, attempts and settings, kept in localStorage. How progression and
// saves should finally work is still open; this is the simplest thing that works offline.
// ---------------------------------------------------------------------------
import type { LevelDef } from "../core/types";

export interface Save {
  /** best clear per level: fewest presses, then fewest ticks */
  done?: Record<string, { presses: number; ticks: number }>;
  attempts?: Record<string, number>;
  /** the game mode last chosen on the modes screen */
  lastMode?: "destination" | "collect" | "sequence" | "survival" | "waves";
  /** co-op: the team's fastest clear in ticks, by "room id/players" */
  roomBest?: Record<string, number>;
  /** co-op: the room last chosen in the lobby */
  roomId?: string;
  /** co-op: the lobby's other three slots as last set up: "open" or a bot skill */
  roomSlots?: string[];
  /** the boot skin you wear (render/skins.ts) */
  skin?: string;
  /** the language picked in Settings; left out, the phone's language (i18n) */
  lang?: string;
  /** 0 = sound effects off */
  sfx?: number;
  /** 0 = music off */
  music?: number;
  /** today's daily level, built once on this phone (game/daily.ts) */
  daily?: { key: string; def: LevelDef };
  /** 0 = vibration off */
  haptics?: number;
}

const SAVE_KEY = "topTop.v1";
export const save: Save = loadSave();

function loadSave(): Save {
  try { const s = JSON.parse(localStorage.getItem(SAVE_KEY) || "{}"); return s && typeof s === "object" ? s : {}; }
  catch { return {}; }                    // storage can be blocked or empty: play on without it
}
export function writeSave(){ try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* full or blocked */ } }
export function resetSave(){
  // settings (sound, language) and the boots you wear stay; progress goes
  const { sfx, music, haptics, skin, lang } = save;
  for (const k of Object.keys(save) as (keyof Save)[]) delete save[k];
  if (sfx !== undefined) save.sfx = sfx;
  if (music !== undefined) save.music = music;
  if (haptics !== undefined) save.haptics = haptics;
  if (skin !== undefined) save.skin = skin;
  if (lang !== undefined) save.lang = lang;
  writeSave();
}
