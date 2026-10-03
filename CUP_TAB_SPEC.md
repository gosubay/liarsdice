# Cup tab — spec

Written 2026-10-03. Source of truth for the seventh tab. If a decision here is changed
in chat, update this file in the same turn.

## What it is for

People playing Liar's Dice against each other **in person** who have no physical dice.
Every player opens the tab on their own phone and uses it as their cup. Bidding,
calling and keeping score all happen out loud at the table, exactly as with real dice.

Decided by Galvin 2026-10-03:

- It only simulates a cup. **No bot, no bidding, no scoring, no rules enforcement.**
- It is not for playing against the computer — that is the Play tab.
- The phones are not connected to each other. That would be netplay (V3), not this.

## Name

**Cup** / **骰盅**. Galvin floated "Live"; "Cup" was chosen because "Live" reads as
online play against other people, which this is not, and V3 netplay will want that word.
The tab key in `TABS` is `cup`. To rename, change `tabCup` in `app/page.tsx` and the
title in `app/cup.tsx`.

## Behaviour

Component: `app/cup.tsx`. It reuses `DiceTray`, so the cup, the dice, the 3D lift and
the sound are the same ones the Play tab uses.

1. **Shake** rolls five dice. The cup rattles and **stays down** — a phone lying on a
   table is visible to everyone, so the dice are never shown without a deliberate tap.
2. **Lift cup** shows the dice. The first lift after a shake plays the 3D lift; later
   lifts in the same round show the dice instantly, since the player is only checking.
3. **Cover** hides them again. The cup does not rattle when it is put back down.
4. **Shake again** needs two taps within 3 seconds (`CONFIRM_MS`). The first tap turns
   the button red and says "Tap again to re-roll". This stops a stray thumb destroying
   a hand mid-round. The very first shake needs only one tap.

The straight re-roll is not built in: a player who is allowed to re-roll just shakes
again. Whether a straight may be re-rolled is still an open rule question in HANDOFF.md.

The animation and sound toggles are the same stored preferences as the Play tab.
Each shake is `Math.random()` on the player's own device; nothing is stored or sent.

## Debugging

`.cup-card` carries `data-state` (`idle` / `covered` / `lifted`) and `data-shakes`
(count of rolls this visit), so the state can be read from the page without a screenshot.

## Phone layout

Seven tabs do not fit one row at phone width, so below 700px the tab bar wraps onto two
rows. Before this the last tabs ran off the right edge and could not be tapped.
