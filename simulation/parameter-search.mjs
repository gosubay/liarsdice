import { evaluatePair } from "./benchmark.mjs";
import { STRATEGIES, createStrategy } from "./strategies.mjs";

function argument(name, fallback) {
  const prefix = `--${name}=`;
  const value = process.argv.find((item) => item.startsWith(prefix));
  return value ? Number(value.slice(prefix.length)) : fallback;
}

const screenSamples = argument("screen", 1_000);
const validationSamples = argument("validate", 50_000);
const seed = argument("seed", 31415926);
const target = STRATEGIES.find((strategy) => strategy.name === "Value-Cautious");

const candidates = [];
for (const challengeThreshold of [0.42, 0.48, 0.54, 0.6, 0.66]) {
  for (const eligibleBluffRate of [0, 0.35, 0.51, 0.7]) {
    for (const raiseBluffRate of [0, 0.08, 0.16, 0.24]) {
      for (const signal of [0.9, 1, 1.1]) {
        for (const riskPenalty of [0.7, 1, 1.3]) {
          const config = {
            challengeThreshold,
            eligibleBluffRate,
            polarizedOpening: eligibleBluffRate > 0,
            protectedBluffPreference: eligibleBluffRate > 0 ? 0.25 : 0,
            raiseBluffRate,
            riskPenalty,
            signal,
          };
          const name = [
            `C${challengeThreshold}`,
            `O${eligibleBluffRate}`,
            `R${raiseBluffRate}`,
            `S${signal}`,
            `P${riskPenalty}`,
          ].join("-");
          candidates.push({ name, config, strategy: createStrategy(name, config) });
        }
      }
    }
  }
}

const screened = candidates.map((candidate) => {
  const result = evaluatePair(candidate.strategy, target, screenSamples, seed);
  return { ...candidate, screenWinRate: result.winRateA };
});
screened.sort((a, b) => b.screenWinRate - a.screenWinRate);

const finalists = screened.slice(0, 8).map((candidate) => {
  const result = evaluatePair(
    candidate.strategy,
    target,
    validationSamples,
    seed + 0x9e3779b9,
  );
  const own = result.players[0];
  return {
    strategy: candidate.name,
    screenWin: `${(100 * candidate.screenWinRate).toFixed(2)}%`,
    validationWin: `${(100 * result.winRateA).toFixed(2)}%`,
    openingBluff: `${(100 * own.openings.bluff / own.starts).toFixed(2)}%`,
    challengeAccuracy: `${(100 * own.correctChallenges / own.challenges).toFixed(2)}%`,
    averageBids: result.averageBids.toFixed(2),
  };
});
finalists.sort((a, b) => Number.parseFloat(b.validationWin) - Number.parseFloat(a.validationWin));

console.log(
  `Screened ${candidates.length} parameter strategies against ${target.name}; ` +
  `${screenSamples.toLocaleString()} paired samples each.`,
);
console.log(`Validated the top 8 with ${validationSamples.toLocaleString()} paired samples each.`);
console.table(finalists);
