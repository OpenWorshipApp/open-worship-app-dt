# Foreground widgets — exhaustive test-path inventory

Area: `src/presenter-foreground/*` (the **Foreground** tab in the presenter middle
column, `PresenterForegroundComp`). 8 stacked widgets +
`ForegroundImagesSlideShowComp`, all wrapped in the shared `ForegroundLayoutComp`
card, all styled through the shared `useForegroundPropsSetting` /
`PropertiesSettingComp` / `CommonStyleControlsComp` panel.

Existing matrix rows for this area: **PM-15, PM-16, PM-17, PM-18, PM-19, PM-20,
PM-21, PM-22, PM-23, PM-24, PM-25, PM-36** (PM-10 = shared `SlideAutoPlayComp`).
New GAP ids start at **PM-37** (existing PM max = PM-36).

Legend: 🖱️ click · 🖱️🖱️ dblclick · 🖱️R right-click/contextmenu · ⇕ drag+drop ·
⌨️ keyboard · 🎚️ range slider · ⌨️✎ text/number/date input · 🖐️ hover · 🔀 switch/checkbox.

Shared "on-screen" observable used throughout: `ForegroundLayoutComp` stamps
`.app-on-screen` on the widget header when `showingScreenIdDataList.length > 0`
(`ForegroundLayoutComp.tsx:57`), and `ScreensRendererComp` renders a Hide button +
`ShowingScreenIcon` per showing screen (`ScreensRendererComp.tsx:21-47`). Both are
black-box checkable in the presenter without needing the real `screen.html` target.

---

## A. Shared card shell — `ForegroundLayoutComp`

| Proposed ID | Target (component) | Interaction | Keys | Given | When | Then (observable) | Source | Status |
|---|---|---|---|---|---|---|---|---|
| PM-37 | `ForegroundLayoutComp` header | 🖱️ | – | Foreground tab open, any widget card collapsed | Click the card header row | Chevron flips `bi-chevron-right`→`bi-chevron-down`; `.card-body` appears (was absent); setting `foreground-<target>-show-opened` = true; click again reverses all three | `ForegroundLayoutComp.tsx:34-77` | GAP |
| PM-38 | `PropertiesSettingComp` toggle | 🖱️ | – | A widget card expanded | Click the pill button "Properties" (`bi-sliders2`) | Button class `btn-outline-secondary`→`btn-secondary`; inner chevron `transform: rotate(180deg)`; the props panel (`.app-inner-shadow`) renders; setting `foreground-<target>-show-properties-setting` flips | `propertiesSettingHelpers.tsx:278-354` | GAP |

---

## B. Shared **geometry** controls (Properties panel, `isGeometry` widgets)

`isGeometry` is TRUE for Quick Text, Countdown, Stopwatch, Time, Camera, Web;
FALSE for both Marquees (`ForegroundMarqueeComp.tsx:241` `isGeometry:false`) —
marquees show only common-style + their own extraControls, NOT these. PM-24 is the
only existing (vague) umbrella row; each control below is an untracked sub-path.

| Proposed ID | Target | Interaction | Keys | Given | When | Then (observable) | Source | Status |
|---|---|---|---|---|---|---|---|---|
| PM-39 | `SlideEditorToolAlignComp` (Align group) | 🖱️ | – | Props panel open on an isGeometry widget, widget live on a screen | Click a horizontal/vertical align cell | `alignmentData` JSON updates (`horizontal/verticalAlignment`); if live, `onChange1`→`refreshAll*` re-pushes style, widget re-anchors on mini-screen (transform-origin/left/top change) | `propertiesSettingHelpers.tsx:360-377`, transform logic `103-181` | GAP |
| PM-40 | Position offset X / Y | ⌨️✎ | – | Props panel open, widget live | Type into the X then Y number inputs | `-widget-offset-x/-y` settings change; live widget translates by px (`genMinusCalc`/`left/top` px); restore to 0 | `propertiesSettingHelpers.tsx:378-401,287-306` | GAP |
| PM-41 | Width (%) slider | 🎚️ | – | Props panel open, widget live | Drag the "Width (%)" range (min1 max100) | `input[type=range].form-range` value + shown number change; `-widget-width-percentage`; live widget `width:%` rescales | `propertiesSettingHelpers.tsx:402-418`, `AppRangeComp.tsx:245-247` | GAP |
| PM-42 | Scale slider | 🎚️ | – | Props panel open, widget live | Drag the "Scale" range (min0.1 max3 step0.1) | `-widget-scale`; live widget `transform: scale()` changes | `propertiesSettingHelpers.tsx:419-435` | GAP |
| PM-43 | Opacity slider | 🎚️ | – | Props panel open, widget live | Drag the "Opacity" range (min0 max100) | `-widget-opacity-percentage`; live widget `opacity` = value/100 | `propertiesSettingHelpers.tsx:436-452` | GAP |
| PM-44 | Round (%) slider | 🎚️ | – | Props panel open, round-size-px = 0 | Drag "Round (%)" range (min0 max100) | `-widget-round-percentage`; live `border-radius:%` = value/2; when round-px>0 this PropGroup is dimmed (`opacity:0.5`) and title becomes "Set round size pixel to 0 to use this" | `propertiesSettingHelpers.tsx:453-475,36-58` | GAP |
| PM-45 | Round size pixel input | ⌨️✎ | – | Props panel open, widget live | Type a px value >0 | `-widget-round-size-px`; live `border-radius:<px>px` overrides the % path; PM-44 group visibly dims; setting back to 0 re-enables % | `propertiesSettingHelpers.tsx:476-494,308-316` | GAP |
| PM-46 | Font size (geometry, `isFontSize`) | ⌨️✎ | – | Props panel of QuickText/Countdown/Stopwatch/Time (all `isFontSize:true`) | Type a px value | `-widget-font-size`; live widget `font-size:<px>px` changes | `propertiesSettingHelpers.tsx:497-514,318-326` | GAP |

---

## C. Shared **common-style** controls (`CommonStyleControlsComp`, `isCommonStyle` default true)

Present on marquees, quick-text, countdown, stopwatch, time, camera, web. PM-24 lumps
these as "font-size/color/position"; each is an untracked distinct control.

| Proposed ID | Target | Interaction | Keys | Given | When | Then (observable) | Source | Status |
|---|---|---|---|---|---|---|---|---|
| PM-47 | `FontFamilyControlComp` (Font Family card) | 🖱️/🖱️✎ | – | Props panel open, widget live | Pick a font family and a weight | `-common-font-family` / `-common-font-weight` settings change; the editor textarea (marquee/quick-text) restyles and live widget font changes; `(Missing)` label is informative not a bug | `ForegroundCommonPropertiesSettingComp.tsx:133-144`, uses `others/FontFamilyControlComp` | GAP |
| PM-48 | Backdrop Filter input | ⌨️✎ | – | Props panel open, widget live | Type a px value in "Backdrop Filter" | `-common-backdrop-filter`; live widget `backdrop-filter: blur(<px>px)` | `ForegroundCommonPropertiesSettingComp.tsx:145-159,124-126` | GAP |
| PM-49 | Text Color (`ColorPropCardComp` → `ColorPicker`) | 🖱️ | – | Props panel open | Click "Text Color:" row to expand, pick a color; also test the no-color reset | Chevron `right`→`down`, ColorPicker appears; `-common-color` changes; live text color changes; no-color restores `DEFAULT_TEXT_COLOR` (white) | `ForegroundCommonPropertiesSettingComp.tsx:165-176,67-99` | GAP |
| PM-50 | Background Color (`ColorPropCardComp` → `ColorPicker`) | 🖱️ | – | Props panel open | Expand "Background Color:", pick a color; test no-color reset | `-common-background-color` changes; live widget bg changes; no-color restores `#000080AA` | `ForegroundCommonPropertiesSettingComp.tsx:177-190` | GAP |
| PM-24 | Common/props panel restyle round-trip (umbrella) | 🎚️/⌨️✎ | – | A foreground widget live on the mini-screen | Change any props/common control | Live foreground restyles on mini-screen and (SC-02) on the real screen — **existing row is too coarse; use PM-39..50 for the individual controls, PM-24 for the end-to-end restyle observable** | `propertiesSettingHelpers.tsx:581-583` (`onChange1`→`genStyle`) | REFINE |

---

## D. Marquee (top + bottom) — `ForegroundMarqueeComp`

Base show/speed/hide covered by **PM-36** (top) and **PM-15** (bottom). Both existing
rows tag the speed control 🎚️, but it is a **number input + preset button group**,
not a range slider — and they omit the font-size controls and the date button.

| Proposed ID | Target | Interaction | Keys | Given | When | Then (observable) | Source | Status |
|---|---|---|---|---|---|---|---|---|
| PM-15 / PM-36 | Marquee bottom / top base | ⌨️✎ + 🖱️ | – | Foreground tab | Type text, click "Show Marquee Top/Bottom" (`bi-display`) | Header gets `.app-on-screen`; marquee scrolls along top/bottom of mini-screen; Hide button+icon appear. **REFINE:** speed is ⌨️✎/preset not 🎚️; changing speed while showing re-paces live (`refreshAllMarquees`, per-position debouncer) | `ForegroundMarqueeComp.tsx:465-477,147-167` | REFINE |
| PM-51 | "Today's Date" button (`bi-calendar-plus`) | 🖱️ | – | Marquee card expanded | Click "Today's Date" | Textarea value replaced with locale-formatted long date (weekday/month/day/year) | `ForegroundMarqueeComp.tsx:441-448,404-414` | GAP |
| PM-52 | Marquee font-size number input (`bi-fonts`, 0=auto) | ⌨️✎ | – | Marquee props panel open, marquee live | Type a px font size | `foreground-marquee-<pos>-font-size`; live marquee `font-size:<px>px` (0 = auto, placeholder "auto"); pushed via `refreshShowing` | `ForegroundMarqueeComp.tsx:256-273,220-226` | GAP |
| PM-53 | Marquee font-size presets (Auto/50/75/100/150) | 🖱️ | – | Marquee props panel open | Click a preset button | Clicked button gets `.active`; `fontSize` set to preset; "0" renders label "Auto"; live marquee resizes | `ForegroundMarqueeComp.tsx:274-294,37` | GAP |
| PM-54 | Marquee speed number input (`bi-speedometer2`, %) | ⌨️✎ | – | Marquee props panel open, marquee live | Type a speed % (min10 max1000 step10) | `foreground-marquee-<pos>-speed-percentage`; marquee scroll re-paces live | `ForegroundMarqueeComp.tsx:295-313,227-236` | GAP |
| PM-55 | Marquee speed presets (50/75/Normal/150/200) | 🖱️ | – | Marquee props panel open | Click a preset | Clicked button `.active`; `speedPercentage` set; 100 renders label "Normal"; live re-pace | `ForegroundMarqueeComp.tsx:314-338,38` | GAP |

---

## E. Quick Text — `ForegroundQuickTextComp`

Base covered by **PM-16** (text/show/hide). Missing: the two timing inputs, markdown
render, drag/right-click. Uses `isFontSize:true` (geometry font size PM-46 applies).

| Proposed ID | Target | Interaction | Keys | Given | When | Then (observable) | Source | Status |
|---|---|---|---|---|---|---|---|---|
| PM-16 | Quick Text base | ⌨️✎ + 🖱️ | – | Foreground tab | Type markdown, click "Show Quick Text" (`bi-display`) | Header `.app-on-screen`; markdown-rendered HTML overlays on mini-screen for `timeSecondToLive` secs; Hide appears. **REFINE:** note it is Markdown (rendered via `renderMarkdown`), delayed by `timeSecondDelay`, auto-expires | `ForegroundQuickTextComp.tsx:243-255,95-111` | REFINE |
| PM-56 | Delay input (`bi-hourglass-top`, min0) | ⌨️✎ | – | Quick Text card expanded | Type seconds into "Delay" | `foreground-quick-text-time-delay`; on next Show the overlay is delayed that many seconds | `ForegroundQuickTextComp.tsx:181-202,134-140` | GAP |
| PM-57 | Live input (`bi-clock`, min1) | ⌨️✎ | – | Quick Text card expanded | Type seconds into "Live" | `foreground-quick-text-time-to-live`; overlay stays that many seconds then auto-hides | `ForegroundQuickTextComp.tsx:203-222,142-148` | GAP |

---

## F. Countdown — `ForegroundCountDownComp` (BOTH modes render together)

Base datetime = **PM-17**, duration = **PM-18**. Both sub-panels are always visible
(`ForegroundCountDownComp.tsx:368-369`). Missing: reset, date/time/hours/minutes inputs.
`isFontSize:true` (PM-46 applies).

| Proposed ID | Target | Interaction | Keys | Given | When | Then (observable) | Source | Status |
|---|---|---|---|---|---|---|---|---|
| PM-17 | Countdown-to-datetime base | 🖱️ | – | Countdown card expanded | Click "Start Countdown to DateTime" (`bi-play-fill`) | Header `.app-on-screen`; live countdown to target date+time on mini-screen; Hide "Hide Countdown" appears | `ForegroundCountDownComp.tsx:160-170` | COVERED |
| PM-18 | Countdown-for-duration base | 🖱️ | – | Countdown card expanded | Click "Start Countdown" (duration panel) | Live countdown from now+h/m; Hide appears | `ForegroundCountDownComp.tsx:282-291` | COVERED |
| PM-58 | Reset button (`bi-arrow-counterclockwise`) | 🖱️ | – | Datetime panel, date/time edited away from now | Click "Reset" | Date input → today (`todayString`), time input → now (`nowString`) | `ForegroundCountDownComp.tsx:128-135,87-91` | GAP |
| PM-59 | Date input (`type=date`, min=today) | ⌨️✎ | – | Datetime panel | Pick/type a date | `foreground-date-setting` updates; input rejects dates before today (`min`) | `ForegroundCountDownComp.tsx:140-147,97-103` | GAP |
| PM-60 | Time input (`type=time`, min=now) | ⌨️✎ | – | Datetime panel | Pick/type a time | `foreground-time-setting` updates; target datetime recomputed on next Show | `ForegroundCountDownComp.tsx:152-159,104-110` | GAP |
| PM-61 | Duration hours input (min0) | ⌨️✎ | – | Duration panel | Type hours | `foreground-hours-setting`; target = now + h*3600 + m*60 + 1s | `ForegroundCountDownComp.tsx:258-266,189-198` | GAP |
| PM-62 | Duration minutes input (min0 max59) | ⌨️✎ | – | Duration panel | Type minutes | `foreground-minutes-setting`; combined with hours on Show | `ForegroundCountDownComp.tsx:272-281,226-232` | GAP |

---

## G. Stopwatch — `ForegroundStopwatchComp`

**PM-19** says "start/stop" but there is **no stop button** — the only stop is
clicking the Hide/`ShowingScreenIcon` (ScreensRendererComp). `isFontSize:true`.

| Proposed ID | Target | Interaction | Keys | Given | When | Then (observable) | Source | Status |
|---|---|---|---|---|---|---|---|---|
| PM-19 | Stopwatch start + hide | 🖱️ | – | Stopwatch card expanded | Click "Start Stopwatch" (`bi-play-fill`); then click the Hide/screen icon | Header `.app-on-screen`; count-up-from-zero runs on mini-screen; clicking Hide clears it. **REFINE:** no stop button — hide is via the screen-icon, not a toggle | `ForegroundStopwatchComp.tsx:129-141,80-90,40-44` | REFINE |

---

## H. Time (clock) — `ForegroundTimeComp`

**PM-20** ("show; format option") is badly incomplete — it is a **multi-instance**
widget (Add/Remove clocks) with timezone tools, a city picker (huge context menu),
a label input, an offset input, and an AM/PM switch. `isFontSize:true`.

| Proposed ID | Target | Interaction | Keys | Given | When | Then (observable) | Source | Status |
|---|---|---|---|---|---|---|---|---|
| PM-20 | Show Time base | 🖱️ | – | A time card expanded | Click "Show Time" (`bi-display`) | Header `.app-on-screen`; clock renders on mini-screen; "Hide Time" + icon appear. **REFINE:** see PM-63..69 for the real control surface | `ForegroundTimeComp.tsx:254-263,101-110` | REFINE |
| PM-63 | "Use Current Timezone" (`bi-geo-alt`) | 🖱️ | – | Time card expanded | Click it | UTC-offset input snaps to this device's offset (`getSystemTimezoneMinuteOffset`) | `ForegroundTimeComp.tsx:184-191,130-133` | GAP |
| PM-64 | "Choose City" (`bi-globe-americas`) | 🖱️→🖱️ | – | Time card expanded | Click it → app context menu of every tz city opens; pick one | `AppContextMenu` lists sorted `City (Region/City)` items; selecting sets City label input + UTC-offset; dismiss = no change | `ForegroundTimeComp.tsx:192-198,135-143,35-64` | GAP |
| PM-65 | City name text input (`bi-buildings`) | ⌨️✎ | – | Time card expanded | Type a label | `foreground-city-name-setting-<id>`; used as `title` above the clock on screen | `ForegroundTimeComp.tsx:200-216,144-150` | GAP |
| PM-66 | UTC offset input (`min`, number) | ⌨️✎ | – | Time card expanded | Type a minute offset | `foreground-timezone-minute-offset-setting-<id>`; clock time shifts by offset | `ForegroundTimeComp.tsx:217-235,151-159` | GAP |
| PM-67 | AM/PM switch (`role=switch`) | 🔀 | – | A clock is live on a screen | Toggle the AM/PM switch | `foreground-time-is-24-hour-format-setting-<id>` flips; `refreshAllTimes` re-pushes so the live clock switches 24h⇄AM/PM immediately | `ForegroundTimeComp.tsx:236-253,165-175` | GAP |
| PM-68 | "Add Time" (`bi-plus`) | 🖱️ | – | Time widget open | Click the `+` button | A new clock card appears (new UUID pushed to `foreground-time-id-list`); DOM count of `ForegroundTimeItemComp` +1 | `ForegroundTimeComp.tsx:438-447,442-444` | GAP |
| PM-69 | Remove clock (`bi-x-lg` red) | 🖱️ | – | ≥2 clock cards exist (button hidden when only 1) | Click the red ✕ on a clock card | That card is removed; any showing data for it hidden first; id dropped from list — **self-cleaning: add via PM-68 then remove** | `ForegroundTimeComp.tsx:333-347,424-434` | GAP |

---

## I. Background Images Slide Show — `ForegroundImagesSlideShowComp`

**PM-21** covers it loosely. Note: this widget drives the **background image layer**
(via `ScreenBackgroundManager`), not a foreground overlay — "on screen" =
`isAnyItemSelected` (an image is live as bg). `SlideAutoPlayComp` only appears once an
image is selected. Image *picking* from disk = EX-01.

| Proposed ID | Target | Interaction | Keys | Given | When | Then (observable) | Source | Status |
|---|---|---|---|---|---|---|---|---|
| PM-21 | Slideshow auto-advance | 🖱️ | – | ≥1 image already shown as bg (isAnyItemSelected) | Use the `SlideAutoPlayComp` play/timer | Bg image advances on the timer (`handleNextItemSelecting`); mini-screen bg changes. **REFINE:** clarify it drives the bg layer + auto-play gated on a selected image | `ForegroundImagesSlideShowComp.tsx:264-266,45-91` | REFINE |
| PM-70 | Scale Type button → context menu | 🖱️→🖱️ | – | Images widget expanded | Click the scale-type button (shows current, e.g. "stretch") | `AppContextMenu` lists `fill/fit/stretch/tile/center/span`; picking one updates the button label + `images-slide-show-scale-type`, re-applies to the live bg | `ForegroundImagesSlideShowComp.tsx:122-160,45-52` (`scaleTypeList`) | GAP |
| PM-71 | Image item click → show | 🖱️ | – | Images widget lists images | Click an image thumbnail | That image becomes the background on the selected screen (`handleBackgroundSelecting('image')`); item shows `RenderBackgroundScreenIds`; header flips to `.app-on-screen` — restore | `ForegroundImagesSlideShowComp.tsx:203-210,257-262` | GAP |
| PM-10 | `SlideAutoPlayComp` (images prefix) | 🖱️/⌨️✎ | – | isAnyItemSelected true | Expand stopwatch icon, set seconds, play, pause, red ✕ collapse | Same mechanics as the Documents-footer PM-10 (`prefix="images"`) | `SlideAutoPlayComp.tsx:90-168` | COVERED |

---

## J. Camera Show — `ForegroundCameraComp`  (EX-03 when no device)

**PM-22** loosely covers. Each detected device is a card (`onClick` show, `onContextMenu`
force, draggable). Uses geometry props (isCommonStyle default true, isFontSize false).

| Proposed ID | Target | Interaction | Keys | Given | When | Then (observable) | Source | Status |
|---|---|---|---|---|---|---|---|---|
| PM-22 | Camera device base | 🖱️ | – | ≥1 camera device (`useCameraInfoList`) | Click a device card body | `addCameraData`; header `.app-on-screen`; "Hide Camera" + icon appear; live camera on screen. Else BLOCKED→EX-03. **REFINE:** it is a card-body click (not a select dropdown) + per-device geometry props | `ForegroundCameraComp.tsx:83-103,46-58` | REFINE |
| PM-72 | Camera live preview tile | 🖐️/observe | – | Camera device present | Observe the card body | Local `getCameraAndShowMedia` stream renders in the tile (LoadingComp until ready) — presence/render check; EX-03 if no device | `ForegroundCameraComp.tsx:36-45` | GAP |

---

## K. Web Show — `ForegroundWebComp`

**PM-23** claims "⌨️✎ URL" — **wrong**: there is no URL field; the widget lists `.html`
web files from the BACKGROUND_WEB dir via `FileListHandlerComp`. Each item: hover-to-play
iframe, click-to-show, and a **rich right-click menu**; the list container has its own
context menu.

| Proposed ID | Target | Interaction | Keys | Given | When | Then (observable) | Source | Status |
|---|---|---|---|---|---|---|---|---|
| PM-23 | Web item show base | 🖱️ | – | Web widget lists ≥1 web file | Click a web card body | `addWebData`; header `.app-on-screen`; "Hide Web" + icon appear; web overlay on screen. **REFINE:** no URL input — items are web files; drives foreground web layer | `ForegroundWebComp.tsx:196-209,131-146` | REFINE |
| PM-73 | Web item hover-to-play preview | 🖐️ | – | Web widget lists a web file | Hover over the card body (`onMouseOver`) then leave (`onMouseOut`) | On hover, `RenderBackgroundWebIframeComp` mounts (live iframe plays); on leave, reverts to the static `BackgroundWebPlaceHolderComp` capture | `ForegroundWebComp.tsx:182-223` | GAP |
| PM-74 | Web item right-click menu | 🖱️R | – | Web widget lists a web file | Right-click a web card | Menu items: **Copy Path to Clipboard**, **Reveal in File Explorer** (`genCommonMenu`), **Show on Screens** (`genShowOnScreensContextMenu`, force-choose), **Edit** (opens Web Editor popup) | `ForegroundWebComp.tsx:167-176`; `FileItemHandlerComp.tsx:27-42,100-112`; `backgroundWebHelpers.tsx:124-134` | GAP |
| PM-75 | Web list container context menu | 🖱️R | – | Web widget expanded | Right-click the file-list area | Items: **New File** (→ input popup for name → writes `<name>.html`; dup name → toast "File already exists"), **Open shared link** (`webs`) | `ForegroundWebComp.tsx:313-315`; `backgroundWebHelpers.tsx:66-108` | GAP |

Note: the **Edit → Web Editor popup** flow is matrix **PU-04** already; PM-74 covers the
menu-item presence and that it launches the popup.

---

## L. Show/Start button — right-click (force screen) + drag onto mini-screen

**PM-25** is a single generic row for "Foreground Show button extras (🖱️R force screen;
⇕ drag → mini-screen)". Every widget wires these two paths on its Show/Start button (or
item card): `onContextMenu` → `handle*Showing(event, true)` with `isForceChoosing=true`,
and `onDragStart` → `dragStore.onDropped = handleByDropped` consumed on drop
(`getScreenForegroundManagerByDropped`, `foregroundHelpers.ts:53-65`). Split into the two
observable paths below; PM-25 stays as the umbrella but is too coarse.

| Proposed ID | Target | Interaction | Keys | Given | When | Then (observable) | Source | Status |
|---|---|---|---|---|---|---|---|---|
| PM-25 | Foreground Show/Start extras (umbrella) | 🖱️R / ⇕ | – | Any foreground widget | Right-click OR drag the Show/Start button | Covered end-to-end by PM-77/PM-78 (and Web's own PM-74) — **existing row too coarse, does not enumerate per-widget or Web's distinct menu** | see below | REFINE |
| PM-77 | Show/Start right-click = force-choose | 🖱️R | – | ≥1 screen; widget with a Show/Start button (marquee-top/bottom, quick-text, countdown×2, stopwatch, time) | Right-click the Show/Start button | Presents with `isForceChoosing=true` → the screen-chooser is forced (context menu of screens even with one screen); selecting a screen sets that widget's data (header `.app-on-screen`) | Marquee `366-368`; QuickText `112-116`; Countdown `92-96,212-216`; Stopwatch `91-95`; Time `111-115` | GAP |
| PM-78 | Show/Start drag → mini-screen drop | ⇕ | – | ≥1 mini-screen previewer card | Drag a widget's Show/Start button onto a previewer card, drop | Card highlights on dragover (RECEIVING_DROP, pair SP-12); on drop `dragStore.onDropped` fires `config.setData`/`add*Data` on THAT screen only; header `.app-on-screen` — verify per widget: marquee/quick-text/countdown/stopwatch/time set their datum | Marquee `422-428`; QuickText `157-161`; Countdown `113-120,235-242`; Stopwatch `110-114`; Time `176-180`; drop resolver `foregroundHelpers.ts:53-65` | GAP |

---

## M. Hide path — `ScreensRendererComp` (per-screen unshow)

Every widget renders a Hide control: full "Hide X" button + `ShowingScreenIcon` in the
body, and a mini icon in the collapsed header (`childHeadersOnHidden`). Clicking either
calls `handleForegroundHiding(screenId, data)` = set that widget's screen data to null /
remove the datum. Not currently its own row.

| Proposed ID | Target | Interaction | Keys | Given | When | Then (observable) | Source | Status |
|---|---|---|---|---|---|---|---|---|
| PM-79 | Hide-via-screen-icon | 🖱️ | – | A foreground widget live on a screen (header `.app-on-screen`, Hide icon shown) | Click the "Hide X" button / `ShowingScreenIcon` (body or collapsed-header mini) | That screen's widget datum cleared (`set*Data(null)` / `remove*Data`); header loses `.app-on-screen`; the Hide button/icon for that screen disappears; multi-clock/camera/web remove only the clicked instance | `ScreensRendererComp.tsx:23-46`; e.g. QuickText `45-49`, Time `287-291`, Camera `145-149`, Web `61-65` | GAP |

---

## Keyboard shortcuts

No widget in `src/presenter-foreground/*` registers a `useKeyboardRegistering`
shortcut. The only foreground keyboard path is **F10 = Clear Foreground** (existing
**KB-07 / PM-06 clear**), which lives in the screen-clear controls, not these widgets.
No new KB rows for this area.

---

### Summary

Counts — **COVERED: 3 · REFINE: 9 · GAP: 42**

(REFINE row PM-15/PM-36 spans two existing ids; counted as one row.)

REFINE (existing row vague/wrong):
- PM-24 — Split into individual props/common controls
- PM-15 / PM-36 — Speed is input+presets, not slider
- PM-16 — Quick Text is markdown + delay/live timing
- PM-19 — No stop button; hide via icon
- PM-20 — Time widget is multi-instance, many controls
- PM-21 — Drives bg layer; auto-play gated
- PM-22 — Camera is card-click + per-device props
- PM-23 — No URL input; lists web files
- PM-25 — Too coarse; per-widget + Web menu differ

GAP (no row exists):
- PM-37 — Widget card expand/collapse chevron
- PM-38 — Properties panel toggle button
- PM-39 — Align tool re-anchors widget
- PM-40 — Position offset X/Y inputs
- PM-41 — Width percent slider
- PM-42 — Scale slider
- PM-43 — Opacity slider
- PM-44 — Round percent slider + dimming
- PM-45 — Round pixel input overrides percent
- PM-46 — Geometry font-size input
- PM-47 — Font family and weight picker
- PM-48 — Backdrop filter blur input
- PM-49 — Text color picker expand/pick/reset
- PM-50 — Background color picker expand/pick/reset
- PM-51 — Marquee Today's Date button
- PM-52 — Marquee font-size number input
- PM-53 — Marquee font-size preset buttons
- PM-54 — Marquee speed number input
- PM-55 — Marquee speed preset buttons
- PM-56 — Quick Text delay seconds input
- PM-57 — Quick Text live seconds input
- PM-58 — Countdown reset-to-now button
- PM-59 — Countdown date input min-today
- PM-60 — Countdown time input min-now
- PM-61 — Countdown duration hours input
- PM-62 — Countdown duration minutes input
- PM-63 — Time use-current-timezone button
- PM-64 — Time choose-city context menu
- PM-65 — Time city label input
- PM-66 — Time UTC offset input
- PM-67 — Time AM/PM switch live toggle
- PM-68 — Time add-clock plus button
- PM-69 — Time remove-clock red X
- PM-70 — Slideshow scale-type context menu
- PM-71 — Slideshow image-click show bg
- PM-72 — Camera live preview tile
- PM-73 — Web hover-to-play iframe
- PM-74 — Web item right-click menu items
- PM-75 — Web list New File / shared-link menu
- PM-77 — Show/Start right-click force-choose
- PM-78 — Show/Start drag to mini-screen
- PM-79 — Hide-via-screen-icon per screen
