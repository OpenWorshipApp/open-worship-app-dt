---
name: dom-match-exact-label-beats-everything
description: In domMatch, tier is checkIsBetter's primary key — an exact label on a decoration outranks the real control, so generic one-word titles are a bug
metadata:
  type: project
---

`checkIsBetter` in `tools/owa-devtools-mcp/domMatch.mjs` compares `tier` FIRST;
`isControl`, `isShown`, `isInScope`, `isNamed` and label length are only
tie-breakers within a tier. So a tier-0 exact match wins outright, whatever it
is attached to.

**Why:** on 2026-09-03 `handleAutoHide` was injecting four `<i title="Show">`
reveal buttons into the presenter's auto-hide footers. `owa_click({find:
'Show'})` scored tier 0 on one of those; the screen's own `Toggle showing
screen [F5]` scored tier 2 (`show` inside `showing`) and could never win. An
assistant asked to turn the projector on pressed a decoration.

**How to apply:**

- A generic one-word `title`/`aria-label` on a decoration is a real bug in this
  app, not a cosmetic one. `Show`, `Hide`, `Open`, `Close`, `More` are all
  words a model will guess with.
- Renaming is not enough if the word stays in the label: `Show Hidden Controls`
  still beat everything at tier 1 on a whole-word match. It is
  `Reveal Hidden Controls` for that reason — the word had to LEAVE.
- Before trusting a `find`, run `owa_find_ui` and read the `tier` column. A
  tier-0 or tier-1 hit on something you did not expect is the bug.
- The other half of that fix is [[click-reports-effect-not-action]].
