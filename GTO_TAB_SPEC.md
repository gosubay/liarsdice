# GTO Strategy tab — spec

Written 2026-09-07. This file is the source of truth for the strategy explorer.
If a decision here is changed in chat, update this file in the same turn.

## What the tab is

A second top-level tab (`Play` / `GTO Strategy`) that lets the user browse a solved
Liar's Dice strategy: for any bid an opponent could have just made, what to do with
each of the 252 possible five-dice hands.

## Data

- Source: MCCFR average policy solved by Gemini 3.1 Pro, kept at
  `simulation/solves/mccfr-average-policy.json` (4.07 MB).
- Shipped file: `app/gto-policy.json` (~578 KB raw, ~94 KB gzipped), imported with
  `?url` and fetched at runtime so it stays out of the initial JS bundle.
- Regenerate with `npm run gto:build` (`simulation/build-gto-policy.mjs`).
  Never hand-edit `app/gto-policy.json`.

Format:

```
{
  acts:   string[]            // action names, e.g. "CALL", "BID_Q4_F6", "BID_Q3_F5_ZHAI"
  hands:  string[]            // 252 hands as sorted digit strings, in DISPLAY ORDER
  w:      number[]            // chance weight of each hand as a percentage (sums to 100)
  states: string[]            // 65 public states, e.g. "Q3_F6_WILD", "Q0_F0_WILD"
  d:      { [hand]: { [state]: [actionIndex, probabilityPerMille][] } }
}
```

- Probabilities are per-mille integers. Anything below 0.5% is dropped at build time.
- `Q0_F0_WILD` is the opening decision (nobody has bid).

## Hand ordering — do not change casually

The grid is the product's main idea, and its ordering is load-bearing:

1. **Rows group by number of wild ones**, 0 through 5. Row sizes are
   126 / 70 / 35 / 15 / 5 / 1, drawn as a ragged pyramid.
2. **Within a row, sort lexicographically descending on the face-count vector,
   sixes first.** So `66666` is top-left of the first band and `22222` is bottom-right —
   the same "strong in the corner, weak away from it" read as a poker preflop chart.
3. Rows wrap at **14 columns**.

## Colour coding

Each cell is a split bar showing the action mix for that hand in the selected state:

| Colour | Hex | Meaning |
|---|---|---|
| Red | `#e94a3c` | Challenge (开) |
| Jade | `#4f9a7d` | Raise onto a face the player holds at least one of |
| Amber | `#d9a441` | Raise onto a face the player holds none of |

Amber covers both bluffs and deliberate disguise plays (e.g. five sixes raising onto
fives), so the label is "raise onto a face you hold none of", never "bluff".

## Controls

Header reads **Current bid**, then in order:

1. `Nothing (You open)` / `2` / `3` / `4` / `5` / `6` / `7`
2. **Dice face** — actual pip dice for 1–6, using the shared `Die` component
3. **Bid type** — `Wild 万能` / `Zhai 斋`
4. **You are facing:** a plain readout, e.g. `3 × fives`

Bids the solve has no answer for are greyed out and unclickable. Quantity 2 exists
only as a zhai bid, so picking 2 forces Zhai. A bid on ones is always zhai.

## Known limits of the current solve

State these in the UI; do not call this GTO without qualification.

- Bid history is folded into just the current bid — no memory of the auction.
- Quantity capped at 7, not the true 10.
- No zhai entry from a normal bid (rule 10) and no fei break-out (rule 11).
- Only the first seat (P0) is exported.
- `2 × ones` can be opened by the policy but has no facing-state entry.

## Bilingual

Every string lives in `gtoCopy` in `app/gto.tsx`, keyed `en` / `zh`. The tab follows
the app-wide language toggle; never show both languages at once.
