import { S } from "../game/session";

// ---------------------------------------------------------------------------
// DEV CHANNEL — the build on GitHub Pages that the "Top Top Dev" app loads. The
// "Dev web build" workflow builds it with VITE_CHANNEL=dev and VITE_COMMIT=<sha>.
// Every other build (the Play app, npm run dev) leaves IS_DEV false and this does nothing.
// ---------------------------------------------------------------------------
export const IS_DEV = import.meta.env.VITE_CHANNEL === "dev";
const COMMIT = String(import.meta.env.VITE_COMMIT || "local").slice(0, 7);

// a cold start always fetches the newest page. this covers the other case: the app was in
// the background and is brought back while a newer build is live.
function checkForUpdate(){
  fetch("./version.json", { cache: "no-store" })
    .then(r => r.ok ? r.json() : null)
    .then((v: { commit?: string } | null) => {
      if (!v || !v.commit || v.commit.slice(0, 7) === COMMIT) return;
      if (S.screen === "play" || S.screen === "paused") return;   // never drop a level; the next resume checks again
      location.reload();
    })
    .catch(() => {});                                               // offline: keep playing this build
}

export function initDev(){
  if (!IS_DEV) return;
  // which commit is running, on the main menu only
  const tag = document.createElement("div");
  tag.textContent = "DEV · " + COMMIT;
  tag.className = "devtag";
  document.getElementById("sMenu")?.appendChild(tag);

  const App = window.Capacitor?.Plugins?.App;
  if (App?.addListener) App.addListener("resume", checkForUpdate);
}
