---
id: W-31
title: "Hide, show, and reset the app's panels (View menu)"
section: "Keyboard shortcut reference (tutorial appendix)"
verify: [NAV-20, NAV-21, ST-22, GL-17, GL-18]
screenshots: 4
generatedFrom: user-workflows.md
workflowsVersion: "2026-09-18"
---
# W-31 — Hide, show, and reset the app's panels (View menu)

**Goal:** get a panel back after it collapsed, hide one you don't need, or put the
whole layout back the way it shipped.

Every resizable panel in the app is a **widget**. You can already collapse one by
dragging its divider all the way to the edge — it shrinks to a thin green strip with
its name on it, and clicking that strip brings it back. The **View** menu on the top
menu bar does the same thing by name, which is easier when the strip is hard to find.
And the divider itself has a right-click menu that does it in place (steps 7–9) —
the only way in a popup window, whose menu bar is hidden.

1. Open **View** on the top menu bar → **Widgets** (Widgets). 📸
   You get one tick-box per panel on the page you are looking at, e.g. on the
   presenter: `App Presenter Left` / `App Presenter Middle` / `App Presenter Right`,
   `Document List`, `Presenting Flow List`, `Presenter`, `Background`,
   `Bible and Notes`, `Mini Screen`, `Bibles`, `Bible Notes`, `Previewer`, `Slides`.
   - **Ticked** = the panel is open. **Unticked** = it is collapsed to its strip.
2. Click a ticked one — that panel collapses to its green strip, and the space goes to
   its neighbour. 📸
3. Click it again — the panel comes straight back. Nothing reloads and nothing you
   were doing is interrupted.
4. Panels that the app does not let you collapse (the Background media/audio split,
   the bible previewer, the lyric Stage Previewer) are simply not listed.

**Put everything back:**

5. **[en:tran:Reset Widgets Size]**. Answer **Yes** to
   `Are you sure to reset every widget size and reopen the widgets?` 📸
6. Every panel returns to the width and height it had when the app was installed, and
   **any panel you had collapsed is reopened**. This happens immediately — no reload.
   Answer **No** and nothing changes.

**Or use the divider between two panels** — no menu bar needed, so this also works
in a popup window:

7. Right-click the **divider between Document List and Presenting Flow List** — the
   thin line between the two panels on the left of the presenter (every divider in the
   app has this menu) — and choose **[en:tran:Close First Widget]**. 📸 The first of
   the two panels (the left one, or the upper one) collapses to its green strip and the
   other takes its space. `Close Second Widget` does the same to the other panel.
   Hovering the divider shows the same two choices as small arrows, each named for
   the side it closes — **[en:tran:Collapse left panel]** / **[en:tran:Collapse right panel]**,
   or **[en:tran:Collapse top panel]** / **[en:tran:Collapse bottom panel]** on a
   divider between an upper and a lower panel. A collapsed panel has no divider — if
   one of the two is already a strip, click the strip first.
8. Click the green **Document List** strip — the panel comes straight back.
9. Right-click the **divider between Document List and Presenting Flow List** again and
   choose **[en:tran:Reset Size]** — just those two panels return to the sizes they
   shipped with. Double-clicking the divider does the same. The View menu's
   `Reset Widgets Size` (step 5) is the version for every panel at once.

> This used to be a button in Settings → General, where it did nothing until you also
> clicked **Apply Settings** and the app reloaded. It is on the View menu now and takes
> effect at once.

::: details 🤖 Robot-verified — coverage traceability
This page maps 1:1 to a workflow the QA robot drives live. It proves these `coverage-matrix.md` rows:

`NAV-20` · `NAV-21` · `ST-22` · `GL-17` · `GL-18`

Regenerated from `user-workflows.md` (workflowsVersion 2026-09-18).
:::
