import { setSound, sfx, soundOn } from "../audio/audio";
import { isDone } from "../game/session";
import { LEVELS } from "../levels/levels";
import { IS_DEV } from "../platform/dev";
import { drawSkinStage } from "../render/draw";
import { mySkin } from "../render/skins";
import { resetSave, writeSave } from "../storage/save";
import { $ } from "./menus";
import { openHowTo } from "./howto";

// ---------------------------------------------------------------------------
// SETTINGS — the main menu's Settings tab: its sections on the left, the open one on the right,
// like the Game modes screen. Each section is a list of rows: a switch, a link, or a fact. More
// settings go into the section they belong to, or a new section in SECTIONS.
// ---------------------------------------------------------------------------

type SectionId = "sound" | "controls" | "help" | "save" | "about";
interface Section { id: SectionId; name: string; /** a short value shown in the list */ peek: () => string; body: () => string }

const CHEVRON = `<svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M8 5l5 5-5 5"/></svg>`;
const sw = (id: string, on: boolean) => `<button class="sw${on ? " on" : ""}" id="${id}" role="switch" aria-checked="${on}"><i></i></button>`;
const row = (title: string, sub: string, end = "", cls = "", id = "") =>
  `<div class="srow ${cls}"${id ? ` id="${id}"` : ""}><div class="stx"><b>${title}</b>${sub ? `<small>${sub}</small>` : ""}</div>${end}</div>`;

const cleared = () => LEVELS.filter(d => isDone(d.id)).length;
const pct = () => `${Math.round((100 * cleared()) / LEVELS.length)}%`;
const version = () => IS_DEV ? "dev build" : "v" + __VERSION__;

const SECTIONS: Section[] = [
  {
    id: "sound", name: "Sound", peek: () => soundOn() ? "On" : "Off",
    body: () => row("Sound effects", "Swings, pickups and the beat", sw("optSfx", soundOn())),
  },
  {
    id: "controls", name: "Controls", peek: () => "",
    body: () => `<div class="sdemo"><span class="sk">L</span><canvas id="setStage"></canvas><span class="sk">R</span></div>`
      + row("Boot buttons", "The left and right edges of the screen, one per boot")
      + row("Tap the board", "The left or right half of the board presses that boot too")
      + row("Keyboard", "A / ← left · D / → right · R restart · Esc pause"),
  },
  {
    id: "help", name: "Help", peek: () => "",
    body: () => row("How to play", "The buttons, the edge, the hazards", `<span class="send">${CHEVRON}</span>`, "link", "setHow"),
  },
  {
    id: "save", name: "Your save", peek: pct,
    body: () => row("Progress", `${cleared()} / ${LEVELS.length} solo levels cleared · kept on this device`, `<span class="send">${pct()}</span>`)
      + row("Reset progress", "Clears levels, best times and co-op bests. Keeps your boots and settings", `<span class="send">${CHEVRON}</span>`, "link danger", "setReset"),
  },
  {
    id: "about", name: "About", peek: version,
    body: () => row("Version", `Top Top ${version()} · ${LEVELS.length} levels`)
      + row("Made by", "Playcebo Games"),
  },
];

/** the open section; kept while the app runs */
let open: SectionId = "sound";
let t0 = 0;

/** opening the tab */
export function enterSettings(){
  t0 = performance.now() / 1000;
  render();
}

function render(){
  const nav = $("setNav"); nav.innerHTML = "";
  for (const s of SECTIONS) {
    const b = document.createElement("button");
    b.className = "ssec" + (s.id === open ? " sel" : "");
    b.innerHTML = `${s.name}<small>${s.peek()}</small>`;
    b.onclick = () => { sfx("click"); open = s.id; render(); };
    nav.appendChild(b);
  }
  const sec = SECTIONS.find(s => s.id === open)!;
  $("setBody").innerHTML = `<h3>${sec.name}</h3>` + sec.body();
  wire();
}

/** the rows that do something */
function wire(){
  const sfxSw = document.getElementById("optSfx");
  if (sfxSw) sfxSw.onclick = () => { setSound(!soundOn()); writeSave(); sfx("click"); render(); };
  const how = document.getElementById("setHow");
  if (how) how.onclick = () => { sfx("click"); openHowTo(); };
  const reset = document.getElementById("setReset");
  if (reset) reset.onclick = () => { sfx("click"); if (confirm("Reset all progress?")) { resetSave(); render(); } };
}

/** every frame while the tab is open: your boots walking in the Controls section */
export function drawSettings(){
  const cv = document.getElementById("setStage") as HTMLCanvasElement | null;
  if (!cv) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1), w = cv.clientWidth, h = cv.clientHeight;
  if (!w || !h) return;
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  const c = cv.getContext("2d")!;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawSkinStage(c, w, h, performance.now() / 1000 - t0, mySkin());
}

declare const __VERSION__: string;
