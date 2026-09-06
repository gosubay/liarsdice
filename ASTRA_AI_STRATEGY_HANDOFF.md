# Astra handoff: China KTV Liar's Dice AI strategy

## Suggested prompt for Astra

You are taking over the game-theory and AI design for a two-player China KTV Liar's Dice game. Read this entire handoff and inspect the local `simulation/` code before proposing changes. Separate heuristic tournament success from approximate Nash equilibrium. Identify any rule ambiguities that materially affect the game tree, then recommend the smallest credible route to a heads-up equilibrium strategy. Pay particular attention to the continuation after an opening bid such as `3 x Sixes`: challenge, `4 x Sixes`, switching to another face, Zhai, and Fei must be compared through their full continuation values rather than by bid-truth probability alone.

Do not call an opening mix “GTO” merely because it wins against the existing bots. Use exploitability or a trained best response as the main equilibrium metric. Preserve the user's existing UI and unrelated local changes.

## Project and repository

- Local project: `C:\Claude\Code\Liar's Dice`
- GitHub repository: <https://github.com/gosubay/liarsdice>
- GitHub Pages target: <https://gosubay.github.io/liarsdice>
- Private OpenAI Sites deployment: <https://liarsdice.galvin-bay.chatgpt.site>
- Framework: React/Vinext static site.
- V1 is one human versus one AI.
- V2 is 2–6 players, with one human and up to five AIs.
- V3 adds netplay with arbitrary human/AI combinations.

Repository caution:

- Local `app/page.tsx` and `app/globals.css` contain uncommitted win/loss display changes.
- The local branch may be behind a GitHub Pages deployment commit that was created directly through GitHub.
- Reconcile remote `main` before a future push; preserve all local user changes.
- The simulator work described below is currently local and uncommitted.

## Confirmed game rules

1. Each player has five dice every round. Dice are never removed.
2. A round loss adds one loss point. More points are worse.
3. Match modes are first to five losses or unlimited.
4. The player who loses a round starts the next round.
5. One is wild in a normal bid.
6. Face order is `1 > 6 > 5 > 4 > 3 > 2`.
7. A bid on ones is automatically Zhai/Pure.
8. A Zhai bid on 2–6 does not count wild ones.
9. Five different die faces permit an optional reroll.
10. To enter Zhai from a normal bid while retaining the quantity, the new face must be higher. Example: `4 x Fives normal` may be followed by `4 x Sixes Zhai`; the same face at the same quantity is illegal.
11. From `3 x Sixes Zhai`, Fei/Po Zhai may be `6 x any face normal`.
12. The user wants opening quantities to start at three; bids of one or two are disallowed.

Still requiring precise confirmation before solving the full game:

- Does Fei permit exactly double the Zhai quantity, or any quantity at least double?
- When a five-distinct hand rerolls, are all five dice rerolled?
- Is the fact that a player rerolled public information?
- Are opening `3 x Ones Zhai` and opening explicit Zhai bids on 2–6 permitted?
- Is the maximum legal quantity capped at the ten dice in play? The current simulator assumes yes.

## Interface and product direction

- Language is selected as either English or Chinese, not shown simultaneously.
- Minimal mobile-first KTV-table appearance: dark charcoal, ivory dice, restrained red accents.
- AI dice remain hidden until a challenge.
- The local UI supports bidding, Zhai/Fei validation, challenge/reveal/results, optional straight reroll, loss scoring, and a basic placeholder AI.
- A local-only change displays each side's W–L record (`W–L` in English, `胜–负` in Chinese).

## Probability groundwork

For five unknown dice:

- A normal bid on a specific face 2–6 counts that face plus wild ones, so one unknown die matches with probability `1/3`.
- A Zhai bid, or a bid on ones, matches with probability `1/6`.
- If the acting player knows `K` matches and the bid quantity is `Q`, the opponent must supply `r = Q - K` matches.
- The bid-truth estimate is the cumulative binomial probability:

  `P(X >= r) = sum from i=r to n of C(n,i) p^i (1-p)^(n-i)`.

Actual ones in five dice:

| Count | Probability |
|---:|---:|
| 0 | 40.1878% |
| 1 | 40.1878% |
| 2 | 16.0751% |
| 3 | 3.2150% |
| 4 | 0.3215% |
| 5 | 0.0129% |

Effective copies of a normal face, including ones:

| Count | Exact probability | Probability of at least this many |
|---:|---:|---:|
| 0 | 13.1687% | 100% |
| 1 | 32.9218% | 86.8313% |
| 2 | 32.9218% | 53.9095% |
| 3 | 16.4609% | 20.9877% |
| 4 | 4.1152% | 4.5267% |
| 5 | 0.4115% | 0.4115% |

For an opening `3 x Sixes`, conditional on the opener's effective six support:

| Opener support | Probability bid is true before observing the opponent's action |
|---:|---:|
| 0 | 20.99% |
| 1 | 53.91% |
| 2 | 86.83% |
| 3+ | 100% |

The user prefers a polarized opening construction: choose faces with zero support as bluffs, choose faces with 2+ support for value, and avoid faces with exactly one support.

## Hand counting

- There are `6^5 = 7,776` ordered five-die outcomes.
- There are `C(10,5) = 252` unordered/sorted five-die hands, from the stars-and-bars count of nonnegative solutions to `c1 + ... + c6 = 5`.
- The 252 canonical hands have unequal chance weights, determined by their multinomial permutation counts.

Hand-shape distribution:

| Shape | Sorted hands | Ordered outcomes | Probability |
|---|---:|---:|---:|
| All distinct | 6 | 720 | 9.2593% |
| One pair | 60 | 3,600 | 46.2963% |
| Two pairs | 60 | 1,800 | 23.1481% |
| Three of a kind | 60 | 1,200 | 15.4321% |
| Full house | 30 | 300 | 3.8580% |
| Four of a kind | 30 | 150 | 1.9290% |
| Five of a kind | 6 | 6 | 0.0772% |

## Game-theory conclusions reached so far

### Utility

For a heads-up round, scoring opponent loss as `+1` and own loss as `-1` is a valid zero-sum terminal utility. Multiplayer should instead prioritize avoiding one's own loss or maximizing match survival; another player's loss is not equivalent to one's own win.

### Challenge versus continuation

Expected count is a rough heuristic. Challenge decisions should use `P(bid is true)` or, more correctly, compare the terminal challenge value against the continuation value of every legal raise.

With `+1/-1` terminal round utility:

`EV(challenge) = P(false) - P(true) = 2P(false) - 1`.

For a legal raise `a`:

`EV(a | defender hand) = sum over opener hands H of P(H | observed history) * V(next state after a, H, defender hand)`.

Bid-truth probability alone is not the value of a raise because the opponent can challenge, raise again, switch faces, enter Zhai, or Fei.

### Nash indifference

Nash equilibrium does not require challenge, `4 x Sixes`, and `4 x another face` to have equal value for every hand. At a particular information set, only actions used with positive probability must be equal within approximation error. Many private hands should have a pure best action. Boundary hands may mix.

The posterior after observing `3 x Sixes` is:

`P(H | 3x6) proportional to P(3x6 | H) * P(H)`.

Thus the opener's bluff/value frequencies and the defender's responses must be solved simultaneously through the complete game tree.

### Poker analogy

Poker river bluff/value ratios do not transfer directly. An opening Liar's Dice bid is not terminal and there is no fixed pot-odds formula. The relevant comparison is challenge EV versus the best continuation EV. CFR/MCCFR is a suitable approach for this finite two-player imperfect-information game.

## Opening-range experiments

A fixed face naturally has:

- `P(support = 0) = 13.1687%`.
- `P(support >= 2) = 53.9095%`.

Conditioning on only zero or 2+ support gives roughly 19.63% zero-support hands and 80.37% value hands. However, when the bot can choose among all five normal faces, zero-support opportunities occur much more often at the hand level.

After automatically rerolling a 2–6 straight, approximately 39.3% of hands have at least one zero-support face. Therefore:

- A literal 20% bluff coin flip only yields about `39.3% * 20% = 7.9%` actual opening bluffs.
- To produce 20% actual zero-support openings, the bot must choose a zero-support face about 51% of the times one is available.

A face-neutral calibrated policy produced almost exactly 20% zero-support bluffs within each visible normal opening bid. The resulting opening bid was actually false about 22.2% of the time after including the opponent's dice.

Against that range, after seeing `3 x face`:

| Defender's effective support | Approximate probability the bid is false |
|---:|---:|
| 0 | 68.5% |
| 1 | 20% |
| 2 | 20% |
| 3+ | 0% |

This makes an immediate challenge attractive with zero support and unattractive with one or more support, before accounting for bid-history signals and continuation value.

### Protected bluff idea

If the bot holds two physical sixes, no ones, and no fives, it can sometimes open `3 x Fives` instead of `3 x Sixes`. The idea is that the opponent's same-quantity increase to `3 x Sixes` moves the auction onto the bot's strong face.

Testing showed that strongly preferring this construction makes visible face ranges uneven:

- With a 70% protected-bluff preference, `3 x Fives` contained about 21.0% bluffs while `3 x Sixes` contained only about 17.1%.
- Among actual zero-five bluffs, the probability of holding 2+ six support rose from about 34.5% under neutral selection to 44.7%.
- A smaller 20–25% protected-bluff preference preserves more of the protection without making six bids as obviously strong.

The follow-up `4 x Sixes` is not automatic. With exactly two six support, if the opponent raises to `3 x Sixes` whenever they have at least one support, `4 x Sixes` is true only about 63% of the time. If they only make that raise with 2+ support, it is guaranteed true.

## Local simulator implementation

The local `simulation/` directory contains:

- `liars-dice.mjs`: seeded dice, hand preparation, bid legality, Zhai/Fei transitions, challenge resolution, and complete round play.
- `strategies.mjs`: benchmark strategies and binomial estimates.
- `benchmark.mjs`: seat-swapped pair evaluation and per-strategy statistics.
- `tournament.mjs`: round-robin tournament runner.
- `parameter-search.mjs`: parameter-family exploit search.
- `self-test.mjs`: rule and probability checks.
- `README.md`: assumptions and commands.

The simulator is not imported by the web app and therefore is not included in the production browser bundle.

Current simulator assumptions:

- Opening quantity is exactly three.
- Heuristic bots open normal bids on faces 2–6.
- A 2–6 straight is automatically rerolled; a five-distinct hand containing a one is kept.
- Fei permits a normal bid at any quantity at least double the Zhai quantity.
- Quantities are capped at ten.

The rule self-tests and production site build pass. The project's full lint command reports pre-existing accessibility issues in scaffolded UI components unrelated to the simulator.

## Existing post-opening strategy framework

Except for Random, all current benchmark bots share one heuristic architecture with different parameters:

1. Estimate current-bid truth using the bot's private support plus a binomial model of five unknown opponent dice.
2. Challenge if the estimated false probability exceeds a configurable threshold.
3. Otherwise score every legal raise approximately as:

   `raise score = 2 * P(raise true) - 1 - escalation cost`.

4. Select among near-best raises.
5. Occasionally substitute a low-support bluff raise.

This is not full continuation EV. These bots do not yet update from the complete bid history, model the opponent's response to each raise, or plan multiple actions ahead.

Current benchmark parameters:

| Strategy | Challenge threshold | Opening bluffs | Raise-bluff rate | Character |
|---|---:|---:|---:|---|
| Value-Cautious | 48% false | 0% | 2% | Value-heavy, escalation-averse |
| Probability | 50% false | 0% | 6% | Neutral binomial heuristic |
| Polarized-20 | 50% false | About 20% | 12% | Polarized opening, looser raises |
| Signal-Cautious | 56% false | About 16.5% | 8% | Crudely treats bids as strength signals |
| Aggressive | 68% false | About 22.7% | 24% | Challenges less and raises/bluffs more |
| Random | Random | Random | Random | Random legal play |

The name Signal-Cautious is deliberate: it is not a true Bayesian history model.

## Simulation results

The main tournament used 100,000 paired hand samples per matchup, two seat-swapped games per sample, for three million complete rounds.

| Strategy | Overall pool win rate | Actual opening bluff rate | Challenge accuracy |
|---|---:|---:|---:|
| Value-Cautious | 61.55% | 0% | 50.65% |
| Probability | 60.75% | 0% | 49.50% |
| Signal-Cautious | 58.97% | 16.48% | 48.80% |
| Polarized-20 | 57.02% | 20.02% | 47.41% |
| Aggressive | 51.50% | 22.74% | 44.09% |
| Random | 10.21% | 28.18% | 15.21% |

Important pairwise results:

- Value-Cautious beat Probability 50.67% to 49.33%.
- Value-Cautious beat Polarized-20 54.02% to 45.98%.
- Value-Cautious beat Signal-Cautious 52.06% to 47.94%.
- Value-Cautious beat Aggressive 59.48% to 40.52%.
- The starting player won roughly 52–54% depending on the matchup.

Interpretation: within this shared heuristic family, early value-heavy play beats frequent bluffing. This supports the user's intuition that bluffing may belong later in the auction rather than at the opening bid. It does not prove that zero opening bluffs are optimal.

## Parameterized exploit search

The simulator screened 720 parameter configurations against Value-Cautious, then validated the top eight on an independent larger sample.

The best candidate used approximately:

- Challenge threshold: 48% false.
- Opening bluff rate: 0%.
- Raise-bluff rate: 0%.
- Lower escalation penalty, allowing stronger credible raises.

It beat Value-Cautious about 52.4% to 47.6% after seat swapping. In separate 200,000-game matchups it scored:

| Opponent | Candidate win rate |
|---|---:|
| Value-Cautious | 52.40% |
| Probability | 53.06% |
| Signal-Cautious | 53.85% |
| Polarized-20 | 55.99% |
| Aggressive | 61.39% |
| Random | 91.88% |

This establishes that the original tournament leader was exploitable within the tested parameter family. The new candidate is still not GTO and should itself be attacked by a best-response learner.

## Recommended equilibrium path

1. Freeze the precise rules and information visibility.
2. Keep the shared headless rules engine as the source of truth.
3. Represent private hands by the 252 canonical sorted hands with correct multinomial chance weights.
4. Define an information set by player, private canonical hand, starting position, and complete public bid history.
5. Use external-sampling MCCFR or another CFR variant for the two-player zero-sum round.
6. Begin with an action abstraction if the full bidding tree is too large, but explicitly measure the abstraction's limitations.
7. Train both positions through self-play and retain the average strategy, not only the final iterate.
8. Freeze the candidate and train a separate best response against it.
9. Report exploitability/NashConv as the primary convergence metric; use tournament win rates only as secondary evidence.
10. Export the trained compact policy to the browser app. Keep the trainer and million-round simulator offline.

Potential action abstraction for a first credible solver:

- Challenge.
- Every legal same-quantity higher-face bid.
- Every legal quantity-plus-one bid.
- The exact required Fei transition from Zhai.
- Add larger jumps later and measure whether they improve best-response value.

## Questions Astra should answer

1. Given the final confirmed rules, what is the smallest information-set and action representation that preserves the important `3 x Sixes` continuation decisions?
2. Is external-sampling MCCFR sufficient here, or would sequence-form linear programming or another solver be more appropriate?
3. Which bid jumps, Zhai transitions, and Fei actions can be safely abstracted without materially distorting exploitability?
4. How should optional reroll decisions and their public/private observability be represented?
5. How should exact chance weighting over the 252 canonical hands be implemented?
6. What convergence and exploitability tests are credible for this game size?
7. Does an equilibrium plausibly contain very little opening bluffing, with bluff mass shifted toward later bids, or is the current result merely an artifact of the shared heuristic continuation model?
8. How should a compact browser policy handle unseen histories created by action abstraction or finite training?

## Desired output from Astra

Produce:

1. A critique of the current simulator assumptions and heuristic scoring.
2. A precise equilibrium-solving design.
3. The proposed game-state, information-set, and action encodings.
4. CFR/MCCFR update equations or pseudocode appropriate to this game.
5. A validation plan using trained best responses and confidence intervals.
6. Any necessary rule questions before implementation.
7. A recommendation on whether to solve the full game immediately or begin with a restricted `3 x Sixes` subgame.
