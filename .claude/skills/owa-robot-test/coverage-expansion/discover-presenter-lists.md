# Discovery inventory — AREA: presenter-lists

Presenter LEFT column + document/lyric/playlist LIST surfaces, plus the generic
list infrastructure they all share (`FileListHandlerComp`, `FileItemHandlerComp`,
`PathSelectorComp`/`PathEditorComp`, `droppingFileHelpers`).

Scope files swept:
- `src/presenter/AppPresenterLeftComp.tsx`
- `src/app-document-list/VaryAppDocumentListComp.tsx`, `VaryAppDocumentFileComp.tsx`,
  `appDocumentHelpers.tsx`, `AppDocument.ts`, `PdfAppDocument.ts`/`PptxAppDocument.ts`/`DocxAppDocument.ts`
- `src/lyric-list/LyricListComp.tsx`, `LyricFileComp.tsx`, `LyricAppDocument.ts`
- `src/playlist/PlaylistListComp.tsx`, `PlaylistFileComp.tsx`, `PlaylistSlideItemComp.tsx`
- `src/others/FileListHandlerComp.tsx`, `FileItemHandlerComp.tsx`, `RenderListComp.tsx`,
  `PathSelectorComp.tsx`, `PathEditorComp.tsx`, `RenderPathTitleComp.tsx`, `PathPreviewerComp.tsx`,
  `AskingNewNameComp.tsx`, `RenderRenamingComp.tsx`, `NoDirSelectedComp.tsx`, `FileReadErrorComp.tsx`,
  `ItemColorNoteComp.tsx`, `droppingFileHelpers.ts`
- `src/scrolling/ScrollingHandlerComp.tsx`

Legend: 🖱️ click · 🖱️🖱️ double-click · 🖱️R right-click · ⇕ drag/drop · ⌨️ key · 🎚️ slider · ⌨️✎ text input · 🖐️ hover.

### Structural facts that force several REFINEs (verified in source)

1. **No list item has a double-click handler.** `FileItemHandlerComp`'s `<li>` (line 225-238)
   binds only `onClick={handleClicking}`. There is **no `onDoubleClick`/`dblclick`** anywhere in
   `app-document-list/`, `lyric-list/`, `playlist/`, or the shared infra (grep = 0 hits). A
   "double-click" nets to two `click`s.
2. **Clicking a LEFT-list item only SELECTS + reveals its middle previewer tab — it does NOT
   present to the screen.** `VaryAppDocumentFileComp.handleClicking` (line 255-266) calls
   `setSelectedAppDocument` + (if the previewer isn't already showing) `showVaryAppDocument`.
   `LyricFileComp.handleClicking` (line 83-92) calls `setSelectedLyric` + `showLyric`. Neither
   sends content to a screen. Presenting is done from the MIDDLE column thumbnails/verses
   (PM-06/PM-11, out of this area) — a single-click toggle per KB §5.
3. **The left lists have NO drag-reorder.** `FileItemHandlerComp`'s `<li>` has no `draggable`
   and no `onDragStart` (grep for `draggable|onDragStart` in these dirs = 0). Its
   `onDragOver/onDragLeave/onDrop` (line 190-210, 235-237) fire **only when an `onDrop` prop is
   passed** (used solely by `PlaylistFileComp` to receive internal DnD data — not reorder).
   Order comes from `sortFilePaths`/color-note grouping in `RenderListComp`, not user drag.

---

## Test-path table

| Proposed ID | Target (component) | Interaction | Keys | Given (precondition) | When (action) | Then (OBSERVABLE pass condition) | Source (file:line) | Status |
|---|---|---|---|---|---|---|---|---|
| PL-01 | `VaryAppDocumentFileComp` list item | 🖱️ | — | Documents dir has ≥1 OWA doc | click the `li.list-group-item` | the clicked `li` gains `.active`; the Documents previewer tab becomes shown (`getIsShowingVaryAppDocumentPreviewer`). **NO "footer path" change** — there is no per-item footer path in the left column | `FileItemHandlerComp.tsx:225-238,160-164,221`; `VaryAppDocumentFileComp.tsx:255-266` | REFINE — drop "footer path updates"; selecting a left item never mutates a path footer (the only path UI is the directory `PathSelectorComp`, which is constant per selection) |
| PL-02 | `VaryAppDocumentFileComp` item | 🖱️🖱️ | — | a doc selected | double-click the item | second click is a no-op (still `.active`); **does NOT open the editor and does NOT present**. Opening the editor is the context-menu **Edit↗** path (ED-10) | `FileItemHandlerComp.tsx:225-230` (no `onDoubleClick`) | REFINE — row claims "opens/presents the document"; unsupported by code |
| PL-03 | OWA-doc per-item context menu trigger | 🖱️R | — | an OWA `.owa` doc listed | right-click the item | `AppContextMenuComp` opens with, for an OWA doc: **Edit↗**, **Print**, Copy Path to Clipboard, Reveal in File Explorer, Duplicate, Rename, Reload, Move to Trash | `VaryAppDocumentFileComp.tsx:93-117`; `FileItemHandlerComp.tsx:169-188,44-98,27-42` | REFINE — row says "rename/delete/etc."; enumerate the 8 items (items owned by context-menus agent) |
| PL-04 | Documents list ⇕ reorder | ⇕ | — | ≥2 docs listed | drag one item over another | **no reorder occurs** — items are not `draggable`; drag does nothing (unless a receiving drop is wired, which docs are not) | `FileItemHandlerComp.tsx:225-238` (no `draggable`/`onDragStart`) | REFINE — row asserts "order changes and persists"; left-list reorder does not exist in code |
| PL-05 | PDF document item | 🖱️ | — | a `.pdf` present in Documents dir | click the PDF `li` (icon `bi-file-earmark-pdf`, color `#bd0b02`) | `li` gains `.active`; PDF selected (page preview renders in MIDDLE previewer, out of area) | `VaryAppDocumentFileComp.tsx:137-151,201-205` | COVERED — note "preview" is middle-column |
| PL-06 | Scratch doc lifecycle | 🖱️+⌨️✎ | Enter | Documents dir writable | header **+** → type name → Enter (create); then Rename; then Move to Trash | new `li` appears, then renames, then removed; list returns to start | `AppDocument.ts:469-472`; `FileListHandlerComp.tsx:66-78,134-145` | COVERED |
| PL-07 | `LyricFileComp` list item | 🖱️ | — | Lyrics dir has ≥1 lyric | click the `li` (icon `bi-music-note`) | `li` gains `.active`; Lyrics previewer tab becomes shown (`getIsShowingLyricPreviewer`) | `LyricFileComp.tsx:58-92,41`; `FileItemHandlerComp.tsx:221` | COVERED |
| PL-08 | `LyricFileComp` item | 🖱️🖱️ | — | a lyric listed | double-click | selects + reveals the Lyrics previewer; **does NOT put the lyric `.app-on-screen`** (sending to screen is done from middle verses, PM-11) | `LyricFileComp.tsx:83-92` (no dblclick / no screen call) | REFINE — row claims "lyric on screen (`.app-on-screen`)"; unsupported |
| PL-09 | Lyric per-item context menu → Edit | 🖱️R | — | a lyric listed | right-click → **Edit** | Lyric Editor popup opens (`openPopupLyricEditorWindow`); full menu also has Copy Path, Reveal, Duplicate, Rename, Reload, Move to Trash | `LyricFileComp.tsx:20-34`; `FileItemHandlerComp.tsx:169-188` | COVERED |
| PL-10 | `PlaylistFileComp` item (dev) | 🖱️ / ⇕ | — | dev build; Playlists dir has an item | click the item card header | click **toggles expand/collapse** (`isOpened`, chevron `bi-chevron-down`↔`bi-chevron-right`), it does NOT "select"; **no reorder** exists | `PlaylistFileComp.tsx:40-43,113-119` | REFINE — row says "select; ⇕ reorder"; actually open/close toggle, no reorder |
| PL-11 | Header **New File** button | 🖱️ | — | list has a dir set + `onNewFile` supplied (docs/lyrics/playlists) | click the header `+` (`bi-file-earmark-plus`, `title="New File"`, float-end) | an inline `AskingNewNameComp` input row appears at the top of the `list-group` (`isCreatingNew=true`) | `FileListHandlerComp.tsx:66-78,215-219` | GAP |
| PL-12 | `AskingNewNameComp` inline create input | ⌨️✎ / 🖱️ | Enter/Escape | new-file input showing | type an invalid char (`\ / : * ? " < > \|`) then click apply; also type valid + Enter | valid → apply button `btn-outline-success`; invalid → `btn-outline-danger` and apply pops toast "Invalid file name"; Enter applies, Escape cancels (input disappears) | `AskingNewNameComp.tsx:16-17,23-33,41-73` | GAP |
| PL-13 | `PathSelectorComp` toggle | 🖱️ | — | any list with a dir set | click the path row (`.path-previewer`) | chevron flips `bi-chevron-down`↔`bi-chevron-right`; `PathEditorComp` shows/hides; `title` reads "Hide/Show path editor" | `PathSelectorComp.tsx:76-103` | GAP |
| PL-14 | `RenderPathTitleComp` reload | 🖱️ | — | path collapsed (title shown) | click the reload icon (`bi-arrow-clockwise`, `title="Reload"`) | `dirSource.fireReloadEvent()` → list re-reads (LoadingComp flicker then items) | `RenderPathTitleComp.tsx:16-20,33-35` | GAP |
| PL-15 | `RenderPathTitleComp` **Add items** (+) | 🖱️ | — | path collapsed; `fileSelectionOption` present | click the `+` (`bi-plus-lg`, `title="Add items"`) | for Lyrics: opens OS file-selection dialog (EX-01); for Documents: opens context menu (Add Items / Download From URL / Open Shared Link) via `onItemsAdding` | `RenderPathTitleComp.tsx:36-45`; `FileListHandlerComp.tsx:148-162`; `VaryAppDocumentListComp.tsx:182-192` | GAP |
| PL-16 | `PathSelectorComp` path context menu | 🖱️R | — | any list with a dir | right-click the path selector | menu: **Copy to Clipboard**, **Reveal in File Explorer**, **Edit Parent Path** (non-setting pages), **Unset Directory Path** | `PathSelectorComp.tsx:21-57` | GAP (defer items to context-menus agent) |
| PL-17 | `PathEditorComp` (expanded) | ⌨️✎ / 🖱️ | — | path editor expanded | edit the dir text input; click reload; click folder-open | input class flips `is-valid`/`is-invalid` per `dirSource.isDirPathValid`; reload (`bi-arrow-clockwise`) re-reads; folder-open (`bi-folder2-open`) opens OS dir picker (EX-01) | `PathEditorComp.tsx:25-30,52-77` | GAP |
| PL-18 | `NoDirSelectedComp` empty state | 🖱️ | — | a list whose dir is unset (`!dirSource.dirPath`) + `defaultFolderName` | observe; click "Select Default" ; click "Go to Settings" | card shows "No directory selected"; "Select Default '<folder>'" runs `selectDefaultDataDirName`; "Go to Settings" (`bi-gear-wide-connected`) opens Settings popup | `FileListHandlerComp.tsx:208-212`; `NoDirSelectedComp.tsx:6-73` | GAP |
| PL-19 | `RenderFailListComp` load-failure state | 🖱️ | — | dir set but file list read returns `null` | observe; click Refresh | alert "Fail to Get File List"; **Refresh** (`bi-arrow-clockwise`) fires `dirSource.fireRefreshEvent()`; "Go to Settings" present | `RenderListComp.tsx:53-74,107-108` | GAP |
| PL-20 | `FileReadErrorComp` per-item error | 🖱️ | — | a list item whose `fileData===null` (unreadable file) | observe; click Reload / Move to Trash | alert "Fail to read file data: <name>"; **Reload** button re-reads; **Move to Trash** trashes the file | `FileItemHandlerComp.tsx:212-218`; `FileReadErrorComp.tsx:28-63` | GAP (self-clean: use a scratch corrupt file) |
| PL-21 | `ItemColorNoteComp` per-item color dot | 🖱️R/🖱️ | — | any list item | click the color dot (`bi-record-circle` in `.color-note-container`) | color context menu opens (**No Color** + full color list); picking a color sets `.color-note.active` and tints the dot; picking No Color clears it | `FileItemHandlerComp.tsx:263-266`; `ItemColorNoteComp.tsx:15-55,92-111` | GAP |
| PL-22 | Color-note grouping (`RenderListComp`) | 🖱️ | — | ≥2 items carry ≥2 distinct color notes | set colors so the map has >1 key | items render grouped under color bars (`genColorBar`); a single color = flat list (no bars) | `RenderListComp.tsx:16-51` | GAP |
| PL-23 | `ScrollingHandlerComp` scroll-to-top | 🖱️ | — | a list long enough to scroll | scroll down, click the to-top affordance (`bi-arrow-up-circle`, `title="Scroll to the top"`) | list scrolls back to top (`applyToTheTop`); button is low-visible until hovered | `FileListHandlerComp.tsx:236`; `ScrollingHandlerComp.tsx:43-60` | GAP |
| PL-24 | List body empty-area context menu | 🖱️R | — | a list with a dir set | right-click the empty card body | menu with **Add Items**, **Create New File**, and (Documents) **Download From URL**, **Open Shared Link** | `FileListHandlerComp.tsx:191-201`; `droppingFileHelpers.ts:182-227`; `VaryAppDocumentListComp.tsx:120-192` | GAP (defer items; note trigger) |
| PL-25 | External-file drag-over gate | ⇕ | — | a list card with a dir set | dispatch `dragover` carrying `kind:'file'` items over the card | card style `opacity:0.5` (accepted); `dragleave` restores `opacity:1`. (Testable synthetically per CLAUDE.md drag-over note) | `FileListHandlerComp.tsx:170-178`; `droppingFileHelpers.ts:17-41` | GAP |
| PL-26 | External-file drop (copy-in) | ⇕ | — | drop a supported file onto a list | drop a valid file; also drop while `dirPath===null` | valid file is copied into `dirSource.dirPath` (new `li` appears); drop with no dir pops toast "Open Folder / Please open a folder first". (Full drop pipeline needs the fiber-controller trick — CLAUDE.md) | `FileListHandlerComp.tsx:173-178`; `droppingFileHelpers.ts:88-128` | GAP |
| PL-27 | Drop OFFICE file onto Documents → convert | ⇕ | — | drop a `.pptx`/`.doc`/office file onto the Documents list | drop the office file | confirm dialog "Converting to PDF" appears; on OK a progress bar (`WIDGET_TITLE`) shows during conversion (`.docx` is excluded → no-op) | `VaryAppDocumentListComp.tsx:70-90`; `appDocumentHelpers.tsx:313,357-383,436-445` | GAP |
| PL-28 | Header title live indicator | observe | — | a list whose content is currently on a screen | present a doc/lyric from that list, observe the list header | the header `<strong>` gains `.app-on-screen` (driven by the list-level `checkIsOnScreen`) | `FileListHandlerComp.tsx:63,220-233`; `VaryAppDocumentListComp.tsx:108-118` | GAP |
| PL-29 | Playlist item expand/collapse (dev) | 🖱️ | — | dev; a playlist listed | click the playlist card header | chevron toggles `bi-chevron-down`↔`bi-chevron-right`; body of `PlaylistItem`s shows/hides; `opened-<path>` setting persists | `PlaylistFileComp.tsx:40-43,101-135` | GAP (dev-only; else BLOCKED) |
| PL-30 | Playlist item internal drop (dev) | ⇕ | — | dev; drag a slide/bible ref onto a playlist card | drop internal DnD data (dataTransfer `text`) onto the item | `playlist.addFromData(receivedData)` runs; new `PlaylistItem` row renders (bible/slide; lyric shows "Not Supported Item Type") | `PlaylistFileComp.tsx:45-51,138-162` | GAP (dev-only) |
| PL-31 | PDF item context menu | 🖱️R | — | a `.pdf` in Documents | right-click the PDF item | menu: **Preview PDF** (opens PDF popup window), **Refresh PDF Images** (+ common/trash items) | `VaryAppDocumentFileComp.tsx:33-56` | GAP (defer items; note trigger) |
| PL-32 | PPTX item context menu | 🖱️R | — | a `.pptx` (not `~$…`) in Documents | right-click the PPTX item | menu: **Open PPTX** (system open), **Refresh PPTX Slides** (+ common/trash) | `VaryAppDocumentFileComp.tsx:57-74` | GAP (defer items) |
| PL-33 | DOCX item context menu | 🖱️R | — | a `.docx` (not `~$…`) in Documents | right-click the DOCX item | menu: **Open DOCX** (system open), **Refresh DOCX Pages** (+ common/trash) | `VaryAppDocumentFileComp.tsx:75-92` | GAP (defer items) |
| PL-34 | Inline rename input round-trip | ⌨️✎ | Enter/Escape | context menu **Rename** chosen on any item | edit the pre-filled name, Enter to apply / Escape to cancel | on apply: file renamed on disk (`renameTo` + material files + editing-history move), selected item follows the rename; on cancel: unchanged | `FileItemHandlerComp.tsx:156,169-188,239-244`; `RenderRenamingComp.tsx:21-46` | GAP (overlaps GL-09 but this is the list-item rename surface specifically) |
| KB-14 | `AskingNewNameComp` inline input keys | ⌨️ | Enter / Escape | new-file OR rename inline input focused | press Enter (with non-empty valid name) / Escape | Enter applies the name; Escape cancels (calls `applyName(null)` → input closes) | `AskingNewNameComp.tsx:23-33` | GAP (distinct from KB-12 which is popup-widget Enter/Escape) |

### Notes for the context-menus agent (triggers found here; ITEMS deferred)

- **Per-item menu** (`FileItemHandlerComp.tsx:169-188`) always ends with the common tail:
  Copy Path to Clipboard, Reveal in File Explorer (`genCommonMenu` 27-42), Duplicate, Rename,
  Reload (`genContextMenu` 44-69), Move to Trash → confirm dialog "Moving File to Trash"
  (`genTrashContextMenu` 71-98). Prepended by the type-specific block (PL-03/31/32/33 and lyric
  Edit / PL-09).
- **List-body/header menu** (`droppingFileHelpers.ts:182-227`): Add Items (170-180),
  Create New File (209-214), plus per-list `genContextMenuItems` (Documents: Download From URL +
  Open Shared Link, `VaryAppDocumentListComp.tsx:120-179`).
- **Path selector menu** (PL-16) and **PathPreviewer reveal menu** (`PathPreviewerComp.tsx:52-65`).

### Summary

- COVERED: 5  (PL-05, PL-06, PL-07, PL-09, and PL-06's create is fine)
- REFINE: 5  (PL-01, PL-02, PL-03, PL-04, PL-08, PL-10) → **6 rows actually flagged REFINE**
- GAP: 25  (PL-11…PL-34 + KB-14)

Precise counts: **COVERED = 4** (PL-05, PL-06, PL-07, PL-09) · **REFINE = 6** (PL-01, PL-02, PL-03, PL-04, PL-08, PL-10) · **GAP = 25** (PL-11, PL-12, PL-13, PL-14, PL-15, PL-16, PL-17, PL-18, PL-19, PL-20, PL-21, PL-22, PL-23, PL-24, PL-25, PL-26, PL-27, PL-28, PL-29, PL-30, PL-31, PL-32, PL-33, PL-34, KB-14).

GAP + REFINE ids with 6-word hooks:
- **PL-01** (REFINE): select item, no footer path exists
- **PL-02** (REFINE): double-click never opens or presents
- **PL-03** (REFINE): OWA-doc menu; enumerate eight items
- **PL-04** (REFINE): left-list items are not reorderable
- **PL-08** (REFINE): lyric double-click never reaches screen
- **PL-10** (REFINE): playlist click toggles open, not select
- **PL-11** (GAP): header plus opens new-file input
- **PL-12** (GAP): new-name input validity, Enter/Escape, toast
- **PL-13** (GAP): path-editor chevron show/hide toggle
- **PL-14** (GAP): path reload button re-reads list
- **PL-15** (GAP): add-items plus dialog or menu
- **PL-16** (GAP): path selector right-click context menu
- **PL-17** (GAP): path editor input, reload, browse
- **PL-18** (GAP): no-directory empty state buttons
- **PL-19** (GAP): fail-to-read list refresh state
- **PL-20** (GAP): per-item read error reload/trash
- **PL-21** (GAP): per-item color-note dot menu
- **PL-22** (GAP): color-note grouping under color bars
- **PL-23** (GAP): scroll-to-top affordance in list
- **PL-24** (GAP): list body empty-area context menu
- **PL-25** (GAP): external drag-over opacity accept gate
- **PL-26** (GAP): external file drop copies in
- **PL-27** (GAP): office-file drop converts to PDF
- **PL-28** (GAP): list header app-on-screen live indicator
- **PL-29** (GAP): playlist expand/collapse chevron (dev)
- **PL-30** (GAP): playlist internal drop adds item
- **PL-31** (GAP): PDF item context-menu trigger
- **PL-32** (GAP): PPTX item context-menu trigger
- **PL-33** (GAP): DOCX item context-menu trigger
- **PL-34** (GAP): inline rename input round-trip
- **KB-14** (GAP): inline name input Enter/Escape
