---
name: fill-skips-react-state
description: "chrome-devtools `fill` can set a controlled textarea's DOM value without React state — use owa_type instead"
metadata:
  node_type: memory
  type: reference
  originSessionId: df0bef19-c3e9-4546-b80e-20bd5e94e8c8
  modified: 2026-10-20T17:13:32.597Z
---

In the chatbot's controlled ask box (`value={question}` from the active
session's draft), chrome-devtools-mcp `fill` set the DOM value (the a11y
snapshot then showed it) while React state stayed `''`; the next press read
the box as empty — four Report presses each answered "Tell me what went wrong
first", which reads like an app bug but is the driver.

**How to apply:** drive text entry through `owa_type` (it types with real key
events and per-keystroke `onChange`), and when a press's effect contradicts a
snapshot, distrust the snapshot's `value=` — it is the DOM property, not
React state. Found 2026-10-20; contrast with §6e's input popup where `fill`
works (that box is not React-controlled the same way).
