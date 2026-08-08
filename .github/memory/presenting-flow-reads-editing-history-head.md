---
name: presenting-flow-reads-editing-history-head
description: A presenting flow's live state is its editing-history head file, not the .owpf — hand-editing the .owpf changes nothing the app reads
metadata:
  type: project
---

`PresentingFlow` extends `AppEditableDocumentSourceAbs`, so `getJsonData()` reads through
`EditingHistoryManager.getCurrentHistory()`: when a history exists the live document is
`<file>.owpf.histories/<n>-head`, and the `.owpf` itself is only what `getOriginalData()`
returns.

So editing a `.owpf` by hand to set up a QA case does **nothing** — the tree, the floating
preview and every mutation keep using the head file, and the two files legitimately diverge.
Edit the `-head` file instead and the change appears on the list's **Reload**.

**Why:** on 2026-08-06 this cost a wrong High finding (a "stale cache serving an old .owpf
for ever") and three wrongly BLOCKED/FAILED matrix rows. Edited against the head file,
PL-51 (damaged entry → one `Invalid item` row + toast), PL-62 and PL-84 (a pin naming a
missing screen keeps its badge, projects nowhere, toasts `Failed to apply to screen…`) all
pass exactly as specified.

**How to apply:** for presenting flow QA ([[owa-robot-test-presenting-flow-mode]]) inject state into
`<presentingFlow>.owpf.histories/<n>-head`. Before blaming a cache for stale-looking document
state, check whether the file is history-backed. Related: [[filesource-cache-sliding-ttl]].
