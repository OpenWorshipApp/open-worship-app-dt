---
name: guide-press-safety-and-covers
description: "The walkthrough card presses only a control called exactly what the step says and never one behind a popup/menu/panel - the matcher's loose tiers are for pointing, and \"on screen\" is not \"reachable\"; measure Do it with scripts/demo-failure-rate.mjs, paced under the firewall's 25 acting calls a minute"
metadata: 
  node_type: memory
  type: project
  originSessionId: 7e78f17c-0c5c-4a56-b18a-3a7634da32e6
  modified: 2026-09-08T22:35:41.957Z
---

Two facts about the guide card (`tools/owa-devtools-mcp/guide.mjs`) that
every measure it had was blind to, both found 2026-09-08 by pressing Do it
through every recipe step (`.claude/skills/owa-enhance-chatbot/scripts/demo-failure-rate.mjs`):

- **A control can be on screen and unreachable.** Laid out, painted,
  enabled — and behind the Bible Lookup popup, which covers the window. The
  card rang it through the popup (the ring landed on a line of Genesis) and
  `Do it` clicked it, invisibly. Only `document.elementsFromPoint` at the
  control's own centre tells; `coverOf`/`layerOf` in the runtime name the
  layer (the modal container, `#app-context-menu-container`, `.floating-widget`,
  or a blocking confirm/alert/input) and the first press closes it — never a
  question the app is asking.
- **A loose match must never be pressed.** `domMatch`'s tiers 1–3 (a whole
  word inside a longer label, a word-start, all words somewhere) are right for
  a ring near a misspelt step and wrong for a click: the demo pressed the
  projector's *Clear All [F6]* for the drawing panel's *Clear*. `isPressSafe`
  (tier 0, or a label part equal to the words once `[F6]` and a leading glyph
  come off, or the very panel asked for) is the bar; a loose fit is refused
  with the label it found and reported as `nearest`.

**Why:** both read as "done" from the outside. The harness's first run
counted 92 presses done; a spot check of what was clicked found at least ten
wrong controls among them, which is worse than the 124 refusals.

**How to apply:** any change to the card or the matcher gets a
`demo-failure-rate.mjs` run before and after (card only: close the chatbot
window first, or every refusal spends a model round). Pace under the
firewall's 25 acting calls a minute or every row after the first minute is a
throttle error; skip W-02, whose first press navigates the window and unloads
the card; edits under `tools/owa-devtools-mcp/` restart the app and close the
chat window mid-run. Grade the DONE rows by the label they clicked, not just
the refusals. Related: [[dom-match-exact-label-beats-everything]],
[[hover-hidden-controls]], [[mcp-tool-edit-two-processes]].
