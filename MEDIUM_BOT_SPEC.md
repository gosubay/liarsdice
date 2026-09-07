# Medium bot — "the house game"

Status: **implemented 2026-09-08** in `app/medium-bot.ts`. Every open question was settled by
Galvin on that date; the decision log is below. The code follows this file verbatim — change
both together or neither.

Ladder after this lands: 1 Easy (random) → 2 Medium (this) → 3 Hard (CFR policy).

## Decision log — settled 2026-09-08

| Question | Decision |
|---|---|
| Opening variety | **Pure `3 × sixes` every hand.** Polarisation and value-raising both rejected. |
| Wild gap-2 call rate | **20%** — suspicious, affordable. Down from the 50% first proposed. |
| Wild gap-3 call rate | **100% — always.** |
| Zhai | **Never initiate, respond only.** |
| Raise style | **Minimum-gap grinder**, hard refusal past gap 3. |
| Bluff-raise rate | **12%.** |
| Match point (4 losses) | **No change in play.** |
| Memory / adaptation | **None.** Every round played fresh. |
| Short rounds from always-calling | **Accept, but measure bids-per-round before shipping.** |
| Straight re-roll | **Only when the straight holds no wild one.** |
| Target strength | **A player who has read the Strategy tab should win ~60%.** |

## Where it comes from

Galvin's own table strategy, stated 2026-09-08:

> Play 3 Sixes a lot. Don't really play zhai at all. Polarize between 0 sixes and 2+
> sixes. Call 3 Fives or 3 Fours to balance.

This spec keeps that shape and closes the holes in it. Two changes of substance:

1. **The 3 × fours / 3 × fives openings are not a coin flip — they are where the
   exactly-one-six hands go.** Giving the variety a rule instead of a whim lifts
   P(3 × sixes is true) from 70.1% to 78.0%, because the weakest sixes hands
   (one support, true only 53.9%) stop being announced as sixes.
2. **The stated strategy is only an opening.** Most turns are responses. The response
   tree below is the bulk of the bot and is built on the gap rule the app already teaches.

## Definitions

- `support(f)` for a **wild** bid on face 2–6 = `count(f) + count(1)`.
- `support(f)` for a **zhai** bid, or any bid on ones = `count(f)`.
- `gap` = `bid.quantity − support(bid.face)`. It is how many the *opponent* must be holding.

`s6` below always means wild support for sixes.

## 1. Opening (no bid on the table)

Open **`3 × sixes`. Every hand, no exceptions.** Never zhai, never on ones, never a quantity
other than three. There is no branch here and no randomiser.

The justification is below and in Appendix A. In short: it is a pooling bid, so it leaks no
information at all; it hands the opponent exactly one free rung where every other opening
hands over three to nine; and the one counter that does exist costs 3.8 points of win rate
against *any* quantity-3 opening, so there is nothing cheaper to switch to.

### Two refinements, considered and rejected

Both were on the table and both were cut. Recorded so they are not re-proposed:

- **Polarise** — open `3 × fours/fives` on exactly-one-six hands. Would cut the counter from
  3.8 to 2.5 points and collapse the one-six caller's decision from 46% to 19.6%
  (Appendix A). Rejected: pays 3–5 free rungs on a third of hands for a gain that is
  near-neutral on paper. The ablation in §7 still measures it; if it wins clearly, raise it
  with Galvin rather than shipping it silently.
- **Value-raise** — `4 × sixes` holding 3+ sixes. Rejected: the shipped solver hides monsters
  (holding five sixes and facing `3 × sixes` it raises to `4 × sixes` only 5.7% of the time),
  which is evidence this game rewards concealment over announcing strength.

**Known consequence: Medium opens with the identical bid every round.** This is correct play
and an accepted cost. If it reads as broken once it is playable, the cheapest fix is turning
polarisation back on, not inventing new openings.

### Why always sixes: the free-rung count

The opening face decides how many raises the opponent gets **without paying a quantity**.
Same-quantity raises legal from each quantity-3 wild opening, per `bidIsLegal` in
`app/page.tsx:132` and the face order `1 > 6 > 5 > 4 > 3 > 2`:

| Opening | Free rungs handed over | They are |
|---|---:|---|
| `3 × twos` | 9 | 3×threes/fours/fives/sixes, wild and zhai, plus 3×ones |
| `3 × threes` | 7 | fours/fives/sixes wild and zhai, plus 3×ones |
| `3 × fours` | 5 | fives/sixes wild and zhai, plus 3×ones |
| `3 × fives` | 3 | 3×sixes wild, 3×sixes zhai, 3×ones |
| **`3 × sixes`** | **1** | `3 × ones` zhai, and nothing else |

From `3 × sixes` the opponent must challenge, play `3 × ones` zhai, or move to quantity 4.
That is the whole menu. No other quantity-3 opening comes close, and it is the real reason
the bid works — not its truth probability.

### Can a human hard-counter `3 x sixes` by calling? — worked through

Galvin's objection, 2026-09-08. Answer: there is a real counter, it is worth about
**3.8 percentage points of win rate**, and **no other opening avoids it**.

Blind-calling every `3 x sixes` loses. The bid is true 70.1% of the time, so calling it on
sight is a 70/30 loser. The only profitable call is conditional on the caller's own hand:

| Caller's six support | Share of hands | P(bid true) | Calling wins | Verdict |
|---:|---:|---:|---:|---|
| 0 | 13.2% | 21.0% | **79.0%** | call |
| 1 | 32.9% | 53.9% | 46.1% | do not |
| 2 | 32.9% | 86.8% | 13.2% | do not |
| 3+ | 21.0% | 100% | 0% | never |

So the counter fires on **13.2% of the opponent's hands** and is worth
`0.132 x 0.580 = +0.076` round-equity, or 3.8 points of win rate.

**It is not a sixes problem.** Truth probability at a quantity-3 wild opening depends only on
the quantity and the mode, never on the face. The same gap-3 call exists against
`3 x fives`, `3 x fours`, `3 x twos` — identically, to the decimal — while those openings
hand over 3, 5 and 9 free rungs instead of 1. There is nothing to dodge to.

Nor can it be dodged by moving the opening elsewhere:

| Alternative opening | Share of caller hands that can profitably call | Their win rate |
|---|---:|---:|
| `3 x sixes` wild | 13.2% | 79% |
| `4 x sixes` wild | 13.2% | 95% |
| `2 x sixes` zhai | 40.2% | 80% |

Raising the quantity makes the call better for them. A zhai opening triples how often they
hold the calling hand, because zhai support is `count(f)` with no wild ones.

**The only real defence is the polarisation in the table above**, and it is partial. Removing
the one-support hands lifts the sixes range's conditional to 31.3% true, so the gap-3 call
drops from 79% to 68.7% and the exploit from 3.8 to **2.5 points**. That gain is bought by
opening a third of hands on a lower face and handing over 3-5 free rungs instead of 1.
Whether that trade is positive is genuinely unclear on paper — settle it in the simulator
(§7) by running Medium with the `s6 = 1` row on and off.

**For a level-2 bot this is a feature, not a bug.** The counter is exactly the gap rule the
Strategy tab teaches, it is discoverable by a beginner, and it stops working against Hard,
whose opening range is properly polarised and mixed. See §5.

### Mix on the bid, play pure on the challenge

The unifying rule for this bot, and the answer to "why does GTO mix at gap 3":

- **Challenging** is driven by gap, which is computed from Medium's own hidden dice. The
  opponent cannot observe the input, so a pure threshold is nearly free. See §2.
- **Bidding** is observed directly. A pure bidding rule *is* readable, so the frequencies in
  the table above are real mixes and must stay mixed.

### Zhai openings — why there are none

Every zhai opening is worse than `3 × sixes` on both axes. Truth probability, opened blind:

| Opening | P(true) |
|---|---:|
| `3 × sixes` wild | **70.1%** |
| `2 × ones` zhai | 51.5% |
| `2 × sixes` zhai | 51.5% |
| `3 × ones` zhai | 22.2% |

`3 × ones` clears 60% only when Medium already holds two ones (16% of hands), which is still
below the sixes bid. And none of them constrain the opponent the way the free-rung table
does. Galvin's "I don't really play zhai" is correct at the opening; the cost of the habit is
paid later in the round, not here.

## 2. Facing a bid — challenge

Revised 2026-09-08 on Galvin's call. Medium plays **pure thresholds, one gap more suspicious
than GTO**. It does not mix where GTO mixes. Rationale in the note below the table.

| gap | Wild GTO | **Wild Medium** | Zhai GTO | **Zhai Medium** |
|---|---|---|---|---|
| 0–1 | 0% | **0% — never** | 0% | **0% — never** |
| 2 | 5% | **20%** | 50% | **100% — always** |
| 3 | 43% | **100% — always** | 95% | **100% — always** |
| 4 | 91% | **100% — always** | 99% | **100% — always** |
| 5+ | 100% | **100% — always** | 99% | **100% — always** |

Galvin's original proposal was a 50/50 coin flip at wild gap 2. That one number is the
expensive part and was cut to 20%: at wild gap 2 the opponent needs 2+ from five dice, which
is 53.9% before you account for the fact that they *chose* to bid that face — call it ~70%
true in practice. Calling there is roughly −0.4 round-equity each time, and gap-2 spots are
common. Wild gap 3 is the opposite: ~35–40% true against an opponent who bids faces they
hold, so calling is **+0.24** and beats raising into gap 4. Always-call at gap 3 is not a
concession, it is probably an improvement against human opponents.

**Why pure thresholds are safe here.** Gap is computed from Medium's own hidden dice, so the
opponent can never see which gap Medium is in and cannot target it. Mixing at an
indifference point exists to deny an opponent who can observe the input; here they cannot.
The residual exploit is blunt rather than surgical — *bid true and let it call you* — which
is exactly the lesson a level-2 bot should teach.

Consequence to watch: always-calling from gap 3 ends rounds early. Track bids-per-round in
the simulator; if rounds feel abrupt, the fix is the bluff valve in §3, not this table.

## 3. Facing a bid — how to raise

Enumerate every legal raise, then:

1. **Drop any raise that enters zhai from a wild bid.** Medium never initiates zhai (rule 10
   is left on the table). This is the deliberate hole.
2. **Drop any raise whose resulting gap ≥ 4.** Never talk yourself into a bid you cannot hold.
3. Score the survivors: `score = gap + 0.5 × (quantity steps beyond +1)`. Lower is better.
   Tie-break on smaller quantity, then on the face nearer the top of the ladder.
4. Mix uniformly among everything within `0.5` of the best score.
5. **Bluff valve, 12%:** instead pick from the band one full point worse than the best.
6. If nothing survives step 2, **challenge** regardless of the table in §2.

### Zhai and fei

Medium never opens zhai and never enters it, but it must answer one.

- Facing a zhai bid it raises *within* zhai by the same rules, in the 1/6 world.
- **Fei** (leave zhai for wild at ≥ 2× the quantity) is included in the enumeration and is
  taken only when the resulting gap is `≤ 3`, which at realistic quantities means it needs
  a genuinely loaded face.

## 4. Straight reroll

Reroll a five-distinct hand **only when it contains no one**. `{2,3,4,5,6}` gives support 1
everywhere and is the worst hand in the game. A five-distinct hand that contains a one gives
support 2 on four different faces and is kept.

(The current bot in `app/page.tsx:174` rerolls any straight 65% of the time. Medium fixes this;
Easy keeps the old behaviour.)

## 4b. What Medium deliberately does not do

- **No memory.** Nothing carries between rounds — no count of how often the player bluffs, no
  read on which faces they open. Every round is played from the dice and the bid on the table
  alone. This keeps Medium a fixed target a player can study and solve, which is the whole
  point of a level-2 bot, and it means any move it makes can be explained from this file.
- **No match-point adjustment.** It plays the same at 0–0 and at 4–4. Every round is worth the
  same one point, so there is no sound reason to change, and a bot that shifts gears is much
  harder to debug when it does something odd.

## 5. How a human beats Medium — the intended learning path

Stated here so the difficulty gradient is deliberate, not accidental:

1. **It never opens zhai**, so the whole game stays in the 1/3 wild world.
2. **It never enters zhai**, so opening zhai yourself traps it: it must fei at double the
   quantity or grind a mode it has no plan for.
3. **It never challenges at gap 2**, so bidding one above your true support is free.
4. **Its opening is unpolarised on the sixes side.** Facing `3 × sixes` holding zero six
   support, challenging wins ~79% — because Medium's sixes range is nearly the whole prior.
   The same challenge against Hard is a coin flip. That contrast is the single best lesson
   in the app and should be called out on the Strategy tab.

## 6. Implementation notes

- New file `app/medium-bot.ts`, pure functions, no React, no policy fetch. Medium must
  **not** pull the 578 KB `gto-policy.json` — it loads instantly.
- `Difficulty` becomes `'easy' | 'medium' | 'hard'`; `DIFFICULTIES` gains `'medium'`;
  the setup card ranks read 1 / 2 / 3; `difficulty-tag` needs a `.medium` colour.
- Copy: EN `Medium` / "Opens on sixes and holds the gap rule — but never plays zhai".
  ZH `中等` / "六点开局、守差额法则，但从不叫斋".
- Medium never goes off-book, so the `wentOffBook` badge stays hidden for it.

## 7. Verification

Galvin called off the tournament, so the bot was verified by direct assertion against this
spec instead. The harness lives in the session scratchpad, not the repo; it bundles
`app/medium-bot.ts` with esbuild and drives it on real random hands using a copy of
`bidIsLegal` from `app/page.tsx`.

Measured 2026-09-08, all passing:

| Check | Result |
|---|---|
| Opening is `3 × sixes`, 20,000 hands | 100% |
| Enters zhai from a wild bid | never, 40,000 decisions |
| Produces an illegal bid | never, 40,000 decisions |
| Bids past its own gap 3 | never, 40,000 decisions |
| Wild call rate at gap 1 / 2 / 3 / 4 | 0.000 / 0.201 / 1.000 / 1.000 |
| Zhai call rate at gap 1 / 2 | 0.000 / 1.000 |
| Bluff-valve share | 0.120 |
| Re-roll `23456` / `12345` / `22456` | yes / no / no |
| Self-play rounds terminating | 5,000 / 5,000 |

**Bids per round: mean 2.36, max 7** (Medium vs Medium, 5,000 rounds). This is the
short-round risk Galvin accepted on condition it was measured. Bot-on-bot is the floor —
both seats open `3 × sixes` and both always call from gap 3 — so a human, who raises more
and calls less, should see longer rounds. Worth re-checking against real play.

**Still not measured:** win rate against Easy and Hard. No tournament was run, so the ladder
bands in earlier drafts of this file are unverified. If Medium turns out to beat Hard, the
first place to look is §4 — Medium re-rolls straights correctly and Hard still does not.

## Appendix A — the numbers behind `3 x sixes`

All ten dice, sixes counting wild ones. `Binomial(10, 1/3)`, mean 3.33.

| Sixes in play | Chance |
|---:|---:|
| 0 | 1.73% |
| 1 | 8.67% |
| 2 | 19.51% |
| **0-2 (bid fails)** | **29.91%** |
| 3 | 26.01% |
| 4 | 22.76% |
| 5 | 13.66% |
| 6 | 5.69% |
| 7+ | 1.97% |
| **3+ (bid holds)** | **70.09%** |

Cross-check: this is the same 70.1% reached in §1 by summing over the opener's own support,
computed a completely different way.

Once the opener looks at their hand it splits:

| Opener's six support | Chance | Bid true |
|---:|---:|---:|
| 0 | 13.17% | 21.0% |
| 1 | 32.92% | 53.9% |
| 2 | 32.92% | 86.8% |
| 3+ | 20.99% | 100% |

Against a rational caller, the opening is challenged on the spot **13.2%** of rounds and
loses there **10.4%** of all rounds. It survives to a raise **86.8%** of the time.

### Does the caller call holding one six?

No. Facing `3 x sixes` holding `k` support:

| Caller's support | vs flat opener | vs polarised opener |
|---:|---|---|
| 0 | call wins 79.0% (**+0.580**) | call wins 68.7% (**+0.374**) |
| 1 | call wins 46.1% (−0.078) | call wins 19.6% (−0.607) |
| 2 | call wins 13.2% (−0.737) | call wins 19.6% (−0.607) |
| 3+ | call wins 0% (−1.000) | never |

Holding one six is gap 2, and it is a losing call even against a flat opener — 46/54, about
−0.08 a round. They should raise instead. This is the wild gap-2 row of the challenge table
in §2 arrived at independently, which is a useful consistency check on the whole model.

Polarisation is what makes that call unambiguous: if the opener never holds exactly one six,
then "at least one" and "at least two" become the same event, so support 1 and support 2
collapse to the same 19.6%. The one-six caller stops being close and starts being obviously
wrong.

