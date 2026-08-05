---
name: lyric-in-documents-list
description: Lyrics moved into the Documents list/folder on 2026-08-03; the separate Lyric list and its dir setting are gone
metadata:
  type: project
---

As of 2026-08-03 (branch `refactor23`) lyrics are a document type of the
Documents list, like PPTX: `.owl` files live in the **documents** folder, the
`LyricListComp` widget and the `LYRIC` entries in `dirSourceSettingNames` /
`defaultDataDirNames` are deleted, and the "Lyrics" row is gone from Settings →
Path Settings. `VaryAppDocumentListComp` renders `LyricFileComp` for `.owl` rows
and `VaryAppDocumentFileComp` for the rest; selecting a lyric still drives the
separate **Lyrics** previewer tab (openLyric preview + Stage Previewer), not the
Documents previewer.

**Why:** the user asked for one file list; lyrics already had a
`LyricAppDocument` and presented through `ScreenVaryAppDocumentManager`, so only
listing/selection needed merging.

**How to apply:** existing users' `.owl` files still sit in the old `lyrics`
folder and must be moved into `documents` to reappear — there is no automatic
migration. `markdown` (`.md`) support in the old lyric list was already dead
(`checkIsMarkdown` compared a dotted extension against a dotless list) and was
not carried over. Do not "fix" this by importing `LyricAppDocument` into
`appDocumentHelpers` — see [[app-document-helpers-lyric-cycle]].
