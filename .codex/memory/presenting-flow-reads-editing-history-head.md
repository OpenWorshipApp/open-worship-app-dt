---
name: presenting-flow-reads-editing-history-head
description: "Editable documents live in their editing-history head file, not the saved .owpf/.ows — so hand-editing the saved file changes nothing, and UNSAVED edits propagate across windows and reach the projector"
metadata: 
  node_type: memory
  type: project
  originSessionId: ab32d8cf-8f9e-4ca5-8cb7-9ebfea51db5e
  modified: 2026-08-10T19:23:06.188Z
---

`PresentingFlow` extends `AppEditableDocumentSourceAbs`, so `getJsonData()` reads through
`EditingHistoryManager.getCurrentHistory()`: when a history exists the live document is
`<file>.owpf.histories/<n>-head`, and the `.owpf` itself is only what `getOriginalData()`
returns.

**This is the general rule for editable documents, not a presenting-flow quirk** (measured
live 2026-08-10 on a scratch `.ows`, editor in its own window): the head file is written the
moment you type, so the cross-window `fs.watch` chain fires on **unsaved** edits too and every
consumer renders the HEAD. Unsaved `X=600` showed in the Presenter's preview while the saved
`.ows` still held `100`, and **re-presenting projected the unsaved 600**. The `*` suffix on a
dirty document (`a2*`) is the operator's only warning. The live screen of an
already-presented slide is the one exception — it is a deliberate snapshot until re-presented.

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
state, check whether the file is history-backed. When a value looks wrong, read **both** the
head file and the saved file — they legitimately disagree while a document is dirty, and the
head is what renders. Never triage a cross-window propagation failure with "was it saved?":
saving is not what the readers read (the skill's XW-04 row claimed the opposite until
2026-08-10; corrected in knowledge-base §12.2b). Related: [[filesource-cache-sliding-ttl]].
