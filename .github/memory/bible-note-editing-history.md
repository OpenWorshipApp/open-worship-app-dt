---
name: bible-note-editing-history
description: The bible-note editor autosaved a childless root into the file and bricked the note; it writes the editing history now and the human presses Save
metadata:
  node_type: memory
  type: project
  originSessionId: d75f14ee-c1f2-4d1c-8c4a-6ea951d52b9e
  modified: 2026-09-27T01:27:22.619Z
---

The `bible-note` package's editor **saves itself** — continuously, and whatever
state it happens to be in. Two things followed from that, both found on
2026-09-26 on a note the user reported as "can't open".

**A childless root cannot be loaded back.** Lexical's `setEditorState` throws on
a state whose node map holds the root alone (`Minified Lexical error #38`), and
the throw happens inside `LexicalComposer`'s initialisation, so the React tree
unmounts and the window paints **nothing** — the note is unopenable for good.
The app was handing the editor `null` for an empty note, which does NOT mean
"start blank": it tells the composer to leave the root ALONE, so the root stayed
childless and the autosave wrote it to disk. `loadData` hands over one empty
PARAGRAPH now (`toEditorContent`), and `toStoredContent` normalises a childless
root back to `''` on the way out — `checkIsEmptyNoteContent` in
`src/bible-list/note/bibleNoteHelpers.ts`, both ends.

Handing it `null` also seeded the package's own **Genesis 1 playground demo**
into the user's note, which the autosave then wrote to the file. The empty
paragraph closes that too.

**The editor writes the editing history, never the file** (the user's ask, and
the same rule the agent file tools follow). `saveData` → `note.updateNoteItem`
+ `note.addEditingHistory()`, debounced 1s per window; the window opens on
`Note.fromFilePathEditing` (the head, falling back to the file), so a window
closed with unsaved text comes back holding it. `BibleNoteEditingMenuComp` puts
`FileEditingMenuComp` in the editor's own footer — Undo / Redo / Discard / Save,
the same control the slide and lyric editors carry. It is labelled
**Undo Saved Change** / **Redo Saved Change**, not Undo/Redo, because the
rich-text editor's OWN undo arrow is in the same window and two controls of one
name are a guess for the user and unaimable for `owa_click`. An Undo moves the
head and the head is not a file the window watches, so the menu subscribes to
the FileSource update event and pushes the head's text back into the editor —
setting `noteItem.content` too, or the editor's next autosave writes it out
again and throws the Redo away.

**The Bible Notes LIST still writes the file straight through** — an item added,
deleted, recoloured, a verse marked: one press, nothing to review, and a
highlight that waits for a Save is a highlight that gets lost. `Note.save()`
therefore rebases any existing head onto the new file content, keeping the
head's own item TEXT (`takeItemContentsFrom`, verse items excluded), or a Save
pressed in the note window would put a deleted item back.

**Two performance decisions, both measured on a 304KB note file.** The note JSON
is written INDENTED (`Note.toJsonString`) because `EditingHistoryManager` keeps
a LINE diff: as one long line a single typed letter came back as "replace the
whole file". And the history write is debounced. Together: one word of typing
went from **10 entries × 608KB** to **one entry of 49KB**, with the file itself
only ~700 bytes bigger.

Related: [[history-read-cache-stale-paths]],
[[presenting-flow-reads-editing-history-head]], [[markdown-preview-window]].
