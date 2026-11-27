import "./ui/styles/global.css";
import { initAudio } from "./audio/audio";
import { setTickMs, updateMusic, type Transport } from "./audio/music";
import { initI18n } from "./i18n";
import { S, TICK_MS, tickF, update } from "./game/session";
import { COUNTDOWN_S, M, matchTickF, updateMatch } from "./game/match";
import { initControls } from "./input/controls";
import { initDev } from "./platform/dev";
import { initNative } from "./platform/native";
import { initCanvas, resize } from "./render/canvas";
import { draw } from "./render/draw";
import { drawPreviews, goMenu, initMenus, syncHud } from "./ui/menus";

// boot: wire inputs and screens, then run the frame loop. Game time moves in fixed ticks
// inside update(); drawing happens once per animation frame.
let last = 0;
function loop(ts: number){
  const dt = last ? Math.min(0.05, (ts - last) / 1000) : 0; last = ts;
  update(dt);
  updateMatch(dt);
  updateMusic(transport());
  draw();
  syncHud();
  drawPreviews();
  requestAnimationFrame(loop);
}

/** where the game's clock is, for the music: a level, a co-op room, or null on menus */
function transport(): Transport | null {
  const r = M.room;
  if (M.active && r && M.def && M.lv) {
    // the first countdown clicks the beat in; after a pause it just waits for play
    const countIn = M.phase === "count" && r.tick === 0;
    return {
      id: "room:" + M.def.id, track: M.def.mode, beat: M.lv.beat,
      tickF: countIn ? -(COUNTDOWN_S - (M.now - M.phaseAt)) * 1000 / TICK_MS : matchTickF(),
      playing: r.status === "play" && (M.phase === "play" || countIn),
    };
  }
  if (S.def && S.lv && (S.screen === "play" || S.screen === "paused"))
    return { id: S.def.id, track: S.def.mode, beat: S.lv.beat, tickF: tickF(), playing: S.screen === "play" && S.run?.status === "play" };
  return null;
}

// landscape only: also ask the browser to lock it (works in the app and in fullscreen browsers;
// elsewhere it is refused and the "turn your phone" screen covers portrait)
function lockLandscape(){
  const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
  o?.lock?.("landscape").catch(() => {});
}
lockLandscape();
window.addEventListener("pointerdown", lockLandscape, { once: true });

initI18n(); initAudio(); setTickMs(TICK_MS); initCanvas(); initControls(); initMenus(); initNative(); initDev();
resize(); goMenu();
requestAnimationFrame(loop);
