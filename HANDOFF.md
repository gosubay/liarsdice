# HANDOFF — Liar's Dice (大话骰)

Last updated: 2026-09-11 (SGT)

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

Six top-level tabs, in this order — the order is a learning path and is deliberate:

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
   ascending, for looking up the hand you actually hold). See `GTO_TAB_SPEC.md`.
6. **Leaderboard** — high scores, with an Easy / Medium / Hard sub-tab each. A run is
   recorded only when the player reaches 100 wins in an **Unlimited** match, at which point
   a modal asks for a name and saves score, win rate and date. Every entry has 100 wins, so
   the ranking is really fewest losses. Stored in `localStorage` under
   `liarsdice.leaderboard` via `app/leaderboard.ts` — local to one browser, never uploaded.
   The board ships seeded with one record (Galvin, 100–100, 8/9/2026) so it is never empty;
   `liarsdice.leaderboard.seeded` stops it coming back if the player clears it.

See `GTO_TAB_SPEC.md` for the full spec of all five.

The quincunx is what lets both players sit **side by side on a phone** — they no
longer stack at 640px.

Verified working in the static preview on desktop (1280×900) and mobile (375×812).
`npm run build`, `npx tsc --noEmit`, and `npx oxlint app/gto.tsx app/die.tsx` are clean.
`app/page.tsx` still has two pre-existing a11y lint errors in the rules modal.

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

The exported policy is a simplified game, not the real one:

1. No zhai entry from a normal bid (rule 10) and no fei break-out (rule 11). Once the
   auction starts wild it stays wild; once zhai, always zhai. Two half-games.
2. Quantity capped at 7, not the true 10.
3. No bid history — an information set is only (hand, current bid, mode).
4. Only seat P0 exported.
5. No straight-reroll decision represented.
6. The solver opens `2 × ones` (3.3% of hands) and `2 × twos zhai` (5.2%), but
   neither has a facing-state entry, so the Solver tab greys both out at quantity 2
   and the Hard bot falls back to the heuristic when it faces them. The export has
   65 states; those two would make 67.

## Next steps

1. Re-solve with zhai entry, fei, and quantity to 10 in the action set. Keep the same
   export format so the UI needs no change — just re-run `npm run gto:build`.
2. Re-solve, then swap the policy in with `npm run gto:build` — the Hard bot picks it
   up with no code change. Two difficulty levels is settled; do not add a third.
3. Then V2 (2–6 players) and V3 (netplay), per `ASTRA_AI_STRATEGY_HANDOFF.md`.

## Open rule questions (unchanged, still blocking a full solve)

- Does fei permit exactly double the zhai quantity, or any quantity at least double?
- On a five-distinct reroll, are all five dice rerolled? Is the reroll public?
- Are opening `3 × ones zhai` and opening explicit zhai bids on 2–6 permitted?
- Is the maximum legal quantity capped at the ten dice in play?
