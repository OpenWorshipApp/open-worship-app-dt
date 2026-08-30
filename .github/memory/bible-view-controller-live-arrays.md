---
name: bible-view-controller-live-arrays
description: BibleItemsViewController hands React its LIVE nested arrays and splices them in place, so never memoize on their identity
metadata:
  type: project
---

`BibleItemsViewController.seek()` returns the very arrays stored in
`_nestedBibleItems` — the same objects `useBibleItemViewControllerUpdateEvent`
puts in React state — and `addBibleItem`/`deleteBibleItem` `splice()` them IN
PLACE before assigning `this.nestedBibleItems` (whose setter rebuilds the tree
and fires the microtask-async update event). Any render landing in that window
sees the SAME array reference with a different length.

**Why:** `BibleViewRendererComp` memoized `flexSizeDefault` on
`[nestedBibleItems, typeText]`, so after `Split Vertical to` (the bible-key
popup closing re-renders inside that window) it still had `{v1,v2}` while
`dataInput` already had `v3`, and `ResizeActorComp`'s key guard threw
`key v3 not found in flexSizeDefault:...`, blanking the reader. Random-looking,
but repeat the split a few times and it hits.

**How to apply:** derive anything memoized from these arrays off a *value*
(the length, ids), never off the array reference; a regression test lives in
`src/bible-reader/BibleViewRendererComp.test.tsx`. Same caution for any new
consumer of `nestedBibleItems`. (Event-dispatch semantics: see CLAUDE.md's
"Event dispatch is microtask-async" section.)
