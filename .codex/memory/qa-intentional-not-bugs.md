---
name: qa-intentional-not-bugs
description: "Four presenter behaviours that look like bugs during QA but are intentional — don't re-file them"
metadata: 
  node_type: memory
  type: project
  originSessionId: c56a2c6e-966a-423b-8bff-4b856646eb12
  modified: 2026-09-27T01:19:43.389Z
---

Traced to source during the 2026-07-29 robot run. Each looks like a defect on screen; all
four are deliberate. Don't file them again.

1. **PDF, PPTX and DOCX documents all show a blank first slide card.** A 5-slide
   `.pptx` renders **6** cards, card #1 empty — and so does a 1-page `.pdf` (2 cards)
   and a `.docx`. All three prepend it: `PptxAppDocument.getSlides()`
   (`src/app-document-list/PptxAppDocument.ts:96`) and `DocxAppDocument.getSlides()`
   (`DocxAppDocument.ts:99`) prepend `slide0` with `htmlFilePath: BLANK_HTML_SLIDE_SRC`,
   `PdfAppDocument.getSlides()` (`PdfAppDocument.ts:76`) with
   `imagePreviewSrc: BLANK_IMAGE_SLIDE_SRC`; each returns `[slide0, ...dataList]`. So the
   real slide *n* is card *n+1* — matters when restoring a presented slide, and
   `owa_app_state` reports the padded `slideCount` (a 1-page PDF says 2). Re-verified
   live 2026-09-26; earlier revisions of this note named PPTX only, which made the PDF
   case look like a fresh bug.
2. **Presenting a bible item replaces the live background.** `applyNewBibleItemJson` calls
   `applyAttachBackground(...)` (`src/_screen/managers/ScreenBibleManager.ts:387`, the call
   at `:405` → `screenBackgroundHelpers.ts:6-28`); each bible item carries an *attached
   background*. Presenting one therefore also clears the Slide layer and swaps `BG`. To QA the screen
   block without disturbing a live setup, present onto an **empty** layer and note that the
   background will still change.
3. **`Syncing video time (from screen)` flooding the console at ~4 Hz** is a startup
   transient while the freshly-opened screen video catches up, not a runaway loop. Measured
   steady state: 1 seek per 15 s. Note the mini-preview `<video>` is **re-created** when the
   screen opens, so a probe listener attached to it silently goes stale — check
   `el.isConnected` before trusting a measurement. It is **no longer re-created on every
   loop** (fixed 2026-09-26): `_handleBackgroundVideo`'s end-of-clip fade called `render()`,
   which builds a whole new background from `genHtmlBackground`, and Chromium does not cache
   a `file://` media resource — so every lap was a full `range: bytes=0-` re-read of the
   clip. Measured live at 37 re-reads of one 2.6 MB background in a few minutes on ONE
   screen (~470 MB/hour; a 100 MB HD loop re-reads 100 MB a lap, all service, on the
   low-spec machines this app targets). The element already carries `loop`, so the
   re-render bought nothing but the opacity dip. `_fadeOverVideoLoop` now fades the playing
   element out and back in; re-measured after, 0 media requests across ~5 loops.
4. **A presented PDF slide showing a blank projector output with a scrollbar** is the
   `pdf-full-width` setting, not a render bug (verified 2026-08-04). `On Screen Width:
   Full Width` (`PageBaseAppearanceSettingComp`, shown in the previewer footer only while a
   PDF/DOCX is selected) makes `PdfSlideRenderContentComp` emit `width: 100%` with no height
   cap inside an `overflow: auto` box, so a 612×792 portrait page on a 1494×934 screen
   renders 1479×1914 and only its top ~49% is visible. Flip to `Not Full Width` to confirm
   the contain path — and put the setting back.

**How to apply:** when a QA observation looks wrong, read the source before filing;
recovering the *original* live background is possible from the presenter's network log (the
live video is fetched many times at load — see [[screen-draw-feature]] siblings and the
skill KB §8 redundant-fetch note).
