---
name: remote-key-take-over
description: "Three quick presses of a next key hand the keys to what is being presented (run sheet, then slides, then a slides popup); the user's four decisions, and why it is a capture listener"
metadata:
  node_type: memory
  type: project
  originSessionId: 9486773e-ca77-4fa6-892a-e2adaf3caaf7
  modified: 2026-10-13T03:45:31.327Z
---

`src/keyboard-shortcut/keyingAreaHelpers.ts` (2026-10-12) is how an operator
holding a presenter remote gets the "next" keys back without a mouse. Asked for
by the user: _imagine I'm holding remote-control I can't click to focus … try
attempting next keying multiple time shortly then I should got focused on
focusable area which having selected element by order_.

The areas' own focus gates ([[slide-arrows-need-panel-focus]],
[[presenting-flow-preview-run-player]]) are UNCHANGED. Each area only names
itself (`registerKeyingArea`), and one listener moves focus before the gates
are asked.

**The user's decisions — do not "improve" them without asking:**

- **3 presses inside 1.5 s** (not 2 inside 1 s: a double Arrow Down at the desk
  would trigger it).
- **The 3rd press only focuses.** The next press steps. An accidental hand-over
  must never change a screen.
- **No area with a selected element → nothing happens.** "Selected" is the run
  sheet's cursor, or a slide of that previewer's document live on a screen. A
  run sheet that is open but not started is NOT a candidate.
- **An unowned keyboard (`<body>`) follows the same order on the FIRST press**,
  and that press steps. Before this, one press on an empty background locked the
  remote onto the docked slides previewer even with a run in progress.
- Order: Presenting Flow preview, docked slides previewer, floating Slides
  preview. Of two of one kind, the floating widget on top, then document order.

**Why a capture listener on `window` and not `useKeyboardRegistering`:**
`EventHandler.checkOnEvent` runs keyboard listeners NEWEST-first and stops at
the first one that prevents the default, and an area that owns the key prevents
it even when it has nothing to step. A registered listener would see a press or
miss it depending on what mounted after it. The keyboard layer is therefore
checked by hand (`getLastLayer() === 'root'`).

**How to apply:**

- A new area that steps a screen with Space / arrows registers itself with a
  priority and a `checkHasSelected` that answers from memory — it is asked on a
  key press, never a read or a parse.
- A focused area that HAS a selected element clears the count. Without that,
  stepping fast through a song yanks focus to an open run sheet.
- A control that uses the key itself is exempt: typing targets, range and radio
  inputs, video / audio. Extend the list there, not at the call sites.
- Not solved: the keys reach the app only while its main window has OS focus.
- Verifying live: `owa_press_key` with `find` parks focus on a control first;
  three calls in a row land inside the 1.5 s. Presenting a slide to test it
  CLEARS a Long Text Show on that screen and can swap its background for the
  document's own — note the screen's state first and put it back.
