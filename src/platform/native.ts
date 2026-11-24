import { resumeAudio, sfx, suspendAudio } from "../audio/audio";
import { pause, S } from "../game/session";
import { back, goLevels, showPause, unpause } from "../ui/menus";

// ---- inside the Android app (Capacitor). in a plain browser this does nothing.
// the hardware back button steps back one screen; on the main menu it leaves the app.
function app(){ return window.Capacitor?.Plugins?.App; }

function onBack(){
  if (S.screen === "play") { pause(); showPause(); return; }
  if (S.screen === "paused") { unpause(); return; }
  if (S.screen === "won") { goLevels(S.def?.mode); return; }
  if (back()) return;
  app()?.exitApp();
}

export function initNative(){
  const App = app();
  if (!App?.addListener) return;
  App.addListener("backButton", () => { sfx("click"); onBack(); });
  App.addListener("pause", () => { if (S.screen === "play") { pause(); showPause(); } suspendAudio(); });
  App.addListener("resume", () => resumeAudio());
}
