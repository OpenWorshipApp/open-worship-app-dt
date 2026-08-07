---
name: injected-app-document-file-param
description: Every renderer treats ?file= as an app-document name, so bibleNote/lyricEditor/webEditor popups always log a load error
metadata:
  type: project
---

`getInjectedAppDocumentFilePath()` (`src/app-document-list/appDocumentHelpers.tsx:604`) runs at
**module load in every renderer** and treats any `?file=` query param as a file in the
*documents* directory. But `?file=` is shared by the `bibleNote`, `lyricEditor` and `webEditor`
popups (`getParamFileFullName`, `src/helper/domHelpers.ts:471`), whose files live elsewhere — so
opening a Bible Note logs `Error: App document file not found: Default.own` plus a `[trace]`
every single time.

**Why:** confirmed live 2026-07-25 (Bible Note window console). Harmless today, but it also means
a documents-dir file that happens to share the popup's file name would make that popup believe it
has an injected app document.

**How to apply:** don't chase this error when debugging bible-note/lyric/web popups — it is
pre-existing noise, not a symptom. Fix direction: gate the lookup on the page type
(`appProvider.isPageAppDocumentEditor || isPagePresenter`) or fail quietly.
