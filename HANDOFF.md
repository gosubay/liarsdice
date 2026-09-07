# HANDOFF — Liar's Dice (大话骰)

Last updated: 2026-09-07 (SGT)

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

Five top-level tabs, in this order — the order is a learning path and is deliberate:

1. **Play** — the game, with an Easy / Hard bot selector and a Start game button.
   Hard plays the CFR-solved policy and beats Easy 76.2% to 23.8% over 200,000
   seat-swapped rounds. Opening bids must be at least 3 wild, 2 zhai, or 2 ones.
   Rounds open with a 1.41 s dice-cup animation — both cups rattle, yours opens,
   the AI's stays down until a call. CSS 3D, no library. See `DICE_ANIMATION.md`.
2. **Rules** — the variant stated in words, mirroring exactly what Play enforces.
3. **Math** — why a wild one doubles your odds, expected counts, and the binomial
   spread as a chart. Every figure is computed live, never hard-coded.
4. **GTO Strategy** — the 20-point cheat sheet, built around the gap rule.
5. **Solver** — the 252-hand range grid, raw solver output.

See `GTO_TAB_SPEC.md` for the full spec of all five.

Verified working in the dev server on desktop (1280×900) and mobile (375×812).
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
6. `2 × ones` can be opened but has no facing-state entry.

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
