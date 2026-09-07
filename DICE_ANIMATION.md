# Dice cup animation — spec

Rewritten 2026-09-07 (three.js version; supersedes the CSS-3D one).
`app/roll-3d.ts`, `app/roll-timing.ts`, `app/dice-tray.tsx` and the dice block at
the end of `app/globals.css` implement this. Change them together.

## The sequence

Both players shake at the start of a round. Yours plays out in 3D; the AI's cup is
a flat side-on cup that stays down on the table until someone calls.

| Beat | Window | What happens |
|---|---|---|
| Rattle | 0 – 750 ms | Cup seen side-on, rattling on the table, dice hidden inside. |
| Lift | 750 – 1100 ms | Cup rises straight up and fades out. |
| Reveal | 840 – 1260 ms | Dice drop into place, staggered, under the lifting cup. |
| Camera swing | 1050 – 1650 ms | Camera arcs from the side view round to directly overhead. |
| Hold | to 1900 ms | Settled quincunx seen top-down, then hands over to the flat dice. |

**Total 1900 ms.** The ceiling is 2 s — decided 2026-09-07. If a beat grows,
another has to shrink.

Timings live in `BEATS` in `app/roll-timing.ts` — a module with no three.js import,
so `page.tsx` can read `ROLL_MS` (the total) without pulling the 3D chunk into the
initial bundle. `ROLL_MS` is what the AI turn waits for before its opening bid, and
only when the animation is switched on.

## Layout

Five dice in a **quincunx** — four corners and one in the middle. `SPOTS` in
`app/roll-3d.ts` and the `.quin-slot` grid areas in `globals.css` place the same
five positions, so the canvas can hand over to the flat dice without them jumping.
The quincunx is also what lets the two players stay **side by side on a phone**; a
row of five would have forced them to stack.

## Rules this must not break

- **The animation never decides anything.** Dice values come from `rollFive()`
  before any of this runs, and each cube is only ever rotated to a face already
  chosen (`FACE_UP`). There is no physics and no chance of the display disagreeing
  with the result. Verified in the browser: DOM labels `[5,4,3,3,2]` against the
  same five faces rendered in the same five slots.
- **A skip is always available** while the animation runs — a real button, not a
  click handler on the row. Players see this hundreds of times.
- **The player can switch it off.** A toggle on the setup card and in the game
  topbar, persisted in `localStorage` under `liarsdice.animation`. Off means no
  canvas is mounted at all and three.js is never fetched.
- **`prefers-reduced-motion` is the default-off case.** A shaking cup is a classic
  motion-sickness trigger, so those users start with it off; they can still turn it
  on, and the stored choice wins over the media query.
- **No WebGL, no canvas.** `hasWebGL()` is probed once and the flat dice are used.
- **A starved tab must never freeze on a cup.** Two safety nets in `playRoll`: if
  no frame has drawn 400 ms in, hand straight over to the flat dice; and a guard
  timer ends the roll at `holdTo + 300` whatever happens. Both matter — a
  backgrounded or throttled tab gets no `requestAnimationFrame` callbacks at all.
- The component restarts by being **remounted with a new `key`**, not by an effect
  writing state on the way in.

## Why three.js after all

The earlier CSS-3D version could not do the thing that was actually asked for: a
side view that swings to top-down. CSS 3D has no camera — you can rotate elements,
but there is no scene to fly around, and faking an arc with nested transforms on
five separate cubes plus a cup is worse code than a real scene graph.

The cost is one chunk: **132 KB gzipped, loaded only when a roll starts**, so the
initial page is unchanged at ~86 KB of JS. The canvas is unmounted the moment the
roll settles, so no WebGL context stays alive between rounds.

## Face layout

`BoxGeometry` material order is +X −X +Y −Y +Z −Z; `FACE_ORDER` maps that to
`1 6 2 5 3 4` so opposite faces sum to seven. `FACE_UP` is the rotation that brings
each value's face to point up. Each die also gets a fixed spin about the up axis,
which is cosmetic and cannot change which face shows.

## Debug seam

`playRoll` returns a `step(t)` that renders one frame at an explicit time, and
`dice-tray.tsx` attaches the handle to the canvas element as `.roll`. To inspect a
beat by hand:

```js
document.querySelector('.tray-canvas').roll.step(1150)
```

This exists because a headless/hidden pane gets no animation frames, so stepping is
the only way to actually look at the middle of the sequence.
