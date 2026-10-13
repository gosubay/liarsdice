# HANDOFF — Liar's Dice (大话骰)

Last updated: 2026-10-13 (SGT)

## What this project is

A bilingual (EN/中文) China-KTV-rules Liar's Dice web app. React + Vinext static site,
deployed to Cloudflare via the OpenAI Sites plugin. V1 is one human versus one AI.

- Repo: <https://github.com/gosubay/liarsdice>
- Local: `C:\Claude\Code\Liar's Dice`
- Private deployment: <https://liarsdice.galvin-bay.chatgpt.site>
- Public GitHub Pages: <https://gosubay.github.io/liarsdice/>

## Two build paths — do not confuse them

`vinext build` targets **Cloudflare Workers** and emits no `index.html`, so it cannot
run on GitHub Pages. A second, client-only static build exists purely for Pages:

| Command | Config | Output | Host |
|---|---|---|---|
| `npm run build` | `vite.config.ts` | `dist/` (Worker) | Cloudflare / OpenAI Sites |
| `npm run build:pages` | `vite.static.config.ts` | `dist-pages/` (static) | GitHub Pages |

The static build mounts `app/page.tsx` client-side from `static/main.tsx`, loads Geist
from Google Fonts instead of `next/font`, and sets base `/liarsdice/`. It is deployed
by `.github/workflows/pages.yml` on every push to `main`.

Preview it locally with `npx vite preview --config vite.static.config.ts`, then open
<http://localhost:4173/liarsdice/> — the base path matters.

There is **no separate `index.html` game**. The two-player game built with Codex *is*
`app/page.tsx`; it was pushed as commit `985a03b`.

## Current state

Seven top-level tabs, in this order — the order is a learning path and is deliberate:

1. **Play** — the game, with an Easy / Medium / Hard bot selector and a Start game button.
   Hard plays the CFR-solved policy and beats Easy 76.2% to 23.8% over 200,000
   seat-swapped rounds. Opening bids must be at least 3 wild, 2 zhai, or 2 ones.
   Rounds open with a 1.9 s three.js dice-cup animation — the cup rattles seen
   side-on, lifts away, and the camera swings overhead to leave five dice in a
   quincunx. Both cups are mouth-down and neither ever flips. The AI's cup stays
   down until a call, then plays the same timeline from the lift onwards (1.15 s,
   no second rattle). Sound is synthesised in `app/roll-sound.ts` — no audio files.
   Two player-facing toggles, animation and sound, on the setup card and in the
   game topbar, persisted in `localStorage` via `app/prefs.ts`; three.js is a
   separate 132 KB gzipped chunk fetched only when a roll actually plays.
   The topbar also shows the bot's difficulty, and **New match** goes back to the
   setup card so the difficulty can be re-picked. See `DICE_ANIMATION.md`.

   **Medium** is `app/medium-bot.ts`, a pure heuristic with no policy download — it opens
   `3 × sixes` on every hand, calls on the gap (wild: never below 2, 20% at 2, always from
   3; zhai: always from 2), grinds the safest legal raise while refusing anything past its
   own gap 3, bluff-stretches 12% of raises, and never initiates zhai. That zhai blindness
   is the deliberate hole the player is meant to find. Full rationale, the numbers behind
   the opening, and the verification results are in **`MEDIUM_BOT_SPEC.md`** — that file is
   the authority; change it and the code together.
2. **Rules** — the variant stated in words, mirroring exactly what Play enforces.
3. **Math** — why a wild one doubles your odds, expected counts, and the binomial
   spread as a chart. Every figure is computed live, never hard-coded.
4. **GTO Strategy** — the 20-point cheat sheet, built around the gap rule.
5. **Solver** — the 252-hand range grid, raw solver output. An **Arrange by** control
   above the grid regroups it three ways: **Wild ones** (default), **Shape** (poker
   shapes — quints, quads, full house, trips, two pair, one pair, straight, with the
   shape name ignoring wild ones and the legend saying so), and **Order** (all 252
   ascending, for looking up the hand you actually hold). An **All hands combined** card
   (added 2026-10-13) sits under "Your hand" and lists every legal move with its total
   frequency across all 252 hands for the bid that is set. See `GTO_TAB_SPEC.md`.
6. **Leaderboard** — high scores, with an Easy / Medium / Hard sub-tab each. A run is
   recorded only when the player reaches 100 wins in an **Unlimited** match, at which point
   a modal asks for a name and saves score, win rate and date. Every entry has 100 wins, so
   the ranking is really fewest losses. Stored in `localStorage` under
   `liarsdice.leaderboard` via `app/leaderboard.ts` — local to one browser, never uploaded.
   The board ships seeded with one record (Galvin, 100–100, 8/9/2026) so it is never empty;
   `liarsdice.leaderboard.seeded` stops it coming back if the player clears it.

7. **Cup** — added 2026-10-03. A dice cup for people playing each other in person with
   no dice: everyone opens it on their own phone, shakes, and bids out loud. No bot, no
   bidding, no scoring. Shake keeps the cup down, Lift cup / Cover show and hide the
   dice, and Shake again needs a second tap so a hand cannot be re-rolled by accident.
   Lives in `app/cup.tsx`; **`CUP_TAB_SPEC.md`** is the authority. Sits last because it
   is a utility, not a step on the learning path. On phones the tab bar now wraps onto
   two rows so all seven tabs can be tapped.

See `GTO_TAB_SPEC.md` for the full spec of the first five.

The quincunx is what lets both players sit **side by side on a phone** — they no
longer stack at 640px.

Verified working in the static preview on desktop (1280×900) and mobile (375×812).
`npm run build`, `npx tsc --noEmit`, and `npx oxlint app/gto.tsx app/die.tsx` are clean.
`app/page.tsx` still has two pre-existing a11y lint errors in the rules modal.

## Full screen on phones — added 2026-10-03

A full-screen button sits in the header, left of the language button. Rules:

- **Touch devices only.** Desktop never shows it. It is also hidden once the game has
  been launched from a home-screen icon, because that is already full screen.
- **Android and iPad:** the button hides the browser's bars, and tapping again brings
  them back.
- **iPhone:** Safari refuses that request for anything but video, so the button instead
  shows a one-line how-to — Share, then Add to Home Screen. Launched from that icon the
  game runs full screen. This is an Apple limit, not a bug; do not try to "fix" it.
- The home-screen install is driven by `public/manifest.webmanifest`, the three
  `public/icon-*.png` files (rendered from `favicon.svg` on the page's `#0c0d0d`), and
  the `apple-*` tags. Those tags live in **two** places, one per build path:
  `static/index.html` (Pages) and `metadata` in `app/layout.tsx` (Cloudflare). Change
  both together.
- iPhone status bar style is `black`, so the page starts below the clock. Switching to
  `black-translucent` would slide the page under the notch and needs safe-area padding.
- Logic is in `app/fullscreen.ts`. A refused request logs `[fullscreen] … refused` to
  the browser console.

Verified in the static preview at 375×812 with touch emulation: the button appears, a
tap asks the browser for full screen, the label flips to Exit, the iPhone hint shows,
and nothing overflows sideways. The preview pane itself refuses real full screen, so
the bars actually disappearing has **not** been seen on a physical phone yet.

## Commands

```
npm run dev          # dev server on :3000
npm run build        # production build
npm run gto:build    # regenerate app/gto-policy.json from the raw solve
npm run simulate     # heuristic bot tournament
```

## What the solver actually says

From the shipped policy, weighted by hand frequency:

- Opening bids land on a face the opener holds **none of** 16.8% of the time. The
  earlier heuristic tournaments concluded 0% opening bluffing was best; that was an
  artifact of every bot sharing the same weak continuation logic.
- Opening face choice is polarised: 16.8% zero-support, 20.3% one, 63% two-or-more.
- ~31% of openings are zhai.
- Challenge thresholds are sharp and monotone in support. Facing 6 × sixes wild, the
  challenge rate by matching dice held is 100 / 100 / 95 / 64 / 1 / 1.
- Holding five sixes and facing 3 × sixes, it raises to 4 × sixes only 5.7% of the
  time — it prefers 3 × ones zhai (34%) or 4 × fives (30%). It hides the monster.

## Known gaps in the solve — fix before calling this GTO

The exported policy is a simplified game, not the real one. Items marked **[fixed by
solve.py]** are already handled by the in-repo re-solve; they are still wrong in the
policy currently shipped at `app/gto-policy.json`.

1. No zhai entry from a normal bid (rule 10) and no fei break-out (rule 11). Once the
   auction starts wild it stays wild; once zhai, always zhai. Two half-games.
   Verified: zero mode crossings in 25,749 bid actions. **[fixed by solve.py]**
2. Quantity capped at 7, not the true 10. **[fixed by solve.py, but see below]**
3. No bid history — an information set is only (hand, current bid, mode). This one is
   baked into the shipped file format, where `states` IS the current bid. Removing it
   means redesigning the Solver tab, not just re-solving. **[still abstracted]**
4. Only seat P0 exported. **[fixed by solve.py — dropping history also drops the
   seat, so one policy serves both]**
5. No straight-reroll decision represented. `solve.py --reroll` can fold it into the
   hand prior, but the three places that define it disagree: page.tsx offers the
   button on any five distinct faces, simulation/README.md says a 2-6 straight is
   re-rolled and a five-face hand holding a 1 is kept, and `prepareHand` in
   liars-dice.mjs re-rolls repeatedly until the hand is not a straight. **Pick one
   before solving with it.** **[still open]**
6. Two reachable states are missing and five impossible ones are present. See
   "Defects in the shipped solve" in GTO_TAB_SPEC.md — `Q2_F1_ZHAI` alone is 9.6% of
   rounds, and the `Q*_F1_WILD` states make the Solver tab print illegal advice.
   **[fixed by solve.py]**
7. A round is scored +1 / -1. The match score is ignored, so the policy does not know
   that a round is worth more at 4-4 than at 0-0. **[still abstracted]**
8. Rarely-reached states are the least trustworthy part of any such solve: 21 of the
   94 states occur in under 0.01% of rounds, and CFR gives no guarantee off-path.
   The old solve dodged this by capping quantity at 7. **[inherent]**

## Re-solving

    python simulation\solve.py --config simulation\solve-config.json
    node simulation\build-gto-policy.mjs simulation\solves\cfr-average-policy.json

Settings live in `simulation/solve-config.json` (iterations, save points, output path,
quantity cap, re-roll rule); command-line flags override it, and an unknown key fails
loudly. Ctrl+C once finishes the current iteration and saves; twice quits unsaved.
Checkpoints go to `simulation/solves/checkpoints/` (gitignored).

`simulation/solve.py` is CFR+ over the abstracted auction: 252 hands x 95 states,
3745 edges, numpy, no sampling, about 0.19 s per iteration on this machine. It
self-checks the state list against the rules before writing, in the same intermediate
format the old MCCFR solve used, so `build-gto-policy.mjs` and the app need no change.

`simulation/compare_policies.py A.json B.json` compares two solves exactly: A's
seat-averaged win rate against B, and how differently they play weighted by how often
each spot occurs. Identical files give 50.000% / 0.000%.

The committed `simulation/solves/cfr-average-policy.json` is the 24,000-iteration run.

### How many iterations — measured 2026-09-13

Every checkpoint compared against a 24,000-iteration reference (83 min):

| Iterations | Time | Win rate vs 24k | Plays differently |
|---|---|---|---|
| 250 | 47 s | 49.44% | 29.6% |
| 1,000 | 3 min | 49.96% | 25.4% |
| 3,000 | 9 min | 49.89% | 15.5% |
| 6,000 | 19 min | 49.95% | 11.4% |
| 12,000 | 37 min | 50.02% | 7.5% |
| old shipped MCCFR, 1M samples | overnight | **46.61%** | 53.4% |

Read it this way:

- **Playing strength is settled by ~1,000 iterations.** Past that, no checkpoint is more
  than 0.12 points from the reference — noise.
- **The percentages in the Solver grid keep settling much longer.** The remaining
  differences are mostly the solver shuffling between bids that are worth the same, so
  they do not change results, but they do change the numbers a person reads. Disagreement
  roughly halves each time iterations quadruple.
- **Recommendation: 10,000 (~31 min)** for any policy that ships; an overnight run of
  ~150,000 only if the grid's exact percentages matter.
- The old shipped policy loses 46.6 to 53.4 to the reference. Part of that is its missing
  states being played at random in the comparison (the app falls back to the heuristic
  bot instead), so treat the size of the gap as an upper bound.

Caveat: this measures each run against a longer run, not against a perfect exploiter.
Exact exploitability is not computable in this abstraction, because dropping bid history
breaks perfect recall.

Before shipping a new solve: `QUANTITIES` in app/solver.tsx is `[0, 2, 3, 4, 5, 6, 7]`,
so quantities 8-10 will not be selectable until that list is extended. The built file is
734 KB against today's 578 KB.

## Next steps

1. Decide the straight-reroll rule (gap 5), then re-solve with it.
2. Re-solve and swap the policy in with `npm run gto:rebuild` — the Hard bot picks it
   up with no code change. Two difficulty levels is settled; do not add a third.
3. Then V2 (2-6 players) and V3 (netplay), per `ASTRA_AI_STRATEGY_HANDOFF.md`.

## Open rule questions (unchanged, still blocking a full solve)

- Does fei permit exactly double the zhai quantity, or any quantity at least double?
- On a five-distinct reroll, are all five dice rerolled? Is the reroll public?
- Are opening `3 × ones zhai` and opening explicit zhai bids on 2–6 permitted?
- Is the maximum legal quantity capped at the ten dice in play?
