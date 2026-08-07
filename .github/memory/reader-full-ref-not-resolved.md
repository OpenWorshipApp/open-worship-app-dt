---
name: reader-full-ref-not-resolved
description: "The Bible Reader does NOT resolve a typed full reference; the skill docs used to claim it did — corrected 2026-08-05"
metadata: 
  node_type: memory
  type: project
  originSessionId: 966913c5-2e9e-4ec8-b66c-37d9da11bb6c
  modified: 2026-08-05T10:12:42.430Z
---

Verified live 2026-08-05 (re-confirmed in the robot-test run the same day): typing
`John 3:16` in the **Bible Reader** narrows the book list correctly, but committing the book
(Enter *or* clicking it) rewrites the input to just the book name and drops back to the
chapter grid — the typed `3:16` is discarded. `handleBookSelecting`
(`src/bible-lookup/RenderBibleLookupBodyComp.tsx`) sets
`inputText = await toInputText(bibleKey, newBook)`, rebuilt from the book alone.

The reader and the header modal render the **same** `InputHandlerComp` writing the same
`BIBLE_LOOKUP_INPUT_ID`, so a reader-only full-ref path never existed — this was always doc
drift, not a regression.

**Why:** the docs asserted the opposite and would send you hunting for a "regression" that
is really current behaviour — and RD-03's pass condition would have failed a correct app.

**How to apply:** treat the reader as the same step-by-step picker as the modal. The five
docs are now corrected (`user-workflows.md` W-09/W-11 → workflowsVersion 2026-08-05a,
`knowledge-base.md` §5 + §11, `components-path.md`, `test-plan.md` S11, and
`docs/test-paths/coverage-matrix.md` RD-03 → matrixVersion 2026-08-05a). Still open with the
user: whether the app *should* carry the parsed chapter/verse through book selection.
Related: [[qa-intentional-not-bugs]].
