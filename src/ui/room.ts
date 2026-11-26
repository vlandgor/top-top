import type { LevelDef, Run } from "../core/types";
import { sfx } from "../audio/audio";
import type { SkillId } from "../game/bot";
import { bestKey, leaveMatch, M, PLAYER_COLORS, restartMatch, startMatch, type Slot } from "../game/match";
import { beatsLeft, teamLives } from "../game/room";
import { newRun } from "../game/rules";
import { TICK_MS } from "../game/session";
import { MODES } from "../levels/levels";
import { parseLevel } from "../levels/parse";
import { forPlayers, roomById, ROOMS } from "../levels/rooms";
import { ACCENT } from "../render/theme";
import { save, writeSave } from "../storage/save";
import { $, previewInto, screenOn, setAccent, show, toast } from "./menus";

// ---------------------------------------------------------------------------
// ROOM UI — the co-op lobby, the in-room HUD and the results screen.
//   main menu -> Co-op lobby (you + 3 slots for bots, a room per mode) -> countdown -> play
//   -> results
// The lobby is where online play will plug in later: an open slot becomes a friend's seat.
// ---------------------------------------------------------------------------

/** what tapping an open / bot slot cycles through */
const CYCLE: ("open" | SkillId)[] = ["open", "easy", "normal", "hard"];
/** bots are teammates, so their skill reads as experience rather than difficulty */
const SKILL_NAME: Record<SkillId, string> = { easy: "Rookie", normal: "Regular", hard: "Pro" };

/** the three slots after yours: "open" or a bot's skill. One Regular bot to begin with */
let others: ("open" | SkillId)[] = loadSlots();
function loadSlots(): ("open" | SkillId)[] {
  const s = save.roomSlots;
  return s?.length === 3 && s.every(x => CYCLE.includes(x as never)) ? s as ("open" | SkillId)[] : ["normal", "open", "open"];
}

/** the room chosen in the lobby */
let def: LevelDef = roomById(save.roomId || "") || ROOMS[0];
let preview: { run: Run; t0: number } | null = null;

function slots(): Slot[] {
  return [{ kind: "you", skill: "normal" }, ...others.map(o => o === "open" ? { kind: "open", skill: "normal" } as Slot : { kind: "bot", skill: o } as Slot)];
}
const players = () => 1 + others.filter(o => o !== "open").length;
/** the colour each slot will play in: filled slots take the colours in order */
function colorOf(slotIndex: number): string {
  const filled = slots().slice(0, slotIndex + 1).filter(s => s.kind !== "open").length;
  return PLAYER_COLORS[Math.max(0, filled - 1)];
}
const fmt = (ticks: number) => (ticks * TICK_MS / 1000).toFixed(1) + "s";
const secs = (beats: number, d: LevelDef) => Math.round(beats * (d.beat || 4) * TICK_MS / 1000);
const lightsFor = (d: LevelDef, n: number) => forPlayers(d, n).map.join("").replace(/[^o]/g, "").length;
const modeName = (d: LevelDef) => MODES.find(m => m.id === d.mode)!.name;

// ---- the lobby ------------------------------------------------------------------------------
export function goLobby(){
  leaveMatch();
  selectRoom(def);
  renderSlots();
  show("sRoom");
}

function selectRoom(d: LevelDef){
  def = d; save.roomId = d.id; writeSave();
  setAccent(ACCENT[d.mode]);
  preview = { run: newRun(parseLevel(d)), t0: performance.now() / 1000 };
  const tabs = $("roomTabs"); tabs.innerHTML = "";
  for (const r of ROOMS) {
    const b = document.createElement("button");
    b.className = r === d ? "sel" : "";
    b.style.setProperty("--c", ACCENT[r.mode]);
    b.innerHTML = `<i></i>${modeName(r)}`;
    b.onclick = () => { sfx("click"); selectRoom(r); renderSlots(); };
    tabs.appendChild(b);
  }
  $("riTag").textContent = `${modeName(d)} · room`;
  $("riName").textContent = d.name;
}

/** everything that depends on the number of players: the goal, chips, lives, best, Start */
function renderSlots(){
  const box = $("slots"); box.innerHTML = "";
  slots().forEach((s, i) => {
    const b = document.createElement("button");
    b.className = "slot " + s.kind;
    b.style.setProperty("--c", s.kind === "open" ? "#3e504d" : colorOf(i));
    b.innerHTML = s.kind === "you" ? `<i></i><b>You</b><small>this phone</small>`
      : s.kind === "bot" ? `<i></i><b>Bot</b><small>${SKILL_NAME[s.skill]}</small>`
      : `<i></i><b>Open</b><small>+ add a bot</small>`;
    if (i > 0) b.onclick = () => {
      sfx("click");
      others[i - 1] = CYCLE[(CYCLE.indexOf(others[i - 1]) + 1) % CYCLE.length];
      save.roomSlots = others.slice(); writeSave();
      renderSlots();
    };
    box.appendChild(b);
  });
  const n = players(), lv = parseLevel(forPlayers(def, n));
  $("riGoal").textContent = goalText(def, n);
  const chips = def.mode === "collect"
    ? [`${lightsFor(def, n)} lights`, `${secs(def.limit || 0, def)}s`]
    : [`${secs(def.survive || 0, def)}s`];
  if (def.sentries?.length) chips.push(`${def.sentries.length} sentries`);
  if (def.sweeps?.length) chips.push(def.sweeps.length === 1 ? "1 sweep" : `${def.sweeps.length} sweeps`);
  chips.push(`${def.map[0].length}×${def.map.length}`);
  $("riChips").innerHTML = chips.map(c => `<span>${c}</span>`).join("");
  $("riLives").textContent = String(teamLives(lv, n));
  const best = save.roomBest?.[bestKey(def.id, n)];
  $("riBest").textContent = best ? (def.mode === "survival" ? "Cleared" : fmt(best)) : "–";
  $("riBestLabel").textContent = def.mode === "survival" ? `${n} players` : `best · ${n} players`;
  const start = $<HTMLButtonElement>("bRoomStart");
  start.disabled = n < 2;
  start.textContent = n < 2 ? "Add a bot to start" : `Start · ${n} players`;
}

function goalText(d: LevelDef, n: number): string {
  switch (d.mode) {
    case "collect": return `Pick up all ${lightsFor(d, n)} lights together. Any player's pickup counts for the team; every fall costs a shared life.`;
    case "survival": return `Stay alive for ${secs(d.survive || 0, d)} seconds as a team. Every fall costs a shared life; the room is cleared if any are left.`;
    default: return "";
  }
}

export function startRoom(){
  if (players() < 2) return;
  startMatch(def, slots());
  enterRoom();
}

// ---- in the room ----------------------------------------------------------------------------
/** show the board for a (re)started match */
export function enterRoom(){
  const d = M.def!;
  setAccent(ACCENT[d.mode]);
  $("hMode").textContent = `Co-op · ${M.slots.length} players`;
  $("hName").textContent = d.name;
  $("hGoalLabel").textContent = d.mode === "survival" ? "survive" : "lights";
  $("hDots").innerHTML = M.slots.map((_, i) => `<i style="--c:${PLAYER_COLORS[i]}"></i>`).join("");
  $("hTeam").classList.add("on");
  show(null);
  toast(d.hint || "");
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
  $("roTag").textContent = `Co-op · ${d.name} · ${M.slots.length} players`;
  $("roTitle").textContent = won ? (survival ? "Survived" : "Cleared") : r.why === "time" ? "Time's up" : "Out of lives";
  const lives = `${r.lives} ${r.lives === 1 ? "life" : "lives"} left`;
  const best = save.roomBest?.[bestKey(d.id, M.slots.length)];
  $("roSub").textContent = !won
    ? (survival ? `held on for ${fmt(r.tick)} of ${secs(d.survive || 0, d)}s` : `${r.got} of ${r.lv.items.length} lights`)
    : survival ? lives
    : `${fmt(r.tick)} · ${lives}` + (best === r.tick ? " · team best" : best ? ` · best ${fmt(best)}` : "");
  $("roPlayers").innerHTML = M.slots.map((s, i) => {
    const p = r.pairs[i];
    const name = s.kind === "you" ? "You" : `Bot · ${SKILL_NAME[s.skill]}`;
    const falls = `${p.deaths} ${p.deaths === 1 ? "fall" : "falls"}`;
    const line = survival ? falls : `${p.got} ${p.got === 1 ? "light" : "lights"} · ${falls}`;
    return `<div style="--c:${PLAYER_COLORS[i]}"><b>${name}</b><span>${line}</span></div>`;
  }).join("");
  show("sRoomOver");
}

export function againRoom(){ M.active = true; restartMatch(); enterRoom(); }

/** every frame: the lobby's live preview */
export function drawRoomPreview(){
  if (preview && screenOn("sRoom")) previewInto("roomPreview", preview);
}

export function initRoom(){
  M.onOver = onOver;
  const on = (id: string, fn: () => void) => $(id).addEventListener("click", () => { sfx("click"); fn(); });
  on("bRoomStart", startRoom);
  on("bRoomAgain", againRoom);
  on("bRoomLobby", goLobby);
}
