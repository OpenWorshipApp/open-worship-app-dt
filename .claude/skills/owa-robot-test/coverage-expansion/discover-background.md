# Background Panel — Test-Path Inventory (robot UNIT-tester sweep)

Area: `src/background/*` + color infra `src/others/color/*` + shared list chrome
(`FileListHandlerComp` / `PathSelectorComp` / `RenderPathTitleComp` /
`BackgroundFooterComp` / `AppRangeComp` / `ItemColorNoteComp`) as rendered inside the
Background panel. Maps against existing matrix rows **PM-26..PM-35** and **PU-04**.

Static source sweep only — no live driving. Interaction legend: 🖱️ click, 🖱️🖱️ dbl,
🖱️R contextmenu, ⇕ drag/drop, ⌨️ key, 🎚️ range slider, ⌨️✎ text/number input, 🖐️ hover.

**Key source facts that drive the pass conditions below**
- Presenting a background item is a **single-click toggle**:
  `ScreenBackgroundManager.applyBackgroundSrc` clears when `data.src === null` **or** the
  clicked src equals the already-live src (`src/_screen/managers/ScreenBackgroundManager.ts:305-323`).
  A second click on the same item clears it; a double-click nets to nothing. This makes
  the existing `🖱️🖱️` rows (PM-30/PM-31) wrong.
- Live-on-screen highlight class = `app-highlight-selected` (`HIGHLIGHT_SELECTED_CLASSNAME`,
  `src/helper/helpers.ts:15`); drop-target highlight = `receiving-data-drop`
  (`:14`). Active background tab is prefixed `*` and item title gains
  `Show in presents:<ids>` (`backgroundHelpers.ts:39-45`).
- The Background wrapper starts collapsed (`app-hidden-widget`); tabs don't exist in the
  DOM until expanded (KB §5).
- `RenderAudiosTabComp`, `BackgroundAudiosComp` and the `Document Audios` split only exist
  on the **presenter** page (`appProvider.isPagePresenter`, `BackgroundComp.tsx:162,170`).
- **Not real features (do not add rows):** there is **no "recent colors"** anywhere —
  `ColorPicker` only renders `colorList.main` (`ColorPicker.tsx:144`). `VideoHeaderSettingComp.tsx`
  ("Fading at the End" checkbox) is **dead code** — defined but never imported (grep: only its
  own definition). Flagging so the matrix owner doesn't invent rows for them.

---

## Table

| Proposed ID | Target (component) | Interaction | Keys | Given | When | Then (observable) | Source (file:line) | Status |
|---|---|---|---|---|---|---|---|---|
| PM-26 | `BackgroundComp` collapsed wrapper | 🖱️ | — | panel collapsed (`app-hidden-widget`) | click `Background`/`Note` label | tab bar (`Colors…Webs`) renders as real `button.nav-link`s; collapse hides again | `BackgroundComp.tsx:154-168` | COVERED |
| PM-27 | Background tab bar (`TabRenderComp`) | 🖱️ | — | panel expanded | click each of Colors/Images/Videos/Cameras/Webs | single-select switch (`background-tab` setting); the tab whose type is live gets `*` prefix (`checkIsOnScreen`→`genIsSelected`) | `BackgroundComp.tsx:107-153` | COVERED |
| PM-28 | `RenderAudiosTabComp` (`♫Audios♫`) | 🖱️ | — | presenter page | click tab; click again while a bg audio plays | toggles `background-audio-active`; off-while-playing → `showAudioPlayingToast` (GL-10) and no collapse; **while a bg audio plays the tab button itself gains `app-on-screen`** (dataset.isBackgroundAudio guard) | `BackgroundComp.tsx:46-95,121-129` | COVERED |
| PM-29 | `BackgroundColorsComp` swatch (`RenderColor`) | 🖱️ | — | Colors tab, no color live | click a `main` color swatch | color bg applies on mini-screen; may pop contrast confirm (Cancel/Ok, KB §5); selected swatch wrapped in `app-highlight-selected`; second click on same → clears | `BackgroundColorsComp.tsx:77-101`, `RenderColor.tsx:53-82`, `ScreenBackgroundManager.ts:305-323` | COVERED |
| PM-30 | `BackgroundImagesComp` item | 🖱️ (NOT 🖱️🖱️) | — | Images tab, item present | single click an image | image bg goes live (`app-highlight-selected` + `*Images` tab + `.app-on-screen`); **clicking again clears** — a double-click nets to nothing | `BackgroundMediaItemComp.tsx:92-113`, `ScreenBackgroundManager.ts:309` | REFINE — matrix says 🖱️🖱️; source is single-click toggle |
| PM-31 | `BackgroundVideosComp` item | 🖱️ (NOT 🖱️🖱️) | — | Videos tab, item present | single click a video | video bg goes live (same signals as PM-30); second click clears | `BackgroundVideosComp.tsx:143-158`, `BackgroundMediaItemComp.tsx:92-113` | REFINE — same 🖱️🖱️ error as PM-30 |
| PM-32 | `BackgroundCameraItemComp` | 🖱️ | — | Cameras tab, ≥1 device | click a camera card | `handleBackgroundSelecting('camera',{deviceId})` single-click toggle; card gets `app-highlight-selected`; live camera renders on screen (EX-03 if no device) | `BackgroundCameraItemComp.tsx:57-65` | COVERED |
| PM-33 | `BackgroundWebComp` item + header `+` | 🖱️ / 🖱️R | — | Webs tab | click a web item; click header `+` | item goes live (toggle). **`+` (RenderPathTitleComp add) opens a CONTEXT MENU (Add URL / New File / Add Items / Open Shared Link), NOT the Web Editor** — the editor opens only via an item's `Edit` menu | `BackgroundWebComp.tsx:85-115`, `RenderPathTitleComp.tsx:36-45`, `backgroundWebHelpers.tsx:124-134` | REFINE — matrix claims `+` opens Web Editor popup; it opens a menu |
| PM-34 | `BackgroundAudiosComp` item + `<audio controls>` | 🖱️ | — | presenter, Audios split active | click an audio item to reveal its player, then Play on native controls; click item again while playing | click toggles `activeMap[filePath]` (mounts/unmounts `AudioBodyComp`); native Play → `handleAudioPlaying` → `AUDIO_PLAYING_CHANGE_EVENT` → **Audios tab gains `app-on-screen`**; clicking a playing item to hide → `showAudioPlayingToast`, refused | `BackgroundAudiosComp.tsx:78-103`, `AudioBodyComp.tsx:43-58`, `mediaControlHelpers.ts:156-167` | REFINE — matrix "🖱️ play; 🖱️ stop" skips the reveal step + the toast-guard + where app-on-screen lands |
| PM-35 | Background media item context menu | 🖱️R | — | Images/Videos tab, item present | right-click a media item | menu (GL-06) with exactly: `Copy Path to Clipboard`, reveal-in-explorer, `Show on Screens` (presenter only), video-only `Toggle Fading at End`, and `Move to Trash`→confirm (only when item NOT live) | `BackgroundMediaItemComp.tsx:79-91`, `FileItemHandlerComp.tsx:27-98`, `BackgroundVideosComp.tsx:203-219` | REFINE — enumerate the 4-5 items + the not-live gate on Trash |
| PM-37 | Color swatch (`RenderColor`) context menu | 🖱️R | — | Colors tab | right-click a swatch | menu with `Copy '<HEX>' to clipboard` + `Show on Screens` (presenter); latter calls `handleBackgroundSelecting('color',{src},force=true)` | `RenderColor.tsx:13-31,48-51` | GAP |
| PM-38 | Color swatch drag | ⇕ | — | Colors tab | drag a swatch onto a mini-screen previewer card | `serializeForDragging` sets a `BACKGROUND_COLOR` payload; drop applies that color to THAT screen (pairs SP-12); card shows `receiving-data-drop` on dragover | `RenderColor.tsx:44-47,58-61`, `colorHelpers.tsx` (`serializeForDragging`) | GAP |
| PM-39 | `SelectCustomColor` "Mix Color" (`input[type=color]`) | ⌨️✎ / ⌨️ | Enter | Colors tab color picker open | change the native color input; press Enter / blur | `type=color` value updates `localColor`; non-immediate path debounces 500ms then applies; Enter/blur force-apply `onColorSelected` → bg restyles | `SelectCustomColor.tsx:47-98`, `RenderColors.tsx:65-70` | GAP — user-flagged custom color picker |
| PM-40 | `OpacitySlider` (in ColorPicker) | 🎚️ | — | a color is selected (`localColor!==null`) | drag the Opacity range (min 1, max 255) | slider debounces 500ms then rewrites the color's alpha hex pair (`setOpacity`) and re-applies to bg | `ColorPicker.tsx:150-155`, `OpacitySlider.tsx:16-34` | GAP — user-flagged |
| PM-41 | `RenderNoColor` ("x") swatch | 🖱️ | — | Colors tab | click the `No Color` (x) tile | in per-screen picker → clears that screen's color bg (`onNoColor`→`applyBackgroundSrc(null)`); in empty-state picker `onNoColor` is undefined → no-op (potential dead control to flag) | `RenderNoColor.tsx:12-31`, `RenderColors.tsx:44-47`, `BackgroundColorsComp.tsx:44-53,96-100` | GAP |
| PM-42 | `RenderColorPickerPerScreenComp` (per-screen edit state) | 🖱️ | — | a COLOR bg already live on ≥1 screen | open Colors tab | one `ColorPicker` card per screen, each headed by `ShowingScreenIcon` (`data-screen-id`); changing a swatch there recolors only that screen (`applyBackgroundSrc` on that id) | `BackgroundColorsComp.tsx:15-56,102-113` | GAP |
| PM-43 | `ColorPicker` container context menu | 🖱️R | — | color picker has a color | right-click the picker body | menu `Copy Color` copies current hex to clipboard | `ColorPicker.tsx:90-105,135` | GAP |
| PM-44 | Media item drag (image/video) | ⇕ | — | Images/Videos tab | drag an item onto a mini-screen card | `handleDragStart(fileSource, dragType)` → dropping presents that bg on the targeted screen (pairs SP-12); `data-file-item-file-src` present for targeting | `BackgroundMediaItemComp.tsx:69-72,108-110` | GAP — user-flagged per-item drag |
| PM-45 | Media item color-note dot (`ItemColorNoteComp`) + grouping | 🖱️ | — | Images/Videos tab | click the `bi-record-circle` dot → pick a color; clear it | dot menu (No Color + palette, current disabled); picking sets file color-note; items regroup under a `genColorBar` header (grouping ON for image/video) | `BackgroundMediaItemComp.tsx:124-132`, `ItemColorNoteComp.tsx:15-111` | GAP |
| PM-46 | Header **Reload/refresh** button (`RenderPathTitleComp`) | 🖱️ | — | any bg tab, dir set | click the `bi-arrow-clockwise` (title "Reload") | `dirSource.fireReloadEvent()` re-reads the folder; list re-renders (shared chrome — appears atop every bg tab) | `RenderPathTitleComp.tsx:16-35` | GAP — user-flagged refresh button |
| PM-47 | Header **Add-items `+`** button (`RenderPathTitleComp`) | 🖱️ | — | any bg tab, dir set | click the `bi-plus-lg` (title "Add items") | opens a context menu: `Add Items` (→OS file dialog, EX-01) plus per-tab download items (`Download From URL`, `Paste Image` for images, `Add URL`/`New File` for web) | `RenderPathTitleComp.tsx:36-45`, `FileListHandlerComp.tsx:148-162`, `droppingFileHelpers.ts:170-180` | GAP — user-flagged header add button |
| PM-48 | `PathSelectorComp` path context menu | 🖱️R | — | any bg tab, dir set | right-click the path row | menu: `Copy to Clipboard`, reveal-in-explorer, `Edit Parent Path` (not on setting page), `Unset Directory Path` (sets dirPath='') | `PathSelectorComp.tsx:21-57` | GAP (shared chrome; candidate for GL) |
| PM-49 | `PathSelectorComp` editor toggle | 🖱️ | — | any bg tab, dir set | click the `bi-chevron-down/right` path row | toggles the lazy `PathEditorComp` inline editor open/closed (title flips "Show/Hide path editor") | `PathSelectorComp.tsx:76-111` | GAP (shared chrome) |
| PM-50 | `BackgroundFooterComp` thumbnail-size (`AppRangeComp`) | 🎚️ / 🖱️ / ⌨️ | Ctrl+wheel | any media/camera/web tab | drag range (min 50/max 500/step 10), click `bi-zoom-out`/`bi-zoom-in`, Ctrl+scroll over the card | `bg-thumbnail-width` setting changes → every thumbnail rescales (distinct from PM-09's presenter slide slider, max 200); pinch also works | `BackgroundFooterComp.tsx:4-38`, `AppRangeComp.tsx:169-268`, `BackgroundMediaComp.tsx:116-121` | GAP |
| PM-51 | Empty card-body context menu (`FileListHandlerComp`) | 🖱️R | — | any bg tab, dir set, empty area | right-click empty list body | `genDroppingFileOnContextMenu`: `Add Items` + per-tab items (`Download From URL`, `Paste Image`, web `New File`/`Add URL`, `Open Shared Link`) | `FileListHandlerComp.tsx:190-201`, `droppingFileHelpers.ts:182-227` | GAP |
| PM-52 | Drop external media file onto panel | ⇕ | — | any bg tab, dir set | drag a file over the card, then drop | dragover sets card `opacity:0.5` when all items are files (mimetype gate, testable); drop copies valid files into the dir (drop pipeline needs real files — see CLAUDE.md drop note) | `FileListHandlerComp.tsx:170-178`, `droppingFileHelpers.ts:17-128` | GAP |
| PM-53 | `NoDirSelectedComp` empty state | 🖱️ | — | bg tab whose dir is UNSET | open that tab | `NoDirSelectedComp` renders with the `defaultFolderName` (e.g. offer to set default dir) instead of a list | `FileListHandlerComp.tsx:208-213` | GAP (edge/empty state) |
| PM-54 | Video item hover autoplay | 🖐️ | — | Videos tab, item present | hover a video thumbnail; leave | `onMouseEnter` plays the muted `<video>` and sets `title` to `name\n(duration)`; `onMouseLeave` pauses | `BackgroundVideosComp.tsx:75-101` | GAP |
| PM-55 | Video "Toggle Fading at End" | 🖱️R | — | Videos tab, item present | right-click video → `Toggle Fading at End` | flips `getIsFadingAtTheEndSetting`; when on, a `bi-shadows` icon appears top-right of that thumbnail (titled) | `BackgroundVideosComp.tsx:203-219,119-137` | GAP |
| PM-56 | Camera device enumeration / empty state | 🖱️ | — | Cameras tab | open the tab | `useCameraInfoList` → `requestCameraAccess`+`enumerateDevices`; one `BackgroundCameraItemComp` per `videoinput`; **empty (no card) when access denied or no device** (EX-03) | `BackgroundCamerasComp.tsx:13,28-39`, `cameraHelpers.ts:27-53` | GAP |
| PM-57 | Camera item context menu | 🖱️R | — | Cameras tab, ≥1 device | right-click a camera card | menu has only `Show on Screens` (presenter) → force-choose screen present | `BackgroundCameraItemComp.tsx:49-56` | GAP |
| PM-58 | Camera item drag | ⇕ | — | Cameras tab, ≥1 device | drag a camera card to a mini-screen | `cameraDragSerialize` → `BACKGROUND_CAMERA` payload; drop shows that camera on the screen | `BackgroundCameraItemComp.tsx:40-47,75-76`, `backgroundHelpers.ts:64-69` | GAP |
| PM-59 | Web item hover → live iframe | 🖐️ | — | Webs tab, item present | hover a web thumbnail | `RenderWebChildComp` sets `isPlaying=true` on `onMouseOver` → mounts `RenderBackgroundWebIframeComp` (`iframe sandbox="allow-scripts"`); `onMouseOut` unmounts it; static `bi-globe`/`bi-filetype-html` placeholder otherwise | `BackgroundWebChildComp.tsx:36-85`, `RenderBackgroundWebIframeComp.tsx:62-110` | GAP |
| PM-60 | Web **URL** item context menu (`BackgroundWebUrlItemComp`) | 🖱️R | — | Webs tab, a URL item exists | right-click a URL card | menu: `Copy URL to Clipboard`, `Show on Screens`, and `Remove URL` (only when NOT live) → `showAppConfirm` | `BackgroundWebUrlItemComp.tsx:60-84` | GAP |
| PM-61 | Web **file** item "Edit" → Web Editor popup | 🖱️R | — | Webs tab, a `.html` file item | right-click file item → `Edit` | `openPopupWebEditorWindow` opens a new `webEditor.html` popup target (list_pages) focused on that file (PU-04) | `backgroundWebHelpers.tsx:124-134,110-122` | GAP |
| PM-62 | Web "New File" flow | 🖱️R / ⌨️✎ | — | Webs tab, dir set | empty-area / `+` menu → `New File`; type a name; confirm | input popup (esc/enter disabled) → writes `<name>.html` with the default gradient template; duplicate name → toast "File already exists" | `backgroundWebHelpers.tsx:66-108,29-64` | GAP |
| PM-63 | "Add URL" flow (`promptBackgroundWebUrlSource`) | 🖱️ / ⌨️✎ | — | Webs tab | `+`/menu → `Add URL`; enter a URL | `askForURL` input popup ("Web URL:", prefills http clipboard, empty→`is-invalid`); non-http→toast "Invalid URL"; duplicate→toast "URL already exists"; else new URL card appears + persists to `background-web-url-list` | `BackgroundWebComp.tsx:49-59`, `backgroundWebUrlHelpers.ts:173-194`, `downloadHelper.tsx:18-77` | GAP |
| PM-64 | "Remove URL" confirm | 🖱️R | — | Webs tab, a URL item not live | URL item menu → `Remove URL` | `showAppConfirm('Remove URL', 'Remove "…"?', Yes)`; on Yes the card disappears + list persists; on Cancel unchanged | `BackgroundWebComp.tsx:60-79`, `BackgroundWebUrlItemComp.tsx:71-80` | GAP |
| PM-65 | Web URL item drag | ⇕ | — | Webs tab, a URL item | drag a URL card to a mini-screen | `handleDragStart(urlSource, BACKGROUND_WEB)` → drop presents that web bg on the screen | `BackgroundWebUrlItemComp.tsx:89-96,105-108` | GAP |
| PM-66 | Web URL/file item color note | 🖱️ | — | Webs tab, an item | click the URL item's `bi-record-circle` dot → pick color | sets the URL's color-note (`background-web-url_<id>` setting) via `onColorNoteChange`; note web grouping is DISABLED (`disableColorNoteGrouping`) so items don't regroup | `BackgroundWebUrlItemComp.tsx:116-129`, `BackgroundWebComp.tsx:80-84,151`, `backgroundWebUrlHelpers.ts:135-144` | GAP |
| PM-67 | "Download From URL" input popup (`askForURL`) | 🖱️ / ⌨️✎ | — | Images/Videos/Audios tab | `+`/menu → `Download From URL`; type URL; Ok | input popup (`InputUrlComp`, empty→`is-invalid`, prefills http clipboard); Ok with non-http→toast "Invalid URL"; valid→progress bar + toast, file lands in dir | `downloadHelper.tsx:18-115`, `BackgroundImagesComp.tsx:126-172`, `BackgroundVideosComp.tsx:160-201`, `BackgroundAudiosComp.tsx:32-76` | GAP |
| PM-68 | "Paste Image" context menu (images) | 🖱️R | — | Images tab, dir set, image in clipboard | empty-area/`+` menu → `Paste Image` | writes clipboard image(s) into the dir via `readImagesFromClipboard`+`writeFileBase64Data`; only shown when `checkIsImagesInClipboard` true | `BackgroundImagesComp.tsx:82-125` | GAP |
| PM-69 | "Open Shared Link" menu item | 🖱️ | — | any media/web tab menu | click `Open Shared Link` | `openExternalURL(<homepage>/shared#<key>)` — external browser (EX-04: presence/name only) | `downloadHelper.tsx:79-90` | GAP (EX-04) |
| PM-70 | Audio item reveal/hide toggle | 🖱️ | — | presenter, Audios split active, item present | click an audio item | toggles `activeMap[filePath]`: shows/hides `AudioBodyComp` (`<audio controls>`); a video-sourced item shows a `bi-film` badge; clicking to hide while playing → `showAudioPlayingToast`, refused | `BackgroundAudiosComp.tsx:80-103`, `AudioBodyComp.tsx:76-110` | GAP |
| PM-71 | Audio native play/pause + mutual exclusion | 🖱️ | — | audio player revealed | click Play on the native `<audio>` control; play a second one | `handleAudioPlaying` pauses+rewinds all other `<audio>`, fires `AUDIO_PLAYING_CHANGE_EVENT` → Audios tab `app-on-screen`; pause → event null → highlight clears | `AudioBodyComp.tsx:50-53`, `mediaControlHelpers.ts:156-172` | GAP |
| PM-72 | Audio seek (native scrubber) | 🖱️ | — | audio player revealed | drag the native `<audio controls>` scrubber | `currentTime` changes; playback continues from the new position (native control; observable via `audio.currentTime`) | `AudioBodyComp.tsx:46-58` | GAP — user-flagged audio seek |
| PM-73 | Audio repeat toggle (`bi-repeat-1`) | 🖱️ | — | audio player revealed | click the repeat icon; let the track end | toggles per-file `…-repeat-<md5>` setting; icon flips green/opacity-1 vs dim; on `ended` with repeat on, `handleAudioEnding` restarts the track instead of stopping | `AudioBodyComp.tsx:33-70`, `mediaControlHelpers.ts:174-183` | GAP — user-flagged audio repeat |
| PM-74 | Document Audios split (`VaryAppDocumentAudiosComp`) | 🖱️ | — | presenter, Audios split active, a pptx doc with embedded audio present | open Audios split | a bottom `Document Audios` split lists each slide's audio with `RenderSlideIndexComp` + its own `AudioBodyComp`; absent when `useAppDocumentAudioData` returns null | `BackgroundAudiosComp.tsx:135-176`, `VaryAppDocumentAudiosComp.tsx:32-88`, `backgroundHelpers.ts:120-145` | GAP (needs pptx w/ audio; else BLOCKED) |
| PU-04 | Web Editor popup (`WebEditorComp`) | ⌨️✎ / ⌨️ | Ctrl+S | Webs tab → item `Edit` (PM-61) | popup opens; type HTML in Monaco; observe preview | it is a **Monaco HTML IDE + live `<iframe>` preview split** (NOT a URL/title form): `WebEditorIDEComp` autosaves on content change (`writeFileData`), `WebPreviewerComp` iframe reloads on file update; ⇕ splitter resizes editor/preview | `web/WebEditorComp.tsx:35-63`, `web/WebEditorIDEComp.tsx:26-75`, `web/WebPreviewerComp.tsx:6-35` | REFINE — matrix PU-04 wrongly says "URL+title" form and reaches it via `+` |
| PU-07 | Web Editor Monaco extras | 🖱️R / 🖱️ | — | Web Editor popup open | right-click the Monaco editor → `Learn More About Web Development`; type to trigger preview reload | custom editor action opens MDN HTML docs (EX-04); previewer iframe re-fetches `src?t=<ts>` on each `update` event | `web/WebEditorIDEComp.tsx:31-42`, `web/WebPreviewerComp.tsx:10-17` | GAP |

---

### Summary

Counts — **COVERED 5 · REFINE 6 · GAP 39**

REFINE / GAP quick index (6-word hooks):

- **PM-30** REFINE — image select is single-click toggle
- **PM-31** REFINE — video select is single-click toggle
- **PM-33** REFINE — web `+` opens menu, not editor
- **PM-34** REFINE — audio reveal step + tab highlight
- **PM-35** REFINE — enumerate each media context item
- **PU-04** REFINE — Web Editor is Monaco HTML IDE
- **PM-37** GAP — color swatch context menu items
- **PM-38** GAP — color swatch drag to screen
- **PM-39** GAP — custom "Mix Color" picker input
- **PM-40** GAP — color-picker opacity slider
- **PM-41** GAP — "No Color" x swatch clears
- **PM-42** GAP — per-screen color editor state
- **PM-43** GAP — color-picker "Copy Color" menu
- **PM-44** GAP — media item drag to screen
- **PM-45** GAP — media item color-note + grouping
- **PM-46** GAP — header Reload/refresh button
- **PM-47** GAP — header Add-items `+` menu
- **PM-48** GAP — path-row context menu items
- **PM-49** GAP — path editor toggle chevron
- **PM-50** GAP — background thumbnail-size slider + zoom
- **PM-51** GAP — empty card-body context menu
- **PM-52** GAP — drop external media file
- **PM-53** GAP — no-directory empty state
- **PM-54** GAP — video hover autoplay + duration
- **PM-55** GAP — video Toggle-Fading-at-End menu
- **PM-56** GAP — camera device enumeration/empty state
- **PM-57** GAP — camera item context menu
- **PM-58** GAP — camera item drag to screen
- **PM-59** GAP — web item hover iframe
- **PM-60** GAP — web URL item context menu
- **PM-61** GAP — web file Edit opens popup
- **PM-62** GAP — web New File flow
- **PM-63** GAP — Add URL prompt flow
- **PM-64** GAP — Remove URL confirm dialog
- **PM-65** GAP — web URL item drag
- **PM-66** GAP — web URL/file color note
- **PM-67** GAP — Download-From-URL input popup
- **PM-68** GAP — Paste Image clipboard menu
- **PM-69** GAP — Open Shared Link external
- **PM-70** GAP — audio item reveal/hide toggle
- **PM-71** GAP — audio play mutual-exclusion + highlight
- **PM-72** GAP — audio native seek scrubber
- **PM-73** GAP — audio repeat-1 toggle
- **PM-74** GAP — Document Audios pptx split
- **PU-07** GAP — Monaco Learn-More + preview reload

Notes for the matrix owner: "recent colors" is **not a feature** (no row needed);
`VideoHeaderSettingComp` is **dead code** (unimported). PM-46..PM-52 are **shared list
chrome** (also render in Documents/Lyrics/Bible lists) — consider hoisting to GL to avoid
duplicate rows across areas.
