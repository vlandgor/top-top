// Prepares the "Top Top Dev" Android build (the `dev` build type in android/app/build.gradle).
//
// The dev app doesn't play the game bundled inside it: it loads the latest build from GitHub
// Pages, which the "Dev web build" workflow redeploys on every push to main. Run this after
// `npx cap sync android`. It writes, into android/app/src/dev/assets/ (git-ignored):
//   capacitor.config.json  the synced config plus server.url, overriding the main one in dev builds
//   public/offline.html    the page Capacitor shows when the game can't be loaded
//
// DEV_URL overrides the address, e.g. DEV_URL=http://192.168.1.20:5173/ for a local dev server.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const url = process.env.DEV_URL || "https://vlandgor.github.io/top-top/";
const out = join(root, "android/app/src/dev/assets");

const synced = join(root, "android/app/src/main/assets/capacitor.config.json");
let config;
try { config = JSON.parse(readFileSync(synced, "utf8")); }
catch { console.error(`No ${synced}. Run \`npx cap sync android\` first.`); process.exit(1); }

config.server = {
  ...config.server,
  url,
  cleartext: url.startsWith("http:"),   // only needed for a local dev server
  errorPath: "offline.html",            // served from the bundled files when url fails
};

mkdirSync(join(out, "public"), { recursive: true });
writeFileSync(join(out, "capacitor.config.json"), JSON.stringify(config, null, "\t") + "\n");
writeFileSync(join(out, "public/offline.html"),
  readFileSync(join(root, "tools/dev-offline.html"), "utf8").replaceAll("__DEV_URL__", url));
console.log(`Top Top Dev will load ${url}`);
