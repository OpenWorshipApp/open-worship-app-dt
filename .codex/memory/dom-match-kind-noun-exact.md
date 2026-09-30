---
name: dom-match-kind-noun-exact
description: "The DOM matcher trims a trailing kind noun (list/panel/tab…) off every needle, so a control NAMED with one ('Presenting Flow List') was never an exact match and its strip was refused by owa_click; dividers are named 'Divider between A and B' and right-clicked in place by the guide"
metadata: 
  node_type: memory
  type: project
  originSessionId: e3cb0261-1dc2-4fe7-b02d-ddd071cf7ca1
  modified: 2026-09-09T19:47:47.984Z
---

`parseNeedle` in `tools/owa-devtools-mcp/domMatch.mjs` drops a trailing
KIND noun (`panel`, `pane`, `tab`, `button`, `box`, `list`, `menu`, …) from
every needle, because a recipe writes "the **Videos** tab". Panes are named
WITH one — `Document List`, `Presenting Flow List` — so asked for by their
exact name they were trimmed to `presenting flow`, a tier-1 loose fit on
their own label, which the press-safety bar refuses (2026-09-09, live:
`owa_click "Presenting Flow List"` on the collapsed strip answered *"the
closest control on screen is not called that"*). `tierOf(element, lowered,
parsed)` now tries `parsed.asked` (the words before the trim) for the exact
tier — against the joined label AND each label part, because a strip is named
by the pane's name and by its own `Enable …` title — before `matchTier` on the
trimmed text.

**Why:** a label that ends in a kind noun is common in this app (every
`*List` pane, `Bible Lookup`, `Background Audio`) and the trim is invisible
from the outside: the ring still lands, only the PRESS is refused.

**How to apply:** when a control with an exact name is reported as a loose
fit, check whether its last word is in `KIND_NOUNS` before touching the
tiers. When adding a kind noun to that list, run `domMatch.test.mjs`'s
*a control named with a kind noun* case with a label ending in it.

Same change: every panel divider (`FlexResizeActorComp`) carries
`role="separator"` and `aria-label="Divider between <A> and <B>"` off its
neighbours' `data-widget-name` (walked TO a collapsed strip, not over it, as
the drag getters do), so `owa_find_ui "divider"` lists them and a recipe step
*"Right-click the **divider between Document List and Presenting Flow
List** … choose **Close First Widget**"* is pressable: the guide right-clicks
a `[role="separator"]` target where it stands (`openContextMenu` aims at the
CENTRE of anything thinner than its 20 px inset) and refuses the list-region
fallback for a step naming a divider — a collapsed panel has no divider, and
the fallback opened the nearest list's own menu. `dropStepsAlreadyDone` reads
only a step's FIRST sentence for the window it goes to (W-31's step 1 named
the presenter in an example list two sentences on and was dropped whole).
See [[guide-press-safety-and-covers]], [[panel-name-in-dom]],
[[dom-match-exact-label-beats-everything]].
