import type { Run } from "../core/types";
import { sfx } from "../audio/audio";
import type { SkillId } from "../game/bot";
import { bestKey, leaveMatch, M, PLAYER_COLORS, restartMatch, startMatch, type Slot } from "../game/match";
import { beatsLeft } from "../game/room";
import { newRun } from "../game/rules";
import { TICK_MS } from "../game/session";
import { parseLevel } from "../levels/parse";
import { ROOMS } from "../levels/rooms";
import { ACCENT } from "../render/theme";
import { save, writeSave } from "../storage/save";
import { $, previewInto, screenOn, setAccent, show, toast } from "./menus";

// ---------------------------------------------------------------------------
// ROOM UI — the co-op lobby, the in-room HUD and the results screen.
//   main menu -> Co-op lobby (you + 3 slots for bots) -> countdown -> play -> results
// The lobby is where online play will plug in later: an open slot becomes a friend's seat.
// ---------------------------------------------------------------------------

/** what tapping an open / bot slot cycles through */
const CYCLE: ("open" | SkillId)[] = ["open", "easy", "normal", "hard"];
const SKILL_NAME: Record<SkillId, string> = { easy: "Easy", normal: "Normal", hard: "Hard" };

/** the three slots after yours: "open" or a bot's skill. One bot on Normal to begin with */
let others: ("open" | SkillId)[] = loadSlots();
function loadSlots(): ("open" | SkillId)[] {
  const s = save.roomSlots;
  return s?.length === 3 && s.every(x => CYCLE.includes(x as never)) ? s as ("open" | SkillId)[] : ["normal", "open", "open"];
}

const def = ROOMS[0];
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
const lights = () => def.map.join("").replace(/[^o]/g, "").length;

export function goLobby(){
  leaveMatch();
  setAccent(ACCENT[def.mode]);
  preview = { run: newRun(parseLevel(def)), t0: performance.now() / 1000 };
  $("riTag").textContent = "Collect All · room";
  $("riName").textContent = def.name;
  $("riGoal").textContent = `Pick up all ${lights()} lights together. Any player's pickup counts for the team; every fall costs a shared life.`;
  const secs = Math.round((def.limit || 0) * (def.beat || 4) * TICK_MS / 1000);
  $("riChips").innerHTML = [`${lights()} lights`, `${def.sentries?.length || 0} sentries`, `${secs}s`, `${def.map[0].length}×${def.map.length}`]
    .map(c => `<span>${c}</span>`).join("");
  $("riLives").textContent = String(def.lives || 5);
  renderSlots();
  show("sRoom");
}

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
  const n = players(), best = save.roomBest?.[bestKey(def.id, n)];
  $("riBest").textContent = best ? fmt(best) : "–";
  $("riBestLabel").textContent = `best · ${n} players`;
  const start = $<HTMLButtonElement>("bRoomStart");
  start.disabled = n < 2;
  start.textContent = n < 2 ? "Add a bot to start" : `Start · ${n} players`;
}

export function startRoom(){
  if (players() < 2) return;
  startMatch(def, slots());
  enterRoom();
}

/** show the board for a (re)started match */
export function enterRoom(){
  setAccent(ACCENT[def.mode]);
  $("hMode").textContent = `Co-op · ${M.slots.length} players`;
  $("hName").textContent = def.name;
  $("hGoalLabel").textContent = "lights";
  $("hDots").innerHTML = M.slots.map((_, i) => `<i style="--c:${PLAYER_COLORS[i]}"></i>`).join("");
  $("hTeam").classList.add("on");
  show(null);
  toast(def.hint || "");
}

/** HUD text, every frame while in a room */
export function syncRoomHud(){
  const r = M.room; if (!r) return;
  const v = `${r.got}/${r.lv.items.length}`, el = $("hGoalVal");
  if (el.textContent !== v) el.textContent = v;
  const lives = `♥ ${Math.max(0, r.lives)}`, hl = $("hLives");
  if (hl.textContent !== lives) hl.textContent = lives;
  const left = beatsLeft(r), hc = $("hClock");
  const secs = left === null ? "" : Math.ceil(left * r.lv.beat * TICK_MS / 1000);
  const clock = secs === "" ? "" : `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
  if (hc.textContent !== clock) hc.textContent = clock;
  hc.classList.toggle("low", secs !== "" && secs <= 10);
  $("hDots").querySelectorAll("i").forEach((d, i) => d.classList.toggle("out", !r.pairs[i]?.alive));
}

/** the room has ended: the results screen */
function onOver(){
  const r = M.room!, won = r.status === "won";
  $("hTeam").classList.remove("on");
  $("roTag").textContent = `Co-op · ${def.name} · ${M.slots.length} players`;
  $("roTitle").textContent = won ? "Cleared" : r.why === "time" ? "Time's up" : "Out of lives";
  const best = save.roomBest?.[bestKey(def.id, M.slots.length)];
  $("roSub").textContent = won
    ? `${fmt(r.tick)} · ${r.lives} ${r.lives === 1 ? "life" : "lives"} left` + (best === r.tick ? " · team best" : best ? ` · best ${fmt(best)}` : "")
    : `${r.got} of ${r.lv.items.length} lights`;
  $("roPlayers").innerHTML = M.slots.map((s, i) => {
    const p = r.pairs[i];
    const name = s.kind === "you" ? "You" : `Bot · ${SKILL_NAME[s.skill]}`;
    return `<div style="--c:${PLAYER_COLORS[i]}"><b>${name}</b><span>${p.got} ${p.got === 1 ? "light" : "lights"} · ${p.deaths} ${p.deaths === 1 ? "fall" : "falls"}</span></div>`;
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
