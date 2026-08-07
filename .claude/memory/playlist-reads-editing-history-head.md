---
name: playlist-reads-editing-history-head
description: A playlist's live state is its editing-history head file, not the .owp — hand-editing the .owp changes nothing the app reads
metadata:
  type: project
---

`Playlist` extends `AppEditableDocumentSourceAbs`, so `getJsonData()` reads through
`EditingHistoryManager.getCurrentHistory()`: when a history exists the live document is
`<file>.owp.histories/<n>-head`, and the `.owp` itself is only what `getOriginalData()`
returns.

So editing a `.owp` by hand to set up a QA case does **nothing** — the tree, the floating
preview and every mutation keep using the head file, and the two files legitimately diverge.
Edit the `-head` file instead and the change appears on the list's **Reload**.

**Why:** on 2026-08-06 this cost a wrong High finding (a "stale cache serving an old .owp
for ever") and three wrongly BLOCKED/FAILED matrix rows. Edited against the head file,
PL-51 (damaged entry → one `Invalid item` row + toast), PL-62 and PL-84 (a pin naming a
missing screen keeps its badge, projects nowhere, toasts `Failed to apply to screen…`) all
pass exactly as specified.

**How to apply:** for playlist QA ([[owa-robot-test-playlist-mode]]) inject state into
`<playlist>.owp.histories/<n>-head`. Before blaming a cache for stale-looking document
state, check whether the file is history-backed. Related: [[filesource-cache-sliding-ttl]].
