---
name: previewer-note-pane-ships-closed
description: The Presenter previewer's Note pane ships COLLAPSED; a stored layout beats a changed default, so the change needed a one-off migration
metadata:
  type: project
---

The Presenter document previewer's **Note** pane (`EditorComp` in
`src/app-document-presenter/items/AppDocumentPreviewerComp.tsx`, key `v2`) ships
COLLAPSED — `v2: ['1', ['second', 0]]` in its `flexSizeDefault`. Asked for on
2026-09-28 with the two empty note boxes circled in a screenshot: _"user is
rarely use note feature, in the presenter document preview only, make it close
by default. but make sure it is covered in demo+tips"_. Only the PRESENTER
previewer — the Slide Editor's own note pane (`slideEditorNote`) was not
touched.

**Why:** the flag's number is the grow the pane HANDED its neighbour when it
closed, and a pane that never opened handed over nothing, so it is `0` and the
first open lands on the 6:1 split it used to ship with. A hand-closed pane
stores `['second', 1]` instead, which is not a contradiction: it really did give
the slides its `1`.

**How to apply:**
- **A shipped default is only ever read for a file with NO stored layout.**
  Changing `flexSizeDefault` alone changes nothing for anyone who has opened
  the document before — 31 of this user's 48 stored previewer layouts had it
  open. So the change needed `src/helper/previewerNoteCloseMigration.ts`, a
  one-off keyed per data folder from `boot.ts` (the claim-first,
  dynamic-`import()` pattern `settingKeyPathMigration` established), which
  writes exactly what _Close Second Widget_ writes and skips a layout already
  collapsed. Any future change to a `flexSizeDefault` of a pane users have
  already seen has the same problem.
- Discoverability was half the ask: the lesson `presenter-note-panel` ("Write a
  note on a document or slide") in `presenterDemos.mjs` is the Tip of the Day
  AND the practice-shelf entry, W-03 carries a Tips bullet, W-31 lists `Note`
  as the one panel that starts unticked, and `questions/presenter.json` has
  `open-note-panel`. See [[question-corpus-maintenance]].
- Found on the way, fixed with it: `setDisablingSetting` read the STORED blob
  while both closers had just written the neighbour's new grow to the DOM, so
  after a reload reopening subtracted the closed pane's space a second time —
  see [[widget-close-must-persist-absorbed-grow]].
