---
name: presenting-flow-archive-owapf
description: .owapf.tar.gz bundles a presenting flow with the WHOLE documents behind its slide references; import resolves every destination folder up front so a failure writes nothing
metadata:
  type: project
---

`src/presenting-flow/presentingFlowArchiveHelpers.ts` — export/import of a presenting flow as
`<name>.owapf.tar.gz` via `tarCreate`/`tarExtract` (**not** a zip: the app has no zip
dependency; same pattern as the bible-note archive).

**Since 2026-08-05 most of this lives in `src/helper/appArchiveHelpers.ts`**, shared with
the single-document bundle ([[document-archive-owadoc]]) — collector, staging, folder
resolution, MD5 reuse, sidecar/canvas re-pointing. This file kept only the
presenting-flow-specific parts. Fix a rule in the shared module, not here.

Layout: `manifest.json` + `presentingFlow.json` + `files/`. Because slides are stored as
references ([[presenting-flow-references-vs-presets]]), the bundle carries the **whole document**
behind every slide entry, plus the media behind every background and each document's
`.bg.json` attached-background sidecar (its entries absolutised at export, re-pointed at
the local copies at import).

Non-obvious contract, all of it load-bearing:

- **`resolveKindDirPaths` runs BEFORE any file is copied.** `getKindDirPath` throws when a
  list has no folder chosen yet, and discovering that halfway would leave media imported
  and no presenting flow to show for it. Same for the presenting flows folder itself.
  Both now live in `src/helper/appArchiveHelpers.ts:454,485`, shared with
  `singleItemArchiveHelpers.ts` too.
- Archive paths are validated in the shared module (`..` or a backslash →
  `Invalid archive file path`, `src/helper/appArchiveHelpers.ts:449`).
- **Reuse is decided by MD5, not by name.** A same-named file in the destination folder is
  reused only when `getFileMD5` matches; a different one is left alone and the archive's
  copy lands beside it (`fsCopyFilePathToPath` → `genNextFilePath` → `a (1).mp4`), because
  two machines can each hold a different `a.mp4`. An unreadable file on either side counts
  as different. An existing `.bg.json` is never clobbered; the presenting flow file itself
  de-duplicates the same way, so importing twice is safe but does add a presenting flow.
- **A document's own canvas media is bundled too.** A slide's VIDEO box stores
  `props.filePath` (an IMAGE box inlines base64), so `addCanvasDocumentMedia` walks the
  `.ows`/`.preview` JSON and adds those files as `kind: 'video'`; import re-points them via
  `applyImportedCanvasMedia`. Only documents this import WROTE are rewritten — a reused one
  is the operator's own file. The regenerable `<doc>.pdf-images/`, `<doc>.pptx-htmls/` and
  `<doc>.histories/` are deliberately NOT bundled.
- A bible entry carries no file: it is re-created in the **Default** bible list (identical
  verse reused) and the entry re-pointed at that file path + item id, which is what makes
  Reveal Original work afterwards.
- A dropped archive is unpacked **where it already sits** (`appFilePath`, stamped by the
  electron preload) — bundles are big, copying them in first is wasted I/O. Only a drop
  with no path is staged in temp.

QA note: a CDP-fabricated `dataTransfer` with `appFilePath` on the `File` drives the whole
dropped-import pipeline against a real file on disk (see CLAUDE.md's file-drop note).
