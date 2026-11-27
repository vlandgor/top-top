import type { Mode } from "../core/types";

// ---------------------------------------------------------------------------
// SCORE — what the music plays, as pure data: no Web Audio here (music.ts plays it).
//
// The music runs on the game's own clock. A step of the music is one game tick (125 ms) and a
// beat is the level's beat (4, 5 or 6 ticks), so the kick lands exactly when the hazards step,
// whatever the tempo. A bar is 4 beats.
//
// Each mode has a track: a key, a four-chord progression and a groove. Each level gets its
// own melody, composed from its id: the same level always plays the same tune. Melodies are
// written relative to the chord under them (0 = the chord's root, 2 its third, 4 its fifth),
// so they stay in tune over any chord, and follow an A A' A B shape over 8 bars.
// ---------------------------------------------------------------------------

export type TrackId = Mode | "menu";
export type Groove = "four" | "drive" | "half" | "soft";

export interface Track {
  /** MIDI note of the tonic (A3 = 57). bass sits an octave below, the melody an octave above */
  root: number;
  scale: number[];
  /** chord roots as scale degrees, one per `barsPerChord` bars, looping */
  prog: number[];
  barsPerChord: number;
  groove: Groove;
  /** the melody's sound, and how bright it is (low-pass cutoff, Hz) */
  lead: OscillatorType;
  bright: number;
  /** long notes only: the menu's melody */
  sparse?: boolean;
}

const MINOR = [0, 2, 3, 5, 7, 8, 10];
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const LYDIAN = [0, 2, 4, 6, 7, 9, 11];
const HARMONIC = [0, 2, 3, 5, 7, 8, 11];

export const TRACKS: Record<TrackId, Track> = {
  //                        Am  F   C   G
  destination: { root: 57, scale: MINOR, prog: [0, 5, 2, 6], barsPerChord: 1, groove: "four", lead: "square", bright: 2400 },
  //                        G   D   Em  C
  collect:     { root: 55, scale: MAJOR, prog: [0, 4, 5, 3], barsPerChord: 1, groove: "four", lead: "triangle", bright: 4000 },
  //                        Em  C   D   Bm
  sequence:    { root: 52, scale: MINOR, prog: [0, 5, 6, 4], barsPerChord: 1, groove: "half", lead: "sine", bright: 3000 },
  //                        F#m F#m D   C#
  survival:    { root: 54, scale: HARMONIC, prog: [0, 0, 5, 4], barsPerChord: 1, groove: "drive", lead: "sawtooth", bright: 1800 },
  //                        F   G   Dm  C
  waves:       { root: 53, scale: LYDIAN, prog: [0, 1, 5, 4], barsPerChord: 1, groove: "half", lead: "triangle", bright: 3200 },
  //                        C   Am  F   G, two bars each
  menu:        { root: 60, scale: MAJOR, prog: [0, 5, 3, 4], barsPerChord: 2, groove: "soft", lead: "sine", bright: 2500, sparse: true },
};

export type Part = "kick" | "snare" | "hat" | "ohat" | "rim" | "bass" | "pad" | "lead" | "arp";
/** one sound at one tick. midi: the note(s); ticks: how long it lasts; vol: 0..1 accent */
export interface Ev { part: Part; vol: number; midi?: number[]; ticks?: number }

interface MelNote { rel: number; ticks: number }
export interface Song {
  track: Track;
  /** ticks per beat */
  beat: number;
  /** the melody over 8 bars, by tick from the start of the loop */
  melody: Map<number, MelNote>;
  /** the arpeggio's pattern, chord-relative */
  arp: number[];
  /** a first try builds up layer by layer; a retry starts with everything */
  fresh: boolean;
}

// bar rhythms in half-beats (8 to a bar); a negative length is a rest
const RHYTHMS = [
  [2, 2, 2, 2], [3, 1, 2, 2], [2, 1, 1, 4], [1, 1, 2, 1, 1, 2], [4, 2, 2], [2, 2, 4],
  [3, 3, 2], [1, 1, 1, 1, 4], [2, -2, 2, 2], [-2, 2, 1, 1, 2], [3, 1, 3, 1],
];
const SPARSE = [[4, 4], [6, 2], [-4, 4], [8], [2, 2, 4], [-2, 6]];
const CHORD_TONES = [-3, 0, 2, 4, 7, 9];
const STEPS = [-2, -1, -1, 1, 1, 2];
const ARPS = [[0, 2, 4, 7], [7, 4, 2, 0], [0, 2, 4, 7, 4, 2], [0, 4, 2, 4]];

const mod = (a: number, n: number) => ((a % n) + n) % n;

/** a small seeded random generator (mulberry32) */
function rng(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** a song for one level: the mode's track, a melody from the level's id, at the level's beat */
export function compose(id: TrackId, seed: string, beat: number, fresh: boolean): Song {
  const track = TRACKS[id], r = rng(seed);
  const pool = track.sparse ? SPARSE : RHYTHMS;
  const pick = () => pool[Math.floor(r() * pool.length)];
  let cur = 2 + Math.floor(r() * 3);

  /** pitches for bars of rhythm: chord tones on strong half-beats, steps between */
  const pitches = (bars: number[][], endHome: boolean): (number | null)[][] => {
    const out = bars.map(bar => {
      let pos = 0;
      return bar.map(len => {
        if (len < 0) { pos -= len; return null; }
        let c: number;
        if (pos % 4 === 0) {
          const near = [...CHORD_TONES].sort((x, y) => Math.abs(x - cur) - Math.abs(y - cur));
          c = near[Math.floor(r() * 2)];
        } else {
          let s = STEPS[Math.floor(r() * STEPS.length)];
          if (cur > 6) s = -Math.abs(s); else if (cur < 0) s = Math.abs(s);
          c = cur + s;
        }
        cur = c; pos += len;
        return c;
      });
    });
    if (endHome) {
      const last = out[out.length - 1];
      for (let i = last.length - 1; i >= 0; i--) {
        const p = last[i];
        if (p !== null) { last[i] = Math.abs(p) < Math.abs(p - 7) ? 0 : 7; cur = last[i]!; break; }
      }
    }
    return out;
  };

  const rA = [pick(), pick()], rB = [pick(), pick()];
  const A = pitches(rA, false);
  const A2 = [A[0], pitches([rA[1]], true)[0]];
  const B = pitches(rB, true);
  const rhythm = [rA[0], rA[1], rA[0], rA[1], rA[0], rA[1], rB[0], rB[1]];
  const notes = [A[0], A[1], A2[0], A2[1], A[0], A[1], B[0], B[1]];

  const melody = new Map<number, MelNote>();
  const at = (half: number) => Math.floor((half * beat) / 2);
  rhythm.forEach((bar, i) => {
    let pos = 0;
    bar.forEach((len, j) => {
      const n = Math.abs(len), rel = notes[i][j];
      if (rel !== null) melody.set(i * 4 * beat + at(pos), { rel, ticks: Math.max(1, at(pos + n) - at(pos)) });
      pos += n;
    });
  });
  return { track, beat, melody, arp: ARPS[Math.floor(r() * ARPS.length)], fresh };
}

/** the chord at tick t, as a scale degree */
export function chordAt(s: Song, t: number): number {
  const bar = Math.floor(Math.max(0, t) / (4 * s.beat)), p = s.track.prog;
  return p[Math.floor(bar / s.track.barsPerChord) % p.length];
}

/** a scale degree of the song's key as a MIDI note, `oct` octaves above the root */
function m(s: Song, deg: number, oct = 0): number {
  const sc = s.track.scale;
  return s.track.root + 12 * (oct + Math.floor(deg / 7)) + sc[mod(deg, 7)];
}

/** everything that sounds at tick t. Before 0 (the co-op countdown) only a click on each beat */
export function eventsAt(s: Song, t: number): Ev[] {
  const b = s.beat, tr = s.track, ev: Ev[] = [];
  const inBar = mod(t, 4 * b), beat = Math.floor(inBar / b), sub = inBar - beat * b;
  const half = Math.floor(b / 2);
  const on = sub === 0, off = sub === half;
  if (t < 0) { if (on) ev.push({ part: "rim", vol: t === -b ? 1 : 0.6 }); return ev; }

  const bar = Math.floor(t / (4 * b)), deg = chordAt(s, t), soft = tr.groove === "soft";
  // layers: a first try starts with the beat, the melody joins on bar 3, the arpeggio on bar 5
  const full = !s.fresh;
  const L = {
    drums: full || !soft || bar >= 1,
    bass: full || !soft || bar >= 1,
    pad: true,
    lead: full || bar >= 2,
    arp: full || bar >= 4,
  };
  // a fill on the last beat of every 4th bar, once the melody is in
  const fill = L.lead && !soft && bar % 4 === 3 && beat === 3;

  if (L.drums) switch (tr.groove) {
    case "four":
      if (on) ev.push({ part: "kick", vol: 1 });
      if (on && (beat === 1 || beat === 3) && !fill) ev.push({ part: "snare", vol: 1 });
      if (off) ev.push({ part: beat === 3 && bar % 2 === 1 ? "ohat" : "hat", vol: 0.8 });
      else if (!on && b % 2 === 0) ev.push({ part: "hat", vol: 0.3 });
      break;
    case "drive":
      if (on) ev.push({ part: "kick", vol: 1 });
      if (on && (beat === 1 || beat === 3) && !fill) ev.push({ part: "snare", vol: 1 });
      ev.push({ part: "hat", vol: off ? 0.75 : on ? 0.3 : 0.4 });
      break;
    case "half":
      if (on && beat === 0) ev.push({ part: "kick", vol: 1 });
      if (off && beat === 1) ev.push({ part: "kick", vol: 0.7 });
      if (on && beat === 2 && !fill) ev.push({ part: "snare", vol: 1 });
      if (off) ev.push({ part: beat === 3 ? "ohat" : "hat", vol: 0.7 });
      else if (!on && b % 2 === 0) ev.push({ part: "hat", vol: 0.25 });
      break;
    case "soft":
      if (off) ev.push({ part: "hat", vol: 0.45 });
      if (on && beat === 3 && bar % 2 === 1) ev.push({ part: "rim", vol: 0.35 });
      break;
  }
  if (fill) ev.push({ part: "snare", vol: 0.35 + (0.65 * sub) / b });

  if (L.bass) switch (tr.groove) {
    case "four":
      if (on && beat === 0) ev.push({ part: "bass", midi: [m(s, deg, -1)], ticks: half, vol: 1 });
      if (off) ev.push({ part: "bass", midi: [m(s, beat === 3 ? deg + 4 : deg, -1)], ticks: Math.max(1, b - half), vol: 0.85 });
      break;
    case "drive":
      ev.push({ part: "bass", midi: [m(s, deg, off && beat % 2 === 1 ? 0 : -1)], ticks: 1, vol: on ? 1 : 0.6 });
      break;
    case "half":
      if (on && beat === 0) ev.push({ part: "bass", midi: [m(s, deg, -1)], ticks: 2 * b, vol: 1 });
      if (off && beat === 2) ev.push({ part: "bass", midi: [m(s, deg + 4, -1)], ticks: b, vol: 0.8 });
      if (on && beat === 3) ev.push({ part: "bass", midi: [m(s, deg, -1)], ticks: half, vol: 0.7 });
      break;
    case "soft":
      if (inBar === 0) ev.push({ part: "bass", midi: [m(s, deg, -1)], ticks: 4 * b, vol: 0.8 });
      break;
  }

  if (L.pad && inBar === 0 && bar % tr.barsPerChord === 0) {
    const tones = soft ? [0, 2, 4, 6] : [0, 2, 4];
    ev.push({ part: "pad", midi: tones.map(x => m(s, deg + x)), ticks: 4 * b * tr.barsPerChord, vol: 1 });
  }

  if (L.lead) {
    const n = s.melody.get(mod(t, 32 * b));
    if (n) ev.push({ part: "lead", midi: [m(s, deg + n.rel, 1)], ticks: n.ticks, vol: 1 });
  }

  if (L.arp && (on || (off && !soft))) {
    const k = bar * 8 + beat * 2 + (off ? 1 : 0), a = s.arp;
    ev.push({ part: "arp", midi: [m(s, deg + a[(soft ? k / 2 : k) % a.length], soft ? 1 : 2)], vol: 1 });
  }
  return ev;
}
