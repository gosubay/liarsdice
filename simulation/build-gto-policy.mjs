// Converts a solved MCCFR average policy into the compact bundle the GTO Strategy
// tab ships (app/gto-policy.json). See GTO_TAB_SPEC.md for the format and the
// hand-ordering rules, which the grid layout depends on.
//
//   node simulation/build-gto-policy.mjs <path-to-strategy.json>

import fs from 'node:fs';
import path from 'node:path';

const source = process.argv[2];
if (!source) {
  console.error('usage: node simulation/build-gto-policy.mjs <path-to-strategy.json>');
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(source, 'utf8'));
const keys = Object.keys(raw);

// Keys look like P0_11346_Q3_F6_WILD: seat, sorted hand, quantity, face, bid mode.
const handOf = (key) => key.split('_')[1];
const stateOf = (key) => key.split('_').slice(2).join('_');

const factorial = (n) => {
  let result = 1;
  for (let i = 2; i <= n; i += 1) result *= i;
  return result;
};

// Chance weight of a sorted hand: its permutation count over the 7,776 ordered rolls.
const weightOf = (hand) => {
  const counts = {};
  for (const die of hand) counts[die] = (counts[die] ?? 0) + 1;
  let denominator = 1;
  for (const key of Object.keys(counts)) denominator *= factorial(counts[key]);
  return (factorial(5) / denominator / 7776) * 100;
};

const acts = [...new Set(keys.flatMap((key) => Object.keys(raw[key])))].sort();
const actIndex = Object.fromEntries(acts.map((action, i) => [action, i]));

// Display order: band by wild ones, then sixes-heavy first. GTO_TAB_SPEC.md explains why.
const faceCounts = (hand) => {
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const die of hand) counts[Number(die)] += 1;
  return counts;
};
const hands = [...new Set(keys.map(handOf))].sort((a, b) => {
  const left = faceCounts(a);
  const right = faceCounts(b);
  if (left[1] !== right[1]) return left[1] - right[1];
  for (let face = 6; face >= 2; face -= 1) if (left[face] !== right[face]) return right[face] - left[face];
  return 0;
});

const states = [...new Set(keys.map(stateOf))].sort();

const d = {};
for (const hand of hands) {
  const row = {};
  for (const state of states) {
    const entry = raw[`P0_${hand}_${state}`];
    if (!entry) continue;
    const actions = Object.entries(entry)
      .filter(([, p]) => p >= 0.005)
      .map(([action, p]) => [actIndex[action], Math.round(p * 1000)]);
    if (actions.length) row[state] = actions;
  }
  d[hand] = row;
}

const destination = path.join(process.cwd(), 'app', 'gto-policy.json');
fs.writeFileSync(destination, JSON.stringify({
  acts,
  hands,
  w: hands.map((hand) => Number(weightOf(hand).toFixed(4))),
  states,
  d,
}));

console.log(
  `wrote ${destination} · ${(fs.statSync(destination).size / 1024).toFixed(0)} KB · ` +
  `${hands.length} hands · ${states.length} states · ${acts.length} actions`,
);
