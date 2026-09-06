// Outcome-sampling MCCFR, with importance-corrected regrets and averages.
// No hand/history abstraction: game.info() must preserve perfect recall.
import { createRng } from './liars-dice.mjs';

export function sampleIndex(probabilities, rng) {
  let x = rng();
  for (let i = 0; i < probabilities.length - 1; i++) {
    x -= probabilities[i];
    if (x < 0) return i;
  }
  return probabilities.length - 1;
}

export function normalizePositive(values) {
  const total = values.reduce((s, x) => s + Math.max(0, x), 0);
  return Float64Array.from(values, x => total > 0 ? Math.max(0, x) / total : 1 / values.length);
}

export class OutcomeMCCFR {
  constructor(game, { seed = 1, exploration = 0.6, maxNodes = 1_000_000 } = {}) {
    this.game = game;
    this.rng = createRng(seed);
    this.exploration = exploration;
    this.maxNodes = maxNodes;
    this.nodes = new Map();
    this.iterations = 0;
  }

  node(state) {
    const key = this.game.info(state);
    let node = this.nodes.get(key);
    if (!node) {
      if (this.nodes.size >= this.maxNodes) throw new Error('Information-set limit reached; training stopped, no silent abstraction.');
      const n = this.game.actions(state).length;
      node = { regret: new Float64Array(n), average: new Float64Array(n) };
      this.nodes.set(key, node);
    }
    return node;
  }

  policy(state, average = true) {
    const node = this.nodes.get(this.game.info(state));
    return node ? normalizePositive(average ? node.average : node.regret)
      : new Float64Array(this.game.actions(state).length).fill(1 / this.game.actions(state).length);
  }

  episode(state, updater, myReach, oppReach, sampleReach, fixedOpponent) {
    const utility = this.game.utility(state, updater);
    if (utility !== null) return utility;
    const player = state.player;
    const actions = this.game.actions(state);
    const node = player === updater || !fixedOpponent ? this.node(state) : null;
    const policy = player !== updater && fixedOpponent ? fixedOpponent(state) : normalizePositive(node.regret);
    const sampling = player === updater
      ? Float64Array.from(policy, p => (1 - this.exploration) * p + this.exploration / actions.length)
      : policy;
    const selected = sampleIndex(sampling, this.rng);
    const child = this.episode(this.game.next(state, actions[selected]), updater,
      myReach * (player === updater ? policy[selected] : 1),
      oppReach * (player !== updater ? policy[selected] : 1),
      sampleReach * sampling[selected], fixedOpponent);
    const actionEstimate = child / sampling[selected];
    const estimate = policy[selected] * actionEstimate;
    if (player === updater) {
      for (let a = 0; a < actions.length; a++) {
        node.regret[a] += oppReach / sampleReach * ((a === selected ? actionEstimate : 0) - estimate);
        node.average[a] += myReach / sampleReach * policy[a];
        if (!Number.isFinite(node.regret[a]) || !Number.isFinite(node.average[a])) throw new Error('Nonfinite MCCFR accumulator');
      }
    }
    return estimate;
  }

  train(iterations, { updater = null, fixedOpponent = null } = {}) {
    for (let t = 0; t < iterations; t++) {
      for (const p of updater === null ? [0, 1] : [updater]) {
        const { state, probability } = this.game.sampleRoot(this.rng);
        this.episode(state, p, 1, probability, probability, fixedOpponent);
      }
      this.iterations++;
    }
  }

  snapshot() {
    const table = new Map([...this.nodes].map(([key, node]) => [key, normalizePositive(node.average)]));
    const game = this.game;
    const policy = state => table.get(game.info(state)) ?? new Float64Array(game.actions(state).length).fill(1 / game.actions(state).length);
    policy.table = table;
    return policy;
  }
}
