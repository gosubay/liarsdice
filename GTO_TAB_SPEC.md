# Strategy tabs — spec

Written 2026-09-07. This file is the source of truth for the strategy explorer.
If a decision here is changed in chat, update this file in the same turn.

## The five tabs

Order is fixed and deliberate — it reads as a learning path. `TABS` in `app/page.tsx`
drives both the nav and the routing.

| Tab | Component | What it is |
|---|---|---|
| Play | `app/page.tsx` | The game, Easy or Hard bot |
| Rules | `app/rules.tsx` | The variant stated in words. Mirrors what Play enforces |
| Math | `app/math.tsx` | 1/6 vs 1/3, expected counts, the binomial spread |
| GTO Strategy | `app/strategy.tsx` | The 20-point cheat sheet, built on the gap rule |
| Solver | `app/solver.tsx` | The 252-hand range grid — raw solver output |

Every tab is bilingual, keyed `en` / `zh` in a local `copy` object, and follows the
app-wide language toggle. Never show both languages at once.

## What the Solver tab is

For any bid an opponent could have just made, what to do with each of the 252
possible five-dice hands.

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

## Arrangement modes — added 2026-09-11

An **Arrange by** segmented control sits directly above the grid (with the grid, not
with the bid controls, because it changes the grid). Three modes, default **Wild ones**.
Colours, cells and the selection behave identically in all three — only the grouping
and the order change. Rows still wrap at 14 columns everywhere.

| Mode | Grouping | Band order | Why it exists |
|---|---|---|---|
| **Wild ones** (default) | 0–5 wild ones, sizes 126 / 70 / 35 / 15 / 5 / 1 | most wilds last | Position on the grid = strength. The poker-preflop-chart read |
| **Shape** | poker shape of the dice as rolled | strongest shape first | Reveals the solver's bluff and raise patterns across wild-count bands |
| **Order** | one band, all 252 | ascending | Lookup: find the hand you are actually holding |

### Shape mode

The seven shapes partition all 252 hands exactly:

| Shape | Hands |
|---|---|
| Quints `66666` | 6 |
| Quads `14444` | 30 |
| Full house `44466` | 30 |
| Trips `33345` | 60 |
| Two pair `22335` | 60 |
| One pair `24566` | 60 |
| Straight `23456` | 6 |

All six rainbow hands are straights, so there is no high-card bucket.

**Wild ones are deliberately NOT folded into the shape name.** The name describes the
dice as rolled, so `11223` is filed under Two pair even though it plays as four twos.
This was decided 2026-09-11 (option (a) of two): the familiar poker vocabulary is what
makes the mode readable at a glance, and the lie is neutralised two ways —

1. The legend says so in both languages: "The shape name ignores wild ones — 11223 is
   listed as two pair, but it plays as four twos."
2. **Within a band, hands sort by `effectiveTop` descending** — the largest number of a
   single face the hand can actually show with wilds counted in. Ties fall back to the
   policy's own display order, which already puts sixes-heavy hands first. So Two pair
   opens on `11566` (effectively four sixes), and strength still reads left to right.

The rejected alternative was categorising by `effectiveTop` itself (buckets of
26 / 70 / 100 / 55 / 1). More correct, but it is Mode 1 wearing a different hat.

All of this lives in `app/solver.tsx` — `SHAPES`, `SHAPE_BY_SIGNATURE`, `shapeOf`,
`effectiveTop`, and the `bands` memo, which emits `{ key, lead, sub, hands }` for every
mode. The label styling for the two named modes is `.gto-band-label-name` in
`app/globals.css`.

## Colour coding

Colours live in `app/palette.ts`, mirrored as CSS tokens in `app/globals.css`.
Change them in both, and re-run the validator — do not pick one by eye.

Each cell is a split bar showing the action mix, drawn in this order with a 2px gap
between segments so thin slivers stay legible:

| Segment | Token | Colour job |
|---|---|---|
| Challenge | `CHALLENGE` `#e94a3c` | Categorical — its own action |
| Raise, holding **none** of that face | `BLUFF` `#8f7ae0` | Categorical — bluffing is the opposite of value, not a shade of it |
| Raise, holding **one** | `VALUE_THIN` `#12a37a` | Sequential step 1 |
| Raise, holding **two or more** | `VALUE_STRONG` `#63d3ad` | Sequential step 2 |

The two greens are a **sequential ramp**, not two categories: dim to bright reads as
weak to strong, so more green means more dice without consulting the legend. The
categorical lightness-band check does not apply to them.

Wild and zhai series on the Math and GTO Strategy tabs use `WILD` `#12a37a` and
`ZHAI` `#bf8a2a`.

Validated with the dataviz validator against the dark chart surface:

- `#e94a3c, #12a37a, #8f7ae0` passes all five checks under `--pairs all` —
  worst pair 9.0 ΔE deuteranopia, 24.5 ΔE normal vision.
- `#12a37a, #bf8a2a` passes all five — 8.9 ΔE protanopia, 18.0 ΔE normal.
- `VALUE_THIN` → `VALUE_STRONG`: L 0.636 → 0.791, monotonic, contrast 5.7:1 and 10.0:1.

Why not five colours: splitting value further (2 vs 3+) is not a different decision,
and it pushes cells needing three or more raise segments from 21% to 28% in a 48px
cell. Four is the measured sweet spot. Decided 2026-09-07.

Amber `#d9a441` and jade `#4f9a7d` were the previous values. Both failed validation
— the amber too light for the band, the jade below the chroma floor so it read grey —
and the amber sat perceptually between red and green, making a bluff look like a
milder challenge. Do not reintroduce them.

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


## Game rule: opening minimums

The first bid of a round must clear one of three floors, set by `MIN_OPENING` in
`app/page.tsx`:

| Bid type | Minimum quantity |
|---|---|
| Wild, faces 2–6 | 3 |
| Zhai, faces 2–6 | 2 |
| Ones (always zhai) | 2 |

Later bids only have to beat the bid before them, so the floor never binds again.
The bid stepper clamps to the floor rather than letting the player build a bid the
rules will reject, and switching zhai on or off pulls the quantity up if needed.

Every opening the solver can make already clears these floors, so the Hard bot needs
no special handling. Decided 2026-09-07; also stated in `app/rules.tsx`, which must
change in the same commit if this does.

## Bot difficulty (Play tab)

The same policy drives the Hard bot. `app/policy.ts` is the single loader, so the
578 KB bundle is fetched at most once no matter which tab asks for it.

| Level | Name | Behaviour |
|---|---|---|
| 1 | Easy | The original V1 bot: near-random legal bids, challenges on a whim |
| 2 | Hard | Samples the solver's mix for its hand and the bid on the table |

Rules the Hard bot follows:

- Every candidate action is filtered through the live `bidIsLegal` before sampling,
  and the remaining probabilities are renormalised. An abstraction mismatch can
  therefore never produce an illegal bid.
- Spots outside the solve — quantity above 7, or a bid the export never faced —
  return null and fall through to the Easy bot. When that happens the AI's card
  shows an `off-book` tag for the rest of the round.
- Measured over 200,000 seat-swapped rounds: **Hard beats Easy 76.2% to 23.8%**, and
  goes off-book on 0.00% of its decisions when both sides bid sanely. Off-book only
  fires when a human jumps the quantity past 7.

**Two levels only** (decided 2026-09-07). Do not add a third without being asked.
If that changes, `DIFFICULTIES` in `app/page.tsx` drives the selector — add the level
there, add its copy to both language blocks, and give it a branch in the AI effect.
