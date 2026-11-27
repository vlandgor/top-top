import type { LevelDef } from "../core/types";
import { sfx } from "../audio/audio";
import type { SkillId } from "../game/bot";
import { bestKey, leaveMatch, M, PLAYER_COLORS, restartMatch, startMatch, type Slot } from "../game/match";
import { beatsLeft, teamLives } from "../game/room";
import { TICK_MS } from "../game/session";
import { parseLevel } from "../levels/parse";
import { forPlayers, ROOMS } from "../levels/rooms";
import { drawLobbyFloor } from "../render/draw";
import { ACCENT } from "../render/theme";
import { save, writeSave } from "../storage/save";
import { levelHint, levelName, listOf, t, tn } from "../i18n";
import { $, goLevels, goModes, screenOn, setAccent, show, toast } from "./menus";

// ---------------------------------------------------------------------------
// ROOM UI — the co-op lobby, the in-room HUD and the results screen.
//   main menu -> Co-op lobby (you + 3 slots for bots) -> game modes -> levels (the same
//   screens as solo, in co-op: menus.ts) -> countdown -> play -> results
// The lobby is where online play will plug in later: an open slot becomes a friend's seat.
// ---------------------------------------------------------------------------

/** what tapping an open / bot slot cycles through */
const CYCLE: ("open" | SkillId)[] = ["open", "easy", "normal", "hard"];
/** bots are teammates, so their skill reads as experience rather than difficulty: Rookie,
 *  Regular, Pro (i18n: skill.<id>) */
const skillName = (k: SkillId) => t(`skill.${k}`);

/** the three slots after yours: "open" or a bot's skill. One Regular bot to begin with */
let others: ("open" | SkillId)[] = loadSlots();
function loadSlots(): ("open" | SkillId)[] {
  const s = save.roomSlots;
  return s?.length === 3 && s.every(x => CYCLE.includes(x as never)) ? s as ("open" | SkillId)[] : ["normal", "open", "open"];
}

function slots(): Slot[] {
  return [{ kind: "you", skill: "normal" }, ...others.map(o => o === "open" ? { kind: "open", skill: "normal" } as Slot : { kind: "bot", skill: o } as Slot)];
}
/** how many are in the team the lobby has set up */
export const teamSize = () => 1 + others.filter(o => o !== "open").length;
/** the colour each slot will play in: filled slots take the colours in order */
function colorOf(slotIndex: number): string {
  const filled = slots().slice(0, slotIndex + 1).filter(s => s.kind !== "open").length;
  return PLAYER_COLORS[Math.max(0, filled - 1)];
}
const fmt = (ticks: number) => t("secs", { n: (ticks * TICK_MS / 1000).toFixed(1) });
const secs = (beats: number, d: LevelDef) => Math.round(beats * (d.beat || 4) * TICK_MS / 1000);

// ---- what the shared modes / levels screens need to know about the team ----------------------
/** the team's colours as dots, with its size, for the screen headers */
export function teamChip(): string {
  const n = teamSize();
  return PLAYER_COLORS.slice(0, n).map(c => `<i style="--c:${c}"></i>`).join("") + `<span>${t("coop.nPlayers", { n })}</span>`;
}
/** the team's best clear of a room at its current size, in ticks */
export const roomBest = (def: LevelDef): number | undefined => save.roomBest?.[bestKey(def.id, teamSize())];
/** a room as this team would play it: its lights and lives depend on the team's size */
export function roomFacts(def: LevelDef): { lights: number; lives: number } {
  const n = teamSize(), d = forPlayers(def, n);
  return { lights: d.map.join("").replace(/[^o]/g, "").length, lives: teamLives(parseLevel(d), n) };
}
/** what the team has to do in a room, in one line */
export function roomGoal(def: LevelDef): string {
  const { lights } = roomFacts(def);
  switch (def.mode) {
    case "collect": return t("goal.coopCollect", { n: lights, s: secs(def.limit || 0, def) });
    case "survival": return t("goal.coopSurvival", { s: secs(def.survive || 0, def) });
    default: return "";
  }
}

// ---- the lobby ------------------------------------------------------------------------------
export function goLobby(){
  leaveMatch();
  setAccent(PLAYER_COLORS[0]);
  renderSlots();
  show("sRoom");
}

function renderSlots(){
  const box = $("slots"); box.innerHTML = "";
  slots().forEach((s, i) => {
    const b = document.createElement("button");
    b.className = "slot " + s.kind;
    b.style.setProperty("--c", s.kind === "open" ? "#3e504d" : colorOf(i));
    b.innerHTML = s.kind === "you" ? `<i></i><b>${t("coop.you")}</b><small>${t("coop.thisPhone")}</small>`
      : s.kind === "bot" ? `<i></i><b>${t("coop.bot")}</b><small>${skillName(s.skill)}</small>`
      : `<i></i><b>${t("coop.open")}</b><small>${t("coop.addBot")}</small>`;
    if (i > 0) b.onclick = () => {
      sfx("click");
      others[i - 1] = CYCLE[(CYCLE.indexOf(others[i - 1]) + 1) % CYCLE.length];
      save.roomSlots = others.slice(); writeSave();
      renderSlots();
    };
    box.appendChild(b);
  });
  renderTeam();
}

/** the right side of the lobby: who's in, what that means, and the way to the games */
function renderTeam(){
  const n = teamSize(), bots = others.filter(o => o !== "open") as SkillId[];
  $("lbTitle").textContent = n < 2 ? t("coop.justYou") : t("coop.nPlayers", { n });
  const skills = [...new Set(bots)];
  const who = !bots.length ? t("coop.needBot") : tn("coop.withBots", bots.length, { list: listOf(bots.map(skillName)) });
  const what = skills.map(b => t(`skill.${b}.about`)).join(" ");
  $("lbAbout").textContent = `${who} ${what} ${bots.length ? t("coop.grows") : ""}`.replace(/\s+/g, " ").trim();
  $("lbLives").textContent = String(Math.ceil(5 * Math.max(2, n) / 2));
  $("lbCleared").textContent = `${ROOMS.filter(r => save.roomBest?.[bestKey(r.id, n)] !== undefined).length}/${ROOMS.length}`;
  $("lbBots").textContent = String(bots.length);
  const next = $<HTMLButtonElement>("bRoomNext");
  next.disabled = n < 2;
  next.textContent = n < 2 ? t("coop.addBotToPlay") : t("coop.chooseGame");
}

/** every frame: the lobby's floor, with the team standing on it */
export function drawLobby(){
  if (!screenOn("sRoom")) return;
  const cv = $<HTMLCanvasElement>("lobbyFloor");
  const dpr = Math.min(2, window.devicePixelRatio || 1), w = cv.clientWidth, h = cv.clientHeight;
  if (!w || !h) return;
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  const c = cv.getContext("2d")!;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  const n = teamSize();
  drawLobbyFloor(c, w, h, [0, 1, 2, 3].map(i => i < n ? PLAYER_COLORS[i] : null), performance.now() / 1000);
}

/** play a room with the team from the lobby */
export function startRoom(def: LevelDef){
  if (teamSize() < 2) return;
  startMatch(def, slots());
  enterRoom();
}

// ---- in the room ----------------------------------------------------------------------------
/** show the board for a (re)started match */
export function enterRoom(){
  const d = M.def!;
  setAccent(ACCENT[d.mode]);
  $("hMode").textContent = t("coop.hudMode", { n: M.slots.length });
  $("hName").textContent = levelName(d);
  $("hGoalLabel").textContent = t(d.mode === "survival" ? "hud.goal.survive" : "hud.goal.lights");
  $("hDots").innerHTML = M.slots.map((_, i) => `<i style="--c:${PLAYER_COLORS[i]}"></i>`).join("");
  $("hTeam").classList.add("on");
  show(null);
  toast(levelHint(d));
}

const clockText = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** HUD text, every frame while in a room */
export function syncRoomHud(){
  const r = M.room; if (!r) return;
  const left = beatsLeft(r);
  const s = left === null ? null : Math.ceil(left * r.lv.beat * TICK_MS / 1000);
  // Survival's clock is its goal, so it goes in the goal slot; elsewhere it's the time limit
  const survival = r.lv.def.mode === "survival";
  const v = survival ? clockText(s || 0) : `${r.got}/${r.lv.items.length}`, el = $("hGoalVal");
  if (el.textContent !== v) el.textContent = v;
  const lives = `♥ ${Math.max(0, r.lives)}`, hl = $("hLives");
  if (hl.textContent !== lives) hl.textContent = lives;
  const clock = survival || s === null ? "" : clockText(s), hc = $("hClock");
  if (hc.textContent !== clock) hc.textContent = clock;
  hc.classList.toggle("low", !survival && s !== null && s <= 10);
  $("hDots").querySelectorAll("i").forEach((d, i) => d.classList.toggle("out", !r.pairs[i]?.alive));
}

// ---- results --------------------------------------------------------------------------------
function onOver(){
  const r = M.room!, d = M.def!, won = r.status === "won", survival = d.mode === "survival";
  $("hTeam").classList.remove("on");
  $("roTag").textContent = t("coop.overTag", { name: levelName(d), n: M.slots.length });
  $("roTitle").textContent = t(won ? (survival ? "coop.survived" : "coop.cleared") : r.why === "time" ? "coop.timesUp" : "coop.outOfLives");
  const lives = tn("coop.livesLeft", r.lives);
  const best = save.roomBest?.[bestKey(d.id, M.slots.length)];
  $("roSub").textContent = !won
    ? (survival ? t("coop.heldOn", { t: fmt(r.tick), s: t("secs", { n: secs(d.survive || 0, d) }) }) : t("coop.gotLights", { a: r.got, b: r.lv.items.length }))
    : survival ? lives
    : `${fmt(r.tick)} · ${lives}` + (best === r.tick ? ` · ${t("coop.teamBest")}` : best ? ` · ${t("coop.best", { t: fmt(best) })}` : "");
  $("roPlayers").innerHTML = M.slots.map((s, i) => {
    const p = r.pairs[i];
    const name = s.kind === "you" ? t("coop.you") : t("coop.botSkill", { skill: skillName(s.skill) });
    const falls = tn("coop.falls", p.deaths);
    const line = survival ? falls : `${tn("coop.lights", p.got)} · ${falls}`;
    return `<div style="--c:${PLAYER_COLORS[i]}"><b>${name}</b><span>${line}</span></div>`;
  }).join("");
  show("sRoomOver");
}

export function againRoom(){ M.active = true; restartMatch(); enterRoom(); }
/** from a room (results or pause) back to that mode's co-op levels */
export function roomLevels(){ const m = M.def?.mode; leaveMatch(); goLevels(m, true); }

export function initRoom(){
  M.onOver = onOver;
  const on = (id: string, fn: () => void) => $(id).addEventListener("click", () => { sfx("click"); fn(); });
  on("bRoomNext", () => { if (teamSize() >= 2) goModes(true); });
  on("bRoomAgain", againRoom);
  on("bRoomLevels", roomLevels);
  on("bRoomLobby", goLobby);
}
