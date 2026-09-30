---
name: message-editor-text-is-local-state
description: Foreground Messages editors hold their text in LOCAL state — deriving a controlled textarea from the blank-line-joined session string ate every space and Enter typed at the end
metadata:
  node_type: memory
  type: project
  originSessionId: a24d7439-2c44-4661-8bf9-b2598198c5cf
  modified: 2026-09-26T15:23:35.716Z
---

A Messages **session** is persisted as its messages joined by a blank line
(`MESSAGE_SEPARATOR = '\n\n'`, split back on `/\n\s*\n/`). That format cannot represent a
message's **own trailing newline**, so `toMessageList` strips trailing whitespace as it
parses.

The trap: the textarea used to be a fully controlled input whose `value` came from that
parse. So every **space or Enter typed at the END of a message** was serialized, parsed
straight back off, and written over the caret — the character simply never appeared, while
typing in the MIDDLE worked normally. Reported by the user with a screenshot of the caret
sitting at the end of a line that would not grow.

The fix is the state model, not the regex: `messageList` is **`useState`**, seeded from the
stored string and re-seeded only when the change came from OUTSIDE the panel (the saved-text
picker, or switching session). `lastAppliedRef` records what the panel itself last wrote so
its own writes do not bounce back through the lossy parse, and every writer —
text change, add, remove, move — goes through the single `applyMessageList`.

Two things that follow:

- A trailing **space** now round-trips through the setting file as well (`"abc \n\ndef"`
  still splits correctly). A trailing **newline** survives while editing but normalises away
  on reload — the format genuinely cannot store it, and that is acceptable.
- **Add Message** is disabled while any editor is empty. `toStoredText` collapses a list of
  empty editors to one space, so a second press could only ever be a silent no-op.

Anything else that derives a controlled input's value from a lossy serializer will have the
same bug. Related: [[foreground-effects-one-setting]].
