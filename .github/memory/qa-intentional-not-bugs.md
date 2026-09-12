---
name: qa-intentional-not-bugs
description: "Four presenter behaviours that look like bugs during QA but are intentional — don't re-file them"
metadata: 
  node_type: memory
  type: project
  originSessionId: c56a2c6e-966a-423b-8bff-4b856646eb12
  modified: 2026-08-05T03:57:24.171Z
---

Traced to source during the 2026-07-29 robot run. Each looks like a defect on screen; all
four are deliberate. Don't file them again.

1. **PPTX documents show a blank first slide card.** A 5-slide `.pptx` renders **6** cards
   in the presenter, card #1 empty. `PptxAppDocument.getSlides()`
   (`src/app-document-list/PptxAppDocument.ts:76-141`) prepends `slide0` with
   `htmlFilePath: BLANK_HTML_SLIDE_SRC` and returns `[slide0, ...dataList]`. So the real
   slide *n* is card *n+1* — matters when restoring a presented slide.
2. **Presenting a bible item replaces the live background.** `applyNewBibleItemJson` calls
   `applyAttachBackground(...)` (`src/_screen/managers/ScreenBibleManager.ts:387`, the call
   at `:405` → `screenBackgroundHelpers.ts:6-28`); each bible item carries an *attached
   background*. Presenting one therefore also clears the Slide layer and swaps `BG`. To QA the screen
   block without disturbing a live setup, present onto an **empty** layer and note that the
   background will still change.
3. **`Syncing video time (from screen)` flooding the console at ~4 Hz** is a startup
   transient while the freshly-opened screen video catches up, not a runaway loop. Measured
   steady state: 1 seek per 15 s. Note the mini-preview `<video>` is **re-created** when the
   screen opens and on every loop, so a probe listener attached to it silently goes stale —
   check `el.isConnected` before trusting a measurement.
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
