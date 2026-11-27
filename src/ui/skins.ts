import { sfx } from "../audio/audio";
import { PLAYER_COLORS } from "../game/match";
import { drawLobbyFloor, drawSkinStage, drawSkinThumb } from "../render/draw";
import { mySkin, SKINS, type Skin } from "../render/skins";
import { save, writeSave } from "../storage/save";
import { $ } from "./menus";
import { t } from "../i18n";

// ---------------------------------------------------------------------------
// BOOTS — the main menu's Boots tab: what you wear. The kinds of item across the top (only
// Patterns so far; Colours and Trails are marked soon), the skins in a grid below, and on the
// right the chosen one walking alone, or on the co-op floor with a team, with Equip. Your
// colour doesn't change (teal solo, your seat's colour in co-op); the skin is printed in it.
// Every skin is open for now.
// ---------------------------------------------------------------------------

/** the skin being looked at; Equip makes it the one you wear */
let picked: Skin = mySkin();
/** the preview: your pair alone, or with a full team on the co-op floor */
let inTeam = false;
let t0 = 0;

/** opening the tab: the grid, with the skin you wear picked */
export function enterBoots(){
  picked = mySkin();
  t0 = performance.now() / 1000;
  $("skCount").textContent = t("boots.unlocked", { a: SKINS.length, b: SKINS.length });
  buildGrid();
  select(picked);
  setPreview(inTeam);
}

function buildGrid(){
  const grid = $("skinGrid"); grid.innerHTML = "";
  for (const s of SKINS) {
    const b = document.createElement("button");
    b.className = "skin"; b.dataset.id = s.id;
    b.innerHTML = `<canvas></canvas><b>${s.name}</b>`;
    b.setAttribute("aria-label", s.name);
    // tap previews; tapping the previewed skin again puts it on
    b.onclick = () => { sfx("click"); if (picked === s) equip(); else select(s); };
    grid.appendChild(b);
  }
}

function select(s: Skin){
  picked = s;
  const worn = mySkin(), wearing = s === worn;
  document.querySelectorAll<HTMLElement>(".skin").forEach(b => {
    b.classList.toggle("sel", b.dataset.id === s.id);
    b.classList.toggle("worn", b.dataset.id === worn.id);
  });
  $("skTag").textContent = `${t("boots.pattern")} · ${wearing ? t("boots.wearingTag") : t("boots.nOfM", { a: SKINS.indexOf(s) + 1, b: SKINS.length })}`;
  $("skName").textContent = s.name;
  $("skAbout").textContent = s.about;
  $("skWearing").innerHTML = wearing ? "" : t("boots.wearing", { name: `<b>${worn.name}</b>` });
  const btn = $<HTMLButtonElement>("bSkinEquip");
  btn.disabled = wearing;
  btn.textContent = wearing ? t("boots.equipped") : t("boots.equip");
}

function setPreview(team: boolean){
  inTeam = team;
  $("pvSolo").classList.toggle("sel", !team);
  $("pvTeam").classList.toggle("sel", team);
}

function equip(){
  save.skin = picked.id; writeSave();
  select(picked);
}

/** a canvas at its CSS size, sharp on high-density screens; null while it has no size */
function fit(cv: HTMLCanvasElement): { c: CanvasRenderingContext2D; w: number; h: number } | null {
  const dpr = Math.min(2, window.devicePixelRatio || 1), w = cv.clientWidth, h = cv.clientHeight;
  if (!w || !h) return null;
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  const c = cv.getContext("2d")!;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { c, w, h };
}

/** every frame while the tab is open: the tiles and the preview */
export function drawBoots(){
  document.querySelectorAll<HTMLElement>(".skin").forEach(b => {
    const f = fit(b.querySelector("canvas")!);
    const s = SKINS.find(x => x.id === b.dataset.id);
    if (f && s) drawSkinThumb(f.c, f.w, f.h, s, s === picked);
  });
  const f = fit($<HTMLCanvasElement>("skinStage"));
  if (!f) return;
  const t = performance.now() / 1000 - t0;
  // in a team: a full team on the co-op floor, you in the skin you're looking at
  if (inTeam) drawLobbyFloor(f.c, f.w, f.h, PLAYER_COLORS, t, picked);
  else drawSkinStage(f.c, f.w, f.h, t, picked);
}

export function initBoots(){
  $("bSkinEquip").addEventListener("click", () => { sfx("click"); equip(); });
  $("pvSolo").addEventListener("click", () => { sfx("click"); setPreview(false); });
  $("pvTeam").addEventListener("click", () => { sfx("click"); setPreview(true); });
}
