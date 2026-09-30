---
name: document-archive-owadoc
description: A single document (.owadoc), bible list (.owbible) or bible note file (.owanote) exports/imports through one shared single-item bundle; the archive machinery lives in helper/
metadata:
  type: project
---

Added 2026-08-05. **Three layers, do not add a fourth copy:**

- `src/helper/appArchiveHelpers.ts` — collector/staging/import machinery, shared with
  [[presenting-flow-archive-owapf]].
- `src/helper/singleItemArchiveHelpers.ts` — the whole single-item flow (create, import,
  file-picker/URL/drop entry points), driven by a `SingleItemArchiveConfigType`.
- `src/app-document-list/appDocumentArchiveHelpers.ts` (`.owadoc.tar.gz`),
  `src/bible-list/bibleArchiveHelpers.ts` (`.owbible.tar.gz`) and
  `src/bible-list/note/bibleNoteArchiveHelpers.ts` (`.owanote.tar.gz`) — nothing but a
  config object and named re-exports. A new bundled item kind should be one more of
  these. (`bibleNoteItemArchiveHelpers.ts`, the per-ITEM `.owabn` bundle, is the fourth
  hand-rolled copy this rule exists to prevent — do not model a new kind on it.)

Layout: `manifest.json` + `files/` (no `presentingFlow.json`). The manifest's **`item`** field
names the exporting machine's absolute path, and that same path is a `files` entry of the
item's kind, so import finds the item exactly the way it finds every other bundled file.
`itemKind` makes each list refuse the other's bundle (the drop gate gets it from the
extension, but the file dialog accepts any `gz/tgz/tar`). The field was called `document`
before bible lists shared the format and is still read under that name.

**The machinery moved.** `src/helper/appArchiveHelpers.ts` now owns everything both
features share — `ArchiveFileCollector` (`addDocument` = file + `.bg.json` sidecar +
canvas media), `stageArchiveFiles`, `resolveKindDirPaths`, `importArchiveFiles`
(reuse-by-MD5), `applyImportedCanvasMedia`, `importBackgroundMetas`, the sanitizer and
the temp work dirs. `presentingFlowArchiveHelpers.ts` kept only presenting-flow-specific parts
(`toItemPathRefs`, the bible-item re-creation, its manifest). Change a rule ONCE, there.
Side effect: the archive-path guard now throws the generic `Invalid archive file path`,
not `Invalid presentingFlow archive file path`.

Document-only additions:

- **Color notes ride in the manifest** (`colorNotes`, `self` = the document's own, other
  keys = slide ids). They live in the `itemSourcesMeta` SETTING keyed by absolute file
  path (`getColorNoteFilePathSettings` / `setColorNoteFilePathSettings`, added to
  `FileSourceMetaManager`), so nothing of them travels inside the file — an `.ows`/`.owl`
  carries its OWN note inside its JSON metadata, but a PDF/PPTX/DOCX does not, and NO
  document carries its per-slide notes.
- Color notes and canvas re-pointing are applied **only to a document this import WROTE**.
  A reused one (identical MD5) is the operator's own file and keeps their colors, exactly
  as an existing `.bg.json` is never clobbered.
- UI: **Export** on every `VaryAppDocumentFileComp` row AND `LyricFileComp`;
  **Import** / **Import From URL** in the Documents list's **Add Items** submenu (that
  list puts its actions there, unlike the Presenting Flows list's top-level menu); a dropped
  `.owadoc.tar.gz` is taken by `handleFileTaking` before the office-convert branch.

**The note file (2026-08-30) is the kind that needed the config to grow.** Everything
before it bundled only what `addDocument` finds — the file, its `.bg.json` sidecar and
its canvas media. A `.own` also embeds files inside each item's Lexical `content`, so
`SingleItemArchiveConfigType` gained three optional hooks, and only the note uses them:
`collectExtraFiles` (walk the item contents, `collector.addFile(path, 'note-asset')`),
`getExtraPresetDirPaths` (that kind's destination is `appLocalStorage.tmpFilesDir`, which
is not a dir-source setting at all) and `applyImportedExtraFiles` (re-point the written
file at the local copies). `ArchiveFileKindType` gained `note` + `note-asset`, both mapped
to `BIBLE_NOTES` in `kindDirSettingNameMap` — for `note-asset` that is only a fallback
that keeps `validateArchiveFileEntries` happy and buys the `always-new` collision policy;
the preset always supplies the real folder. `note` is in `ITEM_FILE_KINDS` so the imported
`.own` reaches `writtenItemFilePaths`. Both hooks walk the file as **raw JSON**, never
through `Note`/`NoteItem`: the `Note.items` setter rebuilds every item through
`toJson()`, so a field neither class carries would be erased — see
[[verse-marks-note-items]]. UI: **Export** on every `NoteFileComp` row, **Import** /
**Import From URL** + a drop gate on the **Bible Notes** panel header
(`BibleNoteListComp`). The per-item `Import` on a note file lost its `note.isDefault`
gate at the same time. The Lexical walk lives in the leaf
`src/bible-list/note/noteEmbeddedFileHelpers.ts` so neither bundle drags the other's
graph in.

Per item kind:

- **Lyric** needs NO code of its own — it is a row in the documents list, its slides'
  attached backgrounds live in the ordinary `<lyric>.owl.bg.json` sidecar, and its own
  color note is inside its JSON metadata. (`<lyric>.owl.preview*.bg.json` files in old
  data dirs are legacy; nothing writes those paths now.) `.owl` is not a canvas document,
  so it is never walked for video boxes.
- **Bible list** carries verse REFERENCES, so the bundle is the `.owb` + its `.bg.json`
  and that sidecar's media; per-verse color notes ride inside the file (`ItemBase` keeps
  them in each item's `metadata`). The bible VERSIONS are deliberately not bundled. Its
  destination folder is **page-dependent** (`Bible.getDirSourceSettingName()` →
  `BIBLE_READ` on the reader), which is why `resolveKindDirPaths` takes a preset map and
  `kindDirSettingNameMap.bible` is only a fallback.

Known wart, shared with presenting flows: a re-export collides to `<name>.owadoc.tar (1).gz`
(`genNextFilePath` splits at the LAST dot), which no longer matches the drop-gate suffix
check — that copy must go through **Import** instead of being dragged in.

Docs: matrix rows PL-77..PL-80 + PR-27..PR-31 + CM-36..CM-39 + CM-69/CM-98/CM-99,
workflows W-23 / W-24 / W-41.
