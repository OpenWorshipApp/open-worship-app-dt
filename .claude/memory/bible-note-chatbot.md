---
name: bible-note-chatbot
description: "Open in Chatbot on ONE Bible note: the note id rides the handoff, owa_note_edit runs ONLY in the note's own window (opened if closed), reads the live editor and writes through it, refusing another note by its whole path; verse tokens name their Bible [^(KJV) John 3:16]; edits Lexical blocks keeping the rest byte for byte; the assistant also MAKES a note (owa_bible_note add, opened and attached), never deletes one; words selected in the note window are quoted in the chat box with their line and range, in the tab ATTACHED to that note or window"
metadata:
  node_type: memory
  type: project
  originSessionId: 8967596b-2584-4afe-ba62-f2d3bcebd2f7
  modified: 2026-11-09T01:09:20.714Z
---

A Bible note conversation (2026-11-07, W-60, PL-110 / CB-169) is about ONE note
of a `.own` file, never the file: the row menu and the note window's robot hand
over `noteId` beside the path (`requestChatbotFile(path, null, noteId)`), the
attachment carries it (`ChatAttachmentType.noteId`), and `owa_note_edit` takes
`file` + `id` that the WINDOW fills in from the note's name.

What is not obvious from the code:

- **A note is read and changed ONLY in its own window, through its editor**
  (2026-11-08, the user: _it's dangerous to read and modify wrong file …
  bible-note chatbot should depend on bible-note UI controller_; goal _chatbot
  modifying files should work on the fresh latest user seen content_; _only
  bible-note is an edge case_ -- songs, slides and flows stay as they were).
  `owa_note_edit` finds the window by address, opens it from the main window
  when none is open, and the window's worker refuses any other note by its
  WHOLE path (a window's address names only the file NAME and id, so another
  Bible Notes folder's `Default.own` looks the same). The read is the
  editor's live state after a flush -- the history head trails typing by the
  1 s debounce -- and a change is put INTO the editor, whose `saveData`
  writes the history: one writer, one step of the editor's own Undo. Verify
  with a FRESH stdio server pinned to a scratch instance (the session's own
  MCP server cached the old tool code, [[mcp-tool-edit-two-processes]]); a
  scratch note window with an unsaved change does not exit on `taskkill`
  without `/F` (its close asks).
- **A verse token names its Bible**, `[^(KJV) John 3:16]`; before, the model
  could not see a chip's Bible, a kept token matched by words only, and an
  unnamed new one was read from the lookup's Bible -- so _make the English
  lines KJV_ added a second Khmer chip to each English line and the answer
  said KJV. The summary now names each new verse's Bible.
- **Other windows of the note follow the editing HEAD** through
  `all:app:note-head-changed`, relayed by main to every window (an undo of a
  note head sends it too). That relay is a MAIN-process change, so test it in
  a relaunched (or scratch) instance whose `electron-build/` was compiled with
  `tsc -p electron.tsconfig.json`, never with `electron:build`, which deletes
  the folder a running app uses ([[build-kills-running-dev-app]]).
- **A note with no history has no editing snapshot.** It is backed up as the
  file's state taken as the head, or "Undo this change" undoes nothing.
- **Byte-identical round trip is the bar**: every editable block of the dev
  data folder's real notes was given its own words back and must leave the
  note unchanged (it caught two adjacent same-format text nodes read as one
  run, and edge spaces moved outside the `**` marks).
- **gemma4:cloud tidying a note replaced a paragraph's words with a heading.**
  `checkLosesWords` now refuses another kind with fewer than half the words.
  The prompt says a heading is a NEW block.
- **A saved conversation had kept only three buttons per message**; every
  document card has five. `MAX_REPLY_COUNT` in `chatSessionHelpers.ts` is 5.
- The editor's own guide (`bible-note:ui/…`) answers only a search aimed at
  `focus: 'bibleNote'`; a note ask forces that focus. **A guide page offers
  no walkthrough at all**: `owa_guide_start` refuses demo mode for a page,
  and under _make text bigger_ both buttons answered "I could not do that
  just now" (2026-11-08).
- **Text size is the tool's job, not the guide's**: a change takes `size`,
  and _make text bigger_ / _make the words smaller_ / _make the words 20 px_
  are done by the window with no model. A run with no size of its own starts
  from its block's CSS size (15, h1 24, h3 12, code 13), not from 15.

- **The conversation works IN the note's own window** (2026-11-08, the
  user, the head of a note chat reading _Bible Reader · Auto_: _chatbot
  should demand select a bible-note window (open one if not opened)_). The
  row's menu, after the AI caution, asks main for the app's windows
  (`main:app:list-app-windows`, the help window's picker list) and opens the
  note's window when it is not among them -- not when the list cannot be
  read, since a second editor on one note writes its stale copy back. The
  help window then sets the tab to `bibleNote` and keeps the note's
  `{fileFullName, noteId}` per tab (`noteWindowBySession`), which
  `toNoteWindowAim` matches against the windows' addresses
  (`noteWindowMatchHelpers.ts`, `bibleNote.html?file=…&id=…`) BEFORE a
  window id or the opener's -- the help may have been opened from the
  Reader, whose opener aim would win otherwise -- and two note windows open
  are no reason for no aim. A window or kind picked by hand drops it.
  **It holds across a reload and a relaunch**: the target is read off the
  note the tab KEEPS (`findSessionNoteTarget`), `applyChatLaunchFocus`
  leaves a note tab alone (its keep predicate), and a note tab saved
  asking about another kind is put back on Bible Note -- a relaunch from
  the Reader had made it _Bible Reader_ again.

- **The toolbar is fields, and a small model must be SHOWN one**
  (2026-11-08, the user: _make chatbot able to use all toolbar operations_).
  Every control maps to a field or an Insert kind (inventory and parity in
  the `owa-enhance-bible-note-chatbot` skill). What the live run taught:
  gemma4:cloud never sent `color` from a field list -- it wrote HTML into
  `words` and claimed the colour -- until the prompt carried one example
  change; the tool now also reads that HTML, matches `words` as whole words
  first, and says in its summary what each change did. Link block text is
  kept in the note window's browser storage by block POSITION, not in the
  note: no change can make it -- so the change writes the editor's own
  entry there (node paths), as it does the ¶'s setting, both backed up
  as `home-setting` restores (2026-11-08, the four once excluded made the
  chatbot's too).
- **An open note window writes back what the editor would write another
  way, as a history step of its own** (2026-11-08, BN-12). A drawing left
  at the top (the editor keeps one in a paragraph) and five other kinds
  did, and _undo that_ undid the echo, not the drawing. Count the note's
  history steps with the window open: one a change. Changed blocks go
  through `normalizeNoteNode`; a code block's highlighting still
  echoes, and undo/redo step over it by `toNoteCanonicalText`.

- **The assistant MAKES a note too, never deletes one** (2026-11-08, the
  user: _chatbot should be able to create new bible note (not allow
  delete), after create should open the note and attach to the chatbot
  session_, then the goal _chatbot can put a lesson to a new bible note for
  user_). A line under a Reader answer is a `bible-reader` ask with its own
  short tool list -- that is why it said "I cannot write into your app" --
  so `owa_bible_note` is SHARED to the teaching asks (bible-reader, lookup,
  resources) and to a note ask (a NEW note only), with one prompt sentence
  (`noteCreatePromptHelpers.ts`). Told merely that it could, gemma4:cloud
  asked what to write; "never ask what to write" fixed it. The window
  attaches the note an `add` made off the result's `filePath`, through the
  same path a row's Open in Chatbot takes. A model's delete of a note or a
  notes file is refused everywhere.
- **A note window echoes what the editor would number or style another
  way** (BN-18): new list items must be numbered from `start`, and a list
  writes its FIRST item's first-text style (`textFormat: 1` under a bold
  first item) -- "last wins", read off the bundled reconciler, was wrong;
  five lists opened live settled it. Count history steps with the new
  note's window open: the add is one, the window none.
- **An answer goes INTO the attached note as a `section`** (BN-22): a
  short line right after a lesson (_new page_, _add it_) appends it, a
  page break first for "page" -- it had been read as a translation. A new
  `owa_note_edit` kind or field needs the scratch instance RELAUNCHED: its
  in-app host kept the old schema and refused `kind: "section"`
  ([[mcp-tool-edit-two-processes]]). And a developer-door edit must name
  the file with backslashes on Windows, or the open note window never hears
  the head change (it matches its own path).
- **A source edit reloads the scratch help window through the shared
  Vite**, dropping an attachment still waiting in the box (BN-19) -- a
  line asked next is not the note's. Ask again after the reload settles.

- **Words selected in the note ride to the chat as a quote** (2026-11-08,
  the user: _select bible note text then click the agent button then
  writing a qustion about the selected text_; `bible-note` 0.6.0's
  `appendFloatingActionButton`). The bar over a selection ends with **Ask the
  assistant about this**; `toNoteSelectionMention` reads the LINE around the
  words off the editor's DOM range (`p, h1..h6, li, blockquote, code, td,
  th`) and their 1-based range when one line, and the file hand-off carries
  it beside `noteId`. The box gets `Selected text (<note>, 43-47):` and the
  line with the words between `**` (the prompt says they are a selection
  mark, NOT bold -- the note read itself uses `**bold**`), plus a card of
  seven jobs under it (`genSelectionOffer`, a pseudo tool the model cannot
  press; Google and Copy need no model). Which tab: the one holding the note
  (box or open in what it asked), else one ATTACHED to the note's window --
  never a tab merely FOLLOWING the opener: a press in the note window turns
  every unchosen tab to Bible Note, and `toFocusWindowAim` then made an
  older unrelated chat "work in" the note window and take the words (seen
  live; `toTabWindowAim` takes `null` for a tab that chose no kind).
  **Testing it live**: a source edit hot-reloads the help window and drops
  what waits in the box and `noteWindowBySession` ([[dev-hmr-stale-state-qa]]),
  so test reuse with no edit between the presses; and the editor redraws its
  text on a double-click, so a `take_snapshot` uid is good for ONE select.

Verified live on a scratch dev profile ([[scratch-dev-instance-beside-user-app]]),
the AI caution's Open pressed over the scratch instance's own CDP after the
user allowed it in the conversation. Related: [[language-data-change-bumps-version]].
