import { buildDaily } from "./daily";

// builds a day's level off the main thread: gets a day key, answers with the level (or null)
self.onmessage = (e: MessageEvent<string>) => {
  let def = null;
  try { def = buildDaily(e.data); } catch { /* the menu just won't offer a daily today */ }
  self.postMessage(def);
};
