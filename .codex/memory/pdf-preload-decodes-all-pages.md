---
name: pdf-preload-decodes-all-pages
description: FIXED 2026-08-05 — presenter load used to decode every page of the selected PDF; preload is now file-scoped and sizes come from the PNG header
metadata: 
  node_type: memory
  type: project
  originSessionId: 184f20c7-313f-457c-a9cb-e1f78fba99ec
  modified: 2026-08-05T11:34:32.681Z
---

Found and FIXED 2026-08-05 (uncommitted). Loading `presenter.html` with a PDF merely
**selected** used to fetch and fully decode all its page PNGs: for an 88-page PDF, 22 MB on
disk → **162.7 MB of bitmap allocated in parallel**. Measured live: now **0 loads / 0 MB**.

Two independent causes, both fixed:

1. **`preloadAttachedBackground` forced a full document parse.** It looped per slide, so
   `items ??= await varyAppDocument.getSlides()` ran just to harvest ids it discarded. But
   `AttachBackgroundManager`'s cache is keyed by **`filePath` alone** (`cached.set(filePath,
   data)`); the `id` only indexes the already-loaded map, and every slide carries its
   document's own `filePath`. So **one** call warms the entry for every id. It now takes only
   the document and fires a single `getAttachedBackground(filePath)`.
   `layoutHelpers.tsx` lost the now-invalid second argument.
2. **`getImageSize` decoded whole images to read two integers.** `pdfHelpers.ts` now has
   `readPngSize()`, which reads the 24-byte PNG header (IHDR: width at byte 16, height at 20,
   big-endian) via `appProvider.fileUtils.openSync/readSync/closeSync` and falls back to the
   old `new Image()` decode for anything that isn't a well-formed PNG. Same values —
   verified 612×792 against the real file.

**Why:** performance is this project's rule #1 and both costs were invisible on a dev machine.
Guard tests exist — `appDocumentHelpers.test.tsx` asserts `getAttachedBackground` is called
exactly once, with no id, and that `getSlides` is **never** called; `pdfHelpers.test.ts` asserts
the header path decodes nothing and that a non-PNG still falls back.

**How to apply:** never reintroduce a per-slide loop in that preload. Note this does NOT make
`PdfAppDocument.getSlides()` itself cheap — displaying a PDF still renders every page thumbnail
(a separate, arguably lazy-mountable cost, like `LazyMountVideoComp` does for videos).
Related: [[onscreen-check-must-not-parse]] (same "don't parse the document to answer a cheap
question" principle).
