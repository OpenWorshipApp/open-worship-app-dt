---
name: injected-app-document-file-param
description: FIXED — ?file= is now gated on isPageAppDocumentEditor, so the bibleNote/lyricEditor/webEditor popups no longer log "App document file not found"
metadata:
  type: project
---

History: `getInjectedAppDocumentFilePath()` runs at **module load in every
renderer** and treats any `?file=` query param as a file in the *documents*
directory. But `?file=` is shared by the `bibleNote`, `lyricEditor` and
`webEditor` popups (`getParamFileFullName`, `src/helper/domHelpers.ts:493`),
whose files live elsewhere — so opening a Bible Note logged
`Error: App document file not found: Default.own` plus a `[trace]` every single
time (confirmed live 2026-07-25, Bible Note window console).

**FIXED:** the lookup (`src/app-document-list/appDocumentHelpers.tsx:658`) now
starts with `if (!appProvider.isPageAppDocumentEditor) return null;`, with a
comment naming the bible-note/lyric-editor/web-editor popups as the reason.

**How to apply:** a `[trace]` + `App document file not found: Default.own` on a
bible-note/lyric/web popup load is now a REAL finding, not pre-existing noise —
report it, don't wave it off.

**Sibling fact (same theme — injected renderer URL params):** `src/reader.tsx`
used to call `hideAllScreens()` unconditionally at module scope, so opening the
Reader as a popup blanked the projector. Since f7bb5988 (2026-08-16 "fixed popup
reader") it is gated on `getParamKeyValue(location.href, 'is-popup') ===
'true'`, set by `src/router/layoutHelpers.tsx` via `setParamKeyValue`.
Top-level side effects in entry-point `*.tsx` files can depend on query params —
check the entry file when a popup behaves differently from the tab.
