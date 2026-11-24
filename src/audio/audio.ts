import { save } from "../storage/save";

// ---------------------------------------------------------------------------
// AUDIO — synthesised with Web Audio, no files. Phones only allow sound after a user
// gesture, so the engine starts on the first touch or key.
// ---------------------------------------------------------------------------
let ctx: AudioContext | null = null;
let bus: GainNode | null = null;

export function soundOn(){ return save.sfx !== 0; }
export function setSound(on: boolean){ save.sfx = on ? 1 : 0; if (bus) bus.gain.value = on ? 0.8 : 0; }

function boot(){
  if (ctx) { if (ctx.state === "suspended") ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  try { ctx = new AC(); } catch { return; }
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(ctx.destination);
  bus = ctx.createGain(); bus.gain.value = soundOn() ? 0.8 : 0; bus.connect(comp);
}
export function initAudio(){
  const go = () => boot();
  window.addEventListener("pointerdown", go, { passive: true });
  window.addEventListener("keydown", go);
}
export function suspendAudio(){ ctx?.suspend(); }
export function resumeAudio(){ ctx?.resume(); }

function tone(freq: number, dur: number, opts: { type?: OscillatorType; vol?: number; to?: number; delay?: number } = {}){
  if (!ctx || !bus || !soundOn()) return;
  const t = ctx.currentTime + (opts.delay || 0);
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = opts.type || "sine";
  o.frequency.setValueAtTime(freq, t);
  if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(opts.vol ?? 0.2, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(bus);
  o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur: number, vol: number, f: number){
  if (!ctx || !bus || !soundOn()) return;
  const t = ctx.currentTime, n = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = ctx.createBufferSource(), flt = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = buf; flt.type = "bandpass"; flt.frequency.value = f; flt.Q.value = 0.9; g.gain.value = vol;
  s.connect(flt); flt.connect(g); g.connect(bus); s.start(t);
}

// a minor pentatonic, so pickups climb a scale that always sounds right over the beat
const SCALE = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24];
const note = (semi: number) => 440 * Math.pow(2, semi / 12);

export type Sound = "stepL" | "stepR" | "bump" | "pick" | "die" | "win" | "beat" | "click";
export function sfx(s: Sound, n = 0){
  switch (s) {
    case "stepL": tone(330, 0.07, { type: "triangle", vol: 0.16, to: 260 }); noise(0.03, 0.12, 2400); break;
    case "stepR": tone(392, 0.07, { type: "triangle", vol: 0.16, to: 310 }); noise(0.03, 0.12, 2800); break;
    case "bump": tone(150, 0.09, { type: "square", vol: 0.1, to: 110 }); tone(520, 0.06, { type: "triangle", vol: 0.08, to: 300, delay: 0.05 }); break;
    case "pick": tone(note(SCALE[Math.min(n, SCALE.length - 1)]), 0.18, { vol: 0.18 }); tone(note(SCALE[Math.min(n, SCALE.length - 1)] + 12), 0.12, { vol: 0.08, delay: 0.04 }); break;
    case "die": tone(180, 0.28, { type: "sawtooth", vol: 0.14, to: 60 }); noise(0.18, 0.25, 700); break;
    case "win": [0, 4, 7, 12].forEach((s2, i) => tone(note(s2 + 3), 0.3, { vol: 0.15, delay: i * 0.08 })); break;
    case "beat": noise(0.025, n % 4 === 0 ? 0.07 : 0.035, 6000); break;
    case "click": tone(660, 0.04, { type: "square", vol: 0.05 }); break;
  }
}
