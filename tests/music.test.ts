import { describe, expect, it } from "vitest";
import { compose, eventsAt, TRACKS, type TrackId } from "../src/audio/score";
import { LEVELS } from "../src/levels/levels";
import { parseLevel } from "../src/levels/parse";

const inKey = (id: TrackId, midi: number) => TRACKS[id].scale.includes((((midi - TRACKS[id].root) % 12) + 12) % 12);

describe("music", () => {
  it("each level's song is the same every time, and levels sound different", () => {
    const a = compose("destination", "d1", 4, true), b = compose("destination", "d1", 4, true), c = compose("destination", "d2", 4, true);
    expect([...a.melody]).toEqual([...b.melody]);
    expect([...a.melody]).not.toEqual([...c.melody]);
  });

  it("the kick lands on the level's beat, whatever its tempo", () => {
    for (const beat of [4, 5, 6]) {
      const s = compose("destination", "x", beat, false);
      for (let t = 0; t < 64 * beat; t++) {
        const kick = eventsAt(s, t).some(e => e.part === "kick");
        expect(kick).toBe(t % beat === 0);
      }
    }
  });

  it("every note of every level is in its key", () => {
    for (const def of LEVELS) {
      const lv = parseLevel(def), s = compose(def.mode, def.id, lv.beat, false);
      for (let t = 0; t < 32 * lv.beat; t++)
        for (const e of eventsAt(s, t)) for (const n of e.midi ?? []) expect(inKey(def.mode, n), `${def.id} t${t} ${e.part}`).toBe(true);
    }
  });

  it("every level has a melody on every bar or two, and a countdown only clicks", () => {
    for (const id of Object.keys(TRACKS) as TrackId[]) {
      const s = compose(id, "seed", 4, false);
      for (let bar = 0; bar < 8; bar += 2) {
        const notes = [...s.melody.keys()].filter(k => k >= bar * 16 && k < (bar + 2) * 16);
        expect(notes.length, `${id} bars ${bar}-${bar + 1}`).toBeGreaterThan(0);
      }
      for (let t = -24; t < 0; t++) expect(eventsAt(s, t).every(e => e.part === "rim")).toBe(true);
    }
  });

  it("a first try starts with the beat and brings the melody in later", () => {
    const s = compose("collect", "c1", 4, true);
    const leadIn = (from: number, to: number) => { for (let t = from; t < to; t++) if (eventsAt(s, t).some(e => e.part === "lead")) return true; return false; };
    expect(leadIn(0, 32)).toBe(false);
    expect(leadIn(32, 64)).toBe(true);
    expect(eventsAt(s, 0).some(e => e.part === "kick")).toBe(true);
  });
});
