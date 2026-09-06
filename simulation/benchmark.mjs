import { createRng, mixSeed, playRound, prepareHand } from "./liars-dice.mjs";
import { openingClassification } from "./strategies.mjs";

function emptyPlayerStats(name) {
  return {
    name,
    games: 0,
    wins: 0,
    starts: 0,
    starterWins: 0,
    bids: 0,
    challenges: 0,
    correctChallenges: 0,
    openings: { bluff: 0, middle: 0, value: 0 },
  };
}

function recordGame(stats, result, hands) {
  for (let player = 0; player < 2; player += 1) {
    stats[player].games += 1;
    if (result.winner === player) stats[player].wins += 1;
    if (result.starter === player) {
      stats[player].starts += 1;
      if (result.winner === player) stats[player].starterWins += 1;
    }
  }

  for (const action of result.history) stats[action.player].bids += 1;
  stats[result.challenger].challenges += 1;
  if (!result.trueBid) stats[result.challenger].correctChallenges += 1;

  const opening = result.history[0];
  const classification = openingClassification(hands[opening.player], opening.bid);
  stats[opening.player].openings[classification] += 1;
}

export function evaluatePair(strategyA, strategyB, samples, seed = 1) {
  const stats = [emptyPlayerStats(strategyA.name), emptyPlayerStats(strategyB.name)];
  const diceRng = createRng(mixSeed(seed, 0x243f6a88));
  let starterWins = 0;
  let totalBids = 0;

  for (let sample = 0; sample < samples; sample += 1) {
    const hands = [prepareHand(diceRng), prepareHand(diceRng)];
    const roundSeed = mixSeed(seed, sample + 1);

    const first = playRound({
      strategies: [strategyA, strategyB],
      hands,
      starter: 0,
      seed: roundSeed,
    });
    recordGame(stats, first, hands);
    if (first.winner === first.starter) starterWins += 1;
    totalBids += first.bids;

    const second = playRound({
      strategies: [strategyA, strategyB],
      hands,
      starter: 1,
      seed: mixSeed(roundSeed, 0x9e3779b9),
    });
    recordGame(stats, second, hands);
    if (second.winner === second.starter) starterWins += 1;
    totalBids += second.bids;
  }

  return {
    games: samples * 2,
    winRateA: stats[0].wins / (samples * 2),
    starterWinRate: starterWins / (samples * 2),
    averageBids: totalBids / (samples * 2),
    players: stats,
  };
}

export function summarizePlayer(stats) {
  const openingTotal = stats.starts || 1;
  return {
    strategy: stats.name,
    games: stats.games,
    winRate: `${(100 * stats.wins / stats.games).toFixed(2)}%`,
    openingBluff: `${(100 * stats.openings.bluff / openingTotal).toFixed(2)}%`,
    openingMiddle: `${(100 * stats.openings.middle / openingTotal).toFixed(2)}%`,
    challengeAccuracy: stats.challenges
      ? `${(100 * stats.correctChallenges / stats.challenges).toFixed(2)}%`
      : "—",
    bidsPerGame: (stats.bids / stats.games).toFixed(2),
  };
}
