# Robot-UNIT-tester sweep — CROSS-CUTTING / GLOBAL

Area: header nav + routing (`src/router/*`), common header buttons
(`src/others/commonButtons.tsx`), modal infra (`src/app-modal/*`), popup widgets
(`src/popup-widget/*`), toast (`src/toast/*`), context menu
(`src/context-menu/*`), progress bar (`src/progress-bar/*`), resize/splitter
infra (`src/resize-actor/*`), drop-import gate (`src/others/droppingFileHelpers.ts`),
responsive layout flip, and the experiment page.

Legend: 🖱️ click · 🖱️🖱️ dbl-click · 🖱️R right-click · ⇕ drag/drop · ⌨️ key ·
🎚️ slider · ⌨️✎ text/number input · 🖐️ hover · pointer-drag (PointerEvents) noted inline.

Statuses: **COVERED** (existing matrix row is accurate) · **REFINE** (row exists
but is vague/wrong — the "Then" says how) · **GAP** (no row exists).

> Source line numbers are from the files as read on 2026-07-17.

---

## A. Header nav tabs (`LayoutTabRenderComp` + `layoutHelpers.genTabs`)

Key source facts: `LayoutTabRenderComp.tsx:24` renders each tab as a **static**
`button.btn.btn-sm.btn-link.nav-link` — there is **no `.active` class logic
anywhere**, and `genTabs` (`layoutHelpers.tsx:87-101`) **omits the current
page's own tab** (presenter page shows Slide-Editor+Reader(+Experiment); it
never shows a Presenter tab). Clicking a tab runs `tab.preCheck?.()` then
`goToPath(routePath)` → sets `globalThis.location.href` (`routeHelpers.tsx:25-37`).

| Proposed ID | Target | Interaction | Keys | Given | When | Then (observable) | Source | Status |
|---|---|---|---|---|---|---|---|---|
| NAV-01 | `Presenter` tab | 🖱️ | — | On reader/editor page (presenter tab only shows off-presenter) | click `.nav-tabs button.nav-link` for Presenter | `location.pathname` → `presenter.html`; page reaches ready. **No `.active` toggles** (button class is static) | LayoutTabRenderComp.tsx:24-29; layoutHelpers.tsx:91-95 | REFINE (drop ".active set"; header never renders current tab nor sets active) |
| NAV-02 | `Bible Reader` tab | 🖱️ | — | presenter/editor page | click Reader tab | `location.pathname` → `reader.html`; reader ready (no `#app-header`) | layoutHelpers.tsx:40-52 | REFINE (drop ".active"; observable = navigation only) |
| NAV-03 | `Slide Editor` tab, **no doc** | 🖱️ | — | presenter page, no OWA doc selected | click Slide-Editor tab text | `preCheck`=`checkIsAppDocumentSelected` fails → `showAppAlert('No slide selected','Please select an Open Worship slide first')` → `#app-alert-popup` appears; `location.pathname` unchanged | LayoutTabRenderComp.tsx:10-17; AppDocument.ts:511-521 | REFINE (name the exact alert + `#app-alert-popup`; not just "alert shown") |
| NAV-04 | `Slide Editor` tab, doc selected | 🖱️ | — | presenter, OWA doc selected | click Slide-Editor tab text | `location.pathname` → `appDocumentEditor.html` | layoutHelpers.tsx:59-83 | COVERED |
| NAV-05 | `(dev)Experiment` tab | 🖱️ | — | dev build, any main page | click Experiment tab | `experiment.html` loads; `#root` renders literal text **"No content"** + a `button.back`; no `img.loading` remains | archived/experiment.tsx:5-16; html/experiment.html:47-48 | REFINE (give concrete observable: "No content" + `.back`) |
| **NAV-12** | Experiment page **Back** button | 🖱️ | — | on `experiment.html` | click `button.back` | native `onclick="history.back()"` → navigates to the previous page (`location` changes) | html/experiment.html:48 | **GAP** |
| **NAV-13** | Slide-Editor tab **external-open icon** (`bi-box-arrow-up-right`) | 🖱️ | — | presenter page, OWA doc selected | click the `<span>` w/ `bi-box-arrow-up-right` **inside** the Slide-Editor tab | `stopPropagation` (no in-window nav) → `openAppDocumentEditorExternal` opens a NEW `appDocumentEditor.html?file=…` **popup window** (new `list_pages` target `app_document_editor_*`) | layoutHelpers.tsx:64-78; AppDocument.ts:523-540 | **GAP** (distinct from ED-10 slide-menu Edit; this is the header-tab icon) |
| NAV-11 | Direct `navigate_page` main routes | — (driver nav) | — | — | navigate reader→editor→presenter | each main-window page reaches ready; never a popup page | routeHelpers.tsx:25-37 | COVERED |

## B. Header buttons (`commonButtons.tsx`)

| Proposed ID | Target | Interaction | Keys | Given | When | Then (observable) | Source | Status |
|---|---|---|---|---|---|---|---|---|
| NAV-06 | `BibleLookupButtonComp` | 🖱️ | — | presenter/editor | click `button.btn-primary` (`bi-book`, "Bible Lookup") | context `setIsShowing(true)` → `#modal-container` renders `BibleLookupPopupComp` | commonButtons.tsx:120-147; AppPopupBibleLookupComp.tsx:4-11 | COVERED |
| NAV-07 | Same, keyboard | ⌨️ | `Ctrl+B` (`Meta+B` mac) | presenter/editor | press Ctrl+B | modal opens (same `#modal-container`) | commonButtons.tsx:83-94,126-128 | COVERED |
| NAV-08 | Lookup button tooltip | 🖐️ | — | presenter/editor | hover the button | `title` = `"Open bible lookup popup [Ctrl + b]"` (shortcut shown) | commonButtons.tsx:137 | COVERED |
| NAV-09 | `SettingButtonComp` (gear) | 🖱️ | — | presenter/editor | click `button.btn-outline-success` (`bi-gear-wide-connected`) | `openSettingPage` → NEW `setting.html` popup target in `list_pages` | commonButtons.tsx:39-53; settingHelpers.ts:8-17 | COVERED |
| NAV-10 | `HelpButtonComp` | 🖱️ / a11y | — | presenter/editor | inspect / click `button.btn-outline-info` (`bi-question-circle`) | opens external `homepage/help#<page>` (EX-04 = don't follow). **A11y name is now `tran('Help')` via `aria-label`+`title`, NOT a raw URL** | commonButtons.tsx:55-77 | REFINE (KB §9 "Help=raw URL" is STALE — now named "Help"; update GL-04 too) |
| **NAV-14** | `QuitCurrentPageComp` (`bi-escape`, "Return to Presenter") | 🖱️ | — | editor entry guard (non-OWA doc) shows it | click `button.btn-outline-warning` | `goToPath(pathname)` navigates back to presenter | commonButtons.tsx:15-37 | **GAP** (used by ED-01 guard; currently untested as a control) |

## C. Modal (`ModalComp` / `AppPopupBibleLookupComp`)

Only the Bible-Lookup modal uses `ModalCloseButton`, and it lives in
`RenderBibleLookupHeaderComp.tsx:95`. **The modal does NOT close on `Escape`** —
only the red button or `Ctrl+Q` (`ModalComp.tsx:16-22`).

| Proposed ID | Target | Interaction | Keys | Given | When | Then (observable) | Source | Status |
|---|---|---|---|---|---|---|---|---|
| GL-07 | `ModalComp` close paths | 🖱️ / ⌨️ | `Ctrl+Q` | lookup modal open | click red `button.btn-danger` (`bi-x-lg`) **or** Ctrl+Q | `#modal-container` empties; modal gone. (Escape does NOT close it) | ModalComp.tsx:21-48; RenderBibleLookupHeaderComp.tsx:95 | COVERED |
| KB-02 | `Ctrl+Q` closes modal | ⌨️ | `Ctrl+Q` | any open modal | press Ctrl+Q | modal closes | ModalComp.tsx:16-22 | COVERED |

## D. Popup widgets (`HandleAlertComp` fan-out: confirm / input / alert)

`HandleAlertComp` mounts three independently-toggled popups. **The three differ
and must be split** — the current GL-08 conflates confirm+alert:
- **Confirm** (`#app-confirm-popup`): Cancel btn + Ok btn (label configurable via
  `confirmButtonLabel`) + header `.btn-close`; `Escape`→cancel (unless
  `escToCancel:false`), `Enter`→Ok (unless `enterToOk:false`).
- **Input** (`#app-input-popup`): arbitrary `body` + Cancel + Ok + header
  `.btn-close`; `Escape`→cancel, `Enter`→Ok.
- **Alert** (`#app-alert-popup`): message only, **NO Ok/Cancel buttons**, dismiss
  ONLY via header `.btn-close` or `Escape`; **no `Enter` handler**.

| Proposed ID | Target | Interaction | Keys | Given | When | Then (observable) | Source | Status |
|---|---|---|---|---|---|---|---|---|
| GL-08 | `ConfirmPopupComp` (confirm) | 🖱️ / ⌨️ | `Enter`/`Escape` | a confirm is triggered (e.g. bg-contrast confirm, a destructive-reset confirm) | click Cancel / click Ok / header X / Enter / Escape | `#app-confirm-popup` present; `onConfirm(true)` on Ok+Enter, `onConfirm(false)` on Cancel+X+Escape; popup closes each way | ConfirmPopupComp.tsx:24-90 | REFINE (enumerate the 5 dismissals + `#app-confirm-popup`; today it's merged with alert) |
| GL-09 | `InputPopupComp` | ⌨️✎ / 🖱️ / ⌨️ | `Enter`/`Escape` | a rename/input flow triggers `showAppInput` | type into `body`; Ok / Cancel / header X / Enter / Escape | `#app-input-popup` present; `onConfirm(true)` applies on Ok+Enter, `false` on Cancel+X+Escape | InputPopupComp.tsx:23-89 | REFINE (add header-X, Enter=Ok, Escape=Cancel, `#app-input-popup`) |
| **GL-16** | `AlertPopupComp` (alert, distinct) | 🖱️ / ⌨️ | `Escape` only | trigger an alert (e.g. NAV-03 "No slide selected") | click header `.btn-close`, or press Escape; also try Enter | `#app-alert-popup` present; **no Ok/Cancel buttons exist**; both `.btn-close` and Escape close via `onClose`; **Enter does nothing** (no handler) | AlertPopupComp.tsx:15-49 | **GAP** (alert has no buttons + no Enter — GL-08 wrongly implies it has Ok/Cancel) |
| KB-12 | `Enter`/`Escape` on confirm/input | ⌨️ | `Enter`/`Escape` | confirm or input popup open | Enter / Escape | confirm / cancel respectively | ConfirmPopupComp.tsx:29-47; InputPopupComp.tsx:28-46 | COVERED |

## E. Toast (`ToastComp` / `SimpleToastComp`)

Three dismiss modes, only one currently in the matrix. Default auto timeout =
4000 ms (`toast.timeout ?? 4e3`, `ToastComp.tsx:46`); hover clears the timer,
leave restarts a **2000 ms** timer.

| Proposed ID | Target | Interaction | Keys | Given | When | Then (observable) | Source | Status |
|---|---|---|---|---|---|---|---|---|
| GL-10 | `ToastComp` auto-dismiss | observe | — | fire a toast (e.g. Audios-off-while-playing, or GL-28 no-folder drop) | wait ~4 s | `.toast.show.fade` (role=alert) appears then auto-removes after `timeout ?? 4000` ms | ToastComp.tsx:44-58; SimpleToastComp.tsx:24-32 | REFINE (state 4 s default + that other dismiss modes exist → GL-17/GL-18) |
| **GL-17** | Toast click-to-dismiss | 🖱️ | — | a toast is showing | click its header `button.btn-close` | `onClose` → `setSimpleToast(null)`; toast disappears immediately (before the timer) | ToastComp.tsx:41-43; SimpleToastComp.tsx:34-41 | **GAP** |
| **GL-18** | Toast hover-pause / leave-restart | 🖐️ | — | a toast is showing | hover over `.toast`, hold, then mouse-out | on `mouseOver` the auto-dismiss timer is cleared (toast persists while hovered); on `mouseOut` a fresh 2000 ms timer starts, then it dismisses | ToastComp.tsx:31-40 | **GAP** |

## F. Context menu (`AppContextMenuComp` + `appContextMenuHelpers`)

Basic open/Escape/click-away is GL-06, but the menu has a full keyboard model +
typeahead + disabled-item + right-click-away that are untested.

| Proposed ID | Target | Interaction | Keys | Given | When | Then (observable) | Source | Status |
|---|---|---|---|---|---|---|---|---|
| GL-06 | `AppContextMenuComp` open + dismiss | 🖱️R + 🖱️/⌨️ | `Escape` | any right-clickable item | 🖱️R → menu; then Escape, click-away, **or right-click-away** | `#app-context-menu-container > .app-context-menu` opens positioned at cursor (edge-flips near right/bottom, capped 210px wide); Escape (registered listener), outer `onClick`, AND outer `onContextMenu` all close it | AppContextMenuComp.tsx:71-112; appContextMenuHelpers.ts:59-104,150-157 | REFINE (add right-click-away close; note kbd-nav/typeahead/disabled are separate rows) |
| **KB-14** | Context-menu keyboard nav | ⌨️ | `ArrowUp`/`ArrowDown`/`Enter`/`Tab` | a context menu is open | press Arrow keys, then Enter (and Tab if `applyOnTab`) | Arrow moves highlight class `.app-border-whiter-round` (wraps); Enter runs the highlighted item's `onSelect` **only while the menu container is `document.activeElement`**; Tab applies when `options.applyOnTab` | appContextMenuHelpers.ts:185-243,329-343 | **GAP** |
| **GL-14** | Context-menu typeahead | ⌨️✎ | letter keys | a context menu is open (no `noKeystroke`) | type a letter | `keydown` `listener` scrolls to the next item whose `textContent` starts with that letter (cycles on repeat) | appContextMenuHelpers.ts:280-300,311-328 | **GAP** |
| **GL-15** | Context-menu disabled item | 🖱️ | — | a menu with a `disabled`/no-`onSelect` item | click the `.app-context-menu-item.disabled` entry | `handleClick` returns early (no `onSelect`) AND `stopPropagation` prevents the outer close → **menu stays open, nothing runs** | AppContextMenuComp.tsx:28-44 | **GAP** |
| **GL-30** | Empty-list drop context menu (`genDroppingFileOnContextMenu`) | 🖱️R | — | a file list with a folder open, right-click empty area | 🖱️R | menu shows `Add Items` and/or `Create New File` (+ list-specific) items via `showAppContextMenu` | droppingFileHelpers.ts:170-227 | **GAP** (shared helper; reachable from Documents/Lyrics/Background lists) |

## G. Progress bar (`TopProgressBarComp`)

| Proposed ID | Target | Interaction | Keys | Given | When | Then (observable) | Source | Status |
|---|---|---|---|---|---|---|---|---|
| GL-11 | `TopProgressBarComp` | observe | — | trigger heavy load (doc open) fires `showProgressBar` | watch | `.app-top-progress-bar` (striped animated bar) appears while a progress key is set, then removed when `hideProgressBar` clears all keys | TopProgressBarComp.tsx:21-35 | COVERED |

## H. Resize splitter infra (`FlexResizeActorComp` / `RenderResizeActorItemComp` / `ResizeActorComp`)

The splitter (`.flex-resize-actor.h|.v`) supports far more than "drag":
double-click = **reset to default flex** (not "quick-resize"), a 3-item
right-click menu, and — when quick-resize enabled — clickable collapse arrows.
Collapsed panes become `.app-hidden-widget` bars that re-expand on click.

| Proposed ID | Target | Interaction | Keys | Given | When | Then (observable) | Source | Status |
|---|---|---|---|---|---|---|---|---|
| GL-12 | Splitter drag + persist | ⇕ (pointer) | — | any multi-pane layout | drag `.flex-resize-actor` | adjacent panes' `flex-grow` styles change live; `checkSize`→`setFlexSizeSetting` persists (survives reload) | FlexResizeActorComp.tsx:171-291; ResizeActorComp.tsx:39-48 | COVERED (drag+persist) |
| GL-12b | Splitter double-click | 🖱️🖱️ | — | multi-pane layout | double-click `.flex-resize-actor` | `resetSize()` clears `flex-grow` and restores each pane to its `data-fs-default` flex | FlexResizeActorComp.tsx:320-328,422 | REFINE (matrix calls this "quick-resize where enabled"; it is a **reset-to-default**, always enabled) |
| **GL-19** | Splitter right-click menu | 🖱️R | — | multi-pane layout | 🖱️R `.flex-resize-actor` | context menu with exactly **`Reset Size`** (→resetSize), **`Close First Widget`** (→close('left')), **`Close Second Widget`** (→close('right')) | FlexResizeActorComp.tsx:330-352,423 | **GAP** |
| **GL-20** | Splitter collapse arrows | 🖱️ | — | quick-resize enabled (arrows rendered) | click a `.disabling-arrow` img (`title`="Disable left/right/up/down") | `close(direction)` collapses that adjacent pane → it gets `HIDDEN_WIDGET_CLASS` and renders as an `.app-hidden-widget` bar | FlexResizeActorComp.tsx:375-395 | **GAP** |
| **GL-21** | Hidden-widget re-expand | 🖱️ | — | a pane is collapsed (`.active-app-hidden-widget` bar, `title`="Enable <name>") | click the collapsed bar | `handleReopening` restores the pane's flex size; bar replaced by the widget (this is the generic mechanism behind PM-26 Background-expand) | RenderResizeActorItemComp.tsx:93-121,165-172; RenderHiddenWidgetTitleComp.tsx:17-38 | **GAP** |
| GL-13 | Responsive H/V flip (`ResizeActorDynamicComp`) | driver `resize_page` | — | a dynamic split (e.g. `BibleReadingLeftComp`) | resize container across `minWidth` | `ResizeObserver` flips between horizontal (`flex h`) and vertical (`flex v`) layouts; nothing overlaps | ResizeActorDynamicComp.tsx:28-78 | COVERED |

## I. Floating widget (`FloatingWidgetComp` — NEW, entirely uncovered)

A reusable draggable/resizable/collapsible floating panel (`src/app-modal/`).
Mounted in 3 places: Presenter **Foreground** tab (`persistKey=floating-widget-rect-foreground`),
the **Bible Properties** panel (`BibleCustomStyleFloatingComp`, portaled to body),
and the **Bible Note** editor popup (`NoteItemEditorPopupComp`). Most reachable
trigger = Presenter Foreground tab. **NOTE for PM agent:** the Foreground tab now
opens THIS floating widget, not a split-view pane — so PM-01's "tab toggles
in/out of split view" is wrong for Foreground.

| Proposed ID | Target | Interaction | Keys | Given | When | Then (observable) | Source | Status |
|---|---|---|---|---|---|---|---|---|
| **GL-22** | Floating widget open | 🖱️ | — | Presenter page | click the `Foreground` tab (`TabRenderComp` key `f`) | a `.floating-widget` element appears (initial rect top:64, right-anchored) hosting `PresenterForegroundComp` | PresenterComp.tsx:127-181; FloatingWidgetComp.tsx:297-345 | **GAP** |
| **GL-23** | Floating widget drag-move + persist | ⇕ (pointer) | — | floating widget open | pointer-drag a blank (non-button) area of `.floating-widget` | `.floating-widget--moving` class during drag; `left/top` inline styles change; on pointer-up the rect is written to the `persistKey` setting (restored next open) | FloatingWidgetComp.tsx:144-259; floatingWidgetHelpers.ts:256-283 | **GAP** |
| **GL-24** | Floating widget resize | ⇕ (pointer) | — | floating widget open | pointer-drag a `.floating-widget__resize-handle--{top,right,bottom,left,4 corners}` | `.floating-widget--resizing` during drag; `width/height` change, clamped to min/max + viewport; persists on pointer-up | FloatingWidgetComp.tsx:333-344; floatingWidgetHelpers.ts:48-57,168-202 | **GAP** (8 handles) |
| **GL-25** | Floating widget collapse/expand | 🖱️ | — | floating widget open | click the chevron `.floating-widget__button` | toggles `.floating-widget--collapsed`; height → 42px (`COLLAPSED_HEIGHT`); icon flips `bi-chevron-down`↔`up`; aria-label flips Collapse↔Expand | FloatingWidgetComp.tsx:263-295,315 | **GAP** |
| **GL-26** | Floating widget close | 🖱️ | — | floating widget open | click the `bi-x-lg` `.floating-widget__button` ("Close floating widget") | `onClose` runs → widget unmounts (`.floating-widget` gone; e.g. Foreground tab de-toggles) | FloatingWidgetComp.tsx:285-293 | **GAP** |

## J. Drop-import gate (`droppingFileHelpers`)

The drag-over mimetype gate and the no-folder toast ARE synthetically testable;
the copy pipeline (`readDroppedFiles`) is NOT (`webkitGetAsEntry()` returns null
for programmatic DataTransfers — CLAUDE.md) → mark that tail BLOCKED.

| Proposed ID | Target | Interaction | Keys | Given | When | Then (observable) | Source | Status |
|---|---|---|---|---|---|---|---|---|
| **GL-27** | Drag-over accept gate | ⇕ (dragover) | — | a list drop zone with a folder open | dispatch `dragover` carrying a `File` item | `genOnDragOver` → `event.target.style.opacity = '0.5'` (accepted look) | droppingFileHelpers.ts:17-34; helpers.ts:282-292 | **GAP** |
| **GL-28** | Drop with no folder open | ⇕ (drop) | — | a list whose `dirSource.dirPath === null` | dispatch `drop` | `genOnDrop` → `showSimpleToast('Open Folder','Please open a folder first')` (pair GL-10); no copy | droppingFileHelpers.ts:105-111 | **GAP** |
| **GL-29** | Drag-leave resets | ⇕ (dragleave) | — | mid drag-over (opacity 0.5) | dispatch `dragleave` | `genOnDragLeave` → `event.target.style.opacity = '1'` | droppingFileHelpers.ts:36-41 | **GAP** |

---

## Notes for the matrix maintainer (accuracy fixes beyond this area)

- **GL-04 / KB §9 stale:** the Help button now exposes `aria-label={tran('Help')}`
  — its accessible name is "Help", not a raw URL. Update the "known: Help=raw URL"
  caveat (commonButtons.tsx:67-76).
- **PM-01 stale:** the Foreground tab opens a `FloatingWidgetComp` (GL-22), not a
  split-view pane — reword PM-01 for the Foreground case.
- Popup widgets stack independently (`HandleAlertComp.tsx:78-84`) — a confirm,
  input, and alert can be on screen simultaneously; a driver should target by the
  specific `#app-*-popup` id, not "the popup".

---

### Summary

Counts (this area): **COVERED 12 · REFINE 10 · GAP 21**

REFINE (existing row needs fixing):
- NAV-01 — presenter tab: no `.active`, navigation-only
- NAV-02 — reader tab: no `.active`, navigation-only
- NAV-03 — no-doc: name `#app-alert-popup` "No slide selected"
- NAV-05 — experiment: observable "No content" + `.back`
- NAV-10 — Help a11y name now "Help", not URL
- GL-08 — confirm: enumerate 5 dismissals, split from alert
- GL-09 — input: add header-X, Enter/Escape, id
- GL-10 — toast: 4s default, other dismiss modes exist
- GL-12b — splitter dbl-click is reset-default, not quick-resize
- GL-06 — context menu: add right-click-away close

GAP (no row exists):
- NAV-12 — experiment Back button history.back
- NAV-13 — Slide-Editor tab external-open icon popup
- NAV-14 — QuitCurrentPageComp return-to-presenter button
- GL-16 — AlertPopupComp: no buttons, Escape-only, no Enter
- GL-17 — toast click-to-dismiss via btn-close
- GL-18 — toast hover-pause, leave-restart 2s
- KB-14 — context-menu Arrow/Enter/Tab keyboard nav
- GL-14 — context-menu letter typeahead scroll
- GL-15 — context-menu disabled item no-op, stays open
- GL-30 — empty-list drop context menu items
- GL-19 — splitter right-click Reset/Close-First/Close-Second
- GL-20 — splitter collapse arrows click-collapse
- GL-21 — hidden-widget bar click re-expand
- GL-22 — floating widget open via Foreground tab
- GL-23 — floating widget drag-move + persist
- GL-24 — floating widget resize 8 handles
- GL-25 — floating widget collapse/expand chevron
- GL-26 — floating widget close button
- GL-27 — drag-over accept gate opacity 0.5
- GL-28 — no-folder drop toast
- GL-29 — drag-leave resets opacity

(Numbering: GL-12b is a REFINE sub-row of GL-12 (double-click); GL-16 fills the
next free GL slot after the existing GL-01..13. New GL GAPs reuse free slots
GL-14..30. Confirm no collision with other agents' proposed GL ids before merge.)
