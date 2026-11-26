import "./ui/styles/global.css";
import { initAudio } from "./audio/audio";
import { update } from "./game/session";
import { initControls } from "./input/controls";
import { initDev } from "./platform/dev";
import { initNative } from "./platform/native";
import { initCanvas, resize } from "./render/canvas";
import { draw, drawLogo } from "./render/draw";
import { $, drawPreviews, goMenu, initMenus, syncHud } from "./ui/menus";

// boot: wire inputs and screens, then run the frame loop. Game time moves in fixed ticks
// inside update(); drawing happens once per animation frame.
const logo = ($("logoCv") as HTMLCanvasElement).getContext("2d")!;
let last = 0;
function loop(ts: number){
  const dt = last ? Math.min(0.05, (ts - last) / 1000) : 0; last = ts;
  update(dt);
  draw();
  syncHud();
  if ($("sMenu").classList.contains("on")) drawLogo(logo, ts / 1000);
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

initAudio(); initCanvas(); initControls(); initMenus(); initNative(); initDev();
resize(); goMenu();
requestAnimationFrame(loop);
