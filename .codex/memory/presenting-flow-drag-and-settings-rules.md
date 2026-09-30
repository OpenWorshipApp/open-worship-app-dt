---
name: presenting-flow-drag-and-settings-rules
description: presentingFlowDraggingStore makes a same-list drop a reorder — and silently makes a cross-presenting-flow drag a no-op; presenting flow settings must go through toPresentingFlowSettingName
metadata:
  type: project
---

Two presenting flow rules that produce "it did nothing" reports:

- **Cross-presenting-flow drag adds nothing.** While a row is dragged out of a presenting flow,
  `presentingFlowDraggingStore.current` is set, and `PresentingFlowFileComp.handleDropping` bails
  whenever it is — that is what makes a drop back into the SAME list a reorder instead of a
  duplicate add. The cost is that dropping the row on ANOTHER presenting flow's card is a no-op.
  Known limitation (matrix PL-55), not a bug to re-file; re-add the element from its own
  list. Since [[presenting-flow-cc-elements]] it is still a no-op on purpose: it is an
  element-row drag, so it is neither reordered nor attached.
- **Dropping onto a ROW no longer adds an element.** It attaches a CC to that row, and it
  MUST `stopPropagation()` — the drop otherwise also reaches `PresentingFlowFileComp` through
  the `<li>` and the payload lands twice. Adding an element is the presenting flow NAME row (or
  the empty-state row) only.
- **Presenting Flow rows reach a screen through `dragStore.onDropped`, not `dataTransfer`.** A
  stored slide is a reference and must be re-read from its document, and `dragstart` cannot
  await — so every kind takes the async route to keep one code path. A slide CHILD row
  (under an expanded document) is already resolved and rides the ordinary synchronous
  `handleDragStart`.

Also non-obvious: **clicks in the presenting flow tree `stopPropagation`**. Without it the click
bubbles to the enclosing `FileItemHandlerComp` `<li>`, which fires the app's one UNSCOPED
FileSource `select` and re-renders every file row in the window — a whole-window repaint
on every present, which is exactly what this panel must not add on low-spec machines.

**Settings:** settings are files named after their key, so a raw file path in a setting
name creates directory separators and logs an ENOENT on every read. Everything the presenting flow
persists goes through `toPresentingFlowSettingName` (`/ \ : * ? " < > |` and dots → `_`):
`presenting-flow-opened-…`, `presenting-flow-item-expanded-…` (keyed by the DOCUMENT, so reordering does
not shuffle which rows are open — and two entries of the same document expand together),
`presenting-flow-preview-collapsed-…` (collapsed keys only, file removed when everything is
expanded).

See [[presenting-flow-references-vs-presets]], [[presenting-flow-preview-run-player]].
