# Top Top

A minimalist puzzle-arcade game by Playcebo Games, played in landscape. You don't steer a
character: you steer a pair of boots that are always stuck next to each other. Each button
swings its boot around the other one; the left boot always turns clockwise, the right one
counterclockwise, and at the edge a boot steps back to make room for the other. Plan the
presses, read the hazard patterns, and walk the boots heel to heel across a neon dance floor.

Written in TypeScript and built with Vite. No engine: graphics are drawn on a 2D canvas and
audio is synthesised with Web Audio, all in code. The design is in
[`docs/game-design.md`](docs/game-design.md).

## Running it

Needs Node 22.

```
npm ci
npm run dev        # local server with hot reload
npm test           # rules tests, and the solver proving every level can be beaten
npm run build      # strict type-check, then a production build into dist/
npm run solve      # level design: fewest presses and time for each level (npm run solve d3 r2)
npm run gen-levels # regenerate the levels of one or more modes (npm run gen-levels waves)
npm run reprove    # after a rules change: re-solve every level, rewriting only its proof
```

On a desktop: A / ← presses the left boot, D / → the right one, R restarts, Esc pauses.
On a phone: the button on each side of the board, or tap the left / right half of the board.

## Repository layout

| Path | What it is |
|---|---|
| `index.html` | The page: canvas, HUD, the two boot buttons and the menu screens. |
| `src/main.ts` | Boot and the frame loop. |
| `src/core/` | Data types and the eight directions. |
| `src/game/rules.ts` | **The game rules**, as pure functions: the Chick Mates movement, ticks, pickups, deaths, wins. |
| `src/game/hazards.ts` | Where danger is at any beat: sentries and grid-wide sweeps. Pure and deterministic. |
| `src/game/solver.ts` | Breadth-first solver over the rules. Proves levels are beatable; meant for the level editor too. |
| `src/game/session.ts` | The live game around the rules: real time, input buffering, instant retry, attempts. |
| `src/levels/` | The levels (ASCII maps plus hazard lists) and their parser. |
| `src/render/` | Canvas, palette, the boot drawing, and drawing a frame. |
| `src/ui/` | Menus, level select, HUD, styles. |
| `src/input/` | Buttons, screen halves and keyboard. |
| `src/audio/` | Synthesised sound effects. |
| `src/platform/` | Capacitor glue: the Android back button, app pause/resume, the dev channel. |
| `src/storage/` | The save (cleared levels, attempts, settings) in localStorage. |
| `tools/` | The dev-app shell, the level solver CLI, and the icon art. |

## Making levels

There are 20 levels per mode, one file per mode in `src/levels/` (`destination.ts`,
`collect.ts`, …). They're made by `tools/gen-levels.ts`, which for every slot:

1. builds candidate levels from that slot's recipe. Boards grow, beats speed up, and each
   hazard type arrives on its own (slow, with a tip) before it is mixed with others;
2. throws away unfair ones: nothing may reach you for the first 3 s (2 s after level 10), and
   hazards must actually block the easy route;
3. solves the rest at a human pace and scores them: presses needed, how often you must wait
   for something to pass, and whether a slower player could still make it;
4. picks the candidate that fits a smoothly rising difficulty curve.

Each level is saved with its `proof`, a winning input. `npm test` replays every proof
through the rules (checking presses are at least 2 ticks apart), so all 100 levels are proven
beatable in under a second; `SOLVE=1 npm test` also re-solves them from scratch.
`npm run gen-levels collect` regenerates one mode (it is seeded, so unchanged recipes give
the same levels). Names and tips can be edited in the level files directly.

A level is a map plus hazards:

```ts
{
  id: "d3", name: "Patrol", mode: "destination",
  map: [
    "...G...",            // .  floor     A  left boot      B  right boot
    ".......",            // G  goal      o  collectible    1-9  sequence order
    "..AB...",
  ],
  sentries: [{ path: "0,1 6,1" }],                       // waypoints, one tile per beat
  sweeps: [{ dir: "diag", start: 4, every: 8, gaps: [6, 7] }],
}
```

## Android

The game is wrapped for Android with [Capacitor](https://capacitorjs.com). `android/` is the
native project; `capacitor.config.json` holds the app ID (`com.playcebo.toptop`) and name.
Capacitor ships the Vite build in `dist/`, so run `npm run build` before `npx cap sync`
(the `sync` and `android:*` scripts do this for you).

**Builds run on GitHub.** Every push and pull request runs the *Android build* workflow
(`.github/workflows/android.yml`). Download the results from the run's **Artifacts**:

- `top-top-debug-…`: a debug APK you can install straight onto a phone.
- `top-top-release-…`: a signed AAB for Google Play, plus a signed APK. This appears only
  once the signing secrets below are set.

To build a specific version, open **Actions → Android build → Run workflow** and enter a
version name. The version code goes up automatically with every run, as Play requires.

**Release signing.** Add these under *Settings → Secrets and variables → Actions*:

| Secret | Value |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | your upload keystore, base64-encoded |
| `ANDROID_KEYSTORE_PASSWORD` | keystore password |
| `ANDROID_KEY_ALIAS` | key alias |
| `ANDROID_KEY_PASSWORD` | key password |

The keystore never goes in the repository; `.gitignore` blocks it.

**Building locally** needs Node 22 and JDK 21: `npm ci`, then `npm run android:debug`.

### Top Top Dev

A second app for testing on a phone. It's named **Top Top Dev** (`com.playcebo.toptop.dev`),
so it installs alongside the real app and can't be confused with it. Instead of the bundled
game it loads the newest build from **https://vlandgor.github.io/top-top/**:

- Every push to `main` redeploys that page (`.github/workflows/dev-web.yml`). The next time
  the app opens, it runs the new commit; no reinstall needed. If it was only in the
  background, it reloads on resume when a newer build is live, but never in the middle of a
  level.
- The main menu shows `DEV · <commit>`, so you can see which build is running.
- Every level is unlocked.
- Offline, it shows a small "Retry" page instead of the game.
- Its saves are separate from the real app's.

**Install it** from the fixed link
<https://github.com/vlandgor/top-top/releases/download/dev/top-top-dev.apk>. The *Android
build* workflow rebuilds it on every push to `main` and publishes it to the `dev`
pre-release. You only need a new APK when the native side changes (plugins, permissions,
icons, `MainActivity`). It's signed with the upload key once the signing secrets are set,
so a new dev APK installs over the old one. Until then it's signed with a throwaway debug
key that changes each run, so uninstall before installing a newer APK.

How it's built: the `dev` build type in `android/app/build.gradle` sets the name and ID,
and `tools/dev-shell.mjs` writes its Capacitor config (the `server.url`) and offline page
into `android/app/src/dev/assets/` after `cap sync`. Locally: `npm run android:dev`;
`DEV_URL=http://<your-ip>:5173/ npm run android:dev` points it at your `npm run dev`
server instead.

**One-time setup:** Settings → Pages → Build and deployment → Source: **GitHub Actions**.

## Icon, splash and store art

All of it is drawn in code in `tools/icons/art.py` and rendered by
`python3 tools/icons/make.py` (needs `rsvg-convert` and Pillow): the Android adaptive
launcher icon (with a monochrome layer for themed icons), legacy icons, the splash,
`store/icon-512.png`, `store/feature-graphic-1024x500.png` and `public/icon.svg`.

## Releasing

Builds are named after the game and version: `top-top-<version>-<code>-release.aab`
(upload this one to Play), `…-release.apk` and `…-debug.apk`. The version name comes from
`package.json` (or the *Run workflow* input) and the code from the run number.
