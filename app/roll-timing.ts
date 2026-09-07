// Beats for the 3D roll. Kept in a module of its own so page.tsx and dice-tray.tsx
// can read the timings without pulling three.js into the initial bundle.
// Spec: DICE_ANIMATION.md.

export const BEATS = {
  /** Cup rattling on the table, seen side-on, dice hidden inside. */
  shakeFrom: 0,
  shakeTo: 750,
  /** Cup lifts straight up and fades. */
  liftFrom: 750,
  liftTo: 1100,
  /** Camera arcs from the side view to directly overhead. */
  swingFrom: 1050,
  swingTo: 1650,
  /** Settled dice held under the top-down camera before handing back to the flat dice. */
  holdTo: 1900,
};

/** Total wall time of the 3D roll. Ceiling is 2000ms — decided 2026-09-07. */
export const ROLL_3D_MS = BEATS.holdTo;

/**
 * How many times a cup rattles before it holds still. Both cups use this: the 3D
 * one in roll-3d.ts and the AI's flat one, which dice-tray.tsx drives by setting
 * the CSS animation's duration and iteration count from here.
 *
 * Nobody shakes a cup non-stop in real life, and a loop that never ends is
 * distracting to sit next to. Six shakes, then still.
 */
export const SHAKE_CYCLES = 6;

/** One rattle. shakeTo / SHAKE_CYCLES, so the shake ends exactly on the beat. */
export const SHAKE_CYCLE_MS = BEATS.shakeTo / SHAKE_CYCLES;

/**
 * How long a reveal takes: the cup lifting and the camera swinging, with no shake.
 * Used for the AI's hand, which was shaken at the top of the round.
 */
export const ROLL_REVEAL_MS = BEATS.holdTo - BEATS.liftFrom;
