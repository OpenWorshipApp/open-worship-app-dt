---
name: bible-note-chatbot
description: "Open in Chatbot on ONE Bible note: the note id rides the handoff, owa_note_edit edits Lexical blocks keeping the rest byte for byte, writes the editing head and tells an open note window over a main-process relay"
metadata:
  node_type: memory
  type: project
  originSessionId: 8967596b-2584-4afe-ba62-f2d3bcebd2f7
  modified: 2026-11-08T12:12:58.198Z
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
  `focus: 'bibleNote'`; a note ask forces that focus, and a guide page offers
  no walkthrough outside the note window.

Verified live on a scratch dev profile ([[scratch-dev-instance-beside-user-app]]),
the AI caution's Open pressed over the scratch instance's own CDP after the
user allowed it in the conversation. Related: [[language-data-change-bumps-version]].
