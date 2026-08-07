# PL — Presenter, left column (coverage-expansion final)

Source: `coverage-expansion/discover-presenter-lists.md`. Existing matrix rows
PL-01..PL-10 kept as-is (corrections in REFINE below). New rows PL-11..PL-31 fill
the GAPs; near-identical control families consolidated to one row each.

## PL additions

| ID | Target | Interactions | Pass condition |
|---|---|---|---|
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

### REFINE

Corrections to existing matrix rows PL-01..PL-10 (source verified the code paths):

- **PL-01** — drop "footer path updates". Clicking a left-list item only sets `.active` and reveals its middle previewer tab (`getIsShowingVaryAppDocumentPreviewer`); there is no per-item footer path — the only path UI is the constant directory `PathSelectorComp` (src: src/app-document-list/VaryAppDocumentFileComp.tsx:255).
- **PL-02** — "opens/presents the document" is unsupported: no `onDoubleClick` binding exists anywhere in these lists, so a double-click is just two clicks (2nd is a no-op). Opening the editor is the context-menu **Edit↗** path (ED-10) (src: src/others/FileItemHandlerComp.tsx:225).
- **PL-03** — replace "rename/delete/etc." with a trigger-only assertion (items owned by CM pass). The OWA-doc menu is: Edit↗, Print, Copy Path to Clipboard, Reveal in File Explorer, Duplicate, Rename, Reload, Move to Trash (src: src/app-document-list/VaryAppDocumentFileComp.tsx:93).
- **PL-04** — "order changes and persists" is false: left-list items are not `draggable` and have no `onDragStart`, so drag does nothing. Order comes from `sortFilePaths` / color-note grouping, not user drag. Row should be removed or re-scoped to a no-op assertion (src: src/others/FileItemHandlerComp.tsx:225).
- **PL-08** — "lyric on screen (`.app-on-screen`)" is unsupported: lyric double-click only selects + reveals the Lyrics previewer; presenting is done from the middle-column verses (PM-11) (src: src/lyric-list/LyricFileComp.tsx:83).
- **PL-10** — "select; ⇕ reorder" is wrong: clicking a playlist card header **toggles expand/collapse** (`isOpened`; chevron `bi-chevron-down`↔`bi-chevron-right`; `opened-<path>` setting persists). It does not select and there is no reorder. (This absorbs the source's separate playlist-expand/collapse GAP — no new row emitted for it.) (src: src/playlist/PlaylistFileComp.tsx:40).

Skipped (not emitted as a PL row):
- **KB-14** (inline name input Enter/Escape) — pure keyboard-shortcut path, owned by the KB pass. PL-12's and PL-31's Enter/Escape confirm/cancel keys defer there too.

### COUNTS

New rows: 21 (PL-11..PL-31) · last id used: PL-31 · REFINE: 6 (PL-01, PL-02, PL-03, PL-04, PL-08, PL-10). Reconciliation of the 25 source GAPs: 23 covered by the 21 emitted rows (source PL-31/32/33 consolidated into one PL-30) + 1 folded into REFINE PL-10 (playlist expand/collapse) + 1 skipped as a KB row (KB-14) = 25.
