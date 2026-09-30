---
name: agent-data-tools-backup-undo
description: "Every agent write to user data is backed up first (no backup, no change); deletes go to the trash; owa_undo puts any change back and backs itself up"
metadata: 
  node_type: memory
  type: project
  originSessionId: c95a672a-48b7-47e0-a94d-10946a3ee48d
  modified: 2026-09-14T17:32:13.668Z
---

Asked for by the user on 2026-09-14: CRUD tools for saved Bible passages
(`owa_bible_item`), Bible notes (`owa_bible_note`), songs and slide documents
(`delete` on `owa_lyric_file` / `owa_slide_file`) and slides with their text
and style (`slides`, `add-slide`, `update-slide`, `delete-slide`,
`move-slide`, `duplicate-slide`) — then: *make sure all actions have backup
action, e.g. delete it should move to trash and can undo*.

**Why:** a Bibles list (`.owb`) and a notes file (`.own`) have NO editing
history — every save writes the file, no `*`, no Ctrl+Z — so without a backup
an agent's change to one is unrecoverable, and the OS trash cannot be emptied
back into a folder by a program either.

**How to apply:**

- `src/helper/agentBackupHelpers.ts` is the one store. Snapshot BEFORE the
  change (`snapshotAgentFile`, `snapshotAgentEditing`,
  `snapshotAgentFileForDelete`), then `runWithAgentBackup(summary, restores,
  change)`; a backup that cannot be saved throws `NoBackupError` and the change
  is refused.
- It lives in `<data folder>/agent-backups/`: `<id>.meta.json` (small, what a
  list reads) beside `<id>.data.json` (the texts, read only by an undo), the
  last 100 for 30 days (`agentBackupPlanHelpers.ts`, pure and unit-tested). It
  is not in the whole-data archive.
- An undo applies a rename, then files, then editing heads — a document's
  unsaved state can only go into a document that exists — takes its own backup
  first, and names later changes to the same file that went back with it.
  `owa_undo` with no id takes the newest change that is neither undone nor an
  undo; naming an undo's id redoes.
- A document delete is `trashAgentFile`: OS trash, sidecars, and the editing
  history discarded only once the file is really gone.
- The store is SHARED by every agent on the machine: a script checking undo
  must pass each change's own `undoId`, or it may undo another session's work.
- The firewall rations removals (every `delete*` and `undo`) at 10 per 5 min,
  apart from the 25 presses a minute. `owa_bible_note` refuses a write while
  that file is open in a `bibleNote.html` window, which saves its stale copy
  back over it.
- Cost: +1 089 tokens a round to the chatbot's model (24 tools, ~7 990).

Related: [[mcp-document-write-tools]], [[history-read-cache-stale-paths]], [[verse-marks-note-items]].
