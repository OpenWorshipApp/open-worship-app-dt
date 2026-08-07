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
`AppDocument` (`src/slide-editor/canvas/CanvasItem.test.tsx` hits it).

**Why:** `PdfAppDocument`/`PptxAppDocument`/`DocxAppDocument` do NOT extend
`AppDocument`, so the existing imports there are safe and give a false sense
that adding one more is fine.

**How to apply:** anything `appDocumentHelpers` needs to do with a lyric needs
only its file path — use `checkIsVaryAppDocumentFilePathOnScreen(filePath)`
rather than building a document. Lyric rows construct their own
`LyricAppDocument` inside `src/lyric-list/`. See
[[lyric-in-documents-list]].
