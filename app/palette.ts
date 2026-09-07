// Chart colours, in one place. Every value here was checked with the dataviz
// validator against the dark chart surface (#1a1a19) — do not swap one by eye.
//
// Two different colour jobs live here:
//
//   CATEGORICAL — different actions / different series. Distinct hues, all sitting
//   in one lightness band so none dominates. CHALLENGE, BLUFF and VALUE_THIN pass
//   all five checks under --pairs all: worst pair 9.0 ΔE (deuteranopia),
//   24.5 ΔE (normal vision), all above 3:1 contrast.
//
//   SEQUENTIAL — how much of the face you actually hold. One hue, dim to bright,
//   so "more green" reads as "more dice" without consulting the legend.
//   VALUE_THIN L 0.636 → VALUE_STRONG L 0.791: monotonic, gap 0.154, contrast
//   5.7:1 and 10.0:1. The categorical lightness-band check does not apply to a
//   sequential pair — varying lightness is the encoding.
//
// Verify after any change:
//   node scripts/validate_palette.js "#e94a3c,#12a37a,#8f7ae0" --mode dark --pairs all

/** Ending the auction. Its own action, so its own hue. */
export const CHALLENGE = '#e94a3c';

/** Raising onto a face you hold none of. The opposite of value, so a separate hue —
 *  not a warmer shade of it, which would read as a milder challenge. */
export const BLUFF = '#8f7ae0';

/** Raising onto a face you hold exactly one of — thin value. */
export const VALUE_THIN = '#12a37a';

/** Raising onto a face you hold two or more of — strong value. */
export const VALUE_STRONG = '#63d3ad';

/** The two bid modes, used as a two-series categorical pair on Math and GTO Strategy.
 *  Passes all five checks under --pairs all: 8.9 ΔE protan, 18.0 ΔE normal. */
export const WILD = '#12a37a';
export const ZHAI = '#bf8a2a';

/** Which colour a raise gets, from how many of the target face the hand holds. */
export function raiseColour(held: number) {
  if (held === 0) return BLUFF;
  return held === 1 ? VALUE_THIN : VALUE_STRONG;
}
