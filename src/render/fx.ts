// ---------------------------------------------------------------------------
// FX — short-lived particles over the board: shards when you're hit, sparks on a pickup,
// confetti when you clear. Positions are in tiles, so they stay put if the board's layout
// changes. Motion is worked out from each particle's start, not stepped frame by frame:
// with drag, and gravity for confetti.
// ---------------------------------------------------------------------------

type Kind = "spark" | "confetti";
interface P {
  kind: Kind;
  x: number; y: number; vx: number; vy: number;   // tiles, tiles per second
  t0: number; life: number;
  size: number;                                    // in tiles
  color: string;
  spin: number;
}
let ps: P[] = [];

const DRAG = 4.5, GRAVITY = 9;

export interface BurstOpts {
  n: number; colors: string[];
  /** tiles per second, give or take half */
  speed: number;
  life: number; size: number;
  kind?: Kind;
  /** -π/2 sends them up; with `spread` (radians) around it. Left out: all around */
  dir?: number; spread?: number;
}

export function burst(x: number, y: number, now: number, o: BurstOpts){
  for (let i = 0; i < o.n; i++) {
    const a = o.dir === undefined ? Math.random() * Math.PI * 2 : o.dir + (Math.random() - 0.5) * (o.spread ?? 1);
    const v = o.speed * (0.5 + Math.random());
    ps.push({
      kind: o.kind ?? "spark", x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
      t0: now, life: o.life * (0.7 + Math.random() * 0.6), size: o.size * (0.7 + Math.random() * 0.6),
      color: o.colors[i % o.colors.length], spin: (Math.random() - 0.5) * 18,
    });
  }
}

export function clearFx(){ ps = []; }

/** draw every live particle; s, ox, oy: the board's tile size and where tile 0,0 starts */
export function drawFx(c: CanvasRenderingContext2D, now: number, s: number, ox: number, oy: number){
  if (!ps.length) return;
  ps = ps.filter(p => now - p.t0 < p.life && now >= p.t0 - 0.05);
  for (const p of ps) {
    const t = now - p.t0, k = t / p.life, d = (1 - Math.exp(-DRAG * t)) / DRAG;
    const x = ox + (p.x + 0.5 + p.vx * d) * s;
    let y = oy + (p.y + 0.5 + p.vy * d) * s;
    if (p.kind === "confetti") y += 0.5 * GRAVITY * 0.25 * t * t * s;
    const a = 1 - k * k, size = p.size * s;
    c.save();
    c.globalAlpha = a;
    c.translate(x, y);
    if (p.kind === "spark") {
      // a streak along its flight that shrinks as it slows
      const sp = Math.exp(-DRAG * t), ang = Math.atan2(p.vy, p.vx);
      c.rotate(ang);
      c.shadowColor = p.color; c.shadowBlur = size * 2;
      c.fillStyle = p.color;
      c.beginPath(); c.roundRect(-size * (0.5 + 2 * sp), -size / 2, size * (1 + 2 * sp), size, size / 2); c.fill();
    } else {
      // a paper square tumbling: spinning, and flipping as it falls
      c.rotate(p.spin * t);
      c.scale(1, Math.cos(p.spin * t * 0.7));
      c.fillStyle = p.color;
      c.fillRect(-size / 2, -size / 3, size, size * 0.66);
    }
    c.restore();
  }
}
