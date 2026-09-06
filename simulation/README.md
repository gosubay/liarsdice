# Liar's Dice strategy simulator

This headless simulator is deliberately separate from the browser bundle. It uses seeded randomness, swaps the starting player for every sampled hand pair, and reports both matchup and aggregate results.

Current model assumptions:

- five dice per player;
- ones are wild in normal bids;
- Zhai counts only the named face;
- a bid on ones is always Zhai;
- opening quantity is exactly three;
- the face order is `1 > 6 > 5 > 4 > 3 > 2`;
- leaving Zhai for a normal bid requires at least double the quantity;
- a `2–6` straight is rerolled, while a five-face hand containing a one is kept;
- quantities are capped at the ten dice in play.

Run the checks with `npm run simulate:test`. Run a tournament with `npm run simulate`; add arguments such as `-- --samples=500000 --seed=20260905` for a larger reproducible run.

`npm run simulate:search` screens a family of parameterized strategies against the current tournament leader, then reruns the strongest candidates on a larger independent validation sample. This is an exploit search within that strategy family, not an exact best response.

The included strategies are benchmarks, not claims of Nash equilibrium. A future CFR trainer should use the same rules engine and be evaluated against a separately trained best response.
