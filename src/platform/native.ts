import { resumeAudio, sfx, suspendAudio } from "../audio/audio";
import { S } from "../game/session";
import { M } from "../game/match";
import { back, leaveSolo, pauseAny, unpause } from "../ui/menus";

// ---- inside the Android app (Capacitor). in a plain browser this does nothing.
// the hardware back button steps back one screen; on the main menu it leaves the app.
function app(){ return window.Capacitor?.Plugins?.App; }

function onBack(){
  if (M.active && M.phase !== "over") { if (M.phase === "paused") unpause(); else pauseAny(); return; }
  if (S.screen === "play") { pauseAny(); return; }
  if (S.screen === "paused") { unpause(); return; }
  if (S.screen === "won") { leaveSolo(); return; }
  if (back()) return;
  app()?.exitApp();
}

export function initNative(){
  const App = app();
  if (!App?.addListener) return;
  App.addListener("backButton", () => { sfx("click"); onBack(); });
  App.addListener("pause", () => { if (S.screen === "play" || M.active) pauseAny(); suspendAudio(); });
  App.addListener("resume", () => resumeAudio());
}
