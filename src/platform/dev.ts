import { S } from "../game/session";

// ---------------------------------------------------------------------------
// DEV CHANNEL — the build on GitHub Pages that the "Top Top Dev" app loads. The
// "Dev web build" workflow builds it with VITE_CHANNEL=dev and VITE_COMMIT=<sha>.
// Every other build (the Play app, npm run dev) leaves IS_DEV false and this does nothing.
// ---------------------------------------------------------------------------
export const IS_DEV = import.meta.env.VITE_CHANNEL === "dev";
const COMMIT = String(import.meta.env.VITE_COMMIT || "local").slice(0, 7);
/** shown next to the commit when the build isn't from main */
const BRANCH = String(import.meta.env.VITE_BRANCH || "main");

// GitHub Pages lets the app's web view keep the page for up to 10 minutes, so even a cold start
// can open the previous build. So on every start and every resume, ask for version.json
// (never cached) and, if a newer build is live, open the page at an address with the new
// commit in it (?v=...), which the cache has never seen. Hashed asset names do the rest.
function checkForUpdate(){
  fetch("./version.json?t=" + Date.now(), { cache: "no-store" })
    .then(r => r.ok ? r.json() : null)
    .then((v: { commit?: string } | null) => {
      const live = v?.commit?.slice(0, 7);
      if (!live || live === COMMIT) return;
      // already sent to this commit's address and still old: Pages hasn't caught up; don't loop
      if (new URLSearchParams(location.search).get("v") === live) return;
      if (S.screen === "play" || S.screen === "paused") return;   // never drop a level; the next resume checks again
      location.replace(location.pathname + "?v=" + live);
    })
    .catch(() => {});                                               // offline: keep playing this build
}

export function initDev(){
  if (!IS_DEV) return;
  // which commit is running, on the main menu only
  const tag = document.createElement("div");
  tag.textContent = "DEV · " + (BRANCH === "main" ? "" : BRANCH + " · ") + COMMIT;
  tag.className = "devtag";
  document.getElementById("sMenu")?.appendChild(tag);
  // an older Top Top Dev install was locked to portrait and can't turn: say what to do
  const rot = document.querySelector("#rotate span");
  if (rot && window.Capacitor) rot.textContent = "If the app won't turn, reinstall Top Top Dev from the dev release";

  const App = window.Capacitor?.Plugins?.App;
  if (App?.addListener) App.addListener("resume", checkForUpdate);
  checkForUpdate();
}
