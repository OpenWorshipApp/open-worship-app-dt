---
name: injected-app-document-file-param
description: FIXED — ?file= is now gated on isPageAppDocumentEditor, so the bibleNote/lyricEditor/webEditor popups no longer log "App document file not found"
metadata:
  type: project
---

History: `getInjectedAppDocumentFilePath()` runs at **module load in every
renderer** and treats any `?file=` query param as a file in the *documents*
directory. But `?file=` is shared by the `bibleNote`, `lyricEditor` and
`webEditor` popups (`getParamFileFullName`, `src/helper/domHelpers.ts`),
whose files live elsewhere — so opening a Bible Note logged
`Error: App document file not found: Default.own` plus a `[trace]` every single
time (confirmed live 2026-07-25, Bible Note window console).

**FIXED:** the lookup's file-name step (`getInjectedAppDocumentFileFullName` in
`src/app-document-list/appDocumentHelpers.tsx`) now starts with `if (!appProvider.isPageAppDocumentEditor) return null;`, with a
comment naming the bible-note/lyric-editor/web-editor popups as the reason.

**How to apply:** a `[trace]` + `App document file not found: Default.own` on a
bible-note/lyric/web popup load is now a REAL finding, not pre-existing noise —
report it, don't wave it off.

**Sibling fact (same theme — injected renderer URL params):** `src/reader.tsx`
used to call `hideAllScreens()` unconditionally at module scope, so opening the
Reader as a popup blanked the projector. From f7bb5988 (2026-08-16 "fixed popup
reader") it was gated on an `is-popup` query param set by
`src/router/layoutHelpers.tsx`; since 05b26e4c (2026-08-30) it asks main
instead — `checkIsMainWindow()` (`all:app:check-is-main-window`), one second
after load — and only the main window hides the screens.
Top-level side effects in entry-point `*.tsx` files can depend on query params —
check the entry file when a popup behaves differently from the tab.
