// A boot seen from straight above: a sole that is wider at the toe, a toe cap, laces, and the
// round opening of the shaft over the heel. Drawn pointing up (toe at -y), centred on the
// origin; the caller rotates it. `left` mirrors it so the big toe is on the inner side.
// A skin (skins.ts) prints its pattern on the sole, between the fill and the outlines.
import type { Skin } from "./skins";
export interface BootStyle { body: string; edge: string; detail: string; glow: string; glowSize: number; skin?: Skin }

function solePath(c: CanvasRenderingContext2D, L: number, W: number){
  c.beginPath();
  c.moveTo(0, L * 0.5);                                                    // heel
  c.bezierCurveTo(W * 0.42, L * 0.5, W * 0.4, L * 0.18, W * 0.45, -L * 0.06);   // outer side
  c.bezierCurveTo(W * 0.52, -L * 0.36, W * 0.3, -L * 0.5, 0, -L * 0.5);         // round toe
  c.bezierCurveTo(-W * 0.38, -L * 0.5, -W * 0.52, -L * 0.34, -W * 0.48, -L * 0.08); // big-toe side
  c.bezierCurveTo(-W * 0.44, L * 0.16, -W * 0.42, L * 0.5, 0, L * 0.5);         // arch back to the heel
  c.closePath();
}

export function drawBoot(c: CanvasRenderingContext2D, x: number, y: number, angle: number, left: boolean,
                         len: number, st: BootStyle){
  const L = len, W = len * 0.58, lw = Math.max(1, L * 0.045);
  c.save();
  c.translate(x, y); c.rotate(angle);
  if (left) c.scale(-1, 1);
  c.shadowColor = st.glow; c.shadowBlur = st.glowSize;
  solePath(c, L, W);
  c.fillStyle = st.body; c.fill();
  c.shadowBlur = 0;
  if (st.skin?.paint) {
    c.save(); c.clip(); st.skin.paint(c, L, W, st); c.restore();
    solePath(c, L, W);
  }
  c.lineWidth = lw; c.strokeStyle = st.edge; c.stroke();
  c.lineCap = "round"; c.strokeStyle = st.skin?.dark ? st.body : st.detail;
  // toe cap
  c.beginPath(); c.ellipse(-W * 0.03, -L * 0.3, W * 0.3, L * 0.13, 0, Math.PI * 1.05, Math.PI * 1.95, true);
  c.lineWidth = lw; c.stroke();
  // laces
  for (let i = 0; i < 3; i++) {
    const ly = -L * 0.1 + i * L * 0.085;
    c.beginPath(); c.moveTo(-W * 0.16, ly); c.lineTo(W * 0.16, ly); c.lineWidth = lw * 0.9; c.stroke();
  }
  // the shaft opening over the heel
  c.beginPath(); c.ellipse(0, L * 0.27, W * 0.3, L * 0.16, 0, 0, Math.PI * 2);
  c.lineWidth = lw * 1.3; c.stroke();
  c.restore();
}
