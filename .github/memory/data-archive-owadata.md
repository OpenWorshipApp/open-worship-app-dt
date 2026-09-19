---
name: data-archive-owadata
description: "File → Export/Import Data bundles whole data FOLDERS as an uncompressed .owadata.tar written straight from the user's dirs; the File menu now takes renderer-supplied items"
metadata: 
  node_type: memory
  type: project
  originSessionId: 18527600-8c55-4e7d-aba1-6af7ebfc4f6c
  modified: 2026-09-19T15:03:12.165Z
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
  click routes back to the window that registered them. `initMenu` is re-run by
  `main:app:set-menu-items`, which is what makes the entries appear at all.
- **Both main-window pages carry them (2026-09-19).** `DataArchiveAppMenuComp` is mounted
  by the Presenter (`AppPresenterComp`) AND the Reader (`reader.tsx`) — the Reader had
  none, so a main window started on it showed only Print / Exit. It registers only when
  `checkIsMainWindow()`: the key is one entry, and a Reader opened as a POPUP would take
  the routing over and drop the main window's clicks once it closed. The component is
  the menu only; `dataArchiveMenuHelpers.tsx` (the flows, the archive / password /
  folder-picker modules) is imported on the CLICK, so neither page loads them at start.
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
- **A protected export's plain tar must not be `<archive>.part` (fixed 2026-09-19).** That
  is where `encryptFile` opens its OWN output, so the tar was truncated before it was read:
  every password-protected Export Data from 2026-08-07 on is an 80-byte container around
  nothing (64-byte header + 16-byte tag). It imports as tar's `TAR_BAD_ARCHIVE:
  Unrecognized archive format` and cannot be recovered, only exported again. The plain tar
  is `<archive>.plain.part` now, `encryptFile` / `decryptFile` refuse an input at their
  output or its `.part`, and import reports an empty archive in plain words. The other four
  archive kinds stage their plain tar in a temp dir and never collided.
- The folder catalogue is `src/setting/directory-setting/dataDirectories.ts`, shared with
  the Path Settings page — add a folder there and both pick it up. **Some of its entries
  are not plain `select-dir-*` folders (2026-08-07, 2026-09-19):**
  - `getDirPath` — an APP-MANAGED folder, one the user cannot point anywhere, so there is
    no setting to read: `bibles-data` (`app-dir-bible-data`) and, since 2026-09-19,
    `resources` (`app-dir-resources`, archived WHOLE), both resolved from
    `appLocalStorage.defaultStorageDirPath` by `getAppManagedDirPath`, dynamic-imported so
    the catalogue stays light.
    Having it is also what keeps the folder OFF the Path Settings page
    (`selectableDataDirectories`) — there is nothing to choose. Import resolves it the
    same way, so the "no folder is selected yet" guard never fires for it.
  - `fileNamePattern` — archive only the TOP-LEVEL files that match. `bibles-data` uses
    `/\.xml$/i`: the user's hand-added XML bibles are theirs to lose, the downloaded
    databases beside them are hundreds of MB and re-downloadable. Such a folder is
    archived FILE BY FILE (`toTarEntries` → `bibles-data/KJV.xml`) while the manifest
    still names the FOLDER — import extracts by entry prefix, so they land back inside.
    Missing `fileNames` archives NOTHING of it, never the whole folder.
  - `afterImport(dirPath, extractedDirPath)` — run inside `importDataArchive`'s loop, AFTER
    the copy and BEFORE the unpacked copy is deleted, so it reads what the ARCHIVE held.
    Only `resources` uses it: it puts each top-level sub-folder it restored on the
    Resources panel's list (`addResourcesFoldersToList`), because that list is a setting
    in `local-storage/`, which never travels — without it a new machine got the files and
    a panel showing none of them. Deduped, so a repeat import writes no setting.
- `webs` (`BACKGROUND_WEB`) was missing from the catalogue entirely until 2026-08-07, so
  it was absent from BOTH the export panel and the Path Settings page — even though
  `selectPathForChildDir` had always been creating and setting it (it walks
  `defaultDataDirNames`, which did list it).
- The OS draws the File menu, so **CDP cannot reach it**. Dev builds expose
  `globalThis.tryDataExport()` / `tryDataImport(filePath?)` (same pattern as `tryPopup`)
  to drive the flows; `handleImporting` takes an optional path that skips the picker.
  They are set by `DataArchiveAppMenuComp`'s module and import the flows lazily too.
  Windows UI Automation does not see Electron's menu bar either (the window exposes only
  its `RootView` pane); `PrintWindow` on the process's NEW top-level `Chrome_WidgetWin_1`
  after Alt, ↓ is a picture of the open dropdown and of nothing else on screen.

Gotcha found while building it: a checkbox list that derives its next value from the
`useState` value drops all but the last toggle when several land in one React batch — the
selection must be read from a ref. Docs: matrix NAV-17..NAV-19, workflow W-25.
