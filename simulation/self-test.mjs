import assert from "node:assert/strict";
import {
  isBidTrue,
  isLegalRaise,
  legalRaises,
  playRound,
} from "./liars-dice.mjs";
import { estimatedTruthProbability } from "./strategies.mjs";

const normalSixes = { quantity: 3, face: 6, zhai: false };
const pureSixes = { quantity: 3, face: 6, zhai: true };

assert.equal(isBidTrue(normalSixes, [[1, 2, 3, 4, 5], [6, 2, 3, 4, 5]]), false);
assert.equal(isBidTrue(normalSixes, [[1, 1, 3, 4, 5], [6, 2, 3, 4, 5]]), true);
assert.equal(isBidTrue(pureSixes, [[1, 1, 6, 4, 5], [6, 2, 3, 4, 5]]), false);
assert.equal(isBidTrue(pureSixes, [[1, 1, 6, 6, 5], [6, 2, 3, 4, 5]]), true);

assert.equal(isLegalRaise(pureSixes, { quantity: 6, face: 2, zhai: false }), true);
assert.equal(isLegalRaise(pureSixes, { quantity: 5, face: 6, zhai: false }), false);
assert.equal(
  isLegalRaise({ quantity: 4, face: 5, zhai: false }, { quantity: 4, face: 6, zhai: true }),
  true,
);
assert.equal(
  isLegalRaise({ quantity: 4, face: 5, zhai: false }, { quantity: 4, face: 5, zhai: true }),
  false,
);
assert.equal(legalRaises({ quantity: 10, face: 1, zhai: true }).length, 0);

const knownTwo = estimatedTruthProbability([6, 6, 2, 3, 4], normalSixes);
assert.ok(Math.abs(knownTwo - (1 - (2 / 3) ** 5)) < 1e-12);

const alwaysChallenge = {
  name: "Challenge",
  decide(context) {
    if (context.currentBid) return { type: "challenge" };
    return { type: "bid", bid: normalSixes };
  },
};
const result = playRound({
  strategies: [alwaysChallenge, alwaysChallenge],
  hands: [[6, 6, 2, 3, 4], [6, 2, 3, 4, 5]],
  starter: 0,
  seed: 1,
});
assert.equal(result.winner, 0);

console.log("Simulation rules and probability checks passed.");
