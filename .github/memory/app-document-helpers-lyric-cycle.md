---
name: app-document-helpers-lyric-cycle
description: appDocumentHelpers must never import LyricAppDocument — the cycle makes `class extends undefined` throw
metadata:
  type: project
---

`src/app-document-list/appDocumentHelpers.tsx` must NOT statically import
`LyricAppDocument` (e.g. to add a lyric branch to `varyAppDocumentFromFilePath`).
`LyricAppDocument extends AppDocument`, and `AppDocument.ts` imports
`appDocumentHelpers` — so whenever `AppDocument` is the first module evaluated
the cycle closes on a half-initialised `AppDocument` and `LyricAppDocument.ts`
dies with `TypeError: Class extends value undefined is not a constructor or
null`. It does not fail every time, only on load orders that start at
`AppDocument`. The contract is pinned by
`src/app-document-list/appDocumentHelpers.test.tsx:825-847`, which asserts the
getter contract directly (same comment).

**Why:** `PdfAppDocument`/`PptxAppDocument`/`DocxAppDocument` do NOT extend
`AppDocument`, so the existing imports there are safe and give a false sense
that adding one more is fine.

**How to apply:** the dependency is now inverted, not avoided — the rule is
documented in-code at `appDocumentHelpers.tsx:808-812`.
`appDocumentHelpers.tsx:813-819` exports `setLyricAppDocumentGetter` (a
module-local, null-initialised getter); `src/lyric-list/LyricAppDocument.ts:298`
registers it on import, and `varyAppDocumentFromFilePath` calls the getter when
set (`appDocumentHelpers.tsx:830-832`, gated on `checkIsLyricFilePath`). Where
the getter may not be registered yet,
`await import('../lyric-list/LyricAppDocument')` first
(`appDocumentHelpers.tsx:710-715`). When only the path is needed,
`checkIsVaryAppDocumentFilePathOnScreen(filePath)` remains the right call. See
[[lyric-in-documents-list]].
