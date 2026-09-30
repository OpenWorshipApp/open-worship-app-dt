---
name: lyric-in-documents-list
description: "Lyrics are a Documents-list document type — one selection, one previewer whose body swaps; the merge finished 2026-08-06"
metadata: 
  node_type: memory
  type: project
  originSessionId: ee7d17a3-639f-46d9-af3f-ac77bb63c098
  modified: 2026-08-06T19:05:57.038Z
---

As of 2026-08-03 (branch `refactor23`) lyrics are a document type of the
Documents list, like PPTX: `.owl` files live in the **documents** folder, the
`LyricListComp` widget and the `LYRIC` entries in `dirSourceSettingNames` /
`defaultDataDirNames` are deleted, and the "Lyrics" row is gone from Settings →
Path Settings. `VaryAppDocumentListComp` renders `LyricFileComp` for `.owl` rows
and `VaryAppDocumentFileComp` for the rest.

**Finished 2026-08-06 (branch `refactor24`).** The half-merge is gone: there is
no `selected-lyric` setting, no `SelectedLyricContext`/`useLyricContextValues`,
no `'l'` previewer tab, and no `select-lyric`/`update-lyric` event. A `.owl` row
selects a `LyricAppDocument` through the ONE
`selected-vary-app-document` selection (so exactly one row is ever `.active`),
and `AppDocumentPreviewerComp` swaps only its **body** —
`PreviewerBodyComp` mounts `LyricHandlerComp` (now a `filePath` prop, no card
chrome) for a lyric and the slide list otherwise, keeping the shared footer.
`selected-lyric` is migrated into the document key lazily on first read in
`selectedVaryAppDocumentHelpers` (an existing document selection wins).

**Why:** the user asked for one file list; lyrics already had a
`LyricAppDocument` and presented through `ScreenVaryAppDocumentManager`, so only
listing/selection needed merging.

**How to apply:** existing users' `.owl` files still sit in the old `lyrics`
folder and must be moved into `documents` to reappear — there is no automatic
migration. `markdown` (`.md`) support in the old lyric list was already dead
(`checkIsMarkdown` compared a dotted extension against a dotless list) and was
not carried over. Do not "fix" the dispatch by importing `LyricAppDocument` into
`appDocumentHelpers` — see [[app-document-helpers-lyric-cycle]]; the dependency
is inverted instead, `LyricAppDocument` calls `setLyricAppDocumentGetter` at
module scope, so `varyAppDocumentFromFilePath` resolves `.owl` only once that
module has been evaluated (`getSelectedVaryAppDocument` `await import()`s it
first). `LyricAppDocument` passes `AppDocument.checkIsThisType` but is NOT
editable — every editable-only path (`checkIsAppDocumentSelected`,
`layoutHelpers`' editing-slide derivation, `getSelectedEditingSlide*`) must also
test `isEditable`, or selecting a song renders the whole thing to HTML for
nothing.
