---
name: guide-tucks-help-window
description: A walkthrough minimises the chatbot window via a DOM event relayed to main; visibilityState cannot tell you a window is minimised
metadata:
  type: project
---

Starting an interactive guide **minimises the chatbot popup** and closing the
card restores it. The card already dodges its own ring inside the page
(`avoidRing`), but the help window is a separate OS window on top of the app —
measured 2026-08-31, 515×540 over a 1243×837 presenter hid **25 of 208 named
controls (12%)**, wherever the user had parked it.

The chain, and why it has three hops: the guide runtime is the only thing that
knows a walkthrough started, and it may not import an app module (see
[[cdp-dynamic-import-hijack]]), so it cannot reach the main process — which is
the only place a window can be moved.

`guide.mjs` `signal()` → `document` event `owa-guide-running` →
`src/helper/domHelpers.ts` relay → `all:app:guide-running` →
`setGuideRunning` in `electron/electronHelpers.ts`.

**Why:** a card telling a volunteer to press a control hidden behind the help
window is the one thing a walkthrough must not do.

**How to apply:**

- `signal()` fires on a **change** of `state.isRunning`, not on every `start()`
  — pressing a walkthrough button starts the guide twice (the recipe card, then
  the model's refined one; backlog `EC-30`).
- `setGuideRunning` acts only on a window actually OVERLAPPING the guided one,
  and only ever undoes its own doing (`tuckedAwayWin`): a window the user
  minimised, or brought back mid-walkthrough, is left alone.
- It also `focus()`es the guided window — a demo `type` step needs genuine OS
  focus.
- The restore does **not** re-read `isMinimized()`. Whether the user took the
  window back is a thing to be told — `once('restore')` / `once('closed')` drop
  the reference — not a state to re-read a beat later.
- **`document.visibilityState` cannot tell you a window is minimised**: it
  reads `hidden` for one that is merely behind another. Check `IsIconic` on the
  window handle (a PowerShell `EnumWindows` probe) — verifying a window claim
  from inside the page reads as a pass or a fail for the wrong reason.
- **Deleting `window.__owaGuide` used to orphan the CARD.** The old
  `#owa-guide-host` stayed in the document with live click handlers, first in
  document order, so a script's `getElementById` drove the dead card. The
  runtime now removes a stale host when it installs — if you ever see two,
  that is the bug.
- Recovering it by hand keeps working: the taskbar, or the 🤖 button, which
  `handlePopupWindowOpen` answers by restoring the open window rather than
  making a second one ([[glassy-popup-windows]]).
