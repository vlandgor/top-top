import "./ui/styles/global.css";
import { initAudio } from "./audio/audio";
import { initI18n } from "./i18n";
import { update } from "./game/session";
import { updateMatch } from "./game/match";
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
  draw();
  syncHud();
  drawPreviews();
  requestAnimationFrame(loop);
}

// landscape only: also ask the browser to lock it (works in the app and in fullscreen browsers;
// elsewhere it is refused and the "turn your phone" screen covers portrait)
function lockLandscape(){
  const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
  o?.lock?.("landscape").catch(() => {});
}
lockLandscape();
window.addEventListener("pointerdown", lockLandscape, { once: true });

initI18n(); initAudio(); initCanvas(); initControls(); initMenus(); initNative(); initDev();
resize(); goMenu();
requestAnimationFrame(loop);
