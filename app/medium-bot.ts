// The Medium bot. Implements MEDIUM_BOT_SPEC.md verbatim — read that file before
// changing anything here, and update it in the same commit if you do.
//
// Deliberately self-contained and synchronous: unlike Hard, Medium fetches no policy
// file, so picking it costs no download and it can never fall off-book.
//
// The shape, in one line: open 3 x sixes every hand, call on the gap, grind the
// safest raise, and never start zhai.

export type Bid = { quantity: number; face: number; zhai: boolean };
export type Move = { kind: 'challenge' } | { kind: 'bid'; bid: Bid };

/** Face strength, weakest first. Ones outrank sixes. Mirrors FACE_ORDER in page.tsx. */
const FACE_ORDER = [2, 3, 4, 5, 6, 1];
const faceRank = (face: number) => FACE_ORDER.indexOf(face);

/**
 * How many of the bid the hand already covers.
 * A wild bid on 2-6 counts ones as well; zhai, and any bid on ones, counts only the face.
 */
export function support(dice: number[], face: number, zhai: boolean) {
  const pure = zhai || face === 1;
  return dice.filter((die) => die === face || (!pure && die === 1)).length;
}

/** The number the opponent still has to be holding. The only quantity Medium reasons about. */
export function gapOf(dice: number[], bid: Bid) {
  return bid.quantity - support(dice, bid.face, bid.zhai);
}

/**
 * Challenge probability by gap — spec section 2.
 *
 * Pure thresholds, one gap more suspicious than the solver. This is safe because gap is
 * computed from Medium's own hidden dice: the opponent cannot see the input, so there is
 * nothing for them to target. The 20% at wild gap 2 is the one soft edge, kept because a
 * bot that never calls light reads as a machine.
 */
export function challengeChance(gap: number, zhai: boolean) {
  if (gap <= 1) return 0;
  if (zhai) return 1;
  if (gap === 2) return 0.2;
  return 1;
}

/** Never talk yourself into a bid you cannot hold. Also the fei gate. */
const MAX_SELF_GAP = 3;
const BLUFF_RATE = 0.12;
const MIX_WINDOW = 0.5;

/** Every bid the rules allow from here, before Medium's own preferences are applied. */
function legalRaises(isLegal: (bid: Bid) => boolean) {
  const out: Bid[] = [];
  for (let quantity = 1; quantity <= 10; quantity += 1) {
    for (const face of FACE_ORDER) {
      for (const zhai of face === 1 ? [true] : [false, true]) {
        const bid = { quantity, face, zhai };
        if (isLegal(bid)) out.push(bid);
      }
    }
  }
  return out;
}

/**
 * Rank the raises Medium is willing to make. Lower score is better.
 *
 * Score is the gap it would leave itself in, plus half a point for every quantity step
 * past the first — so it grinds one rung at a time unless a jump genuinely lands safer.
 */
function scoreRaises(dice: number[], currentBid: Bid, raises: Bid[]) {
  const scored: { bid: Bid; score: number }[] = [];
  for (const bid of raises) {
    // Medium never initiates zhai. Leaving zhai for a wild bid (fei) is still allowed.
    if (!currentBid.zhai && bid.zhai) continue;
    const gap = gapOf(dice, bid);
    if (gap > MAX_SELF_GAP) continue;
    const steps = Math.max(0, bid.quantity - currentBid.quantity - 1);
    scored.push({ bid, score: gap + 0.5 * steps });
  }
  scored.sort((a, b) => (
    a.score - b.score
    || a.bid.quantity - b.bid.quantity
    || faceRank(b.bid.face) - faceRank(a.bid.face)
  ));
  return scored;
}

/**
 * Medium's move for this hand and table.
 *
 * `isLegal` is the live rules engine from page.tsx rather than a copy, so Medium can
 * never produce a bid the game would reject.
 */
export function mediumMove(
  dice: number[],
  currentBid: Bid | null,
  isLegal: (bid: Bid) => boolean,
  random: () => number = Math.random,
): Move {
  // Spec section 1: the opening is pure. Every hand, no branch, no randomiser.
  if (!currentBid) return { kind: 'bid', bid: { quantity: 3, face: 6, zhai: false } };

  const scored = scoreRaises(dice, currentBid, legalRaises(isLegal));
  // Nothing safe left to say. Call regardless of the gap table.
  if (scored.length === 0) return { kind: 'challenge' };

  if (random() < challengeChance(gapOf(dice, currentBid), currentBid.zhai)) {
    return { kind: 'challenge' };
  }

  const best = scored[0].score;
  // The bluff valve: reach for the band a full point worse than Medium's best spot,
  // so its bids can never be read as strictly honest.
  const stretch = scored.filter((entry) => entry.score > best + MIX_WINDOW && entry.score <= best + 1 + MIX_WINDOW);
  const band = random() < BLUFF_RATE && stretch.length > 0
    ? stretch
    : scored.filter((entry) => entry.score <= best + MIX_WINDOW);

  return { kind: 'bid', bid: band[Math.floor(random() * band.length)].bid };
}

/**
 * Spec section 4. A 2-3-4-5-6 straight has support 1 on every face and is the worst hand
 * in the game, so it always goes back in the cup. A five-face hand holding a wild one has
 * support 2 on four different faces and is worth keeping.
 */
export function mediumShouldReroll(dice: number[]) {
  return new Set(dice).size === 5 && !dice.includes(1);
}
