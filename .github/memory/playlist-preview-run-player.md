---
name: playlist-preview-run-player
description: The playlist floating preview is a run-sheet PLAYER — forward-only keys, focus-gated, and a document element is walked slide by slide before the run leaves it
metadata:
  type: project
---

`PlaylistPreviewFloatingComp` + `playlistPreviewFloatingHelpers.ts` are not just a bigger
list; they are how a service is driven from the run sheet. The rules are deliberate and
keep getting "fixed" by mistake:

- **Space / ↓ / → / PageDown step FORWARD only, never wrapping.** Wrapping back to element
  1 mid-service would put the wrong thing on a live screen.
- **Gated on focus being inside the widget** (`container.contains(document.activeElement)`,
  and the body is `tabIndex={0}`), because the presenter's slide list answers the very same
  keys — without the gate, opening the preview steals them.
- **A document element is walked slide by slide first** (`stepPlaylistPreviewChild`); the
  run only moves on once the cursor is on its last slide, and crossing INTO a document
  always starts at its FIRST slide even if a middle slide of it is still live.
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
- Selection is remembered as **key + index**, and BOTH must match to mark an element
  (`checkIsPlaylistPreviewItemSelected`) — a key-only test lit up both copies of a
  twice-listed entry. A reorder un-marks until the next press, which
  `resolvePlaylistPreviewSelectedIndex` repairs by writing back the position it found.
  Closing the widget or pointing it at another playlist clears it.
- **The cursor's mark is `app-playlist-preview-item-selected`** — a cyan `var(--bs-info)`
  outline, on the element's sticky label AND (same class, second rule) on the slide card.
  It is a different question from the magenta blinking `app-highlight-selected`, which
  says "live on a screen" and can be on several cards at once; both are meant to be
  readable together.
- Only ONE widget exists at a time (module-level store, not per-row state). Its fold state
  is one setting per playlist holding only the COLLAPSED keys, deleted when everything is
  expanded.
- Slide cards inside the widget get a **restricted** right-click menu (Show on Screens
  only, caught on the capture phase) — the previewer's colour-note/background/edit family
  acts on the document, not on the run sheet. Bible entries render read-only for the same
  reason.

- **What the run lands on is scrolled `nearest`, or CENTRED when it hangs off the bottom**
  (`bringPlaylistRunElementToView`) — nearest alone leaves it flush against the bottom edge
  with nothing of the sheet after it visible, which is what an operator needs most while
  the run is moving. Measured against `findVerticalScrollingParent`, NOT the preview's own
  container: that container is the full height of the run sheet (the floating widget's body
  is what scrolls), so asking it always answers "not off the bottom".

Covered by matrix rows PL-38, PL-42, PL-46..PL-48, PL-58..PL-61; unit tests live in
`playlistPreviewFloatingHelpers.test.ts`. See [[playlist-references-vs-presets]].
