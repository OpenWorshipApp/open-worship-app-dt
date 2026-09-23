# Foreground widgets — finalized coverage rows

Source: `coverage-expansion/discover-foreground.md` (area `src/presenter-foreground/*`).
Assigned id ranges: **PM-60..PM-89** (widget-configuration controls) and
**PR-20..PR-29** (foreground → screen-presentation / media-source / previewer paths).

Emoji: 🖱️ click · 🖱️🖱️ dblclick · 🖱️R right-click · ⇕ drag-drop · ⌨️ key ·
🎚️ slider · ⌨️✎ input · 🖐️ hover · 🔀 switch.

Shared on-screen observable: `ForegroundLayoutComp` stamps `.app-on-screen` on the
widget header while any screen shows it; `ScreensRendererComp` renders a per-screen Hide
button + `ShowingScreenIcon` — both black-box checkable in the presenter.

**Numbering decisions (so the count reconciles):**
- Source had 42 GAP rows. Two are pure right-click **context-menu ITEM** rows and are
  **dropped here — CM owns them**: web-item menu (Copy Path / Reveal / Show on Screens /
  Edit) `ForegroundWebComp.tsx:167-176` and web-list menu (New File / Open shared link)
  `ForegroundWebComp.tsx:313-315`. (Web's *force-choose via "Show on Screens"* is covered
  generically by PR-24; the Edit→Web Editor popup is PU-04.)
- Three source pairs are **consolidated** (same control cluster, one setting): text +
  background color pickers → **PM-72**; marquee font-size number-input + presets →
  **PM-74**; marquee speed number-input + presets → **PM-75**.
- Net: 42 − 2 (CM) − 3 (consolidation) = **37 rows** = 30 PM + 7 PR.
- The shared geometry (PM-62..69) and common-style (PM-70..72) controls are emitted
  **ONCE** (they are reused by every isGeometry / isCommonStyle widget), per the
  CONSOLIDATE rule — not per widget.
- PM = configuring a widget's editor controls. PR = paths whose primary observable is
  content going live on a screen / the mini-screen previewer (present, force-choose,
  drag-to-previewer, hide-from-screen, live media/iframe render).

## PM additions

| ID | Target | Interactions | Pass condition |
|---|---|---|---|
| PM-60 | `ForegroundLayoutComp` card header row (src: src/presenter-foreground/ForegroundLayoutComp.tsx:40) | 🖱️ header (src: src/presenter-foreground/ForegroundLayoutComp.tsx:34) | chevron flips `bi-chevron-right`→`bi-chevron-down`; `.card-body` appears (was absent); setting `foreground-<target>-show-opened`=true; re-click reverses all three (src: src/presenter-foreground/ForegroundLayoutComp.tsx:50,67) |
| PM-61 | `PropertiesSettingComp` "Properties" pill (`bi-sliders2`) (src: src/presenter-foreground/propertiesSettingHelpers.tsx:278) | 🖱️ (src: src/presenter-foreground/propertiesSettingHelpers.tsx:278) | button `btn-outline-secondary`→`btn-secondary`; inner chevron `rotate(180deg)`; props panel `.app-inner-shadow` renders; `foreground-<target>-show-properties-setting` flips (src: src/presenter-foreground/propertiesSettingHelpers.tsx:278-354) |
| PM-62 | `SlideEditorToolAlignComp` Align group, props panel (src: src/presenter-foreground/propertiesSettingHelpers.tsx:360) | 🖱️ an align cell (src: src/presenter-foreground/propertiesSettingHelpers.tsx:364) | `alignmentData` JSON `horizontal/verticalAlignment` updates; widget live → re-anchors on mini-screen (transform-origin/left/top change) (src: src/presenter-foreground/propertiesSettingHelpers.tsx:360-377) |
| PM-63 | Position offset X / Y inputs (src: src/presenter-foreground/propertiesSettingHelpers.tsx:378) | ⌨️✎ X then Y number inputs (src: src/presenter-foreground/propertiesSettingHelpers.tsx:387,394) | `-widget-offset-x/-y` settings change; live widget translates by px; restore to 0 (src: src/presenter-foreground/propertiesSettingHelpers.tsx:378-401) |
| PM-64 | Width (%) range (src: src/presenter-foreground/propertiesSettingHelpers.tsx:402) | 🎚️ (min1 max100) (src: src/presenter-foreground/propertiesSettingHelpers.tsx:406) | `.form-range` value + shown number change; `-widget-width-percentage`; live widget `width:%` rescales (src: src/presenter-foreground/propertiesSettingHelpers.tsx:402-418) |
| PM-65 | Scale range (src: src/presenter-foreground/propertiesSettingHelpers.tsx:419) | 🎚️ (min0.1 max3 step0.1) (src: src/presenter-foreground/propertiesSettingHelpers.tsx:423) | `-widget-scale`; live widget `transform: scale()` changes (src: src/presenter-foreground/propertiesSettingHelpers.tsx:419-435) |
| PM-66 | Opacity range (src: src/presenter-foreground/propertiesSettingHelpers.tsx:436) | 🎚️ (min0 max100) (src: src/presenter-foreground/propertiesSettingHelpers.tsx:440) | `-widget-opacity-percentage`; live widget `opacity`=value/100 (src: src/presenter-foreground/propertiesSettingHelpers.tsx:436-452) |
| PM-67 | Round (%) range + dim gate (src: src/presenter-foreground/propertiesSettingHelpers.tsx:453) | 🎚️ (min0 max100) (src: src/presenter-foreground/propertiesSettingHelpers.tsx:458) | `-widget-round-percentage`; live `border-radius:%`=value/2; when round-px>0 group dims (`opacity:0.5`) and title="Set round size pixel to 0 to use this" (src: src/presenter-foreground/propertiesSettingHelpers.tsx:453-475) |
| PM-68 | Round size pixel input (src: src/presenter-foreground/propertiesSettingHelpers.tsx:476) | ⌨️✎ px value >0 (src: src/presenter-foreground/propertiesSettingHelpers.tsx:486) | `-widget-round-size-px`; live `border-radius:<px>px` overrides the % path; PM-67 group visibly dims; back to 0 re-enables % (src: src/presenter-foreground/propertiesSettingHelpers.tsx:476-494) |
| PM-69 | Geometry font-size input (`isFontSize`) (src: src/presenter-foreground/propertiesSettingHelpers.tsx:497) | ⌨️✎ px value (src: src/presenter-foreground/propertiesSettingHelpers.tsx:506) | `-widget-font-size`; live widget `font-size:<px>px` (QuickText/Countdown/Stopwatch/Time) (src: src/presenter-foreground/propertiesSettingHelpers.tsx:497-514) |
| PM-70 | `FontFamilyControlComp` Font Family card (common-style) (src: src/presenter-foreground/ForegroundCommonPropertiesSettingComp.tsx:133) | 🖱️ family + ⌨️✎ weight (src: src/presenter-foreground/ForegroundCommonPropertiesSettingComp.tsx:137) | `-common-font-family`/`-common-font-weight` change; editor textarea + live widget font change; `(Missing)` label is informative not a bug (src: src/presenter-foreground/ForegroundCommonPropertiesSettingComp.tsx:133-144) |
| PM-71 | Backdrop Filter input (src: src/presenter-foreground/ForegroundCommonPropertiesSettingComp.tsx:145) | ⌨️✎ px value (src: src/presenter-foreground/ForegroundCommonPropertiesSettingComp.tsx:150) | `-common-backdrop-filter`; live widget `backdrop-filter: blur(<px>px)` (src: src/presenter-foreground/ForegroundCommonPropertiesSettingComp.tsx:145-159) |
| PM-72 | Text + Background color `ColorPropCardComp`s (consolidates src PM-49+PM-50) (src: src/presenter-foreground/ForegroundCommonPropertiesSettingComp.tsx:165) | 🖱️ expand each row, pick a color, test no-color reset (src: src/presenter-foreground/ForegroundCommonPropertiesSettingComp.tsx:83,170) | chevron `right`→`down`, ColorPicker appears; `-common-color`/`-common-background-color` change; live text/bg color change; no-color restores `DEFAULT_TEXT_COLOR` (white) / `#000080AA` (src: src/presenter-foreground/ForegroundCommonPropertiesSettingComp.tsx:165-190) |
| PM-73 | Marquee "Today's Date" button (`bi-calendar-plus`) (src: src/presenter-foreground/ForegroundMarqueeComp.tsx:441) | 🖱️ (src: src/presenter-foreground/ForegroundMarqueeComp.tsx:441) | textarea value replaced with locale-formatted long date (weekday/month/day/year) (src: src/presenter-foreground/ForegroundMarqueeComp.tsx:404-414) |
| PM-74 | Marquee font size — number input (`bi-fonts`, 0=auto) + presets (consolidates src PM-52+PM-53) (src: src/presenter-foreground/ForegroundMarqueeComp.tsx:256) | ⌨️✎ px + 🖱️ preset (Auto/50/75/100/150) (src: src/presenter-foreground/ForegroundMarqueeComp.tsx:256,274) | `foreground-marquee-<pos>-font-size`; live marquee `font-size:<px>px` (0=auto, placeholder "auto"); clicked preset gets `.active`; "0" renders "Auto"; pushed via `refreshShowing` (src: src/presenter-foreground/ForegroundMarqueeComp.tsx:256-294) |
| PM-75 | Marquee speed — number input (`bi-speedometer2`, %) + presets (consolidates src PM-54+PM-55) (src: src/presenter-foreground/ForegroundMarqueeComp.tsx:295) | ⌨️✎ % (min10 max1000 step10) + 🖱️ preset (50/75/Normal/150/200) (src: src/presenter-foreground/ForegroundMarqueeComp.tsx:295,314) | `foreground-marquee-<pos>-speed-percentage`; marquee scroll re-paces live; clicked preset `.active`; 100 renders "Normal" (src: src/presenter-foreground/ForegroundMarqueeComp.tsx:295-338) |
| PM-76 | Quick Text Delay input (`bi-hourglass-top`, min0) (src: src/presenter-foreground/ForegroundQuickTextComp.tsx:181) | ⌨️✎ seconds (src: src/presenter-foreground/ForegroundQuickTextComp.tsx:181) | `foreground-quick-text-time-delay`; on next Show the markdown overlay is delayed that many seconds (src: src/presenter-foreground/ForegroundQuickTextComp.tsx:134-140,181-202) |
| PM-77 | Quick Text Live input (`bi-clock`, min1) (src: src/presenter-foreground/ForegroundQuickTextComp.tsx:203) | ⌨️✎ seconds (src: src/presenter-foreground/ForegroundQuickTextComp.tsx:203) | `foreground-quick-text-time-to-live`; overlay stays that many seconds then auto-hides (src: src/presenter-foreground/ForegroundQuickTextComp.tsx:142-148,203-222) |
| PM-78 | Countdown reset button (`bi-arrow-counterclockwise`) (src: src/presenter-foreground/ForegroundCountDownComp.tsx:128) | 🖱️ (datetime panel, date/time edited away from now) (src: src/presenter-foreground/ForegroundCountDownComp.tsx:128) | date input → today (`todayString`), time input → now (`nowString`) (src: src/presenter-foreground/ForegroundCountDownComp.tsx:87-91,128-135) |
| PM-79 | Countdown date input (`type=date`, min=today) (src: src/presenter-foreground/ForegroundCountDownComp.tsx:140) | ⌨️✎ pick/type a date (src: src/presenter-foreground/ForegroundCountDownComp.tsx:140) | `foreground-date-setting` updates; input rejects dates before today (`min`) (src: src/presenter-foreground/ForegroundCountDownComp.tsx:97-103,140-147) |
| PM-80 | Countdown time input (`type=time`, min=now) (src: src/presenter-foreground/ForegroundCountDownComp.tsx:152) | ⌨️✎ pick/type a time (src: src/presenter-foreground/ForegroundCountDownComp.tsx:152) | `foreground-time-setting` updates; target datetime recomputed on next Show (src: src/presenter-foreground/ForegroundCountDownComp.tsx:104-110,152-159) |
| PM-81 | Countdown duration hours input (min0) (src: src/presenter-foreground/ForegroundCountDownComp.tsx:258) | ⌨️✎ hours (src: src/presenter-foreground/ForegroundCountDownComp.tsx:258) | `foreground-hours-setting`; target = now + h*3600 + m*60 + 1s (src: src/presenter-foreground/ForegroundCountDownComp.tsx:189-198,258-266) |
| PM-82 | Countdown duration minutes input (min0 max59) (src: src/presenter-foreground/ForegroundCountDownComp.tsx:272) | ⌨️✎ minutes (src: src/presenter-foreground/ForegroundCountDownComp.tsx:272) | `foreground-minutes-setting`; combined with hours on Show (src: src/presenter-foreground/ForegroundCountDownComp.tsx:226-232,272-281) |
| PM-83 | Time "Use Current Timezone" (`bi-geo-alt`) (src: src/presenter-foreground/ForegroundTimeComp.tsx:184) | 🖱️ (src: src/presenter-foreground/ForegroundTimeComp.tsx:184) | UTC-offset input snaps to this device's offset (`getSystemTimezoneMinuteOffset`) (src: src/presenter-foreground/ForegroundTimeComp.tsx:130-133,184-191) |
| PM-84 | Time "Choose City" picker (`bi-globe-americas`) (src: src/presenter-foreground/ForegroundTimeComp.tsx:192) | 🖱️ → `AppContextMenu` → 🖱️ a city (src: src/presenter-foreground/ForegroundTimeComp.tsx:192) | menu lists sorted `City (Region/City)`; selecting sets City-label input + UTC-offset; dismiss = no change (src: src/presenter-foreground/ForegroundTimeComp.tsx:35-64,135-143) |
| PM-85 | Time city-name input (`bi-buildings`) (src: src/presenter-foreground/ForegroundTimeComp.tsx:200) | ⌨️✎ label (src: src/presenter-foreground/ForegroundTimeComp.tsx:200) | `foreground-city-name-setting-<id>`; used as `title` above the clock on screen (src: src/presenter-foreground/ForegroundTimeComp.tsx:144-150,200-216) |
| PM-86 | Time UTC-offset input (number, `min`) (src: src/presenter-foreground/ForegroundTimeComp.tsx:217) | ⌨️✎ minute offset (src: src/presenter-foreground/ForegroundTimeComp.tsx:217) | `foreground-timezone-minute-offset-setting-<id>`; clock time shifts by offset (src: src/presenter-foreground/ForegroundTimeComp.tsx:151-159,217-235) |
| PM-87 | Time AM/PM switch (`role=switch`) (src: src/presenter-foreground/ForegroundTimeComp.tsx:236) | 🔀 toggle (a clock live) (src: src/presenter-foreground/ForegroundTimeComp.tsx:236) | `foreground-time-is-24-hour-format-setting-<id>` flips; `refreshAllTimes` re-pushes so the live clock switches 24h⇄AM/PM immediately (src: src/presenter-foreground/ForegroundTimeComp.tsx:165-175,236-253) |
| PM-88 | Time "Add Time" (`bi-plus`) (src: src/presenter-foreground/ForegroundTimeComp.tsx:438) | 🖱️ (src: src/presenter-foreground/ForegroundTimeComp.tsx:438) | new clock card appears (new UUID pushed to `foreground-time-id-list`); `ForegroundTimeItemComp` DOM count +1 (src: src/presenter-foreground/ForegroundTimeComp.tsx:442-447) |
| PM-89 | Time remove-clock (`bi-x-lg` red; hidden when only 1) (src: src/presenter-foreground/ForegroundTimeComp.tsx:333) | 🖱️ the red ✕ (≥2 clock cards) (src: src/presenter-foreground/ForegroundTimeComp.tsx:333) | that card is removed; any showing data hidden first; id dropped from list — **self-cleaning: add via PM-88 then remove** (src: src/presenter-foreground/ForegroundTimeComp.tsx:424-434) |

## PR additions

| ID | Target | Interactions | Pass condition |
|---|---|---|---|
| PR-20 | Images slideshow Scale-Type button → context menu (src: src/presenter-foreground/ForegroundImagesSlideShowComp.tsx:122) | 🖱️ button (shows current, e.g. "stretch") → 🖱️ option (src: src/presenter-foreground/ForegroundImagesSlideShowComp.tsx:122) | `AppContextMenu` lists `fill/fit/stretch/tile/center/span`; picking updates button label + `images-slide-show-scale-type`, re-applies to the live bg (src: src/presenter-foreground/ForegroundImagesSlideShowComp.tsx:45-52,122-160) |
| PR-21 | Images slideshow image item → show as background (src: src/presenter-foreground/ForegroundImagesSlideShowComp.tsx:203) | 🖱️ an image thumbnail (src: src/presenter-foreground/ForegroundImagesSlideShowComp.tsx:203) | image becomes the background on the selected screen (`handleBackgroundSelecting('image')`); item shows `RenderBackgroundScreenIds`; header flips `.app-on-screen` — restore (src: src/presenter-foreground/ForegroundImagesSlideShowComp.tsx:257-262) |
| PR-22 | `ForegroundCameraComp` live preview tile (EX-03 if no device) (src: src/presenter-foreground/ForegroundCameraComp.tsx:36) | 🖐️/observe card body (src: src/presenter-foreground/ForegroundCameraComp.tsx:36) | local `getCameraAndShowMedia` stream renders in the tile (`LoadingComp` until ready) — presence/render check; BLOCKED→EX-03 if no device (src: src/presenter-foreground/ForegroundCameraComp.tsx:36-45) |
| PR-23 | `ForegroundWebComp` item hover-to-play preview (src: src/presenter-foreground/ForegroundWebComp.tsx:182) | 🖐️ `onMouseOver` then leave `onMouseOut` (src: src/presenter-foreground/ForegroundWebComp.tsx:182) | on hover `RenderBackgroundWebIframeComp` mounts (live iframe plays); on leave reverts to the static `BackgroundWebPlaceHolderComp` capture (src: src/presenter-foreground/ForegroundWebComp.tsx:182-223) |
| PR-24 | Show/Start button right-click = force-choose (marquee×2, quick-text, countdown×2, stopwatch, time) (src: src/presenter-foreground/ForegroundMarqueeComp.tsx:366) | 🖱️R the Show/Start button, ≥1 screen (src: src/presenter-foreground/ForegroundMarqueeComp.tsx:366) | presents with `isForceChoosing=true` → the screen-chooser is forced (menu of screens even with one screen); selecting a screen sets that widget's data (header `.app-on-screen`) (src: src/presenter-foreground/ForegroundCountDownComp.tsx:92-96,212-216) |
| PR-25 | Show/Start button drag → mini-screen previewer drop (pair SP-12) (src: src/presenter-foreground/ForegroundMarqueeComp.tsx:422) | ⇕ drag the Show/Start button onto a previewer card, drop (src: src/presenter-foreground/ForegroundMarqueeComp.tsx:422) | card highlights on dragover (RECEIVING_DROP); on drop `dragStore.onDropped` fires `config.setData`/`add*Data` on THAT screen only; header `.app-on-screen` (src: src/presenter-foreground/foregroundHelpers.ts:53-65) |
| PR-26 | `ScreensRendererComp` Hide-via-screen-icon (per screen) (src: src/presenter-foreground/ScreensRendererComp.tsx:23) | 🖱️ "Hide X" button / `ShowingScreenIcon` (body or collapsed-header mini) (src: src/presenter-foreground/ScreensRendererComp.tsx:23) | that screen's widget datum cleared (`set*Data(null)`/`remove*Data`); header loses `.app-on-screen`; the Hide button/icon for that screen disappears; multi-clock/camera/web remove only the clicked instance (src: src/presenter-foreground/ScreensRendererComp.tsx:23-46) |

### REFINE

Existing matrix rows whose wording is vague/wrong for the sub-paths now split out above.
Keep the id; update the cited text.

- **PM-24** — Too coarse ("font-size/color/position"). It is the shared props/common panel;
  the individual controls are now PM-62..PM-72. Keep PM-24 as the end-to-end
  *restyle-on-screen* observable only (`onChange1`→`genStyle`, `propertiesSettingHelpers.tsx:581-583`).
- **PM-15 / PM-36** — Marquee speed is a **number input + preset button group**, not a
  `🎚️` range slider; changing speed while showing re-paces the scroll live
  (`refreshAllMarquees`, per-position debouncer). Detail control = PM-75; font size = PM-74;
  Today's-Date button = PM-73 (`ForegroundMarqueeComp.tsx:147-167,295-338`).
- **PM-16** — Quick Text is **Markdown** (`renderMarkdown`), shown after `timeSecondDelay`
  and auto-expiring after `timeSecondToLive`; timing inputs = PM-76/PM-77
  (`ForegroundQuickTextComp.tsx:95-111`).
- **PM-19** — Stopwatch has **no stop button**; the only stop is the Hide/`ShowingScreenIcon`
  (now PR-26), not a toggle (`ForegroundStopwatchComp.tsx:80-95`).
- **PM-20** — Time is a **multi-instance** widget (Add/Remove clocks) with a use-tz button,
  city picker, label + offset inputs and an AM/PM switch — see PM-83..PM-89
  (`ForegroundTimeComp.tsx`).
- **PM-21** — Drives the **background image layer** (via `ScreenBackgroundManager`), not a
  foreground overlay; `SlideAutoPlayComp` appears only once an image is selected
  (`isAnyItemSelected`). Scale-type = PR-20, image-click = PR-21
  (`ForegroundImagesSlideShowComp.tsx:45-91,264-266`).
- **PM-22** — Camera is a **card-body click** (not a select dropdown) with per-device
  geometry props; live preview tile = PR-22 (`ForegroundCameraComp.tsx:83-103`).
- **PM-23** — **No URL input**; the widget lists `.html` web files from BACKGROUND_WEB via
  `FileListHandlerComp` and drives the foreground web layer. Hover-play = PR-23; item /
  list right-click menus → **CM** (`ForegroundWebComp.tsx:196-209`).
- **PM-25** — Too coarse. Per-widget force-choose = PR-24; drag-to-mini-screen = PR-25;
  Web's distinct right-click menu → **CM**. Keep PM-25 only as the umbrella pointer
  (`foregroundHelpers.ts:53-65`).

**Dropped to CM (not emitted here):** web-item right-click menu
(`ForegroundWebComp.tsx:167-176`) and web-list container menu
(`ForegroundWebComp.tsx:313-315`) — both are context-menu ITEM enumerations that CM owns.

**No new KB rows:** no widget in `src/presenter-foreground/*` registers a
`useKeyboardRegistering` shortcut; the only foreground key path is F10 = Clear Foreground
(existing KB-07).

### COUNTS

- Source GAP rows: 42 · dropped to CM: 2 · consolidated (2→1) pairs: 3 → **net emitted: 37**
- **PM additions: 30** (PM-60 .. PM-89) — last PM id used: **PM-89**
- **PR additions: 7** (PR-20 .. PR-26) — last PR id used: **PR-26**
- REFINE (existing rows, text-only update): 9 (PM-24, PM-15/PM-36, PM-16, PM-19, PM-20,
  PM-21, PM-22, PM-23, PM-25)
- Total new rows written: **37**
