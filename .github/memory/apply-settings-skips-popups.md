---
name: apply-settings-skips-popups
description: Apply Settings used to reload only the main window, leaving popups stale — FIXED on refactor22
metadata:
  type: project
---

**FIXED 2026-07-29 on `refactor22`** (uncommitted). `ElectronAppController.reloadAll()` used
to iterate `allWindows()`, which returns only `[mainController.win, lwShareController.win]`,
so every popup (Settings, About, Finder, the document/lyric/bible-note/web editors) kept the
old language, theme, font and directory paths. It now iterates
`BrowserWindow.getAllWindows()` and skips destroyed windows plus `htmlFiles.screen` outputs
(reloading a live output would blank the presentation).

**Why:** popups are created in `createPopupWindow()` (`electron/electronHelpers.ts`) off the
`setWindowOpenHandler` path and are registered nowhere `allWindows()` can see. `allWindows()`
is still used by `resetThemeBackgroundColor()` and was deliberately left alone.

**How to apply:** this also explains away a whole class of false "missing translation"
findings. Labels rendered by components that don't re-render on a locale switch (Settings'
`Path Settings`, `Theme`, `Font Family`, `Other General Options`, the General/Bible tabs)
stayed English until the window reloaded — they always had their `tran()` call and their km
dictionary entry. Before filing an untranslated-label bug, reload the window first.
Related: [[tran-missing-key-throws-in-dev]], [[screen-change-bible-dead-ipc]].
