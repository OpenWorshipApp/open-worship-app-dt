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
- Regenerable caches are excluded by REGEX per path segment, because the real names are
  `<doc>.histories`, `<doc>.pdf-images`, `<doc>.pptx-htmls` and `<doc>.docx-docx-htmls` —
  a plain suffix list misses the docx one, and requiring the `.<ext>` is what keeps a
  user folder called `wedding-images`.
- Import **never overwrites**: identical contents (MD5) are skipped, a same-name file with
  different contents is kept and the archived one lands beside it as `name (1).ext`.
- The folder catalogue is `src/setting/directory-setting/dataDirectories.ts`, shared with
  the Path Settings page — add a folder there and both pick it up.
- The OS draws the File menu, so **CDP cannot reach it**. Dev builds expose
  `globalThis.tryDataExport()` / `tryDataImport(filePath?)` (same pattern as `tryPopup`)
  to drive the flows; `handleImporting` takes an optional path that skips the picker.

Gotcha found while building it: a checkbox list that derives its next value from the
`useState` value drops all but the last toggle when several land in one React batch — the
selection must be read from a ref. Docs: matrix NAV-17..NAV-19, workflow W-25.
