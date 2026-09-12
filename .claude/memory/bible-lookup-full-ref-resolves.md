---
name: bible-lookup-full-ref-resolves
description: "A typed full reference RESOLVES on both lookup surfaces now — the header modal and the Bible Reader page; the 2026-08-05 'book-filters only, the 3:16 is dropped' correction is stale"
metadata: 
  node_type: memory
  type: project
  originSessionId: f26e089a-b49b-474e-9f97-9d00cf9de0f3
  modified: 2026-09-12T00:21:10.373Z
---

Verified live 2026-09-11 on the dev app, on **both** surfaces that render
`InputHandlerComp` (`BIBLE_LOOKUP_INPUT_ID`): typing a full reference
char-by-char goes straight to the verse.

- `John 3:16` on the **Bible Reader**: the pane header became `John 3:16`, the
  chapter strip showed `16` selected, the verse text rendered, and the Resources
  panel switched to the `JHN.3` file group.
- `Psalm 23:1` on the **header modal** (Ctrl+B) *and* on the Reader: "The LORD is
  my shepherd" appeared on both. That reference is the control — its words are
  absent from this profile's saved Bibles list, and a baseline probe confirmed the
  word was nowhere on the page before typing, so the match cannot come from a
  saved row. (The first attempt used `John 3:16`, which IS in the saved list — an
  inconclusive probe worth avoiding.)

**Why:** the opposite claim had been in five docs since 2026-08-05 and would now
fail a correct app — RD-03's pass condition asserted the `3:16` gets dropped, and
W-06/W-11 told users to pick book → chapter → verse in steps.

**How to apply:** treat both lookup surfaces as identical (they always were — only
the direction of the shared behaviour changed), and assert the **rendered verse**,
never a dropped `3:16`. Corrected in the same change: `coverage-matrix.md` RD-03
(matrixVersion 2026-09-11e), `knowledge-base.md` §5 + §11 + §9, `test-plan.md`
S11, `components-path.md`, `user-workflows.md` W-06/W-11 (workflowsVersion
2026-09-11e) and the generated manual pages, plus the `.github` mirrors. The
`coverage-expansion/discover-*.md` sweep files still carry the old row; they are
dated research provenance, not runtime references. Related:
[[qa-intentional-not-bugs]].
