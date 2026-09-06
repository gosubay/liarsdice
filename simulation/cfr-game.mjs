import { legalRaises, bidKey, supportCount } from './liars-dice.mjs';
import { sampleIndex } from './mccfr.mjs';

const factorial = [1, 1, 2, 6, 24, 120];
export const HANDS = [];
function enumerate(counts, remaining) {
  if (counts.length === 5) {
    const c = [...counts, remaining];
    const dice = c.flatMap((n, i) => Array(n).fill(i + 1));
    const multiplicity = 120 / c.reduce((p, n) => p * factorial[n], 1);
    HANDS.push({ id: HANDS.length, counts: c, dice, multiplicity, straight: c.filter(Boolean).length === 5 });
    return;
  }
  for (let n = 0; n <= remaining; n++) enumerate([...counts, n], remaining - n);
}
enumerate([], 5);
export const LIVE_HANDS = HANDS.filter(h => !h.straight);
const mass = LIVE_HANDS.reduce((s, h) => s + h.multiplicity, 0);
for (const h of HANDS) h.probability = h.straight ? 0 : h.multiplicity / mass;
export const RULES = {
  version: 'ktv-headsup-2026-09-05-confirmed-v1', dice: 5, minimum: 3, maximum: 10,
  reroll: 'mandatory all five-distinct, repeated until non-straight, before bidding',
  zhaiEntry: 'higher quantity any face; same quantity strictly higher face',
  fei: 'at least double, any normal face',
};

// Diagnostic action-restricted game only; this is NOT the full KTV game.
export const DIAGNOSTIC_BIDS = [
  { quantity: 3, face: 6, zhai: false }, { quantity: 3, face: 1, zhai: true },
  { quantity: 4, face: 5, zhai: false }, { quantity: 4, face: 6, zhai: false },
  { quantity: 4, face: 6, zhai: true }, { quantity: 6, face: 5, zhai: false },
  { quantity: 6, face: 6, zhai: false }, { quantity: 10, face: 1, zhai: true },
];

export function createDiceGame({ restricted = false } = {}) {
  const bids = restricted ? DIAGNOSTIC_BIDS : legalRaises(null);
  const index = new Map(bids.map((b, i) => [bidKey(b), i]));
  const choices = new Map();
  for (const current of [-1, ...bids.map((_, i) => i)]) {
    const legal = legalRaises(current < 0 ? null : bids[current]).filter(b => index.has(bidKey(b))).map(b => index.get(bidKey(b)));
    choices.set(current, current < 0 ? legal : [-1, ...legal]);
  }
  const supports = HANDS.map(h => bids.map(b => supportCount(h.dice, b)));
  const probabilities = LIVE_HANDS.map(h => h.probability);
  const game = {
    bids, choices, supports, restricted,
    root(h0, h1) { return { hands: [h0, h1], player: 0, current: -1, history: [], winner: null }; },
    sampleRoot(rng) {
      const a = LIVE_HANDS[sampleIndex(probabilities, rng)];
      const b = LIVE_HANDS[sampleIndex(probabilities, rng)];
      return { state: this.root(a.id, b.id), probability: a.probability * b.probability };
    },
    info(s) { return `${s.player}:${s.hands[s.player]}:${s.history.join('.')}`; },
    actions(s) { return choices.get(s.current); },
    utility(s, p) { return s.winner === null ? null : s.winner === p ? 1 : -1; },
    next(s, action) {
      if (action === -1) {
        const truth = supports[s.hands[0]][s.current] + supports[s.hands[1]][s.current] >= bids[s.current].quantity;
        return { ...s, winner: truth ? 1 - s.player : s.player };
      }
      return { ...s, player: 1 - s.player, current: action, history: [...s.history, action] };
    },
    context(s, rng) {
      return { player: s.player, hand: HANDS[s.hands[s.player]].dice, opponentDice: 5,
        currentBid: s.current < 0 ? null : bids[s.current], legalRaises: this.actions(s).filter(a => a >= 0).map(a => bids[a]),
        history: s.history.map((a, i) => ({ player: i % 2, bid: bids[a] })), rng };
    },
    actionIndex(s, action) {
      return this.actions(s).indexOf(action.type === 'challenge' ? -1 : index.get(bidKey(action.bid)));
    },
  };
  return game;
}

// Exact hidden-hand-aware BR. Max occurs AFTER summing over opponent hands.
// Only practical for the diagnostic menu. Never merges distinct histories.
export function exactResponse(game, policy, responder, { bestResponse = true } = {}) {
  if (!game.restricted) throw new Error('Exact enumeration is restricted to the diagnostic game');
  function visit(s, weights) {
    if (s.winner !== null) throw new Error('Terminal handled at parent');
    const actions = game.actions(s);
    const opponentPolicies = s.player !== responder ? LIVE_HANDS.map(h => {
      const hands = [...s.hands]; hands[1 - responder] = h.id;
      return policy({ ...s, hands });
    }) : null;
    const values = actions.map((action, ai) => {
      const nextWeights = opponentPolicies ? weights.map((w, j) => w * opponentPolicies[j][ai]) : weights;
      if (nextWeights.every(w => w === 0)) return 0;
      if (action === -1) {
        return LIVE_HANDS.reduce((total, h, j) => {
          const hands = [...s.hands]; hands[1 - responder] = h.id;
          return total + nextWeights[j] * game.utility(game.next({ ...s, hands }, action), responder);
        }, 0);
      }
      return visit(game.next(s, action), nextWeights);
    });
    if (s.player !== responder) return values.reduce((a, b) => a + b, 0);
    if (bestResponse) return Math.max(...values);
    const p = policy(s);
    return values.reduce((v, x, a) => v + p[a] * x, 0);
  }
  return LIVE_HANDS.reduce((total, hand) => {
    const hands = [LIVE_HANDS[0].id, LIVE_HANDS[0].id]; hands[responder] = hand.id;
    return total + hand.probability * visit(game.root(...hands), LIVE_HANDS.map(h => h.probability));
  }, 0);
}
