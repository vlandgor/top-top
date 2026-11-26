import type { LevelDef, Mode, Run } from "../core/types";
import { setSound, sfx, soundOn } from "../audio/audio";
import { LEVELS, MODES, levelById, levelsOf } from "../levels/levels";
import { parseLevel } from "../levels/parse";
import { isDone, isOpen, nextLevel, pause, restart, resume, S, startLevel, TICK_MS } from "../game/session";
import { newRun, progress } from "../game/rules";
import { IS_DEV } from "../platform/dev";
import { resetSave, save, writeSave } from "../storage/save";
import { drawPreview } from "../render/draw";
import { ACCENT } from "../render/theme";
import { leaveMatch, M, pauseMatch, restartMatch, resumeMatch } from "../game/match";
import { drawRoomPreview, enterRoom, goLobby, initRoom, syncRoomHud } from "./room";

// ---------------------------------------------------------------------------
// MENUS — one overlay, one screen at a time, plus the in-game HUD.
//   main menu -> game modes (list + details) -> levels of that mode -> play
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

/** the mode chosen on the modes screen; remembered between visits */
let mode: Mode = save.lastMode && MODES.some(m => m.id === save.lastMode) ? save.lastMode : "destination";

export function goMenu(){
  S.screen = "menu"; S.run = null; leaveMatch(); setAccent(ACCENT.destination);
  show("sMenu");
}

// ---- game modes ---------------------------------------------------------------------------
export function goModes(){
  S.screen = "menu"; S.run = null;
  buildModeList(); selectMode(mode);
  show("sModes");
}

function modeStats(m: Mode){
  const lvls = levelsOf(m);
  const cleared = lvls.filter(l => isDone(l.id));
  return {
    cleared: cleared.length, total: lvls.length,
    attempts: lvls.reduce((n, l) => n + (save.attempts?.[l.id] || 0), 0),
    // the sum of best times, once every level of the mode is cleared
    best: cleared.length === lvls.length ? cleared.reduce((n, l) => n + save.done![l.id].ticks, 0) : null,
  };
}

function buildModeList(){
  const list = $("modeList"); list.innerHTML = "";
  for (const m of MODES) {
    const st = modeStats(m.id);
    const b = document.createElement("button");
    b.className = "mbtn"; b.dataset.mode = m.id;
    b.style.setProperty("--c", ACCENT[m.id]);
    b.innerHTML = `<i></i><b>${m.name}</b>${m.wip ? "<em>new</em>" : ""}<small>${st.cleared}/${st.total}</small>`;
    b.onclick = () => { sfx("click"); selectMode(m.id); };
    list.appendChild(b);
  }
}

// the preview: the mode's sample level with its hazards running
let preview: { run: Run; t0: number } | null = null;

function selectMode(m: Mode){
  mode = m; save.lastMode = m; writeSave();
  const info = MODES.find(x => x.id === m)!, st = modeStats(m);
  setAccent(ACCENT[m]);
  $("modeInfo").style.setProperty("--c", ACCENT[m]);
  document.querySelectorAll<HTMLElement>(".mbtn").forEach(b => b.classList.toggle("sel", b.dataset.mode === m));
  $("miTag").textContent = info.wip ? "In progress" : `${st.total} levels`;
  $("miName").textContent = info.name;
  $("miAbout").textContent = info.about;
  $("miChips").innerHTML = features(m).map(f => `<span>${f}</span>`).join("");
  $("miCleared").textContent = `${st.cleared}/${st.total}`;
  $("miAttempts").textContent = String(st.attempts);
  $("miBest").textContent = st.best === null ? "–" : fmtTime(st.best);
  const def = levelById(info.preview);
  preview = def ? { run: newRun(parseLevel(def)), t0: performance.now() / 1000 } : null;
}

/** what you'll meet in a mode's levels, read from the levels themselves */
function features(m: Mode): string[] {
  const lv = levelsOf(m), out: string[] = [];
  if (lv.some(l => l.sentries?.length)) out.push("Sentries");
  const dirs = new Set(lv.flatMap(l => (l.sweeps || []).map(s => s.dir)));
  if (dirs.has("diag") || dirs.has("antidiag")) out.push("Waterfalls");
  if (dirs.has("all")) out.push("Pulses");
  if (dirs.has("down") || dirs.has("up") || dirs.has("left") || dirs.has("right")) out.push("Waves");
  if (m === "survival" || m === "waves") out.push("Timer");
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

/** every frame: the live preview on whichever of the two screens is open */
export function drawPreviews(){
  if (preview && screenOn("sModes")) previewInto("modePreview", preview);
  drawRoomPreview();
}

// ---- levels of one mode: tiles on the left, the selected level and Play on the right --------
/** a thin padlock drawn in the text colour, to match the neon UI (an emoji lock is yellow) */
const LOCK = `<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><rect x="3.5" y="7" width="9" height="7" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>`;

/** the level selected in each mode, so coming back shows the same one */
const chosen: Partial<Record<Mode, string>> = {};

export function goLevels(m: Mode = mode){
  mode = m;
  S.screen = "menu"; S.run = null; setAccent(ACCENT[m]);
  const info = MODES.find(x => x.id === m)!, st = modeStats(m), lvls = levelsOf(m);
  $("lvTitle").textContent = info.name;
  $("lvBlurb").textContent = info.blurb;
  $("lvCleared").textContent = `${st.cleared} / ${st.total} cleared`;
  $("lvBar").style.width = `${(100 * st.cleared) / st.total}%`;
  // the first open level not cleared yet: where the player is up to
  const next = lvls.find(d => !isDone(d.id) && isOpen(d));
  const grid = $("levelGrid"); grid.innerHTML = "";
  lvls.forEach((def, i) => {
    const open = isOpen(def);
    const b = document.createElement("button");
    b.className = "lvl" + (!open ? " locked" : "") + (def === next ? " next" : "");
    b.disabled = !open;                          // locked levels can't be selected
    b.dataset.id = def.id;
    b.innerHTML = (open ? String(i + 1) : LOCK) + (isDone(def.id) ? `<span class="mark">✓</span>` : "");
    b.setAttribute("aria-label", `Level ${i + 1}: ${def.name}`);
    // tap selects; tapping the selected level again plays it
    b.onclick = () => {
      sfx("click");
      if (chosen[m] === def.id && open) play(def); else selectLevel(def);
    };
    grid.appendChild(b);
  });
  const keep = lvls.find(d => d.id === chosen[m]);
  selectLevel(keep || next || lvls[lvls.length - 1]);
  show("sLevels");
  grid.querySelector(".sel")?.scrollIntoView({ block: "nearest" });
}

/** what you have to do, in one line */
function goalText(def: LevelDef): string {
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
  chosen[def.mode] = def.id;
  const lvls = levelsOf(def.mode), i = lvls.indexOf(def), open = isOpen(def), best = save.done?.[def.id];
  const next = lvls.find(d => !isDone(d.id) && isOpen(d));
  document.querySelectorAll<HTMLElement>(".lvl").forEach(b => b.classList.toggle("sel", b.dataset.id === def.id));
  $("liTag").textContent = `Level ${i + 1}` + (best ? " · cleared" : !open ? " · locked" : def === next ? " · up next" : "");
  $("liName").textContent = def.name;
  $("liGoal").textContent = goalText(def);
  $("liChips").innerHTML = levelChips(def).map(c => `<span>${c}</span>`).join("");
  $("liPresses").textContent = best?.presses != null ? String(best.presses) : "–";
  $("liTime").textContent = best ? fmtTime(best.ticks) : "–";
  $("liAttempts").textContent = String(save.attempts?.[def.id] || 0);
  const btn = $<HTMLButtonElement>("bLevelPlay");
  btn.disabled = !open;
  btn.textContent = !open ? `Clear level ${i} first` : best ? "Play again" : "Play";
  btn.onclick = () => { sfx("click"); if (open) play(def); };
}

// ---- playing --------------------------------------------------------------------------------
export function unpause(){
  if (M.active) { resumeMatch(); show(null); return; }
  resume(); if (S.screen === "play") show(null);
}
export function showPause(){
  $("pauseName").textContent = (M.active ? M.def?.name : S.def?.name) || "";
  $("bPauseLevels").textContent = M.active ? "Lobby" : "Levels";
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

/** the Android back button on a menu: one screen back. false on the main menu */
export function back(): boolean {
  if (screenOn("sLevels")) { goModes(); return true; }
  if (screenOn("sModes") || screenOn("sHow") || screenOn("sSet") || screenOn("sRoom")) { goMenu(); return true; }
  if (screenOn("sRoomOver")) { goLobby(); return true; }
  return false;
}

export function initMenus(){
  S.onWin = onWin;
  initRoom();
  on("bPlay", goModes);
  on("bCoop", goLobby);
  on("bRoomBack", goMenu);
  on("bHow", () => show("sHow"));
  on("bHowOk", goMenu);
  on("bSet", () => { ($("optSfx") as HTMLInputElement).checked = soundOn(); show("sSet"); });
  on("bSetOk", goMenu);
  $("optSfx").addEventListener("change", e => { setSound((e.target as HTMLInputElement).checked); writeSave(); });
  on("bReset", () => { if (confirm("Reset all progress?")) resetSave(); });
  on("bModesBack", goMenu);
  on("bModeSelect", () => goLevels(mode));
  on("bLevelsBack", goModes);
  on("pauseBtn", pauseAny);
  on("bResume", unpause);
  on("bRestart", () => {
    if (M.active) { restartMatch(); enterRoom(); return; }
    S.attempt++; restart(); show(null);
  });
  on("bPauseLevels", () => { if (M.active) goLobby(); else goLevels(S.def?.mode); });
  on("bNext", () => { const n = S.def && nextLevel(S.def); if (n) play(n); });
  on("bRetry", () => { S.attempt++; play(S.def!); });
  on("bWinLevels", () => goLevels(S.def?.mode));
  $("version").textContent = `${LEVELS.length} levels · ${IS_DEV ? "dev build" : "v" + __VERSION__}`;
}

declare const __VERSION__: string;
