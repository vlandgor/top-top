import type { Boot, LevelDef, Run } from "../core/types";
import { sfx } from "../audio/audio";
import { buzz } from "../platform/haptics";
import { advance, newRun, press } from "../game/rules";
import { TICK_MS } from "../game/session";
import { parseLevel } from "../levels/parse";
import { drawDemo } from "../render/draw";
import { $, screenOn, show } from "./menus";
import { t } from "../i18n";

// ---------------------------------------------------------------------------
// HOW TO PLAY — four short lessons, each tried on a small board with the real rules: the
// buttons on each side of the board (or its left / right half, or A / ← and D / →) swing
// the boots. A lesson ticks off when you have done the thing; Next moves on, Skip jumps
// ahead, and tapping a lesson in the list opens it. Nothing here is saved.
// ---------------------------------------------------------------------------

interface Lesson {
  name: string; title: string; text: string; task: string;
  def: LevelDef;
  /** whether the lesson is done, after a press (or a tick) */
  done: (r: Run, t: Track) => boolean;
}
/** what the player has done on the board so far */
interface Track { streak: number; lastBoot: Boot | -1; backs: number }

/** a lesson's text in the current language (i18n: how.<id>...) */
const words = (id: "walk" | "turn" | "edge" | "danger") => ({
  get name(){ return t(`how.${id}`); },
  get title(){ return t(`how.${id}.title`); },
  get text(){ return t(`how.${id}.text`); },
  get task(){ return t(`how.${id}.task`); },
});

const lesson = (id: string, map: string[], extra: Partial<LevelDef> = {}): LevelDef =>
  ({ id: `how-${id}`, name: id, mode: "destination", beat: 6, map, ...extra });

const LESSONS: Lesson[] = [
  {
    ...words("walk"),
    def: lesson("walk", ["......", ".AB..G", "......"]),
    done: r => r.status === "won",
  },
  {
    ...words("turn"),
    def: lesson("turn", [".....", ".AB..", "....."]),
    done: (_r, t) => t.streak >= 4,
  },
  {
    ...words("edge"),
    def: lesson("edge", ["......", "..AB..", "......"]),
    done: (_r, t) => t.backs > 0,
  },
  {
    ...words("danger"),
    def: lesson("danger", ["......", "AB...G", "......"], { sentries: [{ path: "3,0 3,2", phase: 0 }] }),
    done: r => r.status === "won",
  },
];

let at = 0;                                   // the open lesson
const done = new Set<number>();               // lessons done since the app started
let run: Run;
let track: Track;
let t0 = 0, deadAt = 0;
let queued: Boot | -1 = -1;                   // a press during a used tick waits for the next one

/** open How to play at the first lesson not done yet */
export function openHowTo(){
  const first = LESSONS.findIndex((_, i) => !done.has(i));
  goLesson(first < 0 ? 0 : first);
  show("sHow");
}

function goLesson(i: number){
  at = i;
  restartLesson();
  render();
}

function restartLesson(){
  run = newRun(parseLevel(LESSONS[at].def));
  track = { streak: 0, lastBoot: -1, backs: 0 };
  t0 = performance.now() / 1000; deadAt = 0; queued = -1;
}

function render(){
  const L = LESSONS[at], isDone = done.has(at), last = at === LESSONS.length - 1;
  const steps = $("hwSteps"); steps.innerHTML = "";
  LESSONS.forEach((x, i) => {
    const b = document.createElement("button");
    b.className = "hwstep" + (i === at ? " now" : "") + (done.has(i) ? " done" : "");
    b.innerHTML = `<span>${done.has(i) ? "✓" : i + 1}</span>${x.name}`;
    b.onclick = () => { sfx("click"); goLesson(i); };
    steps.appendChild(b);
  });
  $("hwSub").textContent = t("how.lessonOf", { a: at + 1, b: LESSONS.length });
  $("hwTag").textContent = t("how.lessonTag", { n: at + 1, name: L.name });
  $("hwTitle").textContent = L.title;
  $("hwText").textContent = L.text;
  $("hwTask").textContent = isDone ? t("how.done") : t("how.try", { task: L.task });
  $("hwTask").classList.toggle("ok", isDone);
  const next = $<HTMLButtonElement>("hwNext");
  next.style.display = isDone ? "" : "none";
  next.textContent = last ? t("how.finish") : t("how.next");
  $("hwSkip").style.display = isDone ? "none" : "";
  $("hwSkip").textContent = last ? t("close") : t("how.skip");
}

/** a press of one boot on the lesson board */
function tap(who: Boot){
  if (!screenOn("sHow") || run.status !== "play") return;
  if (!press(run, who)) { queued = who; return; }
  pressed(who);
}

function pressed(who: Boot){
  sfx(run.last?.result === "back" ? "bump" : who === 0 ? "stepL" : "stepR");
  buzz(run.last?.result === "back" ? "bump" : "press");
  track.streak = track.lastBoot === who ? track.streak + 1 : 1;
  track.lastBoot = who;
  if (run.last?.result === "back") track.backs++;
  check();
}

function check(){
  if (done.has(at) || !LESSONS[at].done(run, track)) return;
  done.add(at);
  sfx("win");
  render();
}

function onNext(){
  if (at === LESSONS.length - 1) { $("bHowOk").click(); return; }
  goLesson(at + 1);
}

/** every frame while How to play is open: time runs (for the sentry), then the board is drawn */
export function drawHowTo(){
  if (!screenOn("sHow")) return;
  const now = performance.now() / 1000, t = now - t0;
  // a lesson board that is lost starts over after a moment
  if (run.status === "dead") {
    if (!deadAt) { deadAt = now; sfx("die"); buzz("hit"); }
    else if (now - deadAt > 0.6) restartLesson();
  } else {
    const want = Math.floor((t * 1000) / TICK_MS);
    while (run.tick < want && run.status === "play") {
      advance(run);
      const q = queued;
      if (q !== -1 && press(run, q)) { queued = -1; pressed(q); }
    }
    check();
  }
  const cv = $<HTMLCanvasElement>("hwCv");
  const dpr = Math.min(2, window.devicePixelRatio || 1), w = cv.clientWidth, h = cv.clientHeight;
  if (!w || !h) return;
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  const c = cv.getContext("2d")!;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawDemo(c, w, h, run, t, TICK_MS);
}

export function initHowTo(){
  // the left / right half of the lesson board (the side buttons included) presses that boot
  $("hwStage").addEventListener("pointerdown", e => {
    e.preventDefault();
    const r = $("hwStage").getBoundingClientRect();
    tap(e.clientX - r.left < r.width / 2 ? 0 : 1);
  });
  window.addEventListener("keydown", e => {
    if (!screenOn("sHow") || e.repeat) return;
    const k = e.key.toLowerCase();
    if (k === "arrowleft" || k === "a") tap(0);
    else if (k === "arrowright" || k === "d") tap(1);
  });
  $("hwNext").addEventListener("click", () => { sfx("click"); onNext(); });
  $("hwSkip").addEventListener("click", () => { sfx("click"); onNext(); });
}
