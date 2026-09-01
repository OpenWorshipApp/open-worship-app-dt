---
id: W-26
title: "Compare two documents side by side (floating slide previews)"
section: "Configuration"
verify: [PM-118, PM-119, PM-120, PM-126, PL-01, CM-06]
screenshots: 2
generatedFrom: user-workflows.md
workflowsVersion: "2026-08-31"
---
# W-26 — Compare two documents side by side (floating slide previews)

**Goal:** look at the slides of more than one document at the same time, without losing
the one you already had open.

**Preconditions:** at least two documents in the **Documents** list.

The middle panel previews the **one** document you have selected. To look at another one
as well, give it a window of its own.

1. In the left **Documents** (ឯកសារ) list, **right-click** a document you have NOT
   selected and choose **Open Slides Preview** (បើកការមើលស្លាយជាមុន). A window titled
   **Slides: ‹name›** appears over the app. 📸
   Faster, once you know it: hold **Ctrl** (**⌘** on a Mac) and click the row. Same
   thing, no menu — and holding Ctrl again on that row closes the window. The menu
   entry's tooltip reminds you of the shortcut.
2. It is the full previewer, not a thumbnail strip: the undo / redo / discard / save
   strip at the top, the slides, the **Note** boxes, and a zoom slider with the document
   name at the bottom. Everything you can do in the middle panel you can do here —
   click a slide to put it on the screen, drag a slide to reorder it, drop an image or a
   video onto it, right-click a slide for its menu.
3. Drag the window by its title bar to move it, drag any edge or corner to resize it, and
   use the **chevron** to fold it away to just its title. The **✕** closes it.
   **Double-click the title bar** to blow the window up to the whole app window;
   double-click it again to drop it back to the exact size and place it had. Every
   floating window in the app works this way.
4. Repeat step 1 on a second document. You get a **second** window — one per document, as
   many as you need, each opening slightly offset from the last. 📸
5. Zoom one window with its slider (or hold **Ctrl** and scroll over it). Only that
   window changes: every window and the middle panel keep their own zoom.
6. Click inside a window's slide area, then use **Arrow keys / PageUp / PageDown /
   Space** — they step **that** window's document, not whichever one the middle panel is
   showing.

Tips:

- **A document is previewed in one place at a time.** On the document you currently have
  selected, **Open Slides Preview** is greyed out ("Already showing in the main
  previewer" / កំពុងបង្ហាញក្នុងកម្មវិធីមើលមេ) — it is already in the middle panel;
  Ctrl-clicking that row does nothing at all, and in particular does not re-select it. And if
  you click a document that has a window open, the window closes and the document moves
  into the middle panel instead.
- Each window remembers **where you put it, how big you made it and how far you zoomed
  it**, per document — reopen it later and it comes back the same.
- Windows are **not** reopened when you restart the app; you start with a clean screen.
- Renaming or trashing a document closes its window.

::: details 🤖 Robot-verified — coverage traceability
This page maps 1:1 to a workflow the QA robot drives live. It proves these `coverage-matrix.md` rows:

`PM-118` · `PM-119` · `PM-120` · `PM-126` · `PL-01` · `CM-06`

Regenerated from `user-workflows.md` (workflowsVersion 2026-08-31).
:::
