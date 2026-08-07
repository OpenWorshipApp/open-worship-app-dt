# Coverage matrix additions — Settings + Popups (finalized)

Source: `coverage-expansion/discover-settings-popups.md`. Format matches
`references/coverage-matrix.md`: `| ID | Target | Interactions | Pass condition |`.
Legend: 🖱️ click · 🖱️🖱️ dblclick · 🖱️R right-click · ⇕ drag-drop · ⌨️ key ·
🎚️ slider · ⌨️✎ input · 🖐️ hover. Each Pass condition ends with `(src: path:line)`.

Scope notes: pure ⌨️-shortcut paths (finder Enter/Escape/Ctrl+Q; the bible-note
Ctrl+Enter/Ctrl+Shift+Enter/Ctrl+Shift+B/Ctrl+Shift+Alt+T/Ctrl+Shift+Alt+K set;
lyric Ctrl+S) and context-menu-ITEM paths (settings path-selector menu; XML-item
reveal/clear-cache; Info-editor Monaco map actions; lyric/web Monaco help actions)
are **omitted here** — they belong to the KB and CM prefixes respectively.

## ST additions

| ID | Target | Interactions | Pass condition |
|---|---|---|---|
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

## PU additions

| ID | Target | Interactions | Pass condition |
|---|---|---|---|
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

## LT additions

| ID | Target | Interactions | Pass condition |
|---|---|---|---|
| LT-05 | `SettingGeneralThemeComp` "System" theme option | ⌨️✎ theme `<select>` → "System"; emulate OS `prefers-color-scheme`; **restore** | app follows the OS scheme — `data-bs-theme`/documentElement resolves to OS light/dark and flips when the emulated OS scheme flips (distinct from LT-03 dark / LT-04 light); restore original theme (src: src/setting/SettingGeneralThemeComp.tsx:31-34) |

### REFINE

Existing rows whose Target/Interactions/Pass are vague or wrong (correct in place;
each keyed to the same-named row already in `references/coverage-matrix.md`):

- **ST-02** — settings tabs are a **vertical left sidebar** (`TabRenderComp` nav-links), not a top tab bar (src: src/setting/SettingComp.tsx:47-58)
- **ST-03** — this one row hides parent + 9 independent child path controls; split into ST-13..ST-20 above; "input editable" alone under-specifies it (src: src/setting/directory-setting/SettingGeneralDirectoryPathComp.tsx:175-221)
- **ST-05** — theme is a **`<select>`** (option order Light, Dark, System) applied **live** (no reload/pendingApply); not "🖱️ light→dark" buttons (src: src/setting/SettingGeneralThemeComp.tsx:25-34)
- **ST-06** — font is a **`<select>`** with a leading `--` (none) option; a configured-but-missing font shows `"<font> (Missing)"`; change triggers `pendingApply` (not live) (src: src/setting/SettingGeneralFontFamilyComp.tsx:10-24, src/others/FontFamilyControlComp.tsx:56-69)
- **ST-07** — **CORRECTION**: "Clear All Settings" shows **NO confirm dialog** — `appLocalStorage.clear()` wipes all settings immediately; the matrix's "confirm → Cancel" is wrong. Cover as EX-05 presence-only; also a candidate FINDING (destructive with no guard) (src: src/setting/SettingGeneralOtherOptionsComp.tsx:14-17,34-41)
- **ST-09** — **CORRECTION**: Bible tab is XML-based (Import XML + XML list + Monaco editor); **no search box**; the old downloaded/online enable/disable/download list is **dev-only**. Detail split into ST-23..ST-33 (src: src/setting/bible-setting/SettingBibleComp.tsx:5-18)
- **PU-01** — **CORRECTION**: Finder opens via the **`Ctrl+F` accelerator** (not an in-app button); find-in-page highlights in the **sender/main window**, not the finder popup; prev=`bi-arrow-left`, next=`bi-arrow-right`; no regex option (src: src/find/FinderAppComp.tsx:100-130, electron/electronMenu.ts:21)
- **PU-02** — enumerate: `ResizeActorComp` split of `LyricEditorIDEComp` (Monaco markdown) + `LyricPreviewerComp`; wrap-text + toolbar detail now in PU-08/PU-09 (src: src/lyric-list/LyricEditorPopupComp.tsx:52-89)
- **PU-03** — enumerate: renders BibleNote.js into `#bible-note-root`; footer buttons + floating lookup detail now in PU-10..PU-13 (src: src/bible-list/note/NoteItemEditorPopupComp.tsx:116-130)
- **PU-04** — **CORRECTION**: Web Editor is a Monaco **HTML IDE that auto-saves** — no URL+title form, no Save button (that flow is a different InputPopup off `BackgroundWebComp` `+`); typing detail in PU-14 (src: src/background/web/WebEditorComp.tsx:35-63)
- **PU-05** — About opens via the **native Electron menu** ("About <app>"), not an in-app button; links detail in PU-15 (src: src/others/AboutComp.tsx:42-102, electron/electronMenu.ts:80)
- **PU-06** — LW Share opens via the **native Electron menu** ("Local Web Share"), not an in-app button; controls detail in PU-16..PU-18 (src: src/lwShare/LWShareAppComp.tsx:7-35, electron/electronMenu.ts:212)
- **KB-11** — lyric-editor Ctrl+S may be a **title-only hint** — no `useKeyboardRegistering` for `savingEventMapper` found; primary save is the `bi-floppy` button (PU-09); verify live whether Ctrl+S actually saves (src: src/editing-manager/editingHelpers.tsx:63-66,118-128)

Handoff to other prefixes (out of scope for ST/PU/LT):
- **KB owner** — add finder `Enter`/`Escape`/`Ctrl+Q` and the five bible-note shortcuts (`Ctrl+Enter`, `Ctrl+Shift+Enter`, `Ctrl+Shift+B`, `Ctrl+Shift+Alt+T`, `Ctrl+Shift+Alt+K`) (src: src/find/FinderAppComp.tsx:38-45, src/bible-list/note/NoteItemEditorPopupComp.tsx:80-95).
- **CM owner** — add settings path-selector menu (Copy/Reveal/Unset), XML-item menu (Reveal/Clear Cache), Info-editor Monaco map actions, and lyric/web Monaco help actions (src: src/others/PathSelectorComp.tsx:21-57, src/setting/bible-setting/bibleXMLHelpers.ts:216-236).

### COUNTS

- ST additions: **23** (ST-11 … ST-33) — last id **ST-33**
- PU additions: **12** (PU-07 … PU-18) — last id **PU-18**
- LT additions: **1** (LT-05) — last id **LT-05**
- **Total new rows: 36**
