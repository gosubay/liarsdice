# Dice cup animation — spec

Written 2026-09-07. `app/dice-tray.tsx` and the dice block at the end of
`app/globals.css` implement this. Change both together.

## The sequence

Both players shake at the start of a round. Yours opens straight away; the AI's cup
stays down on the table until someone calls, then lifts.

| Beat | Duration | What happens |
|---|---|---|
| Rattle | 650 ms | Cup on the table, dice hidden inside. Both players. |
| Lift | 220 ms | Cup rises and fades out. |
| Tumble | 300 ms each, 60 ms apart | Each die rotates to its face, left to right. |

**Total 1410 ms.** The ceiling is 1.5 s — decided 2026-09-07. If a beat grows,
another has to shrink.

Timings live in `TIMING` in `app/dice-tray.tsx`; `ROLL_MS` is their sum and is what
the AI turn waits for before making an opening bid.

## Rules this must not break

- **The animation never decides anything.** Dice values come from `rollFive()`
  before any of this runs, and each cube is only ever rotated to a face already
  chosen. There is no physics and no chance of the display disagreeing with the
  result. Verified across 30 dice covering all six values.
- **A skip is always available** while the animation runs — a real button, not a
  click handler on the row. Players see this hundreds of times.
- **`prefers-reduced-motion` removes it entirely**: no cup, no tumble, dice visible
  immediately. A shaking cup is a classic motion-sickness trigger.
- The component restarts by being **remounted with a new `key`**, not by an effect
  writing state on the way in.

## Why CSS 3D and not a 3D library

A die is a cube, which is the case CSS 3D transforms exist for: six faces,
`transform-style: preserve-3d`, one rotation to show the face you want. Measured
alternatives, gzipped: Three.js ~99 KB, plus a physics engine ~73 KB. That is +74%
on a 231 KB site for two seconds of animation.

The deciding reason is not size. With real physics you either let the simulation
decide the roll — throwing away the RNG and complicating the AI's hidden dice — or
you steer it to a predetermined face, which is fiddly and unconvincing. Rotating to
a known face is correct by construction.

## Face layout

Opposite faces sum to seven: 1 front, 6 back, 3 right, 4 left, 2 top, 5 bottom.
To show a face, rotate the cube by the inverse of where that face sits
(`SHOW_FACE` in `app/dice-tray.tsx`). The tumble adds one whole turn on each axis so
it reads as a roll rather than a flip.
