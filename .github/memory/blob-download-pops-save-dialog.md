---
name: blob-download-pops-save-dialog
description: An `<a download>` blob click in the renderer pops a native Save As dialog and orphans a .tmp — the app registers no will-download handler
metadata:
  type: project
---

Browser-style downloads do **not** work silently in this app. `electron/` has no
`session.on('will-download')` handler anywhere, so Chromium falls back to its
default: a native **Save As** dialog (`#32770` window titled with the `blob:`
URL) for every `<a download>` click. Until it is answered the bytes sit in
`~/Downloads/<uuid>.tmp` and no named file ever appears.

The dialog is easy to miss — it can sit behind the Electron window, and the
renderer keeps running, so the calling code looks like it succeeded. Verified
2026-07-27: five stacked orphan dialogs + five `.tmp` files accumulated from
export attempts.

Consequences worth knowing:

- `getDownloadPath()` (`app.getPath('downloads')`) is **not** where a browser
  download lands unless the user picks it in the dialog, so code cannot assume a
  file is there, reveal it, or place sibling files next to it.
- A download triggered from `evaluate_script` without user activation is dropped
  entirely by Chromium — a CDP probe that "does nothing" is not proof the feature
  is broken. Drive the real button instead.
- `downloadBibleJSON` in `src/setting/bible-setting/BibleXMLDataPreviewComp.tsx`
  still uses this pattern, so exporting bible XML JSON hits the same dialog.

**Why:** the bible MS Word export was rewritten to build the `.docx` in the
renderer and hand it to the browser; it silently produced nothing but a `.tmp`.

**How to apply:** to write a generated file from the renderer, use the app's own
fs helpers — `fsWriteFile(pathJoin(getDownloadPath(), name), Buffer.from(bytes))`
(exemplars: `exportBibleMSWord` in `src/ms-office/docxHelpers.ts`,
`downloadImageBase64Data` in `src/server/appHelpers.ts`, and
`src/graph-view/graphExportHelpers.ts:210`). That keeps the real
path, so `showFileOrDirExplorer` can reveal the file. Pass it the **file**, never
the directory — `shell.showItemInFolder` on a directory selects it inside its
parent instead of opening it. See [[tran-missing-key-throws-in-dev]] for the
other trap in this flow.
