---
name: data-archive-owadata
description: File → Export/Import Data bundles whole data FOLDERS as an uncompressed .owadata.tar written straight from the user's dirs; the File menu now takes renderer-supplied items
metadata:
  type: project
---

Added 2026-08-05. `src/setting/data-archive/` — the backup / move-machines counterpart of
the per-item bundles ([[document-archive-owadoc]] is one item; this is the folders).

**Why the format looks odd — all three are load-bearing:**

- **Not gzipped.** The manifest cannot be one of tar's entries (see next point) so it is
  APPENDED afterwards, and `tar.r` only works on a plain tar. The data is already-
  compressed media anyway.
- **No staging copy.** `tarCreate` is given the user's own directory as `cwd`
  (`toCommonAncestor` finds the deepest shared parent and makes each folder a relative
  entry), so a multi-GB data set is read once and never duplicated to temp first.
- **`tarExtract` takes `entries`.** Import reads ONLY `manifest.json` to build the folder
  list, then unpacks only the chosen folders.

Other non-obvious bits:

- The **File menu** now renders `getCustomMenuItems('file')`, the same mechanism the
  language packs use for Tools — so the labels go through `tran` in the renderer and the
  click routes back to the window that registered them (the presenter). `initMenu` is
  re-run by `main:app:set-menu-items`, which is what makes the entries appear at all.
- **Dot-prefixed names never travel (2026-08-07).** `EXCLUDED_NAME_PATTERNS` carries `^\.`
  — `checkIsHiddenName` (`src/server/fileHelpers.ts`) in regex form, the app's one
  hidden-name rule, now shared by `fsListDirectories`, `getAllXMLFileKeys`, the bible
  download scan and the archive. What it really catches is the `._*` AppleDouble stubs a
  macOS machine or a USB round-trip leaves behind. `copyFilesInto` skips them on IMPORT
  too, because archives written before this still hold them. NOTE `fsListFiles` itself
  does NOT filter them, so those stubs still show up in the app's own file lists (a
  `._clock.html` is offered as a web background) — deliberately left alone, but it is a
  one-line fix if it ever matters.
- Regenerable caches are excluded by REGEX per path segment, because the real names are
  `<doc>.histories`, `<doc>.pdf-images`, `<doc>.pptx-htmls` and `<doc>.docx-docx-htmls` —
  a plain suffix list misses the docx one, and requiring the `.<ext>` is what keeps a
  user folder called `wedding-images`.
- Import **never overwrites**: identical contents (MD5) are skipped, a same-name file with
  different contents is kept and the archived one lands beside it as `name (1).ext`.
- The folder catalogue is `src/setting/directory-setting/dataDirectories.ts`, shared with
  the Path Settings page — add a folder there and both pick it up. **Two of its entries
  are not plain `select-dir-*` folders (2026-08-07):**
  - `getDirPath` — an APP-MANAGED folder, one the user cannot point anywhere, so there is
    no setting to read. Only `bibles-data` so far (`app-dir-bible-data`, resolved from
    `appLocalStorage.defaultStorage`, dynamic-imported so the catalogue stays light).
    Having it is also what keeps the folder OFF the Path Settings page
    (`selectableDataDirectories`) — there is nothing to choose. Import resolves it the
    same way, so the "no folder is selected yet" guard never fires for it.
  - `fileNamePattern` — archive only the TOP-LEVEL files that match. `bibles-data` uses
    `/\.xml$/i`: the user's hand-added XML bibles are theirs to lose, the downloaded
    databases beside them are hundreds of MB and re-downloadable. Such a folder is
    archived FILE BY FILE (`toTarEntries` → `bibles-data/KJV.xml`) while the manifest
    still names the FOLDER — import extracts by entry prefix, so they land back inside.
    Missing `fileNames` archives NOTHING of it, never the whole folder.
- `webs` (`BACKGROUND_WEB`) was missing from the catalogue entirely until 2026-08-07, so
  it was absent from BOTH the export panel and the Path Settings page — even though
  `selectPathForChildDir` had always been creating and setting it (it walks
  `defaultDataDirNames`, which did list it).
- The OS draws the File menu, so **CDP cannot reach it**. Dev builds expose
  `globalThis.tryDataExport()` / `tryDataImport(filePath?)` (same pattern as `tryPopup`)
  to drive the flows; `handleImporting` takes an optional path that skips the picker.

Gotcha found while building it: a checkbox list that derives its next value from the
`useState` value drops all but the last toggle when several land in one React batch — the
selection must be read from a ref. Docs: matrix NAV-17..NAV-19, workflow W-25.
