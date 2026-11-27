import { save } from "../storage/save";

// ---------------------------------------------------------------------------
// AUDIO — synthesised with Web Audio, no files. Phones only allow sound after a user
// gesture, so the engine starts on the first touch or key.
//
// Two buses: sound effects and music (music.ts), each with its own switch in Settings, into
// one compressor. The music tells this file which key and chord it is in (setHarmony), so
// steps, pickups and the win play in tune with the song.
// ---------------------------------------------------------------------------
export let ctx: AudioContext | null = null;
let sfxBus: GainNode | null = null;
export let musicBus: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;

const SFX_VOL = 0.8, MUSIC_VOL = 0.5;

export function soundOn(){ return save.sfx !== 0; }
export function musicOn(){ return save.music !== 0; }
export function setSound(on: boolean){ save.sfx = on ? 1 : 0; if (sfxBus) sfxBus.gain.value = on ? SFX_VOL : 0; }
export function setMusic(on: boolean){ save.music = on ? 1 : 0; if (musicBus) musicBus.gain.value = on ? MUSIC_VOL : 0; }

function boot(){
  if (ctx) { if (ctx.state === "suspended") ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  try { ctx = new AC(); } catch { return; }
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(ctx.destination);
  sfxBus = ctx.createGain(); sfxBus.gain.value = soundOn() ? SFX_VOL : 0; sfxBus.connect(comp);
  musicBus = ctx.createGain(); musicBus.gain.value = musicOn() ? MUSIC_VOL : 0; musicBus.connect(comp);
  // one second of white noise, shared by every hat, snare and swish
  const n = ctx.sampleRate; noiseBuf = ctx.createBuffer(1, n, n);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
}
export function initAudio(){
  const go = () => boot();
  window.addEventListener("pointerdown", go, { passive: true });
  window.addEventListener("keydown", go);
}
export function suspendAudio(){ ctx?.suspend(); }
export function resumeAudio(){ ctx?.resume(); }

// ---- voices: the building blocks of the effects and of every instrument in the music -----
export interface ToneOpts {
  type?: OscillatorType; vol?: number;
  /** glide to this frequency over the note */
  to?: number;
  /** seconds: attack, and how long it holds before it fades over the rest of `dur` */
  attack?: number; hold?: number;
  /** a low-pass filter on the voice, and its resonance */
  cutoff?: number; q?: number;
  detune?: number;
}
/** one oscillator note at time t into dest; returns its output so a caller can add sends */
export function tone(dest: AudioNode, t: number, freq: number, dur: number, o: ToneOpts = {}): GainNode | null {
  if (!ctx) return null;
  const osc = ctx.createOscillator(), g = ctx.createGain();
  const a = o.attack ?? 0.005, hold = o.hold ?? 0;
  osc.type = o.type || "sine";
  osc.frequency.setValueAtTime(freq, t);
  if (o.detune) osc.detune.value = o.detune;
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(o.vol ?? 0.2, t + a);
  if (hold) g.gain.setValueAtTime(o.vol ?? 0.2, t + a + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(dur, a + hold + 0.01));
  let src: AudioNode = osc;
  if (o.cutoff) { const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = o.cutoff; f.Q.value = o.q ?? 0.7; osc.connect(f); src = f; }
  src.connect(g); g.connect(dest);
  osc.start(t); osc.stop(t + Math.max(dur, a + hold) + 0.05);
  return g;
}
/** a burst of filtered noise: hats, snares, the swish of a step */
export function noise(dest: AudioNode, t: number, dur: number, vol: number, freq: number, type: BiquadFilterType = "bandpass", q = 0.9){
  if (!ctx || !noiseBuf) return;
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf; f.type = type; f.frequency.value = freq; f.Q.value = q;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(dest);
  s.start(t, Math.random() * 0.9); s.stop(t + dur + 0.02);
}

// ---- harmony: what the music is playing now, so effects can be in tune with it ----------
export interface Harmony {
  /** MIDI note of the key's tonic, around the 3rd octave (A3 = 57) */
  root: number;
  /** the key's seven notes, semitones from the tonic */
  scale: number[];
  /** the current chord: its root as a degree of the scale (0 = tonic) */
  chord: number;
}
let harmony: Harmony | null = null;
export function setHarmony(h: Harmony | null){ harmony = h; }

export const midiHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
/** a scale degree (any integer, 7 = the tonic an octave up) as a MIDI note */
export const degMidi = (root: number, scale: number[], d: number) =>
  root + 12 * Math.floor(d / 7) + scale[((d % 7) + 7) % 7];

// without music: a minor pentatonic, so pickups still climb a scale
const PENTA = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24];
const note = (semi: number) => 440 * Math.pow(2, semi / 12);
/** the n-th pickup: up the current chord, octave by octave */
function pickHz(n: number): number {
  if (!harmony) return note(PENTA[Math.min(n, PENTA.length - 1)]);
  const k = Math.max(0, Math.min(n - 1, 8));
  const rel = [0, 2, 4][k % 3] + 7 * Math.floor(k / 3);
  return midiHz(degMidi(harmony.root + 12, harmony.scale, harmony.chord + rel));
}
/** steps: the left boot on the chord's root, the right one on its fifth */
function stepHz(right: boolean): number {
  if (!harmony) return right ? 392 : 330;
  return midiHz(degMidi(harmony.root, harmony.scale, harmony.chord + (right ? 4 : 0)) + 12);
}

export type Sound = "stepL" | "stepR" | "bump" | "pick" | "die" | "win" | "beat" | "click";
export function sfx(s: Sound, n = 0){
  if (!ctx || !sfxBus || !soundOn()) return;
  const t = ctx.currentTime, b = sfxBus;
  switch (s) {
    case "stepL": case "stepR": {
      const f = stepHz(s === "stepR");
      tone(b, t, f, 0.07, { type: "triangle", vol: 0.16, to: f * 0.8 }); noise(b, t, 0.03, 0.12, s === "stepR" ? 2800 : 2400);
      break;
    }
    case "bump": tone(b, t, 150, 0.09, { type: "square", vol: 0.1, to: 110 }); tone(b, t + 0.05, 520, 0.06, { type: "triangle", vol: 0.08, to: 300 }); break;
    case "pick": { const f = pickHz(n); tone(b, t, f, 0.18, { vol: 0.18 }); tone(b, t + 0.04, f * 2, 0.12, { vol: 0.08 }); break; }
    case "die": tone(b, t, 180, 0.28, { type: "sawtooth", vol: 0.14, to: 60 }); noise(b, t, 0.18, 0.25, 700); break;
    case "win": {
      // the key's tonic chord, rising, whatever chord the song was on
      const h = harmony, notes = h ? [0, 2, 4, 7].map(d => midiHz(degMidi(h.root + 12, h.scale, d))) : [0, 4, 7, 12].map(x => note(x + 3));
      notes.forEach((f, i) => { tone(b, t + i * 0.08, f, 0.35, { type: "triangle", vol: 0.14 }); tone(b, t + i * 0.08, f * 2, 0.25, { vol: 0.05 }); });
      break;
    }
    // the beat as a tick, only when there is no music to carry it
    case "beat": if (!musicOn()) noise(b, t, 0.025, n % 4 === 0 ? 0.07 : 0.035, 6000); break;
    case "click": tone(b, t, 660, 0.04, { type: "square", vol: 0.05 }); break;
  }
}
