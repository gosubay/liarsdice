// Shared access to the solved MCCFR policy. Both the GTO Strategy tab and the
// Hard bot read from here, so the 578 KB bundle is fetched at most once.
// See GTO_TAB_SPEC.md for the file format and the gaps in the current solve.

import policyUrl from './gto-policy.json?url';

export type Policy = {
  acts: string[];
  hands: string[];
  w: number[];
  states: string[];
  d: Record<string, Record<string, [number, number][]>>;
};

export type PolicyBid = { quantity: number; face: number; zhai: boolean };
export type PolicyMove = { kind: 'challenge' } | { kind: 'bid'; bid: PolicyBid };

let pending: Promise<Policy> | null = null;

export function loadPolicy(): Promise<Policy> {
  pending ??= fetch(policyUrl).then((response) => {
    if (!response.ok) throw new Error(`policy fetch failed: ${response.status}`);
    return response.json() as Promise<Policy>;
  });
  return pending;
}

/** Five dice as the sorted digit string the policy is keyed by, e.g. [3,1,6,4,1] -> "11346". */
export function handKey(dice: number[]) {
  return [...dice].sort((a, b) => a - b).join('');
}

/** The policy's key for the bid currently on the table, or null if it never solved that spot. */
export function stateKey(bid: PolicyBid | null) {
  if (!bid) return 'Q0_F0_WILD';
  const zhai = bid.zhai || bid.face === 1;
  return `Q${bid.quantity}_F${bid.face}_${zhai ? 'ZHAI' : 'WILD'}`;
}

export function parsePolicyAction(action: string): PolicyMove | null {
  if (action === 'CALL') return { kind: 'challenge' };
  const match = action.match(/^BID_Q(\d+)_F(\d)(_ZHAI)?$/);
  if (!match) return null;
  const face = Number(match[2]);
  return { kind: 'bid', bid: { quantity: Number(match[1]), face, zhai: Boolean(match[3]) || face === 1 } };
}

/**
 * Draw one action from the solver's mix for this hand and bid.
 *
 * Returns null when the spot is outside the solve — quantity above seven, a zhai/fei
 * transition the export does not contain, or a bid the game allows but the solver
 * never faced. The caller falls back to the heuristic bot rather than guessing.
 *
 * `isLegal` filters to moves the live rules engine accepts, so an abstraction
 * mismatch can never produce an illegal bid; probabilities are renormalised over
 * whatever survives.
 */
export function samplePolicyMove(
  policy: Policy,
  dice: number[],
  currentBid: PolicyBid | null,
  isLegal: (move: PolicyMove) => boolean,
  random: () => number = Math.random,
): PolicyMove | null {
  const row = policy.d[handKey(dice)]?.[stateKey(currentBid)];
  if (!row) return null;

  const options: { move: PolicyMove; weight: number }[] = [];
  let total = 0;
  for (const [index, permille] of row) {
    if (permille <= 0) continue;
    const move = parsePolicyAction(policy.acts[index]);
    if (!move || !isLegal(move)) continue;
    options.push({ move, weight: permille });
    total += permille;
  }
  if (!total) return null;

  let roll = random() * total;
  for (const option of options) {
    roll -= option.weight;
    if (roll <= 0) return option.move;
  }
  return options[options.length - 1].move;
}
