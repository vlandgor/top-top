import type { Boot } from "../core/types";
import { input, pause, restart, S } from "../game/session";
import { $, showPause, unpause } from "../ui/menus";

// CONTROLS — one button per boot, on each side of the board, or tap the left / right half of
// the board. Keys: A / ← the left boot · D / → the right boot · R restart · Esc pause.
function tap(who: Boot){
  input(who);
  const b = $(who === 0 ? "bLeft" : "bRight");
  b.classList.add("hit"); setTimeout(() => b.classList.remove("hit"), 90);
}

export function initControls(){
  // pointerdown, not click: a swing should land the instant the finger does
  $("bLeft").addEventListener("pointerdown", e => { e.preventDefault(); tap(0); });
  $("bRight").addEventListener("pointerdown", e => { e.preventDefault(); tap(1); });
  $("stage").addEventListener("pointerdown", e => {
    if ((e.target as HTMLElement).closest("button")) return;
    const r = $("stage").getBoundingClientRect();
    tap(e.clientX - r.left < r.width / 2 ? 0 : 1);
  });
  window.addEventListener("keydown", e => {
    if (e.repeat) return;
    const k = e.key.toLowerCase();
    if (k === "arrowleft" || k === "a") { tap(0); e.preventDefault(); }
    else if (k === "arrowright" || k === "d") { tap(1); e.preventDefault(); }
    else if (k === "r" && (S.screen === "play" || S.screen === "paused")) { S.attempt++; restart(); unpause(); }
    else if (k === "escape") {
      if (S.screen === "play") { pause(); showPause(); }
      else if (S.screen === "paused") unpause();
    }
  });
}
