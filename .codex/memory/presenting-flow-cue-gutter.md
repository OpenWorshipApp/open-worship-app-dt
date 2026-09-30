---
name: presenting-flow-cue-gutter
description: "The run sheet's left column — line number + rail + run cursor — is shared by the tree and the preview; keep them identical"
metadata: 
  node_type: memory
  type: project
  originSessionId: 8c7dbfa0-0489-4c4c-899b-1ef4e06fc0df
  modified: 2026-08-08T19:31:38.786Z
---

`PresentingFlowRowGutterComp` (added 2026-08-08) is the fixed left column of every
run-sheet line, drawn by **both** the tree row (`PresentingFlowRowComp`) and the
floating preview's element header (`PresentingFlowItemPreviewComp`). It carries
the line number (tabular), the **rail** (the gutter's `border-right`, unbroken
because rows sit flush), and the **run cursor** — an inset accent stroke applied
by a class on the *row*, not passed into the gutter.

Rules that are load-bearing:

- `box-sizing: content-box` on the gutter. The app is border-box, under which
  `min-width: 2ch` was eaten by padding + rail and the column stepped 6px sideways
  at line 10 — invisible on any sheet shorter than ten lines.
- Rows the run cannot stop on (CC followers, a document's slides, placeholders)
  pass `lineNumber={null}`: they still draw the gutter so the rail stays unbroken
  and labels align, they just carry no number.
- `depth` indents **after** the gutter, never as row padding, or nested rows step
  the column out of line.
- The tree's cursor comes from `usePresentingFlowPreviewIsItemSelected` — the same
  store the widget uses, so the two can never disagree. It is false whenever no
  preview is open, because the cursor lives and dies with a run
  ([[presenting-flow-preview-run-player]]).
- Rows are `role="button"` + `tabIndex={0}` and answer **Enter only**. Space is the
  run's next-key and CC rows are drawn inside the widget too, so a Space handler
  would fire the row *and* step the run on one press.

**Why:** the two panels show one run sheet; a number at a different x in each
leaves neither readable against the other.

**How to apply:** change the gutter in one place and check both panels. Colour
decisions here follow [[console-design-system-tokens]].
