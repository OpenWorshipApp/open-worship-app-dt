---
name: verse-marks-note-items
description: Highlights/comments on verse text are a SECOND kind of note item; toJson must spread or every save erases them, and marks are painted with CSS.highlights, not spans
metadata:
  type: project
---

A `.note` file now holds two kinds of item. An item with a `verseKey`
(`"(KJV) GEN 22:1"`) is a **verse item**: the highlights and comments made on that
one verse, each with its own uuid and `[start, end]` character offsets. Everything
without a `verseKey` is an ordinary bible note and behaves as it always did. Written
by `src/bible-list/note/verseAnnotationHelpers.ts`, always into `Note.getDefault()`.

**Why:** the user asked for marks to live in Bible Notes rather than in a parallel
store, so they ride the existing save, watch, archive and backup machinery and show up
in the panel beside the notes.

**How to apply:**

- `NoteItem.toJson()` spreads `...this.originalJson` FIRST, and that is load-bearing:
  `Note.items`' setter rebuilds *every* item through `toJson()` on *every* mutation of
  the file, so a field it does not carry is erased off unrelated items too. `update()`
  (which `NoteItem.save()` routes through) needs the same care.
- Offsets are into the concatenated text nodes of the `[data-bible-verse-key]` element,
  NOT into `verseInfo.text` — the words-of-Christ markup renders through
  `dangerouslySetInnerHTML` and the in-text lookup splits text nodes. Hence
  per-translation keys, and the stored `text` snapshot is re-checked on every paint.
- Marks are painted with the **CSS Custom Highlight API** (`CSS.highlights`,
  `::highlight()` rules in `others/appInit.scss`), never wrapper spans: zero DOM per
  mark, and it is the only thing that can paint over injected HTML. A mark is therefore
  not an element — hover is hit-tested via `caretPositionFromPoint`.
- Repaints are driven by ONE `MutationObserver` per bible view, not by enumerating
  invalidation triggers: on a chapter change React reuses the verse elements and only
  rewrites their text, so a `Range` stays valid while pointing at the wrong words.
- Verse items deliberately do NOT render through `BibleNoteItemRenderComp` — its
  double-click opens the `bible-note` editor whose first autosave rewrites `content`
  and would destroy the marks. See [[lyric-passes-appdocument-typecheck]] for the same
  shape of bug.
- `readNoteFileScan` in `bibleNoteShortVerseHelpers.ts` gates the lazy `bible-note`
  import on the TEXT items alone; a directory of only verse items must never pull
  lexical/excalidraw into a reader window.
- The verse row carries its own `⋮` and menu — Add to Bible List / Move To /
  Delete — and is draggable, serializing a **bibleItem** (not a note item) built
  SYNCHRONOUSLY from the verse key, because `dragstart` cannot await
  `BibleItem.fromTitleText`. No Duplicate: a second verse item for one verse is
  what the one-per-verse rule forbids.
- In the Bible Notes panel a mark row **wears the mark**: the words carry the same
  `--owa-verse-hl-*` wash (or the same wavy `--owa-verse-comment` underline) the reader
  paints them with, read straight from the custom properties in `appInit.scss` — no
  swatch dot, and the palette is never restated in TypeScript. The context menu's
  recolour chips stay swatches, because there the colour has no words to sit behind.
  `VerseNoteItemRenderComp.scss` is scoped `.app[data-bs-theme] .app-cue-list` to clear
  the theme sheets, and Sass expands **every** `&`, so `&--comment &__text` compiles to a
  selector containing `.app-cue-list` twice and silently matches nothing — write that
  pair out in full. See [[console-design-system-tokens]].

- A verse row's drag carries **two** payloads: the bible item in `text` (so the Bibles
  panel is unchanged) and the note item under `application/x-owa-drag-noteitem` via
  `addDragPayload`, read back with `extractDropDataOfType`. Adding that exposed a
  long-standing hole — `deserializeDragData` had NO `NOTE_ITEM` branch, so
  `extractDropData` returned `null` for every note item and both note-item drop targets
  (move between files, reorder inside a file) were dead code that looked alive. Guarded
  by `src/helper/dragHelpers.test.ts`.
- Clicking a mark row OPENS its verse as another bible view (`openVerseBibleItem` →
  `addBibleItemRight`), never `setLookupContentFromBibleItem`: taking over the lookup
  would lose the passage the mark was kept inside. Comment editing therefore lives on the
  mark's `⋮`, not on its click. The panel reads the controller with plain
  `use(BibleItemsViewControllerContext)` — the `useBibleItemsViewControllerContext` hook
  THROWS with no provider.
- `useBibleFontFamily(bibleKey)` is applied to the whole verse BLOCK, not to the marked
  words: set on the words alone, the comment beside them stayed in the UI font, one line
  in two scripts. The comment editor (title + textarea) and the hover tooltip take it too,
  which is why `VerseCommentTargetType` carries `verseKey` — parsing the display title
  for the key in its parentheses works but is not a contract.
- The hover tooltip's grace is 1200ms, not 250ms. The timer restarts on every mousemove
  outside the marked words, so what spends it is stopping to READ; the pointer resting on
  the tooltip cancels it outright, so a long value costs nothing.

- The selection toolbar and the comment hover tool portal to `document.body`,
  which is OUTSIDE the element carrying `data-bs-theme` — they must set it
  themselves from `useThemeSource()` or every `--bs-*` token resolves light. Same
  trap as any other portalled surface; see [[modal-layer-above-modal]].
