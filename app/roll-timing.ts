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
