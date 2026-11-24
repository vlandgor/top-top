# Top Top: game design (v0.1)

*Working title in early notes: Lockstep / Heel to Heel.*

A minimalist mobile puzzle-arcade game. You don't steer a character: you steer a pair of
boots that are always neighbours, side by side or diagonal, never further apart.

## Movement

The same movement as Chick Mates (`applyJump` in chick-mates-sandbox):

- **Two buttons, one per boot.** Pressing a boot swings it one place (45°) around the other
  boot, which stays put as the anchor.
- **Each boot has its own turn direction.** The left boot starts clockwise, the right one
  counterclockwise, so alternating presses walks the pair.
- **Blocked:** if the next place is off the board, the boot doesn't move and **both** boots
  flip their direction. The press still counts.
- **Facing:** each boot faces the tile its button sends it to, and that tile is outlined with
  the button's letter (L / R). Each button shows which way its boot turns right now.

## Time

The game is deterministic, in **ticks** of 125 ms. Hazards step once per **beat** (4 ticks by
default, 120 bpm; per level). The player can press at most once per tick; a press during a
used tick is buffered to the next one. (Chick Mates is turn-based; Top Top keeps its own beat
clock so hazards move in real time.) The clock starts when the level loads, like
Geometry Dash; dying restarts the level in about 0.4 s (or at once on the next tap).

`src/game/rules.ts` holds these rules as pure functions. The game and the solver both run
them, so whatever the solver proves, a player can do.

## Hazards

- **Sentries:** glowing tiles that walk a fixed path, one tile per beat, looping or
  ping-ponging. The tile they step to next is outlined, brighter as the step comes closer.
- **Sweeps** (grid-wide events): a front crossing the board lane by lane: down, up, left,
  right, diagonal ("waterfall"), anti-diagonal, or the whole board at once ("pulse"). Each tile
  glows for `warn` beats, then is lethal for `lethal` beats (default 1). Sweeps can repeat,
  and leave **gaps** (safe columns, rows or diagonal channels) that can change every pass.

## Modes

| Mode | Accent | Goal |
|---|---|---|
| Destination | teal | Get either boot onto the goal. |
| Collect All | coral | Pick up every light. |
| Sequence | purple | Pick up the numbered lights in order. Touching the wrong one restarts. |
| Survival | red | Stay alive until the clock runs out. |
| Waves *(in progress)* | blue | A repeating sweep leaves lights behind it; the next pass washes away what's left. Collect enough of them. |

## Levels

17 hand-made levels (6 Destination, 3 each of Collect, Sequence and Survival, 2 Waves). The
first level of each mode is open; clearing one opens the next. The dev build opens everything.
`npm test` proves every level beatable at a human pace (a press at most every 2 ticks).

The game is landscape only (either way up), with a boot button on each side of the board.

## Still open

- Obstacles from Chick Mates (trees, boxes, gates) are not in yet; the board edge is the only
  thing that blocks.

- Waves: tuning, more levels, whether it needs a time limit.
- Achievements screen.
- In-app level editor with sharing. The level format is plain data and the solver can
  validate player-made levels before they're shared.
- Practice mode or checkpoints; how progression and saves should work.
- Whether swings should snap to the beat for a stronger rhythm feel.
