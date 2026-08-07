# Presenter-Middle — finalized matrix rows

Source: `coverage-expansion/discover-presenter-middle.md` (34 GAP paths, 9 REFINE).
Finalized into the matrix row format `| ID | Target | Interactions | Pass condition |`.
Legend: 🖱️ click · 🖱️🖱️ dblclick · 🖱️R right-click · ⇕ drag-drop · ⌨️ key ·
🎚️ slider · ⌨️✎ input · 🖐️ hover.

Consolidation applied (34 → 23 new rows):
- Source PM-45 (`Remove Attached Background`) dropped — context-menu ITEM, CM owns.
- Source PM-48 (Ctrl+wheel zoom) folded into the **PM-09 REFINE** (same thumbnail scale).
- Source PM-63/PM-64 (Appearance sub-controls) folded into **PM-13 REFINE**; source
  PM-65/PM-66/PM-67 (Text-Shadow boxes) folded into **PM-14 REFINE** — those families
  already exist as PM-13/PM-14.
- Sibling merges: floating drag+resize (PM-40+41), missing-fonts banner+badge (PM-51+52),
  3 empty-preview Refresh buttons (PM-54), Undo+Redo (PM-55+56), lyric font/weight+scale
  (PM-68+69).

## PM additions

| ID | Target | Interactions | Pass condition |
|---|---|---|---|
| PM-37 | `ForegroundFloatingComp` toggle (Foreground tab button) | 🖱️ toggle on+off | ON: a `.floating-widget` titled "Foreground" mounts with `LazyPresenterForegroundComp`; the `f` tab button gets `.active` (and `.app-on-screen` while any foreground is live). OFF: widget unmounts, button reverts to `btn-outline-info` (src: src/app-document-presenter/PresenterComp.tsx:127-181) |
| PM-38 | `FloatingWidgetComp` collapse chevron | 🖱️ | `.floating-widget--collapsed` toggles; body height → `COLLAPSED_HEIGHT`; icon flips `bi-chevron-down`↔`bi-chevron-up` (src: src/app-modal/FloatingWidgetComp.tsx:268-284) |
| PM-39 | `FloatingWidgetComp` close (`bi-x-lg`) | 🖱️ | `onClose` fires → widget unmounts and its opener toggle reverts to `btn-outline-info` (src: src/app-modal/FloatingWidgetComp.tsx:285-293) |
| PM-40 | `FloatingWidgetComp` move/resize | ⇕ drag blank header / a `--resize-handle` | widget repositions/resizes (`left/top/width/height` style change, clamped to min/max); `.floating-widget--moving`/`--resizing` while active; new rect persists to the `persistKey` setting and survives reopen (src: src/app-modal/FloatingWidgetComp.tsx:205-259,333-344) |
| PM-41 | Disabled slide card (`VarySlideRenderComp`) | 🖱️ | click is a no-op — a disabled card (opacity 0.5, title "This slide is disabled") does not present; file-based disabled cards also carry `pointer-events:none` (src: src/app-document-presenter/items/VarySlideRenderComp.tsx:300-333) |
| PM-42 | Slide reorder within a doc | ⇕ drag one card onto another (same doc) | drag-over card dims to opacity 0.5; drop calls `moveSlideToIndex` and the new order persists; a drop whose filePath differs is ignored (src: src/app-document-presenter/items/VarySlideRenderComp.tsx:234-268,321-325) |
| PM-43 | Attach background to a slide | ⇕ drag a bg color/image/video/web item → slide card | `handleAttachBackgroundDrop` attaches it; the card shows the attached bg + an `AttachBackgroundIconComponent`; drag-over dims the card to 0.5 (src: src/app-document-presenter/items/VarySlideRenderComp.tsx:234-255) |
| PM-44 | Previewer container context menu | 🖱️R on empty `.app-slide-items-container` area (not a card) | `varyAppDocument.showContextMenu` opens the document-level menu (add/insert slide etc.); native browser menu suppressed (src: src/app-document-presenter/VarySlidesPreviewerComp.tsx:82-86,123) |
| PM-45 | Drop media files onto previewer | ⇕ drag image/video file(s) over the list | drag-over dims the container to 0.5 (mimetype gate testable synthetically); supported files append new slides, unsupported pops toast "Insert Image or Video / Unsupported file type!" (real drop needs `readDroppedFiles`) (src: src/app-document-presenter/VarySlidesPreviewerComp.tsx:32-45,87-103) |
| PM-46 | Footer history badges (`HistoryPreviewerFooterComp`) | observe + 🖱️ a badge | footer shows the last ≤3 presented slide indices (`RenderSlideIndexComp`); clicking a badge not currently in view scrolls to and highlights that slide card (src: src/app-document-presenter/AppDocumentPreviewerFooterComp.tsx:33-76,141-145) |
| PM-47 | Footer path preview (`PathPreviewerComp`) | 🖱️ the footer filename path | opens the same-directory slide-doc picker and selecting one swaps the doc; if none found, app alert "No Slide Available / No other slide found…" (non-injected doc, `isDisableChanging` false) (src: src/app-document-presenter/AppDocumentPreviewerFooterComp.tsx:97-111,127-139) |
| PM-48 | Missing-fonts banner (`MissingFontFamilyBannerComp`) | 🖱️ header; 🖱️ a font badge | header click flips `aria-expanded` + chevron `bi-chevron-right`↔`bi-chevron-down`, showing/hiding the missing-font badge list; a badge (`bi-search`) runs `searchMissingFontFamily` (external search → EX-04 click-eligibility only) (src: src/app-document-presenter/items/MissingFontFamilyBannerComp.tsx:27-90) |
| PM-49 | Slide fail-to-load `Reload` (`VarySlidesComp`) | 🖱️ | when `getSlides()` returned null the `Reload` btn-primary is shown; click calls `startLoading()` → re-fetch (spinner, then slides or the error again) (src: src/app-document-presenter/items/VarySlidesComp.tsx:228-243) |
| PM-50 | PDF/PPTX/DOCX empty-preview Refresh (`VarySlidesComp`) | 🖱️ | with 0 rendered pages the `Refresh PDF Images`/`Refresh PPTX Slides`/`Refresh DOCX Pages` button clears the cached preview + fires `fileSource.fireUpdateEvent()`; the "No slides/pages to display" warning clears once pages render (src: src/app-document-presenter/items/VarySlidesComp.tsx:245-298) |
| PM-51 | `FileEditingMenuComp` Undo/Redo | 🖱️ each | Undo (`bi-arrow-90deg-left`) runs `historyUndo()`, Redo (`bi-arrow-90deg-right`) runs `historyRedo()`; each shows disabled (opacity 0.1) when `!canUndo`/`!canRedo` (editable doc, presenter) (src: src/app-document-presenter/editingHelpers.tsx:145-179) |
| PM-52 | `FileEditingMenuComp` Save (`bi-floppy`) | 🖱️ | `editableDocument.save()`; the btn-success is enabled only while the doc is dirty (`canSave`) and clears after; title shows `[Ctrl + S]` (src: src/app-document-presenter/editingHelpers.tsx:101-128) |
| PM-53 | `FileEditingMenuComp` Discard (`bi-x-octagon`) | 🖱️ → **Cancel** | clicking the btn-danger raises the "Discard changed / Are you sure…" confirm; Cancel leaves history intact — never confirm (it clears the undo stack) (EX-05) (src: src/app-document-presenter/editingHelpers.tsx:87-117) |
| PM-54 | Fix-dimension button (`CheckingDimensionComp`) | 🖱️ | present only while `wrongDimension !== null`; clicking the btn-warning (`bi-aspect-ratio` red + `bi-hammer`) runs `fixSlidesDimensionForDisplay(screenDisplay)` and the warning button then disappears (src: src/app-document-presenter/items/SlidesMenuComp.tsx:13-49) |
| PM-55 | PDF/DOCX On-Screen-Width radios (`PageBaseAppearanceSettingComp`) | 🖱️ `Not Full Width`/`Full Width` | selected radio checks; `setIsPdfFullWidth` updates each live screen's `isRenderFullWidth` and the live PDF/DOCX re-lays on the screen output (screen-only — verify on `screen.html`) (src: src/screen-setting/PageBaseAppearanceSettingComp.tsx:60-97) |
| PM-56 | PDF/DOCX Preview-BG color (`VirtualBGColorSettingComp`) | 🖱️ open + ⌨️✎ color; 🖱️R clear | picking a color sets `virtualBackgroundColor` on the page-base preview + live screens; right-click (or red `bi-x-lg`) resets it (empty-state icon `#adb5bd30`) (src: src/screen-setting/VirtualBGColorSettingComp.tsx:51-96) |
| PM-57 | `BibleCustomStyleFloatingToggleComp` ("Bible Properties") | 🖱️ toggle on+off | ON: `BibleCustomStyleFloatingComp` mounts (portaled `.floating-widget` titled "Bible Properties") and the `bi-book`+`bi-gear-fill` button goes solid `btn-info`; OFF: unmounts, button → `btn-outline-info` (src: src/screen-setting/BibleCustomStyleFloatingToggleComp.tsx:7-24) |
| PM-58 | Lyric "Control" card (`LyricPreviewerComp`) | 🖱️/⌨️✎ font family+weight; 🎚️ Scale (`min=5 max=100`) | the lyric preview (`RenderPreviewBodyComp`) re-renders in the new font/weight and rescales (scale debounced 500ms) (src: src/lyric-list/LyricPreviewerComp.tsx:29-91) |
| PM-59 | Lyric `Edit ↗` (`LyricPreviewerComp`) | 🖱️ | `openPopupLyricEditorWindow` → a `lyricEditor.html` popup target appears in `list_pages` (btn-outline-info `bi-box-arrow-up-right`; presenter page only) (src: src/lyric-list/LyricPreviewerComp.tsx:59-63,103-113) |

## PR additions

_None._ The presenter-middle discovery doc contains **no** presenter-right-column
(mini-screen / `MiniScreenComp` / clear-control / zoom / show-hide) gaps — every
finalized unit is a middle-column control, so it belongs under the PM section for
matrix correctness. The assigned PR-08..PR-19 range was therefore **not used** by this
source; last PR id remains **PR-07** (unchanged).

### REFINE

Existing matrix rows whose definition is now vague/wrong (update in place, keep the ID):

- **PM-01** — main tab bar is `Documents`/`Lyrics`/`Bibles` only; Foreground is a floating toggle (PM-37), not a split tab. Pass cond → `ResizeActorComp` pane-count change + `.active` toggle (min 1 tab), drop "Foreground" (src: src/app-document-presenter/PresenterComp.tsx:120-124,288-317)
- **PM-06** — presenting a slide is a **single-click TOGGLE** (1st click live, 2nd click on the same card clears), not 🖱️🖱️ (src: src/app-document-presenter/items/VarySlideRenderComp.tsx:327-335; varyAppDocumentHelpers.ts:35-52)
- **PM-07** — enumerate the menu: always `Choose Color` (`bi-record-circle`); if a bg is attached, also `Remove Attached Background` (src: src/app-document-presenter/items/VarySlideRenderComp.tsx:274-292)
- **PM-08** — needs the container focused **AND** a slide already live; Left/Up/PageUp/Shift+Space = prev, Right/Down/PageDown/Space = next (`Space` is NEXT, not a toggle); disabled slides skipped (src: src/app-document-presenter/items/VarySlidesComp.tsx:52-59; varyAppDocumentHelpers.ts:185-212)
- **PM-09** — add the zoom-out/zoom-in buttons + `Ctrl`+wheel over the list as equivalent thumbnail-scale controls (`min=20 max=200`); absorbs source PM-48 (src: src/app-document-presenter/AppDocumentPreviewerFooterComp.tsx:78-83; VarySlidesPreviewerComp.tsx:105-110) |
- **PM-10** — only mounts when a slide is selected/live; enumerate `bi-play`↔`bi-pause-circle-fill` toggle + `M:` seconds input (`min=0`) + red `bi-x-lg` collapse (src: src/app-document-presenter/items/SlideAutoPlayComp.tsx:90-169)
- **PM-13** — Appearance is now inside the Bible Properties floating widget (PM-57), not an inline Bibles-tab split; covers the Font-Size slider (`min=1 max=200`) + Font-Color picker sub-controls (absorbs source PM-63/64) (src: src/screen-setting/BibleCustomStyleComp.tsx:28-41; ScreenBibleAppearanceComp.tsx:16-47)
- **PM-14** — Text Shadow is now in the floating widget; covers the Reset White / Reset Black + Outline1–4 demo boxes (absorbs source PM-65/66/67) (src: src/screen-setting/ScreenBibleTextShadow.tsx:113-170)
- **KB-08** — `Space` navigates NEXT (not a toggle); requires the slide container focused + a slide live (src: src/app-document-presenter/items/VarySlidesComp.tsx:52-59)

### COUNTS

- **PM** — 23 new rows (PM-37 .. PM-59); last id used **PM-59**
- **PR** — 0 new rows; last id used **PR-07** (unchanged — no right-column gaps in source)
- **REFINE** — 9 rows (PM-01, PM-06, PM-07, PM-08, PM-09, PM-10, PM-13, PM-14, KB-08)
- **Total new rows** — **23**
