import type { LevelDef } from "../core/types";
import { setSound, sfx, soundOn } from "../audio/audio";
import { LEVELS, MODES, levelsOf } from "../levels/levels";
import { isDone, isOpen, nextLevel, pause, restart, resume, S, startLevel, TICK_MS } from "../game/session";
import { progress } from "../game/rules";
import { IS_DEV } from "../platform/dev";
import { resetSave, save, writeSave } from "../storage/save";
import { ACCENT } from "../render/theme";

// ---------------------------------------------------------------------------
// MENUS — one overlay, one screen at a time, plus the in-game HUD.
// ---------------------------------------------------------------------------
export function $<T extends HTMLElement = HTMLElement>(id: string): T { return document.getElementById(id) as T; }

function show(id: string | null){
  document.querySelectorAll(".screen").forEach(s => s.classList.toggle("on", s.id === id));
  $("ui").classList.toggle("on", !!id);
  const inLevel = !id || id === "sPause" || id === "sWin";
  $("pads").classList.toggle("off", !inLevel);
  $("hud").classList.toggle("off", !inLevel);
}
const on = (id: string, fn: () => void) => $(id).addEventListener("click", () => { sfx("click"); fn(); });

function setAccent(c: string){ document.documentElement.style.setProperty("--accent", c); }

export function goMenu(){
  S.screen = "menu"; S.run = null; setAccent(ACCENT.destination);
  show("sMenu");
}
export function goLevels(){
  S.screen = "menu"; S.run = null; setAccent(ACCENT.destination);
  buildLevels(); show("sLevels");
}
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

function buildLevels(){
  const list = $("levelList"); list.innerHTML = "";
  for (const m of MODES) {
    const sec = document.createElement("div");
    sec.className = "mode"; sec.style.setProperty("--c", ACCENT[m.id]);
    sec.innerHTML = `<h3>${m.name}${m.id === "waves" ? "<em>in progress</em>" : ""}</h3><p>${m.blurb}</p><div class="lvls"></div>`;
    const grid = sec.querySelector(".lvls")!;
    levelsOf(m.id).forEach((def, i) => {
      const b = document.createElement("button");
      b.className = "lvl" + (isDone(def.id) ? " done" : "");
      b.disabled = !isOpen(def, IS_DEV);
      b.innerHTML = `<b>${i + 1}</b><small>${def.name}</small>`;
      b.onclick = () => { sfx("click"); play(def); };
      grid.appendChild(b);
    });
    list.appendChild(sec);
  }
}

function onWin(){
  const r = S.run!, def = S.def!;
  $("winMode").textContent = MODES.find(m => m.id === def.mode)!.name;
  $("winName").textContent = def.name;
  $("winSwings").textContent = String(r.moves);
  $("winTime").textContent = (r.tick * TICK_MS / 1000).toFixed(1) + "s";
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
    : r.lv.def.mode === "destination" ? (r.tick * TICK_MS / 1000).toFixed(1) + "s" : `${a}/${b}`;
  const el = $("hGoalVal"); if (el.textContent !== v) el.textContent = v;
  const at = $("attempt"), label = `Attempt ${S.attempt}`;
  if (at.textContent !== label) at.textContent = label;
  at.classList.toggle("on", S.screen === "play" && r.tick < 12 && S.attempt > 1);
}

export function initMenus(){
  S.onWin = onWin;
  on("bPlay", goLevels);
  on("bHow", () => show("sHow"));
  on("bHowOk", goMenu);
  on("bSet", () => { ($("optSfx") as HTMLInputElement).checked = soundOn(); show("sSet"); });
  on("bSetOk", goMenu);
  $("optSfx").addEventListener("change", e => { setSound((e.target as HTMLInputElement).checked); writeSave(); });
  on("bReset", () => { if (confirm("Reset all progress?")) resetSave(); });
  on("bLevelsBack", goMenu);
  on("pauseBtn", () => { pause(); if (S.screen === "paused") showPause(); });
  on("bResume", unpause);
  on("bRestart", () => { S.attempt++; restart(); show(null); });
  on("bPauseLevels", goLevels);
  on("bNext", () => { const n = S.def && nextLevel(S.def); if (n) play(n); });
  on("bRetry", () => { S.attempt++; play(S.def!); });
  on("bWinLevels", goLevels);
  $("version").textContent = `${LEVELS.length} levels · ${IS_DEV ? "dev build" : "v" + __VERSION__}`;
}

declare const __VERSION__: string;
