// After a rules change: re-solve every level and rewrite only its proof (the stored winning
// input) and the presses/beats note above it. Maps and hazards are not touched.
//   npm run reprove                 every mode
//   npm run reprove waves survival  just these
// A level the solver can't beat at a human pace is reported and left as it was.
import { readFileSync, writeFileSync } from "node:fs";
import type { LevelDef, Mode } from "../src/core/types";
import { DESTINATION } from "../src/levels/destination";
import { COLLECT } from "../src/levels/collect";
import { SEQUENCE } from "../src/levels/sequence";
import { SURVIVAL } from "../src/levels/survival";
import { WAVES } from "../src/levels/waves";
import { parseLevel } from "../src/levels/parse";
import { encodeProof, solve } from "../src/game/solver";

const ALL: Record<Mode, LevelDef[]> = { destination: DESTINATION, collect: COLLECT, sequence: SEQUENCE, survival: SURVIVAL, waves: WAVES };
const modes = (process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(ALL)) as Mode[];
let failed = 0;
for (const m of modes) {
  const file = `src/levels/${m}.ts`;
  let src = readFileSync(file, "utf8");
  for (const d of ALL[m]) {
    const lv = parseLevel(d), t = Date.now();
    const sol = solve(lv, { cooldown: 2, maxTicks: 1200 });
    if (!sol) { console.log(`${d.id.padEnd(4)} NO SOLUTION, left unchanged`); failed++; continue; }
    const proof = encodeProof(sol.actions);
    src = src.replace(`proof: ${JSON.stringify(d.proof)},`, `proof: ${JSON.stringify(proof)},`);
    src = src.replace(new RegExp(`(// +${d.id.slice(1)}\\. difficulty \\d+: )\\d+ presses, \\d+ beats`), `$1${sol.presses} presses, ${Math.round(sol.ticks / lv.beat)} beats`);
    console.log(`${d.id.padEnd(4)} ${String(sol.presses).padStart(3)} presses ${(sol.ticks / lv.beat).toFixed(0).padStart(3)} beats  (${Date.now() - t} ms)`);
  }
  writeFileSync(file, src);
}
if (failed) { console.log(`${failed} level(s) have no solution under the current rules`); process.exit(1); }
