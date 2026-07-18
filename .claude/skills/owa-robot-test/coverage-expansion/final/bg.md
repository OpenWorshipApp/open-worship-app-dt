# Background Panel — finalized coverage rows

Source: `coverage-expansion/discover-background.md` (static sweep of `src/background/*`,
`src/others/color/*`, and shared list chrome). Assigned range **PM-90 .. PM-129**.
Scope: DISTINCT GAP paths only. COVERED rows (PM-26..PM-29, PM-32) are unchanged;
existing rows needing correction are in `### REFINE`. Context-menu items are deferred
to **CM**, keyboard shortcuts to **KB**, per policy.

## PM additions

| ID | Target | Interactions | Pass condition |
|---|---|---|---|
| PM-90 | `SelectCustomColor` "Mix Color" (`input[type=color]`, title "Select custom color") | ⌨️✎ ⌨️ | changing the native color input updates `localColor`; the immediate path applies live while the per-screen (`isNoImmediate`) path debounces 500ms; `Enter` or blur force-applies `onColorSelected` → presented bg restyles on the mini-screen (src: src/others/color/SelectCustomColor.tsx:47-98) |
| PM-91 | `OpacitySlider` (in `ColorPicker`) | 🎚️ | with a color selected, dragging the "Opacity" range (min 1 / max 255 / step 1) debounces 500ms then rewrites the color's alpha hex pair and re-applies → bg alpha visibly changes on the mini-screen (src: src/others/color/OpacitySlider.tsx:16-34) |
| PM-92 | `RenderNoColor` "x" tile (title "No Color") | 🖱️ | in a per-screen picker, clicking the red "x" tile clears THAT screen's color bg (`onNoColor`→`applyBackgroundSrc(null)`); in the empty-state picker `onNoColor` is undefined so the tile is a no-op — flag as a dead control (src: src/others/color/RenderNoColor.tsx:12-31 · src/background/BackgroundColorsComp.tsx:44-53,95-101) |
| PM-93 | Per-screen `ColorPicker` (`RenderColorPickerPerScreenComp`) | 🖱️ | with a COLOR bg live on ≥1 screen, opening the Colors tab renders one `ColorPicker` card per screen, each headed by `ShowingScreenIcon` (`data-screen-id`); editing a swatch/input there recolors ONLY that screen (`applyBackgroundSrc('color')` on that id) and leaves the others unchanged (src: src/background/BackgroundColorsComp.tsx:15-56,102-113) |
| PM-94 | `RenderColor` swatch drag → mini-screen | ⇕ | dragging a swatch onto a previewer card sets a `BACKGROUND_COLOR` payload (`serializeForDragging`); the card gains `receiving-data-drop` on dragover and the dropped color presents on THAT screen (pairs SP-12) (src: src/others/color/RenderColor.tsx:44-47,58-61 · src/others/color/colorHelpers.tsx) |
| PM-95 | Media item drag (image/video, `BackgroundMediaItemComp`) → mini-screen | ⇕ | dragging an item (`data-file-item-file-src` present) onto a previewer card presents that image/video bg on the targeted screen (`handleDragStart`; pairs SP-12) — identical for image & video (src: src/background/BackgroundMediaItemComp.tsx:69-72,108-110) |
| PM-96 | Media item color-note dot (`ItemColorNoteComp`) | 🖱️ | clicking the item's `bi-record-circle` dot opens a color palette (No Color + swatches, current disabled); picking sets the file's color-note and the list regroups under a `genColorBar` header (grouping ON for image/video) — identical for image & video (src: src/background/BackgroundMediaItemComp.tsx:124-132 · src/others/ItemColorNoteComp.tsx:15-111) |
| PM-97 | Video thumbnail hover autoplay | 🖐️ | hovering a video thumbnail plays the muted `<video>` and sets `title` to `name\n(duration)`; leaving pauses it (images have no hover autoplay) (src: src/background/BackgroundVideosComp.tsx:75-101) |
| PM-98 | Header Reload button (`RenderPathTitleComp`, `bi-arrow-clockwise`, title "Reload") | 🖱️ | with a dir set, clicking it fires `dirSource.fireReloadEvent()` and the list re-reads the folder + re-renders — shared chrome that sits atop every bg tab (src: src/others/RenderPathTitleComp.tsx:16-35) |
| PM-99 | Header Add-items `+` button (`RenderPathTitleComp`, `bi-plus-lg`, title "Add items") | 🖱️ | with a dir set, clicking it opens a context menu anchored to the button (menu ITEMS = CM's; includes `Add Items`→OS dialog EX-01 plus per-tab download entries) (src: src/others/RenderPathTitleComp.tsx:36-45 · src/others/FileListHandlerComp.tsx:148-162) |
| PM-100 | `PathSelectorComp` path-editor toggle (`bi-chevron-down/right`) | 🖱️ | with a dir set, clicking the path row toggles the lazily-mounted `PathEditorComp` inline editor open/closed (title flips "Show/Hide path editor") — shared chrome (src: src/others/PathSelectorComp.tsx:76-111) |
| PM-101 | `BackgroundFooterComp` thumbnail-size (`AppRangeComp`) | 🎚️ 🖱️ | dragging the range (min 50 / max 500 / step 10), clicking `bi-zoom-out`/`bi-zoom-in`, or Ctrl+scroll over the card changes `bg-thumbnail-width` → every thumbnail rescales (distinct from PM-09's slide slider, max 200) (src: src/background/BackgroundFooterComp.tsx:4-38 · src/others/AppRangeComp.tsx:169-268) |
| PM-102 | External media file drop (`FileListHandlerComp`) | ⇕ | dragging a file over the card sets card `opacity:0.5` when every dragged item is a file (mimetype gate — synthetically testable); dropping copies valid files into the dir (real-file drop pipeline per CLAUDE.md drop note) (src: src/others/FileListHandlerComp.tsx:170-178 · src/others/droppingFileHelpers.ts:17-128) |
| PM-103 | `NoDirSelectedComp` empty state | 🖱️ | opening a bg tab whose dir is UNSET renders `NoDirSelectedComp` (offering the `defaultFolderName`) instead of a file list (src: src/others/FileListHandlerComp.tsx:208-213) |
| PM-104 | Camera enumeration / empty state (`BackgroundCamerasComp`) | 🖱️ | opening the Cameras tab runs `useCameraInfoList` (`requestCameraAccess`+`enumerateDevices`) and renders one `BackgroundCameraItemComp` per `videoinput`; renders NO card when access is denied or no device exists (BLOCKED→EX-03) (src: src/background/BackgroundCamerasComp.tsx:13,28-39 · src/helper/cameraHelpers.ts:27-53) |
| PM-105 | Camera item drag (`BackgroundCameraItemComp`) → mini-screen | ⇕ | with ≥1 device, dragging a camera card to a previewer sets a `BACKGROUND_CAMERA` payload (`cameraDragSerialize`); drop shows that camera on the targeted screen (pairs SP-12; BLOCKED→EX-03 if no device) (src: src/background/BackgroundCameraItemComp.tsx:40-47,75-76 · src/background/backgroundHelpers.ts:64-69) |
| PM-106 | Web thumbnail hover → live iframe (`BackgroundWebChildComp`) | 🖐️ | hovering a web thumbnail sets `isPlaying` on `onMouseOver` → mounts `RenderBackgroundWebIframeComp` (`iframe sandbox="allow-scripts"`); `onMouseOut` unmounts it back to the static `bi-globe`/`bi-filetype-html` placeholder (src: src/background/BackgroundWebChildComp.tsx:36-85 · src/background/RenderBackgroundWebIframeComp.tsx:62-110) |
| PM-107 | Web URL item drag (`BackgroundWebUrlItemComp`) → mini-screen | ⇕ | dragging a URL card to a previewer sets a `BACKGROUND_WEB` payload (`handleDragStart`); drop presents that web bg on the targeted screen (pairs SP-12) (src: src/background/BackgroundWebUrlItemComp.tsx:89-96,105-108) |
| PM-108 | Web URL/file color-note dot | 🖱️ | clicking a web item's `bi-record-circle` dot → pick color sets the item's color-note (`background-web-url_<id>` setting); UNLIKE media, web grouping is disabled (`disableColorNoteGrouping`) so items do NOT regroup (src: src/background/BackgroundWebUrlItemComp.tsx:116-129 · src/background/BackgroundWebComp.tsx:80-84,151) |
| PM-109 | Audio item reveal/hide toggle (`BackgroundAudiosComp`) | 🖱️ | in the presenter Audios split, clicking an item toggles `activeMap[filePath]` → mounts/unmounts its `AudioBodyComp` (`<audio controls>`); a video-sourced audio item shows a `bi-film` badge; clicking to hide WHILE playing is refused with `showAudioPlayingToast` (GL-10) (src: src/background/BackgroundAudiosComp.tsx:80-103 · src/background/AudioBodyComp.tsx:76-110) |
| PM-110 | Audio play mutual-exclusion + tab highlight | 🖱️ | with ≥2 players revealed, native Play on one pauses+rewinds all other `<audio>` and fires `AUDIO_PLAYING_CHANGE_EVENT` → the `♫Audios♫` tab gains `app-on-screen`; pausing clears the highlight (src: src/background/AudioBodyComp.tsx:50-53 · src/helper/mediaControlHelpers.ts:156-172) |
| PM-111 | Audio native seek scrubber | 🖱️ | dragging the native `<audio controls>` scrubber changes `audio.currentTime` and playback continues from the new position (observable via `audio.currentTime`) (src: src/background/AudioBodyComp.tsx:46-58) |
| PM-112 | Audio repeat-1 toggle (`bi-repeat-1`) | 🖱️ | clicking the repeat icon toggles the per-file `…-repeat-<md5>` setting (icon flips green/opacity-1 vs dim); with repeat ON, on `ended` `handleAudioEnding` restarts the track instead of stopping (src: src/background/AudioBodyComp.tsx:33-70 · src/helper/mediaControlHelpers.ts:174-183) |
| PM-113 | Document Audios split (`VaryAppDocumentAudiosComp`) | 🖱️ | with the presenter Audios split active + a pptx doc carrying embedded audio, a bottom `Document Audios` split lists each slide's audio (`RenderSlideIndexComp` + its own `AudioBodyComp`); absent when `useAppDocumentAudioData` returns null (BLOCKED without such a doc) (src: src/background/BackgroundAudiosComp.tsx:135-176 · src/background/VaryAppDocumentAudiosComp.tsx:32-88) |

## REFINE

Corrections to EXISTING matrix rows (edit these rows in place; do not mint new IDs):

- **PM-30** — interaction is 🖱️ **single-click toggle**, NOT 🖱️🖱️. Live item = `app-highlight-selected` + `*Images` tab + `.app-on-screen`; a SECOND click on the same item clears the bg (a double-click nets to nothing). (src: src/background/BackgroundMediaItemComp.tsx:92-113 · src/_screen/managers/ScreenBackgroundManager.ts:305-323)
- **PM-31** — same fix as PM-30 for video: 🖱️🖱️ → 🖱️ single-click toggle; second click clears. (src: src/background/BackgroundVideosComp.tsx:143-158 · src/background/BackgroundMediaItemComp.tsx:92-113)
- **PM-33** — the header `+` does NOT open the Web Editor popup; it opens a **context menu** (Add URL / New File / Add Items / Open Shared Link). Web items are 🖱️ single-click toggles; the Web Editor opens only via a web-FILE item's `Edit` menu (→ PU-04). (src: src/background/BackgroundWebComp.tsx:85-115 · src/others/RenderPathTitleComp.tsx:36-45)
- **PM-34** — "🖱️ play; 🖱️ stop" is too thin: a click first **reveals** the player (`AudioBodyComp`); native Play lands `app-on-screen` on the **`♫Audios♫` tab** (not the item); hiding a playing item is refused with a toast. Finer audio controls are split out to PM-109..PM-112. (src: src/background/BackgroundAudiosComp.tsx:78-103 · src/helper/mediaControlHelpers.ts:156-167)
- **PM-35** — the media context menu has exactly: `Copy Path to Clipboard`, reveal-in-explorer, `Show on Screens` (presenter only), video-only `Toggle Fading at End`, and `Move to Trash`→confirm; `Move to Trash` is gated to items NOT currently live. Item enumeration is now owned by **CM**. (src: src/background/BackgroundMediaItemComp.tsx:79-91 · src/background/BackgroundVideosComp.tsx:203-219)
- **PU-04** — Web Editor is NOT a "URL+title" form and is NOT reached via `+`. It is a **Monaco HTML IDE + live `<iframe>` preview split**, reached via a web-FILE item's `Edit` menu, and it **autosaves** on content change (`writeFileData`); the preview iframe reloads on file update. (src: src/background/web/WebEditorComp.tsx:35-63 · src/background/web/WebEditorIDEComp.tsx:26-75)

## COUNTS

- **New PM rows added: 24** (PM-90 .. PM-113).
- **Last ID used: PM-113.** (Range PM-114 .. PM-129 unused.)
- REFINE entries: 6 (PM-30, PM-31, PM-33, PM-34, PM-35, PU-04).
- Source GAP accounting (39 total): 24 converted to rows above · 14 deferred to **CM**
  as context-menu items (PM-37, PM-43, PM-48, PM-51, PM-55, PM-57, PM-60, PM-61,
  PM-62, PM-63, PM-64, PM-67, PM-68, PM-69) · 1 deferred to the **PU** expansion
  (PU-07, Web Editor Monaco extras — outside the assigned PM range).
- Not turned into rows (discover-verified non-features): **"recent colors"** does not
  exist (`ColorPicker` renders only `colorList.main`); **`VideoHeaderSettingComp`**
  ("Fading at the End" checkbox) is dead/unimported code.
- Shared list chrome (PM-98, PM-99, PM-100, PM-101, plus PM-102/103) also renders in
  Documents/Lyrics/Bible lists — candidates for hoisting to **GL** if a future sweep
  wants a single home; kept under PM here since they were discovered in the bg panel.
