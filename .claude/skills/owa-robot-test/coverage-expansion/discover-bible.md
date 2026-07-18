# BIBLE area — robot-unit-test path inventory

Static source sweep of `src/bible-reader/*`, `src/bible-lookup/*`, `src/bible-find/*`,
`src/bible-cross-refs/*`, `src/bible-list/*` (+ `note/*`). Legend: 🖱️ click · 🖱️🖱️ dbl-click ·
🖱️R contextmenu · ⇕ drag/drop · ⌨️ keyboard · 🎚️ range slider · ⌨️✎ text/number input · 🖐️ hover.

Context note: `RenderBibleLookupComp` (the picker + header + body) is shared by the **Reader page**
(`reader.html`, always-on) AND the **Bible Lookup modal** (`Ctrl+B` in presenter/editor). Rows below
are filed under `RD` (reader) but every lookup row also exercises the modal. Bible/Note **lists**
(`bible-list/*`) appear in the presenter right column AND the reader left column, so `PR` rows also
cover `RD-12`.

---

## A. Bible-lookup incremental picker (book → chapter → verse)

| Proposed ID | Target (component) | Interaction | Keys | Given | When | Then (observable) | Source | Status |
|---|---|---|---|---|---|---|---|---|
| RD-02 | `RenderBookOptionsComp`/`RenderChapterOptionsComp`/`RenderVerseOptionsComp` | ⌨️✎ 🖱️ | — | reader ready, input empty | type book prefix → 🖱️ a `.bible-lookup-book-option` → 🖱️ a `.bible-lookup-chapter-option` → 🖱️ a verse | each step narrows list; verse renders in `.bible-view` | RenderBookOptionsComp.tsx:81; RenderChapterOptionsComp.tsx:117; RenderVerseOptionsComp.tsx:217 | COVERED |
| RD-03 | `InputHandlerComp` | ⌨️✎ | — | reader | type `John 3:16` char-by-char | resolves to exact verse | InputHandlerComp.tsx:135 | COVERED |
| RD-13 | `selectionHelpers.processSelection` | ⌨️ | Arrow L/R/U/D | book (or chapter/verse) options showing, options list focused | press each arrow | `.active` class moves to the neighbor option in that grid direction (`processSelection`) | selectionHelpers.tsx:203; RenderBookOptionsComp.tsx:134-137; RenderChapterOptionsComp.tsx:154 | GAP |
| RD-14 | `selectionHelpers.userEnteringSelected` | ⌨️ | Enter | an option carries `.active` | press Enter | the `.active` option's `.click()` fires → chunk applied (input text advances) | selectionHelpers.tsx:235-253 | GAP |
| RD-15 | `InputHandlerComp` handleInputKeyUp | ⌨️ | ArrowUp/ArrowDown | focus in `#app-bible-lookup-input` | press ArrowDown | input blurs and `.bible-lookup-render-found` gains focus (`focusRenderFound`) | InputHandlerComp.tsx:66-76; selectionHelpers.tsx:184 | GAP |
| RD-16 | `RenderBookOptionsComp` disabled option | 🖐️/observe | — | a book unavailable in this version | inspect its button | button has `disabled` attr, `title="Not available"`, cursor `not-allowed`; arrow-nav skips it | RenderBookOptionsComp.tsx:76-95; selectionHelpers.tsx:152 | GAP |
| RD-17 | `RenderChapterOptionsComp` chapter-zero intro | 🖱️ | — | book with intro (chapter 0) selected | 🖱️ the `bi-info-circle` button | `RenderChapterZeroContentComp` card expands showing intro verses; toggles off on re-click | RenderChapterOptionsComp.tsx:51-84 | GAP |
| RD-18 | `RenderVerseNumOptionComp` | 🖱️ + ⇕ + Shift-🖱️ | Shift | verse options showing | 🖱️ verse A then drag to verse B (or Shift+🖱️ B) | selected range spans A→B (`.selected-start/.selected/.selected-end`); on mouseup `applyTargetOrBibleKey` fires | RenderVerseNumOptionComp.tsx:49-97 | GAP |
| RD-19 | `RenderVerseOptionsComp` show-all | 🖱️ | — | a partial verse range selected (not full chapter) | 🖱️ the `bi-arrows-expand-vertical` alert button (title "Show all verses") | target set to verseStart 1 … chapter length | RenderVerseOptionsComp.tsx:231-244 | GAP |
| RD-20 | `InputHandlerComp` prev/next chapter | 🖱️ | — | a verse resolved | 🖱️ `[data-previous-chapter-button]` (bi-caret-left) / `[data-next-chapter-button]` (bi-caret-right) | `tryJumpingChapter(false/true)` → previous/next chapter loads | InputHandlerComp.tsx:147-162 | GAP |
| RD-21 | `InputExtraButtonsComp` disabled state | observe | — | input text is empty | inspect clear-input / clear-chunk icons | both carry inline `opacity:0.5; pointer-events:none` (availableStyle) while empty; solid when text present | InputExtraButtonsComp.tsx:79-95,179-202 | GAP |

## B. Bible-lookup input extra buttons + keyboard (clear / tab-complete)

| Proposed ID | Target | Interaction | Keys | Given | When | Then (observable) | Source | Status |
|---|---|---|---|---|---|---|---|---|
| RD-05 | `InputExtraButtonsComp` icons | 🖱️ | — | input has `Gen 1:1` | 🖱️ red `bi-x` (Clear input) / 2nd `bi-x` (Clear chunk) / `bi-arrow-bar-right` (Tab-complete) | red x empties whole input; 2nd x drops last space-chunk; arrow appends `:`/`-` | InputExtraButtonsComp.tsx:179-211 | COVERED |
| RD-04 | `InputExtraButtonsComp` key handlers | ⌨️ | Escape / Ctrl+Escape / Tab | input focused, text present | press each | **Escape → removeInputTextChunk (drop last chunk); Ctrl+Escape → removeInputText (clear ALL)** — matrix RD-04 states this reversed | InputExtraButtonsComp.tsx:125-145 | REFINE (mapping is reversed in matrix; icon titles confirm "Clear input [Ctrl+Escape]" / "Clear input chunk [Escape]") |
| KB-09 | same | ⌨️ | Tab/Escape/Ctrl+Escape | lookup input | complete / clear-chunk / clear-all | see RD-04 — KB-09 also lists Escape=clear, Ctrl+Escape=clear-chunk **backwards** | InputExtraButtonsComp.tsx:72-77,125-145 | REFINE |
| KB-14 | option arrow-nav | ⌨️ | Arrow L/R/U/D | options focused | arrows | `.active` moves (see RD-13) | selectionHelpers.tsx:203 | GAP |
| KB-15 | option Enter-select | ⌨️ | Enter | option `.active` | Enter | selected option clicked (see RD-14) | selectionHelpers.tsx:235 | GAP |

## C. Bible-version selector

| Proposed ID | Target | Interaction | Keys | Given | When | Then (observable) | Source | Status |
|---|---|---|---|---|---|---|---|---|
| RD-11 | `BibleKeySelectionComp` | 🖱️ | — | lookup header | 🖱️ the `.input-group-text` (bibleKey + `bi-chevron-down`) | `AppContextMenuComp` opens with versions **grouped by locale (disabled locale headers + dividers)** and a bold **"Add New Bible"** (`bi-journal-arrow-down`) entry → `openBibleSetting()`; picking a version re-renders verse | BibleKeySelectionComp.tsx:18-131,180-185 | REFINE (matrix RD-11 omits the grouped menu + Add-New-Bible entry) |
| RD-32 | `BibleKeySelectionMiniComp` on a bible view | 🖱️ / 🖱️R | — | a rendered bible view/list item | 🖱️ the pill → change version; 🖱️R → same menu titled "Add Extra Bible" | 🖱️ swaps `bibleKey`; 🖱️R **appends** to `extraBibleKeys` (parallel/interlinear render) | BibleKeySelectionComp.tsx:188-250; RenderTitleMaterialComp.tsx:90-94 | GAP |
| RD-52 | `BibleFindBodyComp` find version selector | 🖱️ | — | advance-lookup Find tab open | 🖱️ its `BibleKeySelectionComp` | find re-scopes to the chosen version (controller re-instantiates) | BibleFindBodyComp.tsx:79-82; BibleFindBodyPreviewerComp.tsx:24-27 | GAP |

## D. Lookup header buttons (AI, export, wiki, keep-open, reader extras)

| Proposed ID | Target | Interaction | Keys | Given | When | Then (observable) | Source | Status |
|---|---|---|---|---|---|---|---|---|
| RD-08 | `AdvanceLookupHandlerComp` (bi-search) | 🖱️ | — | reader/modal | 🖱️ toggle | resize split opens/closes hosting `Lookup` + `Bible Online Lookup`; button flips `btn-info`↔`btn-outline-info`; setting `bible-lookup-online-*` persists | RenderExtraButtonsRightComp.tsx:22-41; RenderBibleLookupComp.tsx:164-174 | COVERED |
| RD-22 | `AIConfigComp` → `AISettingComp` (bi-robot) | 🖱️ | — | reader lookup header | 🖱️ the robot icon | `showAppInput` "Audio AI Setting" popup with OpenAI + Anthropic key inputs + external "API Key" buttons; icon turns green when a key is saved | AIConfigComp.tsx:124-139,13-122 | GAP |
| RD-23 | `AIConfigComp` → `AudioAutoPlayComp` (bi-megaphone) | 🖱️ | — | an OpenAI key is set | 🖱️ the megaphone | `isAutoPlay` toggles; icon green when on; hidden entirely when no key | AIConfigComp.tsx:141-163 | GAP |
| RD-24 | `RenderExportWordComp` (bi-file-earmark-word) | 🖱️ | — | reader, ≥1 looked-up item | 🖱️ blue word icon (title "Export to MS Word") | `getBibleItemsForExportingMSWord` → `exportToWordDocument` (file save = EX-01) | RenderExportWordComp.tsx:15-31 | GAP |
| RD-25 | `RenderOpenWikiDictionaryComp` (bi-journal-text) | 🖱️ | — | reader lookup header | 🖱️ button (title "Wiki Dictionary") | context menu: disabled header, "English", target-locale lang, divider, every other wiktionary lang; each → `openExternalURL(<lang>.wiktionary.org)` (EX-04) | RenderOpenWikiDictionaryComp.tsx:36-81 | GAP |
| RD-26 | `RenderExtraButtonsRightComp` Keep-Open | 🖱️ | — | **presenter/editor** modal only | 🖱️ the "Keep Open" checkbox/label | `close-on-add-bible-item` setting toggles (checkbox `checked` flips); absent on reader page | RenderExtraButtonsRightComp.tsx:78-95 | GAP |
| RD-27 | `RenderExtraButtonsRightComp` reader extras | 🖱️ | — | **reader page** header | 🖱️ Go-Back (`QuitCurrentPageComp`), gear (`SettingButtonComp`), help (`HelpButtonComp`) | Go-Back → `presenterHomePage`; gear → settings popup target; help → external (EX-04) — only present on reader | RenderExtraButtonsRightComp.tsx:100-109 | GAP |

## E. Lookup history

| Proposed ID | Target | Interaction | Keys | Given | When | Then (observable) | Source | Status |
|---|---|---|---|---|---|---|---|---|
| RD-06 | `BibleLookupInputHistoryComp` entry | 🖱️🖱️ / Shift+🖱️🖱️ / ⇕ / 🖱️R | Shift | ≥1 history chip present | 🖱️🖱️ a chip; Shift+🖱️🖱️; drag chip; 🖱️R | 🖱️🖱️ → `openInBibleLookup` reloads that ref; Shift+🖱️🖱️ splits then loads; drag serializes a BibleItem; 🖱️R menu = Open / Copy…/ Save bible item / Remove; inline red `bi-x` removes just that chip | BibleLookupInputHistoryComp.tsx:173-203,103-144 | REFINE (matrix RD-06 says single-click re-runs; real trigger is dbl-click + extras) |

## F. Lookup body — editing header + action buttons + inline edit

| Proposed ID | Target | Interaction | Keys | Given | When | Then (observable) | Source | Status |
|---|---|---|---|---|---|---|---|---|
| RD-07 | `BibleLookupBodyPreviewerComp` | 🖱️🖱️ | — | a verse resolved | 🖱️🖱️ the verse body | verse presented (`.app-on-screen`) — restore | BibleLookupBodyPreviewerComp.tsx:130-145 | COVERED |
| RD-28 | `RenderEditingActionButtonsComp` | 🖱️ + ⌨️ | Ctrl+Enter / Ctrl+Shift+Enter / Ctrl+Shift+S / Ctrl+Shift+V | editing a resolved verse | 🖱️ each of Copy/Split-H/Split-V/Save/Save+Show/Insert/Export (or the keys) | Copy → copy menu; Split-H `bi-vr` `addBibleItemLeft`; Split-V `bi-hr` `addBibleItemBottom`; Save `bi-floppy`; Save+Show `bi-cast` (presenter); Insert `bi-file-earmark-slides` (editor); Export `bi-file-earmark-word` | RenderEditingActionButtonsComp.tsx:28-243 | GAP |
| RD-29 | `RenderActionButtonsComp` (non-editing header) | 🖱️ | — | a saved/rendered bible view | 🖱️ Copy / Split-H / Split-V / Save / Save+Present / Insert / Export | same actions as RD-28 without shortcut hints | RenderActionButtonsComp.tsx:29-155 | GAP |
| RD-30 | `RenderBodyComp` / `RenderBodyEditingComp` pencil | 🖱️ | Escape | multi-item lookup rendered | 🖱️ green `bi-pencil` ("Click to edit this section"); in editing view 🖱️ `bi-pencil-fill` ("Hit Escape to jump back to editing input") | `editBibleItem` swaps which item is editing / focuses input; Escape jumps focus back to input | BibleLookupBodyPreviewerComp.tsx:95-127,59-72 | GAP |
| RD-31 | `RenderBibleEditingHeader` close | 🖱️ | close shortcut | ≥2 lookup items (not alone) | 🖱️ red `bi-x-lg` (title "Close [key]") | `closeCurrentEditingBibleItem` removes that section | RenderBibleEditingHeader.tsx:66-81 | GAP |
| KB-16 | Save bible item | ⌨️ | Ctrl+Enter | editing a resolved verse | Ctrl+Enter | `saveBibleItem`; on fail `showAddingBibleItemFail` toast | RenderEditingActionButtonsComp.tsx:33-44 | GAP |
| KB-17 | Save+present / insert-to-slide | ⌨️ | Ctrl+Shift+Enter | presenter (or editor) | Ctrl+Shift+Enter | presenter → save+present; editor → `CanvasBibleItemEventListener.insertBibleItem` | RenderEditingActionButtonsComp.tsx:68-113 | GAP |
| KB-18 | Split horizontal/vertical | ⌨️ | Ctrl+Shift+S / Ctrl+Shift+V | editing a verse | press each | `addBibleItemLeft` / `addBibleItemBottom` (new split pane appears) | RenderEditingActionButtonsComp.tsx:132-148 | GAP |

## G. Bible view card (drop / context menu / color / audio / delete / title-edit / verse-select)

| Proposed ID | Target | Interaction | Keys | Given | When | Then (observable) | Source | Status |
|---|---|---|---|---|---|---|---|---|
| RD-33 | `BibleViewComp` drop | ⇕ | — | a `.bible-view` card | drop a bible item onto it | dragging-class toggles on dragover; `applyDropped` adds the item | BibleViewComp.tsx:155-212 | GAP |
| RD-34 | `BibleViewComp` context menu | 🖱️R | — | rendered verse (select some text for the extra item) | 🖱️R the card | menu = copy submenu + `viewController.genContextMenu` + (lookup only, text selected) **"Search in Bible Search"** → opens Find with the selection | BibleViewComp.tsx:93-138,190-200 | GAP |
| RD-35 | `RenderTitleMaterialComp` → `ItemColorNoteComp` | 🖱️ | — | a bible view header | 🖱️ the color-note dot → pick color | color note applies to the item (groups synced views) | RenderTitleMaterialComp.tsx:80-82 | GAP |
| RD-36 | `AudioAIEnablingComp` (bi-soundwave) | 🖱️ | — | AI audio available for item | 🖱️ the soundwave icon | `isAudioEnabled` flips (icon green); verse audio players appear | AudioAIEnablingComp.tsx:8-31 | GAP |
| RD-37 | `BibleViewRenderHeaderComp` delete | 🖱️ | — | a non-editing bible view | 🖱️ red `bi-x-lg` | `deleteBibleItem` removes the view | BibleViewRenderHeaderComp.tsx:59-66 | GAP |
| RD-32b | `RenderBibleKeyComp` extra-key chip | 🖱️ | — | a view with ≥1 extra bible key | 🖱️ a `.bible-extra-key` chip (red `bi-x`, title "Click to remove extra Bible …") | that extra key removed from `extraBibleKeys` (parallel column disappears) | RenderTitleMaterialComp.tsx:14-49,96-102 | GAP |
| RD-38 | `BibleViewTitleWrapperComp` draggable title | ⇕ | — | a bible view title | drag the `.title` span | serializes `BIBLE_ITEM_TARGET_ONLY`; parent `data-do-not-allow-drop` toggles during drag | BibleViewTitleWrapperComp.tsx:35-62 | GAP |
| RD-39 | `BibleViewTitleEditorComp` title editor | 🖱️R (Ctrl+🖱️R in lists) | Ctrl | a rendered title with `onTargetChange` | 🖱️R the book / chapter / verse-start / verse-end span | chained context menus: Book → Chapter → Verse-Start → Verse-End; each pick calls `applyTarget` re-rendering the verse (`withCtrl` requires Ctrl held) | BibleViewTitleEditorComp.tsx:117-215,294-365 | GAP |
| RD-40 | `RenderVerseTextComp` verse number | 🖱️🖱️ | — | verses rendered | 🖱️🖱️ a `.verse-number` (title "Double click to select verse N") | target set to that single verse (verseStart=verseEnd=N) | RenderVerseTextComp.tsx:28-83 | GAP |
| RD-41 | `RenderVerseTextDetailComp` verse text | 🖱️ / 🖱️🖱️ | Alt | verses rendered, no text selected | 🖱️ (or Alt+🖱️ to extend, or 🖱️🖱️) a `.verse-text` | `handleVersesSelecting` toggles that verse into the on-screen selection; loads AI audio if enabled | RenderVerseTextDetailComp.tsx:83-128 | GAP |
| RD-42 | `RenderRestVerseNumListComp` rest numbers | 🖱️🖱️ | — | a verse range shown (rest numbers before/after) | 🖱️🖱️ a greyed rest `.verse-number` (title "Double click to select verses X-Y") | selection extends start/end to that verse | RenderRestVerseNumListComp.tsx:53-58; BibleViewTextComp.tsx:152-169 | GAP |
| RD-43 | `NoBibleViewAvailableComp` empty/drop | ⇕ / observe | — | no bible items in view | observe / drop a bible item | shows "No Bible Available"; drop adds it (`RECEIVING_DROP_CLASSNAME` on dragover) | NoBibleViewAvailableComp.tsx:10-55 | GAP |

## H. Reader footer settings + audio player

| Proposed ID | Target | Interaction | Keys | Given | When | Then (observable) | Source | Status |
|---|---|---|---|---|---|---|---|---|
| RD-44 | `BibleViewSettingComp` font slider | 🎚️ / ⌨️ | Ctrl+Scroll | reader footer (auto-hide) | 🎚️ `#preview-fon-size` (min5/max150/step2) or Ctrl+Scroll on body | badge `Npx` updates and bible text rescales | BibleViewSettingComp.tsx:16-53; BiblePreviewerRenderComp.tsx:68-73 | GAP |
| RD-45 | `NewLineSettingComp` | 🖱️ | — | reader footer | 🖱️ "Should New Lines" (`bi-arrow-return-left`); then "model new line" (`bi-file-text`) | 1st toggles `shouldNewLine` (verses re-wrap); 2nd `disabled` + opacity 0.5 until 1st on, toggles `shouldModelNewLine` | NewLineSettingComp.tsx:48-89 | GAP |
| RD-46 | `BibleModelInfoSettingComp` | 🖱️ | — | reader footer | 🖱️ the `bi-book` + model button | context menu of models (`key - (title)`, current disabled); pick → `setBibleModelInfoSetting` + **`appProvider.reload()`** (whole app reloads) | BibleModelInfoSettingComp.tsx:15-61 | GAP |
| RD-47 | `FullScreenButtonComp` | 🖱️ | — | reader footer | 🖱️ "Full" (`bi-arrows-fullscreen`) | `requestFullscreen`; label→"Exit Full", icon→`bi-fullscreen-exit`; on error `showSimpleToast('Toggle full screen failed')` — restore | FullScreenButtonComp.tsx:3-28; BiblePreviewerRenderComp.tsx:53-66 | GAP |
| RD-48 | `ButtonAddMoreBibleComp` | 🖱️ | — | ≥1 bible item present | 🖱️ "Add Item" (`bi-plus`) | `showBibleKeyOption` menu; pick adds a parallel version item; button `disabled` when list empty | ButtonAddMoreBibleComp.tsx:7-36 | GAP |
| RD-49 | `AudioPlayerComp` verse audio | 🖱️ / 🖱️R | — | AI audio enabled + generated for a verse | 🖱️ play/pause `<audio.verse-audio controls>`; 🖱️R | playing pauses sibling `<audio>`s; auto-plays on reader if `isAutoPlay`; 🖱️R menu single item "Refresh" (`refreshAudio`) | AudioPlayerComp.tsx:11-95 | GAP |

## I. Bible Find (advance-lookup "Bible Online Lookup" split)

| Proposed ID | Target | Interaction | Keys | Given | When | Then (observable) | Source | Status |
|---|---|---|---|---|---|---|---|---|
| RD-09 | `BibleFindHeaderComp` + pagination + found items | ⌨️✎ + 🖱️ | Enter/Escape | advance lookup open, Find tab | type query; press Enter; 🖱️ page numbers; 🖱️ a found item | results render per page; Enter re-runs, Escape clears; `RenderPageNumberComp` switches active page; found item click loads it into lookup | BibleFindHeaderComp.tsx:53-119; RenderPageNumberComp.tsx:32-47; RenderFoundItemComp.tsx:45-77 | REFINE (matrix omits refresh, suggestion menu, book filter, reset-data, tab switch, found-item drag/menu) |
| RD-50 | `BibleFindPreviewerComp` tab bar | 🖱️ | — | advance lookup open | 🖱️ "Find" (s) / "Cross Reference" (c) tab | `TabRenderComp` switches active tab; setting `bible-search-tab` persists | BibleFindPreviewerComp.tsx:21-62 | GAP |
| RD-51 | `BibleFindHeaderComp` refresh | 🖱️ | — | a query entered | 🖱️ `bi-arrow-clockwise` button | forces a fresh find (results reload) | BibleFindHeaderComp.tsx:100-119 | GAP |
| RD-53 | `BibleFindController` suggestion menu | ⌨️✎ | Tab / Enter | XML (offline) bible, typing a word | type a partial word | suggestion `AppContextMenu` appears below input (`handleNewValue`→`checkLookupWord`); Tab applies top suggestion; Enter closes menu | BibleFindController.tsx:520-581; BibleFindHeaderComp.tsx:53-99 | GAP |
| RD-54 | `RenderFindingInfoHeaderComp` book filter | 🖱️ + Shift-🖱️ | Shift | Find tab | 🖱️ the "All Books"/selected-books button | menu: All Books / OT header+books / NT header+books; 🖱️ picks one, Shift+🖱️ multi-selects; disabled = unavailable/only-selected; label updates | RenderFindingInfoHeaderComp.tsx:40-109,210-217 | GAP |
| RD-55 | `RenderFindingInfoHeaderComp` extra actions | 🖱️R-style 🖱️ | — | Find tab | 🖱️ the `bi-three-dots-vertical` button | menu: **"Reset Search Data"** (red → confirm → `resetSearchingDatabase` + reload) and "Reset Selected Books" (disabled if none) | RenderFindingInfoHeaderComp.tsx:111-156,200-208 | GAP |
| RD-59 | `RenderFoundItemComp` found item | 🖱️ / Shift-🖱️ / 🖱️R / ⇕ | Shift | results present | 🖱️ / Shift+🖱️ / 🖱️R / drag a result | 🖱️ `openInBibleLookup` loads (Shift/force appends); 🖱️R menu = Open / Copy…/ Save bible item; drag serializes BibleItem | RenderFoundItemComp.tsx:33-77; bibleFindHelpers.ts:201-241 | GAP |
| RD-56 | Find empty/loading/fail states | observe | — | no query / no results / controller fails | inspect | empty query → "No data available"; loading → `ShowFindingComp` spinner; controller fail → "Fail to get find controller!" + Reload button | BibleFindRenderDataComp.tsx:74-86; BibleFindBodyPreviewerComp.tsx:46-62 | GAP |

## J. Cross-references (Cross Reference tab + `bible-cross-refs/*`)

| Proposed ID | Target | Interaction | Keys | Given | When | Then (observable) | Source | Status |
|---|---|---|---|---|---|---|---|---|
| RD-10 | `BibleCrossReferencePreviewerComp` → `BibleCrossRefRendererComp` | observe + 🖱️ | — | Cross Reference tab, a verse selected | open tab | verse text + cross-ref cards render; before selection shows "Wait… Please select any bible verse"; AI cards BLOCKED without API key | BibleCrossReferencePreviewerComp.tsx:39-53; BibleCrossRefRendererComp.tsx:93-212 | REFINE (matrix omits collapse/refresh, item interactions, version selector, badges) |
| RD-57 | `BibleCrossRefWrapperComp` card | 🖱️ / 🖱️R | — | a cross-ref card | 🖱️ header (toggle) / 🖱️R header | 🖱️ collapses/expands (`bi-chevron-down`↔`-right`, `show-*-bible-ref` setting); 🖱️R (while open) menu single "Refresh" → re-fetch | BibleCrossRefWrapperComp.tsx:26-62 | GAP |
| RD-58 | `BibleCrossRefRendererComp` header controls | 🖱️ / 🖱️R | Ctrl | cross-ref view | 🖱️ mini version selector; 🖱️R verse title parts (one-verse editor) | version swaps re-render; title editor changes the reference verse (`isOneVerse`, `waitUntilGotVerseStart`) | BibleCrossRefRendererComp.tsx:111-131 | GAP |
| RD-59b | `BibleCrossRefRenderFoundItem(s)Comp` / AI found item | 🖱️ / Shift-🖱️ / 🖱️R / ⇕ | Shift | cross-ref results present | 🖱️ / Shift+🖱️ / 🖱️R / drag an item | click loads (shift/force appends), 🖱️R menu Open/Copy/Save, drag serializes; badges S/FN/★/T/LXXDSS shown; error → "Fail to get data for" | BibleCrossRefRenderFoundItemsComp.tsx:44-101; BibleCrossRefAIRenderFoundItemComp.tsx:59-104 | GAP |
| RD-60 | AI-vigilant / Google-translate lightbulbs | 🖱️ | — | AI cross-ref card rendered | 🖱️ the `bi-lightbulb` in a card title | `openExternalURL(.../ai-vigilant)` or `.../google-translate-vigilant` (EX-04) | BibleCrossRefRendererComp.tsx:46-66; RenderAIBibleCrossReferenceComp.tsx:9-29 | GAP |

## K. Bible list (`BibleListComp`/`BibleFileComp`/`BibleItemRenderComp`) — presenter-right AND reader-left

| Proposed ID | Target | Interaction | Keys | Given | When | Then (observable) | Source | Status |
|---|---|---|---|---|---|---|---|---|
| PR-02 | `BibleItemRenderComp` list item | 🖱️🖱️ / 🖱️R / ⇕ | Shift | a bible item `li.list-group-item` | 🖱️🖱️ / 🖱️R / drag | 🖱️🖱️ `handleOpening` presents (presenter) / adds-right (reader) / loads-lookup; 🖱️R menu; drag reorders; live item gets `.app-on-screen` | BibleItemRenderComp.tsx:190-223 | REFINE (matrix says "🖱️ selects" — item has no single-click select; enumerate menu + subcontrols below) |
| PR-08 | `BibleFileComp` accordion | 🖱️ | — | a bible **file** row | 🖱️ the accordion header | expands/collapses (`bi-chevron-down`↔`-right`, `bi-book`↔`-fill`); `isOnScreen`→`.app-on-screen` | BibleFileComp.tsx:114-161 | GAP |
| PR-09 | `BibleFileComp` context menu | 🖱️R | — | a non-empty bible file | 🖱️R the file row | menu: Export to MS Word / Empty (→confirm "Empty Bible List") / Copy All Items / Move All Items To (+ attached-bg removal) | BibleFileComp.tsx:36-104 | GAP |
| PR-10 | `BibleFileComp` drop | ⇕ | — | a bible file | drop a bible item / a background onto it | bible item saved/moved into the file; else attach-background | BibleFileComp.tsx:204-220 | GAP |
| PR-24 | `BibleItemRenderComp` context-menu items | 🖱️R | — | a bible item | 🖱️R | items: Open, Lookup, Duplicate, Move To, Delete, Move up, Move down (+ Copy Title/Text/All/Verse-Full-Key/Chapter-Full-Key submenu) | bibleHelpers.ts:193-251; bibleItemHelpers.ts:25-63 | GAP |
| PR-11 | `BibleItemRenderComp` version mini-selector | 🖱️ | — | a bible item | 🖱️ its `BibleKeySelectionMiniComp` (isMinimal) | version menu; pick saves new `bibleKey` into the file | BibleItemRenderComp.tsx:228-243 | GAP |
| PR-12 | `BibleItemRenderComp` Ctrl+right-click title editor | 🖱️R | Ctrl | a bible item title | Ctrl+🖱️R book/chapter/verse span | chained target-picker menus (`withCtrl`) → saves new target to file | BibleItemRenderComp.tsx:251-262; BibleViewTitleEditorComp.tsx:302-304 | GAP |
| PR-13 | `BibleItemRenderComp` drag reorder | ⇕ | — | ≥2 items in one file | drag item over another | dragover sets opacity 0.5; drop reorders within the bible & saves | BibleItemRenderComp.tsx:147-189 | GAP |
| PR-14 | `RenderBibleItemsComp` Add-Bible-Item | 🖱️ | — | the **default** bible open + lookup popup available | 🖱️ "Add Bible Item" (`bi-book`) | opens the Bible Lookup popup | RenderBibleItemsComp.tsx:46-62 | GAP |
| PR-15 | `BibleListComp` new-file (`FileListHandlerComp`) | 🖱️ / ⌨️✎ | — | Bibles list | 🖱️ the list `+`/new → name it | `Bible.create` adds a new bible file to the list (shared `FileListHandlerComp`) | BibleListComp.tsx:47-61 | GAP |

## L. Bible notes (`note/*`) + note popup

| Proposed ID | Target | Interaction | Keys | Given | When | Then (observable) | Source | Status |
|---|---|---|---|---|---|---|---|---|
| PR-03 | `BibleNoteItemRenderComp` | 🖱️🖱️ / 🖱️R | — | a note item `li` (title "Double click to open note") | 🖱️🖱️ / 🖱️R | 🖱️🖱️ (or the `bi-journal` icon) opens the **Bible Note popup** window; 🖱️R menu | BibleNoteItemRenderComp.tsx:171-194 | REFINE (matrix says "🖱️ a note; edit"; real open is dbl-click/icon, edit-title is a menu action) |
| PR-16 | `NoteFileComp` accordion | 🖱️ | — | a note **file** row | 🖱️ header | expand/collapse (`bi-chevron`/`bi-book`) | NoteFileComp.tsx:121-143 | GAP |
| PR-17 | `NoteFileComp` add-item `+` | 🖱️ | — | note file expanded | 🖱️ green `bi-plus` | `createNewNoteItem` appends a blank note item | NoteFileComp.tsx:145-153 | GAP |
| PR-18 | `NoteFileComp` context menu | 🖱️R | — | a note file | 🖱️R | menu: Empty (→confirm "Empty Note List") / Copy All Items / Move All Items To / New Note Item / Import (default only) | NoteFileComp.tsx:40-111 | GAP |
| PR-19 | `NoteFileComp` drop | ⇕ | — | a note file | drop a note item / background | note item added/moved; else attach-background | NoteFileComp.tsx:219-235 | GAP |
| PR-21 | `BibleNoteItemRenderComp` context menu | 🖱️R | — | a note item | 🖱️R | menu: Open / Edit Title / Export (+ attached-bg removal) | BibleNoteItemRenderComp.tsx:76-120 | GAP |
| PR-22 | `NoteTitleEditorComp` inline edit | ⌨️✎ | Escape/Enter | note item, "Edit Title" chosen | type; Escape/Enter/blur | inline `SimpleNoteEditorComp` shows; Enter/Escape/blur commits+closes; empty shows "No title" | BibleNoteItemRenderComp.tsx:195-208; NoteEditorComp.tsx:33-95 | GAP |
| PR-23 | `BibleNoteItemRenderComp` drag reorder | ⇕ | — | ≥2 note items | drag over another | reorders within note & saves | BibleNoteItemRenderComp.tsx:147-161 | GAP |
| PU-03 | `NoteItemEditorPopupComp` (bibleNote.html) | ⌨️✎ + 🖱️ | Ctrl+S | note popup open | type in editor; save | editor renders into `#bible-note-root`; content persists (`updateAndSaveNoteItem`) | NoteItemEditorPopupComp.tsx:116-130; BibleNoteComp.tsx:45-120 | REFINE (matrix omits footer action buttons + floating lookup below) |
| PU-07 | Note popup footer action buttons | 🖱️ | Ctrl+Shift+B / Ctrl+Shift+Alt+K/T | note popup open | 🖱️ each footer button | Markdown-editor (`bi-spellcheck`→external), Bible-Lookup (`bi-book`→shows floating lookup), Always-on-top (`bi-window-*`, green when on), Bible-Key (shows key→version menu) | bibleNoteHelpers1.tsx:32-133 | GAP |
| PU-08 | Note popup floating Bible-Lookup insert | 🖱️ | Ctrl+Enter / Ctrl+Shift+Enter | floating lookup shown, a verse resolved | 🖱️ `bi-archive` (Insert Collapse) / `bi-box-arrow-in-left` (Insert) | appends bible full text into the note (2nd prefixes `^`); `FloatingWidgetComp` close works | NoteItemEditorPopupComp.tsx:41-113 | GAP |

## M. Reader shell / cross-cutting (already-covered anchors)

| Proposed ID | Target | Interaction | Keys | Given | When | Then (observable) | Source | Status |
|---|---|---|---|---|---|---|---|---|
| RD-01 | `BibleReaderComp` | load | — | navigate to reader.html | load | ready, NO `#app-header`; resize split "Bible and Notes" + "Bible Lookup" | BibleReaderComp.tsx:36-61 | COVERED |
| RD-12 | `BibleReadingLeftComp` lists on reader | 🖱️ etc | — | reader left column | as PR-02/PR-03/PR-08…PR-24 | same list/note behavior outside presenter; H/V flip by width | BibleReadingLeftComp.tsx:49-66 | COVERED (but its sub-rows PR-08.. are GAPs) |
| PR-01 | `Bibles`/`Notes` sub-tabs | 🖱️ | — | presenter-right or reader-left | 🖱️ each | panel switches | BibleReadingLeftComp.tsx:21-48 | COVERED |
| NAV-06/07 | Bible Lookup modal open | 🖱️ / ⌨️ Ctrl+B | — | presenter/editor | open modal | `RenderBibleLookupComp` in `#modal-container` (all RD lookup rows apply here too) | others/commonButtons.tsx | COVERED |

### Summary

- **COVERED: 8** (RD-01, RD-02, RD-03, RD-05, RD-07, RD-08, RD-12, PR-01 — listed for dedup; NAV-06/07 cross-referenced)
- **REFINE: 9** (RD-04, RD-06, RD-09, RD-10, RD-11, PR-02, PR-03, PU-03, KB-09)
- **GAP: 73** (RD ×50, PR ×16, PU ×2, KB ×5)

GAP + REFINE ids (6-word hooks):

- **RD-04 / KB-09** — Escape/Ctrl+Escape clear mapping is reversed
- **RD-06** — history entry is double-click, plus extras
- **RD-09** — find lacks refresh/suggestion/filter/reset/tabs coverage
- **RD-10** — cross-ref lacks collapse/refresh/item/version detail
- **RD-11** — version menu grouped, plus Add-New-Bible
- **PR-02** — list item: menu/version/title-editor/reorder detail
- **PR-03** — note item open is dbl-click/icon
- **PU-03** — note popup footer buttons + lookup
- **RD-13** — option arrow-key navigation moves active
- **RD-14** — Enter selects highlighted picker option
- **RD-15** — ArrowUp/Down moves focus to options
- **RD-16** — unavailable book option disabled state
- **RD-17** — chapter-zero intro expand toggle
- **RD-18** — verse range drag / shift-click selection
- **RD-19** — "Show all verses" expand button
- **RD-20** — previous/next chapter caret buttons
- **RD-21** — clear buttons disabled when empty
- **RD-22** — AI robot key-setting input popup
- **RD-23** — auto-play audio megaphone toggle
- **RD-24** — header export-to-MS-Word button
- **RD-25** — Wiki Dictionary wiktionary language menu
- **RD-26** — "Keep Open" popup checkbox (presenter)
- **RD-27** — reader header go-back/setting/help buttons
- **RD-28** — editing action buttons + their shortcuts
- **RD-29** — non-editing header action buttons
- **RD-30** — inline edit pencil + escape-to-input
- **RD-31** — close editing section x button
- **RD-32 / RD-32b** — add/remove extra parallel bible key
- **RD-33** — drop bible item into view
- **RD-34** — bible view context menu + search-in-find
- **RD-35** — bible view color-note dot
- **RD-36** — per-item audio-AI soundwave toggle
- **RD-37** — delete bible view button
- **RD-38** — draggable bible view title
- **RD-39** — right-click title book/chapter/verse editor
- **RD-40** — double-click verse number selects verse
- **RD-41** — click/alt-click verse text selects
- **RD-42** — double-click rest number extends range
- **RD-43** — no-bible empty state + drop
- **RD-44** — bible font-size slider + ctrl-scroll
- **RD-45** — new-line + model-new-line checkboxes
- **RD-46** — bible model-info menu (reloads app)
- **RD-47** — reader full-screen toggle button
- **RD-48** — "Add Item" parallel-version button
- **RD-49** — verse audio player + refresh menu
- **RD-50** — Find / Cross-Reference tab switch
- **RD-51** — find refresh (arrow-clockwise) button
- **RD-52** — find version selector
- **RD-53** — find suggestion menu (Tab applies)
- **RD-54** — find book-filter OT/NT menu
- **RD-55** — find reset-search-data / reset-books menu
- **RD-56** — find empty/loading/fail-controller states
- **RD-57** — cross-ref card collapse + refresh
- **RD-58** — cross-ref version selector + title editor
- **RD-59 / RD-59b** — found-item click/append/menu/drag (find+xref)
- **RD-60** — AI-vigilant / google-translate lightbulb links
- **PR-08** — bible file accordion expand/collapse
- **PR-09** — bible file context menu (export/empty/copy/move)
- **PR-10** — bible file drop target
- **PR-11** — list item version mini-selector
- **PR-12** — list item ctrl-right-click title editor
- **PR-13** — list item drag reorder
- **PR-14** — default bible "Add Bible Item"
- **PR-15** — new bible-list file creation
- **PR-24** — bible item full context-menu items
- **PR-16** — note file accordion expand/collapse
- **PR-17** — note file add-item plus button
- **PR-18** — note file context menu items
- **PR-19** — note file drop target
- **PR-21** — note item context menu (open/edit-title/export)
- **PR-22** — inline note title editor
- **PR-23** — note item drag reorder
- **PU-07** — note popup footer action buttons
- **PU-08** — note popup floating lookup insert
- **KB-14** — arrow keys navigate picker options
- **KB-15** — Enter selects picker option
- **KB-16** — Ctrl+Enter saves bible item
- **KB-17** — Ctrl+Shift+Enter save-present / insert
- **KB-18** — Ctrl+Shift+S/V split horizontal/vertical
