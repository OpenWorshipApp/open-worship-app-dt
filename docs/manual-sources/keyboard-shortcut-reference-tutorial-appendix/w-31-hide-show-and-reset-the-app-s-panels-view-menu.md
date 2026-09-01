---
id: W-31
title: "Hide, show, and reset the app's panels (View menu)"
section: "Keyboard shortcut reference (tutorial appendix)"
verify: [NAV-20, NAV-21, ST-22]
screenshots: 3
generatedFrom: user-workflows.md
workflowsVersion: "2026-08-31"
---
# W-31 — Hide, show, and reset the app's panels (View menu)

**Goal:** get a panel back after it collapsed, hide one you don't need, or put the
whole layout back the way it shipped.

Every resizable panel in the app is a **widget**. You can already collapse one by
dragging its divider all the way to the edge — it shrinks to a thin green strip with
its name on it, and clicking that strip brings it back. The **View** menu on the top
menu bar does the same thing by name, which is easier when the strip is hard to find.

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

5. **View → Reset Widgets Size** (កំណត់ទំហំ Widgets ឡើងវិញ). Answer **Yes** to
   `Are you sure to reset every widget size and reopen the widgets?` 📸
6. Every panel returns to the width and height it had when the app was installed, and
   **any panel you had collapsed is reopened**. This happens immediately — no reload.
   Answer **No** and nothing changes.

> This used to be a button in Settings → General, where it did nothing until you also
> clicked **Apply Settings** and the app reloaded. It is on the View menu now and takes
> effect at once.

::: details 🤖 Robot-verified — coverage traceability
This page maps 1:1 to a workflow the QA robot drives live. It proves these `coverage-matrix.md` rows:

`NAV-20` · `NAV-21` · `ST-22`

Regenerated from `user-workflows.md` (workflowsVersion 2026-08-31).
:::
