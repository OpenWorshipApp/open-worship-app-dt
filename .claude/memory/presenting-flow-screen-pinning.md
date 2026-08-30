---
name: presenting-flow-screen-pinning
description: "A presenting flow entry (or one slide of a document) can be PINNED to screens; the preset rides chooseScreenIds, and isForceChoosing deliberately outranks it"
metadata: 
  node_type: memory
  type: project
  originSessionId: e0588ad5-6bd2-4088-a1b8-836ef4c16b9f
  modified: 2026-08-05T13:57:53.681Z
---

`Set Specific Screen` (added 2026-08-05, branch `lyric`) pins a run-sheet line to
particular screens so a click stops depending on which mini screens are selected.

**Why it threads through `chooseScreenIds` rather than being its own path:**
`isForceChoosing` already means "ignore the default, ASK". A pin is its mirror image —
"ignore the default, use THESE" — so `ScreenEventHandler.chooseScreenIds(event,
isForceChoosing, presetScreenIds)` answers both in the one place that already answers
"which screens". Precedence: force → preset → selected → menu. That ordering is
deliberate: **`Show on Screens` (which passes `isForceChoosing`) and a drag onto a mini
screen (which names its screen via `dataset.screenKey`) must keep overriding a pin**, or
an operator with a pinned line has no one-off escape hatch.

Things that will bite whoever touches this next:

- **`sendPresentingFlowItemToScreens` is NOT the only present path**, despite its comment. The
  preview's background/bible clicks call `showDroppedDataOnScreens` directly, and slide
  cards go `VarySlideRenderWrapperComp` → `handleVarySlideSelecting` →
  `ScreenVaryAppDocumentManager.handleSlideSelecting`. All of them had to be given the
  preset separately; a new present path will silently ignore pins. Since
  [[presenting-flow-cc-elements]] every one of those paths ALSO has to arm the CC followers, so
  a new present path now costs two lines rather than one.
- **Slide thumbnails get theirs by CONTEXT** (`PresetScreenIdsContext` in
  `_screen/managers/screenChoosingHelpers.ts`), because that card is the presenter's own
  component shared with the documents previewer — prop-drilling would teach it about
  presenting flows. Default `[]` = today's behaviour everywhere else.
- **`screenChoosingHelpers.ts` must stay a leaf.** `ScreenEventHandler` imports it, so a
  `tran` import there drags the whole settings/file graph into every screen manager (and
  breaks `managerHelpers.extra.test.tsx` on `appProvider.pathUtils`). The translated
  picker lives in `PresentingFlowScreenPinComp.tsx` instead — the same place `chooseColorNote`
  lives relative to `ItemColorNoteComp`.
- **`isScreenPinnable` is wider than `isScreenReachable` by exactly one kind: a document.**
  A document is never shown as a unit (no `Show on Screens`), but its slides are what the
  run walks, so it must be pinnable. Audio and error rows stay out.
- **Per-slide pins are `slideScreenIds`, keyed by slide ID, not position**, and an empty
  list DELETES the key (and the map with it) — "not pinned" is the absence of the field,
  so an unpinned run sheet reads exactly like one written before this existed. A slide
  with no entry inherits the document's `screenIds`; clearing a slide hands it BACK to the
  document rather than pinning it to nothing.
- Getters read defensively (`toScreenIds`) instead of `validate` throwing: a bad pin must
  never turn a row into an error row mid-service.
- A pin naming a screen that is gone hits the existing
  `'Failed to apply to screen. Please make sure the screen is open.'` toast and projects
  nowhere — never a silent fallback to the selected screens.

Covered by matrix rows PL-81..PL-85 and W-22. Its unit test was deleted
2026-08-24; the only test still guarding this area is
`src/_screen/managers/managerHelpers.extra.test.tsx`, which is what breaks if
`screenChoosingHelpers.ts` stops being a leaf. See [[presenting-flow-references-vs-presets]],
[[presenting-flow-preview-run-player]], [[presenting-flow-screen-actions]].
