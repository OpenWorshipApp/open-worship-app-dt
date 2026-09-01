---
id: W-17
title: "Find text anywhere (Find bar) & About"
section: "Configuration"
verify: [PU-01, PU-05, PU-07]
screenshots: 1
generatedFrom: user-workflows.md
workflowsVersion: "2026-08-31"
---
# W-17 — Find text anywhere (Find bar) & About

- **Find bar:** press **Ctrl+F** (**⌘F** on macOS) or use **Edit → Find** in the app
  menu bar. A slim bar drops in at the **top-right of the window itself** and searches
  only that window. Presenter, Slide Editor, Bible Reader and Settings each have their
  own; the screens, the bible note and the code editors do not (they have their own
  search or nothing to find). 📸
  - Type to search as you go; the counter shows **`<current>/<total>`**.
  - **Enter** jumps to the next match, **Shift+Enter** to the previous one; the **⌃**
    and **⌄** buttons do the same and wrap around.
  - The **Aa** button toggles case-sensitivity. There is **no whole-word and no regex
    option** — Chromium's find-in-page does not offer them.
  - Drag the **grip** on the left to slide the bar **sideways** when it covers
    something you need to read; it stays inside the window and never leaves the top.
  - **Esc** or the **✕** button closes it and clears every highlight. Pressing
    **Ctrl/⌘+F** again re-selects the previous query instead of opening a second bar.
  - The bar is app chrome, not part of the page: it is drawn in its own view, so the
    query you type is never found by your own search.
- **About:** shows the app version and project links.

::: details 🤖 Robot-verified — coverage traceability
This page maps 1:1 to a workflow the QA robot drives live. It proves these `coverage-matrix.md` rows:

`PU-01` · `PU-05` · `PU-07`

Regenerated from `user-workflows.md` (workflowsVersion 2026-08-31).
:::
