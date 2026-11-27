import { ctx, musicBus, musicOn, midiHz, noise, setHarmony, tone } from "./audio";
import { chordAt, compose, eventsAt, type Ev, type Song, type TrackId } from "./score";

// ---------------------------------------------------------------------------
// MUSIC — plays the score (score.ts) in time with the game.
//
// The game doesn't call the music; every frame the music is told where the game's clock is
// (a Transport) and schedules the ticks that fall in the next ~120 ms on the audio clock.
// Ticks are placed from the game's own fractional tick, so the beat stays locked to the
// hazards and frame hiccups don't make it wobble. When the clock stops (pause, a fall, a
// win) the song fades; when it jumps back by more than a tick or two (a retry) the song starts again from its top.
// On menus (no transport) the menu's track runs on the audio clock by itself.
// ---------------------------------------------------------------------------

export interface Transport {
  /** what is playing: changing it starts another song */
  id: string;
  track: TrackId;
  /** ticks per beat */
  beat: number;
  /** the game's clock in fractional ticks; below 0 for a countdown */
  tickF: number;
  /** false while paused, after a fall, after the end */
  playing: boolean;
}

const LOOKAHEAD_S = 0.12;
let tickS = 0.125;
export function setTickMs(ms: number){ tickS = ms / 1000; }

interface Live {
  id: string;
  song: Song;
  /** the song's own faders: dry, and the sends into the shared delay and reverb */
  out: GainNode; dly: GainNode; rev: GainNode;
  /** the next tick to schedule, and the clock last frame */
  next: number; last: number;
  target: number;
  /** the menu runs on the audio clock from this time */
  t0: number;
}
let live: Live | null = null;
/** the last level song, so a retry of the same level doesn't build up from nothing again */
let lastGameId = "";

// ---- shared effects: an echo and a short room ---------------------------------------------
let delay: DelayNode | null = null, verb: ConvolverNode | null = null;
function fx(){
  if (!ctx || !musicBus || delay) return;
  delay = ctx.createDelay(2);
  const fb = ctx.createGain(), lp = ctx.createBiquadFilter(), wet = ctx.createGain();
  fb.gain.value = 0.3; lp.type = "lowpass"; lp.frequency.value = 2600; wet.gain.value = 0.45;
  delay.connect(lp); lp.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(musicBus);
  // a room from decaying noise: 1.6 s, a little wider on the right
  const len = Math.floor(ctx.sampleRate * 1.6), ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  }
  verb = ctx.createConvolver(); verb.buffer = ir;
  const vg = ctx.createGain(); vg.gain.value = 0.35; verb.connect(vg); vg.connect(musicBus);
}

function start(id: string, track: TrackId, beat: number, tickF: number, now: number): Live {
  const c = ctx!;
  const fresh = id === "menu" || id !== lastGameId;
  if (id !== "menu") lastGameId = id;
  const out = c.createGain(), dly = c.createGain(), rev = c.createGain();
  out.gain.value = 0; dly.gain.value = 0.35; rev.gain.value = 0.4;
  out.connect(musicBus!); dly.connect(delay!); rev.connect(verb!);
  // the echo repeats on the dotted eighth of this tempo
  delay!.delayTime.setValueAtTime(0.75 * beat * tickS, now);
  const l: Live = { id, song: compose(track, id, beat, fresh), out, dly, rev, next: Math.ceil(tickF - 1e-6), last: tickF, target: 0, t0: now };
  return l;
}

function fade(l: Live, to: number, tc: number){
  if (!ctx) return;
  const t = ctx.currentTime;
  for (const g of [l.out, l.dly, l.rev]) {
    const base = g === l.out ? 1 : g === l.dly ? 0.35 : 0.4;
    g.gain.cancelScheduledValues(t);
    g.gain.setTargetAtTime(to * base, t, tc);
  }
  l.target = to;
}
function retire(l: Live, tc: number){
  fade(l, 0, tc);
  setTimeout(() => { l.out.disconnect(); l.dly.disconnect(); l.rev.disconnect(); }, (tc * 10 + 0.5) * 1000);
}

/** every frame: where the game's clock is, or null on menus */
export function updateMusic(tr: Transport | null){
  if (!ctx || !musicBus) return;
  if (!musicOn() || ctx.state !== "running") {
    if (live && !musicOn()) { retire(live, 0.05); live = null; setHarmony(null); }
    return;
  }
  fx();
  const now = ctx.currentTime;
  const want = tr ?? { id: "menu", track: "menu" as TrackId, beat: 4, tickF: live?.id === "menu" ? (now - live.t0) / tickS : 0, playing: true };

  if (!live || live.id !== want.id || want.tickF < live.last - 2) {
    const cross = live && live.id !== want.id;
    if (live) retire(live, cross ? 0.25 : 0.03);
    live = start(want.id, want.track, want.beat, want.tickF, now);
  }
  const l = live;
  l.last = want.tickF;

  const target = want.playing ? 1 : 0;
  // the menu eases in; a level comes in at once, on its first kick
  if (target !== l.target) fade(l, target, target ? (l.id === "menu" ? 0.6 : 0.01) : 0.06);
  setHarmony({ root: l.song.track.root, scale: l.song.track.scale, chord: chordAt(l.song, Math.floor(want.tickF)) });
  if (!want.playing) return;

  const horizon = want.tickF + LOOKAHEAD_S / tickS;
  while (l.next <= horizon) {
    const at = now + (l.next - want.tickF) * tickS;
    if (at >= now - 0.02) for (const ev of eventsAt(l.song, l.next)) play(l, ev, Math.max(at, now));
    l.next++;
  }
}

// ---- the instruments --------------------------------------------------------------------
function play(l: Live, e: Ev, t: number){
  const v = e.vol, out = l.out, tr = l.song.track, soft = tr.groove === "soft";
  const dur = (e.ticks ?? 1) * tickS;
  switch (e.part) {
    case "kick":
      tone(out, t, 150, 0.3, { vol: 0.85 * v, to: 42 });
      noise(out, t, 0.01, 0.15 * v, 3000, "highpass");
      break;
    case "snare":
      noise(out, t, 0.15, 0.3 * v, 1900, "bandpass", 0.7);
      noise(l.rev, t, 0.15, 0.12 * v, 1900, "bandpass", 0.7);
      tone(out, t, 190, 0.09, { type: "triangle", vol: 0.16 * v, to: 150 });
      break;
    case "hat": noise(out, t, 0.035, 0.12 * v, 8000, "highpass", 0.7); break;
    case "ohat": noise(out, t, 0.16, 0.09 * v, 7500, "highpass", 0.7); break;
    case "rim":
      tone(out, t, 1250, 0.035, { type: "triangle", vol: 0.2 * v });
      noise(out, t, 0.02, 0.1 * v, 3500);
      break;
    case "bass":
      for (const n of e.midi!) {
        const f = midiHz(n), d = Math.max(0.08, dur * 0.92);
        // a sine for weight, and a filtered saw so a phone speaker can hear the line
        tone(out, t, f, d, { vol: 0.2 * v, hold: d * 0.5 });
        if (!soft) tone(out, t, f, d, { type: "sawtooth", vol: 0.13 * v, cutoff: 560, q: 5, hold: d * 0.4 });
        else tone(out, t, f * 2, d, { type: "triangle", vol: 0.05 * v, hold: d * 0.5 });
      }
      break;
    case "pad":
      for (const n of e.midi!) {
        const f = midiHz(n), a = Math.min(0.3, dur * 0.25), hold = Math.max(0, dur - a - 0.3);
        for (const det of [-7, 7]) {
          const g = tone(out, t, f, dur + 0.3, { type: soft ? "triangle" : "sawtooth", vol: soft ? 0.03 : 0.022, attack: a, hold, cutoff: soft ? 1400 : 1100, detune: det });
          g?.connect(l.rev);
        }
      }
      break;
    case "lead": {
      const f = midiHz(e.midi![0]), d = Math.max(0.12, dur * 1.1);
      const g = tone(out, t, f, d, { type: tr.lead, vol: tr.lead === "sine" || tr.lead === "triangle" ? 0.13 : 0.06, cutoff: tr.bright, attack: 0.012, hold: d * 0.5 });
      g?.connect(l.dly); g?.connect(l.rev);
      break;
    }
    case "arp": {
      const g = tone(out, t, midiHz(e.midi![0]), 0.22, { vol: soft ? 0.05 : 0.04 });
      g?.connect(l.dly);
      break;
    }
  }
}
