# B3 Bible Search Guide

## Scope

This guide covers the `B3` Bible search workflow centered on `src/bible-find/`. Use it when changing Bible search UI, query execution, selected-book filtering, search suggestions, result rendering, pagination, or the local-versus-online search backend decision.

This guide does not cover Bible reader display in general, Bible lookup editing, or cross-reference internals except where they directly connect to Bible search.

## Entry Flow

The main Bible search path runs through the reader and lookup UI rather than a standalone page.

1. `html/reader.html` loads `src/reader.tsx`.
2. The reader page includes the lookup area and Bible search tabs.
3. `src/bible-find/BibleFindPreviewerComp.tsx` owns the `Find` versus `Cross Reference` tab selection.
4. `src/bible-find/BibleFindBodyPreviewerComp.tsx` resolves the active Bible key and loads a `BibleFindController` instance.
5. `src/bible-find/BibleFindBodyComp.tsx` coordinates the search header, selected-book filter, and paged results.

User actions can also open Bible search indirectly:

- `src/bible-reader/BibleViewComp.tsx` can send selected text into Bible search through `setBibleFindRecentSearch()` and `lookupController.openBibleSearch('s')`.
- `LookupBibleItemController.openBibleSearch` is the bridge that swaps the lookup pane to the search tab.

## Main Components and Responsibilities

### Search shell and tab routing

- `src/bible-find/BibleFindPreviewerComp.tsx`: tab shell for `Find` and `Cross Reference`.
- `src/bible-find/BibleFindBodyPreviewerComp.tsx`: creates or reloads the controller when the selected Bible changes.

### Search controller

- `src/bible-find/BibleFindController.tsx`: central controller for Bible search.
- Responsibilities:
  - decide between local XML-backed search and online search
  - cache controller instances per `bibleKey`
  - initialize SQLite database files for local search when needed
  - persist and load selected-book filters
  - load suggestion words for the header input

### Search body and state

- `src/bible-find/BibleFindBodyComp.tsx`: owns `findText`, `data`, and selected-book state.
- State semantics matter here:
  - `data === null`: no active data or empty search state
  - `data === undefined`: trigger a load or reload
  - `data` object: paged results are available and individual pages may still be loading lazily

### Header and suggestions

- `src/bible-find/BibleFindHeaderComp.tsx`: owns the persisted text input, debounced search triggering, refresh behavior, enter/escape handling, and suggestion-menu integration.
- `BibleFindController.handleNewValue()` generates suggestion menus from local SQLite suggestion words when available.

### Result rendering

- `src/bible-find/BibleFindRenderDataComp.tsx`: renders loaded pages, page placeholders, and the pagination footer.
- `src/bible-find/BibleFindRenderPerPageComp.tsx`: renders one page of results.
- `src/bible-find/RenderFoundItemComp.tsx`: renders one clickable result and bridges it back into Bible lookup.
- `src/bible-find/ShowFindingComp.tsx`: loading placeholder.

### Query and navigation helpers

- `src/bible-find/bibleFindHelpers.ts`: shared types plus helpers for pagination, online search calls, result highlighting, and opening clicked results in Bible lookup.

## Local Search Versus Online Search

### Local search path

Local search is used when the selected Bible key exists in the XML key map returned by `getAllXMLFileKeys()`.

- Controller path: `BibleFindController.getInstant()` -> `getXMLInstant()`
- Database provider: `appProvider.databaseUtils.getSQLiteDatabaseInstance()`
- SQLite implementation: `electron/client/databaseUtils.ts`
- Search handler: `DatabaseFindingHandler`

Local search uses a generated SQLite database file plus a `-success` marker file. If the database or success marker is missing, the controller rebuilds the database from Bible XML content.

### Online search path

Online search is used when the Bible key is not backed by local XML data.

- Controller path: `BibleFindController.getInstant()` -> `getOnlineInstant()`
- API metadata source: `bible-online-info.json` via `appApiFetch()`
- Search handler: `OnlineFindHandler`

Online search currently supports result retrieval but not local suggestion-word generation.

### Important rule

Bible search does not use the repo's custom `electronSendAsync()` reply-event pattern. Local search crosses into Electron through the provider's database utility instead.

## Data and Query Model

### Search request type

`BibleFindForType` in `src/bible-find/bibleFindHelpers.ts` contains:

- `text`
- optional `bookKeys`
- optional `fromLineNumber`
- optional `toLineNumber`
- optional `isFresh`

### Search result type

`BibleFindResultType` contains:

- `maxLineNumber`
- `fromLineNumber`
- `toLineNumber`
- `content` as an array of `{ text, uniqueKey }`

### UI paging state

`FindDataType` stores:

- `pagingData`
- `foundData`

`foundData` is keyed by page number string and uses three states:

- `null`: page intentionally empty or not yet assigned during first page map creation
- `undefined`: request this page now
- loaded result object: page already fetched

That `undefined` sentinel is what triggers lazy page loading in `doFinding()`.

## Local Database Initialization and Search Semantics

### Database build flow

`BibleFindController.initDatabase()`:

1. creates `verses` and `spell` tables
2. loads Bible XML content
3. sanitizes verse text with locale-aware helpers
4. inserts display text plus sanitized search text into `verses`
5. inserts spaced words plus book-key metadata into the FTS5 `spell` table
6. writes the success marker file

### Tables

- `verses(text TEXT, sText TEXT)`
- `spell` as an FTS5 virtual table with `text` and `bookKeys`

### Query behavior

`DatabaseFindingHandler.doFinding()` currently uses a `LIKE` query against `verses.sText`, not an FTS `MATCH` query for the main result set.

The query flow is:

1. sanitize the search text for the Bible locale
2. strip empty parts
3. build a wildcard pattern such as `%term1%%term2%`
4. optionally append a `bookKey` filter
5. fetch a limited page of rows
6. run a count query for total result size

Suggestion words are separate from result matching and come from the `spell` FTS5 table ordered by `bm25(spell)`.

## Selected-Book Filtering

Book filtering is owned by:

- `src/bible-find/RenderFindingInfoHeaderComp.tsx`
- `BibleFindController.selectedBookKeys`

The filter UI supports:

- all books
- old testament group
- new testament group
- single-book selection
- multi-select with shift-click

The selected book keys are stored in the setting named `bible-find-selected-book-key`.

Important caveat: this setting is shared at the feature level and is not namespaced per Bible version.

## Header Workflow and Suggestions

`BibleFindHeaderComp.tsx` has a few behaviors that are easy to miss.

- Search text is persisted in `bible-find-recent-search`.
- Typing is debounced with `genTimeoutAttempt(2000)`.
- `Enter` forces an immediate fresh search.
- `Escape` clears the input and search.
- the refresh button triggers a fresh search with the current text.
- `setBibleFindRecentSearch()` can inject search text from other flows such as Bible view text selection.

Suggestion menus:

- are driven by `BibleFindController.handleNewValue()`
- sanitize the current input according to locale
- use the last word as the lookup token
- render a context menu under the input field
- can apply completion on tab through the menu configuration

## Result Rendering and Navigation Back Into Lookup

### Highlighting

`breakItem()` in `bibleFindHelpers.ts`:

- sanitizes the search text
- sanitizes preview text for display
- wraps matched fragments with `<span class="app-found-highlight">...` for display
- reconstructs a `BibleItem` object from the result line format

### Result click behavior

`RenderFoundItemComp.tsx` makes each result:

- clickable: open inside Bible lookup
- shift-click aware: append result instead of replacing
- draggable: drag a Bible item into other parts of the app
- context-menu enabled: open, copy, and save flows

The main navigation helper is `openInBibleLookup()` in `bibleFindHelpers.ts`.

## Relation to Reader, Lookup, and Cross References

- `LookupBibleItemController` owns `openBibleSearch` and is the main integration point between lookup and search.
- `BibleFindPreviewerComp.tsx` installs a live tab-switching callback into the lookup controller.
- `BibleViewComp.tsx` can route selected text into Bible search from the reading UI.
- Cross-reference UI shares the same tab shell but is a separate feature surface.

When changing Bible search, check whether the behavior actually belongs in:

- `src/bible-find/` for search
- `src/bible-reader/` for lookup-reader integration
- `src/bible-cross-refs/` for cross-reference behavior

## Change Routing Guide

### Change search text entry, debounce, refresh, or suggestion behavior

- Edit `src/bible-find/BibleFindHeaderComp.tsx`
- Then verify any controller logic in `BibleFindController.handleNewValue()`

### Change local query behavior, ranking, page size, or database init

- Edit `src/bible-find/BibleFindController.tsx`
- Check `DatabaseFindingHandler`, `initDatabase()`, and `DEFAULT_ROW_LIMIT`
- If the change affects SQLite capabilities, verify `electron/client/databaseUtils.ts`

### Change online-search behavior

- Edit `OnlineFindHandler` and `findOnline()` in `src/bible-find/bibleFindHelpers.ts`
- Verify API payload and response assumptions

### Change selected-book filters

- Edit `src/bible-find/RenderFindingInfoHeaderComp.tsx`
- Check `BibleFindController.selectedBookKeys` storage and `DatabaseFindingHandler.doFinding()` book filter generation

### Change pagination or lazy loading

- Edit `src/bible-find/bibleFindHelpers.ts` and `src/bible-find/BibleFindBodyComp.tsx`
- Check `FindDataType.foundData` state transitions carefully

### Change result rendering or click/context-menu behavior

- Edit `src/bible-find/RenderFoundItemComp.tsx`
- Check `breakItem()`, `openInBibleLookup()`, and `openContextMenu()` in `bibleFindHelpers.ts`

### Change how reader text opens Bible search

- Edit `src/bible-reader/BibleViewComp.tsx`
- Check `setBibleFindRecentSearch()` and `LookupBibleItemController.openBibleSearch`

## Important Invariants

- Controller instances are cached by `bibleKey` in `instanceCache`.
- `getInstant()` is guarded by `unlocking()` to avoid duplicate initialization.
- Local XML availability decides whether search is local or online.
- The renderer owns search UI state, but local database access goes through the provider bridge into Electron.
- Search-text sanitization is locale-aware and must stay aligned with database initialization and result highlighting.

## Known Gotchas

- There are no Bible-search-specific tests in `src/bible-find/` today, so manual regression checking is important.
- The main result query is `LIKE`-based while suggestion words use FTS5. Do not assume the main result ranking matches the suggestion ranking model.
- Query strings are interpolated into SQL after sanitization and apostrophe stripping. If you change sanitization or query construction, keep SQL safety in mind.
- The selected-book setting is shared and not scoped per Bible version.
- If a local XML Bible exists, the controller prefers the local handler; it does not automatically fall back to online search for the same Bible key.
- `setBibleFindRecentSearch()` depends on the active header component wiring `setFindText`; if the search UI is not mounted, the setting still updates but the live input will not.

## Validation Checklist

After changing B3 Bible search, manually verify at least these flows:

1. Open the reader and switch to the `Find` tab.
2. Search with normal text and confirm results render.
3. Use `Enter`, `Escape`, and the refresh button in the header.
4. Test selected-book filtering with single-book and shift-click multi-select.
5. Click a result and confirm it opens in Bible lookup.
6. Shift-click a result and confirm it appends instead of replacing.
7. Right-click a result and confirm context-menu actions still work.
8. Trigger Bible search from selected reader text via `Search in Bible Search`.
9. If local XML search changed, verify database creation and re-open behavior.
10. If online search changed, verify failure behavior when the API is unavailable.

Use `npm run test` for any renderer regression coverage that exists and `npm run build` when the change affects shared Bible flows, provider integration, or search initialization.

## Suggested Next Docs or Skills

If B3 needs to be split further later, useful sub-areas are:

- B3a search UI and header behavior
- B3b local SQLite build and query pipeline
- B3c result rendering and lookup integration
- B3d online search integration
