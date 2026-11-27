import { describe, expect, it } from "vitest";
import { SKINS, skinById, skinOfPlayer } from "../src/render/skins";
import { save } from "../src/storage/save";

describe("skins", () => {
  it("have unique ids and fall back to Classic", () => {
    expect(new Set(SKINS.map(s => s.id)).size).toBe(SKINS.length);
    expect(skinById("nope").id).toBe("classic");
  });
  it("give every co-op player a different skin, yours first", () => {
    for (const s of SKINS) {
      save.skin = s.id;
      const four = [0, 1, 2, 3].map(i => skinOfPlayer(i));
      expect(four[0]).toBe(s);
      expect(new Set(four).size).toBe(4);
    }
    delete save.skin;
  });
});

describe("skin text", () => {
  it("has a name and blurb for every skin", async () => {
    const en = (await import("../src/i18n/en")).default.ui as Record<string, string>;
    for (const s of SKINS) { expect(en[`skin.${s.id}`]).toBeTruthy(); expect(en[`skin.${s.id}.about`]).toBeTruthy(); }
  });
});
