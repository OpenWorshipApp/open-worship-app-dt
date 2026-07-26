---
name: apply-settings-skips-popups
description: Apply Settings reloads only the main window — every open popup keeps the stale language/theme/paths
metadata:
  type: project
---

`forceReloadAppWindows()` → IPC `all:app:force-reload` → `ElectronAppController.reloadAll()`,
which iterates `allWindows()` — and that returns only
`[mainController.win, lwShareController.win]` (`electron/ElectronAppController.ts`). Popup
windows are created in `createPopupWindow()` (`electron/electronHelpers.ts`) off the
`setWindowOpenHandler` path and are **never registered anywhere `allWindows()` can see**.

So `Apply Settings` reloads the Presenter/Reader/Editor main window only. Settings, About,
Finder, and the Document/Lyric/Bible-note/Web editor popups keep the **old** language, theme,
font and directory paths until they are closed and reopened.

**Why:** observed live 2026-07-26 (robot-test run 20260726-1045). Switching to Khmer left the
Settings window itself in English; switching back to English left an open Document Editor popup
in Khmer. Both corrected instantly on a manual reload, confirming a missed reload rather than a
translation gap. Worst case is the Settings window — the user changes the language there and it
looks like nothing happened.

**How to apply:** don't diagnose this as a `tran()`/dictionary problem. Fix direction: use
`BrowserWindow.getAllWindows()` in `allWindows()`, register popups as they're created, or
broadcast the reload to all renderers instead of enumerating windows. When robot-testing a
locale/theme switch, reload popups manually before judging their labels.
Related: [[tran-missing-key-throws-in-dev]].
