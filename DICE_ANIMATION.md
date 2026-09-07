# Dice cup animation — spec

Rewritten 2026-09-07 (three.js version; supersedes the CSS-3D one).
`app/roll-3d.ts`, `app/roll-timing.ts`, `app/dice-tray.tsx` and the dice block at
the end of `app/globals.css` implement this. Change them together.

## The sequence

Both players shake at the start of a round. Yours plays out in 3D; the AI's cup is
a flat side-on cup that stays down on the table until someone calls.

| Beat | Window | What happens |
|---|---|---|
| Rattle | 0 – 750 ms | Cup seen side-on, rattling on the table, dice hidden inside. **Six shakes, then still.** |
| Lift | 750 – 1100 ms | Cup rises straight up and fades out. |
| Reveal | 840 – 1260 ms | Dice drop into place, staggered, under the lifting cup. |
| Camera swing | 1050 – 1650 ms | Camera arcs from the side view round to directly overhead. |
| Hold | to 1900 ms | Settled quincunx seen top-down, then hands over to the flat dice. |

**Total 1900 ms.** The ceiling is 2 s — decided 2026-09-07. If a beat grows,
another has to shrink.

### The reveal is the same timeline, started late

When a bid is called, the AI's hand is shown by running this same sequence with
`startAt = BEATS.liftFrom` — the shake is simply not played. Its cup already had
its six shakes at the top of the round and has been sitting still since, so
re-rattling it at the reveal looked wrong. `ROLL_REVEAL_MS` (1150 ms) is the length
of what is left. Nothing else changes: the beats keep their absolute times, only
less of the timeline is played. `DiceTray`'s `reveal` prop turns this on.

Timings live in `BEATS` in `app/roll-timing.ts` — a module with no three.js import,
so `page.tsx` can read `ROLL_MS` (the total) without pulling the 3D chunk into the
initial bundle. `ROLL_MS` is what the AI turn waits for before its opening bid, and
only when the animation is switched on.

## Both cups shake the same, and they stop

`SHAKE_CYCLES = 6` in `app/roll-timing.ts` is the one source of truth. The 3D cup
derives its wobble from it — every term is a whole number of cycles across the
shake window, so at 750 ms the cup is back at rest rather than frozen mid-wobble.
The AI's flat cup gets the same six from `SHAKE_CYCLE_MS` and `SHAKE_CYCLES`, set
inline by `dice-tray.tsx` on the CSS animation.

It used to loop `infinite`, so the AI's cup rattled for the whole round. Nobody
shakes a cup non-stop in real life and it is distracting to sit beside. If you
change the count, change it in `roll-timing.ts` only.

## Both cups face down

A dice cup is slammed **mouth-down** on the table — that is the only way the dice
stay hidden. Both cups must read that way and neither ever flips:

- The 3D cup is `CylinderGeometry(1.55, 2.05, ...)` — narrow at the top, wide at the
  bottom — with the rim torus on the table at `y = 0.03`. It lifts **straight up,
  still mouth-down**; there is no rotation in the lift beat, only `position.y` and a
  fade. Dice are revealed by the cup clearing them, not by tipping it over.
- The AI's flat CSS cup mirrors that: `.cup-body`'s `clip-path` is narrow at the top
  and full width at the bottom, and `.cup-lip` sits at the **bottom** (`bottom: -3px`).
  It used to be drawn the other way up — a tumbler with the lip on top — which read as
  an open cup facing the ceiling while the player's faced down. Fixed 2026-09-08.

## Sound

`app/roll-sound.ts` synthesises the audio with the Web Audio API rather than shipping
audio files. Nothing extra to download, and every hit is placed from the same `BEATS`
as the picture, so the clatter cannot drift out of step with the cup.

| Ingredient | What it is | When |
|---|---|---|
| Rattle | bursts of band-passed noise — dice knocking inside the cup | one burst per shake, 0 – 750 ms |
| Thump | a short sine drop, the cup meeting the table | once per shake |
| Scrape | a noise sweep opening from 320 Hz to 1.5 kHz | 750 – 1100 ms, on the lift |
| Clacks | five knocks, staggered like the meshes appearing | from 900 ms |

Rules:

- **Nothing can ever start on its own.** `playRollSound` is only called from a roll,
  which only ever follows a button press, so the browser's autoplay rules are met and
  the page is silent on load.
- **The player can switch it off**, next to the animation toggle, persisted in
  `localStorage` under `liarsdice.sound`. Both prefs live in `app/prefs.ts`.
- **Sound follows the picture.** No animation means no sound: it is scheduled by
  `dice-tray.tsx` in the same effect that starts the roll.
- **One rattle per round, not two.** Both cups shake at the top of a round, but only
  the player's 3D roll is voiced. Two overlapping rattles just sound like mud. The
  AI's reveal gets the lift and the clacks only, which falls out of `startAt` for
  free.
- **Skipping must not click.** `stop()` ramps the master gain down over 40 ms before
  stopping the sources.

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
  with the result. The per-die spin is applied with `rotateOnWorldAxis` about world
  up, **not** `rotateY` — after `FACE_UP` a die's own Y axis is generally not
  vertical, so `rotateY` tips the chosen face off the top. Verified in the browser
  at 2.2x zoom: DOM labels `[5,2,4,6,3]` against the same five faces rendered in
  the same five slots.

- **The overhead camera needs an explicit up vector.** Looking straight down, an up
  of +Y is degenerate and `lookAt` picks an arbitrary roll. `camera.up` swings from
  +Y to −Z with the camera, so the quincunx always lands in the same corners as the
  CSS grid it hands over to.
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
