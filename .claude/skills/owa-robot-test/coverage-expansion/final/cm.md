# CM — Context-menu items (final matrix rows)

One row per **distinct menu ITEM** (label → action) exposed by any
`showAppContextMenu` / button-menu site, grouped by host component. The
menu-*open* / dismiss behaviour and keyboard nav are NOT re-listed here — they
stay as **GL-06** (open/dismiss) and **KB-14** (Arrow/Enter/Tab/letter nav); the
per-host "right-click gives a menu" triggers stay as their existing rows
(**PL-03, PM-07, PM-35, SP-10, SP-11, GL-06**, refined below). CM rows enumerate
what those menus *contain*.

- Emoji: 🖱️ click · 🖱️🖱️ dblclick · 🖱️R right-click · ⇕ drag · ⌨️ key ·
  🎚️ slider · ⌨️✎ input · 🖐️ hover.
- **(family)** = one row consolidating the same item across sibling hosts.
- **[D]** = destructive item; pass = confirm dialog appears → **Cancel (EX-05)**,
  or act on a scratch item created for the purpose.
- Assert the open item set with
  `[...document.querySelectorAll('#app-context-menu-container .app-context-menu-item')].map(e=>e.textContent)`.

## CM — Context-menu items (right-click actions)

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

---

### REFINE

Existing coverage-matrix rows whose wording should be upgraded now that the menu
items are enumerated (source-marked REFINE):

- **PL-03** → `🖱️R a Documents row → context menu. OWA doc: Edit ↗ (CM-15) + Print (CM-16) then the shared file tail Copy Path / Reveal / Duplicate / Rename / Reload / Move to Trash (CM-01..06); PDF/PPTX/DOCX rows swap in Preview/Open + Refresh items (CM-17..22).`
- **PL-09** → `🖱️R a Lyrics row → menu with Edit first (→ Lyric Editor popup, PU-02 / CM-25) then the shared file tail (CM-01..06).`
- **PM-07** → `🖱️R a slide thumb → menu = Copy / Duplicate / Move forward / Move backward / Enable|Disable / Edit ↗ / Show on Screens / Delete (CM-26..32) + Remove background if attached (CM-08) + Choose Color (CM-09).`
- **PM-35** → `🖱️R a background item → menu = Copy Path (CM-01), Reveal (CM-02), Show on Screens (CM-07), type extras (video Toggle Fading at End CM-49 / color Copy '<color>' CM-48 / web Copy URL CM-50 + Remove URL CM-51), Move to Trash only if not on screen (CM-06).`
- **PR-02** → `🖱️R a BibleListComp item → bible-file menu (if hasItems) = Export to MS Word (CM-58), Empty (CM-59), Copy All Items (CM-60), Move All Items To submenu (CM-61), Remove background if attached (CM-08) + the shared file tail (CM-01..06).`
- **RD-11** → `🖱️ the bible-key badge → menu of per-locale headers (disabled) + (KEY) Title version options (current excluded) + Add New Bible (opens Bible setting) — CM-84; picking a version re-renders the verse.`
- **ED-03** → `🖱️R an editor slide thumb → same item set as PM-07 (CM-26..32) but Edit selects the slide in-editor rather than opening a window; Copy/Duplicate/Delete carry Ctrl / Ctrl+Shift / Delete shortcut labels; ≥2 held slides show the reduced Copy/Duplicate/Delete set (ED-13 = CM-26/27/32).`

### COUNTS

Total CM rows: **92** (CM-01 .. CM-92). Last id used: **CM-92**.
