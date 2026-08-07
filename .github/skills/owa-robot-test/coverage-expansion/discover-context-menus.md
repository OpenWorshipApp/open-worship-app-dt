# Context-Menu Test-Path Inventory (source sweep)

Assigned area: **context menus** — every `showAppContextMenu` / `genContextMenu` /
`onContextMenu` call site and every ITEM inside each menu. Static source sweep only
(no live testing).

## How the menu renders (observable hooks for a black-box driver)

- All menus route through `showAppContextMenu(event, items[], options?)`
  (`src/context-menu/appContextMenuHelpers.ts`). The open menu is
  `#app-context-menu-container .app-context-menu`; each item is a
  `.app-context-menu-item` div. A **disabled** item has no active handler; a
  highlighted (keyboard) item gets `app-border-whiter-round`.
- **Assert item set:** `[...document.querySelectorAll('#app-context-menu-container .app-context-menu-item')].map(e=>e.textContent)`.
- Open fires `WindowEventListener` `{widget:'context-menu', state:'open'|'close'}`.
- Empty `items` ⇒ **no menu opens** (early return) — an observable in itself.
- `options.shouldHandleSelectedText` prepends text-selection items when a
  selection exists (see GL-15). `options.applyOnTab` makes `Tab` activate the
  highlighted item (see KB-14).
- Item shape (`ContextMenuItemType`): `{menuElement, title?, onSelect?, disabled?,
  childBefore?, childAfter?, keyboardShortcut?}`. `elementDivider` is a separator row.

## Composition of the generic list-item menu (critical — many rows reuse it)

`FileItemHandlerComp.handleContextMenuOpening` (`src/others/FileItemHandlerComp.tsx:169`)
builds every list-item menu as: `[...contextMenuItems (component-specific)] +
genCommonMenu + genContextMenu(self) + genTrashContextMenu`. So EVERY item that
renders through `FileItemHandlerComp` (documents, lyrics, bible files, note files)
always ends with: **Copy Path to Clipboard · Reveal in File Explorer · Duplicate ·
Rename · Reload · Move to Trash** (see GL-14).

---

## Table

| Proposed ID | Target (component) | Interaction | Keys | Given | When | Then (observable) | Source | Status |
|---|---|---|---|---|---|---|---|---|
| GL-06 | `AppContextMenuComp` open/dismiss | 🖱️R / ⌨️ | Escape | any menu-bearing item | right-click → menu; press `Escape`; click-away | `.app-context-menu` appears at cursor; both dismissals remove it (fires `context-menu` close event) | context-menu/appContextMenuHelpers.ts:117; AppContextMenuComp.tsx | COVERED |
| GL-14 | Generic file-item base menu (`genCommonMenu`+`genContextMenu`+`genTrashContextMenu`) | 🖱️R | — | any list item via `FileItemHandlerComp` | right-click any doc/lyric/bible/note row | menu tail = exactly `Copy Path to Clipboard, Reveal in File Explorer, Duplicate, Rename, Reload, Move to Trash` | FileItemHandlerComp.tsx:27,44,71,169 | GAP |
| GL-15 | Selected-text menu (`genSelectedTextContextMenus`) | 🖱️R | — | text selected inside a bible view | right-click with a non-empty selection | prepends `Copy Selected Text`, `Search Selected Text on Google`, `Dictionary for Selected Text` (last only if `data-dict-locale` present) + divider | helper/textSelectionHelpers.ts:62 | GAP |
| GL-16 | Text `input` right-click (`InputContextMenuHandler`) | 🖱️R | — | any `input[type=text/search/email/password/number/tel]` | right-click the input | menu = `Paste` (if clipboard non-empty) and/or `Clear` (if value non-empty); none ⇒ no menu | helper/domHelpers.ts:237 | GAP |
| GL-17 | `ResizeActorComp`/`FlexResizeActorComp` splitter | 🖱️R | — | any multi-pane layout | right-click a splitter handle | menu = `Reset Size`, `Close First Widget`, `Close Second Widget`; each resizes/collapses a pane | resize-actor/FlexResizeActorComp.tsx:330 | GAP |
| GL-18 | `PathSelectorComp` dir-path header | 🖱️R | — | a list with a directory path set | right-click the path row | menu = `Copy to Clipboard`, `Reveal in File Explorer`, `Edit Parent Path` (hidden on setting page), `Unset Directory Path`; empty path ⇒ no menu | others/PathSelectorComp.tsx:21 | GAP |
| GL-19 | `PathPreviewerComp` | 🖱️R | — | a path previewer with `canOpenFileExplorer` | right-click | single item `Reveal in File Explorer`; without the flag no menu | others/PathPreviewerComp.tsx:52 | GAP |
| KB-14 | Context-menu keyboard navigation | ⌨️ | ArrowUp/Down, Enter, Tab, letter | a menu is open | Arrow moves highlight (`app-border-whiter-round` cycles, wraps); Enter activates highlighted (only if container focused); first-letter jumps to next match; `Tab` activates when `applyOnTab` | assertions per key: highlight class moves; onSelect fires; type-ahead scrolls to matching item | appContextMenuHelpers.ts:185,203,280 | GAP |
| PL-03 | OWA document item menu (`VaryAppDocumentFileComp`) | 🖱️R | — | an `.ows` doc row selected | right-click | items = `Edit ↗` (opens editor window), `Print` (AppDocument only) + GL-14 tail | VaryAppDocumentFileComp.tsx:30,93; appDocumentHelpers.tsx (Print) | REFINE (row says only "rename/delete/etc.") |
| PL-11 | PDF document item menu | 🖱️R | — | a `.pdf` row | right-click | items = `Preview PDF` (opens popup), `Refresh PDF Images` (fires update) + GL-14 tail | VaryAppDocumentFileComp.tsx:33-55 | GAP |
| PL-12 | PPTX document item menu | 🖱️R | — | a `.pptx` row | right-click | items = `Open PPTX` (openFile), `Refresh PPTX Slides` + GL-14 tail | VaryAppDocumentFileComp.tsx:57-73 | GAP |
| PL-13 | DOCX document item menu | 🖱️R | — | a `.docx` row | right-click | items = `Open DOCX`, `Refresh DOCX Pages` + GL-14 tail | VaryAppDocumentFileComp.tsx:75-91 | GAP |
| PL-14 | Documents list empty-body menu | 🖱️R | — | Documents list, folder open | right-click empty area | menu = `Add Items`, `Create New File`; `Add Items` → submenu `Add Items`, `Download From URL` (input popup), `Open Shared Link` | FileListHandlerComp.tsx:190; droppingFileHelpers.ts:182; VaryAppDocumentListComp.tsx:120,182 | GAP |
| PL-09 | Lyric item menu (`LyricFileComp`) | 🖱️R | — | a lyric row | right-click | first item `Edit` opens **Lyric Editor popup**; then GL-14 tail | LyricFileComp.tsx:20 | REFINE (base tail + observable not enumerated) |
| PL-15 | `Move to Trash` confirm | 🖱️R→🖱️ | — | a scratch list item | click `Move to Trash` | confirm "Are you sure … to trash?" (`Yes`/Cancel); `Yes` trashes file + material files | FileItemHandlerComp.tsx:71 (`genTrashContextMenu`) | GAP (EX-05: use scratch item) |
| PM-07 | OWA slide thumb menu (`genSlideContextMenuItems`) | 🖱️R | — | Documents tab, editable doc | right-click a slide thumb | items = `Copy`, `Duplicate`, `Move forward`, `Move backward`, `Enable`/`Disable`, `Edit ↗` (presenter), `Show on Screens` (presenter), `Delete` + `Remove background` (if attached) + `Choose Color` | appDocumentHelpers.tsx:131; VarySlideRenderComp.tsx:274; slideItemRenderHelpers.tsx:195 | REFINE (row says only "context menu") |
| PM-37 | Slide-list container empty menu (`AppDocument.showContextMenu`) | 🖱️R | — | a doc's slide list | right-click empty container area | items = `New Slide`; `Paste` if slides copied; `Paste Image` if clipboard image | AppDocument.ts:433; VarySlidesPreviewerComp.tsx:83 | GAP |
| PM-38 | Office (PDF/PPTX/DOCX) slide thumb menu (`showStaticSlideContextMenu`) | 🖱️R | — | a PDF/PPTX/DOCX doc selected | right-click a slide thumb | items = `Show on Screens` (presenter), `Reveal in File Explorer` (if image on disk), `Choose Color`, `Remove background`(if attached) | appDocumentHelpers.tsx:85; Pdf/Pptx/DocxAppDocument.ts:39-48 | GAP |
| PM-35 | Background media item menu (`BackgroundMediaItemComp`) | 🖱️R | — | Images/Videos tab item | right-click a thumb | items = `Copy Path to Clipboard`, `Reveal in File Explorer`, `Show on Screens` (presenter), [type extras], `Move to Trash` (only if not on screen) | BackgroundMediaItemComp.tsx:79 | REFINE (row says only "context menu on image/video/web") |
| PM-39 | Background Images empty-body menu | 🖱️R | — | Images tab, folder open | right-click empty area | `Add Items`, `Paste Image` (if clipboard image), `Download From URL`, `Open Shared Link` | BackgroundImagesComp.tsx:76,176 | GAP |
| PM-40 | Background Videos menus | 🖱️R | — | Videos tab | right-click item vs empty | item extra `Toggle Fading at End`; empty body `Add Items`, `Download From URL`, `Open Shared Link` | BackgroundVideosComp.tsx:160,203 | GAP |
| PM-41 | Background Colors swatch right-click (`RenderColor`) | 🖱️R | — | Colors tab swatch | right-click a swatch | menu = `Copy '<color>' to clipboard`, `Show on Screens` (presenter) | others/color/RenderColor.tsx:13 | GAP |
| PM-42 | Background Web item + body menus | 🖱️R | — | Webs tab | right-click url item vs empty | item: `Copy URL to Clipboard`, `Show on Screens`, `Remove URL` (if not on screen); body: `New File`, `Add URL`, `Edit`, `Open Shared Link` | BackgroundWebUrlItemComp.tsx:60; backgroundWebHelpers.tsx:66,124 | GAP |
| PM-43 | Background Camera item menu | 🖱️R | — | Cameras tab, presenter | right-click a camera tile | single item `Show on Screens` (presenter only; empty menu off-presenter) | BackgroundCameraItemComp.tsx:49 | GAP |
| PM-44 | Background Audios empty-body menu | 🖱️R | — | Audios split open | right-click empty area | `Add Items`, `Download From URL`, `Open Shared Link` | BackgroundAudiosComp.tsx:104,32 | GAP |
| PM-45 | Attached-background badge menu (`AttachBackgroundIconComponent`) | 🖱️R | — | an item with an attached image/video/web bg | right-click the badge icon | single item `Reveal in File Explorer` (color/camera badges: no menu) | others/AttachBackgroundIconComponent.tsx:12 | GAP |
| PM-46 | Foreground Time menus (`ForegroundTimeComp`) | 🖱️/🖱️R | — | Foreground → Time widget | click `Choose City`; right-click `Show Time` | Choose City → large timezone menu `City (Area/City)`; right-click Show Time → force-screen chooser (SP-13) | ForegroundTimeComp.tsx:35,112 | GAP (PM-20 doesn't mention city menu) |
| PM-47 | Foreground Images-slideshow Scale Type menu | 🖱️ | — | Foreground → Images Slide Show | click `Scale Type` button | menu lists `scaleTypeList` (stretch/fit/…); pick applies scale | ForegroundImagesSlideShowComp.tsx:132 | GAP |
| PM-48 | Foreground Web item + body menus (`ForegroundWebComp`) | 🖱️R | — | Foreground → Web widget | right-click a web tile / empty body | tile: `Copy Path to Clipboard`, `Reveal in File Explorer`, `Show on Screens`, `Edit` (Web Editor popup); body: `New File`, `Open Shared Link` | ForegroundWebComp.tsx:167,313 | GAP |
| PR-02 | Bible file (list) menu (`BibleFileComp`) | 🖱️R | — | a bible list file with items | right-click | items (if hasItems) `Export to MS Word`, `Empty` (confirm Yes), `Copy All Items`, `Move All Items To`(submenu) + `Remove background`(if attached) + GL-14 tail | BibleFileComp.tsx:36 | REFINE (row says only "context menu") |
| PR-08 | Bible ITEM menu (`openBibleItemContextMenu`) | 🖱️R | — | a verse row inside an open bible | right-click | `Open`; `Remove background`(if attached); `Copy Title/Text/All/Verse Full Key/Chapter Full Key`; `Lookup`(if popup avail); `Duplicate`; `Show on Screens`(presenter); `Move To`(submenu); `Delete`; `Move up`(index≠0); `Move down`(not last) | BibleItemRenderComp.tsx:109; bibleHelpers.ts:173; bibleItemHelpers.ts:17 | GAP |
| PR-09 | Note file (list) menu (`NoteFileComp`) | 🖱️R | — | a note list file | right-click | (if hasItems) `Empty`(confirm), `Copy All Items`, `Move All Items To`; then `New Note Item`; `Import`(default note only); `Remove background`(if attached) + GL-14 tail | note/NoteFileComp.tsx:40 | GAP |
| PR-10 | Note ITEM menu (`openNoteItemContextMenu`) | 🖱️R | — | a note item row | right-click | `Open`, `Edit Title`, `Export`, `Remove background`(if attached), `Duplicate`, `Move To`(submenu), `Delete`(confirm Yes), `Move up`(≠0), `Move down`(not last) | note/BibleNoteItemRenderComp.tsx:76; note/noteHelpers.ts:58 | GAP (PR-03 only covers edit→popup) |
| PR-11 | "Move All Items To" / "Move To" submenu | 🖱️R→🖱️ | — | ≥2 bible (or note) lists exist | select `Move All Items To`/`Move To` | submenu lists other bible/note names; ≤1 file ⇒ toast "No other bibles/notes found" | bibleHelpers.ts:120; note/noteHelpers.ts:15 | GAP |
| PR-12 | Color-note picker menu (`ItemColorNoteComp`) | 🖱️ | — | a list item's color-note dot | click the `bi-record-circle` dot | menu = `No Color`(disabled if none set) + color names (current color disabled); pick applies + persists | others/ItemColorNoteComp.tsx:15 | GAP (SP-04 only covers screen color note) |
| RD-11 | Bible-key selector menu (`BibleKeySelectionComp`) | 🖱️/🖱️R | — | a bible-key badge/selector | click (or right-click Mini) | per-locale headers (disabled) + `(KEY) Title` options + `Add New Bible` (opens Bible setting); excludes current key | bible-lookup/BibleKeySelectionComp.tsx:81,163 | REFINE (row says only "switch version") |
| RD-13 | Lookup history item menu (`BibleLookupInputHistoryComp`) | 🖱️R | — | a history chip in the lookup input | right-click a chip | `Open`, `Copy Title/Text/All/Verse Full Key/Chapter Full Key`, `Save bible item`, `Remove` | BibleLookupInputHistoryComp.tsx:103 | GAP (RD-06 only covers click=re-run) |
| RD-14 | Lookup body verse menu (`genFoundBibleItemContextMenu`) | 🖱️R | — | a looked-up verse in the preview body | right-click a verse | `Save bible item`; `Open in Cross Reference`(if verseKey, not editor); presenter: `Show bible item`, `Save bible item and show on screen`; editor: `Insert bible item` | bible-lookup/bibleActionHelpers.ts:43 | GAP |
| RD-15 | Bible view pane menu (`BibleViewComp`→`genContextMenu`) | 🖱️R | — | reader/lookup bible view pane | right-click the pane | [GL-15 if text selected] + `Search in Bible Search`(lookup) + copying items + `Split Horizontal`, `Split Horizontal to`, `Split Vertical`, `Split Vertical to`, `Toggle Widget Full View`, `Edit`/(shortcuts), `Close`(if not alone) | bible-reader/BibleViewComp.tsx:93; BibleItemsViewController.ts:681; LookupBibleItemController.ts:416 | GAP |
| RD-16 | Bible target editor menu (`BibleViewTitleEditorComp`) | 🖱️R | Ctrl (withCtrl) | a bible item title (book/chapter/verse spans) | right-click a title part | cascading pickers: Book list → Chapter list → Verse Start → Verse End (item 0 disabled header; current disabled); applies new target | bible-reader/BibleViewTitleEditorComp.tsx:23,117,301 | GAP |
| RD-17 | Copy-actions button menu (`RenderCopyBibleItemActionButtonsComp`) | 🖱️ | — | lookup/reader action button row | click the green copy button | menu = `Copy Title/Text/All/Verse Full Key/Chapter Full Key` | bible-lookup/RenderActionButtonsComp.tsx:18 | GAP |
| RD-18 | Wiki dictionary menu (`RenderOpenWikiDictionaryComp`) | 🖱️ | — | bible lookup header | click the journal-text button | header `Open Wiki Dictionary`(disabled) + divider + `English` + target lang + divider + all lang codes; each opens wiktionary (EX-04) | bible-lookup/RenderOpenWikiDictionaryComp.tsx:36 | GAP |
| RD-19 | Bible Find result item menu (`bibleFindHelpers.openContextMenu`) | 🖱️R | — | a Bible Find result row | right-click a result | `Open`, `Copy Title/Text/All/…`, `Save bible item` | bible-find/bibleFindHelpers.ts:214 | GAP |
| RD-20 | Bible Find book-selector menu (`RenderFindingInfoHeaderComp`) | 🖱️ | Shift | Bible Find header | click the book button | `All Books`, (`Shift + Click to select multiple` if any), `Old Testament`(+OT books), `New Testament`(+NT books); unavailable/only-selected disabled | bible-find/RenderFindingInfoHeaderComp.tsx:40 | GAP |
| RD-21 | Bible Find extra-actions menu (three-dots) | 🖱️ | — | Bible Find header | click the ⋮ button | `Reset Search Data`(confirm→reload), `Reset Selected Books`(disabled if none) | bible-find/RenderFindingInfoHeaderComp.tsx:111 | GAP (EX-05: cancel the reset) |
| RD-22 | Cross-reference view menu (`BibleCrossRefWrapperComp`) | 🖱️R | — | cross-ref view shown | right-click the view | single item `Refresh` | bible-cross-refs/BibleCrossRefWrapperComp.tsx:30 | GAP |
| RD-23 | Reader audio player menu (`AudioPlayerComp`) | 🖱️R | — | reader audio player showing | right-click | single item `Refresh` | bible-reader/view-extra/AudioPlayerComp.tsx:23 | GAP |
| RD-24 | Bible model-info menu (`BibleModelInfoSettingComp`) | 🖱️ | — | bible model button | click it | menu lists `KEY - (Title)` models; current disabled; pick reloads app | bible-reader/BibleModelInfoSettingComp.tsx:15 | GAP |
| ED-03 | Editor slide thumb menu | 🖱️R | — | slide editor left list | right-click a slide | same items as PM-07 with editor `Edit` behavior (selects slide in-editor); `Copy`/`Duplicate`/`Delete` carry Ctrl/Ctrl+Shift/Delete shortcut labels when selected | appDocumentHelpers.tsx:131; SlideRenderComp.tsx:53 | REFINE (row says only "duplicate/delete") |
| ED-13 | Editor multi-selected slides menu (`genSelectedSlidesContextMenuItems`) | 🖱️R | — | ≥2 slides held/selected | right-click a held slide | menu = `Copy`, `Duplicate`, `Delete` (all with shortcut labels) | appDocumentHelpers.tsx:211; AppDocument.ts:425; SlideRenderComp.tsx:68 | GAP |
| ED-14 | Canvas empty-area menu (`showCanvasContextMenu`) | 🖱️R | — | slide editor canvas (empty) | right-click the canvas | `New`, `Paste`(if copied items), `Insert Medias`, `Insert YouTube`, `Insert Website`, `Paste Image`(clipboard img), `Paste Bible Item`(clipboard bible) | slide-editor/canvas/canvasContextMenuHelpers.ts:29 | GAP |
| ED-15 | Canvas item (box) menu (`showCanvasItemContextMenu`) | 🖱️R | — | a canvas box | right-click a box | `Lookup`(bible+popup), `Lock`/`Unlock`, `Copy`, `Duplicate`, `Reveal…`(video), `Open URL`/`Copy URL`(youtube/website), `Download`(image), `Edit`(text, unlocked), `Delete`(unlocked); shortcut labels when selected | slide-editor/canvas/canvasContextMenuHelpers.ts:155 | GAP |
| ED-16 | Canvas error-box menu (`BoxEditorNormalViewErrorComp`) | 🖱️R | — | a corrupted canvas item ("Error") | right-click it | menu = `Delete`, `Copy Error Json` | slide-editor/canvas/box/BoxEditorNormalViewErrorComp.tsx:13 | GAP |
| ED-17 | Slide-editor color picker menu (`ColorPicker`) | 🖱️R | — | a color-picker control (collapsed) | right-click | single item `Copy Color` (copies current color) | others/color/ColorPicker.tsx:90 | GAP |
| SP-10 | Previewer card menu (`ScreenPreviewerItemComp`) | 🖱️R | — | ≥1 screen previewer cards | right-click a card | `Set/Unset Line Sync`(bible live), `Solo`(≠solo, >1), `Select`/`Deselect`(>1), `Delete`(>1), `Refresh Preview`(always) | _screen/preview/screenPreviewerHelpers.ts:20 | COVERED |
| SP-11 | Empty mini-screen body menu | 🖱️R | — | mini-screen empty area | right-click | `Add New Screen`, `Refresh Preview` | _screen/preview/MiniScreenBodyComp.tsx:26 | COVERED |
| SP-05 | `DisplayControl` menu | 🖱️ | — | previewer footer | click the display button | menu lists every OS display `*Label(id): WxH (primary)`; pick retargets screen | _screen/preview/DisplayControl.tsx:10 | COVERED |
| SP-06 | Transition-effect menu (`RenderTransitionEffectComp`) | 🖱️ | — | previewer footer Tr: buttons | click Slide:/Background: | menu = `none/fade/move/zoom`; current has highlight icon; pick updates button icon | _screen/RenderTransitionEffectComp.tsx:13 | COVERED |
| SP-07 | Stage-number menu | 🖱️ | — | previewer footer `St:` | click the stage number | items `0`–`4` (current disabled), `Decrement`(disabled ≤0), `Increment` | _screen/preview/ScreenPreviewerFooterComp.tsx:21 | COVERED |
| SP-13 | Force-choose-screen menu (`ScreenEventHandler.chooseScreenIds`) | 🖱️R | — | presenter, ≥1 screens, nothing selected | right-click any "Show on Screens" / a foreground Show button (force) | menu lists `Screen id: N` per screen; pick presents on THAT screen; dismiss ⇒ resolves none | _screen/managers/ScreenEventHandler.ts:142 | GAP (PM-25 only names it generically) |
| SC-06 | On-screen bible-key select menu (`onBibleSelect`) | 🖱️R | Shift | a bible verse live on the screen target | click a verse's bible-key region on `screen.html` | menu: `<key>`(remove, if >1 versions) + divider, `Shift Click to Add`(disabled), divider, bible-key options; picks swap/add versions live | _screen/screenBibleHelpers.tsx:53 | GAP |
| ST-11 | Settings directory path menu (`PathSelectorComp` on setting page) | 🖱️R | — | Settings → directory paths | right-click a path | `Copy to Clipboard`, `Reveal in File Explorer`, `Unset Directory Path` (no `Edit Parent Path` on setting page) | others/PathSelectorComp.tsx:42 | GAP |
| ST-12 | Bible-XML editor tool menu (`bibleXMLHelpers`) | 🖱️R | — | Settings → Bible → XML editor cache tools | right-click the tool | `Reveal in File Explorer`, `Clear Cache` | setting/bible-setting/bibleXMLHelpers.ts:219,229 | GAP |

---

### Summary

Table row totals (63 rows):

- COVERED: **6** (GL-06, SP-05, SP-06, SP-07, SP-10, SP-11)
- REFINE: **7** (PL-03, PL-09, PM-07, PM-35, PR-02, RD-11, ED-03)
- GAP: **50** (GL-14, GL-15, GL-16, GL-17, GL-18, GL-19, KB-14, PL-11, PL-12, PL-13, PL-14, PL-15, PM-37, PM-38, PM-39, PM-40, PM-41, PM-42, PM-43, PM-44, PM-45, PM-46, PM-47, PM-48, PR-08, PR-09, PR-10, PR-11, PR-12, RD-13, RD-14, RD-15, RD-16, RD-17, RD-18, RD-19, RD-20, RD-21, RD-22, RD-23, RD-24, ED-13, ED-14, ED-15, ED-16, ED-17, SP-13, SC-06, ST-11, ST-12)

**GAP + REFINE ids (6-word hook each):**

- GL-14 — every list item's shared trash/rename tail
- GL-15 — selected-text copy/Google/dictionary menu items
- GL-16 — every text input Paste/Clear menu
- GL-17 — splitter Reset-Size/Close-Widget context menu
- GL-18 — dir-path Copy/Reveal/Edit/Unset context menu
- GL-19 — path previewer Reveal-in-Explorer single item
- KB-14 — menu Arrow/Enter/Tab/letter keyboard navigation
- PL-03 — OWA doc Edit/Print items enumerated
- PL-09 — lyric Edit plus shared base tail
- PL-11 — PDF item Preview/Refresh-Images menu items
- PL-12 — PPTX item Open/Refresh-Slides menu items
- PL-13 — DOCX item Open/Refresh-Pages menu items
- PL-14 — Documents empty-body Add/Create/Download menu
- PL-15 — Move-to-Trash confirm dialog Yes path
- PM-07 — slide thumb full item enumeration
- PM-35 — background media item items enumerated
- PM-37 — slide-list New/Paste/Paste-Image empty menu
- PM-38 — office slide Show/Reveal/Choose-Color menu
- PM-39 — images empty-body Paste/Download/Shared menu
- PM-40 — video Toggle-Fading plus download menus
- PM-41 — color swatch Copy/Show-on-Screens right-click
- PM-42 — web item Copy-URL/Remove plus body menu
- PM-43 — camera item Show-on-Screens single item
- PM-44 — audios empty-body Add/Download/Shared menu
- PM-45 — attached-bg badge Reveal-in-Explorer menu
- PM-46 — foreground Time Choose-City timezone menu
- PM-47 — images-slideshow Scale-Type option menu
- PM-48 — foreground web item Edit menu
- PR-02 — bible file Export/Empty/Copy/Move menu
- PR-08 — bible item Open/Copy/Lookup/Move/Delete menu
- PR-09 — note file Empty/New-Item/Import menu
- PR-10 — note item Open/Edit/Export/Delete menu
- PR-11 — Move-Items-To other-list submenu
- PR-12 — list-item color-note picker menu
- RD-11 — bible-key selector Add-New-Bible menu items
- RD-13 — lookup history Open/Copy/Save/Remove menu
- RD-14 — lookup body Save/Cross-Ref/Show menu
- RD-15 — bible view Split/Toggle/Edit/Close menu
- RD-16 — title-editor Book/Chapter/Verse cascading pickers
- RD-17 — copy-actions button copying menu
- RD-18 — Wiki dictionary language links menu
- RD-19 — Bible Find result Open/Copy/Save menu
- RD-20 — Bible Find OT/NT book selector
- RD-21 — Bible Find Reset-Search/Reset-Books menu
- RD-22 — cross-reference view Refresh single item
- RD-23 — reader audio player Refresh single item
- RD-24 — bible model-info chooser menu
- ED-03 — editor slide thumb items enumerated
- ED-13 — multi-selected slides Copy/Duplicate/Delete menu
- ED-14 — canvas New/Paste/Insert/Paste-Bible empty menu
- ED-15 — canvas box Lock/Copy/URL/Delete menu
- ED-16 — canvas error-box Delete/Copy-Json menu
- ED-17 — editor color-picker Copy-Color menu
- SC-06 — on-screen bible-key swap/add menu
- SP-13 — force-choose-screen "Screen id" menu
- ST-11 — settings directory path context menu
- ST-12 — bible-XML editor Reveal/Clear-Cache menu
