# Discovery — Screen Controlling + Output (`src/_screen/*`)

Static source sweep of the mini-screen previewer + `screen.html` output. Maps every
interactive path against the existing matrix rows **SP-01..12, SC-01..05, PR-04..07,
KB-03..07/13**. Interaction legend: 🖱️ click · 🖱️🖱️ dbl-click · 🖱️R contextmenu ·
⇕ drag/drop · ⌨️ key · 🎚️ range · ⌨️✎ text/number · 🖐️ hover · 🖲️ ctrl+wheel.

Component tree (per screen card): `MiniScreenComp` → `MiniScreenBodyComp` →
`RenderWithColorNoteComp` → **N× `ScreenPreviewerItemComp`** (`ScreenPreviewerHeaderComp`
[ShowHide + Clear + ScreenId badge + ColorNote + Lock + FullView] · body
[`<mini-screen-previewer-custom-html>` drop target] · `ScreenPreviewerFooterComp`
[Display + Transition×2 + AudioSwitch + Stage + AudioHandlers]) + `MiniScreenFooterComp`
[zoom range + Bible-Properties toggle]. Output window = `screen.tsx` → `ScreenAppComp`.

---

## Table of test paths

| Proposed ID | Target (component) | Interaction | Keys | Given | When | Then (observable) | Source (file:line) | Status |
|---|---|---|---|---|---|---|---|---|
| SP-01 | `ShowHideScreen` toggle | 🖱️ / ⌨️ | `F5` | a screen card exists | click the show-hide box (or F5) on→off | ON: root div gains `.showing` + `opacity:1` + border, icon `bi-file-slides-fill`; a `screen.html?screenId=N` CDP target appears. OFF: class/target gone | `ShowHideScreen.tsx:16-22,27-30,33-55` | COVERED |
| SP-02 | `MiniScreenClearControlComp` enabled-state | 🖱️ / observe | `F6`-`F10` | present each layer then clear | observe button class before/after presenting; click to clear | empty layer → `btn-outline-<type>`; live layer → solid `btn-<type>`; click clears + reverts. eraser=All/danger, BG/secondary, SL/info, BB/primary, FG/secondary | `MiniScreenClearControlComp.tsx:31,42-111` | COVERED |
| SP-03 | Lock toggle (`bi-unlock`/`bi-lock-fill`) | 🖱️ | — | unlocked card | click lock → try presenting a slide → unlock | locked: icon `bi-lock-fill` red; slide change refused with toast "Screen Manager is locked" / "Please unlock…"; unlocked: `bi-unlock` green works | `ScreenPreviewerHeaderComp.tsx:64-72`; `ScreenManagerBase.ts:153-164` | COVERED |
| SP-04 | `ShowingScreenIcon` + `ItemColorNoteComp` | 🖱️ / observe | — | card visible | observe id badge; click color dot → pick color → No Color to restore | badge `span[data-screen-id=N]` shows id with stable per-id color (`bi-collection`); color-note `.color-note` gains `.active` + colored `bi-record-circle`; "No Color" item disabled when already null | `ShowingScreenIcon.tsx:7-35`; `ItemColorNoteComp.tsx:15-55,92-111` | COVERED |
| SP-05 | `DisplayControl` (footer) | 🖱️R (button opens menu) | — | ≥1 OS display | click `Display(id):pid` button | context menu lists each display `*label(id): WxH (primary)`, `*`=current; re-select current = safe no-op | `DisplayControl.tsx:10-34,48-66` | COVERED |
| SP-06 | Transition effects (`Tr:` SL + BG + FG) | 🖱️ each → pick | — | card footer | click each `RenderTransitionEffectComp` button, pick another effect | menu shows 4 effects none/fade/move/zoom with the current one carrying a highlighted `childAfter` icon; button's leading icon updates (`bi-ban`/`bi-shadows`/`bi-align-end`/`bi-arrows-fullscreen`) — restore | `ScreenEffectControlComp.tsx:5-22`; `RenderTransitionEffectComp.tsx:13-62`; `transitionEffectHelpers.ts:342-347` | COVERED |
| SP-07 | Stage number (`St: N`) | 🖱️ → menu | — | card footer | click stage area → menu | items `0`–`4` (current `disabled`) + `Decrement` (disabled at ≤0) + `Increment`; picking updates the `St:` label — restore | `ScreenPreviewerFooterComp.tsx:21-54,157-168` | COVERED |
| SP-08 | `BackgroundAudioSwitchComp` (`bi-soundwave`) | 🖱️ | — | a **video** background is live (`videoSources.length>0`) | toggle on; toggle off while audio playing | button only renders when a video bg is live; ON → `btn-primary` + audio rows appear; OFF while playing → refused with toast "Audio is Playing"; OFF while paused → rows collapse | `ScreenPreviewerFooterComp.tsx:56-98,146-155,171-183` | COVERED |
| SP-09 | `MiniScreenAudioHandlersComp` play/pause + repeat | 🖱️ | — | audio-handler row visible | play/pause `<audio controls>`; toggle `bi-repeat-1` | filename shows; `audio[data-video-id]` plays; repeat icon flips green(op1)/dim(op0.5) — end paused | `MiniScreenAudioHandlersComp.tsx:46-69` | COVERED |
| SP-10 | Card context menu (whole) | 🖱️R on card | — | ≥1 screen | right-click a `.mini-screen` card | menu opens; **see split rows SP-16/SP-17 + SP-11 for individual items** | `screenPreviewerHelpers.ts:20-93`; `ScreenPreviewerItemComp.tsx:100-103,151` | REFINE — one row lumps Solo/Select/Deselect/Delete/Line-Sync/Refresh; split each item into its own observable row |
| SP-11 | Multi-screen lifecycle (Add/Solo/Select/Deselect/Delete) | 🖱️R | — | start with 1 screen | body menu `Add New Screen`; then card menu `Solo`/`Select`/`Deselect`/`Delete` | 2nd `ScreenPreviewerItemComp` card (new `data-screen-key`) appears; Solo → only that card selected; Select/Deselect toggles `.app-highlight-selected`; Delete removes card — self-cleaning | `MiniScreenBodyComp.tsx:28-33`; `screenPreviewerHelpers.ts:48-92`; `ScreenManager.ts:242-256` | COVERED |
| SP-12 | Drop onto a specific card | ⇕ | — | dragging a slide/bg/foreground button | drag over one card then drop | card gains `.receiving-data-drop` on dragover, loses it on leave/drop; `receiveScreenDropped` routes content to THAT screen | `ScreenPreviewerItemComp.tsx:104-121,138-155`; `helpers.ts:14` | COVERED |
| **SP-13** | **Per-card Full-view toggle** (header `bi-arrows-fullscreen`/`bi-fullscreen-exit`) | 🖱️ + ⌨️ | `Escape` | card visible | click full-view icon; then press Escape | card root toggles `.app-full-view`; icon flips to `fullscreen-exit`; `title/aria-label` flip Full view↔Exit full view; global Escape handler removes `.app-full-view` and ResizeObserver reconciles `isFullView`→false | `ScreenPreviewerHeaderComp.tsx:35-43,74-87`; `ScreenPreviewerItemComp.tsx:69-99,138-141`; `domHelpers.ts:57-74` | **GAP** — distinct from PM-04 (presenter-panel view); a per-screen-card widget with Escape-exit reconciliation |
| **SP-14** | Ctrl+wheel over a live **bible** on the mini-screen | 🖲️ | `Ctrl`+wheel | a bible verse is live on the card | ctrl+scroll over the bible container | bible on-screen text font-size steps up/down (`changeTextStyleTextFontSize`); card `handleWheel` stops propagation so the page/preview does NOT zoom | `ScreenBibleManager.ts:122-130`; `ScreenPreviewerItemComp.tsx:122-130` | **GAP** — bible font resize via ctrl+wheel; also fires on the `screen.html` output side |
| **SP-15** | Ctrl+wheel / pinch **zoom on the MiniScreen container** | 🖲️ / ⇕pinch | `Ctrl`+wheel | mini-screen panel focused | ctrl+scroll (or trackpad pinch) over `MiniScreenComp` root | preview scale value changes (`mini-screen-previewer` setting) and all cards `fireScaleEvent`→rescale; alternative to the PR-05 slider; persists on reload | `MiniScreenComp.tsx:14-33`; `AppRangeComp.tsx:63-107` | **GAP** — ctrl-wheel/pinch zoom path (PR-05 only covers the slider) |
| **SP-16** | Context-menu **Refresh Preview** (card + empty body) | 🖱️R → 🖱️ | — | card OR empty body area | right-click → `Refresh Preview` | every screen manager `fireRefreshEvent()`; each `<mini-screen-previewer-custom-html>` re-renders its MiniScreenAppComp (DOM under the shadow root repaints) | `screenPreviewerHelpers.ts:83-92`; `MiniScreenBodyComp.tsx:34-41` | **GAP** — "Refresh Preview" exists in TWO menus (card + body); folded vaguely into SP-10, no observable pass condition stated |
| **SP-17** | Context-menu **Set / Unset Line Sync** | 🖱️R → 🖱️ | — | a **bible** is live on the card (`screenViewData!=null`) | right-click → toggle Line Sync | menu item only present when bible live; label flips `Set`↔`Unset Line Sync`; sets `screen-bible-...-line-sync-<id>` setting; blocked with lock toast if card locked; selecting a verse then line-highlights on that screen | `screenPreviewerHelpers.ts:33-47`; `ScreenBibleManager.ts:99-113,424-464` | **GAP** — line-sync detail; SP-10 names it but gives no observable + no locked-refusal + no highlight assertion |
| **SP-18** | Audio scrubber **seek** → video time sync | 🖱️/⌨️✎ (scrub) | — | audio-handler row + live video bg | drag the `<audio>` scrubber to a new time | `onTimeUpdate` → `setBackgroundVideoCurrentTimeForce(videoId, t, false)`; the background video's `currentTime` jumps to match (mini-screen + screen-output video reseeks) | `MiniScreenAudioHandlersComp.tsx:25-33,46-58` | **GAP** — audio seek→video sync is a separate behavior from SP-09 play/pause |
| **SP-19** | Audio **repeat-on-end** behavior | 🖱️ + observe | — | audio playing near end | let audio reach end with repeat ON vs OFF | `onEnded=handleAudioEnding(isRepeating)`: repeat green → audio restarts/loops; repeat dim → audio stops (stays ended) | `MiniScreenAudioHandlersComp.tsx:52,60-69` | **GAP** — end-of-track repeat vs stop (SP-09 only toggles the flag) |
| **SP-20** | Stage-number **Increment past 4** | 🖱️ → `Increment` | — | stage at 4 | open stage menu → `Increment` | label shows `St: 5`+ (Increment has no upper cap; only fixed items `0`–`4`); Decrement floors at 0 | `ScreenPreviewerFooterComp.tsx:38-52` | REFINE — SP-07 says "0–4"; Increment actually unbounded above 4 |
| **SP-21** | Per-screen / sync-group **state independence** | 🖱️ across 2 cards | — | 2 screen cards, differing color notes | change stage/lock/effect on card A, observe card B | independent controls (stage, effect, display, line-sync, showing) stay per-card; lock & color-note propagate only within a same-color **sync group** (`setIsLockedWithSyncGroup`, `enableSyncGroup`) | `ScreenManagerBase.ts:101-103,177-189`; `ScreenPreviewerFooterComp.tsx:104-115` | **GAP** — multi-screen per-card vs sync-group isolation is unverified (see MEMORY: shared foreground-data refs) |
| **SP-22** | `BibleCustomStyleFloatingToggleComp` (mini-screen footer) | 🖱️ | — | mini-screen footer visible | click the Bible-Properties button (`bi-book`+`bi-gear-fill`) | button flips `btn-outline-info`↔`btn-info`; a floating Bible-style panel shows/hides (`toggleBibleCustomStyleFloatingShowing`) | `MiniScreenFooterComp.tsx:40`; `BibleCustomStyleFloatingToggleComp.tsx:7-24` | **GAP** — floating entry point in the mini-screen footer, separate from PM-13/14's Bibles-tab split |
| PR-04 | `MiniScreenComp` mirrors live changes | observe | — | any live layer | present bg/slide/bible/fg | preview `<mini-screen-previewer-custom-html>` composites the live layers | `MiniScreenComp.tsx:35-46`; `ScreenPreviewerItemComp.tsx:177-179` | COVERED |
| PR-05 | Zoom slider (`max=30`) | 🎚️ | — | mini-screen footer | drag the preview-size range | `input[type=range]` (`defaultRangeSize max=30`) rescales the preview via `setPreviewScale1` | `MiniScreenFooterComp.tsx:6-11,31-37`; `MiniScreenComp.tsx:15-26` | COVERED (see SP-15 for the ctrl-wheel path) |
| PR-06 | Clear buttons | 🖱️ | `F6`-`F10` | — | (same as SP-02) | each clears its layer | `MiniScreenClearControlComp.tsx` | COVERED (=SP-02) |
| PR-07 | `ShowHideScreen` from right column | 🖱️ | `F5` | — | (same as SP-01) | screen shows/hides | `ShowHideScreen.tsx` | COVERED (=SP-01) |
| SC-01 | Screen target attach | present→show→`list_pages` | — | content live | SP-01 show → select_page the screen target | `screen.html?screenId=N` target appears + drivable; screenshot from the target itself | `screen.tsx:15-45`; `ScreenAppComp.tsx:16-44` | COVERED |
| SC-02 | Layer compositing on real output | observe | — | bg+slide+bible+fg live | screenshot the screen target | all layers composite; mini-screen mirrors it | `ScreenAppComp.tsx:82-95` | COVERED |
| SC-03 | Bible verse step on output | ⌨️ on screen target | `Ctrl/Alt+ArrowLeft/Right` | a bible verse live on output | press key on the `screen.html` target | `keyup` handler sends `screen:app:change-bible(isNext)` → main controller `changeBible` → verse steps prev/next (mirror on mini-screen) | `screen.tsx:24-35`; `electronEventListener.ts:264-266`; `ElectronMainController.ts:94-96` | COVERED |
| SC-04 | `ScreenCloseButtonComp` (❌ `#close`) | 🖱️ on screen target | — | screen showing | click `#close` | `screenManagerBase.hide()`; CDP target disappears; presenter `ShowHideScreen` reflects hidden | `ScreenCloseButtonComp.tsx:15-35` | COVERED |
| SC-05 | Hidden-screen log forwarding | observe electron stdout | — | screen hidden | trigger screen activity while hidden | console lines arrive via `all:app:log` on electron-main stdout | (knowledge-base §6) | COVERED |
| **SC-06** | Screen-output **invalid/missing `screenId`** error state | observe | — | `screen.html` opened with no/NaN `screenId` | load the output with a bad param | red "Screen ID is not provided…" panel renders; `#close` button force-shown (`opacity:1`) → `globalThis.close()` | `ScreenAppComp.tsx:16-32,64-97`; `ScreenCloseButtonComp.tsx:14-19,29` | **GAP** — likely BLOCKED (can't navigate main window to screen.html; reachable only by opening a stray target) but a real defined state |
| **SC-07** | Screen-output **resize → auto-reload** | resize_page | — | screen showing | resize the screen window | `window.resize` → `appProvider.reload()`; the target reloads (asset refetch) | `screen.tsx:40-42` | **GAP** — untested reload-on-resize; drive only on a non-live display, else EX-02 |

---

### Summary

Counts — **COVERED: 20 · REFINE: 2 · GAP: 11**

REFINE + GAP (id — 6-word hook):
- SP-10 (REFINE) — split lumped card-menu items apart
- SP-20 (REFINE) — Increment exceeds documented 0–4 cap
- SP-13 (GAP) — per-card full-view toggle, Escape exit
- SP-14 (GAP) — ctrl+wheel resizes live bible font
- SP-15 (GAP) — ctrl+wheel/pinch zooms mini-screen preview
- SP-16 (GAP) — Refresh-Preview menu item re-renders previews
- SP-17 (GAP) — line-sync toggle detail, locked refusal
- SP-18 (GAP) — audio seek syncs background-video time
- SP-19 (GAP) — audio repeat-on-end loops vs stops
- SP-21 (GAP) — multi-screen per-card vs sync-group isolation
- SP-22 (GAP) — Bible-Properties floating toggle in footer
- SC-06 (GAP) — invalid screenId error-state output panel
- SC-07 (GAP) — screen output auto-reloads on resize
