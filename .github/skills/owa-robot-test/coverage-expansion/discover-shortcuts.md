# Robot-Unit-Test Inventory — Area: KEYBOARD SHORTCUTS

Static source sweep of every keyboard path in OWA. Maps each against the current
matrix (`KB-01..KB-13`, plus keyboard-relevant `SC-03`, `PU-01`). New paths are
proposed as `KB-14+`. Interaction legend: ⌨️ keyboard, 🖐️ hover-tooltip.

## How keyboard events are dispatched (context for every row below)

- All in-app shortcuts flow through `document.onkeydown` →
  `KeyboardEventListener.fireEvent` (`src/event/KeyboardEventListener.ts:352-376`).
  Keys are normalised to en-US physical codes (`toEnUsKey`, :128) so layout is
  irrelevant.
- **Layer system** (`KeyboardEventListener._layers`, :98, `addLayer`/`removeLayer`
  :118-124; driven by `WindowEventListener.fireEvent`
  `src/event/WindowEventListener.ts:16-24`). Every registered/fired key is prefixed
  with the *current last layer* (`toEventMapperKey`, :290-294). Layers:
  `root | bible-lookup | slide-edit | setting | context-menu`. Opening a modal /
  context-menu / setting pushes a layer, so **root-layer shortcuts (F5–F10, etc.)
  stop firing while a higher layer is open** — a real, testable behavior (KB-15).
- Registration API: `useKeyboardRegistering(eventMappers, listener, deps)` (:329).
  Control-key variants: `allControlKey` (Ctrl/Shift, platform-mapped),
  `wControlKey`/`mControlKey`/`lControlKey` (Win/Mac/Linux), `platform` gate.
- 32 in-app `useKeyboardRegistering(...)` call sites + 3 raw
  `onkeydown`/`keyup`/`addEventListener` handlers + several React `onKeyDown/onKeyUp`
  props + electron application-menu accelerators/roles. All enumerated below.

---

## Group A — Global / cross-cutting

| Proposed ID | Target (component) | Interaction | Keys | Given | When | Then (observable) | Source (file:line) | Status |
|---|---|---|---|---|---|---|---|---|
| KB-01 | `BibleLookupButtonComp` | ⌨️ | `Ctrl+B` (Mac `Meta+B`) | presenter/editor at root layer | press | lookup modal mounts in `#modal-container` | `src/others/commonButtons.tsx:83-94,126` | COVERED (note: Mac `Meta+B` variant exists via platform filter — matrix says Ctrl only) |
| KB-02 | `ModalCloseButton` | ⌨️ | `Ctrl+Q` | any `ModalComp` open | press | modal closes (`#modal-container` empties) | `src/app-modal/ModalComp.tsx:16,22` | COVERED |
| KB-14 | `KeyboardEventListener.onMacQuitting` | ⌨️ | `Meta+Q` (macOS only) | app focused, mac | press | `showAppConfirm('Quick Exit'…)` popup appears; `Yes`→`window.close()`; intercepted BEFORE normal dispatch | `KeyboardEventListener.ts:357-373`, `src/others/main.tsx:146-158` | GAP (mac-only; BLOCKED→EX-03/host on Win/Linux) |
| KB-15 | Layer suppression | ⌨️ | `F6` while lookup modal open | open Bible Lookup modal (adds `bible-lookup` layer) | press `F6` | Clear-All does **NOT** fire (fired key becomes `bible-lookup>F6`, no match for `root>F6`); close modal then `F6` clears | `KeyboardEventListener.ts:290-294`, `WindowEventListener.ts:16-24` | GAP (architecture behavior; high-value regression guard) |
| KB-16 | `AppContextMenuComp` keyboard nav | ⌨️ | `ArrowUp`/`ArrowDown`/`Tab`/`Enter` | a context menu is open (🖱️R something) | arrows | highlighted item moves; `Enter` (menu focused) invokes it and closes menu; `Tab` invokes when `applyOnTab` | `src/context-menu/appContextMenuHelpers.ts:329-343`, `checkKeyUpDown` :203-243 | GAP |
| KB-17 | `AppContextMenuComp` type-ahead | ⌨️✎ | a printable letter | context menu open (not `noKeystroke`) | type e.g. `d` | first menu item whose text starts with that char scrolls into view / highlights; repeat cycles matches | `appContextMenuHelpers.ts:280-299` (`listener`), registered :320 | GAP |

## Group B — Bible lookup / reader (book·chapter·verse picker + found-item editing)

| Proposed ID | Target (component) | Interaction | Keys | Given | When | Then (observable) | Source (file:line) | Status |
|---|---|---|---|---|---|---|---|---|
| KB-09 | `InputExtraButtonsComp` | ⌨️ | `Tab` / `Escape` / `Ctrl+Escape` | lookup input focused | press | `Tab`→completes chunk (adds `:`/`-`); `Escape`→removes last chunk (or refocuses input); `Ctrl+Escape`→clears whole input | `src/bible-lookup/InputExtraButtonsComp.tsx:72-77,124-145` | COVERED |
| KB-18 | `userEnteringSelected` (book/chapter Enter) | ⌨️ | `Enter` | found-options or input focused, an option `.active` | press | the `.active` `.bible-lookup-book-option` / `.bible-lookup-chapter-option` is `.click()`-ed → picker advances | `src/bible-lookup/selectionHelpers.tsx:235-253`; used `RenderBookOptionsComp.tsx:138`, `RenderChapterOptionsComp.tsx:161` | GAP |
| KB-19 | `RenderBookOptionsComp` arrow-nav | ⌨️ | `ArrowLeft/Right/Up/Down` | book options rendered, render-found focused | press | `.active` (`OPTION_SELECTED_CLASS`) moves grid-wise across `.bible-lookup-book-option`; skips `disabled`; input blurs | `RenderBookOptionsComp.tsx:123-137`, `processSelection` `selectionHelpers.tsx:203-231` | GAP |
| KB-20 | `RenderChapterOptionsComp` arrow-nav | ⌨️ | `ArrowLeft/Right/Up/Down` | chapter options rendered, render-found focused | press | `.active` moves across `.bible-lookup-chapter-option` | `RenderChapterOptionsComp.tsx:146-160` | GAP |
| KB-21 | `InputHandlerComp` input→found | ⌨️ | `ArrowUp`/`ArrowDown` | `#app-bible-lookup-input` focused | press | input blurs, `.bible-lookup-render-found` gains focus (`document.activeElement` flips) enabling KB-19/20 | `src/bible-lookup/InputHandlerComp.tsx:66-76` | GAP |
| KB-22 | `SaveButtonComp` | ⌨️ | `Ctrl+Enter` | a found bible item shown (lookup) | press | `saveBibleItem` runs → item added to Bibles list; fail→toast `Adding Bible Item`; button title shows `[Ctrl+Enter]` | `RenderEditingActionButtonsComp.tsx:33-44`, mapper `bibleActionHelpers.ts:21-24` | GAP |
| KB-23 | `SaveAndShowButtonComp` | ⌨️ | `Ctrl+Shift+Enter` | **presenter** page, found item | press | verse goes live (`.app-on-screen`; BB/F9 clear button flips solid) AND item saved | `RenderEditingActionButtonsComp.tsx:68-79`, mapper :16-19 | GAP |
| KB-24 | `InsertBibleItemToSlideButtonComp` | ⌨️ | `Ctrl+Shift+Enter` | **appDocumentEditor** page, found item | press | new bible box inserted onto canvas (box count +1) | `RenderEditingActionButtonsComp.tsx:103-113` | GAP |
| KB-25 | Split-horizontal shortcut | ⌨️ | `Ctrl+Shift+S` (Mac `Meta+Shift+S`) | lookup with a selected editing item | press | editing area splits → a second bible-item renderer appears left/right (renderer count +1) | `RenderEditingActionButtonsComp.tsx:132-148`, `ctrlShiftMetaKeys` `LookupBibleItemController.ts:41-45` | GAP |
| KB-26 | Split-vertical shortcut | ⌨️ | `Ctrl+Shift+V` (Mac `Meta+Shift+V`) | lookup with a selected editing item | press | editing area splits top/bottom (renderer count +1) | `RenderEditingActionButtonsComp.tsx:132-148` | GAP |
| KB-27 | `useNextEditingBibleItem` | ⌨️ | `Ctrl+Shift+Arrow*` (Mac `Meta+Shift+Arrow*`) | ≥2 editing bible items, one selected | press | selection/edit outline moves to the neighbor item in that direction | `src/bible-reader/readBibleHelpers.ts:158-176` | GAP |
| KB-28 | `useCloseBibleItemRenderer` | ⌨️ | `Ctrl+W` (Mac `Meta+W`) | ≥2 editing bible items, one selected | press | current editing item is deleted (renderer count −1); no-op when alone | `readBibleHelpers.ts:188-198`, `closeEventMapper` `LookupBibleItemController.ts:34-39` | GAP |
| KB-29 | `BibleFindHeaderComp` (Bible online find) | ⌨️ | `Enter` / `Escape` | advance-lookup find input focused | press | `Enter`→runs search (results render in `BibleFindRenderPerPageComp`); `Escape`→clears input value to `''`; when suggestion menu open, `Enter` just closes it | `src/bible-find/BibleFindHeaderComp.tsx:53-74` | GAP |

## Group C — Bible-note popup

| Proposed ID | Target (component) | Interaction | Keys | Given | When | Then (observable) | Source (file:line) | Status |
|---|---|---|---|---|---|---|---|---|
| KB-30 | `NoteItemEditorPopupComp` insert-collapsed | ⌨️ | `Ctrl+Enter` | bible-note editor's inner lookup open | press | collapsed bible full-text appended to the note (`bibleNote.addText(text)`); button title `[Ctrl+Enter]` | `src/bible-list/note/NoteItemEditorPopupComp.tsx:80-86` | GAP |
| KB-31 | `NoteItemEditorPopupComp` insert-text | ⌨️ | `Ctrl+Shift+Enter` | bible-note inner lookup open | press | bible text appended with `^` prefix marker | `NoteItemEditorPopupComp.tsx:87-95` | GAP |

## Group D — Slide editor: canvas items (`onCanvasKeyboardEvent`)

Container: `SlideEditorCanvasComp` `.editor-container` (`tabIndex=0`,
`onKeyDown=handleKeyDownEvent`, only when it is `document.activeElement`)
→ `onCanvasKeyboardEvent` `src/slide-editor/slideEditingKeyboardEventHelpers.ts:211-336`.

| Proposed ID | Target | Interaction | Keys | Given | When | Then (observable) | Source (file:line) | Status |
|---|---|---|---|---|---|---|---|---|
| KB-10 | `CanvasContainerComp` focus | ⌨️ | `Ctrl+Enter` | editor page, `document.body` focused | press | canvas container `.focus()`ed (enables KB-32..39) | `src/slide-editor/canvas/canvas-container/CanvasContainerComp.tsx:138-155` | COVERED |
| KB-32 | canvas Escape | ⌨️ | `Escape` | canvas focused, a mode active | press | `stopAllModes()` — editing/selection modes cleared | `slideEditingKeyboardEventHelpers.ts:231-233` | GAP |
| KB-33 | canvas cycle items | ⌨️ | `Tab` / `Shift+Tab` | canvas focused, ≥1 item | press | selection moves to next / previous canvas item by id (selected `data-app-box-editor-id` changes) | `slideEditingKeyboardEventHelpers.ts:234-257` | GAP |
| KB-34 | canvas delete items | ⌨️ | `Delete` (Mac `Meta+Backspace`) | item(s) selected | press | selected boxes removed (box DOM count −N) | `slideEditingKeyboardEventHelpers.ts:258-272` | GAP |
| KB-35 | canvas copy items | ⌨️ | `Ctrl+C` (Mac `Meta+C`) | item(s) selected | press | toast `Copied / Items are copied`; clipboard set | `slideEditingKeyboardEventHelpers.ts:273-288` | GAP |
| KB-36 | canvas paste items / bible | ⌨️ | `Ctrl+V` (Mac `Meta+V`) | items copied (or bible item in clipboard) | press | duplicated items appear (box count +N); or a bible item box is added from clipboard | `slideEditingKeyboardEventHelpers.ts:289-311` | GAP |
| KB-37 | canvas duplicate items | ⌨️ | `Ctrl+Shift+D` (Mac `Meta+Shift+D`) | item(s) selected | press | selected items duplicated in place (box count +N) | `slideEditingKeyboardEventHelpers.ts:312-326` | GAP |
| KB-38 | canvas move item | ⌨️ | `Arrow*` | item selected, canvas focused | press | `canvasController.onArrowing` nudges selected box position (x/y changes) | `slideEditingKeyboardEventHelpers.ts:329`, `CanvasController.ts:498-504,49` | GAP |
| KB-39 | canvas undo/redo | ⌨️ | `Ctrl+Z` / `Ctrl+Shift+Z` / `Ctrl+Y` (Win/Linux) | after an edit | press | `historyUndo()`/`historyRedo()` — document reverts/re-applies; Save button dirty state flips | `slideEditingKeyboardEventHelpers.ts:16-75,201,327` | GAP |
| KB-40 | `BoxEditorNormalTextEditModeComp` | ⌨️ | `Escape` / `Ctrl+Enter` | inside a text box in edit mode | press | `Escape`→cancels, text unchanged, exits edit; `Ctrl+Enter`→commits draft, box switches to *selected* (props panel stays) | `src/slide-editor/canvas/box/BoxEditorNormalTextEditModeComp.tsx:81-91` | GAP |

## Group E — Slide list / thumbnails (`onSlideItemsKeyboardEvent`, presenter+editor)

Container: `VarySlidesPreviewerComp` `.app-focusable` (`tabIndex=0`,
`onKeyDown=handleContainerKeyDown` when it is `activeElement`, `onBlur`) →
`onSlideItemsKeyboardEvent` `slideEditingKeyboardEventHelpers.ts:77-209`.

| Proposed ID | Target | Interaction | Keys | Given | When | Then (observable) | Source (file:line) | Status |
|---|---|---|---|---|---|---|---|---|
| KB-08 | `VarySlidesComp` navigate | ⌨️ | `Arrow*`/`PageUp`/`PageDown`/`Space`/`Shift+Space` | slide container focused | press | selection advances: `Space`/`ArrowRight`/`ArrowDown`/`PageDown`=**next**, `Shift+Space`/`ArrowLeft`/`ArrowUp`/`PageUp`=**previous** (selected item presents) | `src/app-document-presenter/items/VarySlidesComp.tsx:52-59,91-97`, `handleSlideMoving` `varyAppDocumentHelpers.ts:185-212` | REFINE (matrix says "Space toggles" — it is **next**, not a toggle; add `Shift+Space`=prev) |
| KB-41 | slide-list Escape | ⌨️ | `Escape` | ≥1 slide "held" | press | holding selection cleared (`setHoldingSlides([])`) | `slideEditingKeyboardEventHelpers.ts:112-116` | GAP |
| KB-42 | slide-list select-all | ⌨️ | `Ctrl+A` (Mac `Meta+A`) | slide list focused | press | all slides marked held | `slideEditingKeyboardEventHelpers.ts:134-149` | GAP |
| KB-43 | slide-list copy | ⌨️ | `Ctrl+C` (Mac `Meta+C`) | slide(s) selected | press | toast `Copied / Slides are copied` | `slideEditingKeyboardEventHelpers.ts:150-167` | GAP |
| KB-44 | slide-list paste | ⌨️ | `Ctrl+V` (Mac `Meta+V`) | slides copied | press | copied slides appended (slide count +N) — self-clean via delete | `slideEditingKeyboardEventHelpers.ts:168-183` | GAP |
| KB-45 | slide-list delete | ⌨️ | `Delete` (Mac `Meta+Backspace`) | slide(s) held | press | held slides deleted (count −N) — use a scratch doc | `slideEditingKeyboardEventHelpers.ts:117-133` | GAP |
| KB-46 | slide-list duplicate | ⌨️ | `Ctrl+Shift+D` (Mac `Meta+Shift+D`) | slide(s) selected | press | slides duplicated (count +N) | `slideEditingKeyboardEventHelpers.ts:184-200` | GAP |
| KB-47 | slide-list history/save | ⌨️ | `Ctrl+Z`/`Ctrl+Shift+Z`/`Ctrl+Y`/`Ctrl+S` | slide list focused, after edit | press | undo/redo/save via `handleHistory` (doc reverts / dirty clears) | `slideEditingKeyboardEventHelpers.ts:201-203,16-75` | GAP |

## Group F — Editors save + inline text inputs

| Proposed ID | Target | Interaction | Keys | Given | When | Then (observable) | Source (file:line) | Status |
|---|---|---|---|---|---|---|---|---|
| KB-11 | Editor save | ⌨️ | `Ctrl+S` (Mac `Meta+S`) | lyric/web/note/slide editor with unsaved change | press | saved: slide→`historySave`; note/lyric→`SimpleNoteEditorComp` save (border `#007bff44`→transparent) | `slideEditingKeyboardEventHelpers.ts:59-74`, `src/others/SimpleNoteEditorComp.tsx:114-133` | COVERED |
| KB-48 | `AskingNewNameComp` | ⌨️ | `Enter` / `Escape` | new-name/rename inline input focused | press | `Enter`(valid name)→`applyName(name)` (item created/renamed); `Escape`→`applyName(null)` (input dismissed) | `src/others/AskingNewNameComp.tsx:23-33` | GAP |
| KB-49 | `SimpleNoteEditorComp` | ⌨️ | `Escape` / `Ctrl+S` / `Enter` | note/lyric text field focused | press | `Escape`→`onEscape` (close, when provided); `Ctrl+S`→save (border flips saved); `Enter`(input mode)→force-save + `onEnter` | `SimpleNoteEditorComp.tsx:99-141` | GAP |
| KB-50 | `SelectCustomColor` | ⌨️ | `Enter` | color `input[type=color]` focused | press | `applyColor(localColor)` — chosen color applied immediately (bg/foreground restyles) | `src/others/color/SelectCustomColor.tsx:73-81` | GAP |

## Group G — Confirm / input / alert popups

| Proposed ID | Target | Interaction | Keys | Given | When | Then (observable) | Source (file:line) | Status |
|---|---|---|---|---|---|---|---|---|
| KB-12 | `ConfirmPopupComp` / `InputPopupComp` | ⌨️ | `Enter` / `Escape` | a confirm/input popup open | press | `Enter`→confirm(true)+close (only if `enterToOk??true`); `Escape`→confirm(false)+close (only if `escToCancel??true`) | `src/popup-widget/ConfirmPopupComp.tsx:29-47`, `InputPopupComp.tsx:28-46` | REFINE (matrix omits the `enterToOk`/`escToCancel` opt-out flags; and `AlertPopupComp` has **Escape only**, no Enter — `AlertPopupComp.tsx:19-26`) |

## Group H — Screen output window (`screen.html`)

| Proposed ID | Target | Interaction | Keys | Given | When | Then (observable) | Source (file:line) | Status |
|---|---|---|---|---|---|---|---|---|
| KB-13 | `ShowHideScreen` | ⌨️ | `F5` | presenter, previewer focused | press | toggles `screenManagerBase.isShowing` → `.showing` class + `screen.html?screenId=N` target appears/vanishes | `src/_screen/preview/ShowHideScreen.tsx:13-22` | COVERED |
| KB-03 | Clear All | ⌨️ | `F6` | something live | press | `screenManager.clear()`; eraser button flips solid→outline | `src/_screen/preview/MiniScreenClearControlComp.tsx:60-69` | COVERED |
| KB-04 | Clear Background | ⌨️ | `F7` | bg live | press | `screenBackgroundManager.clear()` | `MiniScreenClearControlComp.tsx:70-79` | COVERED |
| KB-05 | Clear Slide | ⌨️ | `F8` | slide live | press | `screenVaryAppDocumentManager.clear()` | `MiniScreenClearControlComp.tsx:80-89` | COVERED |
| KB-06 | Clear Bible | ⌨️ | `F9` | bible live | press | `screenBibleManager.clear()` | `MiniScreenClearControlComp.tsx:90-99` | COVERED |
| KB-07 | Clear Foreground | ⌨️ | `F10` | fg live | press | `screenForegroundManager.clear()` | `MiniScreenClearControlComp.tsx:100-109` | COVERED |
| SC-03 | screen bible prev/next | ⌨️ | `Ctrl+ArrowLeft/Right` **or** `Alt+ArrowLeft/Right` | bible verse live, on the `screen.html` target | `press_key` | `screen:app:change-bible` sent → verse steps prev/next (mirror on mini-screen) | `src/screen.tsx:24-35` | COVERED (note: `Alt` also works, not only `Ctrl`) |

## Group I — Finder popup (`FinderAppComp`)

| Proposed ID | Target | Interaction | Keys | Given | When | Then (observable) | Source (file:line) | Status |
|---|---|---|---|---|---|---|---|---|
| PU-01 | `FinderAppComp` Enter | ⌨️ | `Enter` | finder open, text entered | press | `findNext` forward — next match highlighted/scrolled | `src/find/FinderAppComp.tsx:47-57` | REFINE (matrix PU-01 lumps keys; note there is **no Shift+Enter** — Enter is always forward; prev only via ◀ button) |
| KB-51 | `FinderAppComp` Escape | ⌨️ | `Escape` | finder open | press | if text present→clears text (input `value=''`); if empty→`globalThis.close()` (finder target disappears) | `FinderAppComp.tsx:30-38` | GAP |
| KB-52 | `FinderAppComp` close | ⌨️ | `Ctrl+Q` | finder open | press | `globalThis.close()` — finder window closes | `FinderAppComp.tsx:39-45` | GAP |

## Group J — Electron application-menu accelerators / roles (OS-level, main-window)

Registered in `electron/electronMenu.ts` via `Menu.buildFromTemplate` (:290).
These fire even when no in-app handler exists, and some **collide** with in-app
keys — worth explicit rows.

| Proposed ID | Target | Interaction | Keys | Given | When | Then (observable) | Source (file:line) | Status |
|---|---|---|---|---|---|---|---|---|
| KB-53 | File ▸ Print | ⌨️ | `Ctrl+P` (Mac `Meta+P`) | any main window | press | `previewPrintCurrentWindow` → a `print-preview-*.pdf` CDP target appears | `electronMenu.ts:24-29,109-121` | GAP |
| KB-54 | Edit ▸ Find | ⌨️ | `Ctrl+F` (Mac `Meta+F`) | any main window | press | `appController.openFindPage()` → **Finder popup target appears** in `list_pages` (this is the finder's real launch path for PU-01/KB-51/52) | `electronMenu.ts:17-22,145-151` | GAP |
| KB-55 | View ▸ Reload / Force Reload | ⌨️ | `Ctrl+R` / `Ctrl+Shift+R` (role defaults) | any main window | press | page reloads (GL-01 readiness resets) | `electronMenu.ts:185-186` | GAP |
| KB-56 | View ▸ Toggle DevTools | ⌨️ | `Ctrl+Shift+I` / `F12` (role default) | any main window | press | DevTools opens/closes | `electronMenu.ts:187` | GAP (may BLOCK under CDP session) |
| KB-57 | View ▸ Toggle Fullscreen | ⌨️ | `F11` (role default) | any main window | press | window toggles OS-fullscreen | `electronMenu.ts:193` | GAP (⚠ EX-02: never leave fullscreen during a live service — toggle+restore only) |
| KB-58 | View ▸ Zoom | ⌨️ | `Ctrl+0` / `Ctrl++` / `Ctrl+-` (role defaults) | any main window | press | page zoom factor reset / increases / decreases | `electronMenu.ts:189-191` | GAP |
| KB-59 | Edit ▸ clipboard roles | ⌨️ | `Ctrl+Z/Y`,`Ctrl+X/C/V`,`Ctrl+A` (role defaults) | a native text input focused | press | standard OS undo/cut/copy/paste/select-all in the input | `electronMenu.ts:139-144,152-169` | GAP (overlaps in-app canvas/slide keys — verify no double-handling) |
| KB-60 | Quit / Close / Hide | ⌨️ | non-mac `Ctrl+Q` (File▸Quit); mac `Meta+Q`/`Meta+H`/`Meta+W` | any main window | press | quits/closes/hides — **destructive** | `electronMenu.ts:99,132`, appMenu :95-99 | GAP (EX-06: presence-only — do NOT actually quit; note `Ctrl+Q` also drives in-app KB-02/KB-14, a collision to document) |

---

### Summary

- **COVERED: 14** — KB-01, KB-02, KB-03, KB-04, KB-05, KB-06, KB-07, KB-09, KB-10,
  KB-11, KB-13, SC-03 (+ two COVERED-with-note flags folded into KB-01 and SC-03).
- **REFINE: 3** — KB-08, KB-12, PU-01.
- **GAP: 47** — KB-14 … KB-60.

REFINE (6-word hooks):
- **KB-08** — Space is next, not a toggle.
- **KB-12** — Add enterToOk/escToCancel flags; Alert Escape-only.
- **PU-01** — Enter always forward; no Shift+Enter.

GAP (6-word hooks):
- **KB-14** — Mac Meta+Q quit-confirm popup path.
- **KB-15** — Modal layer suppresses root F-keys.
- **KB-16** — Context-menu arrow/Tab/Enter keyboard navigation.
- **KB-17** — Context-menu type-ahead letter jump.
- **KB-18** — Enter selects highlighted book/chapter option.
- **KB-19** — Book options arrow-key grid navigation.
- **KB-20** — Chapter options arrow-key navigation.
- **KB-21** — Input ArrowUp/Down focuses found options.
- **KB-22** — Ctrl+Enter saves the bible item.
- **KB-23** — Ctrl+Shift+Enter saves and presents verse.
- **KB-24** — Ctrl+Shift+Enter inserts bible into slide.
- **KB-25** — Ctrl+Shift+S splits bible item horizontal.
- **KB-26** — Ctrl+Shift+V splits bible item vertical.
- **KB-27** — Ctrl+Shift+Arrow navigates editing bible items.
- **KB-28** — Ctrl+W closes current editing item.
- **KB-29** — Bible-find Enter searches, Escape clears.
- **KB-30** — Ctrl+Enter inserts collapsed bible note.
- **KB-31** — Ctrl+Shift+Enter inserts bible note text.
- **KB-32** — Escape stops all canvas modes.
- **KB-33** — Tab/Shift+Tab cycles canvas items.
- **KB-34** — Delete removes selected canvas items.
- **KB-35** — Ctrl+C copies canvas items (toast).
- **KB-36** — Ctrl+V pastes items or bible.
- **KB-37** — Ctrl+Shift+D duplicates canvas items.
- **KB-38** — Arrow keys nudge selected box.
- **KB-39** — Ctrl+Z/Y undo-redo on canvas.
- **KB-40** — Box edit Escape cancel, Ctrl+Enter commit.
- **KB-41** — Escape clears held slide selection.
- **KB-42** — Ctrl+A selects all slides.
- **KB-43** — Ctrl+C copies slides (toast).
- **KB-44** — Ctrl+V pastes copied slides.
- **KB-45** — Delete removes held slides.
- **KB-46** — Ctrl+Shift+D duplicates selected slides.
- **KB-47** — Slide-list Ctrl+Z/Y/S history and save.
- **KB-48** — New-name input Enter/Escape apply-cancel.
- **KB-49** — SimpleNoteEditor Escape/Ctrl+S/Enter save paths.
- **KB-50** — Custom-color input Enter applies color.
- **KB-51** — Finder Escape clears then closes.
- **KB-52** — Finder Ctrl+Q closes the window.
- **KB-53** — Ctrl+P prints via preview PDF.
- **KB-54** — Ctrl+F opens the Finder popup.
- **KB-55** — Ctrl+R reload / force-reload roles.
- **KB-56** — F12 toggles DevTools window.
- **KB-57** — F11 toggles OS fullscreen (caution).
- **KB-58** — Ctrl+0/plus/minus zoom the page.
- **KB-59** — Edit-menu clipboard role accelerators in inputs.
- **KB-60** — Quit/close/hide accelerators (presence-only, destructive).
