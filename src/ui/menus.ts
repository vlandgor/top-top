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

// ---------------------------------------------------------------------------
// MENUS — one overlay, one screen at a time, plus the in-game HUD.
//   main menu -> game modes (list + details) -> levels of that mode -> play
// ---------------------------------------------------------------------------
export function $<T extends HTMLElement = HTMLElement>(id: string): T { return document.getElementById(id) as T; }

function show(id: string | null){
  document.querySelectorAll(".screen").forEach(s => s.classList.toggle("on", s.id === id));
  $("ui").classList.toggle("on", !!id);
  const inLevel = !id || id === "sPause" || id === "sWin";
  $("bLeft").classList.toggle("off", !inLevel);
  $("bRight").classList.toggle("off", !inLevel);
  $("hud").classList.toggle("off", !inLevel);
}
const on = (id: string, fn: () => void) => $(id).addEventListener("click", () => { sfx("click"); fn(); });
export function screenOn(id: string): boolean { return $(id).classList.contains("on"); }

function setAccent(c: string){ document.documentElement.style.setProperty("--accent", c); }
const fmtTime = (ticks: number) => (ticks * TICK_MS / 1000).toFixed(1) + "s";

/** the mode chosen on the modes screen; remembered between visits */
let mode: Mode = save.lastMode && MODES.some(m => m.id === save.lastMode) ? save.lastMode : "destination";

export function goMenu(){
  S.screen = "menu"; S.run = null; setAccent(ACCENT.destination);
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

/** every frame while the modes screen is open */
export function drawModePreview(){
  if (!preview || !screenOn("sModes")) return;
  const cv = $<HTMLCanvasElement>("modePreview");
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = cv.clientWidth, h = cv.clientHeight;
  if (!w || !h) return;
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  const c = cv.getContext("2d")!;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawPreview(c, w, h, preview.run, performance.now() / 1000 - preview.t0, TICK_MS);
}

// ---- levels of one mode -------------------------------------------------------------------
export function goLevels(m: Mode = mode){
  mode = m;
  S.screen = "menu"; S.run = null; setAccent(ACCENT[m]);
  const info = MODES.find(x => x.id === m)!, st = modeStats(m);
  $("lvTitle").textContent = info.name;
  $("lvProgress").textContent = `${st.cleared}/${st.total} cleared`;
  const grid = $("levelGrid"); grid.innerHTML = "";
  levelsOf(m).forEach((def, i) => {
    const b = document.createElement("button");
    const best = save.done?.[def.id], open = isOpen(def, IS_DEV);
    b.className = "lvl" + (best ? " done" : "");
    b.disabled = !open;
    const sub = best ? `${best.presses ?? "–"} presses · ${fmtTime(best.ticks)}` : open ? "Not cleared" : "Clear the one before";
    b.innerHTML = `<b>${i + 1}</b><strong>${def.name}</strong><small>${sub}</small>`;
    b.onclick = () => { sfx("click"); play(def); };
    grid.appendChild(b);
  });
  show("sLevels");
}

// ---- playing --------------------------------------------------------------------------------
export function unpause(){ resume(); if (S.screen === "play") show(null); }
export function showPause(){ $("pauseName").textContent = S.def?.name || ""; show("sPause"); }

export function play(def: LevelDef){
  startLevel(def);
  setAccent(ACCENT[def.mode]);
  $("hMode").textContent = MODES.find(m => m.id === def.mode)!.name;
  $("hName").textContent = def.name;
  $("hGoalLabel").textContent = def.mode === "survival" ? "survive" : def.mode === "destination" ? "time" : "lights";
  show(null);
  const first = (save.attempts?.[def.id] || 0) === 0;
  toast(first && def.hint ? def.hint : "");
}

let toastTimer = 0;
function toast(text: string){
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
  const r = S.run; if (!r) return;
  const [a, b] = progress(r);
  const v = r.lv.def.mode === "survival"
    ? Math.max(0, (b - a) * r.lv.beat * TICK_MS / 1000).toFixed(0) + "s"
    : r.lv.def.mode === "destination" ? fmtTime(r.tick) : `${a}/${b}`;
  const el = $("hGoalVal"); if (el.textContent !== v) el.textContent = v;
  // each button shows which way its boot turns right now; hitting the edge flips both
  for (const [id, cw] of [["bLeft", r.cw[0]], ["bRight", r.cw[1]]] as const) {
    const sp = $(id).querySelector("span")!, g = cw ? "↻" : "↺";
    if (sp.textContent !== g) sp.textContent = g;
  }
  const at = $("attempt"), label = `Attempt ${S.attempt}`;
  if (at.textContent !== label) at.textContent = label;
  at.classList.toggle("on", S.screen === "play" && r.tick < 12 && S.attempt > 1);
}

/** the Android back button on a menu: one screen back. false on the main menu */
export function back(): boolean {
  if (screenOn("sLevels")) { goModes(); return true; }
  if (screenOn("sModes") || screenOn("sHow") || screenOn("sSet")) { goMenu(); return true; }
  return false;
}

export function initMenus(){
  S.onWin = onWin;
  on("bPlay", goModes);
  on("bHow", () => show("sHow"));
  on("bHowOk", goMenu);
  on("bSet", () => { ($("optSfx") as HTMLInputElement).checked = soundOn(); show("sSet"); });
  on("bSetOk", goMenu);
  $("optSfx").addEventListener("change", e => { setSound((e.target as HTMLInputElement).checked); writeSave(); });
  on("bReset", () => { if (confirm("Reset all progress?")) resetSave(); });
  on("bModesBack", goMenu);
  on("bModeSelect", () => goLevels(mode));
  on("bLevelsBack", goModes);
  on("pauseBtn", () => { pause(); if (S.screen === "paused") showPause(); });
  on("bResume", unpause);
  on("bRestart", () => { S.attempt++; restart(); show(null); });
  on("bPauseLevels", () => goLevels(S.def?.mode));
  on("bNext", () => { const n = S.def && nextLevel(S.def); if (n) play(n); });
  on("bRetry", () => { S.attempt++; play(S.def!); });
  on("bWinLevels", () => goLevels(S.def?.mode));
  $("version").textContent = `${LEVELS.length} levels · ${IS_DEV ? "dev build" : "v" + __VERSION__}`;
}

declare const __VERSION__: string;
