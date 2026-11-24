# Top Top: game design (v0.1)

*Working title in early notes: Lockstep / Heel to Heel.*

A minimalist mobile puzzle-arcade game. You don't steer a character: you steer a pair of
boots that are always neighbours, side by side or diagonal, never further apart.

## Movement

- One boot is the **anchor**: planted, the pivot.
- The other is the **mover**: each tap swings it one place (45°) around the anchor to the next
  of the anchor's eight neighbours. The tap picks the direction: left = counterclockwise,
  right = clockwise.
- After a swing the boot that landed is planted and the other one swings next. The roles
  alternate automatically, like a compass walking across a map. Alternating directions walks
  the pair sideways (one row per two taps); repeating a direction turns it in place.
- **At the edge:** if a swing would put the mover off the board, the planted boot shuffles one
  step inward first, so the pair stays legal and keeps moving.
- **Facing:** the boots face across the line between them, toward where an alternating tap
  would take them. Both possible landing tiles are outlined (↺ / ↻); the walking one is
  brighter, and an arrow shows when the planted boot will shuffle.

## Time

The game is deterministic, in **ticks** of 125 ms. Hazards step once per **beat** (4 ticks by
default, 120 bpm; per level). The player can swing at most once per tick; a tap during a
used tick is buffered to the next one. The clock starts when the level loads, like
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
`npm test` proves every level beatable at a human pace (a swing at most every 2 ticks).

## Still open

- Waves: tuning, more levels, whether it needs a time limit.
- Achievements screen.
- In-app level editor with sharing. The level format is plain data and the solver can
  validate player-made levels before they're shared.
- Practice mode or checkpoints; how progression and saves should work.
- Whether swings should snap to the beat for a stronger rhythm feel.
