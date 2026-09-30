# Presenter-Middle — exhaustive test-path inventory

Assigned area: **presenter middle column** — presenter tabs + slide previewer +
auto-play + lyric handler + bible previewer + bible custom style.

Legend: 🖱️ click · 🖱️🖱️ dbl-click · 🖱️R right-click · ⇕ drag/drop · ⌨️ key ·
🎚️ range slider · ⌨️✎ text/number input · 🖐️ hover.

> **Major structural drift vs. the matrix (verify these first):**
> 1. **The Foreground tab is no longer a split tab.** `PresenterComp`'s main tab
>    bar is now only `Documents`/`Lyrics`/`Bibles` (`tabTypeList`,
>    `PresenterComp.tsx:120-124`). Foreground is a *separate* toggle
>    (`ForegroundFloatingComp`, `PresenterComp.tsx:127-181`) that opens a
>    **`FloatingWidgetComp`**, not a pane in the split. → PM-01 REFINE.
> 2. **Bible custom style is no longer an inline split card.** It is now a
>    **floating widget** (`BibleCustomStyleFloatingComp`, portaled to `body`,
>    mounted once in `AppPresenterComp.tsx:83`) opened by a toggle button in the
>    bible-previewer footer (`BibleCustomStyleFloatingToggleComp`). → PM-13/PM-14
>    REFINE + new toggle/controls GAPs.
> 3. **Presenting a slide/verse is a single-click TOGGLE**, not a double-click
>    (`handleVarySlideSelecting` → `ScreenVaryAppDocumentManager.handleSlideSelecting`,
>    `varyAppDocumentHelpers.ts:35-52`; matches KB §5). → PM-06/PM-11 REFINE.

---

## A. Presenter tab bar + full-view + floating-widget chrome

| Proposed ID | Target (component) | Interaction | Keys | Given | When | Then (observable) | Source (file:line) | Status |
|---|---|---|---|---|---|---|---|---|
| PM-01 | `PresenterComp` main tab bar via `TabRenderComp` | 🖱️ each of `Documents`/`Lyrics`/`Bibles` | — | presenter open | click a not-active tab, then click it again | tab toggles into/out of the horizontal split (`ResizeActorComp` pane count changes); button gains/loses `.active`; last tab can't be removed (min 1) | `PresenterComp.tsx:288-317`, `:187-211`, `TabRenderComp.tsx:46-67` | REFINE — matrix lists 4 incl. `Foreground`; only d/l/b are split tabs now; Foreground is a floating toggle (PM-37). Pass cond should be pane-count/`.active`, not "Foreground". |
| PM-02 | `PresenterComp` tab | 🖱️R a tab | — | ≥2 tabs active | right-click one tab | that tab is **soloed** (only it remains active); no browser menu (preventDefault); `setTabKeys1(value,{isSolo:true})` | `PresenterComp.tsx:213-232`, `TabRenderComp.tsx:50-63` | COVERED |
| PM-03 | Live tab marker | observe | — | content of a tab is on screen | present a doc/lyric/bible | the owning tab button gets `.app-on-screen` (via `useIsOnScreen`/`checkIsOnScreen`) | `TabRenderComp.tsx:17-35,56-60` | COVERED |
| PM-04 | `RenderToggleFullViewComp` | 🖱️ toggle on+off | — | presenter open | click the fullscreen button twice | `.presenter-manager` gains/loses `.app-full-view`; icon flips `bi-arrows-fullscreen`↔`bi-fullscreen-exit`; button flips `btn-info`↔`btn-outline-info`; title "Full view"↔"Exit full view" | `PresenterComp.tsx:52-83,289-293,305-308` | COVERED |
| PM-37 | `ForegroundFloatingComp` toggle | 🖱️ toggle on+off | — | presenter open | click the `Foreground` tab button | on: a `FloatingWidgetComp` titled `Foreground` mounts (`.floating-widget`) with `LazyPresenterForegroundComp`; the `f` tab shows `active`; off: widget unmounts. Title span gets `.app-on-screen` when any foreground is live | `PresenterComp.tsx:127-181,304` | GAP |
| PM-38 | `FloatingWidgetComp` collapse toggle (chevron) | 🖱️ | — | Foreground or Bible-Properties widget open | click the header chevron button | `.floating-widget--collapsed` toggles; body height → `COLLAPSED_HEIGHT`; icon `bi-chevron-down`↔`bi-chevron-up` | `FloatingWidgetComp.tsx:268-284,315` | GAP |
| PM-39 | `FloatingWidgetComp` close (`bi-x-lg`) | 🖱️ | — | a floating widget open | click the header X | `onClose` fires → widget unmounts (Foreground: `setIsShowing(false)`; Bible: `setIsBibleCustomStyleFloatingShowing(false)`); its toggle button reverts to `btn-outline-info` | `FloatingWidgetComp.tsx:285-293`, `PresenterComp.tsx:164-166`, `BibleCustomStyleFloatingComp.tsx:33-35` | GAP |
| PM-40 | `FloatingWidgetComp` drag-move | ⇕ (pointer drag on blank header) | — | a floating widget open | pointer-drag the title/blank area | widget repositions (`left/top` style change); `.floating-widget--moving` during; rect persisted to `persistKey` setting on release (survives reopen) | `FloatingWidgetComp.tsx:242-259,205-240,171-203` | GAP |
| PM-41 | `FloatingWidgetComp` resize handles | ⇕ (pointer drag on a `--resize-handle`) | — | a floating widget open (not collapsed) | pointer-drag one of the 8 resize handles | widget resizes (`width/height` style change, clamped to min/max); `.floating-widget--resizing` during; rect persisted on release | `FloatingWidgetComp.tsx:333-344,205-240` | GAP |

## B. Documents/Lyrics slide previewer (`VarySlidesPreviewerComp` + `VarySlideRenderComp` + footer)

The Lyrics tab reuses the exact same previewer (`LyricSlidesPreviewerComp.tsx:41-49`),
so every B-row applies to lyric slides too.

| Proposed ID | Target (component) | Interaction | Keys | Given | When | Then (observable) | Source (file:line) | Status |
|---|---|---|---|---|---|---|---|---|
| PM-05 | Slide thumbnails (`VarySlideRenderComp`) | observe | — | a doc/lyric selected | open the tab | one `.app-vary-app-document-item` card per slide; preview renders inside `ShadowingFillParentWidthComp` shadow root; header shows index badge + `WxH` | `VarySlideRenderComp.tsx:293-353`, `VarySlidesComp.tsx:299-327` | COVERED |
| PM-06 | Slide thumb present | 🖱️ (single-click TOGGLE) | — | a slide not live | click the card once, then again | 1st click: slide live → card gets `HIGHLIGHT_SELECTED animation` + `.app-on-screen` mirrors; 2nd click on the SAME card clears that layer. NOT a dbl-click (dbl nets to nothing) | `VarySlideRenderComp.tsx:327-335`, `varyAppDocumentHelpers.ts:35-52` | REFINE — matrix says 🖱️🖱️; real behavior is single-click toggle (KB §5). |
| PM-07 | Slide thumb context menu | 🖱️R | — | a slide card | right-click a card | `AppContextMenuComp` opens with **`Choose Color`** (always; `bi-record-circle`, opens color picker). If a background is attached, ALSO **`Remove Attached Background`** items above it | `VarySlideRenderComp.tsx:274-292`, `slideItemRenderHelpers.tsx:195-221`, `dragHelpers` `genRemovingAttachedBackgroundMenu` | REFINE — matrix says only "context menu"; enumerate the 2 conditional items. |
| PM-08 | Thumbnails keyboard nav | ⌨️ | `ArrowLeft/Up/PageUp`=prev, `ArrowRight/Down/PageDown`/`Space`=next, `Shift+Space`=prev | a slide already live + container focused | focus `.app-slide-items-container`, press keys | the LIVE selection advances to next/prev enabled slide on its screen(s); disabled slides skipped; **no-op if no slide is live or container not `document.activeElement`**. `Space` is NEXT, not a toggle | `VarySlidesComp.tsx:52-59,91-97`, `varyAppDocumentHelpers.ts:185-212,112-179` | REFINE — matrix (PM-08/KB-08) says "Space toggles"; it navigates next. Add focus + live-slide precondition. |
| PM-09 | Thumb size slider (footer `AppRangeComp`) | 🎚️ + 🖱️ zoom btns + ⌨️wheel | `Ctrl`+wheel | doc/lyric open | drag range (`min=20 max=200 step=1`), or click `bi-zoom-out`/`bi-zoom-in`, or Ctrl+wheel over the list | thumbnail cards rescale (card `width` px changes); title "Slide Thumbnail Size Scale" | `AppDocumentPreviewerFooterComp.tsx:78-83,121-126`, `AppRangeComp.tsx:234-268,240-254`, `appDocumentTypeHelpers.tsx:14-16` | REFINE — matrix has slider only; add the zoom-out/zoom-in buttons + Ctrl+wheel sub-controls. |
| PM-10 | `SlideAutoPlayComp` (Documents footer) | 🖱️ expand / ⌨️✎ secs / 🖱️ play / 🖱️ pause / 🖱️ close | — | **a slide is selected/live** (only then does the widget mount) | click `bi-stopwatch-fill`→expand; edit `M:` number (`min=0`); click `bi-play` (btn-outline-primary); it becomes `bi-pause-circle-fill`; click red `bi-x-lg` | expands to `.slide-auto-play.show`; play → live slide auto-advances every N s via `onNext`→`handleNext`; pause stops; X collapses to icon | `SlideAutoPlayComp.tsx:90-169`, `VarySlidesComp.tsx:202,320-325` | REFINE — enumerate play vs pause icons + `M:` input; note only visible when `isAnyItemSelected`. |
| PM-42 | Click a **disabled** slide | 🖱️ | — | a slide with `isDisabled` (opacity 0.5, title "This slide is disabled") | click it on the presenter | **no-op** (early return; not presented). File-based disabled slides also have `pointer-events:none` | `VarySlideRenderComp.tsx:300-318,328-333` | GAP |
| PM-43 | Slide reorder within doc | ⇕ | — | a doc with ≥2 editable slides | drag one card, drop onto another card of the same doc | card opacity dips to 0.5 on drag-over; on drop `moveSlideToIndex` reorders (order persists); drop is ignored if filePaths differ | `VarySlideRenderComp.tsx:234-268,321-325` | GAP |
| PM-44 | Attach background to a slide | ⇕ | — | a background color/image/video/web/camera item elsewhere | drag a bg item, drop onto a slide card | `handleAttachBackgroundDrop` attaches it; the card shows the attached bg + an `AttachBackgroundIconComponent`; drag-over dims card to 0.5 | `VarySlideRenderComp.tsx:234-255`, `slideItemRenderHelpers.tsx:63-154` | GAP |
| PM-45 | `Remove Attached Background` menu item | 🖱️R → 🖱️ | — | a slide WITH an attached background | open its context menu → click the remove item(s) | attached bg cleared from the card; attach-icon disappears | `VarySlideRenderComp.tsx:274-283`, `dragHelpers` `genRemovingAttachedBackgroundMenu` | GAP |
| PM-46 | Previewer container context menu | 🖱️R on empty list area | — | doc open | right-click the `.app-slide-items-container` background (not a card) | `varyAppDocument.showContextMenu(event)` → document-level menu (add/insert slide etc.) | `VarySlidesPreviewerComp.tsx:82-86,123` | GAP |
| PM-47 | Drop media files onto previewer | ⇕ (files) | — | an editable `AppDocument` open | drag image/video file(s) over the list, drop | drag-over dims container to 0.5 (gate testable synthetically); supported files → new slides appended; unsupported → toast "Insert Image or Video / Unsupported file type!" (real drop needs `readDroppedFiles`, KB) | `VarySlidesPreviewerComp.tsx:32-45,87-103` | GAP |
| PM-48 | Previewer Ctrl+wheel zoom | ⌨️wheel | `Ctrl`+wheel | doc open | Ctrl+scroll over the list container | thumbnails rescale via `useZoomingRegistering` (same value as PM-09 slider) | `VarySlidesPreviewerComp.tsx:105-110`, `AppRangeComp.tsx:84-158` | GAP |
| PM-49 | Footer history badges (`HistoryPreviewerFooterComp`) | observe + 🖱️ a badge | — | presenter, a slide presented | present a few slides; then click a history index badge | footer shows last ≤3 presented indices (`RenderSlideIndexComp`); clicking a non-in-slide badge scrolls to + highlights that slide card | `AppDocumentPreviewerFooterComp.tsx:33-76,141-145`, `RenderSlideIndexComp.tsx:20-42` | GAP |
| PM-50 | Footer path preview click (`PathPreviewerComp`) | 🖱️ | — | a normal (non-injected) doc, `isDisableChanging` false | click the footer filename path | opens same-dir slide picker → selects another slide doc; if none found → app alert "No Slide Available / No other slide found…" | `AppDocumentPreviewerFooterComp.tsx:97-111,127-139` | GAP |
| PM-51 | Missing-fonts banner expand | 🖱️ | — | selected doc references fonts not installed | click the `Missing fonts (N)` alert header | `aria-expanded` flips; chevron `bi-chevron-right`↔`bi-chevron-down`; font-badge list shows/hides | `MissingFontFamilyBannerComp.tsx:27-61`, `VarySlidesComp.tsx:300-303` | GAP |
| PM-52 | Missing-font badge search | 🖱️ | — | banner expanded | click a font badge (`bi-search`) | `searchMissingFontFamily(font)` runs (opens external search — treat as EX-04 click-eligibility) | `MissingFontFamilyBannerComp.tsx:72-90` | GAP |
| PM-53 | Slide fail-to-load Reload | 🖱️ | — | `getSlides()` returned `null` | click `Reload` (btn-primary) | `startLoading()` → `setVarySlide(undefined)` → re-fetch; loading spinner then slides/again-error | `VarySlidesComp.tsx:228-243,172-174` | GAP |
| PM-54 | PDF/PPTX/DOCX empty Refresh buttons | 🖱️ | — | a PDF/PPTX/DOCX doc with 0 rendered pages | click `Refresh PDF Images` / `Refresh PPTX Slides` / `Refresh DOCX Pages` | removes cached preview + fires `fileSource.fireUpdateEvent()` → re-render; warning text "No slides/pages to display" clears when pages appear | `VarySlidesComp.tsx:245-298,124-155` | GAP |

## C. Presenter in-panel editing menu (Documents tab, editable doc only)

Renders only when `appProvider.isPagePresenter && varyAppDocument.isEditable`
AND there are undo/redo/dirty changes or a wrong-dimension (`isShowingTools || extraChildren`).

| Proposed ID | Target (component) | Interaction | Keys | Given | When | Then (observable) | Source (file:line) | Status |
|---|---|---|---|---|---|---|---|---|
| PM-55 | `FileEditingMenuComp` Undo | 🖱️ | — | editable doc with undo history | click `bi-arrow-90deg-left` (btn-info) | `historyUndo()`; button disabled (opacity 0.1) when `!canUndo` | `editingHelpers.tsx:145-168`, `VarySlidesPreviewerComp.tsx:130-150`, `SlidesMenuComp.tsx:64-73` | GAP |
| PM-56 | `FileEditingMenuComp` Redo | 🖱️ | — | after an undo | click `bi-arrow-90deg-right` (btn-info) | `historyRedo()`; disabled when `!canRedo` | `editingHelpers.tsx:149-179` | GAP |
| PM-57 | `FileEditingMenuComp` Save (`bi-floppy`) | 🖱️ | `Ctrl+S` | dirty doc (`canSave`) in presenter | click Save (btn-success) | `editableDocument.save()`; button enabled only while dirty; title shows `[Ctrl + S]` | `editingHelpers.tsx:101-128,63-66` | GAP |
| PM-58 | `FileEditingMenuComp` Discard (`bi-x-octagon`) | 🖱️ → cancel | — | dirty doc | click Discard (btn-danger) → confirm "Discard changed / Are you sure…" → **Cancel** (EX-05) | confirm dialog appears; Cancel leaves history intact (never confirm in QA — clears undo stack) | `editingHelpers.tsx:87-117` | GAP |
| PM-59 | Fix slide dimension (`CheckingDimensionComp`) | 🖱️ | — | an `AppDocument` whose slides mismatch the screen display | click the btn-warning (`bi-aspect-ratio` red + `bi-hammer`) | `fixSlidesDimensionForDisplay(screenDisplay)`; button only present while `wrongDimension !== null` | `SlidesMenuComp.tsx:13-49,64-73` | GAP |

## D. PDF/DOCX page-base appearance bar (`PageBaseAppearanceSettingComp`, PDF/DOCX docs only)

| Proposed ID | Target (component) | Interaction | Keys | Given | When | Then (observable) | Source (file:line) | Status |
|---|---|---|---|---|---|---|---|---|
| PM-60 | On-Screen-Width radios | 🖱️ | — | a PDF/DOCX doc selected in presenter | click `Not Full Width` / `Full Width` radio (btn-group) | `setIsPdfFullWidth` + updates every live screen's `varySlideData.isRenderFullWidth`; selected radio checked; the live PDF/DOCX on the screen output re-lays (screen-only — verify on `screen.html`, KB) | `PageBaseAppearanceSettingComp.tsx:60-97`, `AppDocumentPreviewerComp.tsx:130-137` | GAP |
| PM-61 | Preview-BG color picker (`VirtualBGColorSettingComp`) | 🖱️ (open) / ⌨️✎ color / 🖱️R (clear) | — | a PDF/DOCX doc selected | click `bi-record-circle` → OS color input; pick a color; right-click the button (or red `bi-x-lg`) to clear | preview/virtual bg color applies to the page-base preview + live screens (`virtualBackgroundColor`); clear resets; empty icon `#adb5bd30` | `PageBaseAppearanceSettingComp.tsx:98-109`, `VirtualBGColorSettingComp.tsx:51-96` | GAP |

## E. Bible previewer (Bibles tab) + Bible custom style (floating)

| Proposed ID | Target (component) | Interaction | Keys | Given | When | Then (observable) | Source (file:line) | Status |
|---|---|---|---|---|---|---|---|---|
| PM-11 | Lyrics tab verse present | 🖱️ (single-click toggle) | — | a lyric selected | click a lyric-slide card once | verse goes live (`.app-on-screen`); click same card clears (reuses `VarySlidesPreviewerComp`) | `LyricSlidesPreviewerComp.tsx:41-49`, `varyAppDocumentHelpers.ts:35-52` | COVERED (interaction = single-click, not 🖱️🖱️) |
| PM-12 | Bibles tab verse present | 🖱️🖱️ | — | a verse looked up (`useBibleItemShowing` auto-opens the `b` tab) | double-click the rendered verse in `BibleViewRendererComp` | verse presented; `.app-on-screen`; mirrors on mini-screen | `PresenterBiblePreviewerRenderComp.tsx:10-20`, `PresenterComp.tsx:239-249` | COVERED |
| PM-13 | `ScreenBibleAppearanceComp` (Appearance) | open floating | — | a bible verse live | open Bible Properties floating (PM-62) → Appearance card | Appearance card renders inside the floating widget (not an inline split anymore) | `BibleCustomStyleComp.tsx:28-41`, `ScreenBibleAppearanceComp.tsx:12-49` | REFINE — matrix says "open the Bibles-tab split"; now a floating widget. |
| PM-14 | `ScreenBibleTextShadow` (Text Shadow) | open floating | — | bible verse live | open Bible Properties floating → Text Shadow card | Text Shadow demo grid renders in the floating widget | `BibleCustomStyleComp.tsx:35-38`, `ScreenBibleTextShadow.tsx:150-204` | REFINE — same floating-widget drift. |
| PM-62 | `BibleCustomStyleFloatingToggleComp` | 🖱️ toggle | — | presenter, bible previewer footer visible (hover to reveal auto-hide footer) | click the `bi-book`+`bi-gear-fill` button ("Bible Properties") twice | on: `BibleCustomStyleFloatingComp` mounts (portaled `.floating-widget` titled "Bible Properties"); button → `btn-info` solid; off: unmounts, button → `btn-outline-info` | `BibleCustomStyleFloatingToggleComp.tsx:7-24`, `BibleCustomStyleFloatingComp.tsx:23-49`, `AppPresenterComp.tsx:83` | GAP |
| PM-63 | Appearance → Font Size slider | 🎚️ | `Ctrl`+wheel | Bible Properties open + verse live | drag the Font Size `AppRangeComp` (`min=1 max=200 step=1`) or zoom-in/out | live bible text font size restyles (`ScreenBibleManager` applies); `(Npx)` success badge updates | `ScreenBibleAppearanceComp.tsx:36-47`, `ScreenBibleManager.ts:275` | GAP |
| PM-64 | Appearance → Font Color picker | ⌨️✎ (color) | — | Bible Properties open + verse live | change the `input[type=color]` swatch | live bible text color changes (`setColor`→`ScreenBibleManager`) | `ScreenBibleAppearanceComp.tsx:16-34` | GAP |
| PM-65 | Text Shadow → `Reset White` | 🖱️ | — | Bible Properties open + verse live | click the `Reset White` demo box | `applyTextStyle({color:white, textShadow:none})` — live text turns white, shadow cleared | `ScreenBibleTextShadow.tsx:113-116,150-170,83-89` | GAP |
| PM-66 | Text Shadow → `Reset Black` | 🖱️ | — | same | click the `Reset Black` demo box | live text turns black, shadow cleared | `ScreenBibleTextShadow.tsx:113-116` | GAP |
| PM-67 | Text Shadow → outline option (G1–G4 `Outline1/2/3`) | 🖱️ | — | same | click any outline demo box | `applyTextStyle({textShadow: that box's shadow, color})` — live bible text gets that outline/shadow; box set varies by current color (white/black hide the colored G1/G2 group) | `ScreenBibleTextShadow.tsx:24-149,155-170` | GAP |

> Bible-previewer footer also hosts `FullScreenButtonComp`, `NewLineSettingComp`,
> `BibleModelInfoSettingComp`, `BibleViewSettingComp` font slider
> (`BiblePreviewerRenderComp.tsx:96-111`) — these belong to the **bible-reader**
> shared component (RD scope), not enumerated here to avoid double-owning them.

## F. Lyric handler control panel (`LyricPreviewerComp`, Lyrics tab)

| Proposed ID | Target (component) | Interaction | Keys | Given | When | Then (observable) | Source (file:line) | Status |
|---|---|---|---|---|---|---|---|---|
| PM-68 | Lyric font family + weight (`FontFamilyControlComp`) | 🖱️/⌨️✎ | — | a lyric selected | change Font family / weight in the "Control" card | lyric preview (`RenderPreviewBodyComp`) re-renders in the new font/weight (`lyricEditingManager.fontFamily/fontWeight`) | `LyricPreviewerComp.tsx:64-75,29-55` | GAP |
| PM-69 | Lyric scale slider | 🎚️ | — | a lyric selected | drag the Scale `AppRangeComp` (`min=5 max=100 step=1`) | lyric preview rescales (debounced 500ms; `lyricEditingManager.scale`) | `LyricPreviewerComp.tsx:46-55,76-91` | GAP |
| PM-70 | Lyric `Edit ↗` button | 🖱️ | — | presenter (not lyric-editor page) | click `Edit` (btn-outline-info, `bi-box-arrow-up-right`) | `openPopupLyricEditorWindow` → a `lyricEditor.html` popup target appears in `list_pages` (cf. PL-09/PU-02) | `LyricPreviewerComp.tsx:59-63,103-113` | GAP |

## G. Keyboard-matrix refinement

| Proposed ID | Keys | Context | Given | When | Then (observable) | Source | Status |
|---|---|---|---|---|---|---|---|
| KB-08 | `Arrows`/`PageUp`/`PageDown`/`Space`/`Shift+Space` | slide container focused, a slide already live | focus `.app-slide-items-container`; a slide presented | press each key | Left/Up/PageUp/Shift+Space = **prev**, Right/Down/PageDown/Space = **next**; advances the LIVE slide on its screen; disabled slides skipped; no toggle semantics | `VarySlidesComp.tsx:52-59`, `varyAppDocumentHelpers.ts:185-212` | REFINE — matrix/KB-08 say "Space toggles"; it navigates next, needs a live slide + focus. |

---

### Summary

**Counts:** COVERED **6** · REFINE **9** · GAP **34**

**GAP ids (34 rows; new observable paths not in the matrix):**
- PM-37 — Foreground tab opens floating widget
- PM-38 — floating-widget collapse chevron toggles
- PM-39 — floating-widget close X unmounts
- PM-40 — floating-widget drag reposition persists
- PM-41 — floating-widget resize handles persist
- PM-42 — clicking disabled slide is no-op
- PM-43 — drag-reorder slide within document
- PM-44 — drop background onto slide attaches
- PM-45 — Remove Attached Background menu item
- PM-46 — right-click empty list opens doc menu
- PM-47 — drop media files creates slides
- PM-48 — Ctrl+wheel over list zooms thumbnails
- PM-49 — footer history badges + click-to-scroll
- PM-50 — footer path click swaps slide doc
- PM-51 — missing-fonts banner expand/collapse
- PM-52 — missing-font badge external search
- PM-53 — fail-to-load Reload button re-fetches
- PM-54 — PDF/PPTX/DOCX empty Refresh buttons
- PM-55 — in-panel editing Undo button
- PM-56 — in-panel editing Redo button
- PM-57 — in-panel editing Save button
- PM-58 — in-panel editing Discard (confirm→cancel)
- PM-59 — Fix slide dimension button
- PM-60 — PDF/DOCX On-Screen-Width radios
- PM-61 — PDF/DOCX Preview-BG color picker + clear
- PM-62 — Bible Properties floating toggle
- PM-63 — bible Appearance font-size slider
- PM-64 — bible Appearance font-color picker
- PM-65 — Text Shadow Reset White
- PM-66 — Text Shadow Reset Black
- PM-67 — Text Shadow outline option
- PM-68 — lyric font family/weight controls
- PM-69 — lyric scale slider
- PM-70 — lyric Edit opens editor popup

**REFINE ids (existing row vague/wrong):**
- PM-01 — Foreground no longer split tab
- PM-06 — single-click toggle, not double-click
- PM-07 — enumerate Choose Color + Remove-bg items
- PM-08 — Space=next; needs focus + live slide
- PM-09 — add zoom buttons + Ctrl+wheel
- PM-10 — enumerate play/pause/secs; needs live slide
- PM-13 — Appearance now in floating widget
- PM-14 — Text Shadow now in floating widget
- KB-08 — Space navigates next, not a toggle
