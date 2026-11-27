import { save } from "../storage/save";

// ---------------------------------------------------------------------------
// HAPTICS — a small tap on each press, a jolt when you're hit, a pattern when you clear.
// In the app it uses the phone's haptic engine (@capacitor/haptics), which feels crisper
// than plain vibration; in a mobile browser it falls back to navigator.vibrate; elsewhere it
// does nothing. Settings → Controls → Vibration turns it off.
// ---------------------------------------------------------------------------

export type Buzz = "press" | "bump" | "pick" | "hit" | "win";

export function hapticsOn(){ return save.haptics !== 0; }
export function setHaptics(on: boolean){ save.haptics = on ? 1 : 0; }

/** browser fallback: milliseconds on, off, on… */
const PATTERN: Record<Buzz, number | number[]> = {
  press: 8, bump: 18, pick: 12, hit: [45, 35, 70], win: [18, 50, 18, 50, 40],
};

export function buzz(k: Buzz){
  if (!hapticsOn()) return;
  const h = window.Capacitor?.Plugins?.Haptics;
  if (h) {
    const p = k === "win" ? h.notification({ type: "SUCCESS" })
      : k === "hit" ? h.notification({ type: "ERROR" })
      : h.impact({ style: k === "bump" ? "MEDIUM" : "LIGHT" });
    p.catch(() => {});
    return;
  }
  try { navigator.vibrate?.(PATTERN[k]); } catch { /* not allowed here */ }
}
