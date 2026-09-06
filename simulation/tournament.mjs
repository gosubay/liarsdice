import { evaluatePair, summarizePlayer } from "./benchmark.mjs";
import { STRATEGIES } from "./strategies.mjs";

function argument(name, fallback) {
  const prefix = `--${name}=`;
  const value = process.argv.find((item) => item.startsWith(prefix));
  return value ? Number(value.slice(prefix.length)) : fallback;
}

const samplesPerPair = argument("samples", 100_000);
const seed = argument("seed", 20260905);
const totals = new Map(
  STRATEGIES.map((strategy) => [strategy.name, {
    name: strategy.name,
    games: 0,
    wins: 0,
    starts: 0,
    starterWins: 0,
    bids: 0,
    challenges: 0,
    correctChallenges: 0,
    openings: { bluff: 0, middle: 0, value: 0 },
  }]),
);
const matchups = [];
let pairSeed = 1;

function accumulate(target, source) {
  for (const key of ["games", "wins", "starts", "starterWins", "bids", "challenges", "correctChallenges"]) {
    target[key] += source[key];
  }
  for (const key of ["bluff", "middle", "value"]) target.openings[key] += source.openings[key];
}

for (let left = 0; left < STRATEGIES.length; left += 1) {
  for (let right = left + 1; right < STRATEGIES.length; right += 1) {
    const a = STRATEGIES[left];
    const b = STRATEGIES[right];
    const result = evaluatePair(a, b, samplesPerPair, seed + pairSeed);
    pairSeed += 1;
    accumulate(totals.get(a.name), result.players[0]);
    accumulate(totals.get(b.name), result.players[1]);
    matchups.push({
      matchup: `${a.name} vs ${b.name}`,
      games: result.games,
      aWin: `${(100 * result.winRateA).toFixed(2)}%`,
      starterWin: `${(100 * result.starterWinRate).toFixed(2)}%`,
      avgBids: result.averageBids.toFixed(2),
    });
  }
}

const leaderboard = [...totals.values()]
  .map(summarizePlayer)
  .sort((a, b) => Number.parseFloat(b.winRate) - Number.parseFloat(a.winRate));

console.log(`Seed: ${seed}; paired samples per matchup: ${samplesPerPair.toLocaleString()}`);
console.table(leaderboard);
console.table(matchups);
