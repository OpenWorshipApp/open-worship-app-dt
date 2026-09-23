---
name: bible-xml-archive-owabdata
description: ".owabdata.tar.gz bundles the XML bibles of Settings → Bible; the only archive whose import REFUSES an item instead of copying it beside the old one, keyed case-insensitively on the bible key inside the file"
metadata: 
  node_type: memory
  type: project
  originSessionId: 5b0be001-2c0c-4811-87e4-07ab38bd842a
  modified: 2026-08-10T16:27:26.024Z
---

Added 2026-08-10. `src/setting/bible-setting/bibleXMLArchiveHelpers.ts` (+ its
`…MenuHelpers.tsx` flows and `BibleXMLArchiveComp.tsx` panel) — export/import of the
**XML bibles** listed under Settings → Bible as `<name>.owabdata.tar.gz`
(`.owabdata.enc` when protected). W-33; matrix ST-34..ST-40.

**Deliberately NOT a `SingleItemArchiveConfigType`** — this is the one archive kind where
"add a config, not a copy" ([[document-archive-owadoc]]) does not apply, and the reasons
are each load-bearing:

- Its items are **flat files in an app-managed folder**
  (`bibleDataReader.getWritableBiblePath()`), so there is no `kindDirSettingNameMap`
  entry, no `DirSource`, and nothing for `resolveKindDirPaths` to resolve or fail on.
- **Many items per bundle**, where the single-item layer carries exactly one.
- Identity is the **bible KEY inside the XML**, not the file name — which is what forces
  the rule below.

It still reuses everything shared: naming from the leaf `archiveNameHelpers`, the whole
password layer ([[archive-password-protection]]), `createWorkDir`/`safeDeleteDir`/
`writeArchiveManifest`/`readArchiveManifest`/`ARCHIVE_VERSION` from `appArchiveHelpers`,
and `tarCreate`/`tarExtract`. Its flow file is a near-copy of
`src/setting/data-archive/dataArchiveMenuHelpers.tsx` on purpose — same one-dialog
picker + password, same recursive re-ask, same `runWithProgress`.

**The rule that makes it different: an import never overwrites and never duplicates.**
Every other kind resolves a name collision by keeping yours and adding the bundled one as
`a (1).mp4`. Two bibles sharing a key would be ambiguous everywhere else in the app, so
here a colliding item is REFUSED instead: it becomes a red, un-tickable row naming why,
and the clean rows still import. Three reasons, all surfaced the same way
(`BIBLE_XML_IMPORT_ISSUE_MESSAGE_MAP`): `duplicate` (key already installed),
`duplicate-in-archive` (second of a pair inside one bundle), `unreadable`.

Non-obvious, all of it deliberate:

- **Keys compare `trim().toLocaleLowerCase()`** — `kjv` and `KJV` are the same bible.
- **The key is re-read from the EXTRACTED FILE**, never trusted from the manifest, and a
  file whose key disagrees with what the manifest promised is `unreadable`. The manifest
  is plain JSON anyone can rewrite, and a row that claims a free key while holding an
  installed bible is exactly the overwrite this must never do.
- **The bundle is unpacked WHOLE before the picker opens**, so every row's state comes
  from a real file. That also keeps the protected path to ONE `openArchiveForReading` —
  opening twice is what [[data-archive-owadata]] records as the mistake not to repeat.
- **The free-key check runs AGAIN in `importBibleXMLEntries`**, against the folder as it
  is at write time, plus an `fsCheckFileExist` on the destination. The picker can sit
  open, and a file whose key cannot be read is invisible to `getAllXMLFileKeys` yet still
  owns its name.
- Imports land as `<key>.xml` (what `saveXMLText` already writes), so a bundle whose file
  was `kjv-2011.xml` still becomes `KJV.xml`.
- The export picker's labels come from `getBibleHeadInfoFromFile` — ONE 4KB head read and
  one parse for key + title. Never `getBibleInfo`/`getBibleInfoJson`: they parse the whole
  multi-MB file, and `getBibleInfoJson` also opens a "Key is missing" DIALOG for a file
  with no key attribute, which a list must never do.
- Only XML bibles travel. The downloaded bible databases beside them are hundreds of MB
  and re-downloadable — the same call [[data-archive-owadata]] makes when it filters that
  folder to `*.xml`.

Drop target is the **whole** `SettingBibleXMLComp` section, which has no `DirSource`, so
`genOnDrop`/`FileListHandlerComp` do not apply — the three handlers are written directly.
Dimming is written to `currentTarget`, NOT through `changeDragEventStyle` (which writes
`event.target`, leaving a child dimmed forever since `dragleave` does not fire on a drop);
see [[drag-kind-mime-and-dim-target]].

Dev-only `globalThis.tryBibleXMLExport()` / `tryBibleXMLImport(filePath?)`, like
`tryDataExport`.
