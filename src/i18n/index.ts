import type { LevelDef } from "../core/types";
import { save, writeSave } from "../storage/save";
import en, { type Key } from "./en";
import uk from "./uk";
import fr from "./fr";
import es from "./es";
import de from "./de";

// ---------------------------------------------------------------------------
// I18N — every word the player reads, in their language. One file per language (en.ts is the
// source); t() looks a key up, tn() picks a plural form, and the fixed text in index.html is
// tagged data-i18n="key" (data-i18n-aria for a label) and filled in by applyStatic().
// Level names and tips are translated by level id and by the English tip text; anything a
// language leaves out falls back to English.
//
// The setting is "auto" (follow the phone) or a language id; it is kept in the save.
// Adding a language: copy uk.ts, translate it, and list it in LANGS.
// ---------------------------------------------------------------------------
export type { Key };
export interface Pack {
  /** every key of en.ui, plus the extra plural forms the language needs (".few", ".many") */
  ui: Record<Key, string> & Record<string, string>;
  /** level and room names, by level id */
  names: Record<string, string>;
  /** level tips, by their English text */
  hints: Record<string, string>;
}

/** the languages, each in its own name */
export const LANGS = [
  { id: "en", name: "English", pack: en as Pack },
  { id: "uk", name: "Українська", pack: uk },
  { id: "fr", name: "Français", pack: fr },
  { id: "es", name: "Español", pack: es },
  { id: "de", name: "Deutsch", pack: de },
] as const;
export type LangId = (typeof LANGS)[number]["id"];

const byId = (id: string | undefined) => LANGS.find(l => l.id === id);

/** the phone's language, if we have it; English otherwise */
export function deviceLang(): LangId {
  const want = typeof navigator === "undefined" ? [] : (navigator.languages?.length ? navigator.languages : [navigator.language]);
  for (const tag of want) {
    const l = byId(tag?.toLowerCase().split("-")[0]);
    if (l) return l.id;
  }
  return "en";
}

/** what the setting says: "auto" or a language */
export const langSetting = (): LangId | "auto" => byId(save.lang)?.id ?? "auto";

let cur: LangId = byId(save.lang)?.id ?? deviceLang();
let pack: Pack = byId(cur)!.pack;
let rules = new Intl.PluralRules(cur);

/** the language in use now */
export const lang = (): LangId => cur;
export const langName = (id: LangId): string => byId(id)!.name;

/** change the language ("auto" follows the phone) and refill the fixed text */
export function setLang(id: LangId | "auto"){
  if (id === "auto") delete save.lang; else save.lang = id;
  writeSave();
  use(id === "auto" ? deviceLang() : id);
}

function use(id: LangId){
  cur = id; pack = byId(id)!.pack; rules = new Intl.PluralRules(id);
  if (typeof document !== "undefined") { document.documentElement.lang = id; applyStatic(); }
}

const fill = (s: string, vars?: Record<string, string | number>) =>
  vars ? s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : s;

/** a string in the current language, with its {placeholders} filled in */
export function t(key: Key, vars?: Record<string, string | number>): string {
  return fill(pack.ui[key] ?? en.ui[key] ?? key, vars);
}

/** the keys that have plural forms: "x" for "x.one" / "x.other" */
type Plural = Key extends infer K ? K extends `${infer B}.other` ? B : never : never;

/** a plural: the form the language uses for n ({n} is filled in too) */
export function tn(key: Plural, n: number, vars?: Record<string, string | number>): string {
  const form = pack.ui[`${key}.${rules.select(n)}`] ?? pack.ui[`${key}.other`] ?? en.ui[`${key}.other` as Key];
  return fill(form, { n, ...vars });
}

/** "a, b and c" in the current language */
export function listOf(xs: string[]): string {
  try { return new Intl.ListFormat(cur, { type: "conjunction" }).format(xs); }
  catch { return xs.join(", "); }
}

/** a level's or room's name */
export const levelName = (d: LevelDef): string => pack.names[d.id] ?? d.name;
/** a level's tip, if it has one */
export const levelHint = (d: LevelDef): string => d.hint ? (pack.hints[d.hint] ?? d.hint) : "";

/** the fixed text in the page: data-i18n fills the text, data-i18n-aria the label */
export function applyStatic(root: ParentNode = document){
  root.querySelectorAll<HTMLElement>("[data-i18n]").forEach(el => { el.textContent = t(el.dataset.i18n as Key); });
  root.querySelectorAll<HTMLElement>("[data-i18n-aria]").forEach(el => { el.setAttribute("aria-label", t(el.dataset.i18nAria as Key)); });
}

/** start-up: put the page in the saved (or the phone's) language */
export function initI18n(){ use(cur); }
