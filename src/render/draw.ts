import { dirBetween, DIRS, rot } from "../core/dirs";
import type { Level, Run, Turn, Vec } from "../core/types";
import { sentryAt, sweepAt } from "../game/hazards";
import { itemLive, swingTarget } from "../game/rules";
import { RETRY_MS, S, tickF } from "../game/session";
import { ctx, view } from "./canvas";
import { drawBoot, type BootStyle } from "./boot";
import { ACCENT, C, rgba } from "./theme";

// ---------------------------------------------------------------------------
// DRAW — one frame of the board, seen from straight above like an LED dance floor.
// ---------------------------------------------------------------------------

const SWING_S = 0.09;              // seconds a swing takes to draw
const HUD_TOP = 78, BOTTOM = 34;   // room for the HUD chips and the hint line

interface Layout { s: number; ox: number; oy: number }
let L: Layout = { s: 40, ox: 0, oy: 0 };
let heading = -Math.PI / 2;        // the way the boots face, eased toward the target each frame

function layout(lv: Level): Layout {
  const availW = view.w - 20, availH = view.h - HUD_TOP - BOTTOM;
  const s = Math.floor(Math.min(availW / lv.w, availH / lv.h, 76));
  return { s, ox: Math.round((view.w - s * lv.w) / 2), oy: Math.round(HUD_TOP + (availH - s * lv.h) / 2) };
}
const cx = (x: number) => L.ox + (x + 0.5) * L.s;
const cy = (y: number) => L.oy + (y + 0.5) * L.s;

function rr(x: number, y: number, w: number, h: number, r: number){
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
}
/** the lit inner panel of a tile */
function panel(x: number, y: number, color: string, glow = 0, inset = 0.17){
  const s = L.s, i = s * inset;
  if (glow) { ctx.shadowColor = color; ctx.shadowBlur = glow; }
  rr(L.ox + x * s + i, L.oy + y * s + i, s - 2 * i, s - 2 * i, s * 0.1);
  ctx.fillStyle = color; ctx.fill();
  ctx.shadowBlur = 0;
}
function outline(x: number, y: number, color: string, width: number, inset = 0.1, dash?: number[]){
  const s = L.s, i = s * inset;
  rr(L.ox + x * s + i, L.oy + y * s + i, s - 2 * i, s - 2 * i, s * 0.14);
  ctx.lineWidth = width; ctx.strokeStyle = color;
  if (dash) ctx.setLineDash(dash);
  ctx.stroke(); ctx.setLineDash([]);
}
const ease = (k: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 3);

export function draw(){
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, view.w, view.h);
  const r = S.run; if (!r) return;
  const lv = r.lv; L = layout(lv);
  const accent = ACCENT[lv.def.mode];
  const tf = tickF(), beatF = tf / lv.beat, beat = Math.floor(beatF), frac = beatF - beat;
  const dead = r.status === "dead", deadK = dead ? Math.min(1, (S.now - S.deadAt) / (RETRY_MS / 1000)) : 0;

  ctx.save();
  if (dead && deadK < 0.4) {                         // a short shake on death
    const a = (0.4 - deadK) * 10;
    ctx.translate(Math.sin(S.now * 90) * a, Math.cos(S.now * 70) * a);
  }

  drawFloor(lv, frac, accent);
  drawSweeps(lv, beatF);
  drawItems(r, beat, accent);
  if (lv.goal) drawGoal(lv.goal, accent);
  drawSentries(lv, beat, frac);
  if (r.status === "play") drawGhosts(r, accent);
  drawBoots(r, dead);

  ctx.restore();
  if (dead) { ctx.fillStyle = rgba(C.hazard, 0.28 * (1 - deadK)); ctx.fillRect(0, 0, view.w, view.h); }
  if (r.status === "won") drawWin(r, accent);
}

// ---- floor -------------------------------------------------------------------------------
function drawFloor(lv: Level, frac: number, accent: string){
  const s = L.s, pulse = Math.exp(-frac * 5);        // every tile flashes a little on the beat
  for (let y = 0; y < lv.h; y++) for (let x = 0; x < lv.w; x++) {
    rr(L.ox + x * s + 1.5, L.oy + y * s + 1.5, s - 3, s - 3, s * 0.14);
    ctx.fillStyle = C.tile; ctx.fill();
    ctx.lineWidth = 1; ctx.strokeStyle = C.tileEdge; ctx.stroke();
    const checker = (x + y) % 2 ? 0.045 : 0.07;
    panel(x, y, rgba(accent, checker + 0.05 * pulse));
  }
}

// ---- hazards -----------------------------------------------------------------------------
function drawSweeps(lv: Level, beatF: number){
  if (!lv.sweeps.length) return;
  for (let y = 0; y < lv.h; y++) for (let x = 0; x < lv.w; x++) {
    let warn = 0, lethal = false;
    for (const sw of lv.sweeps) {
      // logic is per whole beat; drawing uses the whole beat too, so what you see is what kills
      const st = sweepAt(sw, x, y, Math.floor(beatF), lv.w, lv.h);
      const soft = sweepAt(sw, x, y, beatF, lv.w, lv.h);
      if (st.lethal) lethal = true;
      warn = Math.max(warn, soft.warn);
    }
    if (lethal) { panel(x, y, C.hazard, L.s * 0.5, 0.08); continue; }
    if (warn > 0) {
      const flick = warn > 0.66 ? 0.5 + 0.5 * Math.sin(S.now * 40) : 1;
      panel(x, y, rgba(C.hazard, (0.1 + 0.4 * warn) * flick), 0, 0.17);
      outline(x, y, rgba(C.hazard, 0.25 + 0.5 * warn), 1.5, 0.08);
    }
  }
}

function drawSentries(lv: Level, beat: number, frac: number){
  for (const sn of lv.sentries) {
    const now = sentryAt(sn, beat), next = sentryAt(sn, beat + 1), prev = sentryAt(sn, beat - 1);
    // telegraph: the next tile lights up as the step comes closer
    if (next.x !== now.x || next.y !== now.y) {
      outline(next.x, next.y, rgba(C.hazard, 0.2 + 0.6 * frac), 2, 0.12, [L.s * 0.12, L.s * 0.08]);
    }
    const k = ease(frac / 0.18);                     // a quick slide in at the start of each beat
    const x = prev.x + (now.x - prev.x) * k, y = prev.y + (now.y - prev.y) * k;
    panel(x, y, C.hazard, L.s * 0.6, 0.08);
    panel(x, y, "#ffd3d8", 0, 0.36);
  }
}

// ---- goal and pickups --------------------------------------------------------------------
function drawGoal(g: Vec, accent: string){
  const t = S.now;
  for (let i = 0; i < 3; i++) {
    const k = ((t * 0.8 + i / 3) % 1);
    outline(g.x, g.y, rgba(accent, 0.9 * (1 - k)), 2, 0.42 - 0.34 * k);
  }
  panel(g.x, g.y, rgba(accent, 0.85), L.s * 0.5, 0.34);
}

function drawItems(r: Run, beat: number, accent: string){
  const lv = r.lv;
  lv.items.forEach((it, i) => {
    const x = cx(it.x), y = cy(it.y), s = L.s;
    if (r.taken[i]) {                                // pop when picked up
      const k = (S.now - (S.pickedAt.get(i) ?? -9)) / 0.3;
      if (k < 1) {
        ctx.beginPath(); ctx.arc(x, y, s * (0.18 + 0.35 * k), 0, Math.PI * 2);
        ctx.lineWidth = 3 * (1 - k); ctx.strokeStyle = rgba(accent, 1 - k); ctx.stroke();
      }
      return;
    }
    if (!itemLive(it, beat)) return;
    if (it.order) {                                  // sequence: numbered, the next one is lit
      const next = it.order === r.nextOrder;
      ctx.shadowColor = accent; ctx.shadowBlur = next ? s * 0.5 : 0;
      ctx.beginPath(); ctx.arc(x, y, s * 0.25, 0, Math.PI * 2);
      ctx.fillStyle = next ? accent : rgba(accent, 0.22); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.lineWidth = 2; ctx.strokeStyle = accent; ctx.stroke();
      ctx.fillStyle = next ? "#12062a" : "#e8dcff";
      ctx.font = `800 ${Math.round(s * 0.3)}px ui-sans-serif,system-ui,sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(String(it.order), x, y + 1);
      return;
    }
    // a glowing orb; in Waves it blinks when the next wave is about to wash it away
    const leaving = it.until !== Infinity && it.until - beat <= 2;
    const a = leaving ? 0.45 + 0.55 * Math.abs(Math.sin(S.now * 9)) : 1;
    const bob = 1 + 0.08 * Math.sin(S.now * 5 + i);
    ctx.shadowColor = accent; ctx.shadowBlur = s * 0.45;
    ctx.beginPath(); ctx.arc(x, y, s * 0.15 * bob, 0, Math.PI * 2);
    ctx.fillStyle = rgba(accent, a); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.arc(x, y, s * 0.06, 0, Math.PI * 2);
    ctx.fillStyle = rgba("#ffffff", 0.85 * a); ctx.fill();
  });
}

// ---- where the next tap goes -------------------------------------------------------------
function drawGhosts(r: Run, accent: string){
  const a = r.boots[r.anchor], m = r.boots[1 - r.anchor];
  const natural = -r.lastTurn as Turn;
  for (const turn of [-1, 1] as Turn[]) {
    const t = swingTarget(r.lv, a, m, turn);
    const strong = turn === natural;
    outline(t.mover.x, t.mover.y, rgba(accent, strong ? 0.6 : 0.3), strong ? 2 : 1.5, 0.14, [L.s * 0.1, L.s * 0.07]);
    if (t.shuffled) {                                 // at the edge: show where the planted boot will shuffle
      const x0 = cx(a.x), y0 = cy(a.y), x1 = cx(t.anchor.x), y1 = cy(t.anchor.y);
      const k = 0.62, hx = x0 + (x1 - x0) * k, hy = y0 + (y1 - y0) * k, ang = Math.atan2(y1 - y0, x1 - x0), h = L.s * 0.1;
      ctx.beginPath(); ctx.moveTo(x0 + (x1 - x0) * 0.32, y0 + (y1 - y0) * 0.32); ctx.lineTo(hx, hy);
      ctx.moveTo(hx + Math.cos(ang + 2.5) * h, hy + Math.sin(ang + 2.5) * h); ctx.lineTo(hx, hy);
      ctx.lineTo(hx + Math.cos(ang - 2.5) * h, hy + Math.sin(ang - 2.5) * h);
      ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.strokeStyle = rgba(accent, strong ? 0.7 : 0.4); ctx.stroke();
    }
    ctx.fillStyle = rgba(accent, strong ? 0.75 : 0.4);
    ctx.font = `700 ${Math.round(L.s * 0.26)}px ui-sans-serif,system-ui,sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(turn === 1 ? "↻" : "↺", cx(t.mover.x), cy(t.mover.y));
  }
}

// ---- the boots ---------------------------------------------------------------------------
/** they face across the line between them, toward where an alternating (walking) tap goes */
function targetHeading(r: Run): number {
  const a = r.boots[r.anchor], m = r.boots[1 - r.anchor];
  const d = dirBetween(a, m), natural = -r.lastTurn;
  const tgt = DIRS[rot(d, natural)];
  const v = DIRS[d];
  let px = -v.y, py = v.x;                           // perpendicular to the pair
  if (px * (tgt.x - v.x) + py * (tgt.y - v.y) < 0) { px = -px; py = -py; }
  return Math.atan2(py, px);
}

function drawBoots(r: Run, dead: boolean){
  const s = L.s;
  // positions, with the swing animated as an arc around the planted boot
  const pos: Vec[] = [{ x: cx(r.boots[0].x), y: cy(r.boots[0].y) }, { x: cx(r.boots[1].x), y: cy(r.boots[1].y) }];
  let lift = 0, liftIdx = -1;
  const an = S.anim;
  if (an) {
    const k = (S.now - an.t0) / SWING_S;
    if (k < 1) {
      const e = ease(k);
      const shift = an.shuffleFrom ? { x: r.boots[1 - an.idx].x - an.pivot.x, y: r.boots[1 - an.idx].y - an.pivot.y } : { x: 0, y: 0 };
      const end = { x: an.to.x - shift.x, y: an.to.y - shift.y };
      const a0 = Math.atan2(an.from.y - an.pivot.y, an.from.x - an.pivot.x);
      let a1 = Math.atan2(end.y - an.pivot.y, end.x - an.pivot.x);
      if (a1 - a0 > Math.PI) a1 -= Math.PI * 2; if (a0 - a1 > Math.PI) a1 += Math.PI * 2;
      const r0 = Math.hypot(an.from.x - an.pivot.x, an.from.y - an.pivot.y), r1 = Math.hypot(end.x - an.pivot.x, end.y - an.pivot.y);
      const ang = a0 + (a1 - a0) * e, rad = r0 + (r1 - r0) * e;
      pos[an.idx] = { x: cx(an.pivot.x + Math.cos(ang) * rad + shift.x * e), y: cy(an.pivot.y + Math.sin(ang) * rad + shift.y * e) };
      pos[1 - an.idx] = { x: cx(an.pivot.x + shift.x * e), y: cy(an.pivot.y + shift.y * e) };
      lift = Math.sin(Math.PI * k); liftIdx = an.idx;
    }
  }
  // ease the facing
  const want = targetHeading(r);
  let dh = want - heading;
  while (dh > Math.PI) dh -= Math.PI * 2; while (dh < -Math.PI) dh += Math.PI * 2;
  heading += dh * Math.min(1, 0.35);

  // the planted boot sits on a ring; the swinging one is lit
  const pl = pos[r.anchor];
  ctx.beginPath(); ctx.arc(pl.x, pl.y, s * 0.38, 0, Math.PI * 2);
  ctx.lineWidth = 2; ctx.strokeStyle = rgba(C.teal, dead ? 0 : 0.45); ctx.stroke();

  const hx = Math.cos(heading), hy = Math.sin(heading);
  const mid = { x: (pos[0].x + pos[1].x) / 2, y: (pos[0].y + pos[1].y) / 2 };
  for (let i = 0; i < 2; i++) {
    const p = pos[i];
    // the boot on the left of the heading is the left boot
    const left = (hx * (p.y - mid.y) - hy * (p.x - mid.x)) < 0;
    const mover = i !== r.anchor;
    const st: BootStyle = dead
      ? { body: "#ff8a95", edge: C.hazard, detail: "#7a1520", glow: C.hazard, glowSize: s * 0.5 }
      : mover
        ? { body: C.boot, edge: C.teal, detail: "#2a8f82", glow: C.teal, glowSize: s * 0.45 }
        : { body: "#8fcfc5", edge: "#3fb6a5", detail: "#2c6e66", glow: "rgba(0,0,0,0)", glowSize: 0 };
    const scale = 1 + (i === liftIdx ? 0.18 * lift : 0);
    drawBoot(ctx, p.x, p.y, heading + Math.PI / 2, left, s * 0.7 * scale, st);
  }
}

function drawWin(r: Run, accent: string){
  const k = Math.min(1, (S.now - S.wonAt) / 0.7);
  const p = r.boots[r.anchor];
  for (let i = 0; i < 3; i++) {
    const kk = Math.max(0, k - i * 0.15);
    ctx.beginPath(); ctx.arc(cx(p.x), cy(p.y), L.s * (0.5 + kk * 5), 0, Math.PI * 2);
    ctx.lineWidth = 4 * (1 - kk); ctx.strokeStyle = rgba(accent, 1 - kk); ctx.stroke();
  }
}

/** the main-menu logo: the two boots mid-step on three lit tiles */
export function drawLogo(c: CanvasRenderingContext2D, t: number){
  const W = c.canvas.width, H = c.canvas.height, s = 58;
  c.clearRect(0, 0, W, H);
  const ox = W / 2 - s * 1.5, oy = H / 2 - s * 0.5;
  const pulse = Math.exp(-((t * 2) % 1) * 5);
  for (let i = 0; i < 3; i++) {
    c.beginPath(); c.roundRect(ox + i * s + 2, oy + 2, s - 4, s - 4, 9);
    c.fillStyle = C.tile; c.fill(); c.strokeStyle = C.tileEdge; c.lineWidth = 1; c.stroke();
    c.beginPath(); c.roundRect(ox + i * s + 11, oy + 11, s - 22, s - 22, 6);
    c.fillStyle = rgba(C.teal, i === 1 ? 0.12 + 0.2 * pulse : 0.07 + 0.05 * pulse); c.fill();
  }
  // one boot planted on the middle tile, the other swinging around it between its neighbours
  const px = ox + s * 1.5, py = oy + s * 0.5;
  const sw = Math.sin(t * 2.4) * Math.PI / 4;
  const mx = px + Math.cos(sw) * s, my = py + Math.sin(sw) * s;
  c.beginPath(); c.arc(px, py, s * 0.36, 0, Math.PI * 2); c.strokeStyle = rgba(C.teal, 0.45); c.lineWidth = 2; c.stroke();
  drawBoot(c, px, py, 0, true, 40, { body: "#8fcfc5", edge: "#3fb6a5", detail: "#2c6e66", glow: "rgba(0,0,0,0)", glowSize: 0 });
  drawBoot(c, mx, my, sw, false, 40, { body: C.boot, edge: C.teal, detail: "#2a8f82", glow: C.teal, glowSize: 18 });
}
