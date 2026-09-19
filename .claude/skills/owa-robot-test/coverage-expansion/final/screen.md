# Final — Screen controlling & output (finalized rows)

Finalized from [discover-screen-preview.md](../discover-screen-preview.md). Skips the
COVERED rows already in the matrix (SP-01..12, SC-01..05, PR-04..07); one row per
distinct GAP path, IDs assigned sequentially in the ranges SP-13.., SC-06.., PR-30..
Legend: 🖱️ click · 🖱️🖱️ dblclick · 🖱️R right-click · ⇕ drag-drop · ⌨️ key · 🎚️ slider ·
⌨️✎ input · 🖐️ hover. Each pass condition ends with `(src: path:line)`.

## SP additions

| ID | Target | Interactions | Pass condition |
|---|---|---|---|
| SP-13 | Per-card Full-view toggle (`ScreenPreviewerHeaderComp` icon, one per screen card) | 🖱️ full-view icon; ⌨️ `Escape` | Card root toggles `.app-full-view`; header icon flips `bi-arrows-fullscreen`↔`bi-fullscreen-exit` with title/aria-label flipping Full view↔Exit full view; pressing Escape removes `.app-full-view` and the card's ResizeObserver reconciles `isFullView`→false with no snap-back — a per-card widget distinct from PM-04's presenter-panel view (src: src/_screen/preview/ScreenPreviewerHeaderComp.tsx:74-87; src/_screen/preview/ScreenPreviewerItemComp.tsx:69-99; src/helper/domHelpers.ts:57-74) |
| SP-14 | Ctrl+wheel over a live bible on a card (`ScreenBibleManager.div` wheel handler) | ⌨️ Ctrl + scroll-wheel over a live bible | With a bible verse live, Ctrl+wheel over the bible container steps the on-screen bible font-size up/down (`changeTextStyleTextFontSize`); the card's `handleWheel` calls `stopPropagation` so the mini-screen/page zoom does NOT change; the same handler is wired on the `screen.html` output side too (src: src/_screen/managers/ScreenBibleManager.ts:119-130; src/_screen/preview/ScreenPreviewerItemComp.tsx:122-130) |
| SP-15 | Ctrl+wheel / pinch zoom of the whole mini-screen previewer (`MiniScreenComp` `useZoomingRegistering`) | ⌨️ Ctrl + scroll-wheel, or trackpad pinch, over the previewer panel | Ctrl+wheel/pinch over the panel changes the `mini-screen-previewer` scale setting and every card runs `fireScaleEvent`→rescales — same effect as the PR-05 slider but via wheel/pinch, and without SP-14's bible-font path; the value persists across reload (src: src/_screen/preview/MiniScreenComp.tsx:20-33; src/others/AppRangeComp.tsx:63-107) |
| SP-16 | "Refresh Preview" previewer menu item (present in BOTH card menu and empty-body menu) | 🖱️R card OR empty body area → 🖱️ `Refresh Preview` | Selecting it calls `fireRefreshEvent()` on every screen manager; each `<mini-screen-previewer-custom-html>` re-renders its shadow-root content (preview DOM repaints), observable as the previews reflowing; reachable from both menus (src: src/_screen/preview/screenPreviewerHelpers.ts:83-90; src/_screen/preview/MiniScreenBodyComp.tsx:34-41) |
| SP-17 | "Set/Unset Line Sync" previewer menu item (bible-live only, lock-guarded) | 🖱️R a card with a bible live → 🖱️ `Set`/`Unset Line Sync` | Item present only while a bible is live (`screenViewData!=null`); label flips Set↔Unset; toggling writes `screen-bible-…-line-sync-<id>` and re-clones `screenViewData` so a subsequent verse selection line-highlights on that screen; if the card is locked the setter calls `checkIsLockedWithMessage`→toast "Screen Manager is locked" and makes no change (src: src/_screen/preview/screenPreviewerHelpers.ts:33-47; src/_screen/managers/ScreenBibleManager.ts:99-113) |
| SP-18 | Audio scrubber seek → background-video time sync (`MiniScreenAudioHandlersComp` `<audio>`) | 🖱️ drag/scrub the `<audio controls>` position with a live video background | `onTimeUpdate` calls `setBackgroundVideoCurrentTimeForce(videoId, currentTime, false)`, so the live background video's `currentTime` jumps to the scrubbed position and re-seeks on both the mini-screen and the screen output — a seek→sync behavior separate from SP-09's play/pause (src: src/_screen/preview/MiniScreenAudioHandlersComp.tsx:25-33,53) |
| SP-19 | Audio repeat-on-end behavior (`MiniScreenAudioHandlersComp` end-of-track + repeat toggle) | 🖱️ repeat toggle, then let the audio reach its end | `onEnded=handleAudioEnding(isRepeating)`: with repeat ON (green `bi-repeat-1`, opacity 1) the audio restarts/loops at track end; with repeat OFF (dim, opacity .5) it stops at ended and stays — an end-of-track outcome beyond SP-09's flag flip (src: src/_screen/preview/MiniScreenAudioHandlersComp.tsx:52,59-70) |
| SP-20 | Multi-screen per-card vs sync-group state isolation | 🖱️ change stage/effect/display/line-sync/lock/color on card A → observe card B | Per-card controls (stage, transition effect, display, line-sync, showing) stay independent between cards; only lock and color-note propagate, and only within a same-color sync group (`setIsLockedWithSyncGroup`; `setColorNote`→`enableSyncGroup` across bg/varyAppDocument/bible/foreground), so a different-color card B is left unchanged (src: src/_screen/managers/ScreenManagerBase.ts:101-103,177-189; src/_screen/preview/ScreenPreviewerFooterComp.tsx:104-115) |
| SP-21 | Bible-Properties floating toggle in the mini-screen footer (`BibleCustomStyleFloatingToggleComp`) | 🖱️ the Bible-Properties button (`bi-book`+`bi-gear-fill`) | Button flips `btn-outline-info`↔`btn-info` and a floating Bible-style panel shows/hides via `toggleBibleCustomStyleFloatingShowing` — a footer-level entry point distinct from PM-13/14's Bibles-tab split (src: src/_screen/preview/MiniScreenFooterComp.tsx:39-41; src/screen-setting/BibleCustomStyleFloatingToggleComp.tsx:7-22) |

## SC additions

| ID | Target | Interactions | Pass condition |
|---|---|---|---|
| SC-06 | Output window invalid/missing `screenId` error state (`ScreenAppComp` null-manager branch) | observe `screen.html` loaded with no / NaN `screenId` | `useScreenManager` returns null → a red "Screen ID is not provided in the URL…" panel on black renders and the `#close` button is force-shown (`opacity:1`), whose click calls `globalThis.close()` (no manager to hide); likely BLOCKED at runtime since it is reachable only via a stray target — never `navigate_page` the main window to `screen.html` (src: src/_screen/ScreenAppComp.tsx:16-32,64-95; src/_screen/ScreenCloseButtonComp.tsx:15-29) |
| SC-07 | Output window auto-reload on resize (`screen.tsx` window `resize` listener) | resize the showing `screen.html` window (`resize_page`) | The `window` `resize` event calls `appProvider.reload()`, so the screen target reloads (assets refetch, target briefly re-inits then reattaches in `list_pages`); drive only on a non-live display, else EX-02 (src: src/screen.tsx:40-42) |

## PR additions

| ID | Target | Interactions | Pass condition |
|---|---|---|---|

_None._ The screen-preview discovery surfaced no distinct **presenter-right-column** gap
outside the mini-screen previewer itself: every new mini-screen path (footer zoom-by-wheel,
Bible-Properties toggle, previewer menu items, per-card widgets) is filed under **SP**, which
owns the mini-screen previewer in this matrix, and the discovery deliberately kept them there
(e.g. SP-15 notes "PR-05 only covers the slider"). PR-04..07 remain cross-reference stubs to
SP-01/02. Range **PR-30..PR-39 is unused** by this file.

### REFINE

Edits to EXISTING matrix rows (no new IDs consumed):

- **SP-07** (Stage number) — pass condition says the menu offers "`0`–`4`". Refine: the fixed
  items are `0`–`4`, but `Increment` has **no upper cap** (the `St:` label can read `5`+),
  while `Decrement` floors at 0 and is disabled at ≤0 (src: src/_screen/preview/ScreenPreviewerFooterComp.tsx:38-52).
- **SP-10** (Previewer context menu) — currently lumps Refresh Preview / Solo / Select /
  Deselect / Delete / Line Sync into one row. Refine: narrow SP-10 to "menu opens with the
  expected items for the current screen count / bible-live state" and move the observable
  per-item assertions to **SP-11** (Solo/Select/Deselect/Delete lifecycle), **SP-16** (Refresh
  Preview re-renders), and **SP-17** (Line Sync toggle + lock refusal) (src: src/_screen/preview/screenPreviewerHelpers.ts:20-93).

### COUNTS

| Prefix | New rows | IDs | Last id used |
|---|---|---|---|
| SP | 9 | SP-13 .. SP-21 | SP-21 |
| SC | 2 | SC-06 .. SC-07 | SC-07 |
| PR | 0 | — (PR-30..PR-39 unused) | none |
| **Total** | **11** | | |

REFINE (existing rows edited, no IDs consumed): SP-07, SP-10 → 2 items.
