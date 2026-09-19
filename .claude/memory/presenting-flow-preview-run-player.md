---
name: presenting-flow-preview-run-player
description: The presenting flow floating preview is a run-sheet PLAYER — forward-only keys, focus-gated, and a document element is walked slide by slide before the run leaves it
metadata:
  type: project
---

`PresentingFlowPreviewFloatingComp` + `presentingFlowPreviewFloatingHelpers.ts` are not just a bigger
list; they are how a service is driven from the run sheet. The rules are deliberate and
keep getting "fixed" by mistake:

- **Space / ↓ / → / PageDown step FORWARD only, never wrapping.** Wrapping back to element
  1 mid-service would put the wrong thing on a live screen.
- **Gated on focus being inside the widget** (`container.contains(document.activeElement)`,
  and the body is `tabIndex={0}`), because the presenter's slide list answers the very same
  keys — without the gate, opening the preview steals them.
- **A document element is walked slide by slide first** (`stepPresentingFlowPreviewChild`); the
  run only moves on once the cursor is on its last slide, and crossing INTO a document
  always starts at its FIRST slide even if a middle slide of it is still live.
- **PARKED is the ONLY reason a line is stepped over** (changed 2026-08-06). It used to skip
  anything that could not reach a screen — audio, an error row, and a document whose preview
  was FOLDED (its stepper is only registered while unfolded), so a sheet folded down for
  reading silently jumped over its songs. Folding is how the operator READS a long sheet and
  must not decide what is in the run, so `findNextPresentingFlowPreviewIndex` lost its
  `checkIsEnterable` argument (and `checkPresentingFlowPreviewHasChildren` is gone) and
  `landPresentingFlowRunOnIndex` UNFOLDS what it lands on (`expandPresentingFlowPreviewItem` — a no-op
  when already open, or every step would rewrite the setting and re-render the sheet).
  Audio and error rows now take the cursor and fire nothing, which is the honest reading.
- **Unfolding is async, so entering the slides is DEFERRED.** Unfolding mounts the preview,
  which then reads the slides off disk — at landing time there is nothing registered to step
  into. `requestPresentingFlowPreviewChildEntry` leaves the ask and
  `registerPresentingFlowPreviewChildStepping` answers it one MACROTASK later (it dispatches a real
  click onto a card, which must not run inside the commit that just mounted them). ONE slot,
  dropped by `setPresentingFlowPreviewSelectedItem`/`clearPresentingFlowPreviewSelectedItem` — an ask that
  outlived its landing would present a slide the next time that element was unfolded by hand.
- **The widget focuses itself on open** (`[filePath]`, `preventScroll`). Every key it answers
  to is focus-gated, but the gesture that opens it leaves focus on the tree's button, so the
  first press used to do nothing with nothing on screen to say why.
- **The cursor is the panel's OWN, never derived from the screens** (`selectingState.childId`).
  Reading it off `ScreenVaryAppDocumentManager.getDataList()` was a bug: the match is on the
  DOCUMENT file path, so a twice-listed document (or one also live from the presenter's own
  list) made a press in one element jump to what another had shown. One slot for the whole
  panel — moving the element cursor clears it — and it dies with the widget.
- **A keyboard step PROPAGATES A CLICK** on the target card (`element.dispatchEvent(new
  MouseEvent('click', {bubbles: true, clientX/Y from its rect}))`) instead of calling
  `handleVarySlideSelecting` itself. Stepping and clicking are then one implementation;
  the rect coords are what the "which screen?" menu is positioned from.
- **The stepper is registered by the component holding the slides**, only while the element
  is unfolded — nothing keeps a document in memory after its preview is folded away. A
  folded document therefore registers nothing and is passed over.
- **Only what wears `cursor: pointer` moves the cursor** (`checkIsClickOffered` in
  `PresentingFlowItemPreviewComp.tsx`, asked by BOTH capture handlers — the frame's and the slide
  card wrapper's). The gate is the computed cursor of `event.target`, not a list of class
  names, so it cannot drift from the affordance: the header, a slide card, an action's
  button and a CC row all already wear it, while the frame's body padding, the gap between
  two thumbnails, the 2px margin ring around a card and the `<hr>` under an element do not.
  A press on that empty space only focuses the widget (`app-focusable` lights its border) —
  it used to yank the run cursor off whatever was live because a click missed a card by two
  pixels. `event.target` retargets to the shadow HOST inside a slide, and that host sits in
  the card, so it inherits `pointer` and answers as the card would.
- Selection is remembered as **key + index**, and BOTH must match to mark an element
  (`checkIsPresentingFlowPreviewItemSelected`) — a key-only test lit up both copies of a
  twice-listed entry. A reorder un-marks until the next press, which
  `resolvePresentingFlowPreviewSelectedIndex` repairs by writing back the position it found.
  Closing that presenting flow's widget clears it — and only it.
- **The cursor's mark is `app-presenting-flow-preview-item-selected`** — a cyan `var(--bs-info)`
  outline, on the element's sticky label AND (same class, second rule) on the slide card.
  It is a different question from the magenta blinking `app-highlight-selected`, which
  says "live on a screen" and can be on several cards at once; both are meant to be
  readable together.
- **SEVERAL widgets may be open at once, one per FILE** (2026-08-08; before that a shared
  slot meant opening one silently closed the other and threw its run position away). The
  store is a module-level ARRAY of open file paths, and everything the run holds is keyed
  by file path with it: the cursor, the pending child entry, the child-stepping registry
  (`Map<filePath, Map<index, stepping>>` — two sheets both have an element 3) and the
  auto-next clock. Each widget keeps its own rect under
  `floating-widget-rect-presenting-flow-preview-<sanitized path>` and is staggered 24px on
  first open; the zoom slider is deliberately still ONE shared setting. Closing a widget
  drops everything it held, its cached fold keys included. Its fold state is one setting
  per presenting flow holding only the COLLAPSED keys, deleted when everything is expanded.
- Slide cards inside the widget get a **restricted** right-click menu (Show on Screens
  only, caught on the capture phase) — the previewer's colour-note/background/edit family
  acts on the document, not on the run sheet. Bible entries render read-only for the same
  reason.

- **What the run lands on is scrolled `nearest`, or CENTRED when it hangs off the bottom**
  (`bringPresentingFlowRunElementToView`) — nearest alone leaves it flush against the bottom edge
  with nothing of the sheet after it visible, which is what an operator needs most while
  the run is moving. Measured against `findVerticalScrollingParent`, NOT the preview's own
  container: that container is the full height of the run sheet (the floating widget's body
  is what scrolls), so asking it always answers "not off the bottom".

Covered by matrix rows PL-38, PL-42, PL-46..PL-48, PL-58..PL-61; its unit test
(`presentingFlowPreviewFloatingHelpers.test.ts`) was deleted 2026-08-24
(47053c9d) — the matrix rows are the only coverage now.
See [[presenting-flow-references-vs-presets]].
