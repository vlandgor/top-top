import type { Turn } from "../core/types";
import { input, pause, restart, S } from "../game/session";
import { $, showPause, unpause } from "../ui/menus";

// CONTROLS — two buttons under the board, or tap the left / right half of the board.
// Keys: ← A Q counterclockwise · → D E clockwise · R restart · Esc pause.
function tap(turn: Turn){
  input(turn);
  const b = $(turn === 1 ? "bCW" : "bCCW");
  b.classList.add("hit"); setTimeout(() => b.classList.remove("hit"), 90);
}

export function initControls(){
  // pointerdown, not click: a swing should land the instant the finger does
  $("bCCW").addEventListener("pointerdown", e => { e.preventDefault(); tap(-1); });
  $("bCW").addEventListener("pointerdown", e => { e.preventDefault(); tap(1); });
  $("stage").addEventListener("pointerdown", e => {
    if ((e.target as HTMLElement).closest("button")) return;
    const r = $("stage").getBoundingClientRect();
    tap(e.clientX - r.left < r.width / 2 ? -1 : 1);
  });
  window.addEventListener("keydown", e => {
    if (e.repeat) return;
    const k = e.key.toLowerCase();
    if (k === "arrowleft" || k === "a" || k === "q") { tap(-1); e.preventDefault(); }
    else if (k === "arrowright" || k === "d" || k === "e") { tap(1); e.preventDefault(); }
    else if (k === "r" && (S.screen === "play" || S.screen === "paused")) { S.attempt++; restart(); unpause(); }
    else if (k === "escape") {
      if (S.screen === "play") { pause(); showPause(); }
      else if (S.screen === "paused") unpause();
    }
  });
}
