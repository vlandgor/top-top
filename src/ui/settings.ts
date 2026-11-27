import { musicOn, setMusic, setSound, sfx, soundOn } from "../audio/audio";
import { isDone } from "../game/session";
import { LEVELS } from "../levels/levels";
import { DEV_BUILD, IS_DEV } from "../platform/dev";
import { drawSkinStage } from "../render/draw";
import { mySkin } from "../render/skins";
import { resetSave, writeSave } from "../storage/save";
import { $ } from "./menus";
import { buzz, hapticsOn, setHaptics } from "../platform/haptics";
import { openHowTo } from "./howto";
import { deviceLang, lang, langName, LANGS, langSetting, setLang, t, type LangId } from "../i18n";

// ---------------------------------------------------------------------------
// SETTINGS — the main menu's Settings tab: its sections on the left, the open one on the right,
// like the Game modes screen. Each section is a list of rows: a switch, a link, or a fact. More
// settings go into the section they belong to, or a new section in SECTIONS.
// ---------------------------------------------------------------------------

type SectionId = "sound" | "language" | "controls" | "help" | "save" | "about";
interface Section { id: SectionId; name: () => string; /** a short value shown in the list */ peek: () => string; body: () => string }

const CHEVRON = `<svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M8 5l5 5-5 5"/></svg>`;
const CHECK = `<svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 10.5l3.5 3.5 7.5-8"/></svg>`;
const sw = (id: string, on: boolean) => `<button class="sw${on ? " on" : ""}" id="${id}" role="switch" aria-checked="${on}"><i></i></button>`;
const row = (title: string, sub: string, end = "", cls = "", id = "") =>
  `<div class="srow ${cls}"${id ? ` id="${id}"` : ""}><div class="stx"><b>${title}</b>${sub ? `<small>${sub}</small>` : ""}</div>${end}</div>`;

const cleared = () => LEVELS.filter(d => isDone(d.id)).length;
const pct = () => `${Math.round((100 * cleared()) / LEVELS.length)}%`;
const version = () => IS_DEV ? t("set.devBuild") : "v" + __VERSION__;
/** the dev build also says which commit (and branch) it is */
const versionLong = () => IS_DEV ? `${t("set.devBuild")} · ${DEV_BUILD}` : version();

/** one choice in the language list: Automatic, then each language in its own name */
function langRow(id: LangId | "auto"){
  const sel = langSetting() === id;
  const title = id === "auto" ? t("lang.auto") : langName(id);
  const sub = id === "auto" ? t("lang.autoSub", { lang: langName(deviceLang()) }) : "";
  return row(title, sub, `<span class="send">${sel ? CHECK : ""}</span>`, "link pick" + (sel ? " sel" : ""), `lang-${id}`);
}

const SECTIONS: Section[] = [
  {
    id: "sound", name: () => t("set.sound"), peek: () => soundOn() || musicOn() ? t("set.on") : t("set.off"),
    body: () => row(t("set.music"), t("set.musicSub"), sw("optMusic", musicOn()))
      + row(t("set.sfx"), t("set.sfxSub"), sw("optSfx", soundOn())),
  },
  {
    id: "language", name: () => t("set.language"), peek: () => langName(lang()),
    body: () => `<p class="snote">${t("set.languageSub")}</p><div class="slist">` + langRow("auto") + LANGS.map(l => langRow(l.id)).join("") + `</div>`,
  },
  {
    id: "controls", name: () => t("set.controls"), peek: () => "",
    body: () => `<div class="sdemo"><span class="sk">L</span><canvas id="setStage"></canvas><span class="sk">R</span></div>`
      + row(t("set.buttons"), t("set.buttonsSub"))
      + row(t("set.tapBoard"), t("set.tapBoardSub"))
      + row(t("set.keyboard"), t("set.keyboardSub"))
      + row(t("set.haptics"), t("set.hapticsSub"), sw("optHaptics", hapticsOn())),
  },
  {
    id: "help", name: () => t("set.help"), peek: () => "",
    body: () => row(t("how.title"), t("set.howSub"), `<span class="send">${CHEVRON}</span>`, "link", "setHow"),
  },
  {
    id: "save", name: () => t("set.save"), peek: pct,
    body: () => row(t("set.progress"), t("set.progressSub", { a: cleared(), b: LEVELS.length }), `<span class="send">${pct()}</span>`)
      + row(t("set.reset"), t("set.resetSub"), `<span class="send">${CHEVRON}</span>`, "link danger", "setReset"),
  },
  {
    id: "about", name: () => t("set.about"), peek: version,
    body: () => row(t("set.version"), t("set.versionSub", { v: versionLong(), n: LEVELS.length }))
      + row(t("set.madeBy"), "Playcebo Games"),
  },
];

/** the open section; kept while the app runs */
let open: SectionId = "sound";
let t0 = 0;

/** what to redraw when the language changes: the main menu on this tab (set by menus.ts) */
let onLang = () => render();
export function onLanguage(fn: () => void){ onLang = fn; }

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
    b.innerHTML = `${s.name()}<small>${s.peek()}</small>`;
    b.onclick = () => { sfx("click"); open = s.id; render(); };
    nav.appendChild(b);
  }
  const sec = SECTIONS.find(s => s.id === open)!;
  $("setBody").innerHTML = `<h3>${sec.name()}</h3>` + sec.body();
  wire();
}

/** the rows that do something */
function wire(){
  const sfxSw = document.getElementById("optSfx");
  if (sfxSw) sfxSw.onclick = () => { setSound(!soundOn()); writeSave(); sfx("click"); render(); };
  const hapSw = document.getElementById("optHaptics");
  if (hapSw) hapSw.onclick = () => { setHaptics(!hapticsOn()); writeSave(); sfx("click"); buzz("press"); render(); };
  const musicSw = document.getElementById("optMusic");
  if (musicSw) musicSw.onclick = () => { setMusic(!musicOn()); writeSave(); sfx("click"); render(); };
  const how = document.getElementById("setHow");
  if (how) how.onclick = () => { sfx("click"); openHowTo(); };
  const reset = document.getElementById("setReset");
  // a language applies at once: the fixed text, the menu's top line and this tab
  for (const id of ["auto", ...LANGS.map(l => l.id)] as (LangId | "auto")[]) {
    const el = document.getElementById(`lang-${id}`);
    if (el) el.onclick = () => { sfx("click"); setLang(id); onLang(); };
  }
  if (reset) reset.onclick = () => { sfx("click"); if (confirm(t("set.resetAsk"))) { resetSave(); render(); } };
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
