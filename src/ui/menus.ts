import type { LevelDef, Mode, Run } from "../core/types";
import { setSound, sfx, soundOn } from "../audio/audio";
import { LEVELS, MODES, levelById, levelsOf } from "../levels/levels";
import { parseLevel } from "../levels/parse";
import { roomsOf } from "../levels/rooms";
import { isDone, isOpen, nextLevel, pause, restart, resume, S, startLevel, TICK_MS } from "../game/session";
import { newRun, progress } from "../game/rules";
import { IS_DEV } from "../platform/dev";
import { resetSave, save, writeSave } from "../storage/save";
import { drawPreview } from "../render/draw";
import { ACCENT } from "../render/theme";
import { leaveMatch, M, pauseMatch, restartMatch, resumeMatch } from "../game/match";
import { enterRoom, goLobby, initRoom, roomBest, roomFacts, roomGoal, roomLevels, startRoom, syncRoomHud, teamChip, teamSize } from "./room";

// ---------------------------------------------------------------------------
// MENUS — one overlay, one screen at a time, plus the in-game HUD.
//   solo:  main menu -> game modes (list + details) -> levels of that mode -> play
//   co-op: main menu -> lobby (room.ts) -> game modes -> levels -> play
// The game modes and levels screens are shared: in co-op they list the rooms (src/levels/
// rooms.ts) instead of the solo levels, explain each mode's co-op rule, show the team in the
// header, and Play starts a room with the lobby's team.
// ---------------------------------------------------------------------------
export function $<T extends HTMLElement = HTMLElement>(id: string): T { return document.getElementById(id) as T; }

export function show(id: string | null){
  document.querySelectorAll(".screen").forEach(s => s.classList.toggle("on", s.id === id));
  $("ui").classList.toggle("on", !!id);
  const inLevel = !id || id === "sPause" || id === "sWin";
  $("bLeft").classList.toggle("off", !inLevel);
  $("bRight").classList.toggle("off", !inLevel);
  $("hud").classList.toggle("off", !inLevel);
}
const on = (id: string, fn: () => void) => $(id).addEventListener("click", () => { sfx("click"); fn(); });
export function screenOn(id: string): boolean { return $(id).classList.contains("on"); }

export function setAccent(c: string){ document.documentElement.style.setProperty("--accent", c); }
const fmtTime = (ticks: number) => (ticks * TICK_MS / 1000).toFixed(1) + "s";

// ---- solo or co-op: what the shared screens show -------------------------------------------
/** whether the modes / levels screens are showing co-op rooms */
let coop = false;
const levelsFor = (m: Mode): LevelDef[] => coop ? roomsOf(m) : levelsOf(m);
/** cleared: solo, ever; co-op, by a team of the lobby's current size */
const done = (d: LevelDef): boolean => coop ? roomBest(d) !== undefined : isDone(d.id);
/** solo levels open one by one; every room is open */
const open = (d: LevelDef): boolean => coop || isOpen(d);
/** co-op has its own mode only among the modes that have rooms */
const playable = (m: Mode): boolean => levelsFor(m).length > 0;

/** the mode chosen on the modes screen, solo and co-op; remembered between visits */
let soloMode: Mode = save.lastMode && MODES.some(m => m.id === save.lastMode) ? save.lastMode : "destination";
let coopMode: Mode = roomsOf(soloMode).length ? soloMode : (MODES.find(m => roomsOf(m.id).length)?.id ?? "collect");
const curMode = () => coop ? coopMode : soloMode;

function setTeamChips(){
  for (const id of ["modesTeam", "lvTeam"]) {
    $(id).classList.toggle("on", coop);
    $(id).innerHTML = coop ? teamChip() : "";
  }
}

export function goMenu(){
  S.screen = "menu"; S.run = null; leaveMatch(); setAccent(ACCENT.destination);
  show("sMenu");
}

// ---- game modes ---------------------------------------------------------------------------
/** the game modes screen; `c` switches it to solo or co-op, left out it stays as it was */
export function goModes(c: boolean = coop){
  coop = c;
  S.screen = "menu"; S.run = null;
  setTeamChips();
  buildModeList(); selectMode(curMode());
  show("sModes");
}

function modeStats(m: Mode){
  const lvls = levelsFor(m);
  const cleared = lvls.filter(done);
  const ticks = (d: LevelDef) => coop ? roomBest(d)! : save.done![d.id].ticks;
  return {
    cleared: cleared.length, total: lvls.length,
    attempts: lvls.reduce((n, l) => n + (save.attempts?.[l.id] || 0), 0),
    // the sum of best times, once every level of the mode is cleared
    best: lvls.length && cleared.length === lvls.length ? cleared.reduce((n, l) => n + ticks(l), 0) : null,
  };
}

function buildModeList(){
  const list = $("modeList"); list.innerHTML = "";
  for (const m of MODES) {
    const st = modeStats(m.id);
    const b = document.createElement("button");
    b.className = "mbtn"; b.dataset.mode = m.id;
    b.style.setProperty("--c", ACCENT[m.id]);
    const tag = coop ? (playable(m.id) ? "" : "<em>soon</em>") : m.wip ? "<em>new</em>" : "";
    b.innerHTML = `<i></i><b>${m.name}</b>${tag}<small>${st.total ? `${st.cleared}/${st.total}` : ""}</small>`;
    b.onclick = () => { sfx("click"); selectMode(m.id); };
    list.appendChild(b);
  }
}

// the preview: the mode's sample level with its hazards running
let preview: { run: Run; t0: number } | null = null;

function selectMode(m: Mode){
  if (coop) coopMode = m; else { soloMode = m; save.lastMode = m; writeSave(); }
  const info = MODES.find(x => x.id === m)!, st = modeStats(m);
  setAccent(ACCENT[m]);
  $("modeInfo").style.setProperty("--c", ACCENT[m]);
  document.querySelectorAll<HTMLElement>(".mbtn").forEach(b => b.classList.toggle("sel", b.dataset.mode === m));
  $("miTag").textContent = coop
    ? (st.total ? `Co-op · ${st.total} ${st.total === 1 ? "room" : "rooms"}` : "Co-op · coming soon")
    : info.wip ? "In progress" : `${st.total} levels`;
  $("miName").textContent = info.name;
  $("miAbout").textContent = coop ? info.coop.about : info.about;
  $("miChips").innerHTML = features(m).map(f => `<span>${f}</span>`).join("");
  $("miCleared").textContent = st.total ? `${st.cleared}/${st.total}` : "–";
  // co-op keeps no attempts; the second stat is the team instead
  $("miAttempts").textContent = coop ? String(teamSize()) : String(st.attempts);
  $("miAttemptsL").textContent = coop ? "players" : "attempts";
  $("miBest").textContent = st.best === null ? "–" : fmtTime(st.best);
  const btn = $<HTMLButtonElement>("bModeSelect");
  btn.disabled = coop && !playable(m);
  btn.textContent = btn.disabled ? "Coming soon" : "Select";
  // the mode's first room in co-op; the solo sample level otherwise, and for modes without rooms
  const def = (coop && levelsFor(m)[0]) || levelById(info.preview);
  preview = def ? { run: newRun(parseLevel(def)), t0: performance.now() / 1000 } : null;
}

/** what you'll meet in a mode's levels, read from the levels themselves */
function features(m: Mode): string[] {
  const lv = levelsFor(m).length ? levelsFor(m) : levelsOf(m), out: string[] = [];
  if (lv.some(l => l.sentries?.length)) out.push("Sentries");
  const dirs = new Set(lv.flatMap(l => (l.sweeps || []).map(s => s.dir)));
  if (dirs.has("diag") || dirs.has("antidiag")) out.push("Waterfalls");
  if (dirs.has("all")) out.push("Pulses");
  if (dirs.has("down") || dirs.has("up") || dirs.has("left") || dirs.has("right")) out.push("Waves");
  if (m === "survival" || m === "waves" || coop) out.push("Timer");
  if (coop) out.push("Shared lives");
  return out;
}

/** a canvas drawn at its CSS size, sharp on high-density screens */
export function previewInto(id: string, p: { run: Run; t0: number }){
  const cv = $<HTMLCanvasElement>(id);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = cv.clientWidth, h = cv.clientHeight;
  if (!w || !h) return;
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  const c = cv.getContext("2d")!;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawPreview(c, w, h, p.run, performance.now() / 1000 - p.t0, TICK_MS);
}

/** every frame: the live preview on the modes screen */
export function drawPreviews(){
  if (preview && screenOn("sModes")) previewInto("modePreview", preview);
}

// ---- levels of one mode: tiles on the left, the selected level and Play on the right --------
/** a thin padlock drawn in the text colour, to match the neon UI (an emoji lock is yellow) */
const LOCK = `<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><rect x="3.5" y="7" width="9" height="7" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>`;

/** the level selected in each mode, solo and co-op, so coming back shows the same one */
const chosenSolo: Partial<Record<Mode, string>> = {}, chosenCoop: Partial<Record<Mode, string>> = {};
const chosen = () => coop ? chosenCoop : chosenSolo;

/** the levels of a mode; `c` switches to solo or co-op, left out it stays as it was */
export function goLevels(m: Mode = curMode(), c: boolean = coop){
  coop = c;
  if (coop) coopMode = m; else soloMode = m;
  S.screen = "menu"; S.run = null; setAccent(ACCENT[m]);
  setTeamChips();
  const info = MODES.find(x => x.id === m)!, st = modeStats(m), lvls = levelsFor(m);
  $("lvTitle").textContent = info.name;
  $("lvBlurb").textContent = coop ? info.coop.blurb : info.blurb;
  $("lvCleared").textContent = `${st.cleared} / ${st.total} cleared`;
  $("lvBar").style.width = `${st.total ? (100 * st.cleared) / st.total : 0}%`;
  // the first open level not cleared yet: where the player is up to
  const next = lvls.find(d => !done(d) && open(d));
  const grid = $("levelGrid"); grid.innerHTML = "";
  lvls.forEach((def, i) => {
    const isOpenNow = open(def);
    const b = document.createElement("button");
    b.className = "lvl" + (!isOpenNow ? " locked" : "") + (def === next ? " next" : "");
    b.disabled = !isOpenNow;                     // locked levels can't be selected
    b.dataset.id = def.id;
    b.innerHTML = (isOpenNow ? String(i + 1) : LOCK) + (done(def) ? `<span class="mark">✓</span>` : "");
    b.setAttribute("aria-label", `Level ${i + 1}: ${def.name}`);
    // tap selects; tapping the selected level again plays it
    b.onclick = () => {
      sfx("click");
      if (chosen()[m] === def.id && isOpenNow) playAny(def); else selectLevel(def);
    };
    grid.appendChild(b);
  });
  const keep = lvls.find(d => d.id === chosen()[m]);
  selectLevel(keep || next || lvls[lvls.length - 1]);
  show("sLevels");
  grid.querySelector(".sel")?.scrollIntoView({ block: "nearest" });
}

/** what you have to do, in one line */
function goalText(def: LevelDef): string {
  if (coop) return roomGoal(def);
  const lights = def.map.join("").replace(/[^o1-9]/g, "").length;
  switch (def.mode) {
    case "destination": return "Walk the boots onto the glowing goal.";
    case "collect": return lights === 2 ? "Pick up both lights, in any order." : `Pick up all ${lights} lights, in any order.`;
    case "sequence": return `Pick up the ${lights} numbered lights in order, 1 to ${lights}.`;
    case "survival": return `Stay alive for ${Math.round((def.survive || 0) * (def.beat || 4) * TICK_MS / 1000)} seconds.`;
    case "waves": return `Collect ${def.need} lights left behind by the waves.`;
  }
}

/** what is in a level: its hazards, board size and tempo */
function levelChips(def: LevelDef): string[] {
  const out: string[] = [];
  if (coop && def.mode === "collect") out.push(`${roomFacts(def).lights} lights`);
  const n = def.sentries?.length || 0;
  if (n) out.push(n === 1 ? "1 sentry" : `${n} sentries`);
  for (const sw of def.sweeps || []) {
    const name = sw.dir === "all" ? "pulse" : sw.dir === "diag" || sw.dir === "antidiag" ? "waterfall" : "wave";
    if (!out.includes(name)) out.push(name);
  }
  if (!out.length) out.push("no hazards");
  out.push(`${def.map[0].length}×${def.map.length}`);
  out.push(`${Math.round(60000 / ((def.beat || 4) * TICK_MS))} bpm`);
  return out;
}

function selectLevel(def: LevelDef){
  chosen()[def.mode] = def.id;
  const lvls = levelsFor(def.mode), i = lvls.indexOf(def), isOpenNow = open(def), cleared = done(def);
  const next = lvls.find(d => !done(d) && open(d));
  document.querySelectorAll<HTMLElement>(".lvl").forEach(b => b.classList.toggle("sel", b.dataset.id === def.id));
  $("liTag").textContent = `${coop ? "Room" : "Level"} ${i + 1}` + (cleared ? " · cleared" : !isOpenNow ? " · locked" : def === next ? " · up next" : "");
  $("liName").textContent = def.name;
  $("liGoal").textContent = goalText(def);
  $("liChips").innerHTML = levelChips(def).map(c => `<span>${c}</span>`).join("");
  const btn = $<HTMLButtonElement>("bLevelPlay");
  if (coop) {
    // a room's stats are the team's: its shared lives, its best clear, its size
    const best = roomBest(def);
    $("liPresses").textContent = String(roomFacts(def).lives); $("liPressesL").textContent = "team lives";
    $("liTime").textContent = best === undefined ? "–" : def.mode === "survival" ? "✓" : fmtTime(best);
    $("liTimeL").textContent = def.mode === "survival" ? "survived" : "team best";
    $("liAttempts").textContent = String(teamSize()); $("liAttemptsL").textContent = "players";
    btn.disabled = false;
    btn.textContent = `Play · ${teamSize()} players`;
  } else {
    const best = save.done?.[def.id];
    $("liPresses").textContent = best?.presses != null ? String(best.presses) : "–"; $("liPressesL").textContent = "presses";
    $("liTime").textContent = best ? fmtTime(best.ticks) : "–"; $("liTimeL").textContent = "best time";
    $("liAttempts").textContent = String(save.attempts?.[def.id] || 0); $("liAttemptsL").textContent = "attempts";
    btn.disabled = !isOpenNow;
    btn.textContent = !isOpenNow ? `Clear level ${i} first` : best ? "Play again" : "Play";
  }
  btn.onclick = () => { sfx("click"); if (isOpenNow) playAny(def); };
}

/** Play on the levels screen: a solo level, or a room with the lobby's team */
function playAny(def: LevelDef){ if (coop) startRoom(def); else play(def); }

// ---- playing --------------------------------------------------------------------------------
export function unpause(){
  if (M.active) { resumeMatch(); show(null); return; }
  resume(); if (S.screen === "play") show(null);
}
export function showPause(){
  $("pauseName").textContent = (M.active ? M.def?.name : S.def?.name) || "";
  show("sPause");
}
/** pause whichever game is running: the solo level or the co-op room */
export function pauseAny(){
  if (M.active) { pauseMatch(); if (M.phase === "paused") showPause(); return; }
  pause(); if (S.screen === "paused") showPause();
}

export function play(def: LevelDef){
  startLevel(def);
  setAccent(ACCENT[def.mode]);
  $("hMode").textContent = MODES.find(m => m.id === def.mode)!.name;
  $("hName").textContent = def.name;
  $("hGoalLabel").textContent = def.mode === "survival" ? "survive" : def.mode === "destination" ? "time" : "lights";
  $("hTeam").classList.remove("on");
  show(null);
  const first = (save.attempts?.[def.id] || 0) === 0;
  toast(first && def.hint ? def.hint : "");
}

let toastTimer = 0;
export function toast(text: string){
  const t = $("toast");
  t.textContent = text; t.classList.toggle("on", !!text);
  clearTimeout(toastTimer);
  if (text) toastTimer = window.setTimeout(() => t.classList.remove("on"), 6000);
}

function onWin(){
  const r = S.run!, def = S.def!;
  $("winMode").textContent = MODES.find(m => m.id === def.mode)!.name;
  $("winName").textContent = def.name;
  $("winSwings").textContent = String(r.moves);
  $("winTime").textContent = fmtTime(r.tick);
  $("winAttempts").textContent = String(S.attempt);
  const next = nextLevel(def);
  $("bNext").style.display = next ? "" : "none";
  show("sWin");
}

/** HUD text, every frame while playing */
export function syncHud(){
  if (M.active) { syncRoomHud(); return; }
  const r = S.run; if (!r) return;
  const [a, b] = progress(r);
  const v = r.lv.def.mode === "survival"
    ? Math.max(0, (b - a) * r.lv.beat * TICK_MS / 1000).toFixed(0) + "s"
    : r.lv.def.mode === "destination" ? fmtTime(r.tick) : `${a}/${b}`;
  const el = $("hGoalVal"); if (el.textContent !== v) el.textContent = v;
  const at = $("attempt"), label = `Attempt ${S.attempt}`;
  if (at.textContent !== label) at.textContent = label;
  at.classList.toggle("on", S.screen === "play" && r.tick < 12 && S.attempt > 1);
}

/** back from the game modes screen: to the lobby in co-op, the main menu solo */
function modesBack(){ if (coop) goLobby(); else goMenu(); }

/** the Android back button on a menu: one screen back. false on the main menu */
export function back(): boolean {
  if (screenOn("sLevels")) { goModes(); return true; }
  if (screenOn("sModes")) { modesBack(); return true; }
  if (screenOn("sHow") || screenOn("sSet") || screenOn("sRoom")) { goMenu(); return true; }
  if (screenOn("sRoomOver")) { roomLevels(); return true; }
  return false;
}

export function initMenus(){
  S.onWin = onWin;
  initRoom();
  on("bPlay", () => goModes(false));
  on("bCoop", goLobby);
  on("bRoomBack", goMenu);
  on("bHow", () => show("sHow"));
  on("bHowOk", goMenu);
  on("bSet", () => { ($("optSfx") as HTMLInputElement).checked = soundOn(); show("sSet"); });
  on("bSetOk", goMenu);
  $("optSfx").addEventListener("change", e => { setSound((e.target as HTMLInputElement).checked); writeSave(); });
  on("bReset", () => { if (confirm("Reset all progress?")) resetSave(); });
  on("bModesBack", modesBack);
  on("bModeSelect", () => { if (!coop || playable(curMode())) goLevels(curMode()); });
  on("bLevelsBack", () => goModes());
  on("pauseBtn", pauseAny);
  on("bResume", unpause);
  on("bRestart", () => {
    if (M.active) { restartMatch(); enterRoom(); return; }
    S.attempt++; restart(); show(null);
  });
  on("bPauseLevels", () => { if (M.active) roomLevels(); else goLevels(S.def?.mode, false); });
  on("bNext", () => { const n = S.def && nextLevel(S.def); if (n) play(n); });
  on("bRetry", () => { S.attempt++; play(S.def!); });
  on("bWinLevels", () => goLevels(S.def?.mode, false));
  $("version").textContent = `${LEVELS.length} levels · ${IS_DEV ? "dev build" : "v" + __VERSION__}`;
}

declare const __VERSION__: string;
