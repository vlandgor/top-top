// Level design helper: solves levels and prints how hard they are at a human pace.
//   npm run solve            every level
//   npm run solve d3 r2      just these
// "presses" is the fewest taps a perfect player needs; low presses in Survival means there is
// somewhere safe to stand still.
import { LEVELS } from "../src/levels/levels";
import { parseLevel } from "../src/levels/parse";
import { solve } from "../src/game/solver";

const ids = process.argv.slice(2);
for (const def of LEVELS.filter(l => !ids.length || ids.includes(l.id))) {
  const lv = parseLevel(def), t = Date.now();
  const s = solve(lv, { cooldown: 2 });
  const res = s ? `${String(s.presses).padStart(3)} presses  ${(s.ticks / lv.beat).toFixed(1).padStart(5)} beats` : "  NO SOLUTION";
  console.log(`${def.id.padEnd(4)} ${def.name.padEnd(18)} ${res}   (${Date.now() - t} ms)`);
}
