import { save } from "../storage/save";
import type { BootStyle } from "./boot";
import { t, type Key } from "../i18n";

/** a skin's name and blurb, looked up in the current language */
const text = (id: string) => ({
  get name(){ return t(`skin.${id}` as Key); },
  get about(){ return t(`skin.${id}.about` as Key); },
});

// ---------------------------------------------------------------------------
// SKINS — the pattern on a pair of boots. Colour says who a pair belongs to (teal is you, each
// co-op player has their own); the skin is the print on top of it, painted in that colour, so
// every skin works for every player. All are open for now; unlocking can come later.
//
// paint() draws in the boot's own space: toe at -y, the sole about W wide and L long, centred on
// the origin. It is clipped to the sole, so it can paint past the edge freely.
// ---------------------------------------------------------------------------
type Paint = (c: CanvasRenderingContext2D, L: number, W: number, st: BootStyle) => void;
export interface Skin {
  /** name and about are in the current language (i18n: skin.<id>) */
  id: string; readonly name: string; readonly about: string;
  paint?: Paint;
  /** a dark print: the toe cap, laces and opening are drawn light so they still show */
  dark?: boolean;
}

/** a fixed scatter in -1..1, the same every frame */
function scatter(n: number, seed: number): [number, number, number][] {
  let s = seed;
  const r = () => { s = (s * 16807) % 2147483647; return (s / 2147483647) * 2 - 1; };
  return Array.from({ length: n }, () => [r(), r(), (r() + 1) / 2]);
}
const SPECKS = scatter(34, 7), CAMO = scatter(11, 31);

function star(c: CanvasRenderingContext2D, x: number, y: number, r: number, rot = 0){
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = rot - Math.PI / 2 + (i * Math.PI) / 5, k = i % 2 ? r * 0.45 : r;
    i ? c.lineTo(x + Math.cos(a) * k, y + Math.sin(a) * k) : c.moveTo(x + Math.cos(a) * k, y + Math.sin(a) * k);
  }
  c.closePath(); c.fill();
}

/** flame tongues licking back from the toe; `reach` is how far toward the heel they get */
function flames(c: CanvasRenderingContext2D, L: number, W: number, reach: number){
  const tips = [0.55, 0.85, 0.45, 1, 0.6];
  c.beginPath();
  c.moveTo(-W * 0.7, -L * 0.55);
  c.lineTo(-W * 0.7, -L * 0.2);
  tips.forEach((t, i) => {
    const x0 = -W * 0.7 + (i * W * 1.4) / tips.length, x1 = x0 + (W * 1.4) / tips.length;
    const tip = -L * 0.2 + L * reach * t;
    c.quadraticCurveTo(x0, tip * 0.6, (x0 + x1) / 2, tip);
    c.quadraticCurveTo(x1, tip * 0.4, x1, -L * 0.2);
  });
  c.lineTo(W * 0.7, -L * 0.55);
  c.closePath(); c.fill();
}

export const SKINS: Skin[] = [
  { id: "classic", ...text("classic") },
  {
    id: "racer", ...text("racer"),
    paint(c, L, W, st){
      c.fillStyle = st.detail; c.globalAlpha = 0.85;
      c.fillRect(-W * 0.27, -L, W * 0.16, L * 2);
      c.fillRect(W * 0.11, -L, W * 0.16, L * 2);
    },
  },
  {
    id: "tiger", ...text("tiger"),
    paint(c, L, W, st){
      c.fillStyle = st.detail; c.globalAlpha = 0.9;
      for (let k = 0; k < 7; k++) {
        const y = -L * 0.5 + k * L * 0.16, side = k % 2 ? 1 : -1, reach = 0.3 + (k % 3) * 0.08;
        for (const s of [side, -side]) {
          c.beginPath();
          c.moveTo(s * W * 0.6, y - L * 0.06);
          c.lineTo(s * W * 0.6, y + L * 0.06);
          c.lineTo(s * W * (0.6 - reach - (s === side ? 0.12 : 0)), y + L * 0.075);
          c.closePath(); c.fill();
        }
      }
    },
  },
  {
    id: "dots", ...text("dots"),
    paint(c, L, W, st){
      c.fillStyle = st.detail; c.globalAlpha = 0.85;
      for (let gy = -4; gy <= 4; gy++) for (let gx = -2; gx <= 2; gx++) {
        c.beginPath();
        c.arc(gx * W * 0.32 + (gy % 2 ? W * 0.16 : 0), gy * L * 0.14, W * 0.08, 0, Math.PI * 2);
        c.fill();
      }
    },
  },
  {
    id: "checker", ...text("checker"),
    paint(c, L, W, st){
      const q = W * 0.2, qy = L * 0.125;
      c.fillStyle = st.detail; c.globalAlpha = 0.7;
      for (let j = -4; j < 4; j++) for (let i = -3; i < 3; i++) if ((i + j) & 1) c.fillRect(i * q, j * qy, q, qy);
    },
  },
  {
    id: "zigzag", ...text("zigzag"),
    paint(c, L, W, st){
      c.strokeStyle = st.detail; c.globalAlpha = 0.85; c.lineWidth = L * 0.05; c.lineJoin = "miter";
      for (let y = -L * 0.5; y <= L * 0.55; y += L * 0.17) {
        c.beginPath();
        for (let i = 0; i <= 8; i++) {
          const x = -W * 0.6 + i * W * 0.15, yy = y + (i % 2 ? L * 0.045 : -L * 0.045);
          i ? c.lineTo(x, yy) : c.moveTo(x, yy);
        }
        c.stroke();
      }
    },
  },
  {
    id: "camo", ...text("camo"),
    paint(c, L, W, st){
      CAMO.forEach(([x, y, r], i) => {
        c.fillStyle = i % 2 ? st.detail : st.edge; c.globalAlpha = i % 2 ? 0.75 : 0.7;
        c.beginPath(); c.ellipse(x * W * 0.5, y * L * 0.5, W * (0.12 + r * 0.14), L * (0.06 + r * 0.07), x * 2, 0, Math.PI * 2);
        c.fill();
        c.beginPath(); c.ellipse(x * W * 0.5 + W * 0.1, y * L * 0.5 + L * 0.04, W * (0.08 + r * 0.08), L * (0.05 + r * 0.04), y, 0, Math.PI * 2);
        c.fill();
      });
    },
  },
  {
    id: "stars", ...text("stars"),
    paint(c, L, W, st){
      c.fillStyle = st.detail; c.globalAlpha = 0.9;
      const at: [number, number, number][] = [[-0.16, -0.34, 1], [0.22, -0.12, 0.85], [-0.2, 0.08, 0.8], [0.16, 0.3, 1]];
      at.forEach(([x, y, k], i) => star(c, x * W, y * L, W * 0.2 * k, i * 0.4));
    },
  },
  {
    id: "flames", ...text("flames"),
    paint(c, L, W, st){
      c.fillStyle = st.detail; c.globalAlpha = 0.9; flames(c, L, W, 0.7);
      c.fillStyle = st.edge; c.globalAlpha = 1; flames(c, L * 0.92, W * 0.75, 0.42);
    },
  },
  {
    id: "circuit", ...text("circuit"),
    paint(c, L, W, st){
      const lines: [number, number][][] = [
        [[-0.3, -0.5], [-0.3, -0.2], [-0.1, -0.05], [-0.1, 0.5]],
        [[0.25, -0.5], [0.25, -0.3], [0.08, -0.15], [0.08, 0.1], [0.28, 0.28], [0.28, 0.5]],
        [[-0.5, 0.15], [-0.32, 0.15], [-0.22, 0.3]],
        [[0.5, -0.05], [0.3, -0.05]],
      ];
      c.strokeStyle = st.detail; c.fillStyle = st.detail; c.globalAlpha = 0.9;
      c.lineWidth = L * 0.045; c.lineJoin = "round";
      for (const ln of lines) {
        c.beginPath();
        ln.forEach(([x, y], i) => i ? c.lineTo(x * W, y * L) : c.moveTo(x * W, y * L));
        c.stroke();
        const [ex, ey] = ln[ln.length - 1], [sx, sy] = ln[0];
        for (const [x, y] of [[ex, ey], [sx, sy]]) if (Math.abs(x) < 0.45 && Math.abs(y) < 0.45) {
          c.beginPath(); c.arc(x * W, y * L, L * 0.05, 0, Math.PI * 2); c.fill();
        }
      }
    },
  },
  {
    id: "twotone", ...text("twotone"),
    paint(c, L, W, st){
      c.fillStyle = st.edge; c.globalAlpha = 1;
      c.beginPath(); c.moveTo(-W, -L); c.lineTo(W, -L); c.lineTo(W, -L * 0.12); c.lineTo(-W, L * 0.02); c.closePath(); c.fill();
      c.fillStyle = st.detail; c.globalAlpha = 0.6;
      c.beginPath(); c.moveTo(-W, -L); c.lineTo(W, -L); c.lineTo(W, -L * 0.3); c.lineTo(-W, -L * 0.18); c.closePath(); c.fill();
      c.strokeStyle = st.detail; c.globalAlpha = 1; c.lineWidth = L * 0.04;
      c.beginPath(); c.moveTo(W, -L * 0.12); c.lineTo(-W, L * 0.02); c.stroke();
    },
  },
  {
    id: "galaxy", ...text("galaxy"), dark: true,
    paint(c, L, W, st){
      c.fillStyle = st.detail; c.fillRect(-W, -L, W * 2, L * 2);
      c.fillStyle = st.edge; c.globalAlpha = 0.35;
      c.beginPath(); c.ellipse(W * 0.1, -L * 0.1, W * 0.35, L * 0.2, 0.6, 0, Math.PI * 2); c.fill();
      c.fillStyle = "#ffffff";
      for (const [x, y, r] of SPECKS) {
        c.globalAlpha = 0.4 + 0.6 * r;
        c.beginPath(); c.arc(x * W * 0.5, y * L * 0.5, L * (0.008 + 0.014 * r), 0, Math.PI * 2); c.fill();
      }
      c.globalAlpha = 1; star(c, -W * 0.18, -L * 0.3, W * 0.09); star(c, W * 0.2, L * 0.22, W * 0.07, 0.5);
    },
  },
];

const BY_ID = new Map(SKINS.map(s => [s.id, s]));
export const skinById = (id: string | undefined): Skin => BY_ID.get(id ?? "") ?? SKINS[0];

/** the skin you wear */
export const mySkin = (): Skin => skinById(save.skin);

/**
 * The skin of co-op player `i` (0 is you). Bots each wear a different one, never yours, so
 * every pair on the floor reads apart by pattern as well as colour. `mine` is the skin you
 * wear, or one you are trying on in the Boots tab.
 */
export function skinOfPlayer(i: number, mine: Skin = mySkin()): Skin {
  if (i === 0) return mine;
  const others = SKINS.filter(s => s !== mine && s.id !== "classic");
  return others[((i - 1) * 4) % others.length];
}
