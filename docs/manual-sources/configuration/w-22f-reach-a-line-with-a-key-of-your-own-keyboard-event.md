---
id: W-22f
title: "Reach a line with a key of your own (Keyboard Event)"
section: "Configuration"
verify: []
screenshots: 2
generatedFrom: user-workflows.md
workflowsVersion: "2026-10-15"
---
# W-22f — Reach a line with a key of your own (Keyboard Event)

**Goal:** one shortcut that sends the run to a line and puts it — and everything attached
to it — on the screens at once, wherever the run had got to.

1. **Reach a line with a key of your own.** A **[en:tran:Keyboard Event]** is a shortcut you set yourself. Add it from the menu of the presenting flow (right-click the presenting
   flow itself → **[en:tran:Add Action]** → **[en:tran:Keyboard Event]**): it asks for the
   shortcut, and you answer by **pressing it** — the box is not typed into. Hold **Ctrl**
   or **Shift** (those two only, and at least one of them, so the shortcut means the same
   thing on any machine and cannot take a key the running order already uses) and press
   the key. The line then reads `⌨ Keyboard Event (Shift+A)`. Re-set it later from
   **[en:tran:Change Shortcut]**. Two lines may not share a shortcut — the second one is refused
   out loud — and duplicating a line leaves the copy without one. 📸
2. Now attach what it should put up, with **[en:tran:Add CC Elements]** — as many as you like, which
   is what makes one key worth more than one click: a slide _and_ its marquee together,
   say. Then, with the preview panel open (W-22b), pressing **Shift+A** sends the run to
   that line and puts all of it on the screens at once, wherever the run had got to.
   Pin the line to a screen with **[en:tran:Set Specific Screen]** if it should always go to the
   same one. The shortcut only answers while the preview panel has the keyboard, exactly
   as its arrow keys do — the panel takes it the moment you open it, so there is nothing
   to click first. With nothing attached yet it says so rather than doing nothing. 📸
