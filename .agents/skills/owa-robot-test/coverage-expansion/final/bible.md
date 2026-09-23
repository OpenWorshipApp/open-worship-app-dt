# BIBLE area — finalized coverage-matrix rows

Finalized from `coverage-expansion/discover-bible.md`. One row per **distinct
non-keyboard GAP** path; COVERED rows (RD-01..RD-12, PR-01..PR-03, NAV-06..NAV-08)
skipped; pure ⌨️-shortcut GAPs (RD-13/14/15 picker nav, KB-14..18) left to **KB**;
generic item context-menus (bible-file/bible-item/note-file/note-item menus,
RD-34 "Search in Bible Search") left to **CM**; PU-07/PU-08 note-popup GAPs left
to the **PU** range. Multi-source consolidations cite each source. Emoji legend:
🖱️ click · 🖱️🖱️ dblclick · 🖱️R right-click · ⇕ drag-drop · ⌨️ key · 🎚️ slider ·
⌨️✎ input · 🖐️ hover.

## RD additions

| ID | Target | Interactions | Pass condition |
|---|---|---|---|
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

## PR additions

| ID | Target | Interactions | Pass condition |
|---|---|---|---|
| PR-40 | `BibleFileComp` accordion | 🖱️ the bible-file-row header | expands/collapses (`bi-chevron-down`↔`-right`, `bi-book`↔`-fill`); a live file gets `.app-on-screen` (src: src/bible-list/BibleFileComp.tsx:114) |
| PR-41 | `BibleFileComp` drop target | ⇕ drop a bible item / a background onto the file row | a bible item is saved/moved into the file; a background instead attaches to it (src: src/bible-list/BibleFileComp.tsx:204) |
| PR-42 | `BibleItemRenderComp` version mini-selector | 🖱️ its `BibleKeySelectionMiniComp` (isMinimal) | version menu opens; picking saves the new `bibleKey` into the file (src: src/bible-list/BibleItemRenderComp.tsx:228) |
| PR-43 | `BibleItemRenderComp` Ctrl+right-click title editor | Ctrl+🖱️R book / chapter / verse span | chained target-picker menus (`withCtrl`) open and each pick saves the new target back to the file (src: src/bible-list/BibleItemRenderComp.tsx:251) |
| PR-44 | `BibleItemRenderComp` drag reorder | ⇕ drag an item over another (≥2 items) | dragover sets opacity 0.5; drop reorders within the bible file and saves (src: src/bible-list/BibleItemRenderComp.tsx:147) |
| PR-45 | `RenderBibleItemsComp` Add-Bible-Item | 🖱️ "Add Bible Item" `bi-book` (default bible open) | opens the Bible Lookup popup (src: src/bible-list/RenderBibleItemsComp.tsx:46) |
| PR-46 | `BibleListComp` new-file (`FileListHandlerComp`) | 🖱️ list new/`+` → ⌨️✎ name it | `Bible.create` adds a new bible file to the list (src: src/bible-list/BibleListComp.tsx:47) |
| PR-47 | `NoteFileComp` accordion | 🖱️ the note-file header | expands/collapses (`bi-chevron`/`bi-book` icons swap) (src: src/bible-list/note/NoteFileComp.tsx:121) |
| PR-48 | `NoteFileComp` add-item `+` | 🖱️ green `bi-plus` (file expanded) | `createNewNoteItem` appends a blank note item to the file (src: src/bible-list/note/NoteFileComp.tsx:145) |
| PR-49 | `NoteFileComp` drop target | ⇕ drop a note item / background onto the note file | a note item is added/moved; a background instead attaches (src: src/bible-list/note/NoteFileComp.tsx:219) |
| PR-50 | `NoteTitleEditorComp` inline edit (via "Edit Title") | ⌨️✎ type; blur (Enter/Escape owned by KB) | inline `SimpleNoteEditorComp` appears; blur commits + closes; empty shows "No title" (src: src/bible-list/note/BibleNoteItemRenderComp.tsx:195; src/bible-list/note/NoteEditorComp.tsx:33) |
| PR-51 | `BibleNoteItemRenderComp` drag reorder | ⇕ drag a note item over another (≥2) | reorders within the note file and saves (src: src/bible-list/note/BibleNoteItemRenderComp.tsx:147) |

## NAV additions

| ID | Target | Interactions | Pass condition |
|---|---|---|---|
| NAV-12 | Reader lookup-header extras (`QuitCurrentPageComp` / `SettingButtonComp` / `HelpButtonComp`) | 🖱️ each (reader page only) | Go-Back navigates to `presenterHomePage`; gear opens a new `setting.html` popup target; Help is external (EX-04, enabled/named only) — the cluster exists only on the reader (no `#app-header`) (src: src/bible-lookup/RenderExtraButtonsRightComp.tsx:100) |
| NAV-13 | "Add New Bible" version-menu entry | 🖱️ the bold "Add New Bible" `bi-journal-arrow-down` item in any bible-version menu | `openBibleSetting()` opens the Bible-tab settings popup target (src: src/bible-lookup/BibleKeySelectionComp.tsx:115) |

### REFINE

Existing matrix rows whose text is wrong or under-specified (correct in place; do
not add a new ID):

- **RD-04 / KB-09** — clear-key mapping is **reversed** in the matrix. Actual:
  `Escape` → drop last chunk (`removeInputTextChunk`); `Ctrl+Escape` → clear ALL
  (`removeInputText`); icon titles read "Clear input [Ctrl+Escape]" /
  "Clear input chunk [Escape]" (src: src/bible-lookup/InputExtraButtonsComp.tsx:125).
- **RD-06** — matrix says single-click re-runs a history entry; the real trigger
  is 🖱️🖱️ (`openInBibleLookup`), plus Shift-🖱️🖱️ split, ⇕ drag, 🖱️R menu, and an
  inline red `bi-x` per chip (src: src/bible-lookup/BibleLookupInputHistoryComp.tsx:173).
- **RD-09** — omits find refresh, the suggestion menu, the book filter, reset-data,
  the Find/Cross-Reference tab switch, and found-item drag/menu (now RD-41..RD-48)
  (src: src/bible-find/BibleFindHeaderComp.tsx:53).
- **RD-10** — omits cross-ref card collapse/refresh, per-item click/append/drag,
  the mini version selector + title editor, and the S/FN/★/T badges
  (now RD-49..RD-52) (src: src/bible-cross-refs/BibleCrossRefRendererComp.tsx:93).
- **RD-11** — omits the locale-grouped version menu (disabled locale headers +
  dividers) and the bold "Add New Bible" entry (now NAV-13)
  (src: src/bible-lookup/BibleKeySelectionComp.tsx:18).
- **PR-02** — "🖱️ selects" is wrong: the list item has no single-click select;
  open is 🖱️🖱️ (`handleOpening`), and the version mini-selector (PR-42),
  Ctrl+R-click title editor (PR-43) and drag reorder (PR-44) are separate controls
  (src: src/bible-list/BibleItemRenderComp.tsx:190).
- **PR-03** — "🖱️ a note; edit" is wrong: open is 🖱️🖱️ / the `bi-journal` icon,
  and edit-title is a context-menu action (inline editor = PR-50)
  (src: src/bible-list/note/BibleNoteItemRenderComp.tsx:171).
- **PU-03** — (out of this range; flag for PU owner) omits the note-popup footer
  action buttons and the floating Bible-Lookup insert (PU-07/PU-08 territory)
  (src: src/bible-list/note/NoteItemEditorPopupComp.tsx:116).

### COUNTS

- **RD additions:** 40 (RD-13 .. RD-52)
- **PR additions:** 12 (PR-40 .. PR-51)
- **NAV additions:** 2 (NAV-12 .. NAV-13)
- **Total new rows:** 54
- REFINE (in-place fixes, not new rows): 8

Last id used per prefix: **RD-52 · PR-51 · NAV-13**.
