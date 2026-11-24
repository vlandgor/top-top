import type { Level, LevelDef, Run, Turn, Vec } from "../core/types";
import { parseLevel } from "../levels/parse";
import { LEVELS } from "../levels/levels";
import { sfx } from "../audio/audio";
import { save, writeSave } from "../storage/save";
import { advance, canSwing, newRun, swing } from "./rules";

// ---------------------------------------------------------------------------
// SESSION — the live game around the pure rules: real time, input buffering, instant retry,
// attempts and results. Rendering and menus read S; only this file changes it.
// ---------------------------------------------------------------------------

/** one tick of game time. hazards step every lv.beat ticks (4 by default: 120 bpm) */
export const TICK_MS = 125;
/** how long the death flash shows before the level restarts by itself */
export const RETRY_MS = 380;

export type Screen = "menu" | "play" | "paused" | "won";

export interface SwingAnim {
  t0: number;                 // seconds
  idx: 0 | 1;                 // which boot swung
  pivot: Vec;                 // the planted boot's tile before any shuffle
  from: Vec; to: Vec;         // the swinging boot
  shuffleFrom: Vec | null;    // the planted boot, if it had to shuffle
}

export const S = {
  screen: "menu" as Screen,
  def: null as LevelDef | null,
  lv: null as Level | null,
  run: null as Run | null,
  /** ms into the current tick */
  acc: 0,
  buffered: 0 as 0 | Turn,
  attempt: 1,
  /** seconds, from the frame loop */
  now: 0,
  deadAt: 0,
  wonAt: 0,
  /** seconds at which each item index was picked up, for the pop animation */
  pickedAt: new Map<number, number>(),
  anim: null as SwingAnim | null,
  lastBeat: -1,
  onWin: null as null | (() => void),
};

export function startLevel(def: LevelDef){
  const fresh = S.def?.id !== def.id;
  S.def = def; S.lv = parseLevel(def);
  if (fresh) S.attempt = (save.attempts?.[def.id] || 0) + 1;
  restart();
}

export function restart(){
  if (!S.lv) return;
  S.run = newRun(S.lv); S.acc = 0; S.buffered = 0; S.anim = null; S.deadAt = 0; S.wonAt = 0;
  S.pickedAt.clear(); S.lastBeat = -1;
  S.screen = "play";
}

/** the player tapped a direction */
export function input(turn: Turn){
  const r = S.run;
  if (S.screen !== "play" || !r) return;
  if (r.status === "dead") { retry(); return; }        // tapping through the flash retries at once
  if (r.status !== "play") return;
  if (canSwing(r)) doSwing(turn); else S.buffered = turn;
}

function doSwing(turn: Turn){
  const r = S.run!;
  const idx = (1 - r.anchor) as 0 | 1;
  const pivot = { ...r.boots[r.anchor] }, from = { ...r.boots[idx] };
  const before = r.got;
  if (!swing(r, turn)) return;
  S.anim = {
    t0: S.now, idx, pivot, from, to: { ...r.boots[idx] },
    shuffleFrom: r.shuffled ? pivot : null,
  };
  sfx(idx ? "stepR" : "stepL");
  afterChange(before);
}

/** pickups, death and win after the rules moved anything */
function afterChange(gotBefore: number){
  const r = S.run!;
  if (r.got > gotBefore) {
    r.taken.forEach((t, i) => { if (t && !S.pickedAt.has(i)) S.pickedAt.set(i, S.now); });
    sfx("pick", r.got);
  }
  if (r.status === "dead") onDeath();
  else if (r.status === "won") onWon();
}

function onDeath(){
  S.deadAt = S.now; S.buffered = 0;
  bumpAttempts();
  sfx("die");
}

function retry(){ S.attempt++; restart(); }

function onWon(){
  const r = S.run!, id = S.def!.id;
  S.wonAt = S.now;
  bumpAttempts();
  save.done = save.done || {};
  const prev = save.done[id];
  const ticks = r.tick;
  if (!prev || r.moves < prev.swings || (r.moves === prev.swings && ticks < prev.ticks)) save.done[id] = { swings: r.moves, ticks };
  writeSave();
  sfx("win");
}

function bumpAttempts(){
  const id = S.def!.id;
  save.attempts = save.attempts || {};
  save.attempts[id] = (save.attempts[id] || 0) + 1;
  writeSave();
}

/** advance real time; called every frame with seconds elapsed */
export function update(dt: number){
  S.now += dt;
  const r = S.run;
  if (!r || S.screen !== "play") return;
  if (r.status === "dead") { if (S.now - S.deadAt > RETRY_MS / 1000) retry(); return; }
  if (r.status === "won") {
    if (S.onWin && S.now - S.wonAt > 0.7) { S.screen = "won"; S.onWin(); }
    return;
  }
  S.acc += dt * 1000;
  let n = 0;
  while (S.acc >= TICK_MS && n++ < 8 && r.status === "play") {
    S.acc -= TICK_MS;
    const before = r.got;
    advance(r);
    afterChange(before);
    if (r.status === "play" && S.buffered) { const t = S.buffered; S.buffered = 0; doSwing(t); }
  }
  const beat = Math.floor(r.tick / r.lv.beat);
  if (beat !== S.lastBeat) { S.lastBeat = beat; if (beat > 0) sfx("beat", beat); }
}

/** game time in fractional ticks, for smooth drawing */
export function tickF(): number { return S.run ? S.run.tick + (S.run.status === "play" ? S.acc / TICK_MS : 0) : 0; }

export function pause(){ if (S.screen === "play" && S.run?.status === "play") S.screen = "paused"; }
export function resume(){ if (S.screen === "paused") S.screen = "play"; }

// ---- progression: the first level of each mode is open; each clear opens the next ---------
export function isDone(id: string): boolean { return !!save.done?.[id]; }
export function isOpen(def: LevelDef, everything: boolean): boolean {
  if (everything) return true;
  const same = LEVELS.filter(l => l.mode === def.mode);
  const i = same.indexOf(def);
  return i <= 0 || isDone(same[i - 1].id);
}
export function nextLevel(def: LevelDef): LevelDef | null {
  const same = LEVELS.filter(l => l.mode === def.mode);
  return same[same.indexOf(def) + 1] || null;
}
