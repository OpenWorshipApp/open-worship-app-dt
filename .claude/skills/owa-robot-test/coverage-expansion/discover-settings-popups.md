# Discovery Inventory — SETTINGS + ALL POPUP WINDOWS

Static source sweep of `src/setting/**`, the directory-path controls, and every popup
root (`FinderAppComp`, `LyricEditorPopupComp`, `NoteItemEditorPopupComp`,
`WebEditorComp`, `AboutComp`, `LWShareAppComp`). Enumerates every interactive path and
keyboard shortcut, mapped against existing matrix rows `ST-01..10`, `PU-01..06`,
`LT-01..04`, `KB-11`.

Legend: 🖱️ click · 🖱️🖱️ dbl · 🖱️R contextmenu · ⇕ drag · ⌨️ key · 🎚️ range ·
⌨️✎ text/number input · 🖐️ hover.

> **Headline corrections found (details in rows):**
> - **ST-07 is wrong.** "Other General Options" has only *Reset Widgets Size* + *Clear
>   All Settings*, and **neither shows a confirm dialog** — both fire immediately
>   (`SettingGeneralOtherOptionsComp.tsx:10-17`). *Reset All Child Directories* is NOT
>   here; it lives in the directory-path card and *does* confirm.
> - **ST-09 is wrong.** The Bible tab is now XML-based (`SettingBibleXMLComp`: import +
>   XML list + Monaco XML editor). There is **no search box**; the old
>   downloaded/online list with enable/disable/download is **dev-only**
>   (`SettingBibleComp.tsx:11` gated on `isDev`).
> - **PU-04 is wrong.** The Web Editor popup (`src/background/web/WebEditorComp.tsx`) is
>   a Monaco **HTML IDE that auto-saves** — no URL+title form, no Save button. The
>   URL+title flow is a different InputPopup off `BackgroundWebComp` `+`.
> - **Finder has no regex option** — only match-case (`FinderAppComp.tsx:17`,
>   `finderHelpers.tsx:3-7`). Any "finder regex" test target does not exist in code.
> - About / LW Share open from the **native Electron menu**, not an in-app button
>   (`electron/electronMenu.ts:80,212`); Finder opens via `Ctrl+F` accelerator
>   (`electron/electronMenu.ts:21` → `main:app:open-find-page`).

---

## A. Settings shell — tabs, apply, lifecycle (`setting.html`)

| Proposed ID | Target (component) | Interaction | Keys | Given | When | Then (observable) | Source (file:line) | Status |
|---|---|---|---|---|---|---|---|---|
| ST-01 | `SettingComp` open + attach | 🖱️ gear | — | presenter loaded | click gear → `list_pages` → `select_page` | new `setting.html` target; `document.title` matches `/Settings/`; `#app-setting` present | `settingHelpers.ts:8-17`, `SettingComp.tsx:42-44` | COVERED |
| ST-02 | `SettingComp` General/Bible tabs (vertical sidebar) | 🖱️ each | — | settings open | click each `.app-setting-nav .nav-link` | clicked nav-link gets `.active`; body swaps General↔Bible. NOTE: it is a **vertical** `TabRenderComp` in a left sidebar, not a top bar | `SettingComp.tsx:47-58` | REFINE — matrix implies a top tab bar; it's a left vertical sidebar |
| ST-11 | Tab-switch dirty guard | 🖱️ | — | a Bible XML editor has unsaved changes | click the General tab (or Refresh) | `showSimpleToast('Unsaved Bible Data', …)` fires and the tab does **not** switch (`.active` unchanged) | `SettingComp.tsx:31-40`, `bibleEditorDirtyHelpers.ts:66-72` | GAP |
| ST-08 | `SettingApplyComp` Apply | 🖱️ | — | a non-live setting changed (restored) | click `Apply Settings` last | `forceReloadAppWindows()` → `all:app:force-reload`; all windows reload; re-attach targets after | `SettingApplyComp.tsx:21-32`, `settingHelpers.ts:58-60` | COVERED |
| ST-12 | Apply pending-state indicator | observe | — | Apply shows `btn-outline-success`+`bi-check` | change language / font / reset-widget | button flips to `btn-outline-warning`+`bi-asterisk` **without** reloading (pendingApply) — distinct observable | `SettingApplyComp.tsx:24-32`, `applyStore.pendingApply` callers | GAP |
| ST-10 | Popup lifecycle | `close_page` | — | settings popup open | `close_page` the popup | main window unaffected; presenter still ready | `SettingComp.tsx` (window) | COVERED |

---

## B. Settings → General → Directory Paths (`SettingGeneralDirectoryPathComp`)

ST-03 currently collapses this whole card into one vague row. It contains a **Parent
Directory** selector plus **9 child-directory** items (Documents, Lyrics, Playlists,
Background Images/Videos/Audios, Bible Present, Bible Reader, Notes —
`SettingGeneralDirectoryPathComp.tsx:175-221`), each an independent `PathSelectorComp`.

| Proposed ID | Target (component) | Interaction | Keys | Given | When | Then (observable) | Source (file:line) | Status |
|---|---|---|---|---|---|---|---|---|
| ST-03 | Directory-paths section renders | observe | — | General tab | open General | `SettingCardHeaderComp` "Path Settings" + parent card + child card render | `SettingGeneralDirectoryPathComp.tsx:274-291` | REFINE — split into ST-13..21 below; "input editable" alone under-specifies it |
| ST-13 | `PathSelectorComp` editor toggle (parent + each child) | 🖱️ | — | a path row collapsed (`bi-chevron-right`) | click the path-previewer row | chevron flips to `bi-chevron-down`; `PathEditorComp` (input+buttons) mounts; title toggles "Show/Hide path editor" | `PathSelectorComp.tsx:85-111` | GAP |
| ST-14 | `PathEditorComp` browse button | 🖱️ | — | editor expanded | click `btn-secondary`/`bi-folder2-open` | OS dir dialog opens (EX-01 — click-eligibility only; app doesn't crash on cancel) | `PathEditorComp.tsx:70-76`, `handleDirSelecting:33-40` | GAP |
| ST-15 | `PathEditorComp` path text input | ⌨️✎ | — | editor expanded | type a path string | `dirSource.dirPath` updates; input carries `is-valid`/`is-invalid` per `isDirPathValid` | `PathEditorComp.tsx:63-69`, `:25-30` | GAP |
| ST-16 | `PathEditorComp` reload button | 🖱️ | — | editor expanded AND a dirPath set | click `btn-secondary`/`bi-arrow-clockwise` (left) | `fireReloadEvent()` re-scans the dir (no crash; list refreshes) | `PathEditorComp.tsx:54-62` | GAP |
| ST-17 | "Reset All Child Directories" | 🖱️ | — | a parent dir is set | click `btn-warning`/`bi-arrow-counterclockwise` in Child-Directories header | `showAppConfirm('Set according paths','All child directories will be set under "…"?', {Yes})` appears → **Cancel** (EX-05) leaves paths intact | `SettingGeneralDirectoryPathComp.tsx:237-244`, `directoryHelpers.ts:37-47` | GAP |
| ST-18 | Child-dir "Missing" badge | observe | — | a child dir path is invalid/unset | open General | red `badge text-bg-danger` "Missing" shows on that item; its editor is force-shown (`isForceShowEditor`) | `SettingGeneralDirectoryPathComp.tsx:83-104` | GAP |
| ST-19 | `SelectDefaultDirButton` (per missing child) | 🖱️ | — | a child dir is missing AND a parent is set | click `btn-info` "Select Default '<folder>'" | `showAppConfirm('Select Default Folder','This will select "…" …', {Ok/Cancel})` → **Cancel** (EX-01/EX-05) | `NoDirSelectedComp.tsx:6-23`, `directoryHelpers.ts:88-123` | GAP |
| ST-20 | Parent-not-set CTA | 🖱️ | — | no parent dir selected | click `btn-success` "Click here to set default data on 'Desktop'" | creates `~/Desktop/open-worship-data` then `selectPathForChildDir` confirm — **Cancel** to avoid mutating (EX-05) | `SettingGeneralDirectoryPathComp.tsx:139-160`, `:116-121` | GAP |
| ST-21 | `PathSelectorComp` context menu (in settings) | 🖱️R | — | a path row with a set dirPath | right-click the path selector | menu items: **Copy to Clipboard** (copies path), **Reveal in File Explorer/Finder** (`getMenuTitleRevealFile`), **Unset Directory Path** (sets dirPath=''). NOTE: "Edit Parent Path" is suppressed inside settings (`!isPageSetting`) | `PathSelectorComp.tsx:21-57` | GAP |

---

## C. Settings → General → Language / Theme / Font / Other

| Proposed ID | Target (component) | Interaction | Keys | Given | When | Then (observable) | Source (file:line) | Status |
|---|---|---|---|---|---|---|---|---|
| ST-04 | `SettingGeneralLanguageComp` locale buttons | 🖱️ | — | General tab | click a non-current locale button, then restore | current button = `btn-info`, others `btn-outline-info`; `setCurrentLocale` + `applyStore.pendingApply()` (Apply flips to warning); UI re-renders in locale | `SettingGeneralLanguageComp.tsx:27-48,62-75` | COVERED |
| ST-05 | `SettingGeneralThemeComp` theme select | ⌨️✎ (select) | — | General tab | change `<select.form-select>` to Light/Dark/System | theme applies **live** (no reload/pendingApply); `data-bs-theme`/documentElement updates. NOTE: it is a **`<select>`** with options ordered **Light, Dark, System** — not buttons | `SettingGeneralThemeComp.tsx:25-34` | REFINE — matrix says "🖱️ light→dark"; it's a select, option order differs |
| ST-06 | `SettingGeneralFontFamilyComp` family select | ⌨️✎ (select) | — | General tab | pick a font in `#text-font-family` | font applies; `applyStore.pendingApply()`; leading `--`=none option; a configured-but-missing font shows `"<font> (Missing)"` prepended | `SettingGeneralFontFamilyComp.tsx:10-24`, `FontFamilyControlComp.tsx:21-31,56-69` | REFINE — matrix omits the `--` option + that it's a select |
| ST-22 | Font WEIGHT/STYLE select | ⌨️✎ (select) | — | a font family WITH weights is selected | change `#text-font-style` | `applyStore.pendingApply()`; only renders when `fontList[fontFamily]?.length` (else absent) | `FontFamilyControlComp.tsx:71-127`, `SettingGeneralFontFamilyComp.tsx:18-24` | GAP |
| ST-07 | "Clear All Settings" | 🖱️ | — | General tab | click `btn-outline-danger`/`bi-trash3` | **NO confirm dialog** — `appLocalStorage.clear()` wipes ALL settings immediately + pendingApply. EX-05 (cannot click safely; also a candidate FINDING: destructive with no guard) | `SettingGeneralOtherOptionsComp.tsx:14-17,34-41`, `appLocalStorage.ts:133-146` | REFINE (CORRECTION) — matrix claims a confirm→Cancel; there is none |
| ST-23 | "Reset Widgets Size" | 🖱️ | — | General tab | click `btn-warning`/`bi-arrows-angle-expand` | **NO confirm** — `clearWidgetSizeSetting()` blanks all pane-size settings immediately + pendingApply (panes reset after Apply). EX-05 | `SettingGeneralOtherOptionsComp.tsx:10-13,25-32`, `flexSizeHelpers.ts:44-48` | GAP |

---

## D. Settings → Bible tab (`SettingBibleComp` → `SettingBibleXMLComp`)

ST-09 describes a search + enable/disable/download list that no longer exists in
production. The real tab: **Import XML** (`BibleXMLImportComp`) + **XML list**
(`BibleXMLListComp` of `BibleXMLInfoComp`) + **Monaco XML editor**
(`BibleXMLDataPreviewComp` → `BibleXMLEditorComp`). The old JSON list is dev-only.

| Proposed ID | Target (component) | Interaction | Keys | Given | When | Then (observable) | Source (file:line) | Status |
|---|---|---|---|---|---|---|---|---|
| ST-09 | Bible tab renders XML UI | observe | — | settings open | click Bible tab | Import-XML card + "Bibles XML" list render (NOT a search box). Old `TypeError: Cannot get bible list` is benign (KB §7) | `SettingBibleComp.tsx:5-18`, `SettingBibleXMLComp.tsx:5-29` | REFINE (CORRECTION) — rewrite: XML import/list/editor, no search |
| ST-24 | Import — "XML format example" toggle | 🖱️ | — | Bible tab | click `bi-question-lg` button | toggles `btn-outline-info`↔`btn-info`; a read-only `<textarea>` with `xmlFormatExample` shows/hides | `BibleXMLImportComp.tsx:108-132` | GAP |
| ST-25 | Import — file picker + cancel | 🖱️ / ⌨️✎ | — | Bible tab | choose a file in `input[type=file][name=file]` | Import button enables; `btn-danger`/`bi-x-lg` cancel appears; the URL group dims (`opacity:0.5; pointer-events:none`). Browse dialog = EX-01 | `BibleXMLImportComp.tsx:142-158,88-98` | GAP |
| ST-26 | Import — URL input + clear | ⌨️✎ / 🖱️ | — | Bible tab, no file chosen | type into `input[name=url]` | invalid → `is-invalid` + title "Invalid URL"; valid → `btn-danger` clear-url button + file group dims | `BibleXMLImportComp.tsx:166-192,99-104` | GAP |
| ST-27 | Import — submit | 🖱️ | — | a file OR valid URL is set | click `input[type=submit]` "Import" | disabled unless `isFileSelected||isValidUrl`; on submit shows `LoadingComp`; toasts on parse/no-data failure (EX-07-ish: heavy I/O — prefer a tiny local XML) | `BibleXMLImportComp.tsx:196-207,42-82` | GAP |
| ST-28 | XML list — Refresh + Search-XML link | 🖱️ | — | Bible tab | click `bi-arrow-clockwise` "Refresh" / `Search XML` link | Refresh reloads keys (blocked by dirty toast, ST-11); "Search XML" opens external Google (EX-04) | `BibleXMLListComp.tsx:45-63,29-41` | GAP |
| ST-29 | XML list — empty state "Create KJV Bible XML" | 🖱️ | — | no XML bibles present | click `btn-success` "Create KJV Bible XML" | `bibleDataReader.initKJVBible()` then refresh; a KJV item appears (also gives a scratch item for ST-31 delete) | `BibleXMLListComp.tsx:64-83` | GAP |
| ST-30 | XML item — Show/Hide Editor | 🖱️ | — | ≥1 XML bible listed | click `bi-pencil` on an item | `btn-outline-primary`↔`btn-primary`; `BibleXMLDataPreviewComp` expands/collapses (collapse blocked by dirty toast) | `BibleXMLInfoComp.tsx:94-105,36-51` | GAP |
| ST-31 | XML item — Move to Trash (confirm) | 🖱️ | — | a scratch XML bible exists | click `bi-trash`/`btn-danger` | `showAppConfirm('Delete Bible XML','Are you sure to delete bible XML "<key>"?', {Yes})` → **Cancel** to probe, or delete a scratch KJV (EX-05) | `BibleXMLInfoComp.tsx:106-112,53-68` | GAP |
| ST-32 | XML item — context menu | 🖱️R | — | an XML item | right-click the `li` | menu: **Reveal in File Explorer** (`getMenuTitleRevealFile`) + **Clear Cache** (`invalidateBibleXMLCachedFolder`) | `bibleXMLHelpers.ts:216-236`, `BibleXMLInfoComp.tsx:74` | GAP |
| ST-33 | XML editor — Info/Extra/Book-Chapter tabs + Download | 🖱️ | — | editor expanded (ST-30) | click each choice button; click Download | active button `btn-light` vs `btn-primary`; switching blocked by dirty toast; "Download" (`btn-success`/`bi-download`) saves `<key>.json` | `BibleXMLDataPreviewComp.tsx:54-79,141-171,82-100` | GAP |
| ST-34 | `BibleXMLEditorComp` Monaco footer | 🖱️ / ⌨️✎ | — | editor expanded | edit JSON; toggle Full View; Reset; Save | Full View toggles `.app-full-view`; on change "Unsaved changes"+`bi-exclamation-triangle-fill` shows; Reset (`btn-warning`, disabled unless changed) reverts to baseline; Save (`btn-primary`, disabled unless `canSave`) saves + `forceReloadAppWindows()`. NOTE: Monaco needs OS foreground focus to type (CLAUDE.md) | `BibleXMLEditorComp.tsx:187-247,145-176` | GAP |
| ST-35 | Info-editor Monaco right-click actions | 🖱️R | — | Info tab editor focused | right-click in the editor | actions: **#️⃣ Edit Numbers Map**, **🌎 Choose Locale** (→ locale menu), **📚 Edit Books Map** (→ `showAppInput` with Reset / Translate-link / Parse-Markup / "Guessing Names" book-menu controls) | `BibleXMLEditorComp.tsx:473-575,326-450` | GAP |
| ST-36 | Dev-only JSON bible list | 🖱️ | — | **dev build** Bible tab | Download (online) / Delete+Update (downloaded) / Refresh | `Download`(`btn-info`, disabled if already XML); `Delete`→confirm 'Delete Bible'/Yes; `Update`(`btn-warning`); Refresh buttons. Downloads = EX-07. BLOCKED in prod | `SettingBibleJsonComp.tsx:8-46`, `DownloadedBibleItemComp.tsx:63-89`, `OnlineBibleItemComp.tsx:38-78` | GAP (dev-only) |

---

## E. Popups — Finder (`finder.html` / `FinderAppComp`)

| Proposed ID | Target (component) | Interaction | Keys | Given | When | Then (observable) | Source (file:line) | Status |
|---|---|---|---|---|---|---|---|---|
| PU-01 | Finder open + search + prev/next | ⌨️✎ / 🖱️ | — | presenter focused | `Ctrl+F` opens finder; type query; click prev/next | trigger is **`Ctrl+F` accelerator** (not an in-app button); prev=`bi-arrow-left`, next=`bi-arrow-right`; find-in-page runs in the SENDER window via IPC (`finder:app:search-in-page`) — highlight is observable in the main window, not the finder popup | `FinderAppComp.tsx:100-130`, `finderHelpers.tsx:9-22`, `electronMenu.ts:21` | REFINE — trigger is Ctrl+F; matches highlight in sender window, not finder |
| PU-07 | Finder case-sensitive checkbox | 🖱️ | — | finder open with a query | toggle the `Aa` checkbox | `matchCase` flips and the search re-runs with the new flag (result set can change). NOTE: **no regex option exists** | `FinderAppComp.tsx:86-96,121-129` | GAP |
| KB-16 | Finder keyboard | ⌨️ | `Enter`/`Escape`/`Ctrl+Q` | finder open | press each | `Enter`=find-next; `Escape`=clear input (then `globalThis.close()` if already empty); `Ctrl+Q`=close window | `FinderAppComp.tsx:30-57,38-45` | GAP |

---

## F. Popups — Lyric Editor (`lyricEditor.html` / `LyricEditorPopupComp`)

| Proposed ID | Target (component) | Interaction | Keys | Given | When | Then (observable) | Source (file:line) | Status |
|---|---|---|---|---|---|---|---|---|
| PU-02 | Lyric Editor readiness + IDE/preview split | observe | — | a lyric right-clicked → Edit (PL-09) | popup opens | `ResizeActorComp` split: `LyricEditorIDEComp` (Monaco markdown) + `LyricPreviewerComp`; title = window title + `(<lyric name>)` | `LyricEditorPopupComp.tsx:52-89`, `LyricEditorIDEComp.tsx:77-103` | REFINE — matrix says "edit; Ctrl+S"; enumerate the split + toolbar below |
| PU-08 | Lyric — Wrap Text checkbox | 🖱️ | — | lyric editor open | toggle "Wrap Text" checkbox | Monaco word-wrap toggles (`lyric-editor-wrap-text` setting) | `LyricEditorIDEComp.tsx:79-93,67-75` | GAP |
| PU-09 | Lyric — Undo/Redo/Discard/Save toolbar | 🖱️ | `Ctrl+S`(hint) | lyric edited so tools show | click Undo/Redo/Save; click Discard | toolbar renders only when `canUndo||canRedo||canSave`; Undo=`bi-arrow-90deg-left`, Redo=`bi-arrow-90deg-right`, Save=`bi-floppy` (disabled unless canSave); **Discard**=`bi-x-octagon` → confirm "Discard changed / Are you sure to discard all change histories?" {Yes} — use Undo NOT Discard during QA (CLAUDE.md) | `editingHelpers.tsx:133-188,77-131` | GAP |
| PU-10 | Lyric — Monaco "Markdown Music Help" action | 🖱️R | — | Monaco focused | right-click → "Markdown Music Help" | opens external music-markdown README (EX-04) | `LyricEditorIDEComp.tsx:32-43` | GAP |
| KB-11 | Lyric editor save shortcut | ⌨️ | `Ctrl+S` | lyric edited | press `Ctrl+S` | Save button's title advertises `[Ctrl+S]` but **no `useKeyboardRegistering` found** for `savingEventMapper` — verify whether Ctrl+S actually saves or is a title-only hint; primary save = floppy button | `editingHelpers.tsx:63-66,118-128` (no registration) | REFINE — Ctrl+S may not be wired; confirm on live app |

---

## G. Popups — Bible Note (`bibleNote.html` / `NoteItemEditorPopupComp`)

Editor is the external **BibleNote.js** widget rendered into its root; interactive
surface is its footer action buttons + a floating Bible-Lookup widget.

| Proposed ID | Target (component) | Interaction | Keys | Given | When | Then (observable) | Source (file:line) | Status |
|---|---|---|---|---|---|---|---|---|
| PU-03 | Bible Note readiness | observe | — | a note edited (PR-03) | popup opens | BibleNote.js editor renders (`#bible-note-root`); color scheme follows theme | `NoteItemEditorPopupComp.tsx:116-130`, `bibleNoteHelpers1.tsx:22-24` | REFINE — enumerate footer buttons + lookup below |
| PU-11 | Note — footer Bible Lookup button | 🖱️ | `Ctrl+Shift+B` | note editor open | click `bi-book` footer action | `FloatingWidgetComp` bible-lookup opens (`RenderBibleLookupComp` inside); `onClose` hides it | `bibleNoteHelpers1.tsx:53-71`, `NoteItemEditorPopupComp.tsx:96-113,119-128` | GAP |
| PU-12 | Note — footer Bible Key selector | 🖱️ | — | note editor open | click the key-text footer button | `showBibleKeyOption` context menu; picking a key updates `BIBLE_KEY_SETTING_NAME` (button text changes) | `bibleNoteHelpers1.tsx:105-133` | GAP |
| PU-13 | Note — footer Always-On-Top toggle | 🖱️ | `Ctrl+Shift+Alt+T` | note editor open | click `bi-window-desktop` footer action | icon flips to `bi-window-stack` (green) / back; window on-top state toggles | `bibleNoteHelpers1.tsx:73-98` | GAP |
| PU-14 | Note — Insert Bible Text buttons | 🖱️ | `Ctrl+Enter` / `Ctrl+Shift+Enter` | floating lookup open with a verse | click `bi-archive` / `bi-box-arrow-in-left` (or the keys) | `bi-archive`+`Ctrl+Enter` inserts collapsed text; `bi-box-arrow-in-left`+`Ctrl+Shift+Enter` inserts full text (prefixed `^`) into the note | `NoteItemEditorPopupComp.tsx:46-95,80-95` | GAP |
| KB-15 | Note keyboard matrix | ⌨️ | `Ctrl+Enter`, `Ctrl+Shift+Enter`, `Ctrl+Shift+B`, `Ctrl+Shift+Alt+T`, `Ctrl+Shift+Alt+K` | note editor open | press each | insert-collapse / insert / open-lookup+key / on-top / open external markdown editor respectively | `NoteItemEditorPopupComp.tsx:80-95`, `bibleNoteHelpers1.tsx:36,57,78,109` | GAP |

---

## H. Popups — Web Editor (`webEditor.html` / `WebEditorComp`)

| Proposed ID | Target (component) | Interaction | Keys | Given | When | Then (observable) | Source (file:line) | Status |
|---|---|---|---|---|---|---|---|---|
| PU-04 | Web Editor readiness (HTML IDE) | observe | — | a web-bg item edited (opened via `BackgroundWebComp`) | popup opens | `ResizeActorComp` split: `WebEditorIDEComp` (Monaco **html**) + `WebPreviewerComp`. **No URL+title form, no Save button** — content **auto-saves** to file on each change | `WebEditorComp.tsx:35-63`, `WebEditorIDEComp.tsx:26-75,43-48` | REFINE (CORRECTION) — matrix's "URL+title; save" is a different flow |
| PU-15 | Web Editor — edit auto-saves + Monaco help action | ⌨️✎ / 🖱️R | — | web editor open | type HTML; right-click → "Learn More About Web Development" | typing writes the file immediately (`writeFileData`); preview reflects it; the action opens MDN HTML docs (EX-04). Monaco needs OS foreground focus to type | `WebEditorIDEComp.tsx:43-48,31-42` | GAP |

---

## I. Popups — About (`about.html` / `AboutComp`)

| Proposed ID | Target (component) | Interaction | Keys | Given | When | Then (observable) | Source (file:line) | Status |
|---|---|---|---|---|---|---|---|---|
| PU-05 | About readiness + version | observe | — | native menu "About <app>" clicked | popup opens | version text + module versions (Pptx2Html/Docx2Html/Bible Note) render (or "Loading…"→value). Opened via **native menu**, not in-app button | `AboutComp.tsx:42-102`, `electronMenu.ts:80` | REFINE — trigger is native menu; enumerate links below |
| PU-16 | About — links & GitHub button | 🖱️ | — | about open | inspect/click links | "Fork me on GitHub" (`btn-success`/`bi-github`) → `openExternalURL`; version link → release tag; commit link → commit; homepage link (`bi-box-arrow-up-right`). All EX-04 (presence/name only) | `AboutComp.tsx:103-120,25-27,75-88` | GAP |

---

## J. Popups — LW Share (`lwShare.html` / `LWShareAppComp`)

| Proposed ID | Target (component) | Interaction | Keys | Given | When | Then (observable) | Source (file:line) | Status |
|---|---|---|---|---|---|---|---|---|
| PU-06 | LW Share readiness | observe | — | native menu "Local Web Share" clicked | popup opens | header "Local Web Share (<version>)" + `ServerControllerComp`; opened via **native menu** | `LWShareAppComp.tsx:7-35`, `electronMenu.ts:212-217` | REFINE — trigger is native menu; enumerate controls below |
| PU-17 | LW Share — Start/Stop Server | 🖱️ | — | server stopped | click the status button | text/class cycle per `statusViewMap`: stopped=`Start Server`(warning) → running=`Stop Server`(success) with QR-code address links rendered; error=`Restart Server`. **Restore to stopped** | `ServerControllerComp.tsx:46-51,130-219,15-44` | GAP |
| PU-18 | LW Share — port controls | ⌨️✎ / 🖱️ | — | LW Share open | edit port; click "Gen Randomly"; click "Use 8080" | number input (0-65535) updates `port`; "Gen Randomly" sets a random 1024-65535; "Use 8080" sets 8080; changing port re-inits the server | `ServerControllerComp.tsx:72-127,139-149` | GAP |
| PU-19 | LW Share — Storage Dir + GitHub | 🖱️ | — | LW Share open | click storage-dir row / "Fork me on GitHub" | storage-dir click → `showFileOrDirExplorer` (EX-01); GitHub button (`bi-github`) → external (EX-04) | `ServerControllerComp.tsx:174-202`, `LWShareAppComp.tsx:21-27` | GAP |

---

## K. Locale & theme passes (already reference ST-04/05)

| Proposed ID | Target | Status |
|---|---|---|
| LT-01..04 | Primary pass / secondary-locale (via ST-04) / dark & light spot-checks (via ST-05) | COVERED — no change; note ST-05 is a select (see ST-05 REFINE) |

---

### Summary

**Counts:** COVERED = 8 · REFINE = 13 · GAP = 41

(COVERED = ST-01, ST-04, ST-08, ST-10, LT-01, LT-02, LT-03, LT-04.)

**REFINE (existing row vague/wrong — 6-word hook):**
- ST-02 — settings tabs are vertical sidebar
- ST-03 — one row hides ten path controls
- ST-05 — theme is a select dropdown
- ST-06 — font select has none/missing options
- ST-07 — CORRECTION: no confirm, immediately destructive
- ST-09 — CORRECTION: Bible tab is XML, no search
- PU-01 — trigger is Ctrl+F, sender-window highlight
- PU-02 — lyric editor split plus toolbar
- PU-03 — note footer buttons plus lookup
- PU-04 — CORRECTION: Monaco HTML auto-save, no form
- PU-05 — About opens via native menu
- PU-06 — LW Share opens via native menu
- KB-11 — lyric Ctrl+S maybe title-only hint

**GAP (no row exists — 6-word hook):**
- ST-11 — dirty-editor toast blocks tab switch
- ST-12 — Apply button pending-state asterisk indicator
- ST-13 — path editor chevron expand toggle
- ST-14 — path browse button opens dialog
- ST-15 — path text input validity classes
- ST-16 — path reload button rescans directory
- ST-17 — reset-all-child-dirs confirm dialog
- ST-18 — missing-directory red "Missing" badge
- ST-19 — select-default-dir button with confirm
- ST-20 — set-default-on-desktop parent CTA
- ST-21 — path context menu three items
- ST-22 — font weight/style secondary select
- ST-23 — reset widgets size, no confirm
- ST-24 — XML format example toggle textarea
- ST-25 — XML import file picker/cancel
- ST-26 — XML import URL input/clear
- ST-27 — XML import submit disabled-state
- ST-28 — XML list refresh + search link
- ST-29 — create KJV bible empty-state
- ST-30 — XML item show/hide editor toggle
- ST-31 — XML item delete confirm dialog
- ST-32 — XML item reveal/clear-cache context menu
- ST-33 — XML editor Info/Extra/BookChapter tabs + download
- ST-34 — XML Monaco footer save/reset/fullview
- ST-35 — Info-editor Monaco right-click map actions
- ST-36 — dev-only JSON download/delete/update list
- PU-07 — finder case-sensitive checkbox re-search
- PU-08 — lyric wrap-text checkbox toggle
- PU-09 — lyric undo/redo/discard/save toolbar
- PU-10 — lyric Monaco markdown-help action
- PU-11 — note bible-lookup floating widget button
- PU-12 — note bible-key selector menu
- PU-13 — note always-on-top toggle button
- PU-14 — note insert-bible-text buttons
- PU-15 — web editor auto-save + help action
- PU-16 — about links and github button
- PU-17 — lw-share start/stop server button
- PU-18 — lw-share port number controls
- PU-19 — lw-share storage-dir + github
- KB-15 — bible-note five keyboard shortcuts
- KB-16 — finder Enter/Escape/Ctrl+Q keys
