---
name: qa-intentional-not-bugs
description: "Three presenter behaviours that look like bugs during QA but are intentional — don't re-file them"
metadata: 
  node_type: memory
  type: project
  originSessionId: c56a2c6e-966a-423b-8bff-4b856646eb12
  modified: 2026-07-29T16:46:42.545Z
---

Traced to source during the 2026-07-29 robot run. Each looks like a defect on screen; all
three are deliberate. Don't file them again.

1. **PPTX documents show a blank first slide card.** A 5-slide `.pptx` renders **6** cards
   in the presenter, card #1 empty. `PptxAppDocument.getSlides()`
   (`src/app-document-list/PptxAppDocument.ts:95-139`) prepends `slide0` with
   `htmlFilePath: BLANK_HTML_SLIDE_SRC` and returns `[slide0, ...dataList]`. So the real
   slide *n* is card *n+1* — matters when restoring a presented slide.
2. **Presenting a bible item replaces the live background.** `applyNewBibleItemJson` calls
   `applyAttachBackground(...)` (`src/_screen/managers/ScreenBibleManager.ts:385` →
   `screenBackgroundHelpers.ts:5-25`); each bible item carries an *attached background*.
   Presenting one therefore also clears the Slide layer and swaps `BG`. To QA the screen
   block without disturbing a live setup, present onto an **empty** layer and note that the
   background will still change.
3. **`Syncing video time (from screen)` flooding the console at ~4 Hz** is a startup
   transient while the freshly-opened screen video catches up, not a runaway loop. Measured
   steady state: 1 seek per 15 s. Note the mini-preview `<video>` is **re-created** when the
   screen opens and on every loop, so a probe listener attached to it silently goes stale —
   check `el.isConnected` before trusting a measurement.

**How to apply:** when a QA observation looks wrong, read the source before filing;
recovering the *original* live background is possible from the presenter's network log (the
live video is fetched many times at load — see [[screen-draw-feature]] siblings and the
skill KB §8 redundant-fetch note).
