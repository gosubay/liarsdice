import assert from 'node:assert/strict';
import { OutcomeMCCFR } from './mccfr.mjs';
import { HANDS, LIVE_HANDS, createDiceGame } from './cfr-game.mjs';
import { isLegalRaise, prepareHand } from './liars-dice.mjs';

assert.equal(HANDS.length, 252);
assert.equal(LIVE_HANDS.length, 246);
assert.equal(HANDS.reduce((s, h) => s + h.multiplicity, 0), 7776);
assert.equal(LIVE_HANDS.reduce((s, h) => s + h.multiplicity, 0), 7056);
assert.ok(Math.abs(LIVE_HANDS.reduce((s, h) => s + h.probability, 0) - 1) < 1e-12);
for (const q of [3, 4, 6, 10]) assert.ok(isLegalRaise(null, { quantity: q, face: 1, zhai: true }));
assert.ok(!isLegalRaise(null, { quantity: 2, face: 6, zhai: false }));
assert.ok(!isLegalRaise(null, { quantity: 3.5, face: 6, zhai: false }));
assert.ok(isLegalRaise({ quantity: 3, face: 4, zhai: false }, { quantity: 4, face: 3, zhai: true }));
assert.ok(!isLegalRaise({ quantity: 3, face: 4, zhai: false }, { quantity: 3, face: 3, zhai: true }));
assert.ok(isLegalRaise({ quantity: 3, face: 6, zhai: true }, { quantity: 7, face: 2, zhai: false }));
const stream = [1,2,3,4,5, 2,3,4,5,6, 1,1,2,3,4].map(x => (x - 0.5) / 6);
assert.deepEqual(prepareHand(() => stream.shift()), [1,1,2,3,4]);
assert.equal(stream.length, 0);
const full = createDiceGame();
assert.equal(full.actions(full.root(0, 1)).length, 88);
assert.equal(full.info(full.root(0, 1)), full.info(full.root(0, 2)));

// Kuhn poker: known game value -1/18, six deals, exact enumeration of
// all 64 deterministic information-set-consistent policies for each player.
const deals = [];
for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) if (a !== b) deals.push([a,b]);
const kuhn = {
  sampleRoot(rng) { return { state: { hands: deals[Math.floor(rng() * 6)], history: '', player: 0 }, probability: 1/6 }; },
  info(s) { return `${s.player}:${s.hands[s.player]}:${s.history}`; },
  actions() { return [0,1]; },
  next(s,a) { return { ...s, history: s.history + (a ? 'b' : 'p'), player: 1 - s.player }; },
  utility(s,p) {
    const showdown = s.hands[0] > s.hands[1] ? 1 : -1;
    const u = ({ pp: showdown, bp: 1, pbp: -1, bb: 2 * showdown, pbb: 2 * showdown })[s.history];
    return u === undefined ? null : (p === 0 ? u : -u);
  },
};
function value(policy0, policy1) {
  function walk(s) {
    const u = kuhn.utility(s, 0); if (u !== null) return u;
    const p = (s.player === 0 ? policy0 : policy1)(s);
    return p[0] * walk(kuhn.next(s, 0)) + p[1] * walk(kuhn.next(s, 1));
  }
  return deals.reduce((v, hands) => v + walk({ hands, player: 0, history: '' }) / 6, 0);
}
function nashConv(policy) {
  const best = [-Infinity, -Infinity];
  for (let player = 0; player < 2; player++) for (let bits = 0; bits < 64; bits++) {
    const pure = s => {
      const index = s.hands[player] * 2 + (player === 0 ? +(s.history === 'pb') : +(s.history === 'b'));
      const a = (bits >> index) & 1; return a ? [0,1] : [1,0];
    };
    const v = player === 0 ? value(pure, policy) : -value(policy, pure);
    best[player] = Math.max(best[player], v);
  }
  return best[0] + best[1];
}
const solver = new OutcomeMCCFR(kuhn, { seed: 20260905 });
const initialGap = nashConv(s => solver.policy(s));
solver.train(150_000);
const policy = solver.snapshot();
const gap = nashConv(policy);
const gameValue = value(policy, policy);
assert.ok(gap < 0.06 && gap < initialGap / 5, `Kuhn NashConv too high: ${gap}`);
assert.ok(Math.abs(gameValue + 1/18) < 0.03, `Kuhn value wrong: ${gameValue}`);
assert.equal(solver.nodes.size, 12);
console.log(JSON.stringify({ tests: 'passed', kuhn: { initialNashConv: initialGap, nashConv: gap, value: gameValue }, canonicalHands: 252, eligibleHands: 246 }, null, 2));
