// the game canvas, sized to its container in CSS pixels and backed at up to 2x for sharpness.
const cv = document.getElementById("cv") as HTMLCanvasElement;
export const ctx = cv.getContext("2d") as CanvasRenderingContext2D;
export const view = { w: 0, h: 0 };

export function resize(){
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const r = (cv.parentNode as HTMLElement).getBoundingClientRect();
  view.w = r.width; view.h = r.height;
  cv.width = Math.round(view.w * dpr); cv.height = Math.round(view.h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
export function initCanvas(){ window.addEventListener("resize", resize); }
