import {
  FACES,
  OPENING_QUANTITY,
  exactCount,
  faceRank,
  normalSupport,
  supportCount,
} from "./liars-dice.mjs";

const COMBINATIONS = [1, 5, 10, 10, 5, 1];

function pick(items, rng) {
  return items[Math.floor(rng() * items.length)];
}

function binomialTail(n, minimum, probability) {
  if (minimum <= 0) return 1;
  if (minimum > n) return 0;
  let result = 0;
  for (let matches = minimum; matches <= n; matches += 1) {
    result +=
      COMBINATIONS[matches] *
      probability ** matches *
      (1 - probability) ** (n - matches);
  }
  return result;
}

export function estimatedTruthProbability(hand, bid, opponentDice = 5, signal = 1) {
  const known = supportCount(hand, bid);
  const baseProbability = bid.zhai || bid.face === 1 ? 1 / 6 : 1 / 3;
  const opponentProbability = Math.min(0.95, baseProbability * signal);
  return binomialTail(opponentDice, bid.quantity - known, opponentProbability);
}

function openingBid(hand, rng, config) {
  const candidates = FACES.map((face) => ({
    face,
    support: normalSupport(hand, face),
  }));
  const values = candidates.filter((candidate) => candidate.support >= 2);
  const bluffs = candidates.filter((candidate) => candidate.support === 0);

  if (config.polarizedOpening && bluffs.length > 0 && rng() < config.eligibleBluffRate) {
    let choices = bluffs;
    if (rng() < config.protectedBluffPreference) {
      const maximum = Math.max(...values.map((candidate) => candidate.support));
      const strongest = values.filter((candidate) => candidate.support === maximum);
      const protectedFaces = strongest
        .map((candidate) => candidate.face - 1)
        .filter((face) => face >= 2 && bluffs.some((candidate) => candidate.face === face));
      if (protectedFaces.length > 0) {
        choices = bluffs.filter((candidate) => protectedFaces.includes(candidate.face));
      }
    }
    const selected = pick(choices, rng);
    return { quantity: OPENING_QUANTITY, face: selected.face, zhai: false };
  }

  const maximum = Math.max(...values.map((candidate) => candidate.support));
  const strongest = values.filter((candidate) => candidate.support === maximum);
  const selected = pick(strongest, rng);
  return { quantity: OPENING_QUANTITY, face: selected.face, zhai: false };
}

function escalationCost(currentBid, candidate) {
  const quantityJump = candidate.quantity - currentBid.quantity;
  const modeCost = candidate.zhai !== currentBid.zhai ? 0.04 : 0;
  const faceJump = candidate.quantity === currentBid.quantity
    ? Math.max(0, faceRank(candidate.face) - faceRank(currentBid.face)) * 0.012
    : 0;
  return quantityJump * 0.035 + modeCost + faceJump;
}

function chooseRaise(context, config) {
  const { hand, currentBid, legalRaises, opponentDice, rng } = context;
  const scored = legalRaises.map((bid) => {
    const truth = estimatedTruthProbability(hand, bid, opponentDice, config.signal);
    const score = 2 * truth - 1 - escalationCost(currentBid, bid) * config.riskPenalty;
    return { bid, truth, score };
  });

  if (rng() < config.raiseBluffRate) {
    const minimumQuantity = Math.min(...scored.map((entry) => entry.bid.quantity));
    const bluffCandidates = scored
      .filter((entry) => entry.bid.quantity <= minimumQuantity + 1)
      .sort((a, b) => {
        const aSupport = supportCount(hand, a.bid);
        const bSupport = supportCount(hand, b.bid);
        return aSupport - bSupport || b.score - a.score;
      });
    return pick(bluffCandidates.slice(0, Math.min(4, bluffCandidates.length)), rng);
  }

  scored.sort((a, b) => b.score - a.score || a.bid.quantity - b.bid.quantity);
  const bestScore = scored[0].score;
  const nearBest = scored.filter((entry) => entry.score >= bestScore - config.mixWindow);
  return pick(nearBest.slice(0, 5), rng);
}

export function createStrategy(name, overrides = {}) {
  const config = {
    challengeThreshold: 0.5,
    eligibleBluffRate: 0,
    mixWindow: 0.025,
    polarizedOpening: false,
    protectedBluffPreference: 0,
    raiseBluffRate: 0.08,
    riskPenalty: 1,
    signal: 1,
    ...overrides,
  };

  return {
    name,
    config,
    decide(context) {
      if (!context.currentBid) {
        return { type: "bid", bid: openingBid(context.hand, context.rng, config) };
      }

      const truth = estimatedTruthProbability(
        context.hand,
        context.currentBid,
        context.opponentDice,
        config.signal,
      );
      const falseProbability = 1 - truth;
      if (context.legalRaises.length === 0 || falseProbability >= config.challengeThreshold) {
        return { type: "challenge" };
      }

      const raise = chooseRaise(context, config);
      const challengeValue = 1 - 2 * truth;
      if (raise.score < challengeValue && context.rng() >= config.raiseBluffRate) {
        return { type: "challenge" };
      }
      return { type: "bid", bid: raise.bid };
    },
  };
}

export function createRandomStrategy() {
  return {
    name: "Random",
    decide(context) {
      if (context.currentBid && (context.legalRaises.length === 0 || context.rng() < 0.22)) {
        return { type: "challenge" };
      }
      return { type: "bid", bid: pick(context.legalRaises, context.rng) };
    },
  };
}

export const STRATEGIES = [
  createStrategy("Value-Cautious", {
    challengeThreshold: 0.48,
    raiseBluffRate: 0.02,
    riskPenalty: 1.35,
  }),
  createStrategy("Probability", {
    challengeThreshold: 0.5,
    raiseBluffRate: 0.06,
  }),
  createStrategy("Polarized-20", {
    challengeThreshold: 0.5,
    eligibleBluffRate: 0.51,
    polarizedOpening: true,
    protectedBluffPreference: 0.25,
    raiseBluffRate: 0.12,
  }),
  createStrategy("Signal-Cautious", {
    challengeThreshold: 0.56,
    eligibleBluffRate: 0.42,
    polarizedOpening: true,
    protectedBluffPreference: 0.2,
    raiseBluffRate: 0.08,
    signal: 1.14,
  }),
  createStrategy("Aggressive", {
    challengeThreshold: 0.68,
    eligibleBluffRate: 0.58,
    polarizedOpening: true,
    protectedBluffPreference: 0.3,
    raiseBluffRate: 0.24,
    riskPenalty: 0.72,
  }),
  createRandomStrategy(),
];

export function openingClassification(hand, bid) {
  const support = bid.zhai ? exactCount(hand, bid.face) : normalSupport(hand, bid.face);
  if (support === 0) return "bluff";
  if (support === 1) return "middle";
  return "value";
}
