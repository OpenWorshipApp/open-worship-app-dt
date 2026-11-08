---
name: bible-note-chatbot
description: "Open in Chatbot on ONE Bible note: the note id rides the handoff, owa_note_edit edits Lexical blocks keeping the rest byte for byte, writes the editing head and tells an open note window over a main-process relay; the assistant also MAKES a note (owa_bible_note add, opened and attached), never deletes one"
metadata:
  node_type: memory
  type: project
  originSessionId: 8967596b-2584-4afe-ba62-f2d3bcebd2f7
  modified: 2026-11-08T21:50:05.969Z
---

A Bible note conversation (2026-11-07, W-60, PL-110 / CB-169) is about ONE note
of a `.own` file, never the file: the row menu and the note window's robot hand
over `noteId` beside the path (`requestChatbotFile(path, null, noteId)`), the
attachment carries it (`ChatAttachmentType.noteId`), and `owa_note_edit` takes
`file` + `id` that the WINDOW fills in from the note's name.

What is not obvious from the code:

- **Changes go to the editing HEAD, and an open note window would never see
  them on its own.** It watches only its file, and its next keystroke would
  write its stale copy back. The worker and an undo of a note head send
  `all:app:note-head-changed`, relayed by main to every window. That is a
  MAIN-process change, so test it in a relaunched (or scratch) instance whose
  `electron-build/` was compiled with `tsc -p electron.tsconfig.json`, never
  with `electron:build`, which deletes the folder a running app uses
  ([[build-kills-running-dev-app]]).
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

Verified live on a scratch dev profile ([[scratch-dev-instance-beside-user-app]]),
the AI caution's Open pressed over the scratch instance's own CDP after the
user allowed it in the conversation. Related: [[language-data-change-bumps-version]].
