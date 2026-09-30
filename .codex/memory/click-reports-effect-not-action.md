---
name: click-reports-effect-not-action
description: owa_click answers with what the press CHANGED (isOnNow/didChange/unverified), because a tool that reports its own action teaches a model to claim effects
metadata:
  type: project
---

`owa_click` used to answer `clicked: <the control>` and nothing else. That is a
tool reporting its own ACTION where the caller needs the action's EFFECT, and on
2026-09-03 it produced the worst answer this assistant has given: asked to turn a
projector on, it pressed a toolbar-reveal decoration and replied *"Done — the
screen is now showing"* with `showingScreenIds: []`.

**Why:** a volunteer told the screen is on stops looking for the reason it is
off. And no prompt fixes it on its own — the model was not lying, it had no way
to tell a press that worked from a press that hit the wrong thing.

**How to apply:**

- The answer now carries `isOnNow` (only when the control has an on/off state),
  `didChange`, and `unverified` — a full SENTENCE, not a flag, because a missing
  key is something a model infers past.
- The control is read back **~250 ms after** `target.click()`. This app
  re-renders on an event, not on the press, so reading it straight away reports
  the state BEFORE and every toggle would report "no change".
- Three kinds of evidence, weakest last: the element is GONE (it did
  something), a toggle flipped (the state itself), the label changed (same fact
  in words). Anything else is `didChange: false`.
- The aiming half is [[dom-match-exact-label-beats-everything]]: `matchTier`
  ranks an exact label above every looser fit, so a generic decoration titled
  "Show" beat the screen's own control. Naming matters more than ranking here —
  the word had to leave the label.
- Apply the same reading to every acting tool in
  `tools/owa-devtools-mcp`: does it report what it DID, or only what it touched?

Related: [[mcp-uid-interlock]], [[hover-hidden-controls]],
[[knowledge-label-i18n-templates]].
