import { mkdirSync, writeFileSync, createWriteStream } from 'node:fs';
import { createGzip } from 'node:zlib';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { OutcomeMCCFR, sampleIndex } from './mccfr.mjs';
import { createDiceGame, exactResponse, LIVE_HANDS, RULES } from './cfr-game.mjs';
import { createRng, bidKey } from './liars-dice.mjs';
import { STRATEGIES, createStrategy } from './strategies.mjs';

const arg = (name, fallback) => {
  const value = process.argv.find(s => s.startsWith(`--${name}=`));
  return value ? Number(value.split('=')[1]) : fallback;
};
const iterations = arg('iterations', 100_000);
const samples = arg('samples', 10_000);
const attackIterations = arg('attack', 100_000);
const seed = arg('seed', 20260905);
const restricted = process.argv.includes('--restricted');
const output = `outputs/cfr/${restricted ? 'diagnostic' : 'full'}-${seed}`;
mkdirSync(output, { recursive: true });
const game = createDiceGame({ restricted });
const solver = new OutcomeMCCFR(game, { seed });
const started = Date.now();
const checkpoints = [];
function moments(values) {
  const mean = values.reduce((s, x) => s + x, 0) / values.length;
  const variance = values.reduce((s, x) => s + (x - mean) ** 2, 0) / (values.length - 1);
  const half = 1.96 * Math.sqrt(variance / values.length);
  return { mean, ci95: [mean - half, mean + half], samples: values.length };
}
function round(state, policies, rng, coverage = null) {
  while (state.winner === null) {
    const policy = policies[state.player];
    if (coverage && policy.table) {
      coverage.decisions++;
      if (!policy.table.has(game.info(state))) coverage.fallback++;
    }
    const p = policy(state, rng);
    state = game.next(state, game.actions(state)[sampleIndex(p, rng)]);
  }
  return game.utility(state, 0);
}
function matchup(candidate, opponent, count, matchSeed) {
  const dice = createRng(matchSeed), actions = createRng(matchSeed + 1);
  const wins = [], opener = [], responder = [];
  const coverage = { decisions: 0, fallback: 0 };
  for (let n = 0; n < count; n++) {
    const { state } = game.sampleRoot(dice);
    const a = (round(state, [candidate, opponent], actions, coverage) + 1) / 2;
    const b = (1 - round(state, [opponent, candidate], actions, coverage)) / 2;
    wins.push((a + b) / 2); opener.push(a); responder.push(b);
  }
  return { winRate: moments(wins), opener: moments(opener), responder: moments(responder),
    candidateFallbackRate: coverage.fallback / coverage.decisions };
}
function attackGain(candidate, attacker, player, count, matchSeed) {
  const dice = createRng(matchSeed), actions = createRng(matchSeed + 1), gains = [];
  for (let n = 0; n < count; n++) {
    const { state } = game.sampleRoot(dice);
    const base = round(state, [candidate, candidate], actions);
    const profile = [candidate, candidate]; profile[player] = attacker;
    gains.push((round(state, profile, actions) - base) * (player === 0 ? 1 : -1));
  }
  return moments(gains);
}
const heuristic = strategy => (s, rng) => {
  const decision = strategy.decide(game.context(s, rng));
  const chosen = game.actionIndex(s, decision);
  if (chosen < 0) throw new Error(`Illegal heuristic action: ${strategy.name}`);
  return game.actions(s).map((_, i) => +(i === chosen));
};

for (let done = 0; done < iterations;) {
  const batch = Math.min(25_000, iterations - done);
  solver.train(batch); done += batch;
  const record = { iterations: done, informationSets: solver.nodes.size, elapsedSeconds: (Date.now() - started) / 1000 };
  checkpoints.push(record);
  console.log(JSON.stringify(record));
}
const candidate = solver.snapshot();
const report = {
  status: 'research candidate; not certified GTO', rules: RULES,
  mode: restricted ? 'eight-bid diagnostic game, not full game' : 'all legal actions and full public history',
  algorithm: 'outcome-sampling MCCFR; exploration 0.6; reach-weighted average; uniform unseen-history fallback',
  seed, iterations, samples, checkpoints, bids: game.bids, matches: [], attacks: [],
};
if (restricted) {
  const baseline = exactResponse(game, candidate, 0, { bestResponse: false });
  const b0 = exactResponse(game, candidate, 0);
  const b1 = exactResponse(game, candidate, 1);
  report.exact = { selfPlayValue: baseline, bestResponseValues: [b0, b1], gains: [b0 - baseline, b1 + baseline], nashConv: b0 + b1, exploitability: (b0 + b1) / 2 };
  console.log(JSON.stringify({ exact: report.exact }));
} else {
  const strategies = [...STRATEGIES,
    createStrategy('Search-Value', { challengeThreshold: 0.48, raiseBluffRate: 0, riskPenalty: 0.7 }),
    createStrategy('Early-Challenge', { challengeThreshold: 0.25, raiseBluffRate: 0, riskPenalty: 0.5 }),
    createStrategy('Late-Challenge', { challengeThreshold: 0.8, raiseBluffRate: 0, riskPenalty: 0.5 }),
    createStrategy('Frequent-Bluff', { polarizedOpening: true, eligibleBluffRate: 0.9, raiseBluffRate: 0.4 }),
  ];
  for (const strategy of strategies) {
    const result = { opponent: strategy.name, ...matchup(candidate, heuristic(strategy), samples, seed + 700_000) };
    report.matches.push(result); console.log(JSON.stringify(result));
  }
}
// Fresh response learners never mutate the frozen candidate. They have the
// same legal action space, separate tables and independent training seeds.
for (let attackSeed = 0; attackSeed < 3; attackSeed++) {
  const attacker = new OutcomeMCCFR(game, { seed: seed + 100 + attackSeed });
  for (let done = 0; done < attackIterations;) {
    const batch = Math.min(25_000, attackIterations - done);
    attacker.train(batch, { fixedOpponent: candidate }); done += batch;
    console.log(JSON.stringify({ attackSeed, iterations: done, informationSets: attacker.nodes.size }));
  }
  const frozen = attacker.snapshot();
  for (const player of [0, 1]) {
    const result = { attackSeed, player, iterations: attackIterations,
      deviationGain: attackGain(candidate, frozen, player, samples, seed + 900_000 + player * 10_000 + attackSeed) };
    report.attacks.push(result); console.log(JSON.stringify(result));
  }
}
report.openings = LIVE_HANDS.map(h => ({ hand: h.dice, chance: h.probability,
  distribution: game.actions(game.root(h.id, LIVE_HANDS[0].id)).map((a, j) => ({ bid: bidKey(game.bids[a]), probability: candidate(game.root(h.id, LIVE_HANDS[0].id))[j] })) }));
report.elapsedSeconds = (Date.now() - started) / 1000;
writeFileSync(`${output}/report.json`, JSON.stringify(report, null, 2));
// Stream the export: avoid duplicating a large table in a giant JSON string.
async function* rows() {
  yield JSON.stringify({ rules: RULES, bids: game.bids, restricted, fallback: 'uniform legal', iterations, seed }) + '\n';
  for (const [key, probabilities] of candidate.table) yield JSON.stringify([key, Array.from(probabilities)]) + '\n';
}
await pipeline(Readable.from(rows()), createGzip(), createWriteStream(`${output}/average-policy.jsonl.gz`));
console.log(`Saved ${output}/report.json and average-policy.jsonl.gz`);
