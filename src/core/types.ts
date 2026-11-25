// Shared data types. Everything in core/, levels/ and game/rules.ts is pure (no DOM), so the
// game, the solver and the tests all run the exact same rules.

export interface Vec { x: number; y: number }

/** which boot: 0 = the left boot (starts clockwise), 1 = the right boot (starts counterclockwise) */
export type Boot = 0 | 1;

export type Mode = "destination" | "collect" | "sequence" | "survival" | "waves";

/** Which way a grid-wide sweep travels. "all" hits every tile at once. */
export type SweepDir = "down" | "up" | "left" | "right" | "diag" | "antidiag" | "all";

// ---- level definitions, as authored in src/levels/ --------------------------------------

export interface SentryDef {
  /** waypoints "x,y x,y ..."; straight or 45° segments, one tile per beat */
  path: string;
  /** walk back along the path instead of looping from the last point to the first */
  pingpong?: boolean;
  /** start this many beats into the path */
  phase?: number;
}

export interface SweepDef {
  dir: SweepDir;
  /** beat the front reaches the first lane */
  start: number;
  /** beats between repeats; 0 or absent = once */
  every?: number;
  /** how many times it repeats (default: forever when `every` is set) */
  count?: number;
  /** beats per lane: 1 = the front moves one row per beat, 0 = every lane at once */
  speed?: number;
  /** beats of warning glow before a tile turns lethal */
  warn?: number;
  /** beats a tile stays lethal */
  lethal?: number;
  /**
   * safe lanes across the sweep: columns for down/up/all, rows for left/right, and for
   * diag/antidiag the diagonal channel (diag: x - y + height - 1, antidiag: x + y).
   * One list for every pass, or a list of lists to cycle through, one per pass.
   */
  gaps?: number[] | number[][];
  /** the gaps move this many lanes each repeat */
  gapShift?: number;
}

export interface LevelDef {
  id: string;
  name: string;
  mode: Mode;
  /**
   * The board, one string per row, top first.
   *   .  floor        A  left boot (turns clockwise)   B  right boot (turns counterclockwise)
   *   G  goal         o  collectible             1-9  sequence collectibles
   */
  map: string[];
  /** ticks per beat (a tick is TICK_MS). hazards step once per beat. default 4 */
  beat?: number;
  sentries?: SentryDef[];
  sweeps?: SweepDef[];
  /** survival: beats to stay alive. waves: optional time limit (not used yet) */
  survive?: number;
  /** waves: collectibles needed to clear the level */
  need?: number;
  /** waves: what each pass of sweep 0 leaves behind, one "x,y x,y" string per pass (cycled) */
  drops?: string[];
  /** a one-line tip shown on the level's first attempt */
  hint?: string;
  /**
   * a winning input, as the solver found it: L / R press a boot, a number waits that many
   * ticks ("2L1R" = wait 2, left, wait 1, right). The tests replay it to prove the level can be
   * beaten at a human pace; written by tools/gen-levels.ts
   */
  proof?: string;
}

// ---- parsed level ------------------------------------------------------------------------

export interface Item {
  x: number; y: number;
  /** 0 = any order, 1.. = sequence position */
  order: number;
  /** beats during which it can be picked up: [from, until) */
  from: number; until: number;
}

export interface Sentry { tiles: Vec[]; phase: number }

export interface Sweep extends Required<Omit<SweepDef, "gaps">> { gaps: number[][] }

export interface Level {
  def: LevelDef;
  w: number; h: number;
  /** [left boot, right boot] at the start */
  start: [Vec, Vec];
  goal: Vec | null;
  items: Item[];
  sentries: Sentry[];
  sweeps: Sweep[];
  beat: number;
  survive: number;
  need: number;
  /** how many items have an order (sequence mode) */
  ordered: number;
  /** item indices by tile (y * w + x), so a pickup check only looks where the boots are */
  itemsAt: Map<number, number[]>;
}

// ---- a run of one level ------------------------------------------------------------------

export type RunStatus = "play" | "dead" | "won";

export interface Run {
  lv: Level;
  tick: number;
  /** the two boots: 0 left (turns clockwise), 1 right (counterclockwise). The pressed one swings around the other */
  boots: [Vec, Vec];
  taken: boolean[];
  got: number;
  nextOrder: number;
  status: RunStatus;
  cause: "" | "sentry" | "sweep" | "order";
  lastMoveTick: number;
  moves: number;
  /** what the last press did */
  last: { boot: Boot; result: "move" | "back" } | null;
}
