# OWA Components Path — pages → components → interactions

Standalone map of **every page**, the **component tree inside it**, and the
**interactive tests** each component supports (click / double-click / right-click /
drag / drop / keyboard-shortcut / slider / input / hover).

Use this as the *targeting index* while robot-testing: pick a page, walk its component
tree, and for each component run the listed interactions and assert the expected result.
Pair it with:
- [ui-map.md](./ui-map.md) — selectors, readiness signals, region layout.
- [knowledge-base.md](./knowledge-base.md) — traps (popup windows, dynamic locale, benign
  noise) — **read before driving anything**.
- [test-plan.md](./test-plan.md) — scenario checklist + report format.
- [coverage-matrix.md](./coverage-matrix.md) — the enumerated coverage contract (stable
  row IDs) that full-coverage runs must fill in.

> **Component paths** below read top-down like a breadcrumb: `Page → Parent → Child`.
> Every React component in this app is named `…Comp` (project convention). Source files
> are linked so you can confirm current behavior before reporting a "bug".
>
> **Targeting rules (from the knowledge base):** locale is dynamic (Khmer/English) — target
> by **role / CSS class / icon (`bi-*`) / position**, not literal text. Click the actual
> `button`, not its wrapping `<li>`/`StaticText`. Slide & lyric previews live inside
> `<iframe srcdoc>` (not reachable from document-level `querySelectorAll`).

---

## Interaction legend

| Symbol | Interaction | How to drive with chrome-devtools-mcp |
|---|---|---|
| 🖱️ | Click | `click` the button's `uid` from `take_snapshot` |
| 🖱️🖱️ | Double-click | `evaluate_script` dispatching `dblclick`, or two quick `click`s (used to send an item to screen) |
| 🖱️R | Right-click / context menu | `evaluate_script` dispatching `contextmenu`; opens `AppContextMenuComp` or "solo/force" behavior |
| ⇕ | Drag → drop | `drag` from source `uid` to a target `uid` (e.g. foreground button → mini-screen) |
| ⌨️ | Keyboard shortcut | `press_key` (mind `Ctrl`/`Meta` per platform) |
| 🎚️ | Slider (`input[type=range]`) | native value setter + `dispatchEvent(new Event('input',{bubbles:true}))` |
| ⌨️✎ | Text/number/date input | `fill` / `type_text`; use char-by-char `type_text` to mimic a real user |
| 🖐️ | Hover | `hover` a `uid` (tooltips, hover-only controls) |

State assertions (`evaluate_script`): active tab = `.nav-tabs .nav-link.active`;
live-on-screen = `.app-on-screen` (active background tab also gets a `*` prefix).

---

## Global keyboard shortcuts (work on presenter / editor pages)

| Shortcut | Action | Registered in |
|---|---|---|
| `Ctrl+B` / `Cmd+B` | Open Bible Lookup modal | [others/commonButtons.tsx](../../../../src/others/commonButtons.tsx) |
| `Ctrl+Q` | Close current modal | [app-modal/ModalComp.tsx](../../../../src/app-modal/ModalComp.tsx) |
| `F5` | Toggle show/hide the presentation screen | [_screen/preview/ShowHideScreen.tsx](../../../../src/_screen/preview/ShowHideScreen.tsx) |
| `F6` | Clear All (screen) | [_screen/preview/MiniScreenClearControlComp.tsx](../../../../src/_screen/preview/MiniScreenClearControlComp.tsx) |
| `F7` | Clear Background | ⤴ same |
| `F8` | Clear Slide | ⤴ same |
| `F9` | Clear Bible | ⤴ same |
| `F10` | Clear Foreground | ⤴ same |
| `Arrows` / `PageUp` / `PageDown` / `Space` | Navigate slides (container focused; `Space` toggles) | [app-document-presenter/items/VarySlidesComp.tsx](../../../../src/app-document-presenter/items/VarySlidesComp.tsx) |
| `Tab` | Bible Lookup: complete current book/chapter/verse chunk | [bible-lookup/InputExtraButtonsComp.tsx](../../../../src/bible-lookup/InputExtraButtonsComp.tsx) |
| `Escape` / `Ctrl+Escape` | Bible Lookup: clear input / clear chunk | ⤴ same |
| `Ctrl+Enter` | Slide editor: focus the canvas | [slide-editor/canvas/CanvasContainerComp.tsx](../../../../src/slide-editor/canvas/CanvasContainerComp.tsx) |
| `Escape` | Slide editor: close quick-edit popup | [slide-editor/SlideEditorPopupComp.tsx](../../../../src/slide-editor/SlideEditorPopupComp.tsx) |
| `Ctrl+S` | Editors: save | (lyric/web/bible-note editors) |
| `Ctrl/Alt+ArrowLeft/Right` | Screen output: prev/next bible | [screen.tsx](../../../../src/screen.tsx) |

---

## Pages (HTML entry points)

| Page | Entry | Root component | Window | Header (`#app-header`)? |
|---|---|---|---|---|
| Presenter | `presenter.html` → [presenter.tsx](../../../../src/presenter.tsx) | `AppLayoutComp` → `AppPresenterComp` | main | ✅ |
| Bible Reader | `reader.html` → [reader.tsx](../../../../src/reader.tsx) | `BibleReaderComp` | main | ❌ |
| Slide / Doc Editor | `appDocumentEditor.html` → [appDocumentEditor.tsx](../../../../src/appDocumentEditor.tsx) | `AppLayoutComp` → `AppDocumentEditorComp` | main | ✅ |
| Settings | `setting.html` → [setting.tsx](../../../../src/setting.tsx) | `SettingComp` | **popup** ⚠️ | ❌ |
| Screen output | `screen.html` → [screen.tsx](../../../../src/screen.tsx) | `ScreenAppComp` | separate (when presenting) | ❌ |
| Finder | `finder.html` → [finder.tsx](../../../../src/finder.tsx) | `FinderAppComp` | **popup** | ❌ |
| Lyric Editor | `lyricEditor.html` → [lyricEditor.tsx](../../../../src/lyricEditor.tsx) | `LyricEditorPopupComp` | **popup** | ❌ |
| Bible Note | `bibleNote.html` → [bibleNote.tsx](../../../../src/bibleNote.tsx) | `NoteItemEditorPopupComp` | **popup** | ❌ |
| Web Editor | `webEditor.html` → [webEditor.tsx](../../../../src/webEditor.tsx) | `WebEditorComp` | **popup** | ❌ |
| About | `about.html` → [about.tsx](../../../../src/about.tsx) | `AboutComp` | **popup** | ❌ |
| LW Share | `lwShare.html` → [lwShare.tsx](../../../../src/lwShare.tsx) | `LWShareAppComp` | popup | ❌ |
| (dev) Experiment | `experiment.html` | dev-only playground | main (dev) | — |

> ⚠️ **Popups (`setting`, `about`, `finder`, `lyricEditor`, `bibleNote`, `webEditor`) must NOT be
> loaded in the main window with `navigate_page`** — it traps the window (`ERR_ABORTED`) and
> persists `mainHtmlPath`. Open via their in-app button, then `list_pages` → `select_page` the
> new target. See [knowledge-base.md](./knowledge-base.md) §2–§3.

---

## 1. `presenter.html` — Presenter (main window)

`AppLayoutComp` (`#app-header` + `#app-body`) wraps `AppPresenterComp` (3 resizable columns).
Source: [router/AppLayoutComp.tsx](../../../../src/router/AppLayoutComp.tsx),
[presenter/AppPresenterComp.tsx](../../../../src/presenter/AppPresenterComp.tsx).

### Presenter → Header (`#app-header`)

| Component (path) | Source | Interactions & expected result |
|---|---|---|
| `AppLayoutComp → LayoutTabRenderComp` (main nav tabs) | [router/LayoutTabRenderComp.tsx](../../../../src/router/LayoutTabRenderComp.tsx) | 🖱️ each `.nav-tabs button.nav-link` (`Presenter` / `Bible Reader` / `Slide Editor` / dev `Experiment`) → `goToPath()` sets `location.href`; clicked tab gets `.active`. `Slide Editor` with **no selected doc** → alert, no navigation. |
| `AppLayoutComp → BibleLookupButtonComp` | [others/commonButtons.tsx](../../../../src/others/commonButtons.tsx) | 🖱️ (icon `bi bi-book`, text `Bible Lookup`) **or** ⌨️ `Ctrl+B` → opens Bible Lookup modal (`#modal-container` / `AppPopupBibleLookupComp`). 🖐️ tooltip shows the shortcut. |
| `AppLayoutComp → SettingButtonComp` | [others/commonButtons.tsx](../../../../src/others/commonButtons.tsx) | 🖱️ (icon `bi bi-gear-wide-connected`) → opens **Settings popup window** (do not `navigate_page`). |
| `AppLayoutComp → HelpButtonComp` | [others/commonButtons.tsx](../../../../src/others/commonButtons.tsx) | 🖱️ (icon `bi bi-question-circle`) → opens external help. ⚠️ a11y: accessible name is a raw URL — flag if auditing. |
| `AppLayoutComp → AppPopupBibleLookupComp` (modal) | [app-modal/AppPopupBibleLookupComp.tsx](../../../../src/app-modal/AppPopupBibleLookupComp.tsx) | Modal container `#modal-container`. Close: 🖱️ red `button.btn-danger` (`bi bi-x-lg`) **or** ⌨️ `Ctrl+Q`. Inside = `RenderBibleLookupComp` (see Reader page for its picker). |

### Presenter → Left column (`AppPresenterLeftComp`)

Source: [presenter/AppPresenterLeftComp.tsx](../../../../src/presenter/AppPresenterLeftComp.tsx). Vertically resizable stack.

| Component (path) | Source | Interactions & expected result |
|---|---|---|
| `…Left → VaryAppDocumentListComp` (Documents list) | [app-document-list/VaryAppDocumentListComp.tsx](../../../../src/app-document-list/VaryAppDocumentListComp.tsx) | 🖱️ `li.list-group-item` → selects (gets `.active`), loads slides into the middle Documents tab, updates footer path. 🖱️🖱️ → present / open. 🖱️R → context menu (rename/delete/etc.). ⇕ drag to reorder. Icons `bi bi-file-earmark-slides` / `-pdf`. |
| `…Left → LyricListComp` (Lyrics list) | [lyric-list/LyricListComp.tsx](../../../../src/lyric-list/LyricListComp.tsx) | 🖱️ `li.list-group-item` (icon `bi bi-music-note`) → selects lyric; switches middle tab to Lyrics. 🖱️🖱️ → send to screen. 🖱️R → context menu (edit → opens Lyric Editor popup). |
| `…Left → PlaylistListComp` (dev only) | [playlist/PlaylistListComp.tsx](../../../../src/playlist/PlaylistListComp.tsx) | Present only in dev builds. 🖱️ items; ⇕ reorder. |

### Presenter → Middle column (`AppPresenterMiddleComp`)

Source: [presenter/AppPresenterMiddleComp.tsx](../../../../src/presenter/AppPresenterMiddleComp.tsx). Top = `PresenterComp`, bottom = `BackgroundComp`.

#### Middle → `PresenterComp` (tabbed previewer)

Source: [app-document-presenter/PresenterComp.tsx](../../../../src/app-document-presenter/PresenterComp.tsx). Tabs are **multi-select** (several can be active); right-click a tab = solo.

| Component (path) | Source | Interactions & expected result |
|---|---|---|
| `PresenterComp` tab bar (`Documents`/`Lyrics`/`Bibles`/`Foreground`) | [others/TabRenderComp.tsx](../../../../src/others/TabRenderComp.tsx) | 🖱️ a tab → toggles it into the split view. 🖱️R a tab → **solo** (that tab only). A tab with live content shows `.app-on-screen`. |
| `PresenterComp → RenderToggleFullViewComp` (fullscreen widget) | ⤴ PresenterComp.tsx | 🖱️ (icon `bi bi-arrows-fullscreen` / `bi-fullscreen-exit`) → toggles `.app-full-view` on the presenter panel (widget-fullscreen, not OS fullscreen). |
| `PresenterComp → AppDocumentPreviewerComp` (Documents tab) | [app-document-presenter/items/AppDocumentPreviewerComp.tsx](../../../../src/app-document-presenter/items/AppDocumentPreviewerComp.tsx) | Slide thumbnails (`<iframe srcdoc>`). 🖱️🖱️ a thumb → send that slide to screen. 🖱️R → context menu. ⌨️ `Arrows`/`PageUp`/`PageDown`/`Space` navigate when focused. 🎚️ footer size slider (`.app-range`, `max=200`) rescales thumbs. |
| ↳ `SlideAutoPlayComp` (auto-play widget) | [slide-auto-play/SlideAutoPlayComp.tsx](../../../../src/slide-auto-play/SlideAutoPlayComp.tsx) | 🖱️ stopwatch icon (`bi bi-stopwatch-fill`) → expands the widget. ⌨️✎ seconds input. 🖱️ play (`bi bi-play`) → slides auto-advance on the timer; 🖱️ pause. 🖱️ red `bi bi-x-lg` → collapses. Also used inside `ForegroundImagesSlideShowComp`. |
| `PresenterComp → LyricHandlerComp` (Lyrics tab) | [lyric-list/LyricHandlerComp.tsx](../../../../src/lyric-list/LyricHandlerComp.tsx) | Renders selected lyric verses (in `<iframe>`). 🖱️🖱️ a verse → send to screen (`.app-on-screen`). |
| `PresenterComp → PresenterBiblePreviewerRenderComp` (Bibles tab) | [app-document-presenter/PresenterBiblePreviewerRenderComp.tsx](../../../../src/app-document-presenter/PresenterBiblePreviewerRenderComp.tsx) | Shows the currently looked-up verse. 🖱️🖱️ → send verse to screen. Hosts a resizable split with `BibleCustomStyleComp` (next row). |
| ↳ `BibleCustomStyleComp` (bible appearance) | [screen-setting/BibleCustomStyleComp.tsx](../../../../src/screen-setting/BibleCustomStyleComp.tsx) | Two cards: **Appearance** (`ScreenBibleAppearanceComp` — font size/color/etc. of the on-screen bible text) and **Text Shadow** (`ScreenBibleTextShadow`). 🎚️/🖱️ a control → live bible text on the mini-screen restyles. Restore values afterward. |
| `PresenterComp → PresenterForegroundComp` (Foreground tab) | see next block | 8 stacked foreground widgets. |

##### `PresenterForegroundComp` widgets (Foreground tab)

Source: [presenter-foreground/PresenterForegroundComp.tsx](../../../../src/presenter-foreground/PresenterForegroundComp.tsx). Each widget: a "Start/Show" button that is **clickable, right-clickable (force choose screen), and draggable onto a mini-screen**, plus its own inputs.

| Component | Source | Interactions & expected result |
|---|---|---|
| `ForegroundMarqueeTopComp` | [ForegroundMarqueeTopComp.tsx](../../../../src/presenter-foreground/ForegroundMarqueeTopComp.tsx) | ⌨️✎ marquee top text input. 🎚️ scroll speed %. 🖱️ Show → scrolls text along the top of the screen. ⇕ drag show-button → drop on mini-screen target. |
| `ForegroundMarqueeBottomComp` | [ForegroundMarqueeBottomComp.tsx](../../../../src/presenter-foreground/ForegroundMarqueeBottomComp.tsx) | ⌨️✎ marquee bottom text input. 🎚️ scroll speed %. 🖱️ Show → scrolls text along the bottom of the screen. ⇕ drag show-button → drop on mini-screen target. |
| `ForegroundQuickTextComp` | [ForegroundQuickTextComp.tsx](../../../../src/presenter-foreground/ForegroundQuickTextComp.tsx) | ⌨️✎ text. 🖱️ Show. ⇕ drag→drop. |
| `ForegroundCountDownComp` | [ForegroundCountDownComp.tsx](../../../../src/presenter-foreground/ForegroundCountDownComp.tsx) | Two modes. **To datetime:** ⌨️✎ `date` + `time` inputs, 🖱️ Reset (`bi bi-arrow-counterclockwise`), 🖱️ `Start Countdown to DateTime` (`bi bi-play-fill`). **Duration:** ⌨️✎ hours/minutes number inputs, 🖱️ `Start Countdown`. 🖱️R the start button → force choose target screen. ⇕ drag start button → drop onto a mini-screen. `Hide Countdown` button when live. |
| `ForegroundStopwatchComp` | [ForegroundStopwatchComp.tsx](../../../../src/presenter-foreground/ForegroundStopwatchComp.tsx) | 🖱️ start/stop; ⌨️✎ config inputs; ⇕ drag→drop. |
| `ForegroundTimeComp` (clock) | [ForegroundTimeComp.tsx](../../../../src/presenter-foreground/ForegroundTimeComp.tsx) | 🖱️ show clock; format options; ⇕ drag→drop. |
| `ForegroundImagesSlideShowComp` | [ForegroundImagesSlideShowComp.tsx](../../../../src/presenter-foreground/ForegroundImagesSlideShowComp.tsx) | 🖱️ pick images; 🖱️ start slideshow; ⇕ drag→drop. |
| `ForegroundCameraComp` | [ForegroundCameraComp.tsx](../../../../src/presenter-foreground/ForegroundCameraComp.tsx) | 🖱️ select camera device; 🖱️ show; ⇕ drag→drop. |
| `ForegroundWebComp` | [ForegroundWebComp.tsx](../../../../src/presenter-foreground/ForegroundWebComp.tsx) | ⌨️✎ URL; 🖱️ show web overlay; ⇕ drag→drop. |
| shared: `ForegroundCommonPropertiesSettingComp` | [ForegroundCommonPropertiesSettingComp.tsx](../../../../src/presenter-foreground/ForegroundCommonPropertiesSettingComp.tsx) | 🎚️ font-size / color / position controls that restyle the live foreground. |

#### Middle → `BackgroundComp` (background tabs)

Source: [background/BackgroundComp.tsx](../../../../src/background/BackgroundComp.tsx).
⚠️ **Starts collapsed** (`app-hidden-widget`, ~6px). 🖱️ the `Background` label to expand —
the tab bar does **not exist in the DOM** until expanded.

| Component (path) | Source | Interactions & expected result |
|---|---|---|
| `BackgroundComp` tab bar (`Colors`/`Images`/`Videos`/`Cameras`/`Webs`) | ⤴ BackgroundComp.tsx | 🖱️ a tab → switches panel (single-select). Active tab of the live background gets a `*` prefix. |
| `BackgroundComp → RenderAudiosTabComp` (`♫Audios♫`) | ⤴ BackgroundComp.tsx | 🖱️ → toggles the Audios split (presenter page only). Shows `.app-on-screen` while audio plays; toggling off while playing pops a toast, doesn't hide. |
| `BackgroundColorsComp` | [background/BackgroundColorsComp.tsx](../../../../src/background/BackgroundColorsComp.tsx) | 🖱️ a swatch — **swatches are `role=group`, not `<button>`** (target by `uid`) — sets the background color on the mini-screen. May pop a **contrast confirm** (`Cancel`/`Ok`) — handle it (good UX, not a bug). |
| `BackgroundImagesComp` | [background/BackgroundImagesComp.tsx](../../../../src/background/BackgroundImagesComp.tsx) | 🖱️🖱️ an image item → set as live background. 🖱️R → context menu. ⇕ some items draggable to a screen. |
| `BackgroundVideosComp` | [background/BackgroundVideosComp.tsx](../../../../src/background/BackgroundVideosComp.tsx) | 🖱️🖱️ a video item → set as live background (verified). 🖱️R → context menu. |
| `BackgroundCamerasComp` | [background/BackgroundCamerasComp.tsx](../../../../src/background/BackgroundCamerasComp.tsx) | 🖱️ select a camera device → live background. |
| `BackgroundWebComp` | [background/BackgroundWebComp.tsx](../../../../src/background/BackgroundWebComp.tsx) | 🖱️ a web-url item; `+` opens the **Web Editor** popup. `BackgroundWebUrlItemComp` items are draggable. |
| `BackgroundAudiosComp` | [background/BackgroundAudiosComp.tsx](../../../../src/background/BackgroundAudiosComp.tsx) | 🖱️ play/stop audio (only when Audios split active). Playing → `.app-on-screen`. |

### Presenter → Right column (`AppPresenterRightComp`)

Source: [presenter/AppPresenterRightComp.tsx](../../../../src/presenter/AppPresenterRightComp.tsx). Top = Bible+Notes, bottom = Mini Screen.

| Component (path) | Source | Interactions & expected result |
|---|---|---|
| `…Right → BibleReadingLeftComp` | [bible-list/BibleReadingLeftComp.tsx](../../../../src/bible-list/BibleReadingLeftComp.tsx) | Splits into `Bibles` + `Notes` (layout flips H/V by width). |
| ↳ `BibleListComp` (Bibles) | [bible-list/BibleListComp.tsx](../../../../src/bible-list/BibleListComp.tsx) | 🖱️ `li.list-group-item` bible items; 🖱️🖱️ → send verse to screen; 🖱️R → context menu. |
| ↳ `BibleNoteListComp` (Notes) | [bible-list/note/BibleNoteListComp.tsx](../../../../src/bible-list/note/BibleNoteListComp.tsx) | 🖱️ a note; edit → opens **Bible Note** popup. |
| `…Right → MiniScreenComp` | [_screen/preview/MiniScreenComp.tsx](../../../../src/_screen/preview/MiniScreenComp.tsx) | Live preview container `div.card.app-zero-border-radius`. 🎚️ zoom slider (`max=30`) rescales the preview. Holds one `ScreenPreviewerItemComp` **per screen** (multi-screen capable). |
| ↳ `MiniScreenBodyComp` | [_screen/preview/MiniScreenBodyComp.tsx](../../../../src/_screen/preview/MiniScreenBodyComp.tsx) | 🖱️R the empty body → context menu **`Add New Screen`** / `Refresh Preview`. With several screens carrying color notes, previews group under color bars. |
| ↳ `ScreenPreviewerItemComp` (one card per screen; `data-screen-key`) | [_screen/preview/ScreenPreviewerItemComp.tsx](../../../../src/_screen/preview/ScreenPreviewerItemComp.tsx) | 🖱️R → menu: `Refresh Preview` (always); >1 screens: `Solo` / `Select`/`Deselect` / `Delete`; bible live: `Set/Unset Line Sync`. ⇕ drop target — card highlights on dragover; dropped slide/bg/foreground presents on THAT screen. |
| ↳↳ `ShowHideScreen` (header) | [_screen/preview/ShowHideScreen.tsx](../../../../src/_screen/preview/ShowHideScreen.tsx) | 🖱️ or ⌨️ `F5` → toggles the physical screen. ON: `.showing` class, opacity 1, and a `screen.html?screenId=N` CDP target appears. **Mandatory to exercise once per run (show → verify → hide-restore, SKILL §6a).** |
| ↳↳ `MiniScreenClearControlComp` (header) | [_screen/preview/MiniScreenClearControlComp.tsx](../../../../src/_screen/preview/MiniScreenClearControlComp.tsx) | 🖱️ / ⌨️ clear buttons: eraser=Clear All `F6`, `BG` `F7`, `SL` `F8`, `BB` `F9`, `FG` `F10`. Enabled-state is observable: a button is `btn-outline-*` while its layer is empty, solid `btn-*` while live. |
| ↳↳ `ShowingScreenIcon` + `ItemColorNoteComp` (header) | [_screen/preview/ShowingScreenIcon.tsx](../../../../src/_screen/preview/ShowingScreenIcon.tsx) | Screen-id badge (`data-screen-id`, per-id color) + 🖱️ color-note dot → color picker (groups previews when multiple screens). |
| ↳↳ Lock toggle (header, `bi-unlock`/`bi-lock-fill`) | [_screen/preview/ScreenPreviewerHeaderComp.tsx](../../../../src/_screen/preview/ScreenPreviewerHeaderComp.tsx) | 🖱️ → locked (red): app-document changes on this screen are refused with toast "Screen Manager is locked"; unlocked (green) normal. Restore unlocked. |
| ↳↳ `DisplayControl` (footer) | [_screen/preview/DisplayControl.tsx](../../../../src/_screen/preview/DisplayControl.tsx) | Button `label(screenId):displayId` → 🖱️ context menu of all OS displays (`label(id): WxH (primary)`, `*` = current) → pick to retarget the screen. Re-select current = safe no-op. |
| ↳↳ `ScreenEffectControlComp` (footer, `Tr:`) | [_screen/preview/ScreenEffectControlComp.tsx](../../../../src/_screen/preview/ScreenEffectControlComp.tsx) | Two `RenderTransitionEffectComp` buttons (`Slide:` / `Background:`) → 🖱️ menu of transition effects `none/fade/move/zoom` (current highlighted); button icon updates. Restore after testing. |
| ↳↳ `BackgroundAudioSwitchComp` (footer, `bi-soundwave`) | [_screen/preview/ScreenPreviewerFooterComp.tsx](../../../../src/_screen/preview/ScreenPreviewerFooterComp.tsx) | Rendered only while a **video background** is live. 🖱️ toggles the audio-handler rows; toggling off while audio plays → toast refusal. |
| ↳↳ `MiniScreenAudioHandlersComp` | [_screen/preview/MiniScreenAudioHandlersComp.tsx](../../../../src/_screen/preview/MiniScreenAudioHandlersComp.tsx) | Per-video `<audio controls data-video-id>` player (filename shown): 🖱️ play/pause — playback syncs the background-video time; 🖱️ repeat toggle `bi-repeat-1` (green=on). End paused. |
| ↳↳ Stage number (footer, `St: N`) | [_screen/preview/ScreenPreviewerFooterComp.tsx](../../../../src/_screen/preview/ScreenPreviewerFooterComp.tsx) | 🖱️ → context menu `0`–`4` + `Increment`/`Decrement` (current disabled; Decrement disabled at 0). Round-trip and restore. |

---

## 2. `reader.html` — Bible Reader (main window)

Root `BibleReaderComp` (no `#app-header`). Source:
[bible-reader/BibleReaderComp.tsx](../../../../src/bible-reader/BibleReaderComp.tsx).

| Component (path) | Source | Interactions & expected result |
|---|---|---|
| `BibleReaderComp → BibleReadingLeftComp` | [bible-list/BibleReadingLeftComp.tsx](../../../../src/bible-list/BibleReadingLeftComp.tsx) | Bibles + Notes lists (same as presenter right column). |
| `BibleReaderComp → RenderBibleLookupComp` | [bible-lookup/RenderBibleLookupComp.tsx](../../../../src/bible-lookup/RenderBibleLookupComp.tsx) | The reference lookup. Resolves a **full** ref (`John 3:16`) to the exact verse (unlike the modal picker). |
| ↳ `InputHandlerComp` (reference input) | [bible-lookup/InputHandlerComp.tsx](../../../../src/bible-lookup/InputHandlerComp.tsx) | ⌨️✎ type a reference. **Incremental picker:** book → chapter → verse. ⌨️ `Tab` completes the current chunk; ⌨️ `Escape` clears input, `Ctrl+Escape` clears a chunk. Use char-by-char `type_text`. |
| ↳ `InputExtraButtonsComp` | [bible-lookup/InputExtraButtonsComp.tsx](../../../../src/bible-lookup/InputExtraButtonsComp.tsx) | 🖱️ Clear input, Clear chunk, `Tab-to-complete` buttons (each titled with its shortcut). |
| ↳ `RenderBookOptionsComp` / `RenderChapterOptionsComp` / `RenderVerseOptionsComp` | [bible-lookup/](../../../../src/bible-lookup/) | 🖱️ pick book / chapter / verse options; ⌨️ arrow navigation within options. |
| ↳ `BibleLookupInputHistoryComp` | [bible-lookup/BibleLookupInputHistoryComp.tsx](../../../../src/bible-lookup/BibleLookupInputHistoryComp.tsx) | 🖱️ a history entry → re-runs that lookup. |
| ↳ `BibleLookupBodyPreviewerComp` | [bible-lookup/BibleLookupBodyPreviewerComp.tsx](../../../../src/bible-lookup/BibleLookupBodyPreviewerComp.tsx) | Rendered verse panel; 🖱️🖱️ to present. |
| ↳ `RenderBibleLookupHeaderComp` + `RenderExtraButtonsRightComp` | [bible-lookup/RenderBibleLookupHeaderComp.tsx](../../../../src/bible-lookup/RenderBibleLookupHeaderComp.tsx) | Lookup header: 🖱️ bible-version selector → verse re-renders in that version. 🖱️ the **advance-lookup toggle** → opens/closes a resizable split (`Lookup` + `Bible Online Lookup`) hosting Bible Find (next row). State persists (`bible-lookup-online-*` setting). |
| ↳ `BibleFindPreviewerComp` (Bible Find, in the advance-lookup split) | [bible-find/BibleFindPreviewerComp.tsx](../../../../src/bible-find/BibleFindPreviewerComp.tsx) | Find-in-bible search. ⌨️✎ query in `BibleFindHeaderComp`; results render per page (`BibleFindRenderPerPageComp`/`RenderFoundItemComp`); 🖱️ page numbers (`RenderPageNumberComp`) paginate. Empty query/results → sane empty state. |
| ↳ Cross-references (`bible-cross-refs`) | [bible-cross-refs/BibleCrossRefRendererComp.tsx](../../../../src/bible-cross-refs/BibleCrossRefRendererComp.tsx) | Cross-reference items for the current verse (`BibleCrossRefRenderFoundItemsComp`); 🖱️ an item → that ref renders. AI variants (Anthropic/OpenAI renderers) need configured API keys — mark BLOCKED if unconfigured, not FAIL. |

> Known Low finding (KB §5): the header **modal** lookup only book-filters a full `John 3:16`
> (adds a history entry but doesn't jump to the verse). The **Reader page** resolves it fully.

---

## 3. `appDocumentEditor.html` — Slide / Doc Editor (main window)

`AppLayoutComp` (header, same as presenter) wraps `AppDocumentEditorComp`. Needs a selected
Open-Worship slide; a non-OWA doc pops "Open Worship slide required → Return to Presenter".
Source: [app-document-editor/AppDocumentEditorComp.tsx](../../../../src/app-document-editor/AppDocumentEditorComp.tsx).

| Component (path) | Source | Interactions & expected result |
|---|---|---|
| `AppDocumentEditorComp → AppDocumentPreviewerComp` (left slide list) | [app-document-presenter/items/AppDocumentPreviewerComp.tsx](../../../../src/app-document-presenter/items/AppDocumentPreviewerComp.tsx) | 🖱️ a slide → select for editing. 🖱️🖱️ → open. 🖱️R → context menu (add/duplicate/delete). ⇕ reorder slides. |
| `…Editor → AppDocumentEditorRightComp` | [app-document-editor/AppDocumentEditorRightComp.tsx](../../../../src/app-document-editor/AppDocumentEditorRightComp.tsx) | Splits into Slide Editor Ground (top) + Background (bottom). |
| ↳ `SlideEditorGroundComp` | [slide-editor/SlideEditorGroundComp.tsx](../../../../src/slide-editor/SlideEditorGroundComp.tsx) | The editing canvas + toolbars. |
| ↳↳ `CanvasContainerComp` (canvas) | [slide-editor/canvas/CanvasContainerComp.tsx](../../../../src/slide-editor/canvas/CanvasContainerComp.tsx) | 🖱️ select a box; ⇕ drag to move; drag handles to resize; `Shift`/`Ctrl` while dragging appends to selection. ⌨️ `Ctrl+Enter` focuses the canvas. |
| ↳↳ `BoxEditorControllingModeComp` / `BoxEditorNormalTextEditModeComp` | [slide-editor/canvas/box/](../../../../src/slide-editor/canvas/box/) | 🖱️🖱️ a text box → enter text-edit mode; ⌨️✎ type; ⇕ drag box; drop external items onto the box. |
| ↳↳ `ToolCanvasItemsComp` (tools) | [slide-editor/canvas/tools/ToolCanvasItemsComp.tsx](../../../../src/slide-editor/canvas/tools/ToolCanvasItemsComp.tsx) | 🖱️ add box / image / etc.; ⇕ drag a tool item onto the canvas. |
| ↳↳ `SlideEditorPopupComp` (quick edit) | [slide-editor/SlideEditorPopupComp.tsx](../../../../src/slide-editor/SlideEditorPopupComp.tsx) | ⌨️ `Escape` closes it. |
| ↳ `BackgroundComp` (bottom) | [background/BackgroundComp.tsx](../../../../src/background/BackgroundComp.tsx) | Same background tabs as presenter (no Audios split off-presenter). |

---

## 4. `setting.html` — Settings (**popup window** ⚠️)

Open via the header gear, then `list_pages` → `select_page` the popup. `document.title`
matches `/Settings/`. Root `SettingComp` (tabs `General` / `Bible` + `SettingApplyComp`).
Source: [setting/SettingComp.tsx](../../../../src/setting/SettingComp.tsx).

| Component (path) | Source | Interactions & expected result |
|---|---|---|
| `SettingComp` tab bar (`General` / `Bible`) | ⤴ SettingComp.tsx | 🖱️ switch tab. |
| `SettingComp → SettingApplyComp` (`Apply Settings`, top-right, fixed) | [setting/SettingApplyComp.tsx](../../../../src/setting/SettingApplyComp.tsx) | 🖱️ → applies / reloads app windows. |
| `SettingGeneralComp → SettingGeneralDirectoryPathComp` | [setting/directory-setting/SettingGeneralDirectoryPathComp.tsx](../../../../src/setting/directory-setting/SettingGeneralDirectoryPathComp.tsx) | ⌨️✎ path inputs; 🖱️ browse/reset directory buttons. |
| `SettingGeneralComp → SettingGeneralLanguageComp` | [setting/SettingGeneralLanguageComp.tsx](../../../../src/setting/SettingGeneralLanguageComp.tsx) | 🖱️ `Khmer` / `English` → switches locale (`localStorage['language-locale']`). ⚠️ a switch mid-run may be the **user** — confirm before reporting (KB §1, §3). |
| `SettingGeneralComp → SettingGeneralThemeComp` | [setting/SettingGeneralThemeComp.tsx](../../../../src/setting/SettingGeneralThemeComp.tsx) | 🖱️ theme (system/light/dark). |
| `SettingGeneralComp → SettingGeneralFontFamilyComp` | [setting/SettingGeneralFontFamilyComp.tsx](../../../../src/setting/SettingGeneralFontFamilyComp.tsx) | 🖱️ pick font. A configured-but-missing font shows `"Hanuman (Missing)"` — **informative, not a bug** (KB §9). |
| `SettingGeneralComp → SettingGeneralOtherOptionsComp` | [setting/SettingGeneralOtherOptionsComp.tsx](../../../../src/setting/SettingGeneralOtherOptionsComp.tsx) | 🖱️ `Reset All Child Directories` / `Reset Widgets Size` / `Clear All Settings` (destructive — confirm dialogs). |
| `SettingComp → SettingBibleComp` (Bible tab) | [setting/bible-setting/SettingBibleComp.tsx](../../../../src/setting/bible-setting/SettingBibleComp.tsx) | 🖱️ download/enable/disable bible versions; ⌨️✎ search. A console `TypeError: Cannot get bible list` at `getOnlineBibleInfoList` is **intended** when the online list is unavailable — do not report (KB §7). |

---

## 5. `screen.html` — Presentation output (separate window) — **mandatory to drive once per run**

Root `ScreenAppComp`. Source:
[_screen/ScreenAppComp.tsx](../../../../src/_screen/ScreenAppComp.tsx),
[screen.tsx](../../../../src/screen.tsx).

> **CDP (verified 2026-07-08):** while a screen is SHOWING it **is** a normal CDP target
> — `screen.html?screenId=N` in `list_pages`, fully drivable (snapshot / click /
> screenshot). The target vanishes when the screen hides; a **hidden** screen's console
> forwards via `all:app:log` to the electron-main stdout (the `npm run dev` terminal).
> Reach it only via `ShowHideScreen`/`F5` + `list_pages` — never `navigate_page` the
> main window here. Screen-only bugs (e.g. full-width PDF) do NOT reproduce in the
> presenter's mini preview — the mini preview reuses the same React components but
> without `isPageScreen`/StrictMode.

| Component | Source | Interactions & expected result |
|---|---|---|
| `ScreenAppComp` | [_screen/ScreenAppComp.tsx](../../../../src/_screen/ScreenAppComp.tsx) | Renders active background + slide + bible + foreground layers — screenshot and compare against the mini preview. ⌨️ `Ctrl/Alt+ArrowLeft` / `ArrowRight` → previous / next bible verse on the live screen. |
| `ScreenCloseButtonComp` (❌ `#close`) | [_screen/ScreenCloseButtonComp.tsx](../../../../src/_screen/ScreenCloseButtonComp.tsx) | 🖱️ → hides this screen: CDP target disappears, presenter `ShowHideScreen` flips to hidden. |

---

## 6–11. Popup editors & misc windows

Open via their in-app buttons; pick up the target with `list_pages`. Generic readiness
check only (`#root` has children, no `img.loading`).

| Page | Root component | Source | Interactions & expected result |
|---|---|---|---|
| Finder | `FinderAppComp` | [find/FinderAppComp.tsx](../../../../src/find/FinderAppComp.tsx) | ⌨️✎ search input; 🖱️ prev (`bi bi-arrow-left`) / next (`bi bi-arrow-right`); 🖱️ case-sensitive checkbox. ⌨️ `Enter` next match. |
| Lyric Editor | `LyricEditorPopupComp` | [lyric-list/LyricEditorPopupComp.tsx](../../../../src/lyric-list/LyricEditorPopupComp.tsx) | ⌨️✎ edit lyric text/chords; 🖱️ save; ⌨️ `Ctrl+S` save. |
| Bible Note | `NoteItemEditorPopupComp` | [bible-list/note/NoteItemEditorPopupComp.tsx](../../../../src/bible-list/note/NoteItemEditorPopupComp.tsx) | ⌨️✎ note editor (renders into `#bible-note-root`); 🖱️/⌨️ save. |
| Web Editor | `WebEditorComp` | [background/web/WebEditorComp.tsx](../../../../src/background/web/WebEditorComp.tsx) | ⌨️✎ web URL/title; 🖱️ save → adds a web-background item. |
| About | `AboutComp` | [others/AboutComp.tsx](../../../../src/others/AboutComp.tsx) | 🖱️ version / links (external `bi-box-arrow-up-right`). Mostly read-only. |
| LW Share | `LWShareAppComp` | [lwShare/LWShareAppComp.tsx](../../../../src/lwShare/LWShareAppComp.tsx) | Share view; 🖱️ share controls. |

---

## Cross-cutting components (present on multiple pages)

| Component | Source | Interactions & expected result |
|---|---|---|
| `AppContextMenuComp` | [context-menu/AppContextMenuComp.tsx](../../../../src/context-menu/AppContextMenuComp.tsx) | Opened by 🖱️R on many items. 🖱️ an entry runs its action; ⌨️ `Escape` / click-away closes. |
| `ModalComp` / `AppPopupBibleLookupComp` | [app-modal/ModalComp.tsx](../../../../src/app-modal/ModalComp.tsx) | Close: 🖱️ `button.btn-danger` (`bi bi-x-lg`) or ⌨️ `Ctrl+Q`. |
| `HandleAlertComp` / `ConfirmPopupComp` / `InputPopupComp` / `AlertPopupComp` | [popup-widget/](../../../../src/popup-widget/) | 🖱️ `Ok` / `Cancel`; ⌨️ `Enter` confirms, `Escape` cancels; ⌨️✎ input popups. |
| `ToastComp` | [toast/ToastComp.tsx](../../../../src/toast/ToastComp.tsx) | Auto-dismiss notices; 🖱️ to dismiss. |
| `TopProgressBarComp` | [progress-bar/TopProgressBarComp.tsx](../../../../src/progress-bar/TopProgressBarComp.tsx) | Load indicator (observe, no interaction). |
| `ResizeActorComp` (dividers) | [resize-actor/ResizeActorComp.tsx](../../../../src/resize-actor/ResizeActorComp.tsx) | ⇕ drag a splitter to resize a column/row; double-click may quick-resize. Every multi-pane layout uses this. |

---

## Quick per-page interaction checklist

- **Presenter:** header tabs 🖱️ · `Ctrl+B`/`Ctrl+Q` modal · doc/lyric list 🖱️🖱️ present · expand Background 🖱️ then tab-switch · color swatch (+contrast confirm) · foreground drag⇕drop onto mini-screen · **screen block (mandatory): present → `F5` show → drive `screen.html` target → `F6`–`F10` clears → hide** · lock/display/transition/stage controls on the previewer card · zoom/size 🎚️.
- **Reader:** incremental lookup ⌨️✎ + `Tab`/`Escape` · full ref resolves to verse.
- **Slide Editor:** select doc first · box 🖱️/⇕/resize · `Ctrl+Enter` focus · tools drag⇕drop · background tabs.
- **Settings (popup):** tab 🖱️ · Language `Khmer`/`English` · `Apply Settings` · destructive resets (confirm).
- **Screen (while showing = CDP target):** screenshot layers · `Ctrl/Alt+Arrows` change bible · ❌ `#close` hides; hidden → logs via `all:app:log`.
