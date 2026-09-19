---
name: mcp-uid-interlock
description: "The MCP firewall's point-don't-press rule now covers chrome-devtools' uid-aimed click/fill/drag, by remembering labels off the snapshot on its way out"
metadata: 
  node_type: memory
  type: project
  originSessionId: bf38e379-ea3a-4f16-a163-451460ad6c66
  modified: 2026-09-14T15:46:48.634Z
---

The destructive interlock in `tools/owa-devtools-mcp/firewall.mjs` refuses a
press aimed at something that cannot be undone. Until 2026-09-02 it could only
read `owa_click`/`owa_type`, which name the control — chrome-devtools' own
`click`/`fill`/`fill_form`/`drag` take a `uid` out of a snapshot and carry no
label, so the whole rule was two lines away from irrelevant:

```
take_snapshot            ->  uid=1_112 button "Clear All" ...
click({uid: '1_112'})                     <- nothing looked at this
```

**The uid only means anything because a snapshot said so, and that snapshot
came back through the firewall.** So `genUidLabelMemory` reads it on the way
out and the lookup happens on the way in. Four choices worth not undoing:

- **Only destructively-worded INTERACTIVE rows are kept** — one entry for the
  presenter's whole 354-line tree. Without the role filter, a Bible verse
  reading "and God shall take away and **remove** his part" makes its own text
  unpressable, which is the refuse-ordinary-work failure the label list is kept
  deliberately short to avoid.
- **Replaced per page, never merged.** chrome-devtools mints fresh uids on
  every snapshot, so a remembered `1_112` is a different element after the next
  one. A stale refusal is worse than a missed one.
- **Fed by every tool result, not just `take_snapshot`'s.** Every acting tool
  takes `includeSnapshot`, so a model could otherwise refresh its uids past the
  interlock without ever naming the snapshot tool.
- **Fails open on a uid it never saw** — a net, not a proof, the same call
  `redactSecrets` makes.

The model does not get those tools at all any more
([[mcp-model-hidden-tools]]), so this is the guard for the developer's door and
for any other HTTP client (`MC-01`: that door still has no credential).

The rows are no longer read in English only: since 2026-09-14 the label rule is
derived from the app's own `tran()` dictionary, so a Khmer snapshot row is
remembered too, and the same rule is applied in the page to the control a press
lands on ([[mcp-interlock-reads-the-control]]).

`press_key` is withheld from the model (2026-09-08); on the developer's door it
is still unguarded (`MC-13`). Its twin -- a walkthrough step's `press`, which
`owa_guide_step do` presses -- is judged by the control whose title names that
key since 2026-09-14.

Related: [[agent-access-mcp-chatbot]], [[hover-hidden-controls]].
