/// <reference types="vitest" />
import { readFileSync } from "node:fs";
import { defineConfig } from "vite";

const pkg = JSON.parse(readFileSync("./package.json", "utf8"));

// base './' so the build works from any path: the Capacitor webview, GitHub Pages, file://
export default defineConfig({
  base: "./",
  define: { __VERSION__: JSON.stringify(pkg.version) },
  build: { target: "es2020", assetsInlineLimit: 0 },
  // the level tests run a full solver on every level
  test: { environment: "node", testTimeout: 60000 },
});
