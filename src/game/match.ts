import type { Boot, LevelDef, Level } from "../core/types";
import { sfx } from "../audio/audio";
import { parseLevel } from "../levels/parse";
import { forPlayers } from "../levels/rooms";
import { save, writeSave } from "../storage/save";
import { Bot, SKILLS, type SkillId } from "./bot";
import { advanceRoom, canPressPair, newRoom, pressPair, type Room } from "./room";
import { TICK_MS, type SwingAnim } from "./session";

// ---------------------------------------------------------------------------
// MATCH — a live co-op room, the way session.ts is a live solo level: real time, the
// countdown, input buffering, effects and the result. Rendering and the room UI read M; only
// this file changes it.
//
// Who steers each pair is its slot. "you" is the person holding this phone; "bot" is a Bot.
// Each tick every bot gets one decision, and the local player's presses land the moment the
// finger does, all through the same pressPair(). Online play adds a "remote" kind whose
// presses arrive from the network for a given tick; the rules don't need to change for it.
// ---------------------------------------------------------------------------

export type SlotKind = "you" | "bot" | "open";
export interface Slot { kind: SlotKind; skill: SkillId }

/** each player's colour, in slot order. The local player is always the first, in the game's teal */
export const PLAYER_COLORS = ["#19e3c8", "#ffd23f", "#ff5ce1", "#8dff5a"];
export const COUNTDOWN_S = 3;
/** seconds the result shows on the board before the results screen */
const OVER_S = 0.9;

export type Phase = "count" | "play" | "paused" | "over";

export const M = {
  active: false,
  phase: "count" as Phase,
  def: null as LevelDef | null,
  lv: null as Level | null,
  room: null as Room | null,
  /** the filled slots, in pair order */
  slots: [] as Slot[],
  bots: [] as (Bot | null)[],
  /** which pair is the local player's */
  you: 0,
  seed: 0,
  acc: 0,
  now: 0,
  /** when the current phase started (seconds) */
  phaseAt: 0,
  buffered: 0 as 0 | 1 | 2,
  anims: [] as (SwingAnim | null)[],
  pickedAt: new Map<number, number>(),
  /** seconds each pair last died / came back, for the effects */
  diedAt: [] as number[],
  spawnAt: [] as number[],
  /** called once the result has shown on the board */
  onOver: null as null | (() => void),
};

export function startMatch(def: LevelDef, slots: Slot[]){
  M.slots = slots.filter(s => s.kind !== "open");
  M.def = def; M.lv = parseLevel(forPlayers(def, M.slots.length));
  M.you = M.slots.findIndex(s => s.kind === "you");
  M.seed = (Math.random() * 2 ** 31) | 0;
  M.active = true;
  restartMatch();
}

export function restartMatch(){
  const lv = M.lv!;
  M.room = newRoom(lv, M.slots.length);
  M.bots = M.slots.map((s, i) => s.kind === "bot" ? new Bot(i, SKILLS[s.skill], M.seed + i * 7919) : null);
  M.acc = 0; M.buffered = 0; M.pickedAt.clear();
  M.anims = M.slots.map(() => null);
  M.diedAt = M.slots.map(() => -9); M.spawnAt = M.slots.map(() => -9);
  setPhase("count");
}

export function leaveMatch(){ M.active = false; M.room = null; }

function setPhase(p: Phase){ M.phase = p; M.phaseAt = M.now; }

/** the local player pressed a boot's button */
export function matchInput(who: Boot){
  const r = M.room;
  if (!M.active || M.phase !== "play" || !r || r.status !== "play" || M.you < 0) return;
  if (canPressPair(r, M.you)) doPress(M.you, who);
  else if (r.pairs[M.you].alive) M.buffered = who === 0 ? 1 : 2;
}

function doPress(i: number, who: Boot){
  const r = M.room!, p = r.pairs[i];
  const pivot = { ...p.boots[1 - who] }, from = { ...p.boots[who] };
  track(() => pressPair(r, i, who));
  if (p.lastMoveTick !== r.tick) return;
  const back = p.last?.result === "back";
  M.anims[i] = { t0: M.now, idx: who, pivot, from, to: { ...p.boots[who] }, back };
  if (i === M.you) sfx(back ? "bump" : who ? "stepR" : "stepL");     // only your own steps click
}

/** run a change to the room and turn what it did into effects and sounds */
function track(change: () => void){
  const r = M.room!, got = r.got, alive = r.pairs.map(p => p.alive);
  change();
  if (r.got > got) {
    r.taken.forEach((t, i) => { if (t && !M.pickedAt.has(i)) M.pickedAt.set(i, M.now); });
    sfx("pick", r.got);
  }
  r.pairs.forEach((p, i) => {
    if (alive[i] && !p.alive) { M.diedAt[i] = M.now; M.anims[i] = null; if (i === M.you) M.buffered = 0; sfx("die"); }
    if (!alive[i] && p.alive) M.spawnAt[i] = M.now;
  });
  if (r.status !== "play" && M.phase === "play") {
    setPhase("over");
    if (r.status === "won") { sfx("win"); recordWin(); }
  }
}

/** every bot's decision for the current tick */
function botsTurn(){
  const r = M.room!;
  M.bots.forEach((b, i) => {
    if (!b || r.status !== "play") return;
    const a = b.act(r, M.bots);
    if (a) doPress(i, a === 1 ? 0 : 1);
  });
}

/** advance real time; called every frame with seconds elapsed */
export function updateMatch(dt: number){
  M.now += dt;
  const r = M.room;
  if (!M.active || !r) return;
  if (M.phase === "count") {
    if (M.now - M.phaseAt >= COUNTDOWN_S) { setPhase("play"); sfx("beat", 0); botsTurn(); }
    return;
  }
  if (M.phase === "over") {
    if (M.onOver && M.now - M.phaseAt > OVER_S) { const f = M.onOver; M.active = false; f(); }
    return;
  }
  if (M.phase !== "play") return;
  M.acc += dt * 1000;
  let n = 0;
  while (M.acc >= TICK_MS && n++ < 8 && r.status === "play") {
    M.acc -= TICK_MS;
    const beat = Math.floor(r.tick / r.lv.beat);
    track(() => advanceRoom(r));
    if (r.status !== "play") break;
    if (Math.floor(r.tick / r.lv.beat) !== beat) sfx("beat", beat + 1);
    botsTurn();
    if (M.buffered && canPressPair(r, M.you)) { const b = M.buffered; M.buffered = 0; doPress(M.you, b === 1 ? 0 : 1); }
  }
}

/** game time in fractional ticks, for smooth drawing */
export function matchTickF(): number {
  const r = M.room; if (!r) return 0;
  return r.tick + (M.phase === "play" && r.status === "play" ? M.acc / TICK_MS : 0);
}

export function pauseMatch(){ if (M.active && (M.phase === "play" || M.phase === "count")) setPhase("paused"); }
/** resuming always counts in again, so nobody is caught mid-step */
export function resumeMatch(){ if (M.active && M.phase === "paused") setPhase("count"); }

/** the team's best clear of a room, per player count */
export const bestKey = (id: string, players: number) => `${id}/${players}`;
function recordWin(){
  const k = bestKey(M.def!.id, M.slots.length), t = M.room!.tick;
  save.roomBest = save.roomBest || {};
  if (!save.roomBest[k] || t < save.roomBest[k]) { save.roomBest[k] = t; writeSave(); }
}
