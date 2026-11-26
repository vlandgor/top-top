import { isNeighbour } from "../core/dirs";
import type { Item, Level, LevelDef, Sentry, Sweep, SweepDef, Vec } from "../core/types";
import { laneOf, sweepHit } from "../game/hazards";

// Turns an authored LevelDef (ASCII map + hazard lists) into a Level the rules can run.
// Throws on malformed levels, and tests/levels.test.ts parses every level, so a broken level
// fails the build instead of reaching a phone.

function point(s: string, where: string): Vec {
  const m = /^(-?\d+),(-?\d+)$/.exec(s.trim());
  if (!m) throw new Error(`${where}: bad point "${s}"`);
  return { x: +m[1], y: +m[2] };
}
export function points(s: string, where: string): Vec[] {
  return s.trim().split(/\s+/).filter(Boolean).map(p => point(p, where));
}

/** waypoints to the tile-by-tile loop a sentry walks, one tile per beat */
export function sentryTiles(path: string, pingpong: boolean, where: string): Vec[] {
  const wp = points(path, where);
  if (!wp.length) throw new Error(`${where}: empty path`);
  const out: Vec[] = [{ ...wp[0] }];
  const walk = (to: Vec) => {
    const from = out[out.length - 1];
    const dx = to.x - from.x, dy = to.y - from.y;
    if (dx && dy && Math.abs(dx) !== Math.abs(dy)) throw new Error(`${where}: segment must be straight or 45°`);
    const n = Math.max(Math.abs(dx), Math.abs(dy));
    for (let i = 1; i <= n; i++) out.push({ x: from.x + Math.sign(dx) * i, y: from.y + Math.sign(dy) * i });
  };
  for (let i = 1; i < wp.length; i++) walk(wp[i]);
  if (out.length === 1) return out;                       // a sentry that stands still
  if (pingpong || wp.length === 2) {
    for (let i = out.length - 2; i > 0; i--) out.push({ ...out[i] });
  } else {
    walk(wp[0]); out.pop();                               // close the loop, don't repeat the start
  }
  return out;
}

function sweepOf(d: SweepDef): Sweep {
  return {
    dir: d.dir, start: d.start,
    every: d.every || 0,
    count: d.count ?? (d.every ? Infinity : 1),
    speed: d.speed ?? 1,
    warn: d.warn ?? 3,
    lethal: d.lethal ?? 1,
    gaps: !d.gaps?.length ? [] : Array.isArray(d.gaps[0]) ? d.gaps as number[][] : [d.gaps as number[]],
    gapShift: d.gapShift || 0,
  };
}

export function parseLevel(def: LevelDef): Level {
  const where = `level ${def.id}`;
  const h = def.map.length, w = def.map[0]?.length || 0;
  if (w < 2 || h < 2) throw new Error(`${where}: board too small`);
  let a: Vec | null = null, b: Vec | null = null, goal: Vec | null = null;
  const items: Item[] = [];
  def.map.forEach((row, y) => {
    if (row.length !== w) throw new Error(`${where}: row ${y} is ${row.length} wide, expected ${w}`);
    [...row].forEach((ch, x) => {
      if (ch === "A") a = { x, y };
      else if (ch === "B") b = { x, y };
      else if (ch === "G") goal = { x, y };
      else if (ch === "o") items.push({ x, y, order: 0, from: 0, until: Infinity });
      else if (ch >= "1" && ch <= "9") items.push({ x, y, order: +ch, from: 0, until: Infinity });
      else if (ch !== ".") throw new Error(`${where}: unknown tile "${ch}" at ${x},${y}`);
    });
  });
  // a co-op room lists a start per player instead of putting A and B on the map
  let starts: [Vec, Vec][];
  if (def.starts?.length) {
    if (a || b) throw new Error(`${where}: a room lists its starts, so its map has no A / B`);
    if (def.starts.length > 4) throw new Error(`${where}: at most 4 starts`);
    starts = def.starts.map((s, i) => {
      const p = points(s, `${where} start ${i}`);
      if (p.length !== 2) throw new Error(`${where} start ${i}: needs two points, left boot first`);
      for (const q of p) if (q.x < 0 || q.y < 0 || q.x >= w || q.y >= h) throw new Error(`${where} start ${i}: off the board`);
      return [p[0], p[1]];
    });
  } else {
    if (!a || !b) throw new Error(`${where}: needs an A and a B`);
    starts = [[a, b]];
  }
  for (const [p, q] of starts) if (!isNeighbour(p, q)) throw new Error(`${where}: a pair's boots must be neighbours`);

  const sentries: Sentry[] = (def.sentries || []).map((s, i) => {
    const tiles = sentryTiles(s.path, !!s.pingpong, `${where} sentry ${i}`);
    for (const t of tiles) if (t.x < 0 || t.y < 0 || t.x >= w || t.y >= h) throw new Error(`${where} sentry ${i}: leaves the board`);
    return { tiles, phase: s.phase || 0 };
  });
  const sweeps = (def.sweeps || []).map(sweepOf);

  const ordered = items.filter(i => i.order > 0).length;
  if (ordered) {
    const orders = items.filter(i => i.order).map(i => i.order).sort((p, q) => p - q);
    orders.forEach((o, i) => { if (o !== i + 1) throw new Error(`${where}: sequence must be 1..${orders.length} with no gaps`); });
  }

  // waves: each pass of sweep 0 drops collectibles once the front has passed their lane,
  // and the next pass washes away whatever is left.
  if (def.mode === "waves") {
    const sw = sweeps[0];
    if (!sw || !sw.every) throw new Error(`${where}: waves mode needs a repeating sweep`);
    if (!def.drops?.length) throw new Error(`${where}: waves mode needs drops`);
    const passes = Math.min(sw.count, 60);        // plenty: a level needs far fewer
    for (let c = 0; c < passes; c++) {
      for (const p of points(def.drops[c % def.drops.length], `${where} drops`)) {
        const lane = laneOf(sw.dir, p.x, p.y, w, h);
        const from = sweepHit(sw, c, lane) + sw.lethal;
        const until = c + 1 < sw.count ? sweepHit(sw, c + 1, lane) : Infinity;
        items.push({ x: p.x, y: p.y, order: 0, from, until });
      }
    }
  }

  const itemsAt = new Map<number, number[]>();
  items.forEach((it, i) => { const k = it.y * w + it.x; itemsAt.set(k, (itemsAt.get(k) || []).concat(i)); });

  return {
    def, w, h, itemsAt, start: starts[0], starts, goal, items, sentries, sweeps,
    beat: def.beat || 4,
    survive: def.survive || 0,
    need: def.need || 0,
    lives: def.lives || 5,
    limit: def.limit || 0,
    ordered,
  };
}
