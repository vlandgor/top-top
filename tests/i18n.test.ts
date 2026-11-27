import { describe, expect, it } from "vitest";
import en from "../src/i18n/en";
import { LANGS, levelHint, levelName, setLang, t, tn } from "../src/i18n";
import { LEVELS } from "../src/levels/levels";
import { ROOMS } from "../src/levels/rooms";

const ALL = [...LEVELS, ...ROOMS];
const hints = [...new Set(ALL.map(d => d.hint).filter(Boolean))] as string[];
const holes = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(",");
const bases = Object.keys(en.ui).filter(k => k.endsWith(".other")).map(k => k.slice(0, -6));

describe("languages", () => {
  for (const l of LANGS.filter(l => l.id !== "en")) {
    describe(l.name, () => {
      it("fill the same {placeholders} as English", () => {
        for (const [k, v] of Object.entries(en.ui)) {
          if (/\.(one|other)$/.test(k)) continue;           // plural forms may leave {n} out ("a bot")
          expect(holes(l.pack.ui[k]), `${l.id} ${k}`).toBe(holes(v));
        }
      });
      it("have every plural form the language uses", () => {
        // a missing .many falls back to .other, which is right for French and Spanish ("1 000 000 de…" aside)
        const need = new Intl.PluralRules(l.id).resolvedOptions().pluralCategories.filter(c => c !== "many" || l.id === "uk");
        for (const b of bases) for (const c of need) expect(l.pack.ui[`${b}.${c}`], `${l.id} ${b}.${c}`).toBeTruthy();
      });
      it("name every level and room, and translate every tip", () => {
        for (const d of ALL) expect(l.pack.names[d.id], `${l.id} ${d.id}`).toBeTruthy();
        for (const h of hints) expect(l.pack.hints[h], `${l.id}: ${h}`).toBeTruthy();
      });
    });
  }

  it("switch, fill in and pick plurals", () => {
    setLang("uk");
    expect(t("lv.level", { n: 3 })).toBe("Рівень 3");
    expect(tn("coop.lights", 1)).toBe("1 вогник");
    expect(tn("coop.lights", 3)).toBe("3 вогники");
    expect(tn("coop.lights", 7)).toBe("7 вогників");
    expect(levelName(LEVELS[0])).toBe("Перші кроки");
    expect(levelHint(LEVELS[0])).toMatch(/^Ліва кнопка/);
    setLang("en");
    expect(tn("chip.sentries", 1)).toBe("1 sentry");
    expect(levelName(LEVELS[0])).toBe(LEVELS[0].name);
    setLang("auto");
  });
});
