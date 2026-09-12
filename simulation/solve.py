#!/usr/bin/env python3
"""
Solve the KTV Liar's Dice auction with CFR+ and write the average policy in the
format `simulation/build-gto-policy.mjs` already consumes.

    python simulation/solve.py --iters 800
    node simulation/build-gto-policy.mjs simulation/solves/cfr-average-policy.json

or both at once:  npm run gto:rebuild

WHY THIS FILE EXISTS
--------------------
The policy shipped at `app/gto-policy.json` was solved outside this repo. Its state
list is wrong in two directions: it is missing `Q2_F1_ZHAI` and `Q2_F2_ZHAI` (two
openings the solver itself makes), and it contains five `Q*_F1_WILD` states for a
bid the rules do not allow, since a bid on ones is always zhai. This solver
enumerates the reachable states from the rules instead of hand-listing them, so
neither mistake can recur. See GTO_TAB_SPEC.md and HANDOFF.md.

THE RULES SOLVED HERE
---------------------
Mirrored from `bidIsLegal` in app/page.tsx, which is the live game:

  * five dice each, ten in play;
  * on a wild bid, ones count as the named face; on a zhai bid they do not;
  * a bid on ones is always zhai;
  * faces rank 2 < 3 < 4 < 5 < 6 < 1;
  * a raise is a higher quantity, or the same quantity on a higher face;
  * leaving zhai for a wild bid (fei) needs at least double the quantity;
  * entering zhai from a wild bid is an ordinary raise and costs nothing extra;
  * openings: at least 3 wild, 2 zhai, or 2 ones;
  * quantity is capped at the ten dice in play.

WHAT IS STILL ABSTRACTED AWAY  (unchanged from the old solve, by design)
-----------------------------------------------------------------------
1. NO BID HISTORY. An information set is (your hand, the bid you face). Two
   auctions that arrive at 5 x fives by different routes are treated as one spot.
   This is baked into the shipped file format -- `states` IS the current bid --
   so removing it means redesigning the Solver tab, not just re-solving.
2. NO SEAT. Dropping history also drops whose turn it is, so one policy serves
   both seats. This is a fix, not a loss: the old file exported seat P0 only.
3. NO STRAIGHT RE-ROLL by default. See --reroll below.
4. Each round is scored +1 / -1. Match score and the loss counter are ignored.

Exploitability is NOT measured here. To compare a new solve against the current
one under the real, unabstracted rules, use the JS harness: `npm run simulate`.
"""

from __future__ import annotations

import argparse
import itertools
import json
import os
import sys
import time
from collections import Counter

try:
    import numpy as np
except ImportError:  # pragma: no cover
    sys.exit("numpy is required:  pip install numpy")

FACE_ORDER = [2, 3, 4, 5, 6, 1]          # lowest to highest
TOTAL_DICE = 10
OPENING_FLOOR = {"wild": 3, "zhai": 2, "ones": 2}


def rank(face: int) -> int:
    return FACE_ORDER.index(face)


def opening_floor(face: int, zhai: bool) -> int:
    if face == 1:
        return OPENING_FLOOR["ones"]
    return OPENING_FLOOR["zhai"] if zhai else OPENING_FLOOR["wild"]


def is_legal(current, nxt, max_quantity: int) -> bool:
    """Mirrors bidIsLegal() in app/page.tsx."""
    q, f, z = nxt
    if q < 1 or q > max_quantity:
        return False
    if f == 1 and not z:
        return False                      # a bid on ones is always zhai
    if current is None:
        return q >= opening_floor(f, z)
    cq, cf, cz = current
    if cz and not z:                      # fei: breaking zhai
        return q >= cq * 2
    return q > cq or (q == cq and rank(f) > rank(cf))


# --------------------------------------------------------------------------- #
# Hands
# --------------------------------------------------------------------------- #

def all_hands():
    """The 252 sorted five-dice hands, each as a digit string, with its chance weight."""
    hands, weights = [], []
    for combo in itertools.combinations_with_replacement(range(1, 7), 5):
        counts = Counter(combo)
        perms = 120
        for n in counts.values():
            for i in range(2, n + 1):
                perms //= i
        hands.append("".join(str(d) for d in combo))
        weights.append(perms / 7776.0)
    return hands, np.array(weights, dtype=np.float64)


def apply_reroll(hands, weights, mode: str) -> np.ndarray:
    """Fold a one-off straight re-roll into the prior over hands.

    none    the shipped solve's assumption: nobody re-rolls.
    no-one  a 2-6 straight is re-rolled once; a five-face hand holding a 1 is kept.
            This is the table rule as written in simulation/README.md.
    all     any five distinct faces is re-rolled once.

    The re-rolled hand is kept whatever it turns out to be, including another straight.
    """
    if mode == "none":
        return weights
    w = weights.copy()
    moved = 0.0
    for i, hand in enumerate(hands):
        distinct = len(set(hand)) == 5
        if not distinct:
            continue
        if mode == "no-one" and "1" in hand:
            continue
        moved += w[i]
        w[i] = 0.0
    w += moved * weights            # the second roll is the raw prior again
    return w


# --------------------------------------------------------------------------- #
# Bids and the state graph
# --------------------------------------------------------------------------- #

def build_states(max_quantity: int):
    """Every bid reachable from a legal opening, in an order where a raise always
    points forward. Returns (bids, children, opening_children)."""
    every = []
    for q in range(1, max_quantity + 1):
        for f in range(1, 7):
            if f == 1:
                every.append((q, f, True))
            else:
                every.append((q, f, False))
                every.append((q, f, True))

    reachable = {b for b in every if is_legal(None, b, max_quantity)}
    frontier = list(reachable)
    while frontier:
        current = frontier.pop()
        for candidate in every:
            if candidate not in reachable and is_legal(current, candidate, max_quantity):
                reachable.add(candidate)
                frontier.append(candidate)

    # A legal raise strictly increases (quantity, face rank), including fei, so this
    # sort is a topological order of the bid graph.
    bids = sorted(reachable, key=lambda b: (b[0], rank(b[1]), b[2]))
    index = {b: i for i, b in enumerate(bids)}
    children = [[index[c] for c in bids if is_legal(b, c, max_quantity)] for b in bids]
    opening = [index[b] for b in bids if is_legal(None, b, max_quantity)]
    for i, kids in enumerate(children):
        assert all(k > i for k in kids), "bid order is not topological"
    return bids, children, opening


def support_matrix(hands, bids) -> np.ndarray:
    """sup[h][b] = how many dice hand h contributes towards bid b."""
    sup = np.zeros((len(hands), len(bids)), dtype=np.int16)
    for h, hand in enumerate(hands):
        counts = Counter(hand)
        ones = counts["1"]
        for b, (_, face, zhai) in enumerate(bids):
            named = counts[str(face)]
            sup[h, b] = named if (zhai or face == 1) else named + ones
    return sup


def state_name(bid) -> str:
    q, f, z = bid
    return f"Q{q}_F{f}_{'ZHAI' if z else 'WILD'}"


def action_name(bid) -> str:
    q, f, z = bid
    return f"BID_Q{q}_F{f}_ZHAI" if z else f"BID_Q{q}_F{f}"


# --------------------------------------------------------------------------- #
# CFR+
# --------------------------------------------------------------------------- #

def normalise_rows(rows: np.ndarray) -> np.ndarray:
    total = rows.sum(axis=1, keepdims=True)
    n = rows.shape[1]
    return np.where(total > 0, rows / np.maximum(total, 1e-300), 1.0 / n)


def regret_match(regret: np.ndarray) -> np.ndarray:
    positive = np.maximum(regret, 0.0)
    total = positive.sum(axis=1, keepdims=True)
    n = regret.shape[1]
    return np.where(total > 0, positive / np.maximum(total, 1e-300), 1.0 / n)


def solve(iters: int, max_quantity: int, reroll: str, report_every: int):
    hands, raw_weights = all_hands()
    weights = apply_reroll(hands, raw_weights, reroll)
    weights = weights / weights.sum()
    n_hands = len(hands)

    bids, children, opening = build_states(max_quantity)
    n_states = len(bids)
    sup = support_matrix(hands, bids)

    print(f"{n_hands} hands - {n_states} bid states + 1 opening - "
          f"{sum(len(c) for c in children) + len(opening)} edges", flush=True)

    # Challenge payoff. call_u[s][i][j] = +1 if the actor, holding i, is right to
    # challenge bid s against opponent hand j.
    call_u = []
    for s, (q, _, _) in enumerate(bids):
        total = sup[:, s][:, None] + sup[:, s][None, :]
        call_u.append(np.where(total < q, 1.0, -1.0))

    # Actions: index 0 is CALL at a bid state; the opening state cannot call.
    regret = [np.zeros((n_hands, 1 + len(children[s]))) for s in range(n_states)]
    average = [np.zeros((n_hands, 1 + len(children[s]))) for s in range(n_states)]
    open_regret = np.zeros((n_hands, len(opening)))
    open_average = np.zeros((n_hands, len(opening)))

    # value[s][i][j]: what the player to act at s, holding i, expects against j.
    value = [np.zeros((n_hands, n_hands)) for _ in range(n_states)]
    value_t = [np.zeros((n_hands, n_hands)) for _ in range(n_states)]

    started = time.time()
    previous = None
    for t in range(1, iters + 1):
        sigma = [regret_match(r) for r in regret]
        open_sigma = regret_match(open_regret)

        # ---- forward: counterfactual reach of each role at each state ---------
        reach_actor = np.zeros((n_states, n_hands))
        reach_bidder = np.zeros((n_states, n_hands))
        for k, s in enumerate(opening):
            reach_actor[s] += 1.0                      # the responder has not acted
            reach_bidder[s] += open_sigma[:, k]
        for s in range(n_states):
            if reach_actor[s].max() == 0.0 and reach_bidder[s].max() == 0.0:
                continue
            for k, child in enumerate(children[s]):
                reach_actor[child] += reach_bidder[s]
                reach_bidder[child] += reach_actor[s] * sigma[s][:, k + 1]

        # ---- backward: values, then regrets at the same state -----------------
        for s in range(n_states - 1, -1, -1):
            acc = sigma[s][:, 0:1] * call_u[s]
            for k, child in enumerate(children[s]):
                # after bidding, the roles swap: their value is minus ours
                acc -= sigma[s][:, k + 1:k + 2] * value_t[child]
            value[s] = acc
            value_t[s] = np.ascontiguousarray(acc.T)

            omega = reach_bidder[s] * weights           # the opponent's reach here
            if omega.max() > 0.0:
                baseline = acc @ omega
                inst = np.empty_like(regret[s])
                inst[:, 0] = call_u[s] @ omega - baseline
                for k, child in enumerate(children[s]):
                    inst[:, k + 1] = -(value_t[child] @ omega) - baseline
                regret[s] = np.maximum(regret[s] + inst, 0.0)      # CFR+
                average[s] += t * (reach_actor[s] * weights)[:, None] * sigma[s]

        # ---- the opening decision --------------------------------------------
        open_vals = np.empty((n_hands, len(opening)))
        for k, child in enumerate(opening):
            open_vals[:, k] = -(value_t[child] @ weights)
        open_base = (open_vals * open_sigma).sum(axis=1)
        open_regret = np.maximum(open_regret + open_vals - open_base[:, None], 0.0)
        open_average += t * weights[:, None] * open_sigma

        if report_every and (t % report_every == 0 or t == iters):
            # How much the answer is still moving. This is the number to watch: when
            # mean drift stops falling, more iterations are not buying accuracy.
            snapshot = np.concatenate(
                [normalise_rows(a).ravel() for a in [open_average] + average])
            drift = float(np.abs(snapshot - previous).mean()) if previous is not None else float("nan")
            previous = snapshot
            ev = float(open_base @ weights)
            print(f"  iter {t:>5}/{iters}  opener EV {ev:+.4f}  "
                  f"policy drift {drift:.2e}  {time.time() - started:6.1f}s", flush=True)

    return hands, weights, bids, children, opening, average, open_average


# --------------------------------------------------------------------------- #
# Export
# --------------------------------------------------------------------------- #

def export(path, hands, bids, children, opening, average, open_average):
    """Write the intermediate format build-gto-policy.mjs reads:
    keys are P0_<hand>_<state>, values are {action: probability}."""
    out = {}

    # build-gto-policy.mjs drops anything under 0.5%, so tails below 0.01% only bloat
    # the intermediate file. Prune them here and renormalise what is left.
    floor = 1e-4

    def row(key, weights_row, names):
        total = weights_row.sum()
        if total <= 0:
            out[key] = {name: 1.0 / len(names) for name in names}
            return
        share = weights_row / total
        kept = share >= floor
        if not kept.any():
            kept = share == share.max()
        share = share * kept
        share = share / share.sum()
        out[key] = {name: round(float(p), 6) for name, p, k in zip(names, share, kept) if k}

    open_names = [action_name(bids[c]) for c in opening]
    for h, hand in enumerate(hands):
        row(f"P0_{hand}_Q0_F0_WILD", open_average[h], open_names)

    for s, bid in enumerate(bids):
        names = ["CALL"] + [action_name(bids[c]) for c in children[s]]
        state = state_name(bid)
        for h, hand in enumerate(hands):
            row(f"P0_{hand}_{state}", average[s][h], names)

    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(out, handle, separators=(",", ":"))
    return out


def self_check(out, hands, bids, max_quantity):
    """Fail loudly rather than shipping a policy with holes or illegal moves."""
    expected_states = {"Q0_F0_WILD"} | {state_name(b) for b in bids}
    seen_states = {k.split("_", 2)[2] for k in out}
    assert seen_states == expected_states, "state list does not match the rules"
    assert len(out) == len(hands) * len(expected_states), "missing hand/state rows"
    assert not any(s.endswith("_F1_WILD") for s in seen_states), "wild ones is not a legal bid"
    for key, mix in out.items():
        assert abs(sum(mix.values()) - 1.0) < 1e-4, f"{key} does not sum to 1"
    print(f"self-check passed: {len(expected_states)} states x {len(hands)} hands "
          f"= {len(out)} rows, quantity capped at {max_quantity}")


def main():
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--iters", type=int, default=800,
                        help="CFR+ iterations (default 800; more is closer to equilibrium)")
    parser.add_argument("--max-quantity", type=int, default=TOTAL_DICE,
                        help=f"highest quantity in the action set (default {TOTAL_DICE}; "
                             "the old solve used 7)")
    parser.add_argument("--reroll", choices=["none", "no-one", "all"], default="none",
                        help="fold a straight re-roll into the hand prior (default none)")
    parser.add_argument("--out", default="simulation/solves/cfr-average-policy.json")
    parser.add_argument("--report-every", type=int, default=25)
    args = parser.parse_args()

    if args.reroll != "none":
        print("NOTE: --reroll changes the hand prior, but build-gto-policy.mjs still\n"
              "      computes the shipped `w` weights from the raw multinomial. Update\n"
              "      weightOf() there to match before shipping such a solve.\n")

    result = solve(args.iters, args.max_quantity, args.reroll, args.report_every)
    hands, _weights, bids, children, opening, average, open_average = result
    out = export(args.out, hands, bids, children, opening, average, open_average)
    self_check(out, hands, bids, args.max_quantity)
    size = os.path.getsize(args.out) / 1024 / 1024
    print(f"wrote {args.out}  ({size:.2f} MB)")
    print(f"next:  node simulation/build-gto-policy.mjs {args.out}")


if __name__ == "__main__":
    main()
