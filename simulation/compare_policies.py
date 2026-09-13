#!/usr/bin/env python3
"""
Compare two solved policies exactly, with no sampling.

    python simulation/compare_policies.py A.json B.json

Both files use the intermediate format solve.py writes (P0_<hand>_<state> keys).

It prints two numbers:

  head-to-head   A's win rate against B, averaged over both seats, computed exactly
                 over every hand pair and every auction. 50.00% means A and B are
                 equally good against each other.
  disagreement   how differently A and B play, weighted by how often each spot
                 actually comes up when B plays itself. 0% is identical play.

Use it to decide how many iterations are enough: compare a shorter run against a
much longer one. When the shorter run wins 50.00% and barely disagrees, the extra
iterations bought nothing you could feel at the table.

Limits: this measures A against B, not against a perfect exploiter, and it plays
both inside the same abstraction solve.py uses (no bid history). A state missing
from a file, or a spot where a file gives no legal move, is played uniformly at
random over the legal moves; the count of such spots is printed, because it makes
that file look worse than the app would, which falls back to its heuristic bot.
"""

from __future__ import annotations

import importlib.util
import json
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location("solve", os.path.join(HERE, "solve.py"))
solve = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(solve)


def canonical(action: str) -> str:
    """Treat a wild bid on ones as the zhai bid on ones, as the app does."""
    if action.startswith("BID_") and "_F1" in action and not action.endswith("_ZHAI"):
        return action + "_ZHAI"
    return action


def load(path, hands, bids, children, opening):
    with open(path, encoding="utf-8") as handle:
        raw = json.load(handle)
    filled = 0

    def row_for(key, names):
        nonlocal filled
        entry = raw.get(key)
        probs = np.zeros(len(names))
        if entry:
            lookup = {}
            for action, p in entry.items():
                lookup[canonical(action)] = lookup.get(canonical(action), 0.0) + p
            probs = np.array([lookup.get(n, 0.0) for n in names])
        if probs.sum() <= 0:
            filled += 1
            return np.full(len(names), 1.0 / len(names))
        return probs / probs.sum()

    sigma = []
    for s, bid in enumerate(bids):
        names = ["CALL"] + [solve.action_name(bids[c]) for c in children[s]]
        state = solve.state_name(bid)
        sigma.append(np.array([row_for(f"P0_{h}_{state}", names) for h in hands]))
    open_names = [solve.action_name(bids[c]) for c in opening]
    open_sigma = np.array([row_for(f"P0_{h}_Q0_F0_WILD", open_names) for h in hands])
    return sigma, open_sigma, filled


def actor_values(sigma_a, sigma_b, call_u, children):
    """values_a[s][i][j]: expected result for the player to act at s when that player
    uses policy A (holding i) and the opponent uses B (holding j). values_b likewise."""
    n = len(children)
    va, vb = [None] * n, [None] * n
    for s in range(n - 1, -1, -1):
        acc_a = sigma_a[s][:, 0:1] * call_u[s]
        acc_b = sigma_b[s][:, 0:1] * call_u[s]
        for k, child in enumerate(children[s]):
            acc_a -= sigma_a[s][:, k + 1:k + 2] * vb[child].T
            acc_b -= sigma_b[s][:, k + 1:k + 2] * va[child].T
        va[s], vb[s] = acc_a, acc_b
    return va, vb


def head_to_head(pol_a, pol_b, weights, call_u, children, opening):
    sigma_a, open_a, _ = pol_a
    sigma_b, open_b, _ = pol_b
    va, vb = actor_values(sigma_a, sigma_b, call_u, children)
    a_opens = -sum(weights @ vb[c] @ (open_a[:, k] * weights) for k, c in enumerate(opening))
    b_opens = -sum(weights @ va[c] @ (open_b[:, k] * weights) for k, c in enumerate(opening))
    return (a_opens - b_opens) / 2.0


def visit_mass(pol, weights, children, opening):
    """How often each (state, hand) comes up when this policy plays itself."""
    sigma, open_sigma, _ = pol
    n = len(children)
    joint = [np.zeros((len(weights), len(weights))) for _ in range(n)]
    base = np.outer(weights, weights)
    for k, c in enumerate(opening):
        joint[c] += (base * open_sigma[:, k][:, None]).T
    for s in range(n):
        if not joint[s].any():
            continue
        for k, c in enumerate(children[s]):
            joint[c] += (joint[s] * sigma[s][:, k + 1][:, None]).T
    return [j.sum(axis=1) for j in joint]


def disagreement(pol_a, pol_b, weights, children, opening):
    sigma_a, open_a, _ = pol_a
    sigma_b, open_b, _ = pol_b
    mass = visit_mass(pol_b, weights, children, opening)
    total = weights.sum()
    moved = 0.5 * (np.abs(open_a - open_b).sum(axis=1) @ weights)
    for s in range(len(children)):
        total += mass[s].sum()
        moved += 0.5 * (np.abs(sigma_a[s] - sigma_b[s]).sum(axis=1) @ mass[s])
    return moved / total


def main():
    if len(sys.argv) != 3:
        sys.exit("usage: python simulation/compare_policies.py A.json B.json")
    hands, weights = solve.all_hands()
    weights = weights / weights.sum()
    bids, children, opening = solve.build_states(solve.TOTAL_DICE)
    sup = solve.support_matrix(hands, bids)
    call_u = [np.where(sup[:, s][:, None] + sup[:, s][None, :] < q, 1.0, -1.0)
              for s, (q, _, _) in enumerate(bids)]

    path_a, path_b = sys.argv[1], sys.argv[2]
    pol_a = load(path_a, hands, bids, children, opening)
    pol_b = load(path_b, hands, bids, children, opening)
    for path, pol in ((path_a, pol_a), (path_b, pol_b)):
        if pol[2]:
            print(f"note: {os.path.basename(path)} had no usable answer for {pol[2]} "
                  f"hand/state spots; those are played at random")

    ev = head_to_head(pol_a, pol_b, weights, call_u, children, opening)
    gap = disagreement(pol_a, pol_b, weights, children, opening)
    print(f"A = {path_a}")
    print(f"B = {path_b}")
    print(f"head-to-head  A wins {50 * (1 + ev):.3f}% of rounds against B")
    print(f"disagreement  {100 * gap:.3f}% of decision weight, where it matters")


if __name__ == "__main__":
    main()
