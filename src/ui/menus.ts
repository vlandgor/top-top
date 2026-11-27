import type { LevelDef, Mode, Run } from "../core/types";
import { sfx } from "../audio/audio";
import { MODES, levelById, levelsOf } from "../levels/levels";
import { parseLevel } from "../levels/parse";
import { roomsOf } from "../levels/rooms";
import { isDone, isOpen, nextLevel, pause, restart, resume, S, startLevel, TICK_MS } from "../game/session";
import { newRun, progress } from "../game/rules";
import { save, writeSave } from "../storage/save";
import { drawLobbyFloor, drawPreview, drawSkinThumb } from "../render/draw";
import { mySkin } from "../render/skins";
import { ACCENT } from "../render/theme";
import { leaveMatch, M, PLAYER_COLORS, pauseMatch, restartMatch, resumeMatch } from "../game/match";
import { drawBoots, enterBoots, initBoots } from "./skins";
import { drawSettings, enterSettings, onLanguage } from "./settings";
import { drawHowTo, initHowTo, openHowTo } from "./howto";
import { levelHint, levelName, t, tn } from "../i18n";
import { dailyBest, dailyStreak, hoursToNext, onDailyReady, todaysDaily } from "../game/daily";
import { dailyId, dayKey, isDaily } from "../levels/daily";
import { drawLobby, enterRoom, goLobby, initRoom, roomBest, roomFacts, roomGoal, roomLevels, startRoom, syncRoomHud, teamChip, teamSize } from "./room";

// ---------------------------------------------------------------------------
// MENUS — one overlay, one screen at a time, plus the in-game HUD.
//   main menu: a tab rail (Play, Boots, Friends and Awards still to come, Settings) beside the
//   selected tab. Play: multiplayer on top, the five solo modes in a row below. Boots (skins.ts):
//   the pattern on your boots. Settings (settings.ts): sections on the left, the open one beside.
//   solo:  main menu -> a mode's levels -> play (or Game modes, from the levels screen's back)
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
const fmtTime = (ticks: number) => t("secs", { n: (ticks * TICK_MS / 1000).toFixed(1) });

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

// ---- the main menu ----------------------------------------------------------------------------
/** the main menu's tabs that are built so far, each a pane under the shared top line */
type Tab = "play" | "boots" | "settings";
const TABS: Record<Tab, { pane: string }> = { play: { pane: "pPlay" }, boots: { pane: "pBoots" }, settings: { pane: "pSet" } };
let tab: Tab = "play";

/** the main menu, on one of its tabs: Play unless told otherwise */
export function goMenu(which: Tab = "play"){
  S.screen = "menu"; S.run = null; leaveMatch(); setAccent(ACCENT.destination);
  tab = which;
  for (const k of Object.keys(TABS) as Tab[]) $(TABS[k].pane).classList.toggle("on", k === which);
  document.querySelectorAll<HTMLElement>("#sMenu .tab").forEach(b => b.classList.toggle("sel", b.dataset.tab === which));
  $("mTitle").textContent = t(`tab.${which}`);
  $("mSub").textContent = t(`tab.${which}.sub`);
  renderMenu();
  if (which === "boots") enterBoots();
  if (which === "settings") enterSettings();
  show("sMenu");
}

const PLAY_ICON = `<svg viewBox="0 0 20 20"><path d="M6 4.2v11.6c0 .7.8 1.1 1.4.7l8.6-5.8c.5-.4.5-1.1 0-1.4L7.4 3.5c-.6-.4-1.4 0-1.4.7z" fill="currentColor"/></svg>`;
const modeName = (m: Mode) => MODES.find(x => x.id === m)!.name;

/** the Play tab's daily row: today's date and mode, your streak, and Play (or when the next one comes) */
function renderDaily(){
  const def = todaysDaily(), key = dayKey(), best = dailyBest(key), streak = dailyStreak(), b = $<HTMLButtonElement>("bDaily");
  b.style.setProperty("--c", def ? ACCENT[def.mode] : "var(--dim)");
  b.classList.toggle("done", !!best);
  b.disabled = !def;
  $("dName").textContent = levelName({ id: dailyId(key), name: key } as LevelDef);
  $("dMode").textContent = def ? modeName(def.mode) : "";
  $("dStreak").textContent = streak ? tn("daily.streak", streak) : "";
  $("dGo").innerHTML = !def ? t("daily.building") : best ? t("daily.cleared", { n: hoursToNext() }) : PLAY_ICON + t("play");
}

/** the Play tab: the lobby's team on the multiplayer floor, today's daily, and a column per solo mode */
function renderMenu(){
  renderDaily();
  const n = teamSize();
  $("menuTeam").innerHTML = PLAYER_COLORS.map((c, i) => i < n ? `<i style="--c:${c}"></i>` : `<i class="open"></i>`).join("")
    + `<span>${n === 1 ? t("menu.justYou") : tn("menu.withBots", n - 1)}</span>`;
  let all = 0, cleared = 0;
  const box = $("soloModes"); box.innerHTML = "";
  for (const m of MODES) {
    const lvls = levelsOf(m.id), c = lvls.filter(d => isDone(d.id)).length;
    all += lvls.length; cleared += c;
    // the mode you were last in shows where you are up to in it
    const cur = m.id === soloMode, next = lvls.findIndex(d => !isDone(d.id) && isOpen(d));
    const b = document.createElement("button");
    b.className = "smode" + (cur ? " next" : "");
    b.style.setProperty("--c", ACCENT[m.id]);
    b.style.setProperty("--p", `${lvls.length ? (100 * c) / lvls.length : 0}%`);
    b.innerHTML = `<i></i><b>${m.name}${m.wip ? `<em>${t("new")}</em>` : ""}</b><u></u>`
      + `<small>${cur && next >= 0 ? t("menu.next", { n: next + 1 }) : `${c} / ${lvls.length}`}</small>`;
    b.onclick = () => { sfx("click"); soloMode = m.id; save.lastMode = m.id; writeSave(); goLevels(m.id, false); };
    box.appendChild(b);
  }
  $("soloCleared").textContent = t("ofTotal", { a: cleared, b: all });
  $("meCleared").textContent = `${cleared}/${all}`;
}

/** every frame on the main menu: your boots in the top line, and the open tab's drawings */
function drawMenu(){
  if (!screenOn("sMenu")) return;
  const me = fitCanvas("meCv");
  if (me) drawSkinThumb(me.c, me.w, me.h, mySkin(), false);
  if (tab === "boots") { drawBoots(); return; }
  if (tab === "settings") { drawSettings(); return; }
  const n = teamSize(), floor = fitCanvas("menuFloor");
  if (floor) drawLobbyFloor(floor.c, floor.w, floor.h, [0, 1, 2, 3].map(i => i < n ? PLAYER_COLORS[i] : null), performance.now() / 1000);
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
    const tag = coop ? (playable(m.id) ? "" : `<em>${t("soon")}</em>`) : m.wip ? `<em>${t("new")}</em>` : "";
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
    ? (st.total ? tn("modes.coopRooms", st.total) : t("modes.coopSoon"))
    : info.wip ? t("modes.inProgress") : t("modes.levels", { n: st.total });
  $("miName").textContent = info.name;
  $("miAbout").textContent = coop ? info.coop.about : info.about;
  $("miChips").innerHTML = features(m).map(f => `<span>${f}</span>`).join("");
  $("miCleared").textContent = st.total ? `${st.cleared}/${st.total}` : "–";
  // co-op keeps no attempts; the second stat is the team instead
  $("miAttempts").textContent = coop ? String(teamSize()) : String(st.attempts);
  $("miAttemptsL").textContent = coop ? t("players") : t("attempts");
  $("miBest").textContent = st.best === null ? "–" : fmtTime(st.best);
  const btn = $<HTMLButtonElement>("bModeSelect");
  btn.disabled = coop && !playable(m);
  btn.textContent = btn.disabled ? t("modes.comingSoon") : t("modes.select");
  // the mode's first room in co-op; the solo sample level otherwise, and for modes without rooms
  const def = (coop && levelsFor(m)[0]) || levelById(info.preview);
  preview = def ? { run: newRun(parseLevel(def)), t0: performance.now() / 1000 } : null;
}

/** what you'll meet in a mode's levels, read from the levels themselves */
function features(m: Mode): string[] {
  const lv = levelsFor(m).length ? levelsFor(m) : levelsOf(m), out: string[] = [];
  if (lv.some(l => l.sentries?.length)) out.push(t("feat.sentries"));
  const dirs = new Set(lv.flatMap(l => (l.sweeps || []).map(s => s.dir)));
  if (dirs.has("diag") || dirs.has("antidiag")) out.push(t("feat.waterfalls"));
  if (dirs.has("all")) out.push(t("feat.pulses"));
  if (dirs.has("down") || dirs.has("up") || dirs.has("left") || dirs.has("right")) out.push(t("feat.waves"));
  if (m === "survival" || m === "waves" || coop) out.push(t("feat.timer"));
  if (coop) out.push(t("feat.sharedLives"));
  return out;
}

/** a canvas sized to its CSS box, sharp on high-density screens; null while it has no size */
function fitCanvas(id: string): { c: CanvasRenderingContext2D; w: number; h: number } | null {
  const cv = $<HTMLCanvasElement>(id);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = cv.clientWidth, h = cv.clientHeight;
  if (!w || !h) return null;
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  const c = cv.getContext("2d")!;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { c, w, h };
}

/** a level's live preview, drawn into a canvas */
export function previewInto(id: string, p: { run: Run; t0: number }){
  const f = fitCanvas(id);
  if (f) drawPreview(f.c, f.w, f.h, p.run, performance.now() / 1000 - p.t0, TICK_MS);
}

/** every frame: the main menu, the live preview on the modes screen, and the lobby's floor */
export function drawPreviews(){
  drawMenu();
  drawHowTo();
  if (preview && screenOn("sModes")) previewInto("modePreview", preview);
  drawLobby();
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
  $("lvCleared").textContent = t("ofTotal", { a: st.cleared, b: st.total });
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
    b.setAttribute("aria-label", t("lv.aria", { n: i + 1, name: levelName(def) }));
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
  if (coop && !isDaily(def)) return roomGoal(def);
  const lights = def.map.join("").replace(/[^o1-9]/g, "").length;
  switch (def.mode) {
    case "destination": return t("goal.destination");
    case "collect": return lights === 2 ? t("goal.collect2") : t("goal.collect", { n: lights });
    case "sequence": return t("goal.sequence", { n: lights });
    case "survival": return t("goal.survival", { n: Math.round((def.survive || 0) * (def.beat || 4) * TICK_MS / 1000) });
    case "waves": return t("goal.waves", { n: def.need ?? 0 });
  }
}

/** what is in a level: its hazards, board size and tempo */
function levelChips(def: LevelDef): string[] {
  const out: string[] = [];
  if (coop && def.mode === "collect") out.push(t("chip.lights", { n: roomFacts(def).lights }));
  const n = def.sentries?.length || 0;
  if (n) out.push(tn("chip.sentries", n));
  for (const sw of def.sweeps || []) {
    const name = t(sw.dir === "all" ? "chip.pulse" : sw.dir === "diag" || sw.dir === "antidiag" ? "chip.waterfall" : "chip.wave");
    if (!out.includes(name)) out.push(name);
  }
  if (!out.length) out.push(t("chip.noHazards"));
  out.push(`${def.map[0].length}×${def.map.length}`);
  out.push(t("chip.bpm", { n: Math.round(60000 / ((def.beat || 4) * TICK_MS)) }));
  return out;
}

function selectLevel(def: LevelDef){
  chosen()[def.mode] = def.id;
  const lvls = levelsFor(def.mode), i = lvls.indexOf(def), isOpenNow = open(def), cleared = done(def);
  const next = lvls.find(d => !done(d) && open(d));
  document.querySelectorAll<HTMLElement>(".lvl").forEach(b => b.classList.toggle("sel", b.dataset.id === def.id));
  const state = cleared ? t("lv.isCleared") : !isOpenNow ? t("lv.isLocked") : def === next ? t("lv.upNext") : "";
  $("liTag").textContent = t(coop ? "lv.room" : "lv.level", { n: i + 1 }) + (state ? ` · ${state}` : "");
  $("liName").textContent = levelName(def);
  $("liGoal").textContent = goalText(def);
  $("liChips").innerHTML = levelChips(def).map(c => `<span>${c}</span>`).join("");
  const btn = $<HTMLButtonElement>("bLevelPlay");
  if (coop) {
    // a room's stats are the team's: its shared lives, its best clear, its size
    const best = roomBest(def);
    $("liPresses").textContent = String(roomFacts(def).lives); $("liPressesL").textContent = t("lv.teamLives");
    $("liTime").textContent = best === undefined ? "–" : def.mode === "survival" ? "✓" : fmtTime(best);
    $("liTimeL").textContent = def.mode === "survival" ? t("lv.survived") : t("lv.teamBest");
    $("liAttempts").textContent = String(teamSize()); $("liAttemptsL").textContent = t("players");
    btn.disabled = false;
    btn.textContent = t("lv.playTeam", { n: teamSize() });
  } else {
    const best = save.done?.[def.id];
    $("liPresses").textContent = best?.presses != null ? String(best.presses) : "–"; $("liPressesL").textContent = t("presses");
    $("liTime").textContent = best ? fmtTime(best.ticks) : "–"; $("liTimeL").textContent = t("bestTime");
    $("liAttempts").textContent = String(save.attempts?.[def.id] || 0); $("liAttemptsL").textContent = t("attempts");
    btn.disabled = !isOpenNow;
    btn.textContent = !isOpenNow ? t("lv.clearFirst", { n: i }) : best ? t("playAgain") : t("play");
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
  const d = M.active ? M.def : S.def;
  $("pauseName").textContent = d ? levelName(d) : "";
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
  $("hMode").textContent = isDaily(def) ? t("daily.title") : modeName(def.mode);
  $("hName").textContent = levelName(def);
  $("hGoalLabel").textContent = t(def.mode === "survival" ? "hud.goal.survive" : def.mode === "destination" ? "hud.goal.time" : "hud.goal.lights");
  $("hTeam").classList.remove("on");
  show(null);
  const first = (save.attempts?.[def.id] || 0) === 0;
  // the daily can be any mode: its first try says what to do
  toast(first ? (isDaily(def) ? `${modeName(def.mode)} · ${goalText(def)}` : levelHint(def)) : "");
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
  const daily = isDaily(def);
  $("winMode").textContent = daily ? `${t("daily.title")} · ${modeName(def.mode)}` : modeName(def.mode);
  $("bWinLevels").textContent = daily ? t("daily.menu") : t("levels");
  $("winName").textContent = levelName(def);
  $("winSwings").textContent = String(r.moves);
  $("winTime").textContent = fmtTime(r.tick);
  $("winAttempts").textContent = String(S.attempt);
  const badge = $("winBadge");
  // a daily's first clear counts the streak instead
  badge.textContent = S.best === "first" ? (daily ? tn("daily.streak", dailyStreak()) : t("win.first")) : S.best === "better" ? t("win.best") : "";
  badge.classList.toggle("on", !!S.best);
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
    ? t("secs", { n: Math.max(0, (b - a) * r.lv.beat * TICK_MS / 1000).toFixed(0) })
    : r.lv.def.mode === "destination" ? fmtTime(r.tick) : `${a}/${b}`;
  const el = $("hGoalVal"); if (el.textContent !== v) el.textContent = v;
  const at = $("attempt"), label = t("hud.attempt", { n: S.attempt });
  if (at.textContent !== label) at.textContent = label;
  at.classList.toggle("on", S.screen === "play" && r.tick < 12 && S.attempt > 1);
}

/** out of a solo level: to its mode's levels, or the main menu from the daily */
export function leaveSolo(){ if (isDaily(S.def)) goMenu(); else goLevels(S.def?.mode, false); }

/** back from the game modes screen: to the lobby in co-op, the main menu solo */
function modesBack(){ if (coop) goLobby(); else goMenu(); }

/** the Android back button on a menu: one screen back. false on the main menu */
export function back(): boolean {
  if (screenOn("sLevels")) { goModes(); return true; }
  if (screenOn("sModes")) { modesBack(); return true; }
  if (screenOn("sMenu") && tab !== "play") { goMenu(); return true; }
  if (screenOn("sHow")) { goMenu(tab); return true; }
  if (screenOn("sRoom")) { goMenu(); return true; }
  if (screenOn("sRoomOver")) { roomLevels(); return true; }
  return false;
}

export function initMenus(){
  S.onWin = onWin;
  initRoom();
  initBoots();
  // a new language: the whole main menu again, still on Settings
  onLanguage(() => goMenu("settings"));
  on("bCoop", goLobby);
  on("tPlay", () => goMenu("play"));
  on("tBoots", () => goMenu("boots"));
  on("bMe", () => goMenu("boots"));
  on("bRoomBack", goMenu);
  initHowTo();
  on("bHow", openHowTo);
  // How to play closes back to the tab it was opened from
  on("bHowOk", () => goMenu(tab));
  on("tSet", () => goMenu("settings"));
  on("bModesBack", modesBack);
  on("bModeSelect", () => { if (!coop || playable(curMode())) goLevels(curMode()); });
  on("bLevelsBack", () => goModes());
  on("pauseBtn", pauseAny);
  on("bResume", unpause);
  on("bRestart", () => {
    if (M.active) { restartMatch(); enterRoom(); return; }
    S.attempt++; restart(); show(null);
  });
  on("bPauseLevels", () => { if (M.active) roomLevels(); else leaveSolo(); });
  on("bNext", () => { const n = S.def && nextLevel(S.def); if (n) play(n); });
  on("bRetry", () => { S.attempt++; play(S.def!); });
  on("bWinLevels", () => leaveSolo());
  on("bDaily", () => { const d = todaysDaily(); if (d) play(d); });
  onDailyReady(() => { if (screenOn("sMenu")) renderDaily(); });
}
