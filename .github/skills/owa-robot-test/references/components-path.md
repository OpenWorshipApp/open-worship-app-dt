# OWA Components Path — pages → components → interactions

docVersion: 2026-08-30

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
- [coverage-matrix.md](../../../../docs/test-paths/coverage-matrix.md) — the enumerated coverage contract (stable
  row IDs) that full-coverage runs must fill in.

> **Component paths** below read top-down like a breadcrumb: `Page → Parent → Child`.
> Every React component in this app is named `…Comp` (project convention). Source files
> are linked so you can confirm current behavior before reporting a "bug".
>
> **Targeting rules (from the knowledge base):** locale is dynamic (Khmer/English) — target
> by **role / CSS class / icon (`bi-*`) / position**, not literal text. Click the actual
> `button`, not its wrapping `<li>`/`StaticText`. Slide & lyric previews live inside
> `<iframe srcdoc>` (not reachable from document-level `querySelectorAll`).

> ⚠️ **Source-verified UI drift (updated 2026-08-30) — confirm live, then reconcile this
> file.** The presenter has moved several panels to **floating widgets**: **Foreground**
> and **Bible Properties** (bible appearance / text-shadow) are `FloatingWidgetComp`
> toggles, not inline split-tabs; the presenter main tab bar is
> **`Documents`/`Bibles` only** (`tabTypeList`, `PresenterComp.tsx` — there is no Lyrics
> tab; lyrics are rows of the Documents list). Presenting a slide is a **single-click
> toggle** (not double-click). Background **Web** `+` opens a menu (not directly the Web
> Editor). Theme options include **System** (not only light/dark). These are reflected in
> the coverage-matrix REFINEs (`PM-01`, `PM-06`, `PM-13/14`, `PM-33`, `PM-57`, the `ST`
> theme rows) — treat the matrix as authoritative and update the tables below as you
> verify each against the live app.

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
| `F5` | Toggle show/hide the presentation screen | [_screen/preview/ShowHideScreen.tsx](../../../../src/_screen/preview/ShowHideScreen.tsx) (component `ShowHideScreenComp`) |
| `F6` | Clear All (screen) | [_screen/preview/MiniScreenClearControlComp.tsx](../../../../src/_screen/preview/MiniScreenClearControlComp.tsx) |
| `F7` | Clear Background | ⤴ same |
| `F8` | Clear Slide | ⤴ same |
| `F9` | Clear Bible | ⤴ same |
| `F10` | Clear Foreground | ⤴ same |
| `Arrows` / `PageUp` / `PageDown` / `Space` | Navigate slides (container focused; `Space` toggles) | [app-document-presenter/items/VarySlidesComp.tsx](../../../../src/app-document-presenter/items/VarySlidesComp.tsx) |
| `Tab` | Bible Lookup: complete current book/chapter/verse chunk | [bible-lookup/InputExtraButtonsComp.tsx](../../../../src/bible-lookup/InputExtraButtonsComp.tsx) |
| `Escape` / `Ctrl+Escape` | Bible Lookup: clear input / clear chunk | ⤴ same |
| `Ctrl+Enter` | Slide editor: focus the canvas | [slide-editor/canvas/canvas-container/CanvasContainerComp.tsx](../../../../src/slide-editor/canvas/canvas-container/CanvasContainerComp.tsx) |
| `Ctrl+S` | Editors: save | (lyric/web/bible-note editors) |
| `Ctrl/Alt+ArrowLeft/Right` | Screen output: prev/next bible | [screen.tsx](../../../../src/screen.tsx) |

> This table lists the **common** shortcuts. The **complete, source-verified** set — every
> `useKeyboardRegistering` call site plus electron application-menu accelerators — is
> enumerated as unit tests in [coverage-matrix.md](../../../../docs/test-paths/coverage-matrix.md) §KB (`KB-01..60`):
> bible-lookup editing (`Ctrl+Enter`, `Ctrl+Shift+Enter`, `Ctrl+Shift+S/V`, `Ctrl+W`),
> canvas & slide-list (`Ctrl+C/V/A`, `Delete`, `Ctrl+Shift+D`, `Ctrl+Z/Y`, arrows), finder
> (`Enter`/`Escape`/`Ctrl+Q`), popups (`Enter`/`Escape`), context-menu keyboard nav
> (`KB-16/17`), the **layer-suppression** rule (root F-keys don't fire while a modal/menu
> is open, `KB-15`), and the mac `Meta+Q` quit path (`KB-14`). Right-click menu **items**
> are their own matrix section, §CM (`CM-01..99`).

---

## Pages (HTML entry points)

| Page | Entry | Root component | Window | Header (`#app-header`)? |
|---|---|---|---|---|
| Presenter | `presenter.html` → [presenter.tsx](../../../../src/presenter.tsx) | `AppLayoutComp` → `AppPresenterComp` | main | ✅ |
| Bible Reader | `reader.html` → [reader.tsx](../../../../src/reader.tsx) | `BibleReaderComp` | main | ❌ |
| Slide / Doc Editor | `appDocumentEditor.html` → [appDocumentEditor.tsx](../../../../src/appDocumentEditor.tsx) | `AppLayoutComp` → `AppDocumentEditorComp` | main | ✅ |
| Settings | `setting.html` → [setting.tsx](../../../../src/setting.tsx) | `SettingComp` | **popup** ⚠️ | ❌ |
| Screen output | `screen.html` → [screen.tsx](../../../../src/screen.tsx) | `ScreenAppComp` | separate (when presenting) | ❌ |
| Find bar | `finder.html` → [finder.tsx](../../../../src/finder.tsx) | `FinderAppComp` | **pinned `WebContentsView`** (not a window) | ❌ |
| Lyric Editor | `lyricEditor.html` → [lyricEditor.tsx](../../../../src/lyricEditor.tsx) + [lyricEditorBoot.ts](../../../../src/lyricEditorBoot.ts) | **no `…Comp` root** — mounts `OpenLyricDashboard` (from the `open-lyric` package) into `[data-ol-ref="app"]` | **popup** | ❌ |
| Bible Note | `bibleNote.html` → [bibleNote.tsx](../../../../src/bibleNote.tsx) | `NoteItemEditorPopupComp` | **popup** | ❌ |
| Web Editor | `webEditor.html` → [webEditor.tsx](../../../../src/webEditor.tsx) | `WebEditorComp` | **popup** | ❌ |
| About | `about.html` → [about.tsx](../../../../src/about.tsx) | `AboutComp` | **popup** | ❌ |
| LW Share | `lwShare.html` → [lwShare.tsx](../../../../src/lwShare.tsx) | `LWShareAppComp` | popup | ❌ |
| (dev) Experiment | `experiment.html` | dev-only playground | main (dev) | — |

> ⚠️ **Popups (`setting`, `about`, `finder`, `lyricEditor`, `bibleNote`, `webEditor`) must NOT be
> loaded in the main window with `navigate_page`** — it traps the window (`ERR_ABORTED`) and
> persists `mainHtmlPath`. Open via their in-app button, then `list_pages` → `select_page` the
> new target. See [knowledge-base.md](./knowledge-base.md) §2–§3.
>
> ⚠️ **Readiness exception — `lyricEditor.html` has NO `#root`** (the only page in `html/`
> without one). It ships `<div id="appLoading" class="app-loading" data-state="loading">` +
> `<template data-ol-mount="dashboardShell">`; the generic "`#root` has children" probe
> returns false forever there. Correct signal: `#appLoading` gone/settled AND
> `[data-ol-ref="app"]` populated.

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
| `…Left → VaryAppDocumentListComp` (Documents list) | [app-document-list/VaryAppDocumentListComp.tsx](../../../../src/app-document-list/VaryAppDocumentListComp.tsx) | 🖱️ `li.list-group-item` → selects (gets `.active`), loads slides into the middle Documents tab, updates footer path. 🖱️🖱️ → present / open. 🖱️R → context menu (rename/delete/etc.). ⇕ drag to reorder. Icons `bi bi-file-earmark-slides` / `-pdf`. List body menu also carries **Import From SongSelect** ([plugins/song-select/](../../../../src/plugins/song-select/), gated on sign-in; matrix `PL-104`, workflow `W-35`) and **Import From Public Domain Songs** ([plugins/public-domain-songs/](../../../../src/plugins/public-domain-songs/), always present, no account; matrix `PL-105`, workflow `W-36`) — both write a `<Title>.owl` lyric document. |
| `…Left → PresentingFlowListComp` (Presenting Flows list) | [presenting-flow/PresentingFlowListComp.tsx](../../../../src/presenting-flow/PresentingFlowListComp.tsx) | **Every build** — the `isDev` gate was removed in `203d35cc` and this widget took the slot the old `LyricListComp` held (lyrics are now rows of the Documents list). 🖱️ a card header → open/close; ⇕ drop a background / document / slide / bible item / foreground / audio to add; 🖱️ an element row → present it (a document row opens its previewer); ⇕ a row onto another row of the SAME presenting flow → reorder; ⇕ a row onto another row **while it shows `app-presenting-flow-row-dragging-over-cc`** → attach as a **CC element** instead of reordering; 🖱️R an element → Reveal Original / Show on Screens / **Set Specific Screen** / **Add CC Elements** / Move up / Move to Top / Move down / Move to Bottom / **Duplicate** / Choose Color / **Disable** / Remove; 🖱️R the presenting flow row itself → **Add Action** (four-level menu: **Clear Screen** ▸ 5 clears · **Other Clear FG Items** ▸ 8 per-widget clears; then 2 screen show/hide · 5 run actions) / Export / Import; header `bi-window-stack` → floating run-sheet **player** (arrow/Space step it, a `Keyboard Event` line answers its own shortcut). Sub-components: `PresentingFlowFileComp`, `PresentingFlowItemComp`, `PresentingFlowRowComp`, `PresentingFlowCcRowsComp`, `PresentingFlowScreenPinComp`, `PresentingFlowDocumentSlidesComp`, `PresentingFlowPreviewFloatingComp`, `PresentingFlowItemPreviewComp`; logic in `presentingFlowActionHelpers` / `presentingFlowCcHelpers` / `presentingFlowAutoNextHelpers` / `presentingFlowArchiveHelpers` / `presentingFlowPreviewFloatingHelpers`. See knowledge-base §14, test-plan §S20, matrix PL-10 / PL-29 / PL-32..PL-76 / PL-81..PL-102 (**presenting flow deep mode**). |

### Presenter → Middle column (`AppPresenterMiddleComp`)

Source: [presenter/AppPresenterMiddleComp.tsx](../../../../src/presenter/AppPresenterMiddleComp.tsx). Top = `PresenterComp`, bottom = `BackgroundComp`.

#### Middle → `PresenterComp` (tabbed previewer)

Source: [app-document-presenter/PresenterComp.tsx](../../../../src/app-document-presenter/PresenterComp.tsx). Tabs are **multi-select** (several can be active); right-click a tab = solo.

| Component (path) | Source | Interactions & expected result |
|---|---|---|
| `PresenterComp` tab bar (`Documents`/`Bibles` — **2 tabs only**) | [others/TabRenderComp.tsx](../../../../src/others/TabRenderComp.tsx) | 🖱️ a tab → toggles it into the split view. 🖱️R a tab → **solo** (that tab only). A tab with live content shows `.app-on-screen`. There is no Lyrics tab (lyrics are Documents-list rows) and no Foreground tab — Foreground is a floating widget (next rows). |
| `PresenterComp → RenderToggleFullViewComp` (fullscreen widget) | ⤴ PresenterComp.tsx | 🖱️ (icon `bi bi-arrows-fullscreen` / `bi-fullscreen-exit`) → toggles `.app-full-view` on the presenter panel (widget-fullscreen, not OS fullscreen). |
| `PresenterComp → AppDocumentPreviewerComp` (Documents tab) | [app-document-presenter/items/AppDocumentPreviewerComp.tsx](../../../../src/app-document-presenter/items/AppDocumentPreviewerComp.tsx) | Slide thumbnails (`<iframe srcdoc>`). 🖱️🖱️ a thumb → send that slide to screen. 🖱️R → context menu. ⌨️ `Arrows`/`PageUp`/`PageDown`/`Space` navigate when focused. 🎚️ footer size slider (`.app-range`, `max=200`) rescales thumbs. |
| ↳ `SlideAutoPlayComp` (auto-play widget) | [slide-auto-play/SlideAutoPlayComp.tsx](../../../../src/slide-auto-play/SlideAutoPlayComp.tsx) | 🖱️ stopwatch icon (`bi bi-stopwatch-fill`) → expands the widget. ⌨️✎ seconds input. 🖱️ play (`bi bi-play`) → slides auto-advance on the timer; 🖱️ pause. 🖱️ red `bi bi-x-lg` → collapses. Also used inside `ForegroundImagesSlideShowComp`. |
| `AppDocumentPreviewerComp → LyricHandlerComp` (Documents tab body, `.owl` only) | [lyric-list/LyricHandlerComp.tsx](../../../../src/lyric-list/LyricHandlerComp.tsx) | The lyric preview BODY — open-lyric `Previewer` + `Stage Previewer`. There is no Lyrics tab: the Documents previewer swaps this in for a lyric and keeps its own footer. 🖱️🖱️ a verse → send to screen (`.app-on-screen`). |
| ↳ `LyricSlidesPreviewerComp` (the **Stage Previewer** under the rendered song) | [lyric-list/LyricSlidesPreviewerComp.tsx](../../../../src/lyric-list/LyricSlidesPreviewerComp.tsx) | One pane per stage (`.stage-previewer-pane`), each a `VarySlidesPreviewerComp` over a `LyricAppDocumentStage*`. Header: a chip per stage (padlocked `Stage 0` + a ⚙ each → PM-116/117), **Add Stage**, and **⋮ More Options → Reload** (PM-127). A content change on disk clears **every** stage's slide cache and re-renders all panes (XW-08) — the panes' rendered lyric HTML lives in **shadow roots**, so read it with `el.shadowRoot.textContent`. |
| `PresenterComp → PresenterBiblePreviewerRenderComp` (Bibles tab) | [app-document-presenter/PresenterBiblePreviewerRenderComp.tsx](../../../../src/app-document-presenter/PresenterBiblePreviewerRenderComp.tsx) | Shows the currently looked-up verse. 🖱️🖱️ → send verse to screen. Its footer carries `BibleCustomStyleFloatingToggleComp` — Bible Properties is a **floating widget** now, not an inline split (next row). |
| ↳ `BibleCustomStyleFloatingComp` (bible appearance, floating widget) | [screen-setting/BibleCustomStyleFloatingComp.tsx](../../../../src/screen-setting/BibleCustomStyleFloatingComp.tsx) | Lazy-loads `BibleCustomStyleComp`: two cards — **Appearance** (`ScreenBibleAppearanceComp` — font size/color/etc. of the on-screen bible text) and **Text Shadow** (`ScreenBibleTextShadow`). 🎚️/🖱️ a control → live bible text on the mini-screen restyles. Restore values afterward. The **same toggle also sits in the mini-screen footer** ([MiniScreenFooterComp.tsx](../../../../src/_screen/preview/MiniScreenFooterComp.tsx), matrix `SP-21`). |
| `ForegroundFloatingComp` (Foreground floating widget, `persistKey="floating-widget-rect-foreground"`) | ⤴ PresenterComp.tsx | 🖱️ its toggle → opens the floating widget hosting `PresenterForegroundComp` — 8 stacked foreground widgets (next block). |

##### `PresenterForegroundComp` widgets (Foreground floating widget)

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
| shared: `CommonStyleControlsComp` (file `ForegroundCommonPropertiesSettingComp.tsx` — default export renamed) | [ForegroundCommonPropertiesSettingComp.tsx](../../../../src/presenter-foreground/ForegroundCommonPropertiesSettingComp.tsx) | 🎚️ font-size / color / position controls that restyle the live foreground. |

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
| ↳ `BibleNoteListComp` (Notes) | [bible-list/note/BibleNoteListComp.tsx](../../../../src/bible-list/note/BibleNoteListComp.tsx) | 🖱️ a note; edit → opens **Bible Note** popup. Body 🖱️R/header: **Import** / **Import From URL** + ⇕ drop a `.owanote.tar.gz` → whole-file import (PR-31, CM-99). A note-file row's ⋮/🖱️R carries **Export** → `.owanote.tar.gz` bundle (PR-30, CM-98, `NoteFileComp`). Marked verses list here as verse rows (`VerseNoteItemRenderComp` — reader table below). |
| `…Right → MiniScreenComp` | [_screen/preview/MiniScreenComp.tsx](../../../../src/_screen/preview/MiniScreenComp.tsx) | Live preview container `div.card.app-zero-border-radius`. 🎚️ zoom slider (`max=30`) rescales the preview. Holds one `ScreenPreviewerItemComp` **per screen** (multi-screen capable). |
| ↳ `MiniScreenBodyComp` | [_screen/preview/MiniScreenBodyComp.tsx](../../../../src/_screen/preview/MiniScreenBodyComp.tsx) | 🖱️R the empty body → context menu **`Add New Screen`** / `Refresh Preview`. With several screens carrying color notes, previews group under color bars. |
| ↳ `ScreenPreviewerItemComp` (one card per screen; `data-screen-key`) | [_screen/preview/ScreenPreviewerItemComp.tsx](../../../../src/_screen/preview/ScreenPreviewerItemComp.tsx) | 🖱️R → menu: `Refresh Preview` (always); >1 screens: `Solo` / `Select`/`Deselect` / `Delete`; bible live: `Set/Unset Line Sync`. ⇕ drop target — card highlights on dragover; dropped slide/bg/foreground presents on THAT screen. |
| ↳↳ `ShowHideScreenComp` (header; file `ShowHideScreen.tsx`) | [_screen/preview/ShowHideScreen.tsx](../../../../src/_screen/preview/ShowHideScreen.tsx) | 🖱️ or ⌨️ `F5` → toggles the physical screen. ON: `.showing` class, opacity 1, and a `screen.html?screenId=N` CDP target appears. **Mandatory to exercise once per run (show → verify → hide-restore, SKILL §6a).** |
| ↳↳ `MiniScreenClearControlComp` (header) | [_screen/preview/MiniScreenClearControlComp.tsx](../../../../src/_screen/preview/MiniScreenClearControlComp.tsx) | 🖱️ / ⌨️ clear buttons: eraser=Clear All `F6`, `BG` `F7`, `SL` `F8`, `BB` `F9`, `FG` `F10`. Enabled-state is observable: a button is `btn-outline-*` while its layer is empty, solid `btn-*` while live. |
| ↳↳ `ShowingScreenIconComp` (file `ShowingScreenIcon.tsx`) + `ItemColorNoteComp` (header) | [_screen/preview/ShowingScreenIcon.tsx](../../../../src/_screen/preview/ShowingScreenIcon.tsx) | Screen-id badge (`data-screen-id`, per-id color) + 🖱️ color-note dot → color picker (groups previews when multiple screens). |
| ↳↳ Lock toggle (header, `bi-unlock`/`bi-lock-fill`) | [_screen/preview/ScreenPreviewerHeaderComp.tsx](../../../../src/_screen/preview/ScreenPreviewerHeaderComp.tsx) | 🖱️ → locked (red): app-document changes on this screen are refused with toast "Screen Manager is locked"; unlocked (green) normal. Restore unlocked. |
| ↳↳ `DisplayControl` (footer) | [_screen/preview/DisplayControlComp.tsx](../../../../src/_screen/preview/DisplayControlComp.tsx) | Button `label(screenId):displayId` → 🖱️ context menu of all OS displays (`label(id): WxH (primary)`, `*` = current) → pick to retarget the screen. Re-select current = safe no-op. |
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
| `BibleReaderComp → RenderBibleLookupComp` | [bible-lookup/RenderBibleLookupComp.tsx](../../../../src/bible-lookup/RenderBibleLookupComp.tsx) | The reference lookup — the **same** step-by-step picker as the modal (same `InputHandlerComp`). A typed full ref (`John 3:16`) book-filters only; it does **not** resolve to the verse. |
| ↳ `InputHandlerComp` (reference input) | [bible-lookup/InputHandlerComp.tsx](../../../../src/bible-lookup/InputHandlerComp.tsx) | ⌨️✎ type a reference. **Incremental picker:** book → chapter → verse. ⌨️ `Tab` completes the current chunk; ⌨️ `Escape` clears input, `Ctrl+Escape` clears a chunk. Use char-by-char `type_text`. |
| ↳ `InputExtraButtonsComp` | [bible-lookup/InputExtraButtonsComp.tsx](../../../../src/bible-lookup/InputExtraButtonsComp.tsx) | 🖱️ Clear input, Clear chunk, `Tab-to-complete` buttons (each titled with its shortcut). |
| ↳ `RenderBookOptionsComp` / `RenderChapterOptionsComp` / `RenderVerseOptionsComp` | [bible-lookup/](../../../../src/bible-lookup/) | 🖱️ pick book / chapter / verse options; ⌨️ arrow navigation within options. |
| ↳ `BibleLookupInputHistoryComp` | [bible-lookup/BibleLookupInputHistoryComp.tsx](../../../../src/bible-lookup/BibleLookupInputHistoryComp.tsx) | 🖱️ a history entry → re-runs that lookup. |
| ↳ `BibleLookupBodyPreviewerComp` | [bible-lookup/BibleLookupBodyPreviewerComp.tsx](../../../../src/bible-lookup/BibleLookupBodyPreviewerComp.tsx) | Rendered verse panel; 🖱️🖱️ to present. |
| ↳ `RenderBibleLookupHeaderComp` + `RenderExtraButtonsRightComp` | [bible-lookup/RenderBibleLookupHeaderComp.tsx](../../../../src/bible-lookup/RenderBibleLookupHeaderComp.tsx) | Lookup header: 🖱️ bible-version selector → verse re-renders in that version. 🖱️ the **advance-lookup toggle** → opens/closes a resizable split (`Lookup` + `Bible Online Lookup`) hosting Bible Find (next row). State persists (`bible-lookup-online-*` setting). |
| ↳ `BibleFindPreviewerComp` (the advance-lookup split host — a **4-way `<select>` switcher**) | [bible-find/BibleFindPreviewerComp.tsx](../../../../src/bible-find/BibleFindPreviewerComp.tsx) | Switches between **Find** (`s`) / **Cross Reference** (`c`) / **Location-Name (KJV)** (`l`) / **Resources** (`r`) via `tabTypeList`; choice persists in setting `bible-search-tab`. Only the active entry is mounted. **Find**: ⌨️✎ query in `BibleFindHeaderComp`; results render per page (`BibleFindRenderPerPageComp`/`RenderFoundItemComp`); 🖱️ page numbers (`RenderPageNumberComp`) paginate. Empty query/results → sane empty state. |
| ↳ Cross-references (`bible-cross-refs`) | [bible-cross-refs/BibleCrossRefRendererComp.tsx](../../../../src/bible-cross-refs/BibleCrossRefRendererComp.tsx) | Cross-reference items for the current verse (`BibleCrossRefRenderFoundItemsComp`); 🖱️ an item → that ref renders. AI variants (Anthropic/OpenAI renderers) need configured API keys — mark BLOCKED if unconfigured, not FAIL. |
| ↳ Resources (`resources`) | [resources/ResourcesPreviewerComp.tsx](../../../../src/resources/ResourcesPreviewerComp.tsx) | The user's OWN files for the current verse's **chapter**: one collapsible box per added folder (`ResourcesDirBoxComp`), each listing files under it named `<bookKey>.<chapter>.<anything>` (`ResourcesFileRowComp`) — chapter-level, not verse-level. Book-level files `<bookKey>.0.*` (chapter < 1) belong to EVERY chapter of the book and are tagged `Introduction`. Free-text filename search appends hits below, capped at 200; verse matches never capped. 🖱️ a row opens it in the OS default app (no drag, no present). Needs at least one folder added (`resources-folder-list`) — with none, the body is a single **Add Folder** button, which is the correct empty state, not a FAIL. No file watcher: a file added on disk appears after the 10s scan-cache TTL or box **Refresh** / panel **Reload**. Matrix `RD-81..90` + `CM-93`; workflow `W-37`. |
| ↳ Location-Name lookup (`location-name-lookup`) | [location-name-lookup/](../../../../src/location-name-lookup/) | The `Location-Name (KJV)` entry of the same switcher: names/places lookup with its own `en`/`km` dataset language (independent of app locale), detail floating panels (`LocationNameDetailPanelsHostComp`), and the **Open Graph Preview** button (`OpenGraphPreviewButtonComp`) that opens the Connection Graph. Workflows `W-29`/`W-30`. |
| ↳ Connection Graph (`graph-view`) | [graph-view/](../../../../src/graph-view/) | Host `GraphViewPanelsHostComp`, mounted from [reader.tsx](../../../../src/reader.tsx) and [router/AppLayoutComp.tsx](../../../../src/router/AppLayoutComp.tsx); opened from a location-name record's **Open Graph Preview**. ⇕ drag boxes; wheel-zoom; 🖱️R a box → menu (**Set as centre** / **Use as root** / expand relations); ⌨️ `Ctrl+Z`/`Ctrl+Y` undo/redo; ✨ re-layout; export (`graphExportHelpers`). Matrix `RD-92..106`; workflow `W-38`. |
| `BibleSelectionToolbarComp` (verse marks) | [bible-reader/BibleSelectionToolbarComp.tsx](../../../../src/bible-reader/BibleSelectionToolbarComp.tsx) | Mounted once per window by `BiblePreviewerRenderComp` (reader, presenter Bibles tab, lookup popup — never `screen.html`). ⇕ drag-select words inside ONE verse → floating toolbar over the selection: 🖱️ a colour swatch → highlight; **Add Comment** → per-mark textarea widget (500ms-debounced save); **Remove Marks**. A cross-verse selection raises nothing (by design). Marks paint via `CSS.highlights` (no DOM node); hovering a commented phrase pops an Edit/Delete tooltip (`verseCommentHoverHelpers`, 1200ms grace). Matrix `RD-108..110`; workflow `W-40`. |
| `VerseNoteItemRenderComp` (Bible Notes verse rows) | [bible-list/note/VerseNoteItemRenderComp.tsx](../../../../src/bible-list/note/VerseNoteItemRenderComp.tsx) | One row per marked verse in Bible Notes (`bi-highlighter`, count chip while folded; the listed marks WEAR their wash/underline). 🖱️ a mark → opens its verse as another bible view; a mark's ⋮ → recolour / **Edit Comment** / **Delete** (`RenderVerseAnnotationComp`); the row's ⋮ → **Add to Bible List** / **Move To** / **Delete** (no Duplicate). ⇕ drag the row onto a bible file (arrives as a bible item) or another note file (moves the verse row, marks intact — two drag payloads). Deleting the last mark removes the row. Matrix `RD-111..112`. |

> Known Low finding (KB §5): a typed full `John 3:16` only book-filters (it adds a history
> entry but doesn't jump to the verse) — in the header **modal** *and* on the **Reader
> page**, which share `InputHandlerComp`. Verified 2026-08-05; the previous "the Reader
> resolves it fully" note was doc drift.

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
| ↳↳ `CanvasContainerComp` (canvas) | [slide-editor/canvas/canvas-container/CanvasContainerComp.tsx](../../../../src/slide-editor/canvas/canvas-container/CanvasContainerComp.tsx) | 🖱️ select a box; ⇕ drag to move; drag handles to resize; `Shift`/`Ctrl` while dragging appends to selection. ⌨️ `Ctrl+Enter` focuses the canvas. |
| ↳↳ `BoxEditorComp` (+ `boxEditorHelpers.tsx`; controlling mode lives inside it — the old `BoxEditorControllingModeComp` is gone) / `BoxEditorNormalTextEditModeComp` | [slide-editor/canvas/box/](../../../../src/slide-editor/canvas/box/) | 🖱️🖱️ a text box → enter text-edit mode; ⌨️✎ type; ⇕ drag box; drop external items onto the box. |
| ↳↳ `ToolCanvasItemsComp` (tools) | [slide-editor/canvas/tools/ToolCanvasItemsComp.tsx](../../../../src/slide-editor/canvas/tools/ToolCanvasItemsComp.tsx) | 🖱️ add box / image / etc.; ⇕ drag a tool item onto the canvas. |
| ↳ `BackgroundComp` (bottom) | [background/BackgroundComp.tsx](../../../../src/background/BackgroundComp.tsx) | Same background tabs as presenter (no Audios split off-presenter). |

---

## 4. `setting.html` — Settings (**popup window** ⚠️)

Open via the header gear, then `list_pages` → `select_page` the popup. `document.title`
matches `/Settings/`. Root `SettingComp` (tabs `General` / `Bible` / `Others` +
`SettingApplyComp`). Source: [setting/SettingComp.tsx](../../../../src/setting/SettingComp.tsx).

| Component (path) | Source | Interactions & expected result |
|---|---|---|
| `SettingComp` tab bar (`General` / `Bible` / `Others` — **3 tabs**) | ⤴ SettingComp.tsx | 🖱️ switch tab. |
| `SettingComp → SettingApplyComp` (`Apply Settings`, top-right, fixed) | [setting/SettingApplyComp.tsx](../../../../src/setting/SettingApplyComp.tsx) | 🖱️ → applies / reloads app windows. |
| `SettingGeneralComp → SettingGeneralDirectoryPathComp` | [setting/directory-setting/SettingGeneralDirectoryPathComp.tsx](../../../../src/setting/directory-setting/SettingGeneralDirectoryPathComp.tsx) | ⌨️✎ path inputs; 🖱️ browse/reset directory buttons. |
| `SettingGeneralComp → SettingGeneralLanguageComp` | [setting/SettingGeneralLanguageComp.tsx](../../../../src/setting/SettingGeneralLanguageComp.tsx) | 🖱️ `Khmer` / `English` → switches locale, completed by `Apply Settings` (reloads every window). **This is the entry point for the mandatory locale block (LT-01..02, SKILL.md §6d)** — every run switches here and switches back. ⚠️ a switch you did NOT make may be the **user** — confirm before reporting (KB §1, §1.1, §3). |
| `SettingGeneralComp → SettingGeneralThemeComp` | [setting/SettingGeneralThemeComp.tsx](../../../../src/setting/SettingGeneralThemeComp.tsx) | 🖱️ theme (system/light/dark). |
| `SettingGeneralComp → SettingGeneralFontFamilyComp` | [setting/SettingGeneralFontFamilyComp.tsx](../../../../src/setting/SettingGeneralFontFamilyComp.tsx) | 🖱️ pick font. A configured-but-missing font shows `"Hanuman (Missing)"` — **informative, not a bug** (KB §9). |
| `SettingGeneralComp → SettingGeneralOtherOptionsComp` | [setting/SettingGeneralOtherOptionsComp.tsx](../../../../src/setting/SettingGeneralOtherOptionsComp.tsx) | 🖱️ `Clear All Settings` only (destructive, and it does **not** confirm). `Reset Widgets Size` moved to the native View menu on 2026-08-09. |
| _(native View menu)_ `initWidgetAppMenu` | [resize-actor/widgetAppMenuHelpers.ts](../../../../src/resize-actor/widgetAppMenuHelpers.ts) · [resize-actor/widgetRegistry.ts](../../../../src/resize-actor/widgetRegistry.ts) | 🖱️ **View → Widgets** tick-box per collapsible pane (toggles it live) and **View → Reset Widgets Size** (confirm → restore defaults + reopen collapsed panes, live). Registered from `run()` for the main window only. Unreachable from CDP — drive `globalThis.getViewWidgetMenuItems()` / `tryToggleWidget(id)` / `tryResetWidgetsSize()` (dev only). |
| `SettingComp → SettingBibleComp` (Bible tab) | [setting/bible-setting/SettingBibleComp.tsx](../../../../src/setting/bible-setting/SettingBibleComp.tsx) | 🖱️ download/enable/disable bible versions; ⌨️✎ search. A console `TypeError: Cannot get bible list` at `getOnlineBibleInfoList` is **intended** when the online list is unavailable — do not report (KB §7). |
| `SettingComp → SettingOthersComp` (Others tab) | [setting/SettingOthersComp.tsx](../../../../src/setting/SettingOthersComp.tsx) | Three cards in order: `SettingOthersAIComp` (AI API key), `SettingOthersSongSelectComp` ([plugins/song-select/](../../../../src/plugins/song-select/SettingOthersSongSelectComp.tsx) — CCLI SongSelect sign-in; dev builds add a `(dev) Use Mock Data` toggle), and `SettingOthersExtraBinComp` ([setting/SettingOthersExtraBinComp.tsx](../../../../src/setting/SettingOthersExtraBinComp.tsx) — **Extra Binaries**, the target of mandatory `MD-05`/`MD-06`). `SettingOthersSecureStorageWarningComp` renders on both credential cards when OS secure storage is unavailable. |

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
check only (`#root` has children, no `img.loading`) — **except the Lyric Editor**, which
has no `#root` (see the exception note under the Pages table).

| Page | Root component | Source | Interactions & expected result |
|---|---|---|---|
| Find bar | `FinderAppComp` | [find/FinderAppComp.tsx](../../../../src/find/FinderAppComp.tsx) | ⌨️✎ query; readonly `<current>/<total>` counter; 🖱️ prev / next chevrons; 🖱️ `Aa` case toggle; 🖱️ grip drag (x axis); 🖱️ close. ⌨️ `Enter` / `Shift+Enter` step, `Esc` closes. Controls are icon-only — labels live in `title`/`aria-label`. |
| Lyric Editor | **no `…Comp` root** — `OpenLyricDashboard` from the `open-lyric` package, mounted into `[data-ol-ref="app"]` | [lyricEditor.tsx](../../../../src/lyricEditor.tsx) · [lyricEditorBoot.ts](../../../../src/lyricEditorBoot.ts) · opened by `openPopupLyricEditorWindow()` in [lyric-list/lyricEditorHelpers.ts](../../../../src/lyric-list/lyricEditorHelpers.ts) | ⌨️✎ edit lyric text/chords; 🖱️ save; ⌨️ `Ctrl+S` save. Readiness: `#appLoading` settled + `[data-ol-ref="app"]` populated (NO `#root` on this page). |
| Bible Note | `NoteItemEditorPopupComp` | [bible-list/note/NoteItemEditorPopupComp.tsx](../../../../src/bible-list/note/NoteItemEditorPopupComp.tsx) | ⌨️✎ note editor (renders into `#bible-note-root`); 🖱️/⌨️ save. |
| Web Editor | `WebEditorComp` | [background/web/WebEditorComp.tsx](../../../../src/background/web/WebEditorComp.tsx) | ⌨️✎ web URL/title; 🖱️ save → adds a web-background item. |
| About | `AboutComp` | [others/AboutComp.tsx](../../../../src/others/AboutComp.tsx) | 🖱️ version / links (external `bi-box-arrow-up-right`). Mostly read-only. |
| LW Share | `LWShareAppComp` | [lwShare/LWShareAppComp.tsx](../../../../src/lwShare/LWShareAppComp.tsx) | Share view; 🖱️ share controls. |

---

## Cross-cutting components (present on multiple pages)

| Component | Source | Interactions & expected result |
|---|---|---|
| `AppContextMenuComp` | [context-menu/AppContextMenuComp.tsx](../../../../src/context-menu/AppContextMenuComp.tsx) | Opened by 🖱️R on many items. 🖱️ an entry runs its action; ⌨️ `Escape` / click-away closes. |
| `ContextMenuDotsButtonComp` (app-wide `⋮` button, `.app-context-menu-dots`) | [context-menu/ContextMenuDotsButtonComp.tsx](../../../../src/context-menu/ContextMenuDotsButtonComp.tsx) | 🖱️ → opens the SAME menu the host's 🖱️R would — the discoverable route to every context menu (matrix `GL-24`, workflow `W-01b`). |
| `PresentingControlComp` (draw/spotlight overlay + keyboard screencast, `#presenting-control`) | [presenting-control/](../../../../src/presenting-control/) | Mounted on FIVE pages (presenter, reader, appDocumentEditor, bibleNote, setting). Reuses the screen overlay helpers (`PresentingDrawManager` / `PresentingFocusManager`, `ControllerDrawToolsComp` / `ControllerFocusToolsComp`). Workflows `W-19`/`W-20`. |
| `ModalComp` / `AppPopupBibleLookupComp` | [app-modal/ModalComp.tsx](../../../../src/app-modal/ModalComp.tsx) | Close: 🖱️ `button.btn-danger` (`bi bi-x-lg`) or ⌨️ `Ctrl+Q`. |
| `HandleAlertComp` / `ConfirmPopupComp` / `InputPopupComp` / `AlertPopupComp` | [popup-widget/](../../../../src/popup-widget/) | 🖱️ `Ok` / `Cancel`; ⌨️ `Enter` confirms, `Escape` cancels; ⌨️✎ input popups. |
| `ToastComp` | [toast/ToastComp.tsx](../../../../src/toast/ToastComp.tsx) | Auto-dismiss notices, **stacked** top-right in `.app-toast-stack` (oldest first, max 5); 🖱️ `.btn-close` dismisses just that one; 🖐️ hover pauses just its timer. |
| `TopProgressBarComp` | [progress-bar/TopProgressBarComp.tsx](../../../../src/progress-bar/TopProgressBarComp.tsx) | Load indicator (observe, no interaction). |
| `ResizeActorComp` (dividers) | [resize-actor/ResizeActorComp.tsx](../../../../src/resize-actor/ResizeActorComp.tsx) | ⇕ drag a splitter to resize a column/row; double-click may quick-resize. Every multi-pane layout uses this. |

---

## Quick per-page interaction checklist

- **Presenter:** header tabs 🖱️ · `Ctrl+B`/`Ctrl+Q` modal · doc/lyric list 🖱️🖱️ present · expand Background 🖱️ then tab-switch · color swatch (+contrast confirm) · foreground drag⇕drop onto mini-screen · **screen block (mandatory): present → `F5` show → drive `screen.html` target → `F6`–`F10` clears → hide** · lock/display/transition/stage controls on the previewer card · zoom/size 🎚️.
- **Reader:** incremental lookup ⌨️✎ + `Tab`/`Escape` · full ref resolves to verse.
- **Slide Editor:** select doc first · box 🖱️/⇕/resize · `Ctrl+Enter` focus · tools drag⇕drop · background tabs.
- **Settings (popup):** tab 🖱️ · Language `Khmer`/`English` · `Apply Settings` · destructive resets (confirm).
- **Screen (while showing = CDP target):** screenshot layers · `Ctrl/Alt+Arrows` change bible · ❌ `#close` hides; hidden → logs via `all:app:log`.
