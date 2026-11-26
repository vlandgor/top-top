import type { Boot, Level, Run, Vec } from "../core/types";
import { COUNTDOWN_S, M, matchTickF, PLAYER_COLORS } from "../game/match";
import { RESPAWN_TICKS } from "../game/room";
import { nextTileOf } from "../game/rules";
import { sentryAt, sweepAt } from "../game/hazards";
import { itemLive } from "../game/rules";
import { RETRY_MS, S, tickF, type SwingAnim } from "../game/session";
import { ctx as mainCtx, view } from "./canvas";
import { drawBoot, type BootStyle } from "./boot";
import { mySkin, skinOfPlayer, type Skin } from "./skins";
import { ACCENT, C, mix, rgba } from "./theme";
import { LEVELS } from "../levels/levels";
import { parseLevel } from "../levels/parse";
import { ROOMS } from "../levels/rooms";

// ---------------------------------------------------------------------------
// DRAW — one frame of the board, seen from straight above like an LED dance floor.
// The same code draws the game and the small previews on the mode screen: a Frame says
// which run, at what time, and whether it is the live game (with swing and death effects).
// ---------------------------------------------------------------------------

/** what the board needs to draw: a solo Run and a co-op Room both are one */
interface Board { lv: Level; taken: boolean[]; nextOrder: number }
interface Frame { b: Board; tf: number; now: number; live: boolean; picked: Map<number, number> }
let F: Frame;
let ctx: CanvasRenderingContext2D = mainCtx;

const SWING_S = 0.09;              // seconds a swing takes to draw
const HUD_TOP = 44, BOTTOM = 24;   // room for the HUD chips and the hint line

interface Layout { s: number; ox: number; oy: number }
let L: Layout = { s: 40, ox: 0, oy: 0 };
const heading = [-Math.PI / 2, -Math.PI / 2];   // the way each boot faces, eased toward its next tile

// In the game every level uses the same tile size: the size at which the biggest board of any
// level fits the screen. Smaller boards keep that size and sit centred, with empty floor around.
const BIGGEST = LEVELS.reduce((m, d) => ({ w: Math.max(m.w, d.map[0].length), h: Math.max(m.h, d.map.length) }), { w: 1, h: 1 });

/** square tiles in a box: `fit` is the board whose size decides the tile, `lv` is drawn centred */
function layoutIn(lv: Level, x: number, y: number, w: number, h: number, max: number, fit: { w: number; h: number } = lv): Layout {
  const s = Math.floor(Math.min(w / fit.w, h / fit.h, max));
  return { s, ox: Math.round(x + (w - s * lv.w) / 2), oy: Math.round(y + (h - s * lv.h) / 2) };
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
  ctx = mainCtx;
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, view.w, view.h);
  if (M.active) { drawRoom(); return; }
  const r = S.run; if (!r) return;
  F = { b: r, tf: tickF(), now: S.now, live: true, picked: S.pickedAt };
  L = layoutIn(r.lv, 0, HUD_TOP, view.w, view.h - HUD_TOP - BOTTOM, 76, BIGGEST);
  const dead = r.status === "dead", deadK = dead ? Math.min(1, (S.now - S.deadAt) / (RETRY_MS / 1000)) : 0;

  ctx.save();
  if (dead && deadK < 0.4) {                         // a short shake on death
    const a = (0.4 - deadK) * 10;
    ctx.translate(Math.sin(S.now * 90) * a, Math.cos(S.now * 70) * a);
  }
  drawBoard();
  if (r.status === "play") drawNext(r.lv, r.boots, ACCENT[r.lv.def.mode]);
  const skin = mySkin();
  drawPair(r.lv, r.boots, S.anim, heading, (_who, lifted) => dead
    ? { ...DEAD_STYLE, glowSize: L.s * 0.5, skin }
    : { body: C.boot, edge: C.teal, detail: "#2a8f82", glow: C.teal, glowSize: L.s * (lifted ? 0.6 : 0.3), skin });
  ctx.restore();
  if (dead) { ctx.fillStyle = rgba(C.hazard, 0.28 * (1 - deadK)); ctx.fillRect(0, 0, view.w, view.h); }
  if (r.status === "won") drawWin(r, ACCENT[r.lv.def.mode]);
}

/**
 * A preview of a level into any canvas: the board with its hazards running on their real
 * schedule (no boots). `t` is seconds since the preview started; it loops every `loop` seconds.
 */
export function drawPreview(c: CanvasRenderingContext2D, w: number, h: number, r: Run, t: number, tickMs: number, loop = 12){
  ctx = c;
  ctx.clearRect(0, 0, w, h);
  F = { b: r, tf: ((t % loop) * 1000) / tickMs, now: t, live: false, picked: S.pickedAt };
  r.tick = Math.floor(F.tf);
  L = layoutIn(r.lv, 4, 4, w - 8, h - 8, 60);
  drawBoard();
  ctx = mainCtx;
}

/** the floor, hazards, lights and goal: everything but the boots */
function drawBoard(){
  const r = F.b, lv = r.lv, accent = ACCENT[lv.def.mode];
  const beatF = F.tf / lv.beat, beat = Math.floor(beatF), frac = beatF - beat;
  drawFloor(lv, frac, accent);
  drawSweeps(lv, beatF);
  drawItems(r, beat, accent);
  if (lv.goal) drawGoal(lv.goal, accent);
  drawSentries(lv, beat, frac);
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
      const flick = warn > 0.66 ? 0.5 + 0.5 * Math.sin(F.now * 40) : 1;
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
  const t = F.now;
  for (let i = 0; i < 3; i++) {
    const k = ((t * 0.8 + i / 3) % 1);
    outline(g.x, g.y, rgba(accent, 0.9 * (1 - k)), 2, 0.42 - 0.34 * k);
  }
  panel(g.x, g.y, rgba(accent, 0.85), L.s * 0.5, 0.34);
}

function drawItems(r: Board, beat: number, accent: string){
  const lv = r.lv;
  lv.items.forEach((it, i) => {
    const x = cx(it.x), y = cy(it.y), s = L.s;
    if (r.taken[i]) {                                // pop when picked up
      const k = F.live ? (F.now - (F.picked.get(i) ?? -9)) / 0.3 : 1;
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
    const a = leaving ? 0.45 + 0.55 * Math.abs(Math.sin(F.now * 9)) : 1;
    const bob = 1 + 0.08 * Math.sin(F.now * 5 + i);
    ctx.shadowColor = accent; ctx.shadowBlur = s * 0.45;
    ctx.beginPath(); ctx.arc(x, y, s * 0.15 * bob, 0, Math.PI * 2);
    ctx.fillStyle = rgba(accent, a); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.arc(x, y, s * 0.06, 0, Math.PI * 2);
    ctx.fillStyle = rgba("#ffffff", 0.85 * a); ctx.fill();
  });
}

// ---- where each button sends its boot ----------------------------------------------------
const LABEL = ["L", "R"];
function drawNext(lv: Level, boots: [Vec, Vec], accent: string){
  for (const who of [0, 1] as Boot[]) {
    const t = nextTileOf(lv, boots, who);
    // a step back off an edge is drawn fainter, with a back arrow instead of the letter
    outline(t.x, t.y, rgba(accent, t.back ? 0.32 : 0.5), 1.5, 0.14, [L.s * 0.1, L.s * 0.07]);
    ctx.fillStyle = rgba(accent, t.back ? 0.5 : 0.7);
    ctx.font = `800 ${Math.round(L.s * 0.24)}px ui-sans-serif,system-ui,sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(t.back ? `${LABEL[who]}↩` : LABEL[who], cx(t.x), cy(t.y));
  }
}

// ---- the boots ---------------------------------------------------------------------------
/** one pair of boots, mid-swing if it has an animation. `head` keeps each boot's eased facing */
function drawPair(lv: Level, boots: [Vec, Vec], anim: SwingAnim | null, head: number[], style: (who: Boot, lifted: boolean) => BootStyle){
  const s = L.s;
  const pos: Vec[] = [{ x: cx(boots[0].x), y: cy(boots[0].y) }, { x: cx(boots[1].x), y: cy(boots[1].y) }];
  let lift = -1, liftK = 0;
  const an = F.live ? anim : null;
  if (an) {
    const k = (F.now - an.t0) / SWING_S;
    if (k < 1) {
      {                                                // an arc around the other boot (a step back too)
        const e = ease(k);
        const a0 = Math.atan2(an.from.y - an.pivot.y, an.from.x - an.pivot.x);
        let a1 = Math.atan2(an.to.y - an.pivot.y, an.to.x - an.pivot.x);
        if (a1 - a0 > Math.PI) a1 -= Math.PI * 2; if (a0 - a1 > Math.PI) a1 += Math.PI * 2;
        const r0 = Math.hypot(an.from.x - an.pivot.x, an.from.y - an.pivot.y), r1 = Math.hypot(an.to.x - an.pivot.x, an.to.y - an.pivot.y);
        const ang = a0 + (a1 - a0) * e, rad = r0 + (r1 - r0) * e;
        pos[an.idx] = { x: cx(an.pivot.x + Math.cos(ang) * rad), y: cy(an.pivot.y + Math.sin(ang) * rad) };
        lift = an.idx; liftK = Math.sin(Math.PI * k);
      }
    }
  }
  for (const who of [0, 1] as Boot[]) {
    // each boot faces along its own path: the next tile ahead, even when the edge is in the
    // way and the press will step it back. It never turns around
    const p = boots[who], t = nextTileOf(lv, boots, who).ahead;
    const want = Math.atan2(t.y - p.y, t.x - p.x);
    let dh = want - head[who];
    while (dh > Math.PI) dh -= Math.PI * 2; while (dh < -Math.PI) dh += Math.PI * 2;
    head[who] += dh * 0.35;
    const face = F.live ? head[who] : want;
    const st = style(who, who === lift);
    const scale = 1 + (who === lift ? 0.18 * liftK : 0);
    drawBoot(ctx, pos[who].x, pos[who].y, face + Math.PI / 2, who === 0, s * 0.7 * scale, st);
  }
}

function drawWin(r: Run, accent: string){
  const k = Math.min(1, (S.now - S.wonAt) / 0.7);
  const p = r.boots[r.last?.boot ?? 0];
  for (let i = 0; i < 3; i++) {
    const kk = Math.max(0, k - i * 0.15);
    ctx.beginPath(); ctx.arc(cx(p.x), cy(p.y), L.s * (0.5 + kk * 5), 0, Math.PI * 2);
    ctx.lineWidth = 4 * (1 - kk); ctx.strokeStyle = rgba(accent, 1 - kk); ctx.stroke();
  }
}

// ---- co-op rooms --------------------------------------------------------------------------
// Every pair is drawn in its player's colour; the local player's goes on top and is the only
// one with the L / R next-tile marks. A pair that's out flashes red where it died, and its
// start tiles fill in its colour until it's back.
const roomHeads: number[][] = [];
const DEAD_STYLE: BootStyle = { body: "#ff8a95", edge: C.hazard, detail: "#7a1520", glow: C.hazard, glowSize: 20 };
function playerStyle(color: string, lifted: boolean, skin: Skin): BootStyle {
  return { body: mix(color, "#ffffff", 0.8), edge: color, detail: mix(color, "#000000", 0.5), glow: color, glowSize: L.s * (lifted ? 0.6 : 0.3), skin };
}
function bigText(text: string, k: number, color: string){
  ctx.save();
  ctx.globalAlpha = Math.max(0, 1 - k);
  ctx.font = `900 ${Math.round(Math.min(view.h * 0.32, 140, (view.w * 1.1) / text.length) * (1 + 0.25 * k))}px ui-sans-serif,system-ui,sans-serif`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.shadowColor = color; ctx.shadowBlur = 30; ctx.fillStyle = "#f2fffd";
  ctx.fillText(text, view.w / 2, view.h / 2);
  ctx.restore();
}

function drawRoom(){
  const r = M.room; if (!r) return;
  const lv = r.lv;
  F = { b: r, tf: matchTickF(), now: M.now, live: true, picked: M.pickedAt };
  L = layoutIn(lv, 0, HUD_TOP, view.w, view.h - HUD_TOP - BOTTOM, 76, BIGGEST);
  const youOut = M.you >= 0 ? M.now - M.diedAt[M.you] : 9;
  ctx.save();
  if (youOut < 0.16) { const a = (0.16 - youOut) * 25; ctx.translate(Math.sin(M.now * 90) * a, Math.cos(M.now * 70) * a); }
  drawBoard();
  const order = r.pairs.map((_, i) => i).filter(i => i !== M.you);
  if (M.you >= 0) order.push(M.you);
  for (const i of order) {
    const p = r.pairs[i], color = PLAYER_COLORS[i], skin = skinOfPlayer(i);
    const head = roomHeads[i] = roomHeads[i] || [-Math.PI / 2, -Math.PI / 2];
    if (p.alive) {
      if (i === M.you && r.status === "play" && M.phase !== "count") drawNext(lv, p.boots, color);
      const k = (M.now - M.spawnAt[i]) / 0.45;      // a ring as it lands back on its start
      if (k < 1) for (const b of p.boots) {
        ctx.beginPath(); ctx.arc(cx(b.x), cy(b.y), L.s * (0.3 + 0.5 * k), 0, Math.PI * 2);
        ctx.lineWidth = 3 * (1 - k); ctx.strokeStyle = rgba(color, 1 - k); ctx.stroke();
      }
      drawPair(lv, p.boots, M.anims[i], head, (_who, lifted) => playerStyle(color, lifted, skin));
      if (i === M.you && M.phase === "count") {        // which pair is yours
        const mx = (cx(p.boots[0].x) + cx(p.boots[1].x)) / 2, my = Math.min(cy(p.boots[0].y), cy(p.boots[1].y)) - L.s * 0.62;
        ctx.font = `800 ${Math.round(L.s * 0.24)}px ui-sans-serif,system-ui,sans-serif`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = color;
        ctx.fillText("YOU", mx, my);
      }
      continue;
    }
    const since = M.now - M.diedAt[i];
    if (since < 0.45 && p.diedAt) {
      ctx.globalAlpha = 1 - since / 0.45;
      drawPair(lv, p.diedAt, null, head, () => ({ ...DEAD_STYLE, skin }));
      ctx.globalAlpha = 1;
    }
    const k = 1 - Math.min(1, Math.max(0, (p.backAt - F.tf) / RESPAWN_TICKS));   // 0 -> 1 as it comes back
    for (const st of p.start) {
      panel(st.x, st.y, rgba(color, 0.05 + 0.2 * k));
      outline(st.x, st.y, rgba(color, 0.3 + 0.5 * k), 2, 0.1, [L.s * 0.1, L.s * 0.07]);
    }
  }
  ctx.restore();
  if (youOut < RETRY_MS / 1000) { ctx.fillStyle = rgba(C.hazard, 0.22 * (1 - youOut / (RETRY_MS / 1000))); ctx.fillRect(0, 0, view.w, view.h); }
  const inPhase = M.now - M.phaseAt;
  if (M.phase === "count") {
    const left = COUNTDOWN_S - inPhase;
    bigText(String(Math.max(1, Math.ceil(left))), 1 - (left - Math.floor(left)), PLAYER_COLORS[0]);
  } else if (M.phase === "play" && inPhase < 0.6 && r.tick < 6) bigText("GO", inPhase / 0.6, ACCENT[lv.def.mode]);
  if (M.phase === "over") bigText(r.status === "won" ? "CLEARED" : r.why === "time" ? "TIME" : "OUT", Math.max(0, inPhase - 0.5) * 2, r.status === "won" ? ACCENT[lv.def.mode] : C.hazard);
}

/**
 * The lobby's little floor: the first room's board with each player's pair at its start, in
 * their colour, stepping in place on the beat. `seats` is a colour per start, null for an open
 * seat (its start tiles are drawn dashed). `t` is seconds.
 */
let lobbyLv: Level | null = null;
export function drawLobbyFloor(c: CanvasRenderingContext2D, w: number, h: number, seats: (string | null)[], t: number){
  ctx = c;
  ctx.clearRect(0, 0, w, h);
  const lv = lobbyLv = lobbyLv || parseLevel({ ...ROOMS[0], map: ROOMS[0].map.map(r => r.replace(/[^.]/g, ".")) });
  L = layoutIn(lv, 6, 6, w - 12, h - 12, 60);
  drawFloor(lv, (t * 2) % 1, PLAYER_COLORS[0]);
  lv.starts.forEach((pair, i) => {
    const col = seats[i];
    if (!col) {
      for (const p of pair) outline(p.x, p.y, rgba("#7d9692", 0.4), 1.5, 0.12, [L.s * 0.1, L.s * 0.07]);
      return;
    }
    pair.forEach((p, k) => {
      panel(p.x, p.y, rgba(col, 0.14));
      // each boot lifts in turn, two steps a second, the pairs a little out of step
      const lift = Math.max(0, Math.sin((t * 2 + k * 0.5 + i * 0.25) * Math.PI));
      drawBoot(ctx, cx(p.x), cy(p.y), 0, k === 0, L.s * 0.7 * (1 + 0.1 * lift), playerStyle(col, lift > 0.6, skinOfPlayer(i)));
    });
  });
  ctx = mainCtx;
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
  const skin = mySkin();
  drawBoot(c, px, py, 0, true, 40, { ...YOU_STYLE, glowSize: 8, skin });
  drawBoot(c, mx, my, sw, false, 40, { ...YOU_STYLE, glowSize: 18, skin });
}

// ---- the customize screen -----------------------------------------------------------------
/** your boots, in the game's teal, before a skin is put on */
const YOU_STYLE: BootStyle = { body: C.boot, edge: C.teal, detail: "#2a8f82", glow: C.teal, glowSize: 0 };

/** a skin's tile: the pair standing side by side, toes up */
export function drawSkinThumb(c: CanvasRenderingContext2D, w: number, h: number, skin: Skin, sel: boolean){
  c.clearRect(0, 0, w, h);
  const len = Math.min(h * 0.92, w * 0.44);
  for (const k of [0, 1]) {
    drawBoot(c, w / 2 + (k ? 1 : -1) * len * 0.36, h / 2, 0, k === 0, len, { ...YOU_STYLE, glowSize: sel ? len * 0.3 : len * 0.12, skin });
  }
}

/**
 * The big preview of a skin: the pair walking on a strip of lit tiles, the way the logo does,
 * sized to the canvas. `t` is seconds.
 */
export function drawSkinStage(c: CanvasRenderingContext2D, w: number, h: number, t: number, skin: Skin){
  c.clearRect(0, 0, w, h);
  // the swinging boot reaches 45° above and below the row of tiles: leave room for it
  const s = Math.min(w / 3.4, h / 2.6), ox = w / 2 - s * 1.5, oy = h / 2 - s * 0.5;
  const pulse = Math.exp(-((t * 2) % 1) * 5);
  for (let i = 0; i < 3; i++) {
    c.beginPath(); c.roundRect(ox + i * s + 2, oy + 2, s - 4, s - 4, s * 0.15);
    c.fillStyle = C.tile; c.fill(); c.strokeStyle = C.tileEdge; c.lineWidth = 1; c.stroke();
    c.beginPath(); c.roundRect(ox + i * s + s * 0.18, oy + s * 0.18, s * 0.64, s * 0.64, s * 0.1);
    c.fillStyle = rgba(C.teal, i === 1 ? 0.12 + 0.2 * pulse : 0.07 + 0.05 * pulse); c.fill();
  }
  const px = ox + s * 1.5, py = oy + s * 0.5, len = s * 0.75;
  const sw = Math.sin(t * 2.4) * Math.PI / 4;
  drawBoot(c, px, py, 0, true, len, { ...YOU_STYLE, glowSize: s * 0.15, skin });
  drawBoot(c, px + Math.cos(sw) * s, py + Math.sin(sw) * s, sw, false, len, { ...YOU_STYLE, glowSize: s * 0.3, skin });
}
