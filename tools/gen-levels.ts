// ---------------------------------------------------------------------------
// LEVEL GENERATOR — builds the 20 levels of a mode with a smooth difficulty curve.
//
//   npm run gen-levels                 all five modes
//   npm run gen-levels survival waves  just these
//
// For every slot it builds candidate levels from that slot's recipe (board size, beat speed
// and which hazards are allowed grow slowly, one new idea at a time), throws away unfair ones,
// solves the rest at a human pace, scores them, and picks the candidate that best fits a rising
// difficulty curve. Output goes to src/levels/<mode>.ts with each level's proof (a winning
// input), so the tests can replay every level quickly.
//
// It is seeded, so the same recipes give the same levels. Change a recipe or a seed and
// re-run; edit the output by hand only for names and hints.
// ---------------------------------------------------------------------------
import { writeFileSync } from "node:fs";
import type { Mode } from "../src/core/types";
import { COUNT, judge, RECIPES, rngOf, type Judged } from "../src/levels/generator";

const CANDIDATES = Number(process.env.CANDIDATES || 8);

// ---- names and tips -----------------------------------------------------------------------
const NAMES: Record<Mode, string[]> = {
  destination: ["First Steps", "Side Step", "Into the Corner", "Patrol", "Crosswalk", "Night Shift", "Two Step", "Double Guard",
    "Back and Forth", "Checkpoint", "Box Step", "Ring Road", "Gridlock", "Waterfall", "Undercurrent", "Downpour",
    "Floodlight", "Last Dance", "Stage Dive", "Encore"],
  collect: ["Pick Up", "Pair of Lights", "Scatter", "Watchman", "Lantern Walk", "Fireflies", "Spotlights", "Night Market",
    "Glow Sticks", "Two Patrols", "Neon Garden", "Light Show", "Laser Grid", "Strobe", "Rain Lights", "Sweep Up",
    "Afterglow", "Full House", "Blackout", "Grand Finale"],
  sequence: ["One Two", "Count Up", "Zig Zag", "Watch the Order", "Steady Count", "Choreography", "Step Pattern", "Routine",
    "Counterpoint", "Call and Response", "Combination", "Rehearsal", "Syncopation", "Cascade", "Off Beat", "Rondo",
    "Crescendo", "Polyrhythm", "Showcase", "Curtain Call"],
  survival: ["Hold On", "Keep Moving", "Crossfire", "Night Watch", "Pulse", "Heartbeat", "Breathe", "Bassline",
    "Flicker", "Strobe Guard", "Drop", "Overdrive", "Waterfall", "Riptide", "Two Fronts", "Maelstrom",
    "Storm", "Tempest", "Hurricane", "Eye of the Storm"],
  waves: ["First Wave", "Tide Pool", "Shoreline", "Low Tide", "Ripple", "Breakers", "Swell", "Surf",
    "Crosscurrent", "Undertow", "Rip Current", "High Tide", "Rogue Wave", "Surge", "Whitecaps", "Squall",
    "Tsunami", "Deep Water", "Perfect Storm", "Ocean"],
};

/** a tip on the first level of a mode, and wherever something appears for the first time */
function hints(mode: Mode, picked: Judged[]): (string | undefined)[] {
  let sentrySeen = false, sweepSeen = false, bumpSeen = false;
  return picked.map((j, i) => {
    const d = j.def, out: string[] = [];
    if (i === 0) out.push({
      destination: "Left button swings the left boot, right button the right one. Alternate them to walk",
      collect: "Pick up every light. Either boot can grab them",
      sequence: "Pick up the lights in order. Touch the wrong one and you restart",
      survival: "No goal here. Stay alive until the clock runs out",
      waves: "Each wave leaves lights behind it. Grab them, then find the gap in the next",
    }[mode]);
    if (d.sweeps?.length && !sweepSeen && mode !== "waves") out.push("Glowing tiles warn you. They only kill when they flash solid");
    else if (d.sentries?.length && !sentrySeen) out.push("Sentries step on the beat. The faint tile is where they go next");
    else if (mode === "destination" && j.bumps && !bumpSeen) out.push("When the edge is in the way, the boot steps back and makes room for the other one");
    sweepSeen ||= !!d.sweeps?.length; sentrySeen ||= !!d.sentries?.length; bumpSeen ||= j.bumps > 0;
    return out[0];
  });
}

// ---- choosing 20 levels on a curve --------------------------------------------------------
const PREFIX: Record<Mode, string> = { destination: "d", collect: "c", sequence: "s", survival: "r", waves: "w" };
const SEED: Record<Mode, number> = { destination: 101, collect: 202, sequence: 303, survival: 404, waves: 505 };

function generate(mode: Mode): Judged[] {
  const rng = rngOf(SEED[mode]);
  const pools: Judged[][] = [];
  for (let i = 0; i < COUNT; i++) {
    const pool: Judged[] = [];
    for (let tries = 0; pool.length < CANDIDATES && tries < CANDIDATES * 12; tries++) {
      const d = RECIPES[mode](i, rng);
      const j = d && judge(d, i);
      if (j) pool.push(j);
    }
    if (!pool.length) throw new Error(`${mode} slot ${i + 1}: no fair, solvable candidate`);
    pools.push(pool.sort((a, b) => a.score - b.score));
    process.stdout.write(`${mode} ${i + 1}/${COUNT}: ${pool.length} candidates, scores ${pool[0].score}..${pool[pool.length - 1].score}\n`);
  }
  // a gently rising curve from the easiest first level to a hard-but-fair last one
  const lo = pools[0][0].score;
  const last = pools[COUNT - 1];
  const hi = last[Math.floor(last.length * 0.6)].score;
  const picked: Judged[] = [];
  let prev = -Infinity;
  for (let i = 0; i < COUNT; i++) {
    const target = lo + (hi - lo) * Math.pow(i / (COUNT - 1), 1.35);
    const ok = pools[i].filter(c => c.score >= prev);
    const from = ok.length ? ok : pools[i];
    const best = from.reduce((a, b) => Math.abs(b.score - target) < Math.abs(a.score - target) ? b : a);
    picked.push(best); prev = best.score;
  }
  return picked;
}

function write(mode: Mode, picked: Judged[]){
  const lines: string[] = [];
  const tips = hints(mode, picked);
  picked.forEach((j, i) => {
    const d = j.def;
    d.id = PREFIX[mode] + (i + 1);
    d.name = NAMES[mode][i];
    const hint = tips[i];
    const o: Record<string, unknown> = { id: d.id, name: d.name, mode: d.mode };
    if (d.survive) o.survive = d.survive;
    if (d.need) o.need = d.need;
    if (d.beat && d.beat !== 4) o.beat = d.beat;
    if (hint) o.hint = hint;
    o.map = d.map;
    if (d.sentries) o.sentries = d.sentries;
    if (d.sweeps) o.sweeps = d.sweeps;
    if (d.drops) o.drops = d.drops;
    o.proof = j.proof;
    lines.push(`  // ${String(i + 1).padStart(2)}. difficulty ${j.score}: ${j.presses} presses, ${j.beats.toFixed(0)} beats\n  ${tsValue(o, 2)},`);
  });
  const title = mode[0].toUpperCase() + mode.slice(1);
  const src = `import type { LevelDef } from "../core/types";

// ${title} levels, written by tools/gen-levels.ts (npm run gen-levels ${mode}). Names and hints
// can be edited here; to change a layout, change its recipe in the tool and re-run it.
export const ${mode.toUpperCase()}: LevelDef[] = [
${lines.join("\n")}
];
`;
  writeFileSync(`src/levels/${mode}.ts`, src);
}

/** a readable TypeScript literal: the level object one field per line, maps one row per line */
function tsValue(v: unknown, ind: number, top = true): string {
  const pad = " ".repeat(ind);
  if (Array.isArray(v)) {
    if (v.length && v.every(x => typeof x === "string" && /^[.ABGo0-9]+$/.test(x)))
      return "[\n" + v.map(x => `${pad}    ${JSON.stringify(x)},`).join("\n") + `\n${pad}  ]`;
    return "[" + v.map(x => tsValue(x, ind, false)).join(", ") + "]";
  }
  if (v && typeof v === "object") {
    const parts = Object.entries(v).map(([key, val]) => `${key}: ${tsValue(val, ind, false)}`);
    return top ? "{\n" + parts.map(p => `${pad}  ${p},`).join("\n") + `\n${pad}}` : "{ " + parts.join(", ") + " }";
  }
  return JSON.stringify(v);
}

const modes = (process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(RECIPES)) as Mode[];
for (const m of modes) write(m, generate(m));
