# OWA Robot Test — Coverage Matrix

The **complete inventory of testable UI units**, each with a stable ID. "Coverage" for
this skill is defined against this file: a run (or a chain of runs) reaches full coverage
when **every in-scope row has been exercised with evidence**. Nothing may be silently
skipped — a row is either exercised (PASS/FAIL), BLOCKED with a stated reason, or
EXCLUDED by the policy table below.

> Derived from [components-path.md](./components-path.md) + a source sweep of `src/`.
> If the app UI changes, update the matrix **and bump `matrixVersion`** (the date below)
> — and check whether the affected [user-workflows.md](./user-workflows.md) recipes
> (each cites matrix rows in its `Verify:` line) need the same update.
> Before a full run, spot-check the matrix against `src/` (new `*Comp.tsx` folders =
> new rows).

**matrixVersion: 2026-07-19** (added **XW** — cross-window propagation, §XW-01..07)

## Mandatory core — screen controlling & presenting (every run)

Screen controlling and presenting is the app's reason to exist, so it is **never
optional**: every run — full-coverage OR focused (e.g. "robot test bible lookup") —
must exercise the **mandatory core** and record its rows in the run state file:

> **SP-01, SP-02, SC-01, SC-02, PR-04, KB-05 (or another clear key)** — present at
> least one real content item, verify it on the mini-screen AND on the `screen.html`
> CDP target while showing, exercise the clear controls, then hide/restore.

A report that lacks evidence for the mandatory core is **incomplete** — say so
explicitly rather than shipping it. The full recipe is test-plan.md §S7.

## How a run uses this matrix

1. This file is the **static inventory** — never write statuses into it.
2. Track statuses in a per-run state file
   `test-results/robot-test/coverage-<runid>.json` (schema in SKILL.md §"Coverage
   accounting"). Update it after every few rows so an interrupted run can resume.
3. Statuses:
   - **PASS** — interaction performed, expected observable confirmed, evidence recorded.
   - **FAIL** — interaction performed, expectation not met → also file a Finding.
   - **PARTIAL** — some interactions of the row done, others not (say which in `note`).
   - **BLOCKED** — could not exercise; `note` must say why (e.g. "no camera device").
   - **EXCLUDED** — matches a policy exclusion (EX-xx); `note` names the EX id.
4. **Evidence rule:** a row only counts as PASS/FAIL with at least one of: a screenshot
   path, an `evaluate_script` assertion result, or a console/network diff. "I clicked it
   and nothing crashed" without a checked observable = PARTIAL at best.
5. **Coverage formula** (goes in the report):

   ```
   in-scope   = total rows − EXCLUDED
   exercised  = PASS + FAIL
   coverage % = exercised / in-scope × 100
   ```

   Target for a full run: **100% of in-scope rows attempted; ≥ 99% exercised**, with
   every BLOCKED/PARTIAL row listed with its reason. Never inflate the number — an
   honest 97% with reasons beats a fake 100%.

## Policy exclusions (EX)

These are out of scope **by policy**, not laziness. They count separately and never
against coverage. Where a "covered-to-the-edge" trick exists, use it — it converts the
row's control to exercisable while excluding only the un-drivable/destructive tail.

| ID | Excluded | Why | Cover to the edge by… |
|---|---|---|---|
| EX-01 | OS-native file dialogs (browse/open/save) | Not drivable via CDP | click the button, confirm the app doesn't crash while the dialog is cancelled by policy — mark the *dialog itself* excluded |
| EX-02 | **Leaving** the user's real display taken over, or OS-fullscreen during a live service | The user may be actively presenting (KB §10) | **Showing the screen is now MANDATORY, not excluded** (SP-01/SC-01): toggle it on briefly, drive the `screen.html` CDP target, then hide + restore. EX-02 applies only to *leaving* it showing, or when the user explicitly said the display is in live use — then assert via mini-screen only and mark the SC rows BLOCKED→EX-02 |
| EX-03 | Camera-dependent rows | Needs hardware; may be absent | if a device exists, exercise; else BLOCKED→EX-03 |
| EX-04 | Following external links (Help, About links) | Opens the user's browser | click-eligibility only: control present, named, enabled |
| EX-05 | Destructive tails: `Clear All Settings`, `Reset All Child Directories`, `Reset Widgets Size`, deleting user documents/lyrics | Destroys user data/state | click → **confirm dialog appears → Cancel** (covers the control + dialog); for delete, create a scratch item first, delete *that* |
| EX-06 | App quit / relaunch flows | Kills the session under test | — |
| EX-07 | Downloading new bible versions | Large network payloads on the user's machine | verify list/search/enable-disable UI; toggle an already-downloaded version and restore |

---

## GL — Cross-cutting (run on every page you visit)

| ID | Target | Interactions | Pass condition |
|---|---|---|---|
| GL-01 | Page readiness | load / after navigation | `#root` has children, no `img.loading` remains |
| GL-02 | Console hygiene | diff after each row | no NEW uncaught errors / rejections / React warnings (KB §7 noise excluded) |
| GL-03 | Network hygiene | diff after each row | no NEW failed app requests (KB §8 noise excluded) |
| GL-04 | A11y snapshot scan | `take_snapshot` per page | interactive nodes have accessible names (Help now exposes accessible name "Help"; fullscreen still unnamed — still report) (src: src/others/commonButtons.tsx:67) |
| GL-05 | Visual scan | screenshot per page/state | no clipped/overlapping/low-contrast/broken visuals |
| GL-06 | `AppContextMenuComp` | 🖱️R an item → menu; `Escape`; click-away; right-click-away | menu opens positioned at cursor (edge-flips near right/bottom, capped 210px wide); Escape, click-away, and right-click-away all close it (src: src/context-menu/appContextMenuHelpers.ts:59) |
| GL-07 | `ModalComp` close paths | red `btn-danger`; `Ctrl+Q` | both close the modal |
| GL-08 | Confirm popups (`#app-confirm-popup`) — alerts are GL-14 | trigger one; `Cancel`/`Ok`/header X; `Enter`/`Escape` | 5 dismissals: Cancel, Ok, header X, `Enter`→Ok, `Escape`→cancel — `onConfirm(true)` on Ok+Enter, `onConfirm(false)` on Cancel+X+Escape (src: src/popup-widget/ConfirmPopupComp.tsx:24) |
| GL-09 | `InputPopupComp` (`#app-input-popup`) | trigger (e.g. rename); type; Ok/Cancel/header X; `Enter`/`Escape` | input applies on Ok/Enter, discards on Cancel/X/Escape (src: src/popup-widget/InputPopupComp.tsx:23) |
| GL-10 | `ToastComp` | trigger (e.g. Audios-off-while-playing) | toast appears, auto-dismisses after 4000ms default (`toast.timeout ?? 4e3`); manual dismiss modes → GL-15 (src: src/toast/ToastComp.tsx:46) |
| GL-11 | `TopProgressBarComp` | observe during heavy load (doc open) | bar shows then clears |
| GL-12 | `ResizeActorComp` splitters (incl. editor canvas↔tools `resizeSettingNames.slideEditor` + canvas↔note) | ⇕ drag each splitter per page; 🖱️🖱️ reset-to-default | panes resize; no layout break; size persists after reload; 🖱️🖱️ runs `resetSize()` (clears `flex-grow`, restores each pane's `data-fs-default`, always enabled) (src: src/resize-actor/FlexResizeActorComp.tsx:320; src/slide-editor/SlideEditorComp.tsx:17) |
| GL-13 | Responsive layout | `resize_page` to ~1024×700 and back | `BibleReadingLeftComp` flips H/V; nothing overlaps at either size |
| GL-14 | `AlertPopupComp` (alert — distinct from confirm/input) | trigger an alert (e.g. NAV-03 "No slide selected"); 🖱️ header `.btn-close`; ⌨️ `Escape`; ⌨️ `Enter` | `#app-alert-popup` renders message only — **NO Ok/Cancel buttons exist**; header `.btn-close` and `Escape` both close via `onClose`; `Enter` does nothing (no handler) — so GL-08's Ok/Cancel wording must NOT be applied to alerts (src: src/popup-widget/AlertPopupComp.tsx:19) |
| GL-15 | `ToastComp` manual dismiss (click-close · hover-pause/leave-restart) — auto-dismiss stays GL-10 | fire a toast; 🖱️ header `button.btn-close`; on a second toast 🖐️ hover then mouse-out | clicking `.btn-close` runs `onClose` → toast disappears immediately (before the 4 s timer); hovering `.toast` clears the auto-dismiss timer so it persists while hovered, and mouse-out starts a fresh **2000 ms** timer after which it dismisses (src: src/toast/ToastComp.tsx:31) |
| GL-16 | `AppContextMenuComp` container mechanics not in GL-06 (letter typeahead · disabled-item) | open any context menu; ⌨️✎ type a letter; 🖱️ a `.app-context-menu-item.disabled` entry | typing a letter scrolls to the next item whose `textContent` starts with it (cycles on repeat); clicking a disabled item runs no `onSelect` and its `stopPropagation` keeps the menu open — nothing happens (src: src/context-menu/appContextMenuHelpers.ts:280) |
| GL-17 | `FlexResizeActorComp` splitter right-click menu (structural — not a data-item menu) | 🖱️R a `.flex-resize-actor` splitter; 🖱️ `Reset Size` | context menu opens with exactly `Reset Size` / `Close First Widget` / `Close Second Widget`; `Reset Size` → `resetSize()` clears the panes' `flex-grow` back to each `data-fs-default` (src: src/resize-actor/FlexResizeActorComp.tsx:330) |
| GL-18 | Splitter collapse arrow → hidden-widget bar → re-expand (generic mechanism behind PM-26) | 🖱️ a `.disabling-arrow` collapse img on a quick-resize splitter; then 🖱️ the collapsed bar | `close(direction)` collapses the adjacent pane → it gets `HIDDEN_WIDGET_CLASS` and renders as an `.app-hidden-widget` bar (`title`="Enable <name>"); clicking the bar runs `handleReopening` and restores the pane's flex size (src: src/resize-actor/FlexResizeActorComp.tsx:375) |
| GL-19 | `FloatingWidgetComp` lifecycle + header buttons (open via Presenter Foreground tab · chevron collapse · X close) | 🖱️ Presenter `Foreground` tab; 🖱️ chevron `.floating-widget__button`; 🖱️ `bi-x-lg` close button | Foreground tab opens a `.floating-widget` (rect top:64, right-anchored) hosting `PresenterForegroundComp` — **NOT a split pane** (PM-01 stale for Foreground); chevron toggles `.floating-widget--collapsed` (height→42px, icon flips `bi-chevron-down`↔`up`, aria Collapse↔Expand); `bi-x-lg` runs `onClose` → widget unmounts and the tab de-toggles (src: src/app-modal/FloatingWidgetComp.tsx:263) |
| GL-20 | `FloatingWidgetComp` pointer manipulation + persistence (drag-move · 8 resize handles) | ⇕ pointer-drag a blank (non-button) area of `.floating-widget`; ⇕ pointer-drag each `.floating-widget__resize-handle--*` (4 edges + 4 corners) | drag adds `.floating-widget--moving` and changes `left/top`; resize adds `.floating-widget--resizing` and changes `width/height`, clamped to min/max + viewport; on pointer-up the rect writes to the `persistKey` setting and is restored on next open (src: src/app-modal/FloatingWidgetComp.tsx:144) |
| GL-21 | External-file drag-over accept gate (`genOnDragOver`/`genOnDragLeave`) — synthetic per CLAUDE.md | ⇕ dispatch `dragover` carrying a `File` item over a list drop zone (folder open); then ⇕ dispatch `dragleave` | `dragover` → `event.target.style.opacity = '0.5'` (accepted look); `dragleave` → `event.target.style.opacity = '1'` (src: src/others/droppingFileHelpers.ts:17) |
| GL-22 | Drop onto a list with no folder open (`dirSource.dirPath === null`) | ⇕ dispatch `drop` on a list whose directory is unset | `genOnDrop` → `showSimpleToast('Open Folder','Please open a folder first')` (pair GL-10 / GL-15); no copy occurs (src: src/others/droppingFileHelpers.ts:105) |

## NAV — App header (`#app-header`: presenter + editor pages)

| ID | Target | Interactions | Pass condition |
|---|---|---|---|
| NAV-01 | `Presenter` tab | 🖱️ | URL → `presenter.html`; no `.active` logic (static `button.btn-link.nav-link`; current page's own tab omitted) (src: src/router/LayoutTabRenderComp.tsx:24) |
| NAV-02 | `Bible Reader` tab | 🖱️ | URL → `reader.html`; page ready (reader has no `#app-header`); no `.active` (src: src/router/layoutHelpers.tsx:40) |
| NAV-03 | `Slide Editor` tab, **no doc** | 🖱️ | `preCheck` (`checkIsAppDocumentSelected`) fails → `showAppAlert('No slide selected', …)` → `#app-alert-popup` appears; `location` unchanged (src: src/router/LayoutTabRenderComp.tsx:10) |
| NAV-04 | `Slide Editor` tab, doc selected | 🖱️ | URL → `appDocumentEditor.html` |
| NAV-05 | `(dev)Experiment` tab | 🖱️ (dev builds) | `#root` renders literal "No content" + a `button.back`; no `img.loading` remains (src: archived/experiment.tsx:5) |
| NAV-06 | `BibleLookupButtonComp` | 🖱️ | lookup modal in `#modal-container` |
| NAV-07 | Same, keyboard | ⌨️ `Ctrl+B` | modal opens |
| NAV-08 | Lookup button tooltip | 🖐️ hover | tooltip shows shortcut |
| NAV-09 | `SettingButtonComp` (gear) | 🖱️ | NEW `setting.html` popup target in `list_pages` |
| NAV-10 | `HelpButtonComp` | presence/name only (EX-04) | control enabled; a11y name is "Help" (`tran('Help')` via aria-label+title — raw-URL caveat is STALE) (src: src/others/commonButtons.tsx:67) |
| NAV-11 | Direct `navigate_page` routes | reader → editor → presenter | each main-window page reaches ready; never a popup page |
| NAV-12 | Reader lookup-header extras (`QuitCurrentPageComp` / `SettingButtonComp` / `HelpButtonComp`) | 🖱️ each (reader page only) | Go-Back navigates to `presenterHomePage`; gear opens a new `setting.html` popup target; Help is external (EX-04, enabled/named only) — the cluster exists only on the reader (no `#app-header`) (src: src/bible-lookup/RenderExtraButtonsRightComp.tsx:100) |
| NAV-13 | "Add New Bible" version-menu entry | 🖱️ the bold "Add New Bible" `bi-journal-arrow-down` item in any bible-version menu | `openBibleSetting()` opens the Bible-tab settings popup target (src: src/bible-lookup/BibleKeySelectionComp.tsx:115) |
| NAV-14 | Experiment page **Back** button (`button.back`) | on `experiment.html`, 🖱️ `button.back` | native `onclick="history.back()"` navigates to the previous page (`location` changes back) (src: html/experiment.html:48) |
| NAV-15 | Slide-Editor tab **external-open icon** (`bi-box-arrow-up-right` inside the tab) — distinct from ED-10 slide-menu Edit | presenter page + OWA doc selected; 🖱️ the `bi-box-arrow-up-right` span inside the Slide-Editor tab | `stopPropagation` (no in-window nav) → `openAppDocumentEditorExternal` opens a NEW `appDocumentEditor.html?file=…` popup window (new `app_document_editor_*` target in `list_pages`) (src: src/router/layoutHelpers.tsx:64) |
| NAV-16 | `QuitCurrentPageComp` (`bi-escape`, "Return to Presenter") — rendered by the editor non-OWA entry guard (ED-01) | on the editor guard, 🖱️ `button.btn-outline-warning` | `goToPath(pathname)` navigates the window back to `presenter.html` (src: src/others/commonButtons.tsx:15) |

## PL — Presenter, left column

| ID | Target | Interactions | Pass condition |
|---|---|---|---|
| PL-01 | Documents list item | 🖱️ | `.active`; slides load; reveals its middle previewer tab (no per-item footer path — only the constant directory `PathSelectorComp`) (src: src/app-document-list/VaryAppDocumentFileComp.tsx:255) |
| PL-02 | Documents item | 🖱️🖱️ | no `onDoubleClick` binding exists — a double-click is just two clicks (2nd is a no-op); opening the editor is the context-menu **Edit↗** path (ED-10) (src: src/others/FileItemHandlerComp.tsx:225) |
| PL-03 | Documents item | 🖱️R | context menu opens (items owned by CM pass). OWA doc: Edit↗ (CM-15) + Print (CM-16) then the shared file tail Copy Path / Reveal / Duplicate / Rename / Reload / Move to Trash (CM-01..06); PDF/PPTX/DOCX rows swap in Preview/Open + Refresh items (CM-17..22) (src: src/app-document-list/VaryAppDocumentFileComp.tsx:93) |
| PL-04 | Documents list | ⇕ drag reorder (no-op assertion) | left-list items are not `draggable` / have no `onDragStart`, so drag does nothing; order comes from `sortFilePaths` / color-note grouping, not user drag (src: src/others/FileItemHandlerComp.tsx:225) |
| PL-05 | PDF document item | 🖱️ (`bi-file-earmark-pdf`) | PDF selects + preview renders |
| PL-06 | Scratch document lifecycle | create new doc → rename (InputPopup) → delete it | all three succeed; list returns to original state |
| PL-07 | Lyrics list item | 🖱️ (`bi-music-note`) | lyric selected; middle switches to Lyrics |
| PL-08 | Lyrics item | 🖱️🖱️ | lyric double-click only selects + reveals the Lyrics previewer; presenting is done from the middle-column verses (PM-11) (src: src/lyric-list/LyricFileComp.tsx:83) |
| PL-09 | Lyrics item | 🖱️R → edit | menu with Edit first (→ **Lyric Editor popup**, PU-02 / CM-25) then the shared file tail (CM-01..06) (src: src/lyric-list/LyricFileComp.tsx:20) |
| PL-10 | Playlists list (dev) | 🖱️ a playlist card header | dev builds only, else BLOCKED; clicking the header **toggles expand/collapse** (`isOpened`; chevron `bi-chevron-down`↔`bi-chevron-right`; `opened-<path>` setting persists) — no select, no reorder (src: src/playlist/PlaylistFileComp.tsx:40) |
| PL-11 | Header **New File** `+` (`FileListHandlerComp`, `bi-file-earmark-plus`, `title="New File"`) | 🖱️ | an inline `AskingNewNameComp` input row appears at top of the `.list-group` (`isCreatingNew=true`) (src: src/others/FileListHandlerComp.tsx:66) |
| PL-12 | `AskingNewNameComp` inline create input | ⌨️✎ invalid chars then 🖱️ apply; ⌨️✎ valid then 🖱️ apply | valid → apply btn `btn-outline-success`; invalid → `btn-outline-danger` + toast "Invalid file name"; on valid apply the input closes and a new `li` appears (src: src/others/AskingNewNameComp.tsx:41) |
| PL-13 | `PathSelectorComp` show/hide toggle | 🖱️ the path row (`.path-previewer`) | chevron flips `bi-chevron-down`↔`bi-chevron-right`; `PathEditorComp` mounts/unmounts; `title` reads "Hide/Show path editor" (src: src/others/PathSelectorComp.tsx:76) |
| PL-14 | Collapsed path-title **Reload** (`RenderPathTitleComp`, `bi-arrow-clockwise`) | 🖱️ | fires `dirSource.fireReloadEvent()` → `LoadingComp` flicker then list re-renders its items (src: src/others/RenderPathTitleComp.tsx:33) |
| PL-15 | Collapsed path-title **Add items** `+` (`bi-plus-lg`, `title="Add items"`) | 🖱️ | Documents → `AppContextMenuComp` opens (Add Items / Download From URL / Open Shared Link); Lyrics → OS file dialog (EX-01, no crash on cancel) (src: src/others/RenderPathTitleComp.tsx:36) |
| PL-16 | Expanded `PathEditorComp` controls | ⌨️✎ dir input; 🖱️ reload; 🖱️ folder-open | input class flips `is-valid`/`is-invalid` per `dirSource.isDirPathValid`; reload (`bi-arrow-clockwise`) re-reads; folder-open (`bi-folder2-open`) opens OS dir picker (EX-01) (src: src/others/PathEditorComp.tsx:52) |
| PL-17 | `PathSelectorComp` path context menu | 🖱️R the path selector | `AppContextMenuComp` opens (Copy to Clipboard / Reveal in File Explorer / Edit Parent Path / Unset Directory Path — items owned by CM pass) (src: src/others/PathSelectorComp.tsx:21) |
| PL-18 | `NoDirSelectedComp` empty state | observe; 🖱️ "Select Default '<folder>'"; 🖱️ "Go to Settings" | card shows "No directory selected"; Select Default runs `selectDefaultDataDirName` → dir set + list populates; Go to Settings (`bi-gear-wide-connected`) opens a new `setting.html` popup target (src: src/others/NoDirSelectedComp.tsx:6) |
| PL-19 | `RenderFailListComp` load-failure state (dir set, list read `null`) | observe; 🖱️ Refresh | alert "Fail to Get File List" renders; Refresh (`bi-arrow-clockwise`) fires `dirSource.fireRefreshEvent()` → re-read attempted (src: src/others/RenderListComp.tsx:53) |
| PL-20 | `FileReadErrorComp` per-item error (`fileData===null`; use a scratch corrupt file) | observe; 🖱️ Reload; 🖱️ Move to Trash | alert "Fail to read file data: <name>"; Reload re-reads the item; Move to Trash removes the `li` (self-clean the scratch file) (src: src/others/FileReadErrorComp.tsx:28) |
| PL-21 | `ItemColorNoteComp` per-item color dot (`bi-record-circle`) | 🖱️ dot → pick a color; 🖱️ dot → No Color | color menu opens; picking a color sets `.color-note.active` and tints the dot; No Color clears it — restore original (src: src/others/ItemColorNoteComp.tsx:15) |
| PL-22 | Color-note grouping (`RenderListComp` `genColorBar`) | set ≥2 items to ≥2 distinct color notes; observe | items render grouped under color bars when the color map has >1 key; a single color = flat list, no bars (src: src/others/RenderListComp.tsx:16) |
| PL-23 | `ScrollingHandlerComp` scroll-to-top (`bi-arrow-up-circle`, `title="Scroll to the top"`) | scroll list down; 🖱️ the to-top affordance | list scrolls back to top (`applyToTheTop`); affordance is low-visibility until hovered (src: src/scrolling/ScrollingHandlerComp.tsx:43) |
| PL-24 | List body empty-area context menu | 🖱️R the empty card body | `AppContextMenuComp` opens with Add Items / Create New File (+ Documents: Download From URL / Open Shared Link — items owned by CM pass) (src: src/others/droppingFileHelpers.ts:182) |
| PL-25 | External-file drag-over accept gate (`FileListHandlerComp` card) | ⇕ dispatch `dragover` carrying `kind:'file'` items over the card; then `dragleave` (synthetic per CLAUDE.md) | card style flips to `opacity:0.5` while over (accepted); `dragleave` restores `opacity:1` (src: src/others/FileListHandlerComp.tsx:170) |
| PL-26 | External-file drop copy-in | ⇕ drop a supported file onto the card; also drop while `dirPath===null` | valid drop copies the file into `dirSource.dirPath` → new `li` appears; no-dir drop pops toast "Please open a folder first" (drop pipeline needs the fiber-controller trick — CLAUDE.md) (src: src/others/droppingFileHelpers.ts:88) |
| PL-27 | Office-file drop → PDF convert (Documents list) | ⇕ drop a `.pptx`/office file onto the Documents list | confirm dialog "Converting to PDF" appears; on OK a progress bar (`WIDGET_TITLE`) shows during conversion; `.docx` is excluded → no-op (src: src/app-document-list/VaryAppDocumentListComp.tsx:70) |
| PL-28 | List header live indicator (`FileListHandlerComp` `checkIsOnScreen`) | present a doc/lyric from that list; observe the list header `<strong>` | header `<strong>` gains `.app-on-screen` while that list's content is live; loses it after Clear (src: src/others/FileListHandlerComp.tsx:220) |
| PL-29 | Playlist item internal drop (dev only; else BLOCKED) | ⇕ drag a slide/bible ref onto a playlist card and drop its DnD `text` data | `playlist.addFromData(receivedData)` runs → a new `PlaylistItem` row renders (bible/slide render; lyric renders "Not Supported Item Type") (src: src/playlist/PlaylistFileComp.tsx:45) |
| PL-30 | Non-OWA document item context-menu trigger (PDF/PPTX/DOCX family, consolidated) | 🖱️R a `.pdf` / `.pptx` / `.docx` item | type-specific `AppContextMenuComp` opens — PDF: Preview PDF / Refresh PDF Images; PPTX: Open PPTX / Refresh PPTX Slides; DOCX: Open DOCX / Refresh DOCX Pages (+ common tail — items owned by CM pass) (src: src/app-document-list/VaryAppDocumentFileComp.tsx:33) |
| PL-31 | Inline rename input surface (`RenderRenamingComp`, via context-menu Rename) | ⌨️✎ edit the pre-filled name → 🖱️ apply / cancel | on apply the file is renamed on disk (`renameTo` + material files + editing-history move) and selection follows the rename; on cancel the item is unchanged (src: src/others/RenderRenamingComp.tsx:21) |
## PM — Presenter, middle column

| ID | Target | Interactions | Pass condition |
|---|---|---|---|
| PM-01 | Presenter tab bar (multi-select) | 🖱️ each of `Documents`/`Lyrics`/`Bibles` | `ResizeActorComp` pane-count changes + `.active` toggles (min 1 tab); Foreground is NOT a split tab — it opens the `FloatingWidgetComp` (PM-37 / GL-19) (src: src/app-document-presenter/PresenterComp.tsx:120) |
| PM-02 | Presenter tab | 🖱️R | solo mode — only that tab remains |
| PM-03 | Live tab marker | observe | live tab has `.app-on-screen` |
| PM-04 | `RenderToggleFullViewComp` | 🖱️ toggle on+off | `.app-full-view` applied/removed (widget-level, not OS) |
| PM-05 | Slide thumbnails | observe | `<iframe srcdoc>` previews render |
| PM-06 | Slide thumb | 🖱️ (single-click toggle) → then Clear Slide | 1st click presents live on mini-screen, 2nd click on the same card clears (F8 also clears) — NOT a dbl-click (src: src/app-document-presenter/items/VarySlideRenderComp.tsx:327) |
| PM-07 | Slide thumb | 🖱️R | menu = Copy / Duplicate / Move forward / Move backward / Enable-Disable / Edit↗ / Show on Screens / Delete (CM-26..32) + Remove Attached Background if a bg is attached (CM-08) + Choose Color `bi-record-circle` (CM-09) (src: src/app-document-presenter/items/VarySlideRenderComp.tsx:274) |
| PM-08 | Thumbnails keyboard | container focused **AND** a slide already live + ⌨️ arrows/`PageUp`/`PageDown`/`Space` | Left/Up/PageUp/Shift+Space = prev, Right/Down/PageDown/Space = next (`Space` is NEXT, not a toggle); disabled slides skipped (src: src/app-document-presenter/items/VarySlidesComp.tsx:52) |
| PM-09 | Thumb size slider (`min=20 max=200`) + zoom-out/zoom-in buttons + `Ctrl`+wheel over the list | 🎚️ / 🖱️ / ⌨️ | thumbnails rescale via any of the three equivalent controls (src: src/app-document-presenter/AppDocumentPreviewerFooterComp.tsx:78) |
| PM-10 | `SlideAutoPlayComp` (Documents footer; mounts only when a slide is selected/live) | 🖱️ `bi-play`↔`bi-pause-circle-fill` toggle; ⌨️✎ `M:` seconds (`min=0`); 🖱️ red `bi-x-lg` collapse | expands; auto-advances; collapses (src: src/app-document-presenter/items/SlideAutoPlayComp.tsx:90) |
| PM-11 | Lyrics tab verses | observe + 🖱️🖱️ a verse | verse renders (iframe); goes live — restore |
| PM-12 | Bibles tab verse | observe + 🖱️🖱️ | looked-up verse shows; goes live — restore |
| PM-13 | `BibleCustomStyleComp` → Appearance (now inside the Bible Properties floating widget, PM-57) | open the floating widget; adjust Font-Size slider (`min=1 max=200`) + Font-Color picker | bible text on preview restyles — restore (src: src/screen-setting/BibleCustomStyleComp.tsx:28) |
| PM-14 | `BibleCustomStyleComp` → Text Shadow (now inside the floating widget, PM-57) | pick a `ScreenBibleTextShadow` option — Reset White / Reset Black + Outline1–4 demo boxes | shadow applies on preview — restore (src: src/screen-setting/ScreenBibleTextShadow.tsx:113) |
| PM-15 | `ForegroundMarqueeBottomComp` | ⌨️✎ text; 🖱️ Show; speed via number input + preset group (PM-75), font size PM-74, Today's-Date PM-73; hide | marquee bottom scrolls; changing speed while showing re-paces the scroll live; hides (src: src/presenter-foreground/ForegroundMarqueeComp.tsx:295) |
| PM-36 | `ForegroundMarqueeTopComp` | ⌨️✎ text; 🖱️ Show; speed via number input + preset group (PM-75), font size PM-74, Today's-Date PM-73; hide | marquee top scrolls; changing speed while showing re-paces the scroll live; hides; coexists with PM-15 (src: src/presenter-foreground/ForegroundMarqueeComp.tsx:295) |
| PM-16 | `ForegroundQuickTextComp` | ⌨️✎ **Markdown** text; 🖱️ Show; hide | Markdown (`renderMarkdown`) overlays after `timeSecondDelay` and auto-expires after `timeSecondToLive` (timing inputs PM-76/PM-77); hides (src: src/presenter-foreground/ForegroundQuickTextComp.tsx:95) |
| PM-17 | `ForegroundCountDownComp` (datetime) | ⌨️✎ date+time; 🖱️ reset; 🖱️ start; hide | countdown live; hides |
| PM-18 | `ForegroundCountDownComp` (duration) | ⌨️✎ h/m; 🖱️ start; hide | countdown live; hides |
| PM-19 | `ForegroundStopwatchComp` | 🖱️ start | stopwatch has **no stop button**; the only stop is Hide/`ShowingScreenIcon` (PR-14), not a toggle (src: src/presenter-foreground/ForegroundStopwatchComp.tsx:80) |
| PM-20 | `ForegroundTimeComp` (clock) | 🖱️ show; multi-instance (Add/Remove clocks) with use-tz button, city picker, label + offset inputs, AM/PM switch — see PM-83..PM-89 | clock shows; format applies (src: src/presenter-foreground/ForegroundTimeComp.tsx) |
| PM-21 | `ForegroundImagesSlideShowComp` | 🖱️ start w/ existing images; `SlideAutoPlayComp` (appears only once an image is selected); (image picking = EX-01) | drives the **background image layer** (via `ScreenBackgroundManager`), not a foreground overlay; slideshow advances; scale-type = PR-08, image-click = PR-09 (src: src/presenter-foreground/ForegroundImagesSlideShowComp.tsx:45) |
| PM-22 | `ForegroundCameraComp` | 🖱️ card-body click (not a select dropdown) with per-device geometry props | live if device; else BLOCKED→EX-03; live preview tile = PR-10 (src: src/presenter-foreground/ForegroundCameraComp.tsx:83) |
| PM-23 | `ForegroundWebComp` | 🖱️ show a `.html` web file (from BACKGROUND_WEB via `FileListHandlerComp`); hide | **no URL input**; drives the foreground web layer; hover-play = PR-11; item/list right-click menus → CM (src: src/presenter-foreground/ForegroundWebComp.tsx:196) |
| PM-24 | `ForegroundCommonPropertiesSettingComp` (umbrella; individual controls = PM-62..PM-72) | adjust the shared props/common panel | live foreground restyles on screen (`onChange1`→`genStyle`) — end-to-end observable only (src: src/presenter-foreground/propertiesSettingHelpers.tsx:581) |
| PM-25 | Foreground Show button extras (umbrella pointer) | 🖱️R (force screen); ⇕ drag → mini-screen | per-widget force-choose = PR-12; drag-to-mini-screen = PR-13; Web's distinct right-click menu → CM (src: src/presenter-foreground/foregroundHelpers.ts:53) |
| PM-26 | `BackgroundComp` collapsed panel | 🖱️ `Background` label → expand; collapse | tab bar exists only after expand (KB §5) |
| PM-27 | Background tab bar | 🖱️ each of `Colors`/`Images`/`Videos`/`Cameras`/`Webs` | single-select switch; live tab gets `*` prefix |
| PM-28 | `RenderAudiosTabComp` | 🖱️ toggle; toggle-off while playing | split toggles; off-while-playing pops toast (GL-10) |
| PM-29 | `BackgroundColorsComp` swatch | 🖱️ a `role=group` swatch; handle contrast confirm | bg color on mini-screen — restore previous bg |
| PM-30 | `BackgroundImagesComp` | 🖱️ single-click toggle an image | bg image live (item = `app-highlight-selected` + `*Images` tab + `.app-on-screen`); a SECOND click on the same item clears — restore (src: src/background/BackgroundMediaItemComp.tsx:92) |
| PM-31 | `BackgroundVideosComp` | 🖱️ single-click toggle a video | bg video live; second click clears — restore (src: src/background/BackgroundVideosComp.tsx:143) |
| PM-32 | `BackgroundCamerasComp` | 🖱️ device | live if device; else BLOCKED→EX-03 |
| PM-33 | `BackgroundWebComp` | 🖱️ item (single-click toggle); 🖱️ `+` | web bg applies; `+` opens a **context menu** (Add URL / New File / Add Items / Open Shared Link), NOT the Web Editor — the Web Editor opens only via a web-FILE item's `Edit` menu (→ PU-04) (src: src/background/BackgroundWebComp.tsx:85) |
| PM-34 | `BackgroundAudiosComp` | 🖱️ item (reveals `AudioBodyComp`); native Play; hide | click first **reveals** the player; native Play lands `.app-on-screen` on the **`♫Audios♫` tab** (not the item); hiding a playing item is refused with a toast; finer controls = PM-109..PM-112 (src: src/background/BackgroundAudiosComp.tsx:78) |
| PM-35 | Background items | 🖱️R | menu = Copy Path (CM-01), Reveal (CM-02), Show on Screens (CM-07), type extras (video Toggle Fading at End CM-49 / color Copy '<color>' CM-48 / web Copy URL CM-50 + Remove URL CM-51), Move to Trash only if not on screen (CM-06) (src: src/background/BackgroundMediaItemComp.tsx:79) |
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
## PR — Presenter, right column

| ID | Target | Interactions | Pass condition |
|---|---|---|---|
| PR-01 | `Bibles`/`Notes` sub-tabs | 🖱️ each | panel switches |
| PR-02 | `BibleListComp` item | 🖱️🖱️ open; 🖱️R menu; version mini-selector (PR-17); Ctrl+🖱️R title editor (PR-18); ⇕ reorder (PR-19) | no single-click select — open is 🖱️🖱️ (`handleOpening`); 🖱️R bible-file menu (if hasItems) = Export to MS Word (CM-58), Empty (CM-59), Copy All Items (CM-60), Move All Items To (CM-61), Remove background if attached (CM-08) + file tail (CM-01..06) (src: src/bible-list/BibleItemRenderComp.tsx:190) |
| PR-03 | `BibleNoteListComp` | 🖱️🖱️ / the `bi-journal` icon to open; edit-title via context menu | **Bible Note popup** target appears; open is 🖱️🖱️ (not single-click); inline title editor = PR-25 (src: src/bible-list/note/BibleNoteItemRenderComp.tsx:171) |
| PR-04 | `MiniScreenComp` | observe across PM rows | preview mirrors every live change |
| PR-05 | Zoom slider (`max=30`) | 🎚️ | preview rescales |
| PR-06 | `MiniScreenClearControlComp` | 🖱️ each clear button | each clears its layer (pair with KB-03..07; enabled-state logic = SP-02) |
| PR-07 | `ShowHideScreen` | 🖱️ toggle on → verify → toggle off (details in SP-01) | screen shows then hides; state restored — **no longer presence-only** |
| PR-08 | Images slideshow Scale-Type button → context menu (src: src/presenter-foreground/ForegroundImagesSlideShowComp.tsx:122) | 🖱️ button (shows current, e.g. "stretch") → 🖱️ option (src: src/presenter-foreground/ForegroundImagesSlideShowComp.tsx:122) | `AppContextMenu` lists `fill/fit/stretch/tile/center/span`; picking updates button label + `images-slide-show-scale-type`, re-applies to the live bg (src: src/presenter-foreground/ForegroundImagesSlideShowComp.tsx:45-52,122-160) |
| PR-09 | Images slideshow image item → show as background (src: src/presenter-foreground/ForegroundImagesSlideShowComp.tsx:203) | 🖱️ an image thumbnail (src: src/presenter-foreground/ForegroundImagesSlideShowComp.tsx:203) | image becomes the background on the selected screen (`handleBackgroundSelecting('image')`); item shows `RenderBackgroundScreenIds`; header flips `.app-on-screen` — restore (src: src/presenter-foreground/ForegroundImagesSlideShowComp.tsx:257-262) |
| PR-10 | `ForegroundCameraComp` live preview tile (EX-03 if no device) (src: src/presenter-foreground/ForegroundCameraComp.tsx:36) | 🖐️/observe card body (src: src/presenter-foreground/ForegroundCameraComp.tsx:36) | local `getCameraAndShowMedia` stream renders in the tile (`LoadingComp` until ready) — presence/render check; BLOCKED→EX-03 if no device (src: src/presenter-foreground/ForegroundCameraComp.tsx:36-45) |
| PR-11 | `ForegroundWebComp` item hover-to-play preview (src: src/presenter-foreground/ForegroundWebComp.tsx:182) | 🖐️ `onMouseOver` then leave `onMouseOut` (src: src/presenter-foreground/ForegroundWebComp.tsx:182) | on hover `RenderBackgroundWebIframeComp` mounts (live iframe plays); on leave reverts to the static `BackgroundWebPlaceHolderComp` capture (src: src/presenter-foreground/ForegroundWebComp.tsx:182-223) |
| PR-12 | Show/Start button right-click = force-choose (marquee×2, quick-text, countdown×2, stopwatch, time) (src: src/presenter-foreground/ForegroundMarqueeComp.tsx:366) | 🖱️R the Show/Start button, ≥1 screen (src: src/presenter-foreground/ForegroundMarqueeComp.tsx:366) | presents with `isForceChoosing=true` → the screen-chooser is forced (menu of screens even with one screen); selecting a screen sets that widget's data (header `.app-on-screen`) (src: src/presenter-foreground/ForegroundCountDownComp.tsx:92-96,212-216) |
| PR-13 | Show/Start button drag → mini-screen previewer drop (pair SP-12) (src: src/presenter-foreground/ForegroundMarqueeComp.tsx:422) | ⇕ drag the Show/Start button onto a previewer card, drop (src: src/presenter-foreground/ForegroundMarqueeComp.tsx:422) | card highlights on dragover (RECEIVING_DROP); on drop `dragStore.onDropped` fires `config.setData`/`add*Data` on THAT screen only; header `.app-on-screen` (src: src/presenter-foreground/foregroundHelpers.ts:53-65) |
| PR-14 | `ScreensRendererComp` Hide-via-screen-icon (per screen) (src: src/presenter-foreground/ScreensRendererComp.tsx:23) | 🖱️ "Hide X" button / `ShowingScreenIcon` (body or collapsed-header mini) (src: src/presenter-foreground/ScreensRendererComp.tsx:23) | that screen's widget datum cleared (`set*Data(null)`/`remove*Data`); header loses `.app-on-screen`; the Hide button/icon for that screen disappears; multi-clock/camera/web remove only the clicked instance (src: src/presenter-foreground/ScreensRendererComp.tsx:23-46) |
| PR-15 | `BibleFileComp` accordion | 🖱️ the bible-file-row header | expands/collapses (`bi-chevron-down`↔`-right`, `bi-book`↔`-fill`); a live file gets `.app-on-screen` (src: src/bible-list/BibleFileComp.tsx:114) |
| PR-16 | `BibleFileComp` drop target | ⇕ drop a bible item / a background onto the file row | a bible item is saved/moved into the file; a background instead attaches to it (src: src/bible-list/BibleFileComp.tsx:204) |
| PR-17 | `BibleItemRenderComp` version mini-selector | 🖱️ its `BibleKeySelectionMiniComp` (isMinimal) | version menu opens; picking saves the new `bibleKey` into the file (src: src/bible-list/BibleItemRenderComp.tsx:228) |
| PR-18 | `BibleItemRenderComp` Ctrl+right-click title editor | Ctrl+🖱️R book / chapter / verse span | chained target-picker menus (`withCtrl`) open and each pick saves the new target back to the file (src: src/bible-list/BibleItemRenderComp.tsx:251) |
| PR-19 | `BibleItemRenderComp` drag reorder | ⇕ drag an item over another (≥2 items) | dragover sets opacity 0.5; drop reorders within the bible file and saves (src: src/bible-list/BibleItemRenderComp.tsx:147) |
| PR-20 | `RenderBibleItemsComp` Add-Bible-Item | 🖱️ "Add Bible Item" `bi-book` (default bible open) | opens the Bible Lookup popup (src: src/bible-list/RenderBibleItemsComp.tsx:46) |
| PR-21 | `BibleListComp` new-file (`FileListHandlerComp`) | 🖱️ list new/`+` → ⌨️✎ name it | `Bible.create` adds a new bible file to the list (src: src/bible-list/BibleListComp.tsx:47) |
| PR-22 | `NoteFileComp` accordion | 🖱️ the note-file header | expands/collapses (`bi-chevron`/`bi-book` icons swap) (src: src/bible-list/note/NoteFileComp.tsx:121) |
| PR-23 | `NoteFileComp` add-item `+` | 🖱️ green `bi-plus` (file expanded) | `createNewNoteItem` appends a blank note item to the file (src: src/bible-list/note/NoteFileComp.tsx:145) |
| PR-24 | `NoteFileComp` drop target | ⇕ drop a note item / background onto the note file | a note item is added/moved; a background instead attaches (src: src/bible-list/note/NoteFileComp.tsx:219) |
| PR-25 | `NoteTitleEditorComp` inline edit (via "Edit Title") | ⌨️✎ type; blur (Enter/Escape owned by KB) | inline `SimpleNoteEditorComp` appears; blur commits + closes; empty shows "No title" (src: src/bible-list/note/BibleNoteItemRenderComp.tsx:195; src/bible-list/note/NoteEditorComp.tsx:33) |
| PR-26 | `BibleNoteItemRenderComp` drag reorder | ⇕ drag a note item over another (≥2) | reorders within the note file and saves (src: src/bible-list/note/BibleNoteItemRenderComp.tsx:147) |

## RD — `reader.html` (Bible Reader)

| ID | Target | Interactions | Pass condition |
|---|---|---|---|
| RD-01 | Page identity | load | ready with NO `#app-header` |
| RD-02 | Incremental picker | ⌨️✎ char-by-char book → 🖱️ book → chapter → verse options | each step narrows; verse renders |
| RD-03 | Full reference | ⌨️✎ `John 3:16` char-by-char | resolves to the exact verse (reader page does; modal doesn't — KB §5) |
| RD-04 | Picker keyboard | ⌨️ `Tab` complete chunk; `Escape` drop last chunk; `Ctrl+Escape` clear ALL | mapping is `Escape`→`removeInputTextChunk`, `Ctrl+Escape`→`removeInputText` (icon titles "Clear input chunk [Escape]" / "Clear input [Ctrl+Escape]") (src: src/bible-lookup/InputExtraButtonsComp.tsx:125) |
| RD-05 | `InputExtraButtonsComp` | 🖱️ clear-input / clear-chunk / tab-complete buttons | same effects as keys |
| RD-06 | `BibleLookupInputHistoryComp` | 🖱️🖱️ a history entry (plus Shift-🖱️🖱️ split, ⇕ drag, 🖱️R menu, inline red `bi-x` per chip) | 🖱️🖱️ (`openInBibleLookup`) re-runs that lookup (src: src/bible-lookup/BibleLookupInputHistoryComp.tsx:173) |
| RD-07 | `BibleLookupBodyPreviewerComp` | 🖱️🖱️ verse | verse presented — restore |
| RD-08 | Advance lookup toggle (`RenderExtraButtonsRightComp`) | 🖱️ toggle | **Bible Find** split (`Bible Online Lookup` widget) opens/closes |
| RD-09 | `BibleFindPreviewerComp` | ⌨️✎ find text; observe `BibleFindRenderPerPageComp`; 🖱️ `RenderPageNumberComp` pages | results render; pagination switches pages; sub-controls (find refresh, suggestion menu, book filter, reset-data, Find/Cross-Reference tab switch, found-item drag/menu) now RD-41..RD-48 (src: src/bible-find/BibleFindHeaderComp.tsx:53) |
| RD-10 | Cross-references (`bible-cross-refs`) | open cross-ref view for a verse | found items render; AI variants BLOCKED if no API key; card collapse/refresh, per-item click/append/drag, mini version selector + title editor, S/FN/★/T badges now RD-49..RD-52 (src: src/bible-cross-refs/BibleCrossRefRendererComp.tsx:93) |
| RD-11 | Bible-key selector (`RenderBibleLookupHeaderComp`) | 🖱️ the bible-key badge → pick a version | menu of per-locale headers (disabled) + (KEY) Title version options (current excluded) + bold "Add New Bible" (opens Bible setting, NAV-13) — CM-84; picking a version re-renders the verse (src: src/bible-lookup/BibleKeySelectionComp.tsx:18) |
| RD-12 | Bibles + Notes lists on reader | as PR-02/03 | same behavior outside presenter |
| RD-13 | `RenderBookOptionsComp` unavailable book | 🖐️ / observe a book absent in this version | that book's `<button>` carries `disabled` + `title="Not available"` + `cursor:not-allowed`, and arrow-nav skips it (src: src/bible-lookup/RenderBookOptionsComp.tsx:76) |
| RD-14 | `RenderChapterOptionsComp` chapter-zero intro | 🖱️ the `bi-info-circle` on an intro (chapter 0) book | `RenderChapterZeroContentComp` intro card expands; re-click collapses it (src: src/bible-lookup/RenderChapterOptionsComp.tsx:51) |
| RD-15 | `RenderVerseNumOptionComp` range select | 🖱️ verse A ⇕ to verse B (or Shift-🖱️ B) | selection spans A→B (`.selected-start`/`.selected`/`.selected-end`); mouseup fires `applyTargetOrBibleKey` (src: src/bible-lookup/RenderVerseNumOptionComp.tsx:49) |
| RD-16 | `RenderVerseOptionsComp` show-all-verses | 🖱️ `bi-arrows-expand-vertical` (title "Show all verses"), a partial range selected | target resets to verseStart 1 … chapter length (whole chapter renders) (src: src/bible-lookup/RenderVerseOptionsComp.tsx:231) |
| RD-17 | `InputHandlerComp` prev/next chapter carets | 🖱️ `[data-previous-chapter-button]` / `[data-next-chapter-button]` | `tryJumpingChapter(false/true)` loads the previous/next chapter into the view (src: src/bible-lookup/InputHandlerComp.tsx:147) |
| RD-18 | `InputExtraButtonsComp` empty-state | observe input empty vs text present | while empty the clear-input & clear-chunk icons carry inline `opacity:0.5; pointer-events:none`; both become solid/clickable once text is present (src: src/bible-lookup/InputExtraButtonsComp.tsx:79) |
| RD-19 | `BibleKeySelectionMiniComp` + extra-key chips | 🖱️ pill (swap) · 🖱️R (add extra) · 🖱️ chip red `bi-x` (remove extra) | 🖱️ replaces `bibleKey` and re-renders; 🖱️R "Add Extra Bible" appends to `extraBibleKeys` (parallel column appears); chip `bi-x` removes that extra key (src: src/bible-lookup/BibleKeySelectionComp.tsx:188; src/bible-reader/view-extra/RenderTitleMaterialComp.tsx:14) |
| RD-20 | `RenderOpenWikiDictionaryComp` (`bi-journal-text`) | 🖱️ (title "Wiki Dictionary") | context menu opens — disabled header, English, target-locale lang, divider, then every wiktionary lang; each entry → `openExternalURL(<lang>.wiktionary.org)` (following = EX-04) (src: src/bible-lookup/RenderOpenWikiDictionaryComp.tsx:70) |
| RD-21 | `AIConfigComp`→`AISettingComp` (`bi-robot`) | 🖱️ the robot icon | "Audio AI Setting" input popup opens with OpenAI + Anthropic key inputs and external "API Key" buttons; the icon turns green once a key is saved (src: src/bible-reader/AIConfigComp.tsx:124) |
| RD-22 | `AIConfigComp`→`AudioAutoPlayComp` (`bi-megaphone`) | 🖱️ the megaphone (needs an OpenAI key) | `isAutoPlay` toggles (icon green when on); the control is hidden entirely when no OpenAI key is set (src: src/bible-reader/AIConfigComp.tsx:141) |
| RD-23 | `RenderExportWordComp` (`bi-file-earmark-word`) | 🖱️ (title "Export to MS Word"), ≥1 looked-up item | `getBibleItemsForExportingMSWord`→`exportToWordDocument` runs; the OS save dialog is EX-01 and the app does not crash when it is cancelled (src: src/bible-lookup/RenderExportWordComp.tsx:15) |
| RD-24 | `RenderExtraButtonsRightComp` Keep-Open | 🖱️ the checkbox/label (presenter/editor modal only) | toggling flips the `close-on-add-bible-item` setting and the checkbox `checked` state; the control is absent on the reader page (src: src/bible-lookup/RenderExtraButtonsRightComp.tsx:78) |
| RD-25 | `RenderEditingActionButtonsComp` / `RenderActionButtonsComp` (click paths) | 🖱️ each of Copy · Split-H `bi-vr` · Split-V `bi-hr` · Save `bi-floppy` · Save+Show `bi-cast` · Insert `bi-file-earmark-slides` · Export | each button fires its action — Copy→copy menu, Split-H→`addBibleItemLeft`, Split-V→`addBibleItemBottom`, Save→`saveBibleItem`, Save+Show→present, Insert→canvas insert (editor), Export→Word (keyboard equivalents owned by KB) (src: src/bible-lookup/RenderEditingActionButtonsComp.tsx:28; src/bible-lookup/RenderActionButtonsComp.tsx:29) |
| RD-26 | `RenderBodyComp`/`RenderBodyEditingComp` edit pencil | 🖱️ green `bi-pencil` (or editing `bi-pencil-fill`) | `editBibleItem` switches which lookup item is in edit mode / focuses the input (Escape-to-input owned by KB) (src: src/bible-lookup/BibleLookupBodyPreviewerComp.tsx:95) |
| RD-27 | `RenderBibleEditingHeader` close | 🖱️ red `bi-x-lg` (title "Close [key]"), ≥2 items | `closeCurrentEditingBibleItem` removes that editing section (src: src/bible-lookup/RenderBibleEditingHeader.tsx:66) |
| RD-28 | `BibleViewComp` / `NoBibleViewAvailableComp` drop | ⇕ drop a bible item onto the card / empty view | dragover toggles the dragging/`RECEIVING_DROP_CLASSNAME`; `applyDropped` adds the item; an empty view shows the "No Bible Available" placeholder that also accepts drops (src: src/bible-reader/BibleViewComp.tsx:155; src/bible-reader/NoBibleViewAvailableComp.tsx:10) |
| RD-29 | `RenderTitleMaterialComp`→`ItemColorNoteComp` | 🖱️ the color-note dot → pick a color | the chosen color note applies to the item (synced views group under the color) (src: src/bible-reader/view-extra/RenderTitleMaterialComp.tsx:80) |
| RD-30 | `AudioAIEnablingComp` (`bi-soundwave`) | 🖱️ the soundwave icon | `isAudioEnabled` flips (icon green) and per-verse audio players appear (src: src/bible-reader/AudioAIEnablingComp.tsx:8) |
| RD-31 | `BibleViewRenderHeaderComp` delete | 🖱️ red `bi-x-lg` on a non-editing view | `deleteBibleItem` removes that bible view (src: src/bible-reader/view-extra/BibleViewRenderHeaderComp.tsx:59) |
| RD-32 | `BibleViewTitleWrapperComp` draggable title | ⇕ drag the `.title` span | drag serializes `BIBLE_ITEM_TARGET_ONLY`; parent `data-do-not-allow-drop` toggles for the drag duration (src: src/bible-reader/view-extra/BibleViewTitleWrapperComp.tsx:35) |
| RD-33 | `BibleViewTitleEditorComp` title target editor | 🖱️R book / chapter / verse-start / verse-end span | chained menus Book→Chapter→Verse-Start→Verse-End; each pick calls `applyTarget`, re-rendering the verse (`withCtrl` variant requires Ctrl held) (src: src/bible-reader/BibleViewTitleEditorComp.tsx:117) |
| RD-34 | verse-number / verse-text / rest-number selection | 🖱️🖱️ `.verse-number` · 🖱️ (Alt-🖱️ extend) `.verse-text` · 🖱️🖱️ rest `.verse-number` | dbl-click a number sets that single verse (verseStart=verseEnd=N); click/alt-click text toggles/extends the on-screen selection; dbl-click a greyed rest number extends start/end to it (src: src/bible-reader/view-extra/RenderVerseTextComp.tsx:28; src/bible-reader/view-extra/RenderVerseTextDetailComp.tsx:83; src/bible-reader/view-extra/RenderRestVerseNumListComp.tsx:53) |
| RD-35 | `BibleViewSettingComp` font slider | 🎚️ `#preview-fon-size` (min5/max150/step2); Ctrl+Scroll on body | the `Npx` badge updates and bible text rescales live (src: src/bible-reader/BibleViewSettingComp.tsx:16) |
| RD-36 | `NewLineSettingComp` | 🖱️ "Should New Lines" `bi-arrow-return-left`; then "model new line" `bi-file-text` | first toggle flips `shouldNewLine` (verses re-wrap); the second is `disabled`/opacity 0.5 until the first is on, then toggles `shouldModelNewLine` (src: src/bible-reader/NewLineSettingComp.tsx:48) |
| RD-37 | `BibleModelInfoSettingComp` | 🖱️ the `bi-book` + model button | a context menu of models (`key - (title)`, current disabled) opens — assert the menu only, since picking one calls `setBibleModelInfoSetting` then `appProvider.reload()` (whole-app reload) (src: src/bible-reader/BibleModelInfoSettingComp.tsx:15) |
| RD-38 | `FullScreenButtonComp` | 🖱️ "Full" `bi-arrows-fullscreen` | `requestFullscreen`; label→"Exit Full", icon→`bi-fullscreen-exit`; on error toast "Toggle full screen failed" — restore after (src: src/bible-reader/FullScreenButtonComp.tsx:3) |
| RD-39 | `ButtonAddMoreBibleComp` | 🖱️ "Add Item" `bi-plus` | `showBibleKeyOption` menu opens; picking adds a parallel-version item; the button is `disabled` when the item list is empty (src: src/bible-reader/ButtonAddMoreBibleComp.tsx:7) |
| RD-40 | `AudioPlayerComp` verse audio | 🖱️ play/pause `<audio.verse-audio controls>`; 🖱️R | playing pauses sibling `<audio>`s (auto-plays on reader when `isAutoPlay`); 🖱️R menu is a single "Refresh" (`refreshAudio`) (src: src/bible-reader/view-extra/AudioPlayerComp.tsx:11) |
| RD-41 | `BibleFindPreviewerComp` tab bar | 🖱️ "Find" (s) / "Cross Reference" (c) | `TabRenderComp` switches the active tab and the `bible-search-tab` setting persists across the switch (src: src/bible-find/BibleFindPreviewerComp.tsx:21) |
| RD-42 | `BibleFindHeaderComp` refresh | 🖱️ `bi-arrow-clockwise`, a query entered | forces a fresh find — results reload for the current query (src: src/bible-find/BibleFindHeaderComp.tsx:100) |
| RD-43 | `BibleFindBodyComp` version selector | 🖱️ its `BibleKeySelectionComp` | choosing a version re-scopes the find (controller re-instantiates) and results re-render in that version (src: src/bible-find/BibleFindBodyComp.tsx:79) |
| RD-44 | `BibleFindController` suggestion menu | ⌨️✎ a partial word (offline/XML bible) | an `AppContextMenu` suggestion list appears below the input (`checkLookupWord`); Tab applies the top suggestion, Enter closes it (src: src/bible-find/BibleFindController.tsx:520; src/bible-find/BibleFindHeaderComp.tsx:53) |
| RD-45 | `RenderFindingInfoHeaderComp` book filter | 🖱️ / Shift-🖱️ the "All Books"/selected-books button | menu lists All Books / OT header+books / NT header+books; 🖱️ picks one, Shift-🖱️ multi-selects; unavailable/only-selected entries disabled; button label updates to the selection (src: src/bible-find/RenderFindingInfoHeaderComp.tsx:40) |
| RD-46 | `RenderFindingInfoHeaderComp` extra-actions | 🖱️ the `bi-three-dots-vertical` button | menu shows red "Reset Search Data" (→ confirm → `resetSearchingDatabase` + reload) and "Reset Selected Books" (disabled if none); take the confirm to **Cancel** (EX-05) (src: src/bible-find/RenderFindingInfoHeaderComp.tsx:111) |
| RD-47 | `BibleFindRenderDataComp` / `BibleFindBodyPreviewerComp` states | observe (no query / no results / controller fail) | empty query → "No data available"; loading → `ShowFindingComp` spinner; controller fail → "Fail to get find controller!" with a Reload button (src: src/bible-find/BibleFindRenderDataComp.tsx:74; src/bible-find/BibleFindBodyPreviewerComp.tsx:46) |
| RD-48 | `RenderFoundItemComp` found item | 🖱️ / Shift-🖱️ / ⇕ (🖱️R menu = CM) | 🖱️ `openInBibleLookup` loads the result (Shift/force appends a parallel item); dragging serializes a `BibleItem` (src: src/bible-find/RenderFoundItemComp.tsx:33) |
| RD-49 | `BibleCrossRefWrapperComp` card | 🖱️ header (toggle) / 🖱️R header | 🖱️ collapses/expands the card (`bi-chevron-down`↔`-right`, `show-*-bible-ref` setting); 🖱️R while open shows a single "Refresh" → re-fetch (src: src/bible-cross-refs/BibleCrossRefWrapperComp.tsx:26) |
| RD-50 | `BibleCrossRefRendererComp` header controls | 🖱️ mini version selector / 🖱️R verse-title parts | version swap re-renders the cross-ref list; 🖱️R title editor changes the reference verse (`isOneVerse`, `waitUntilGotVerseStart`) (src: src/bible-cross-refs/BibleCrossRefRendererComp.tsx:111) |
| RD-51 | `BibleCrossRefRenderFoundItemsComp` / `BibleCrossRefAIRenderFoundItemComp` | 🖱️ / Shift-🖱️ / ⇕ a regular or AI cross-ref item | 🖱️ loads the item (Shift/force appends), drag serializes a `BibleItem`; S/FN/★/T/LXXDSS badges render; on error "Fail to get data for" shows (🖱️R menu = CM) (src: src/bible-cross-refs/BibleCrossRefRenderFoundItemsComp.tsx:44; src/bible-cross-refs/BibleCrossRefAIRenderFoundItemComp.tsx:59) |
| RD-52 | AI-vigilant / Google-translate lightbulbs | 🖱️ the `bi-lightbulb` in an AI cross-ref card title | opens `openExternalURL(.../ai-vigilant)` or `.../google-translate-vigilant` (following = EX-04; assert eligibility only) (src: src/bible-cross-refs/BibleCrossRefRendererComp.tsx:46; src/bible-cross-refs/RenderAIBibleCrossReferenceComp.tsx:9) |

## ED — `appDocumentEditor.html` (Slide/Doc Editor)

| ID | Target | Interactions | Pass condition |
|---|---|---|---|
| ED-01 | Entry guard | load with OWA doc / with non-OWA doc | editor loads / "Return to Presenter" popup |
| ED-02 | Slide list | 🖱️ select-to-edit (single-click-to-edit) | slide loads into canvas — single click selects+edits (the "🖱️🖱️ open" wording is presenter behavior, wrong for the editor) (src: src/app-document-presenter/items/VarySlideRenderWrapperComp.tsx:34) |
| ED-03 | Slide list | 🖱️R → duplicate, then delete the duplicate | self-cleaning add/delete both work; menu = same item set as PM-07 (CM-26..32) but Edit selects the slide in-editor; Copy/Duplicate/Delete carry Ctrl / Ctrl+Shift / Delete labels; ≥2 held slides show the reduced Copy/Duplicate/Delete set (ED-13 = CM-26/27/32) (src: src/app-document-list/appDocumentHelpers.tsx:138) |
| ED-04 | Slide list | ⇕ reorder | order persists |
| ED-05 | `CanvasContainerComp` | 🖱️ select box; ⇕ move; drag handle resize; (rotate handle = ED-29) | box moves/resizes; selection outline; pointer rotate is split out as ED-29 (src: src/slide-editor/BoxEditorController.ts:666) |
| ED-06 | Multi-select | `Shift`/`Ctrl` + 🖱️ | multiple boxes selected; Shift/Ctrl-clicking an already-selected box REMOVES it (toggle-off) (src: src/slide-editor/canvas/box/BoxEditorControllingModeComp.tsx:57) |
| ED-07 | Text edit mode | 🖱️🖱️ text box; ⌨️✎ type; click-away | text persists on the slide |
| ED-08 | ⌨️ `Ctrl+Enter` | press | canvas focused |
| ED-09 | `ToolCanvasItemsComp` | 🖱️ a preview card to select (ED-36) | it is a per-item preview/**select** list (ED-36), NOT an add-box/drag-tool source; add-box is the canvas context menu (CM) "New" and insert-image is Insert Medias (CM) / file drop (src: src/slide-editor/canvas/tools/ToolCanvasItemsComp.tsx:17) |
| ED-10 | Presenter slide **Edit ↗** (`openAppDocumentEditorExternal`) | 🖱️ slide context menu → **Edit** (`bi-box-arrow-up-right`) | app document editor opens in its own window, focused on that slide (`?file=…&id=…`) |
| ED-11 | ⌨️ `Ctrl+S` | after an edit | saved (dirty indicator clears / no data-loss on reload) |
| ED-12 | Bottom `BackgroundComp` | expand + tab switch | same as PM-26/27 in editor context |
| ED-13 | `SlideEditorGroundComp` entry/empty state (src: src/slide-editor/SlideEditorGroundComp.tsx:10) | observe: editor mounted but no slide selected for editing (`selectedSlideEditing` null) (src: src/slide-editor/SlideEditorGroundComp.tsx:10) | renders the "No slide selected" placeholder with NO canvas/tool panel mounted; picking a slide swaps it to the canvas (src: src/slide-editor/SlideEditorGroundComp.tsx:10-13) |
| ED-14 | `SlideEditorToolsComp` tab bar — Properties / Canvas Items (src: src/slide-editor/canvas/tools/SlideEditorToolsComp.tsx:47) | 🖱️ each tab (src: src/slide-editor/canvas/tools/SlideEditorToolsComp.tsx:48-57) | active tab highlights; body swaps `SlideEditorPropertiesComp` ↔ `ToolCanvasItemsComp`; choice persists across reload (`editor-tools-tab`) (src: src/slide-editor/canvas/tools/SlideEditorToolsComp.tsx:37-70) |
| ED-15 | Tool-panel collapsible section headers (slide header, item-props card, Box/Text Properties titles) (src: src/slide-editor/canvas/tools/SlideEditorToolTitleComp.tsx:30) | 🖱️ a section header / chevron (src: src/slide-editor/canvas/tools/useExpandToggle.tsx:36-45) | body shows/hides; chevron flips `bi-chevron-down`↔`bi-chevron-right`; expand state persists (`slide-property-editor`/`canvas-item-props-editor`) (src: src/slide-editor/canvas/tools/SlidePropertyEditorComp.tsx:250-267; src/slide-editor/canvas/tools/CanvasItemPropsEditorComp.tsx:96-110) |
| ED-16 | Slide name input + Apply (`SlidePropertyEditorComp`) (src: src/slide-editor/canvas/tools/SlidePropertyEditorComp.tsx:199) | ⌨️✎ type a new name → 🖱️ Apply (src: src/slide-editor/canvas/tools/SlidePropertyEditorComp.tsx:199-237) | Apply button appears only while the name differs; clicking it renames the slide (`updateSlide`) and the button clears (src: src/slide-editor/canvas/tools/SlidePropertyEditorComp.tsx:199-237) |
| ED-17 | Slide dimension controls — Width/Height + Apply / Reset / Apply All Slides (src: src/slide-editor/canvas/tools/SlidePropertyEditorComp.tsx:51) | ⌨️✎ Width/Height; 🖱️ Apply; 🖱️ Reset; 🖱️ Apply All Slides → confirm "Yes" (src: src/slide-editor/canvas/tools/SlidePropertyEditorComp.tsx:114-190) | Apply/Reset show only when dim differs; Apply → this slide re-sizes (`changeSlidesDimension`); Reset → default-display bounds; Apply All Slides → confirm popup, on Yes every slide takes the dim (src: src/slide-editor/canvas/tools/SlidePropertyEditorComp.tsx:114-190) |
| ED-18 | Canvas-item **Unlock** button (`CanvasItemPropsEditorComp`) (src: src/slide-editor/canvas/tools/CanvasItemPropsEditorComp.tsx:118) | 🖱️ Unlock on the 🔒 row of a locked selected box (src: src/slide-editor/canvas/tools/CanvasItemPropsEditorComp.tsx:118-127) | box unlocks; the box/text property editors re-appear for it (src: src/slide-editor/canvas/tools/CanvasItemPropsEditorComp.tsx:83-127) |
| ED-19 | Box Position/Size/Rotate numeric inputs + rotate Reset (`BoxPositionSizeComp`) (src: src/slide-editor/canvas/tools/BoxPositionSizeComp.tsx:44) | ⌨️✎ X(left)/Y(top); ⌨️✎ W/H (min 1); ⌨️✎ Rotate deg; 🖱️ rotate Reset (`bi-arrow-counterclockwise`) (src: src/slide-editor/canvas/tools/BoxPositionSizeComp.tsx:44-101) | box moves / resizes / rotates to the typed values (rotate normalized 0–360); Reset sets rotate back to 0° (src: src/slide-editor/canvas/tools/BoxPositionSizeComp.tsx:44-101) |
| ED-20 | Box **alignment** button group — vertical + horizontal (`SlideEditorToolAlignComp` via Box tools) (src: src/slide-editor/canvas/tools/SlideEditorToolsBoxComp.tsx:161) | 🖱️ each of top/mid/bottom + left/center/right (src: src/slide-editor/canvas/tools/SlideEditorToolAlignComp.tsx:84-142) | box repositions to that canvas edge/center; the active button is `disabled` and solid `btn-info` (others `btn-outline-info`) (src: src/slide-editor/canvas/tools/SlideEditorToolAlignComp.tsx:36-44) |
| ED-21 | Box **background color** picker (`SlideEditorToolsColorComp` in Box tools) (src: src/slide-editor/canvas/tools/SlideEditorToolsBoxComp.tsx:149) | 🖱️ pick a color / 🖱️ "no color" (src: src/slide-editor/canvas/tools/SlideEditorToolsBoxComp.tsx:131-157) | `backgroundColor` prop changes and the box repaints (debounced); control is hidden for media boxes (src: src/slide-editor/canvas/tools/SlideEditorToolsBoxComp.tsx:139-157) |
| ED-22 | Box **Shape Properties** — Glass Effect / Round % slider / Round px (`ShapePropertiesComp`) (src: src/slide-editor/canvas/tools/ShapePropertiesComp.tsx:40) | ⌨️✎ Glass Effect px; 🎚️ Round % (0–100); ⌨️✎ Round Size Pixel (src: src/slide-editor/canvas/tools/ShapePropertiesComp.tsx:40-93) | box gains backdrop blur; corners round by % or px; setting Round px > 0 disables/greys the Round % slider (src: src/slide-editor/canvas/tools/ShapePropertiesComp.tsx:51-93) |
| ED-23 | Box **Layer order** buttons (`LayerComp` in Box tools) (src: src/slide-editor/canvas/tools/SlideEditorToolsBoxComp.tsx:80) | 🖱️ Send backward (`bi-layer-backward`) / Bring forward (`bi-layer-forward`) (src: src/slide-editor/canvas/tools/SlideEditorToolsBoxComp.tsx:106-121) | box z-order reorders within `canvasItems` (`applyOrderingData`); a stacked box visibly moves under/over its neighbor (src: src/slide-editor/canvas/tools/SlideEditorToolsBoxComp.tsx:85-98) |
| ED-24 | Box **Size fit** buttons — Full / Original Size / Strip (`SizingComp`) (src: src/slide-editor/canvas/tools/SlideEditorToolsBoxComp.tsx:18) | 🖱️ Full; 🖱️ Original Size; 🖱️ Strip (media items only) (src: src/slide-editor/canvas/tools/SlideEditorToolsBoxComp.tsx:47-74) | box resizes to fit-canvas / natural size / media strip respectively; Strip button only present on media boxes (src: src/slide-editor/canvas/tools/SlideEditorToolsBoxComp.tsx:24-38) |
| ED-25 | **Text color** picker (`SlideEditorToolsTextComp`) (src: src/slide-editor/canvas/tools/SlideEditorToolsTextComp.tsx:33) | 🖱️ pick a text color (src: src/slide-editor/canvas/tools/SlideEditorToolsTextComp.tsx:33-42) | `color` prop changes and the glyphs recolor live (src: src/slide-editor/canvas/tools/SlideEditorToolsTextComp.tsx:33-42) |
| ED-26 | **Text alignment** button group — vertical + text-horizontal (src: src/slide-editor/canvas/tools/SlideEditorToolsTextComp.tsx:43) | 🖱️ top/mid/bottom + text-left/center/right (`bi-text-*`) (src: src/slide-editor/canvas/tools/SlideEditorToolAlignComp.tsx:101-124) | `textVerticalAlignment`/`textHorizontalAlignment` set; text realigns; active button `disabled`+solid `btn-info` (src: src/slide-editor/canvas/tools/SlideEditorToolAlignComp.tsx:36-44) |
| ED-27 | **Font controls** — size (input+select), family, weight/style (`ToolsTextFontControlComp`) (src: src/slide-editor/canvas/tools/ToolsTextFontControlComp.tsx:30) | ⌨️✎/🖱️ font size (15–300 select or typed); 🖱️ font family; 🖱️ weight/style (src: src/others/FontSizeControlComp.tsx:21-44; src/others/FontFamilyControlComp.tsx:56-127) | `fontSize`/`fontFamily`/`fontWeight` change and text restyles; a configured-but-absent font shows "X (Missing)" (informative); weight/style select appears only when the family exposes weights (src: src/others/FontFamilyControlComp.tsx:26-127) |
| ED-28 | **Text content** textarea (`SlideEditorToolsTextContentComp`) (src: src/slide-editor/canvas/tools/SlideEditorToolsTextContentComp.tsx:9) | ⌨️✎ type in the "Text" textarea (src: src/slide-editor/canvas/tools/SlideEditorToolsTextContentComp.tsx:9-35) | `text` prop updates and the box text changes WITHOUT entering canvas text-edit mode (src: src/slide-editor/canvas/tools/SlideEditorToolsTextContentComp.tsx:9-35) |
| ED-29 | Box **rotate handle** (pointer) (src: src/slide-editor/canvas/box/BoxEditorControllingModeComp.tsx:164) | ⇕ drag the `.rotate` rotator handle (src: src/slide-editor/BoxEditorController.ts:666-699) | box `transform: rotate(Ndeg)` updates live; drag badge shows `N°`; on release commits to `props.rotate` (src: src/slide-editor/BoxEditorController.ts:666-699) |
| ED-30 | Box **resize handles + modifiers** — 8 handles, Ctrl-center, aspect-lock (pointer) (src: src/slide-editor/canvas/box/BoxEditorControllingModeComp.tsx:167) | ⇕ drag each of 4 edge-mid + 4 corner handles; ⇕ with Ctrl held; ⇕ on an aspect-locked item (src: src/slide-editor/BoxEditorController.ts:291-342) | each handle resizes its edge(s), cursor rotates with the box angle; Ctrl → both edges move about a fixed center; aspect-locked item keeps ratio (src: src/slide-editor/BoxEditorController.ts:198-246,739-742) |
| ED-31 | **Multi-select group drag** (pointer) (src: src/slide-editor/canvas/box/BoxEditorControllingModeComp.tsx:104) | ⇕ drag one of ≥2 selected boxes (src: src/slide-editor/BoxEditorController.ts:484-611) | the whole selection moves together as ONE undo step; the live badge lists every dragged box (src: src/slide-editor/BoxEditorController.ts:484-611) |
| ED-32 | **Snap-to-edge/guide** while dragging (pointer) (src: src/slide-editor/canvas/CanvasGuideLineComp.tsx:45) | ⇕ drag a box near another box edge/center or a guide line (src: src/slide-editor/BoxEditorController.ts:850-937) | a cyan snap line (`#00c8ff`) appears and the box position snaps to it (≈8px/scale threshold) (src: src/slide-editor/BoxEditorController.ts:850-937) |
| ED-33 | **Locked box** — indicator + drag refused (pointer) (src: src/slide-editor/canvas/box/BoxEditorControllingModeComp.tsx:72) | 🖱️/⇕ try to move or 🖱️🖱️ a locked box (src: src/slide-editor/canvas/box/BoxEditorControllingModeComp.tsx:157-160) | box shows the `.locked-indicator` 🔒 (title "Locked"); no resize/rotate handles render; move-drag and dbl-click no-op (src: src/slide-editor/canvas/box/BoxEditorControllingModeComp.tsx:72-79) |
| ED-34 | Empty-canvas pointer — click clears / drag marquee-selects (src: src/slide-editor/canvas/canvas-container/BodyRendererComp.tsx:159) | 🖱️ quick click empty canvas (<500ms,<10px); ⇕ press+drag a rectangle on empty canvas (src: src/slide-editor/canvas/canvas-container/BodyRendererComp.tsx:266-305) | click → `stopAllModes` (selection cleared / edit exited); drag → blue marquee rect `rgba(74,163,255,.25)` draws and boxes inside get selected on release (Shift/Ctrl append) (src: src/slide-editor/canvas/canvas-container/BodyRendererComp.tsx:159-288) |
| ED-35 | **Canvas scale/zoom** — scale slider + center-view + Ctrl+scroll (src: src/slide-editor/canvas/tools/SlideEditorCanvasScalingComp.tsx:38) | 🎚️ scale range (1–20); 🖱️ center-view (`bi-border-middle`); ⌨️ Ctrl+scroll over the canvas (src: src/slide-editor/canvas/tools/SlideEditorCanvasScalingComp.tsx:31-45) | `NN.Nx` label updates and the canvas rescales (persists `canvas-editor-scale`); center-view scrolls the canvas to center; Ctrl+scroll changes scale over the same range (src: src/slide-editor/canvas/canvas-container/CanvasContainerComp.tsx:114-133; src/slide-editor/canvas/SlideEditorCanvasComp.tsx:110-116) |
| ED-36 | **Canvas Items** tab — card select (`ToolCanvasItemsComp`) (src: src/slide-editor/canvas/tools/ToolCanvasItemsComp.tsx:49) | 🖱️ click a preview card (Shift/Ctrl to append) (src: src/slide-editor/canvas/tools/ToolCanvasItemsComp.tsx:49-56) | that item is selected on the canvas → card gets a `2px dashed green` border; Shift/Ctrl adds to the selection set (src: src/slide-editor/canvas/tools/ToolCanvasItemsComp.tsx:49-56) |
| ED-37 | **Undo / Redo** toolbar buttons (`FileEditingMenuComp`) (src: src/editing-manager/editingHelpers.tsx:158) | 🖱️ Undo (`bi-arrow-90deg-left`); 🖱️ Redo (`bi-arrow-90deg-right`) (src: src/editing-manager/editingHelpers.tsx:158-179) | Undo reverts the last edit and the props panel re-syncs; Redo re-applies it; each button disables at its history end; the toolbar is present only when `canUndo||canRedo||canSave` (src: src/editing-manager/editingHelpers.tsx:158-179) |
| ED-38 | **Discard changed** toolbar button — Cancel only, EX-05 (src: src/editing-manager/editingHelpers.tsx:87) | 🖱️ Discard (`bi-x-octagon`, btn-danger) → confirm popup → 🖱️ **Cancel** (never "Yes" per CLAUDE.md) (src: src/editing-manager/editingHelpers.tsx:87-117) | the "Discard changed" confirm popup appears; Cancel closes it leaving the document unchanged and the undo/redo stack intact (src: src/editing-manager/editingHelpers.tsx:87-117) |
| ED-39 | **Fix-dimension** toolbar button (`SlidesMenuComp`) (src: src/app-document-presenter/items/SlidesMenuComp.tsx:36) | 🖱️ the warning button (`bi-hammer`+`bi-aspect-ratio`), shown only when a slide dim ≠ display (src: src/app-document-presenter/items/SlidesMenuComp.tsx:36-49) | `fixSlidesDimensionForDisplay` corrects the slide dimensions to the display and the warning button clears (src: src/app-document-presenter/items/SlidesMenuComp.tsx:36-49) |

## XW — Cross-window propagation (multi-renderer edit→present sync)

The class of regression a one-window run misses: OWA windows are **separate renderers**
that sync only via **disk + `fs.watch`**, so an edit in the **separate** `Document Editor`
window must propagate to the Presenter preview / list / live screen. Requires the
**two-window** config (editor opened via NAV-21 external icon → `openPopupWindow`, NOT the
in-place `Slide Editor` tab). Recipe + CDP-drivable-edit techniques (properties numeric
inputs ED-17/ED-19, programmatic `CanvasController`, direct `writeFileData`): KB §12,
test-plan.md §S18. **Prefer a scratch doc; restore via Undo (never Discard).** The chain to
cite when a hop breaks: `writeFileData`→`fs.watch`/`handleFileEvent`→`alertFileChanging`
(`file-update`)→list-hook bridge→`FileSource.fireUpdateEvent`→`useFileSourceEvents(['update'])`
consumer reload, through the 2 s data cache.

| ID | Target | Interactions | Pass condition |
|---|---|---|---|
| XW-01 | Editor(separate window) save → **Presenter center preview** (`VarySlidesComp`) (src: src/app-document-presenter/items/VarySlidesComp.tsx:84) | in a scratch doc shown in the Presenter, edit a box via ED-19 numeric inputs (or `writeFileData`) in the editor window → **Save**; observe the Presenter `VarySlidesComp` | within ~3 s the Presenter's center slide preview re-renders with the new geometry/text (500 ms debounce + 2 s cache); a stale preview = FAIL (src: src/app-document-presenter/items/VarySlidesComp.tsx:77-89) |
| XW-02 | Editor save → **Presenter list-row thumbnail** (`VaryAppDocumentFileComp`) (src: src/app-document-list/VaryAppDocumentFileComp.tsx:249) | same save; observe the Documents left-list row's preview for that doc | the row's thumbnail reloads to the edited content (the `useFileSourceEvents(['update'])` subscription fires); stale = FAIL — this is exactly the reload path the recent refactor touched (src: src/app-document-list/VaryAppDocumentFileComp.tsx:252-258) |
| XW-03 | Editor save → **live screen output** (`screen.html`) when that slide is presented | present slide 1 of the scratch doc (SP/SC), then edit+save it in the editor window; screenshot the `screen.html` target | the presented slide on the real output updates to the edited content; if the mini-screen updates but the screen target does not, that is a screen-only propagation bug (KB §6) |
| XW-04 | **Unsaved**-edit semantics (negative check — expected behavior, not a bug) | make an edit in the editor window but do **NOT** save; observe the Presenter | the Presenter keeps showing the last **saved-on-disk** version (separate renderers don't share memory) — this is CORRECT; only a *saved* change that fails to propagate is a FAIL (KB §12.2) |
| XW-05 | **Reverse** direction — change made/saved from another surface reflects in the open editor | with the doc open in the editor window, trigger a save/`fireUpdateEvent` from the Presenter side (e.g. a doc/slide op) | the editor window re-reads and reflects it (its own watcher→bridge→reload); no need to reopen the editor |
| XW-06 | **Lyric** cross-window edit → lyric preview/list (`LyricPreviewerComp` / `LyricFileComp`) (src: src/lyric-list/LyricFileComp.tsx:80) | open a lyric in the Lyric Editor popup, edit + save; observe the Presenter Lyrics preview/list | the lyric preview/list reloads to the edited content (same `useFileSourceEvents(['update'])` path as XW-02; refactor-touched) (src: src/lyric-list/LyricFileComp.tsx:77-85) |
| XW-07 | **Data-cache staleness** guard (2 s `fileDataCacheManager`) (src: src/helper/FileSource.ts:42) | after XW-01, if the preview looks stale, wait >2 s and re-trigger (or re-select the doc) | a re-read past the 2 s TTL returns fresh bytes — if the preview is *permanently* stale even after cache expiry, the reload/subscribe wiring is broken, not the cache (src: src/helper/FileSource.ts:132-149,171-173) |

## ST — `setting.html` (Settings **popup**)

| ID | Target | Interactions | Pass condition |
|---|---|---|---|
| ST-01 | Open + attach | gear → `list_pages` → `select_page` | title matches `/Settings/`; NEVER `navigate_page` the main window here |
| ST-02 | `General`/`Bible` tabs (vertical left sidebar `TabRenderComp` nav-links, not a top tab bar) | 🖱️ each | panels switch (src: src/setting/SettingComp.tsx:47) |
| ST-03 | Directory paths section (parent + 9 independent child path controls — detail split into ST-13..ST-20) | observe; ⌨️✎ path input; (browse = EX-01) | section renders; input editable ("input editable" alone under-specifies it) (src: src/setting/directory-setting/SettingGeneralDirectoryPathComp.tsx:175) |
| ST-04 | `SettingGeneralLanguageComp` | 🖱️ other locale → verify → 🖱️ restore | UI re-renders in the new locale, then restored |
| ST-05 | `SettingGeneralThemeComp` | ⌨️✎ theme `<select>` (order Light, Dark, System) → restore | theme applies **live** (no reload/pendingApply) each time — a `<select>`, not "light→dark" buttons (src: src/setting/SettingGeneralThemeComp.tsx:25) |
| ST-06 | `SettingGeneralFontFamilyComp` | ⌨️✎ font `<select>` (leading `--` none option) → restore | change triggers `pendingApply` (not live); a configured-but-missing font shows `"<font> (Missing)"` (informative, not a bug) (src: src/setting/SettingGeneralFontFamilyComp.tsx:10) |
| ST-07 | Destructive resets | presence-only (EX-05) — **do NOT click "Clear All Settings"** | **CORRECTION**: "Clear All Settings" shows **NO confirm** — `appLocalStorage.clear()` wipes all settings immediately; cover as EX-05 presence-only (also a candidate FINDING: destructive with no guard) (src: src/setting/SettingGeneralOtherOptionsComp.tsx:14) |
| ST-08 | `SettingApplyComp` | 🖱️ `Apply Settings` **last**, with settings restored | windows reload cleanly; re-attach targets after |
| ST-09 | Bible tab (XML-based: Import XML + XML list + Monaco editor — detail ST-23..ST-33) | observe; (the old downloaded/online enable/disable/download list is **dev-only**) | **CORRECTION**: no search box; Bible tab is XML-based (src: src/setting/bible-setting/SettingBibleComp.tsx:5) |
| ST-10 | Popup lifecycle | `close_page` the popup | main window unaffected |
| ST-11 | `SettingComp` tab dirty-guard | 🖱️ General/Bible nav-link while a Bible XML editor is dirty | tab does NOT switch (`.active` unchanged) and `showSimpleToast('Unsaved Bible Data')` fires (src: src/setting/SettingComp.tsx:31-40) |
| ST-12 | `SettingApplyComp` pending indicator | observe after changing language / font / reset-widget | button flips `btn-outline-success`+`bi-check` → `btn-outline-warning`+`bi-asterisk` **without** reloading (src: src/setting/SettingApplyComp.tsx:26,31) |
| ST-13 | `PathSelectorComp` editor expand (parent + 9 child dirs = one family) | 🖱️ a collapsed path-previewer row | chevron `bi-chevron-right`→`bi-chevron-down`; lazy `PathEditorComp` (input+buttons) mounts; title toggles "Show/Hide path editor" (src: src/others/PathSelectorComp.tsx:80-111) |
| ST-14 | `PathEditorComp` browse button | 🖱️ `btn-secondary`/`bi-folder2-open` (editor expanded) | OS dir dialog opens; app does not crash when it is cancelled — dialog itself EX-01 (src: src/others/PathEditorComp.tsx:70-76) |
| ST-15 | `PathEditorComp` path text input | ⌨️✎ a path string | `dirSource.dirPath` updates; input carries `is-valid`/`is-invalid` (blank ⇒ neither) per `isDirPathValid` (src: src/others/PathEditorComp.tsx:25-30,63-69) |
| ST-16 | `PathEditorComp` reload button | 🖱️ `btn-secondary`/`bi-arrow-clockwise` (shown only when a dirPath is set) | `fireReloadEvent()` re-scans the dir; list refreshes, no crash (src: src/others/PathEditorComp.tsx:54-62) |
| ST-17 | "Reset All Child Directories" (`btn-warning`) | 🖱️ `bi-arrow-counterclockwise` in Child-Directories header → **Cancel** | `showAppConfirm('Set according paths', …, {Yes})` appears; Cancel leaves child paths intact (EX-05) (src: src/setting/directory-setting/SettingGeneralDirectoryPathComp.tsx:237-244) |
| ST-18 | Child-dir "Missing" badge | observe with an invalid/unset child dir | red `badge text-bg-danger` "Missing" on that item; its editor is force-shown (`isForceShowEditor`) (src: src/setting/directory-setting/SettingGeneralDirectoryPathComp.tsx:83-104) |
| ST-19 | `SelectDefaultDirButton` (per missing child) | 🖱️ `btn-info` "Select Default '<folder>'" → **Cancel** | `showAppConfirm('Select Default Folder', …, {Ok/Cancel})` appears; Cancel = no mutation (EX-05) (src: src/others/NoDirSelectedComp.tsx:6-23) |
| ST-20 | Parent-not-set CTA (`btn-success`) | 🖱️ "Click here to set default data on 'Desktop'" → **Cancel** | creates `~/Desktop/open-worship-data` then a `selectPathForChildDir` confirm; Cancel to avoid mutating (EX-05) (src: src/setting/directory-setting/SettingGeneralDirectoryPathComp.tsx:139-160) |
| ST-21 | `FontFamilyControlComp` weight/style select | ⌨️✎ `#text-font-style` (a family WITH weights selected) | `applyStore.pendingApply()` fires; select renders only when `fontList[fontFamily]?.length`, else absent (src: src/others/FontFamilyControlComp.tsx:71-127) |
| ST-22 | "Reset Widgets Size" (`btn-warning`) | 🖱️ presence/enabled only — **do NOT click** | button present + enabled; NOTE **no confirm** — `clearWidgetSizeSetting()` fires immediately + pendingApply, so cover as EX-05 presence-only (src: src/setting/SettingGeneralOtherOptionsComp.tsx:10-13,25-32) |
| ST-23 | `BibleXMLImportComp` "XML format example" toggle | 🖱️ `bi-question-lg` | `btn-outline-info`↔`btn-info`; a read-only `<textarea>` of `xmlFormatExample` shows/hides (src: src/setting/bible-setting/BibleXMLImportComp.tsx:108-132) |
| ST-24 | `BibleXMLImportComp` file picker + cancel | 🖱️/⌨️✎ choose a file in `input[type=file][name=file]` | Import enables; `btn-danger`/`bi-x-lg` cancel appears; URL group dims (opacity .5, pointer-events none); browse dialog EX-01 (src: src/setting/bible-setting/BibleXMLImportComp.tsx:142-158) |
| ST-25 | `BibleXMLImportComp` URL input + clear | ⌨️✎ `input[name=url]` | invalid → `is-invalid` + title "Invalid URL"; valid → `btn-danger` clear-url button + file group dims (src: src/setting/bible-setting/BibleXMLImportComp.tsx:166-192) |
| ST-26 | `BibleXMLImportComp` submit | 🖱️ `input[type=submit]` "Import" | disabled unless `isFileSelected || isValidUrl`; on submit shows `LoadingComp`, toasts on parse/no-data failure — prefer a tiny local XML (src: src/setting/bible-setting/BibleXMLImportComp.tsx:196-207) |
| ST-27 | `BibleXMLListComp` Refresh + "Search XML" link | 🖱️ `bi-arrow-clockwise` Refresh; 🖱️ "Search XML" | Refresh reloads keys (blocked by dirty toast, ST-11); "Search XML" opens external Google — presence/name only (EX-04) (src: src/setting/bible-setting/BibleXMLListComp.tsx:29-63) |
| ST-28 | `BibleXMLListComp` empty-state "Create KJV Bible XML" | 🖱️ `btn-success` (no XML bibles present) | `bibleDataReader.initKJVBible()` then refresh; a KJV item appears (also seeds a scratch item for ST-30) (src: src/setting/bible-setting/BibleXMLListComp.tsx:64-83) |
| ST-29 | `BibleXMLInfoComp` show/hide editor | 🖱️ `bi-pencil` on an item | `btn-outline-primary`↔`btn-primary`; `BibleXMLDataPreviewComp` expands/collapses (collapse blocked by dirty toast) (src: src/setting/bible-setting/BibleXMLInfoComp.tsx:94-105) |
| ST-30 | `BibleXMLInfoComp` Move to Trash (confirm) | 🖱️ `bi-trash`/`btn-danger` → **Cancel** (or delete the scratch KJV from ST-28) | `showAppConfirm('Delete Bible XML','…delete bible XML "<key>"?', {Yes})` appears; delete only the scratch KJV (EX-05) (src: src/setting/bible-setting/BibleXMLInfoComp.tsx:106-112) |
| ST-31 | `BibleXMLDataPreviewComp` Info/Extra/Book-Chapter tabs + Download | 🖱️ each choice button; 🖱️ Download | active button `btn-light` vs `btn-primary`; switching blocked by dirty toast; Download (`btn-success`/`bi-download`) saves `<key>.json` (src: src/setting/bible-setting/BibleXMLDataPreviewComp.tsx:54-100) |
| ST-32 | `BibleXMLEditorComp` Monaco footer | 🖱️ Full View / Reset / Save (⌨️✎ typing needs OS foreground focus) | Full View toggles `.app-full-view`; on change "Unsaved changes"+`bi-exclamation-triangle-fill`; Reset (`btn-warning`, disabled unless changed) reverts to baseline; Save (`btn-primary`, disabled unless `canSave`) saves + `forceReloadAppWindows()` (src: src/setting/bible-setting/BibleXMLEditorComp.tsx:187-247) |
| ST-33 | `SettingBibleJsonComp` dev-only JSON version list | 🖱️ Download / Delete / Update / Refresh (dev-build Bible tab only) | Download `btn-info` (disabled if already an XML); Delete → confirm 'Delete Bible'/Yes; Update `btn-warning`; Refresh; downloads = EX-07; BLOCKED in prod (`isDev` gate) (src: src/setting/bible-setting/SettingBibleJsonComp.tsx:8-46) |

## PU — Other popup windows

| ID | Target | Interactions | Pass condition |
|---|---|---|---|
| PU-01 | Finder (`FinderAppComp`) | open via **`Ctrl+F` accelerator** (not an in-app button); ⌨️✎ query; 🖱️ prev `bi-arrow-left` / next `bi-arrow-right`; "Aa" case checkbox; ⌨️ `Enter` | matches highlight in the **sender/main window** (not the finder popup); `Enter` is always forward (no Shift+Enter — prev only via ◀); no regex option (src: src/find/FinderAppComp.tsx:100) |
| PU-02 | Lyric Editor (`LyricEditorPopupComp`) — `ResizeActorComp` split of `LyricEditorIDEComp` (Monaco markdown) + `LyricPreviewerComp` | via PL-09; ⌨️✎ edit; ⌨️ `Ctrl+S`; **restore original text**; close | edit round-trips without corrupting the lyric; wrap-text + toolbar detail = PU-08/PU-09 (src: src/lyric-list/LyricEditorPopupComp.tsx:52) |
| PU-03 | Bible Note (`NoteItemEditorPopupComp`) — renders BibleNote.js into `#bible-note-root` | via PR-03; ⌨️✎ type; save; restore | note editor renders; save works; footer action buttons + floating Bible-Lookup insert detail now in PU-10..PU-13 (src: src/bible-list/note/NoteItemEditorPopupComp.tsx:116) |
| PU-04 | Web Editor (`WebEditorComp`) — Monaco **HTML IDE + live `<iframe>` preview split** that **auto-saves** | reached via a web-FILE item's `Edit` menu (NOT via `+`); ⌨️✎ HTML (typing detail PU-14) | **CORRECTION**: no URL+title form, no Save button (`writeFileData` on change); preview iframe reloads on file update (src: src/background/web/WebEditorComp.tsx:35) |
| PU-05 | About (`AboutComp`) — opens via the **native Electron menu** ("About <app>"), not an in-app button | open; observe | version renders; links present (EX-04 for following them); links detail = PU-15 (src: src/others/AboutComp.tsx:42) |
| PU-06 | LW Share (`LWShareAppComp`) — opens via the **native Electron menu** ("Local Web Share"), not an in-app button | open if reachable | share view renders; else BLOCKED with the reason; controls detail = PU-16..PU-18 (src: src/lwShare/LWShareAppComp.tsx:7) |
| PU-07 | `FinderAppComp` "Aa" match-case checkbox | 🖱️ toggle with a query present | `isMatchCase` flips and `findString` re-runs with the new flag (result set can change); **no regex option exists** (src: src/find/FinderAppComp.tsx:86-96,121-129) |
| PU-08 | `LyricEditorIDEComp` "Wrap Text" checkbox | 🖱️ toggle "Wrap Text" | Monaco word-wrap toggles; `lyric-editor-wrap-text` setting persists (src: src/lyric-list/LyricEditorIDEComp.tsx:79-93) |
| PU-09 | Lyric editor Undo/Redo/Discard/Save toolbar | 🖱️ Undo/Redo/Save; Discard → confirm → **Cancel** | toolbar renders only when `canUndo||canRedo||canSave`; Save `bi-floppy` disabled unless canSave; Discard `bi-x-octagon` → confirm "Discard changed / …discard all change histories?" {Yes} — **use Undo, NEVER confirm Discard in QA** (src: src/editing-manager/editingHelpers.tsx:133-188) |
| PU-10 | `NoteItemEditorPopupComp` footer Bible-Lookup button | 🖱️ `bi-book` footer action | `FloatingWidgetComp` bible-lookup opens (`RenderBibleLookupComp` inside); onClose hides it (src: src/bible-list/note/bibleNoteHelpers1.tsx:53-71) |
| PU-11 | Note footer Bible-Key selector | 🖱️ key-text footer button → pick a key | `showBibleKeyOption` menu opens; picking a key updates `BIBLE_KEY_SETTING_NAME` and the button label changes (src: src/bible-list/note/bibleNoteHelpers1.tsx:105-133) |
| PU-12 | Note footer Always-On-Top toggle | 🖱️ `bi-window-desktop` footer action | icon flips `bi-window-desktop`↔`bi-window-stack` (green); window on-top state toggles (src: src/bible-list/note/bibleNoteHelpers1.tsx:73-98) |
| PU-13 | Note Insert-Bible-Text buttons | 🖱️ `bi-archive` / `bi-box-arrow-in-left` (floating lookup open with a verse) | `bi-archive` inserts collapsed text; `bi-box-arrow-in-left` inserts full text (prefixed `^`) into the note (src: src/bible-list/note/NoteItemEditorPopupComp.tsx:46-95) |
| PU-14 | `WebEditorIDEComp` Monaco HTML auto-save | ⌨️✎ type HTML (needs OS foreground focus) | **no Save button/form** — typing writes the file immediately (`writeFileData`); `WebPreviewerComp` reflects it (src: src/background/web/WebEditorIDEComp.tsx:43-48) |
| PU-15 | `AboutComp` links & GitHub button | 🖱️ inspect (presence/name only) | "Fork me on GitHub" (`btn-success`/`bi-github`), version→release-tag link, commit link, homepage link (`bi-box-arrow-up-right`) all present + named; following them = EX-04 (src: src/others/AboutComp.tsx:103-120) |
| PU-16 | `ServerControllerComp` Start/Stop Server | 🖱️ status button (server stopped) → **restore to stopped** | text/class cycle per `statusViewMap`: stopped=`Start Server`(warning) → running=`Stop Server`(success) with QR-code address links; error=`Restart Server` — restore stopped (src: src/lwShare/ServerControllerComp.tsx:130-219) |
| PU-17 | `ServerControllerComp` port controls | ⌨️✎ port; 🖱️ "Gen Randomly"; 🖱️ "Use 8080" | number input (0–65535) updates `port`; "Gen Randomly" sets a random 1024–65535; "Use 8080" sets 8080; changing port re-inits the server (src: src/lwShare/ServerControllerComp.tsx:72-149) |
| PU-18 | `ServerControllerComp` Storage-Dir row + GitHub | 🖱️ storage-dir row / "Fork me on GitHub" | storage-dir → `showFileOrDirExplorer` (EX-01); GitHub `bi-github` → external (EX-04) — presence/name only (src: src/lwShare/ServerControllerComp.tsx:174-202) |

## SP — Screen controlling (mini-screen previewer) — **MANDATORY core: SP-01..02**

Every screen gets its own previewer card (`ScreenPreviewerItemComp`): header =
`ShowHideScreen` + `MiniScreenClearControlComp` + screen-id badge + color note + lock;
body = live preview (drop target, right-click menu); footer = `DisplayControl` +
transition effects + background-audio switch + stage number. Sources in
[components-path.md](./components-path.md) §Presenter-right.

| ID | Target | Interactions | Pass condition |
|---|---|---|---|
| SP-01 | `ShowHideScreen` toggle | 🖱️ click (and ⌨️ `F5`) on → verify → off | ON: `.showing` class + opacity 1; a `screen.html?screenId=N` target appears in `list_pages`. OFF: target disappears. **Always end hidden unless it started showing** |
| SP-02 | `MiniScreenClearControlComp` enabled states | observe before/after presenting each layer | with a layer empty its button is `btn-outline-*` (disabled-look); presenting that layer flips it to solid `btn-*`; clicking clears and it flips back (eraser=All F6, BG F7, SL F8, BB F9, FG F10) |
| SP-03 | Lock toggle (`bi-unlock`/`bi-lock-fill`) | 🖱️ lock → try presenting a slide → unlock | locked: icon red `bi-lock-fill` and slide change is refused with toast "Screen Manager is locked"; unlocked (green) works again — **restore unlocked** |
| SP-04 | `ShowingScreenIcon` + `ItemColorNoteComp` | observe badge; 🖱️ color-note dot → pick a color → restore | badge shows screen id with a stable per-id color (`data-screen-id`); color note applies (multi-screen: previews group under color bars) and restores |
| SP-05 | `DisplayControl` (`Display(screenId):displayId`) | 🖱️ → context menu | menu lists every OS display as `label(id): WxH (primary)` with `*` on the current one; re-selecting the current display is a safe no-op round-trip; only pick another display if one exists AND you restore it |
| SP-06 | Transition effects (`Tr:` `Slide:`/`Background:`) | 🖱️ each button → pick a different effect (none/fade/move/zoom) → present content → restore | menu shows the 4 effects with the current one highlighted; icon on the button updates; the presented change uses the effect (observe mini-screen) — **restore the original effect** |
| SP-07 | Stage number (`St: N`) | 🖱️ → menu `0`–`4` / Increment / Decrement | picking a value updates the label; current value disabled in the menu; the fixed items are `0`–`4` but `Increment` has **no upper cap** (the `St:` label can read `5`+); `Decrement` floors at 0 and is disabled at ≤0 — **restore original value** (src: src/_screen/preview/ScreenPreviewerFooterComp.tsx:38) |
| SP-08 | `BackgroundAudioSwitchComp` (`bi-soundwave`) | appears only while a video background is live: 🖱️ toggle on; 🖱️ toggle off while audio playing | ON: audio-handler rows render in the footer; OFF while playing: refused with toast (pair GL-10); OFF while paused: rows collapse |
| SP-09 | `MiniScreenAudioHandlersComp` (audio player) | 🖱️ play/pause the `<audio controls>`; 🖱️ repeat toggle (`bi-repeat-1`) | filename renders; play syncs the background-video time (video restarts in sync); repeat toggle flips green/dim — **end paused** |
| SP-10 | Previewer context menu | 🖱️R on a previewer card | menu opens with the expected items for the current screen count / bible-live state; per-item observable assertions moved to SP-11 (Solo/Select/Deselect/Delete), SP-16 (Refresh Preview re-renders), SP-17 (Line Sync toggle + lock refusal) (src: src/_screen/preview/screenPreviewerHelpers.ts:20) |
| SP-11 | Multi-screen lifecycle | 🖱️R empty mini-screen body → `Add New Screen`; then `Solo`/`Select` on cards; then `Delete` the added screen | second previewer card appears with its own id + color; solo/select toggle `HIGHLIGHT_SELECTED` state; delete removes it — **self-cleaning: never leave an extra screen** |
| SP-12 | Drop onto a specific previewer | ⇕ drag a slide / bg item / foreground Show button onto one previewer card | card highlights while dragging over (receiving-drop class); dropped content presents on THAT screen (pair PM-25) |
| SP-13 | Per-card Full-view toggle (`ScreenPreviewerHeaderComp` icon, one per screen card) | 🖱️ full-view icon; ⌨️ `Escape` | Card root toggles `.app-full-view`; header icon flips `bi-arrows-fullscreen`↔`bi-fullscreen-exit` with title/aria-label flipping Full view↔Exit full view; pressing Escape removes `.app-full-view` and the card's ResizeObserver reconciles `isFullView`→false with no snap-back — a per-card widget distinct from PM-04's presenter-panel view (src: src/_screen/preview/ScreenPreviewerHeaderComp.tsx:74-87; src/_screen/preview/ScreenPreviewerItemComp.tsx:69-99; src/helper/domHelpers.ts:57-74) |
| SP-14 | Ctrl+wheel over a live bible on a card (`ScreenBibleManager.div` wheel handler) | ⌨️ Ctrl + scroll-wheel over a live bible | With a bible verse live, Ctrl+wheel over the bible container steps the on-screen bible font-size up/down (`changeTextStyleTextFontSize`); the card's `handleWheel` calls `stopPropagation` so the mini-screen/page zoom does NOT change; the same handler is wired on the `screen.html` output side too (src: src/_screen/managers/ScreenBibleManager.ts:119-130; src/_screen/preview/ScreenPreviewerItemComp.tsx:122-130) |
| SP-15 | Ctrl+wheel / pinch zoom of the whole mini-screen previewer (`MiniScreenComp` `useZoomingRegistering`) | ⌨️ Ctrl + scroll-wheel, or trackpad pinch, over the previewer panel | Ctrl+wheel/pinch over the panel changes the `mini-screen-previewer` scale setting and every card runs `fireScaleEvent`→rescales — same effect as the PR-05 slider but via wheel/pinch, and without SP-14's bible-font path; the value persists across reload (src: src/_screen/preview/MiniScreenComp.tsx:20-33; src/others/AppRangeComp.tsx:63-107) |
| SP-16 | "Refresh Preview" previewer menu item (present in BOTH card menu and empty-body menu) | 🖱️R card OR empty body area → 🖱️ `Refresh Preview` | Selecting it calls `fireRefreshEvent()` on every screen manager; each `<mini-screen-previewer-custom-html>` re-renders its shadow-root content (preview DOM repaints), observable as the previews reflowing; reachable from both menus (src: src/_screen/preview/screenPreviewerHelpers.ts:83-90; src/_screen/preview/MiniScreenBodyComp.tsx:34-41) |
| SP-17 | "Set/Unset Line Sync" previewer menu item (bible-live only, lock-guarded) | 🖱️R a card with a bible live → 🖱️ `Set`/`Unset Line Sync` | Item present only while a bible is live (`screenViewData!=null`); label flips Set↔Unset; toggling writes `screen-bible-…-line-sync-<id>` and re-clones `screenViewData` so a subsequent verse selection line-highlights on that screen; if the card is locked the setter calls `checkIsLockedWithMessage`→toast "Screen Manager is locked" and makes no change (src: src/_screen/preview/screenPreviewerHelpers.ts:33-47; src/_screen/managers/ScreenBibleManager.ts:99-113) |
| SP-18 | Audio scrubber seek → background-video time sync (`MiniScreenAudioHandlersComp` `<audio>`) | 🖱️ drag/scrub the `<audio controls>` position with a live video background | `onTimeUpdate` calls `setBackgroundVideoCurrentTimeForce(videoId, currentTime, false)`, so the live background video's `currentTime` jumps to the scrubbed position and re-seeks on both the mini-screen and the screen output — a seek→sync behavior separate from SP-09's play/pause (src: src/_screen/preview/MiniScreenAudioHandlersComp.tsx:25-33,53) |
| SP-19 | Audio repeat-on-end behavior (`MiniScreenAudioHandlersComp` end-of-track + repeat toggle) | 🖱️ repeat toggle, then let the audio reach its end | `onEnded=handleAudioEnding(isRepeating)`: with repeat ON (green `bi-repeat-1`, opacity 1) the audio restarts/loops at track end; with repeat OFF (dim, opacity .5) it stops at ended and stays — an end-of-track outcome beyond SP-09's flag flip (src: src/_screen/preview/MiniScreenAudioHandlersComp.tsx:52,59-70) |
| SP-20 | Multi-screen per-card vs sync-group state isolation | 🖱️ change stage/effect/display/line-sync/lock/color on card A → observe card B | Per-card controls (stage, transition effect, display, line-sync, showing) stay independent between cards; only lock and color-note propagate, and only within a same-color sync group (`setIsLockedWithSyncGroup`; `setColorNote`→`enableSyncGroup` across bg/varyAppDocument/bible/foreground), so a different-color card B is left unchanged (src: src/_screen/managers/ScreenManagerBase.ts:101-103,177-189; src/_screen/preview/ScreenPreviewerFooterComp.tsx:104-115) |
| SP-21 | Bible-Properties floating toggle in the mini-screen footer (`BibleCustomStyleFloatingToggleComp`) | 🖱️ the Bible-Properties button (`bi-book`+`bi-gear-fill`) | Button flips `btn-outline-info`↔`btn-info` and a floating Bible-style panel shows/hides via `toggleBibleCustomStyleFloatingShowing` — a footer-level entry point distinct from PM-13/14's Bibles-tab split (src: src/_screen/preview/MiniScreenFooterComp.tsx:39-41; src/screen-setting/BibleCustomStyleFloatingToggleComp.tsx:7-22) |

## SC — `screen.html` (presentation output window) — **MANDATORY core: SC-01..02**

> **CDP facts (verified 2026-07-08):** while a screen is SHOWING it **is** a normal CDP
> target — `https://localhost:3000/screen.html?screenId=N` in `list_pages`, fully
> drivable (snapshot / click / screenshot). The target vanishes when the screen hides;
> a hidden screen's console forwards to the **electron main stdout** (the `npm run dev`
> terminal) via `all:app:log`. Never `navigate_page` the main window to `screen.html` —
> reach it only through SP-01 + `list_pages`. Screen-only bugs (e.g. full-width PDF) do
> NOT reproduce in the presenter's mini preview — that is why driving the real target is
> mandatory.

| ID | Target | Interactions | Pass condition |
|---|---|---|---|
| SC-01 | Screen target attach | present content → SP-01 show → `list_pages` → `select_page` → readiness → screenshot | the `screen.html?screenId=N` target MUST appear and be drivable; screenshot captured from the screen target itself (not just the mini preview) |
| SC-02 | Layer rendering on the real output | while bg + slide + bible + foreground are live | all live layers composite correctly **on the screen target's own screenshot**, and the mini-screen mirrors it; compare the two for screen-only rendering bugs |
| SC-03 | ⌨️ `Ctrl/Alt+ArrowLeft/Right` on the screen target | with a bible verse live, `press_key` on the selected screen page | bible verse steps prev/next on the output (mirror on mini-screen) |
| SC-04 | `ScreenCloseButtonComp` (❌ `#close`) | 🖱️ on the screen target | screen hides; its CDP target disappears; the presenter's `ShowHideScreen` reflects hidden |
| SC-05 | Hidden-screen log forwarding | after hiding, trigger screen activity; read the `npm run dev` terminal | screen console lines arrive via `all:app:log` on electron-main stdout (use this channel when hunting screen-only bugs while hidden) |
| SC-06 | Output window invalid/missing `screenId` error state (`ScreenAppComp` null-manager branch) | observe `screen.html` loaded with no / NaN `screenId` | `useScreenManager` returns null → a red "Screen ID is not provided in the URL…" panel on black renders and the `#close` button is force-shown (`opacity:1`), whose click calls `globalThis.close()` (no manager to hide); likely BLOCKED at runtime since it is reachable only via a stray target — never `navigate_page` the main window to `screen.html` (src: src/_screen/ScreenAppComp.tsx:16-32,64-95; src/_screen/ScreenCloseButtonComp.tsx:15-29) |
| SC-07 | Output window auto-reload on resize (`screen.tsx` window `resize` listener) | resize the showing `screen.html` window (`resize_page`) | The `window` `resize` event calls `appProvider.reload()`, so the screen target reloads (assets refetch, target briefly re-inits then reattaches in `list_pages`); drive only on a non-live display, else EX-02 (src: src/screen.tsx:40-42) |
## CM — Context-menu items (right-click actions)

Each distinct right-click menu ITEM as its own unit (triggers are in PL/PM/SP/GL rows). Destructive items = confirm→Cancel (EX-05) or act on a scratch item.

- Emoji: 🖱️ click · 🖱️🖱️ dblclick · 🖱️R right-click · ⇕ drag · ⌨️ key ·
  🎚️ slider · ⌨️✎ input · 🖐️ hover.
- **(family)** = one row consolidating the same item across sibling hosts.
- **[D]** = destructive item; pass = confirm dialog appears → **Cancel (EX-05)**,
  or act on a scratch item created for the purpose.
- Assert the open item set with
  `[...document.querySelectorAll('#app-context-menu-container .app-context-menu-item')].map(e=>e.textContent)`.

### Shared file-item tail + cross-cutting families (many hosts)

Every list item rendered through `FileItemHandlerComp` (documents, lyrics, bible
files, note files, bg media, fg web) ends with this tail, so it is enumerated
once here.

| ID | Target | Interactions | Pass condition |
|---|---|---|---|
| CM-01 | `Copy Path to Clipboard` (family: all `FileItemHandlerComp` rows, bg media, fg web) | 🖱️R → 🖱️ | menu closes; item's filePath is on the clipboard (read back to confirm) (src: src/others/FileItemHandlerComp.tsx:30) |
| CM-02 | `Reveal in File Explorer` (family: file tail, PathSelector/PathPreviewer, office slide w/ image, attached-bg badge, canvas video box, XML tools) | 🖱️R → 🖱️ | fires OS explorer (native = EX-01); menu closes, app does not crash (src: src/others/FileItemHandlerComp.tsx:36) |
| CM-03 | `Duplicate` — file copy (file tail) | 🖱️R → 🖱️ | a copy file appears in the list; item count +1 (src: src/others/FileItemHandlerComp.tsx:51) |
| CM-04 | `Rename` (file tail) | 🖱️R → 🖱️ | inline `RenderRenamingComp` input appears (InputPopup-style, GL-09); commit renames the file (src: src/others/FileItemHandlerComp.tsx:57) |
| CM-05 | `Reload` (file tail) | 🖱️R → 🖱️ | item re-reads from disk (fires a refresh event; thumbnail/preview repaints) (src: src/others/FileItemHandlerComp.tsx:63) |
| CM-06 | `Move to Trash` [D] (file tail; also bg media only-if-not-on-screen) | 🖱️R → 🖱️ | confirm "Moving File to Trash… / Yes" appears → **Cancel (EX-05)** or trash a scratch item; Yes trashes the file + material files (src: src/others/FileItemHandlerComp.tsx:77) |
| CM-07 | `Show on Screens` (family, presenter-only: slides, office slides, bg image/video/web/camera, bible item, fg web) | 🖱️R → 🖱️ | content presents — item flips `.app-on-screen` / mini-screen mirrors it; with no screen selected it opens the Screen-id chooser (CM-91 / SP-13) (src: src/others/FileItemHandlerComp.tsx:108) |
| CM-08 | `Remove Attached Background` (family, only when a bg is attached: slide thumb, office slide, bible file/item, note file/item) | 🖱️R → 🖱️ | attach-icon badge disappears from the item (src: src/helper/dragHelpers.ts:168) |
| CM-09 | `Choose Color` (slide thumb, office slide) | 🖱️R → 🖱️ | opens the color-note picker (`bi-record-circle`); picking sets the per-file color and fires an update (src: src/app-document-presenter/items/slideItemRenderHelpers.tsx:202) |

### Generic cross-cutting menus (selection / input / splitter / path / color-note)

| ID | Target | Interactions | Pass condition |
|---|---|---|---|
| CM-10 | Selected-text items `Copy Selected Text` · `Search Selected Text on Google` · `Dictionary for Selected Text` (Dictionary only if `data-dict-locale`) | 🖱️R with a text selection | the 3 (or 2) items + divider prepend the menu; Copy writes selection to clipboard, the others open a browser tab (EX-04) (src: src/helper/textSelectionHelpers.ts:62) |
| CM-11 | Text-input `Paste` (clipboard non-empty) · `Clear` (value non-empty) | 🖱️R an `input[type=text/search/…]` | Paste inserts clipboard text; Clear empties the field; neither condition ⇒ no menu opens (src: src/helper/domHelpers.ts:237) |
| CM-12 | Splitter `Reset Size` · `Close First Widget` · `Close Second Widget` | 🖱️R a resize splitter handle | Reset Size restores pane ratio; each Close collapses one pane (src: src/resize-actor/FlexResizeActorComp.tsx:330) |
| CM-13 | Dir-path `Copy to Clipboard` · `Reveal in File Explorer` · `Edit Parent Path` (hidden on setting page) · `Unset Directory Path` (`PathSelectorComp`; also ST-11 setting-page variant with no Edit Parent Path) | 🖱️R a directory-path row | Copy → clipboard; Reveal → explorer (EX-01); Edit Parent Path → InputPopup; Unset → path cleared; empty path ⇒ no menu (src: src/others/PathSelectorComp.tsx:21) |
| CM-14 | Color-note picker `No Color` (disabled if none set) + color names (current disabled) | 🖱️ the item's `bi-record-circle` color-note dot | menu opens; picking a color applies + persists on the item's dot (SP-04 is the screen-card variant) (src: src/others/ItemColorNoteComp.tsx:15) |

### Document list (`VaryAppDocumentFileComp` / `VaryAppDocumentListComp`)

Base tail = CM-01..06. Distinct items:

| ID | Target | Interactions | Pass condition |
|---|---|---|---|
| CM-15 | `Edit ↗` — OWA `.ows` doc row | 🖱️R → 🖱️ | the app document editor opens in its own window focused on the doc (ED-10) (src: src/app-document-list/VaryAppDocumentFileComp.tsx:30) |
| CM-16 | `Print` — OWA doc row only | 🖱️R → 🖱️ | print flow runs; a `print-preview-*.pdf` CDP target appears (src: src/app-document-list/VaryAppDocumentFileComp.tsx:93) |
| CM-17 | `Preview PDF` — `.pdf` row | 🖱️R → 🖱️ | opens the PDF preview popup window (src: src/app-document-list/VaryAppDocumentFileComp.tsx:33) |
| CM-18 | `Refresh PDF Images` — `.pdf` row | 🖱️R → 🖱️ | re-generates page images; thumbnails reload (src: src/app-document-list/VaryAppDocumentFileComp.tsx:33) |
| CM-19 | `Open PPTX` — `.pptx` row | 🖱️R → 🖱️ | opens the file via OS default app (openFile, EX-01) (src: src/app-document-list/VaryAppDocumentFileComp.tsx:57) |
| CM-20 | `Refresh PPTX Slides` — `.pptx` row | 🖱️R → 🖱️ | re-generates slide images; thumbnails reload (src: src/app-document-list/VaryAppDocumentFileComp.tsx:57) |
| CM-21 | `Open DOCX` — `.docx` row | 🖱️R → 🖱️ | opens the file via OS default app (EX-01) (src: src/app-document-list/VaryAppDocumentFileComp.tsx:75) |
| CM-22 | `Refresh DOCX Pages` — `.docx` row | 🖱️R → 🖱️ | re-generates page images; thumbnails reload (src: src/app-document-list/VaryAppDocumentFileComp.tsx:75) |
| CM-23 | `Create New File` — Documents list empty body | 🖱️R → 🖱️ | InputPopup for a name (GL-09); a new `.ows` appears in the list (src: src/app-document-list/VaryAppDocumentListComp.tsx:120) |
| CM-24 | `Add Items` · `Download From URL` · `Open Shared Link` (family: Documents / bg Images / Videos / Audios empty bodies) | 🖱️R empty area → 🖱️ | Add Items → submenu; Download From URL → InputPopup; Open Shared Link → input; each adds file(s) to the folder (list count grows) (src: src/others/FileListHandlerComp.tsx:190) |

### Lyric list (`LyricFileComp`)

| ID | Target | Interactions | Pass condition |
|---|---|---|---|
| CM-25 | `Edit` — lyric row (first item; then CM-01..06 tail) | 🖱️R → 🖱️ | **Lyric Editor popup** target appears (PU-02) (src: src/lyric-list/LyricFileComp.tsx:20) |

### Slide thumbnails — presenter (`genSlideContextMenuItems`) + slide-list container

| ID | Target | Interactions | Pass condition |
|---|---|---|---|
| CM-26 | `Copy` slide (family: presenter thumb, editor thumb, multi-select ED-13, canvas box) | 🖱️R → 🖱️ | slide copied → toast "Copied / Slide is copied"; enables `Paste` in the container menu (src: src/app-document-list/appDocumentHelpers.tsx:138) |
| CM-27 | `Duplicate` slide (family: presenter / editor / multi) | 🖱️R → 🖱️ | slide inserted after the source; slide-list count +1 (src: src/app-document-list/appDocumentHelpers.tsx:148) |
| CM-28 | `Move forward` slide | 🖱️R → 🖱️ | slide index +1; order persists (src: src/app-document-list/appDocumentHelpers.tsx:157) |
| CM-29 | `Move backward` slide | 🖱️R → 🖱️ | slide index −1; order persists (src: src/app-document-list/appDocumentHelpers.tsx:163) |
| CM-30 | `Enable` / `Disable` slide (label toggles on state) | 🖱️R → 🖱️ | slide `isDisabled` flips; thumbnail dims/undims (src: src/app-document-list/appDocumentHelpers.tsx:169) |
| CM-31 | `Edit ↗` slide (presenter opens editor window; in-editor selects the slide) | 🖱️R → 🖱️ | presenter: editor window opens at that slide (ED-10); editor: slide selected in-list (ED-03) (src: src/app-document-list/appDocumentHelpers.tsx:177) |
| CM-32 | `Delete` slide [D] (family: presenter/editor/multi) | 🖱️R → 🖱️ | duplicate a scratch slide (CM-27) and delete THAT → slide-list count −1 (ED-03 self-cleaning) (src: src/app-document-list/appDocumentHelpers.tsx:202) |
| CM-33 | `New Slide` — slide-list container empty area | 🖱️R → 🖱️ | a new blank slide is appended (src: src/app-document-list/AppDocument.ts:433) |
| CM-34 | `Paste` — slide-list container (only if slides copied) | 🖱️R → 🖱️ | the copied slide is inserted (src: src/app-document-list/AppDocument.ts:433) |
| CM-35 | `Paste Image` (family: slide-list container / bg Images body / canvas empty — only if clipboard holds an image) | 🖱️R → 🖱️ | clipboard image is inserted as a slide / bg item / canvas box (src: src/app-document-list/AppDocument.ts:433) |

> Office slide thumb menu (PM-38) and the attached-bg badge menu (PM-45)
> contain **only** shared-family items — CM-07 + CM-02 + CM-09 + CM-08 (office),
> CM-02 (badge) — so no distinct CM rows.

### Slide-editor canvas (`canvasContextMenuHelpers`) + box + error box + color picker

Canvas-box `Copy`/`Duplicate`/`Delete` reuse CM-26/27/32; box `Reveal…` (video)
reuses CM-02.

| ID | Target | Interactions | Pass condition |
|---|---|---|---|
| CM-36 | `New` — canvas empty area | 🖱️R → 🖱️ | a new text box is added to the canvas (src: src/slide-editor/canvas/canvasContextMenuHelpers.ts:29) |
| CM-37 | `Insert Medias` — canvas empty | 🖱️R → 🖱️ | native file pick (EX-01); selected media added as a box (src: src/slide-editor/canvas/canvasContextMenuHelpers.ts:29) |
| CM-38 | `Insert YouTube` — canvas empty | 🖱️R → 🖱️ | InputPopup for the URL; a youtube box is added (src: src/slide-editor/canvas/canvasContextMenuHelpers.ts:29) |
| CM-39 | `Insert Website` — canvas empty | 🖱️R → 🖱️ | InputPopup for the URL; a website box is added (src: src/slide-editor/canvas/canvasContextMenuHelpers.ts:29) |
| CM-40 | `Paste` (if copied items) · `Paste Bible Item` (if clipboard bible) — canvas empty | 🖱️R → 🖱️ | copied box(es) / a bible box are added to the canvas (src: src/slide-editor/canvas/canvasContextMenuHelpers.ts:29) |
| CM-41 | `Lookup` — canvas box (bible) | 🖱️R → 🖱️ | opens the Bible Lookup popup for that box (src: src/slide-editor/canvas/canvasContextMenuHelpers.ts:155) |
| CM-42 | `Lock` / `Unlock` — canvas box | 🖱️R → 🖱️ | box lock flips; Edit/Delete items gate on the new state (src: src/slide-editor/canvas/canvasContextMenuHelpers.ts:155) |
| CM-43 | `Open URL` / `Copy URL` — canvas youtube/website box | 🖱️R → 🖱️ | Open URL opens a browser tab (EX-04); Copy URL writes the URL to clipboard (src: src/slide-editor/canvas/canvasContextMenuHelpers.ts:155) |
| CM-44 | `Download` — canvas image box | 🖱️R → 🖱️ | the box image is downloaded to disk (src: src/slide-editor/canvas/canvasContextMenuHelpers.ts:155) |
| CM-45 | `Edit` — canvas text box (unlocked) | 🖱️R → 🖱️ | box enters text edit mode (ED-07) (src: src/slide-editor/canvas/canvasContextMenuHelpers.ts:155) |
| CM-46 | `Copy Error Json` — canvas error box (`Delete` = CM-32) | 🖱️R → 🖱️ | the box's error JSON is copied to the clipboard (src: src/slide-editor/canvas/box/BoxEditorNormalViewErrorComp.tsx:13) |
| CM-47 | `Copy Color` — slide-editor color picker (collapsed) | 🖱️R → 🖱️ | the picker's current color is copied to the clipboard (src: src/others/color/ColorPicker.tsx:90) |

### Background items (colors / images / videos / webs)

`Show on Screens` = CM-07; `Copy Path`/`Reveal`/`Move to Trash` = CM-01/02/06;
`Add Items`/`Download`/`Shared` bodies = CM-24; `Paste Image` = CM-35; camera
item = CM-07 only.

| ID | Target | Interactions | Pass condition |
|---|---|---|---|
| CM-48 | `Copy '<color>' to clipboard` — Colors swatch (`RenderColor`) | 🖱️R a swatch → 🖱️ | the color hex is written to the clipboard (src: src/others/color/RenderColor.tsx:13) |
| CM-49 | `Toggle Fading at End` — Videos item | 🖱️R → 🖱️ | the video's fade-at-end flag toggles (src: src/background/BackgroundVideosComp.tsx:160) |
| CM-50 | `Copy URL to Clipboard` — Webs item (`BackgroundWebUrlItemComp`) | 🖱️R → 🖱️ | the web-bg URL is copied to the clipboard (src: src/background/BackgroundWebUrlItemComp.tsx:60) |
| CM-51 | `Remove URL` — Webs item [D] (only if not on screen) | 🖱️R → 🖱️ | on a scratch URL: the item is removed from the Webs list (src: src/background/BackgroundWebUrlItemComp.tsx:60) |
| CM-52 | `New File` · `Add URL` · `Edit` — Webs empty body (`backgroundWebHelpers`) | 🖱️R empty area → 🖱️ | New File → InputPopup; Add URL / Edit → **Web Editor popup** (PU-04); a new web-bg item appears (src: src/background/backgroundWebHelpers.tsx:66) |

### Foreground widgets (Time / Images slideshow / Web)

Fg Web tile `Copy Path`/`Reveal`/`Show on Screens` = CM-01/02/07; body
`Open Shared Link` = CM-24.

| ID | Target | Interactions | Pass condition |
|---|---|---|---|
| CM-53 | `Choose City` — Foreground Time (button menu) | 🖱️ the button | a large timezone list `City (Area/City)` opens; picking sets the clock's timezone (src: src/presenter-foreground/ForegroundTimeComp.tsx:35) |
| CM-54 | Right-click `Show Time` — Foreground Time | 🖱️R the Show button | opens the Screen-id force chooser (CM-91 / SP-13) (src: src/presenter-foreground/ForegroundTimeComp.tsx:112) |
| CM-55 | `Scale Type` — Foreground Images Slide Show (button menu) | 🖱️ the button | lists `scaleTypeList` (stretch/fit/…); picking applies that scale to the slideshow (src: src/presenter-foreground/ForegroundImagesSlideShowComp.tsx:132) |
| CM-56 | `Edit` — Foreground Web tile | 🖱️R → 🖱️ | **Web Editor popup** target appears (PU-04) (src: src/presenter-foreground/ForegroundWebComp.tsx:167) |
| CM-57 | `New File` — Foreground Web empty body | 🖱️R empty → 🖱️ | InputPopup / a new fg-web file is created (src: src/presenter-foreground/ForegroundWebComp.tsx:313) |

### Bible & note lists — file menu + item menu

`Remove background` = CM-08; file tail = CM-01..06.

| ID | Target | Interactions | Pass condition |
|---|---|---|---|
| CM-58 | `Export to MS Word` — bible file (if hasItems) | 🖱️R → 🖱️ | exports a `.docx` (native save dialog, EX-01) (src: src/bible-list/BibleFileComp.tsx:36) |
| CM-59 | `Empty` — bible / note file (if hasItems) [D] | 🖱️R → 🖱️ | confirm "Yes" appears → **Cancel (EX-05)**; Yes clears all items from the file (src: src/bible-list/BibleFileComp.tsx:36) |
| CM-60 | `Copy All Items` — bible / note file | 🖱️R → 🖱️ | all items are copied to the clipboard (src: src/bible-list/BibleFileComp.tsx:36) |
| CM-61 | `Move All Items To` (file) / `Move To` (item) submenu (family: bible + note) | 🖱️R → 🖱️ | submenu lists the OTHER bible/note names; picking moves item(s) there; with ≤1 file ⇒ toast "No other bibles/notes found" (src: src/bible-list/bibleHelpers.ts:120) |
| CM-62 | `Open` (family: bible item, note item, lookup history, find result) | 🖱️R → 🖱️ | the item loads/opens (bible → into the view; note → into its editor) (src: src/bible-list/BibleItemRenderComp.tsx:113) |
| CM-63 | Bible copy family `Copy Title` · `Copy Text` · `Copy All` · `Copy Verse Full Key` · `Copy Chapter Full Key` (bible item, lookup history, lookup body, find result, copy-actions button RD-17) | 🖱️R → 🖱️ each | each writes the corresponding string to the clipboard (src: src/bible-list/bibleItemHelpers.ts:25) |
| CM-64 | `Lookup` — bible item (only if the lookup popup is available) | 🖱️R → 🖱️ | opens the Bible Lookup popup seeded with that verse (src: src/bible-list/BibleItemRenderComp.tsx:109) |
| CM-65 | `Duplicate` — bible / note list item | 🖱️R → 🖱️ | a copy of the item is inserted; list count +1 (src: src/bible-list/bibleHelpers.ts:173) |
| CM-66 | `Delete` — bible / note list item [D] (note confirms) | 🖱️R → 🖱️ | on a scratch item: item removed; list count −1 (note shows confirm → Cancel EX-05) (src: src/bible-list/note/noteHelpers.ts:58) |
| CM-67 | `Move up` (index≠0) · `Move down` (not last) — bible / note item | 🖱️R → 🖱️ | item index shifts; the item is disabled at the respective end (src: src/bible-list/note/noteHelpers.ts:104) |
| CM-68 | `New Note Item` — note file | 🖱️R → 🖱️ | a new empty note item is added to the file (src: src/bible-list/note/NoteFileComp.tsx:40) |
| CM-69 | `Import` — note file (default note only) | 🖱️R → 🖱️ | native import dialog (EX-01) (src: src/bible-list/note/NoteFileComp.tsx:40) |
| CM-70 | `Edit Title` — note item | 🖱️R → 🖱️ | InputPopup to rename the note title (GL-09) (src: src/bible-list/note/BibleNoteItemRenderComp.tsx:76) |
| CM-71 | `Export` — note item | 🖱️R → 🖱️ | native export dialog (EX-01) (src: src/bible-list/note/BibleNoteItemRenderComp.tsx:76) |

### Bible lookup / reader menus

| ID | Target | Interactions | Pass condition |
|---|---|---|---|
| CM-72 | `Save bible item` (family: lookup history RD-13, lookup body, find result) | 🖱️R → 🖱️ | the verse is saved into a bible-list file (src: src/bible-lookup/bibleActionHelpers.ts:43) |
| CM-73 | `Remove` — lookup history chip [D] | 🖱️R a history chip → 🖱️ | on a scratch lookup: the chip is removed from history (src: src/bible-lookup/BibleLookupInputHistoryComp.tsx:103) |
| CM-74 | `Open in Cross Reference` — lookup body verse (if verseKey, not editor) | 🖱️R → 🖱️ | the cross-reference view opens for that verse (RD-10) (src: src/bible-lookup/bibleActionHelpers.ts:43) |
| CM-75 | `Show bible item` — lookup body (presenter) | 🖱️R → 🖱️ | the verse presents on the mini-screen (restore after) (src: src/bible-lookup/bibleActionHelpers.ts:43) |
| CM-76 | `Save bible item and show on screen` — lookup body (presenter) | 🖱️R → 🖱️ | the verse is saved AND presented (src: src/bible-lookup/bibleActionHelpers.ts:43) |
| CM-77 | `Insert bible item` — lookup body (editor) | 🖱️R → 🖱️ | the verse is inserted into the current slide/canvas (src: src/bible-lookup/bibleActionHelpers.ts:43) |
| CM-78 | `Search in Bible Search` — bible view pane (lookup) | 🖱️R → 🖱️ | opens Bible Find with the selected text (src: src/bible-reader/BibleViewComp.tsx:93) |
| CM-79 | `Split Horizontal` · `Split Horizontal to` · `Split Vertical` · `Split Vertical to` — bible view pane | 🖱️R → 🖱️ | the pane splits into two views (H or V); the "…to" variants target a chosen version (src: src/bible-reader/BibleItemsViewController.ts:681) |
| CM-80 | `Toggle Widget Full View` — bible view pane | 🖱️R → 🖱️ | the pane toggles full-view (src: src/bible-reader/BibleViewComp.tsx:93) |
| CM-81 | `Close` — bible view pane (only if not the sole pane) | 🖱️R → 🖱️ | that view pane closes; siblings re-flow (src: src/bible-reader/BibleViewComp.tsx:93) |
| CM-82 | `Edit` — bible view pane title | 🖱️R → 🖱️ | opens the title editor (CM-83 / RD-16) (src: src/bible-reader/BibleViewComp.tsx:93) |
| CM-83 | Bible title-editor cascading pickers Book → Chapter → Verse Start → Verse End | 🖱️R a title span (⌨️ Ctrl = withCtrl) | cascading menus open (item 0 = disabled header, current disabled); choosing a target re-renders the verse (src: src/bible-reader/BibleViewTitleEditorComp.tsx:23) |
| CM-84 | Bible-key selector: `(KEY) Title` version options (current excluded) + `Add New Bible` | 🖱️ the bible-key badge | menu shows per-locale headers (disabled) + version options + `Add New Bible` (opens Bible setting); picking a version re-renders the verse (src: src/bible-lookup/BibleKeySelectionComp.tsx:81) |
| CM-85 | Wiki-dictionary language links (`English` + target lang + all lang codes) | 🖱️ the journal-text button | menu = `Open Wiki Dictionary` (disabled) + divider + language links; each opens wiktionary (EX-04) (src: src/bible-lookup/RenderOpenWikiDictionaryComp.tsx:36) |
| CM-86 | Bible model-info chooser `KEY - (Title)` models (current disabled) | 🖱️ the model button | menu lists models; picking one reloads the app (src: src/bible-reader/BibleModelInfoSettingComp.tsx:15) |
| CM-87 | `Refresh` (family: cross-reference view RD-22, reader audio player RD-23) | 🖱️R the view/player → 🖱️ | the single `Refresh` item re-renders the view / reloads the player (src: src/bible-cross-refs/BibleCrossRefWrapperComp.tsx:30) |

### Bible Find (search) menus

Result-item `Open` / copy family / `Save bible item` = CM-62 / CM-63 / CM-72.

| ID | Target | Interactions | Pass condition |
|---|---|---|---|
| CM-88 | Book-selector `All Books` · `Old Testament` (+OT books) · `New Testament` (+NT books) (`Shift + Click` multi) | 🖱️ the book button (⌨️ Shift) | menu opens; picking narrows the search scope; unavailable / only-selected entries are disabled (src: src/bible-find/RenderFindingInfoHeaderComp.tsx:40) |
| CM-89 | Extra-actions (⋮) `Reset Search Data` [D] · `Reset Selected Books` (disabled if none) | 🖱️ the ⋮ button | Reset Search Data → confirm → reload → **Cancel (EX-05)**; Reset Selected Books clears the book selection (src: src/bible-find/RenderFindingInfoHeaderComp.tsx:111) |

### Screen output / previewer force-choose

| ID | Target | Interactions | Pass condition |
|---|---|---|---|
| CM-90 | Force-choose-screen `Screen id: N` (one per screen) | 🖱️R a "Show on Screens" / fg Show (force), nothing selected | menu lists `Screen id: N` per screen; picking presents on THAT screen; dismissing resolves to none (SP-13) (src: src/_screen/managers/ScreenEventHandler.ts:142) |
| CM-91 | On-screen bible-key swap/add menu `<key>` (remove, if >1) + bible-key options (`Shift Click to Add` disabled) | 🖱️R a verse's key region on the `screen.html` target (⌨️ Shift) | picking swaps / adds bible versions live on the output (SC-06) (src: src/_screen/screenBibleHelpers.tsx:53) |

### Settings-page menus

Dir-path menu (ST-11) = CM-13 (setting-page drops `Edit Parent Path`).

| ID | Target | Interactions | Pass condition |
|---|---|---|---|
| CM-92 | Bible-XML editor tool `Reveal in File Explorer` · `Clear Cache` [D] | 🖱️R the XML cache tool → 🖱️ | Reveal → explorer (EX-01); Clear Cache clears the XML cache (src: src/setting/bible-setting/bibleXMLHelpers.ts:219) |

## KB — Keyboard-shortcut matrix (explicit pass)

| ID | Keys | Context | Pass condition |
|---|---|---|---|
| KB-01 | `Ctrl+B` (Mac `Meta+B`) | presenter/editor, root layer | lookup modal mounts in `#modal-container` (src: src/others/commonButtons.tsx:83) |
| KB-02 | `Ctrl+Q` | any `ModalComp` open | modal closes (`#modal-container` empties) (src: src/app-modal/ModalComp.tsx:16) |
| KB-03 | `F6` | presenter, something live | `screenManager.clear()` clears all layers; eraser flips solid→outline (src: src/_screen/preview/MiniScreenClearControlComp.tsx:60) |
| KB-04 | `F7` | presenter, bg live | `screenBackgroundManager.clear()` clears background (src: src/_screen/preview/MiniScreenClearControlComp.tsx:70) |
| KB-05 | `F8` | presenter, slide live | `screenVaryAppDocumentManager.clear()` clears slide (src: src/_screen/preview/MiniScreenClearControlComp.tsx:80) |
| KB-06 | `F9` | presenter, bible live | `screenBibleManager.clear()` clears bible (src: src/_screen/preview/MiniScreenClearControlComp.tsx:90) |
| KB-07 | `F10` | presenter, fg live | `screenForegroundManager.clear()` clears foreground (src: src/_screen/preview/MiniScreenClearControlComp.tsx:100) |
| KB-08 | `Arrow*`/`PageUp`/`PageDown`/`Space`/`Shift+Space` | slide container focused AND a slide already live | selection advances: `Space`/`ArrowRight`/`ArrowDown`/`PageDown`=NEXT, `Shift+Space`/`ArrowLeft`/`ArrowUp`/`PageUp`=previous; `Space` is next, NOT a toggle; disabled slides skipped; selected item presents (src: src/app-document-presenter/items/VarySlidesComp.tsx:52) |
| KB-09 | `Tab` / `Escape` / `Ctrl+Escape` | bible lookup input focused | `Tab`→completes chunk (adds `:`/`-`); `Escape`→drops last chunk (`removeInputTextChunk`, title "Clear input chunk [Escape]"); `Ctrl+Escape`→clears whole input (`removeInputText`, title "Clear input [Ctrl+Escape]") (src: src/bible-lookup/InputExtraButtonsComp.tsx:124) |
| KB-10 | `Ctrl+Enter` | editor page, `document.body` focused | canvas container `.focus()`ed (enables canvas item shortcuts KB-32..40) (src: src/slide-editor/canvas/canvas-container/CanvasContainerComp.tsx:138) |
| KB-11 | `Ctrl+S` (Mac `Meta+S`) | lyric/web/note/slide editor with unsaved change | slide→`historySave`; note/lyric→`SimpleNoteEditorComp` save (border `#007bff44`→transparent); NOTE lyric-editor Ctrl+S may be a title-only hint (no `useKeyboardRegistering` for `savingEventMapper`) — primary save is the `bi-floppy` button (PU-09); verify live (src: src/slide-editor/slideEditingKeyboardEventHelpers.ts:59) |
| KB-12 | `Enter` / `Escape` | a confirm/input popup open | `Enter`→confirm(true)+close (only if `enterToOk??true`); `Escape`→confirm(false)+close (only if `escToCancel??true`); `AlertPopupComp` has **Escape only**, no Enter (src: src/popup-widget/ConfirmPopupComp.tsx:29) |
| KB-13 | `F5` | presenter, previewer focused | toggles `screenManagerBase.isShowing` → `.showing` class + `screen.html?screenId=N` target appears/vanishes — pair SP-01; end hidden unless it started showing (src: src/_screen/preview/ShowHideScreen.tsx:13) |
| KB-14 | `Meta+Q` (macOS only) | app focused, mac | `showAppConfirm('Quick Exit'…)` popup; `Yes`→`window.close()`; intercepted before normal dispatch; BLOCKED→EX-03/host on Win/Linux (src: src/event/KeyboardEventListener.ts:357) |
| KB-15 | `F6` while a lookup modal is open | Bible Lookup modal open (adds `bible-lookup` layer) | Clear-All does NOT fire (fired key becomes `bible-lookup>F6`, no `root>F6` match); close the modal then `F6` clears — layer-suppression regression guard (src: src/event/KeyboardEventListener.ts:290) |
| KB-16 | `ArrowUp`/`ArrowDown`/`Tab`/`Enter` | a context menu is open | highlighted item moves; `Enter` (menu focused) invokes it and closes the menu; `Tab` invokes when `applyOnTab` (src: src/context-menu/appContextMenuHelpers.ts:329) |
| KB-17 | a printable letter | context menu open (not `noKeystroke`) | first menu item whose text starts with that char scrolls into view / highlights; repeat cycles matches (src: src/context-menu/appContextMenuHelpers.ts:280) |
| KB-18 | `Enter` | found-options/input focused, an option `.active` | the `.active` `.bible-lookup-book-option`/`.bible-lookup-chapter-option` is `.click()`-ed → picker advances (src: src/bible-lookup/selectionHelpers.tsx:235) |
| KB-19 | `ArrowLeft/Right/Up/Down` | book options rendered, render-found focused | `.active` (`OPTION_SELECTED_CLASS`) moves grid-wise across `.bible-lookup-book-option`; skips `disabled`; input blurs (src: src/bible-lookup/RenderBookOptionsComp.tsx:123) |
| KB-20 | `ArrowLeft/Right/Up/Down` | chapter options rendered, render-found focused | `.active` moves across `.bible-lookup-chapter-option` (src: src/bible-lookup/RenderChapterOptionsComp.tsx:146) |
| KB-21 | `ArrowUp`/`ArrowDown` | `#app-bible-lookup-input` focused | input blurs, `.bible-lookup-render-found` gains focus (enables KB-19/20) (src: src/bible-lookup/InputHandlerComp.tsx:66) |
| KB-22 | `Ctrl+Enter` | a found bible item shown (lookup) | `saveBibleItem` runs → item added to Bibles list; fail→toast `Adding Bible Item`; title shows `[Ctrl+Enter]` (src: src/bible-lookup/RenderEditingActionButtonsComp.tsx:33) |
| KB-23 | `Ctrl+Shift+Enter` | presenter page, found item | verse goes live (`.app-on-screen`; BB/F9 clear flips solid) AND item saved (src: src/bible-lookup/RenderEditingActionButtonsComp.tsx:68) |
| KB-24 | `Ctrl+Shift+Enter` | appDocumentEditor page, found item | new bible box inserted onto canvas (box count +1) (src: src/bible-lookup/RenderEditingActionButtonsComp.tsx:103) |
| KB-25 | `Ctrl+Shift+S` (Mac `Meta+Shift+S`) | lookup with a selected editing item | editing area splits → a second bible-item renderer appears left/right (renderer count +1) (src: src/bible-lookup/RenderEditingActionButtonsComp.tsx:132) |
| KB-26 | `Ctrl+Shift+V` (Mac `Meta+Shift+V`) | lookup with a selected editing item | editing area splits top/bottom (renderer count +1) (src: src/bible-lookup/RenderEditingActionButtonsComp.tsx:132) |
| KB-27 | `Ctrl+Shift+Arrow*` (Mac `Meta+Shift+Arrow*`) | ≥2 editing bible items, one selected | selection/edit outline moves to the neighbor item in that direction (src: src/bible-reader/readBibleHelpers.ts:158) |
| KB-28 | `Ctrl+W` (Mac `Meta+W`) | ≥2 editing bible items, one selected | current editing item deleted (renderer count −1); no-op when alone (src: src/bible-reader/readBibleHelpers.ts:188) |
| KB-29 | `Enter` / `Escape` | advance-lookup (Bible online find) input focused | `Enter`→runs search (results in `BibleFindRenderPerPageComp`); `Escape`→clears input to `''`; with suggestion menu open, `Enter` just closes it (src: src/bible-find/BibleFindHeaderComp.tsx:53) |
| KB-30 | `Ctrl+Enter` | bible-note editor's inner lookup open | collapsed bible full-text appended to the note (`bibleNote.addText`); title `[Ctrl+Enter]` (src: src/bible-list/note/NoteItemEditorPopupComp.tsx:80) |
| KB-31 | `Ctrl+Shift+Enter` | bible-note inner lookup open | bible text appended with `^` prefix marker (src: src/bible-list/note/NoteItemEditorPopupComp.tsx:87) |
| KB-32 | `Escape` | canvas focused, a mode active | `stopAllModes()` — editing/selection modes cleared (src: src/slide-editor/slideEditingKeyboardEventHelpers.ts:231) |
| KB-33 | `Tab` / `Shift+Tab` | canvas focused, ≥1 item | selection moves to next/previous canvas item by id (`data-app-box-editor-id` changes) (src: src/slide-editor/slideEditingKeyboardEventHelpers.ts:234) |
| KB-34 | `Delete` (Mac `Meta+Backspace`) | canvas item(s) selected | selected boxes removed (box DOM count −N) (src: src/slide-editor/slideEditingKeyboardEventHelpers.ts:258) |
| KB-35 | `Ctrl+C` (Mac `Meta+C`) | canvas item(s) selected | toast `Copied / Items are copied`; clipboard set (src: src/slide-editor/slideEditingKeyboardEventHelpers.ts:273) |
| KB-36 | `Ctrl+V` (Mac `Meta+V`) | items copied (or bible item in clipboard) | duplicated items appear (box count +N); or a bible-item box is added from clipboard (src: src/slide-editor/slideEditingKeyboardEventHelpers.ts:289) |
| KB-37 | `Ctrl+Shift+D` (Mac `Meta+Shift+D`) | canvas item(s) selected | selected items duplicated in place (box count +N) (src: src/slide-editor/slideEditingKeyboardEventHelpers.ts:312) |
| KB-38 | `Arrow*` | canvas item selected, canvas focused | `canvasController.onArrowing` nudges selected box position (x/y changes) (src: src/slide-editor/slideEditingKeyboardEventHelpers.ts:329) |
| KB-39 | `Ctrl+Z` / `Ctrl+Shift+Z` / `Ctrl+Y` | canvas, after an edit | `historyUndo()`/`historyRedo()` — document reverts/re-applies; Save dirty state flips (src: src/slide-editor/slideEditingKeyboardEventHelpers.ts:16) |
| KB-40 | `Escape` / `Ctrl+Enter` | inside a text box in edit mode | `Escape`→cancels, text unchanged, exits edit; `Ctrl+Enter`→commits draft, box switches to *selected* (props panel stays) (src: src/slide-editor/canvas/box/BoxEditorNormalTextEditModeComp.tsx:81) |
| KB-41 | `Escape` | ≥1 slide "held" | holding selection cleared (`setHoldingSlides([])`) (src: src/slide-editor/slideEditingKeyboardEventHelpers.ts:112) |
| KB-42 | `Ctrl+A` (Mac `Meta+A`) | slide list focused | all slides marked held (src: src/slide-editor/slideEditingKeyboardEventHelpers.ts:134) |
| KB-43 | `Ctrl+C` (Mac `Meta+C`) | slide(s) selected | toast `Copied / Slides are copied` (src: src/slide-editor/slideEditingKeyboardEventHelpers.ts:150) |
| KB-44 | `Ctrl+V` (Mac `Meta+V`) | slides copied | copied slides appended (slide count +N) — self-clean via delete (src: src/slide-editor/slideEditingKeyboardEventHelpers.ts:168) |
| KB-45 | `Delete` (Mac `Meta+Backspace`) | slide(s) held | held slides deleted (count −N) — use a scratch doc (src: src/slide-editor/slideEditingKeyboardEventHelpers.ts:117) |
| KB-46 | `Ctrl+Shift+D` (Mac `Meta+Shift+D`) | slide(s) selected | slides duplicated (count +N) (src: src/slide-editor/slideEditingKeyboardEventHelpers.ts:184) |
| KB-47 | `Ctrl+Z`/`Ctrl+Shift+Z`/`Ctrl+Y`/`Ctrl+S` | slide list focused, after edit | undo/redo/save via `handleHistory` (doc reverts / dirty clears) (src: src/slide-editor/slideEditingKeyboardEventHelpers.ts:201) |
| KB-48 | `Enter` / `Escape` | new-name/rename inline input focused | `Enter`(valid name)→`applyName(name)` (item created/renamed); `Escape`→`applyName(null)` (input dismissed) (src: src/others/AskingNewNameComp.tsx:23) |
| KB-49 | `Escape` / `Ctrl+S` / `Enter` | note/lyric text field focused | `Escape`→`onEscape` (close, when provided); `Ctrl+S`→save (border flips saved); `Enter`(input mode)→force-save + `onEnter` (src: src/others/SimpleNoteEditorComp.tsx:99) |
| KB-50 | `Enter` | color `input[type=color]` focused | `applyColor(localColor)` — chosen color applied immediately (bg/foreground restyles) (src: src/others/color/SelectCustomColor.tsx:73) |
| KB-51 | `Escape` | finder popup open | text present→clears text (input `value=''`); if empty→`globalThis.close()` (finder target disappears) (src: src/find/FinderAppComp.tsx:30) |
| KB-52 | `Ctrl+Q` | finder popup open | `globalThis.close()` — finder window closes (src: src/find/FinderAppComp.tsx:39) |
| KB-53 | `Ctrl+P` (Mac `Meta+P`) | any main window | `previewPrintCurrentWindow` → a `print-preview-*.pdf` CDP target appears (src: electron/electronMenu.ts:24) |
| KB-54 | `Ctrl+F` (Mac `Meta+F`) | any main window | `appController.openFindPage()` → Finder popup target appears in `list_pages` (the finder's real launch path for PU-01/KB-51/52) (src: electron/electronMenu.ts:17) |
| KB-55 | `Ctrl+R` / `Ctrl+Shift+R` | any main window | page reloads (GL-01 readiness resets) (src: electron/electronMenu.ts:185) |
| KB-56 | `Ctrl+Shift+I` / `F12` | any main window | DevTools opens/closes (may BLOCK under CDP session) (src: electron/electronMenu.ts:187) |
| KB-57 | `F11` | any main window | window toggles OS-fullscreen; ⚠ EX-02: never leave fullscreen during a live service — toggle+restore only (src: electron/electronMenu.ts:193) |
| KB-58 | `Ctrl+0` / `Ctrl++` / `Ctrl+-` | any main window | page zoom factor reset / increases / decreases (src: electron/electronMenu.ts:189) |
| KB-59 | `Ctrl+Z/Y`,`Ctrl+X/C/V`,`Ctrl+A` | a native text input focused | standard OS undo/cut/copy/paste/select-all in the input (overlaps in-app canvas/slide keys — verify no double-handling) (src: electron/electronMenu.ts:139) |
| KB-60 | non-mac `Ctrl+Q` (File▸Quit); mac `Meta+Q`/`Meta+H`/`Meta+W` | any main window | quits/closes/hides — **destructive**; EX-06 presence-only (do NOT actually quit); note `Ctrl+Q` also drives in-app KB-02/KB-14, a collision to document (src: electron/electronMenu.ts:99) |

## LT — Locale & theme passes

| ID | Target | Interactions | Pass condition |
|---|---|---|---|
| LT-01 | Primary pass | full matrix in the CURRENT locale/theme | (this is the main run) |
| LT-02 | Secondary locale spot-check | switch via ST-04; re-screenshot presenter/reader/settings; check header tabs, lists, buttons | labels translate (KB §1 map); no raw i18n keys; no clipped Khmer text; **restore** |
| LT-03 | Dark theme spot-check | via ST-05; screenshot presenter + settings | readable contrast; no invisible text; **restore** |
| LT-04 | Light theme spot-check | via ST-05 | same; **restore** |
| LT-05 | `SettingGeneralThemeComp` "System" theme option | ⌨️✎ theme `<select>` → "System"; emulate OS `prefers-color-scheme`; **restore** | app follows the OS scheme — `data-bs-theme`/documentElement resolves to OS light/dark and flips when the emulated OS scheme flips (distinct from LT-03 dark / LT-04 light); restore original theme (src: src/setting/SettingGeneralThemeComp.tsx:31-34) |

---

## Row counts (for the coverage denominator)

GL 22 · NAV 16 · PL 31 · PM 113 · PR 26 · RD 52 · ED 39 · ST 33 · PU 18 · SP 21 ·
SC 7 · CM 92 · KB 60 · LT 5 = **535 rows total**. Compute the denominator per run as
`535 − EXCLUDED` (hardware and policy exclusions vary by machine).

> Reminder: whatever the focus area, the **mandatory core** (SP-01, SP-02, SC-01,
> SC-02, PR-04, one clear key) must appear in every run's state file.
