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
  run only moves on once the slide on screen is its last, and crossing INTO a document
  always starts at its FIRST slide even if a middle slide of it is still live. Where the
  walk is from is read off the SCREENS (one on-screen setting read per press, never one
  per slide), so clicking a slide directly re-points it.
- **The stepper is registered by the component holding the slides**, only while the element
  is unfolded — nothing keeps a document in memory after its preview is folded away. A
  folded document therefore registers nothing and is passed over.
- Selection is remembered as **key + index**: the key survives a reorder, the index tells
  two identical entries apart. Closing the widget or pointing it at another playlist clears
  it.
- Only ONE widget exists at a time (module-level store, not per-row state). Its fold state
  is one setting per playlist holding only the COLLAPSED keys, deleted when everything is
  expanded.
- Slide cards inside the widget get a **restricted** right-click menu (Show on Screens
  only, caught on the capture phase) — the previewer's colour-note/background/edit family
  acts on the document, not on the run sheet. Bible entries render read-only for the same
  reason.

Covered by matrix rows PL-38, PL-42, PL-46..PL-48, PL-58..PL-61; unit tests live in
`playlistPreviewFloatingHelpers.test.ts`. See [[playlist-references-vs-presets]].
