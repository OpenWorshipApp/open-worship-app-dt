---
id: W-22c
title: "Clear the screen, or show and hide it, from a running order"
section: "Configuration"
verify: []
screenshots: 2
generatedFrom: user-workflows.md
workflowsVersion: "2026-10-13"
---
# W-22c — Clear the screen, or show and hide it, from a running order

**Goal:** put something to _do_ in the running order — clear a screen, light it, darken
it — rather than something to show.

1. **Add a screen action.** A running order can also hold something to _do_ rather than
   something to show. Right-click **the presenting flow itself** — its own row in the
   list, not the empty part of the list and not one of its lines — and choose
   **[en:tran:Add Action]**: every action is added from that one menu. For a clear,
   pick **[en:tran:Clear Screen]** there — a row that adds nothing and opens the clears — and then
   one of **[en:tran:Clear All]**, **[en:tran:Clear Background]**, **Clear
   Slide** ([en:tran:Clear Slide]), **[en:tran:Clear Long Text]** or **[en:tran:Clear Foreground]** — the same five clears as the buttons on each mini screen, and the line
   carries the same `ALL` / `BG` / `SL` / `LT` / `FG` badge so you can tell them apart at a
   glance. It lands at the end of the list; drag it up to where it belongs — say between
   the last song and the sermon. 📸

   Under those five, **[en:tran:Other Clear FG Items]** offers a **finer clear
   for one foreground widget at a time**, so you can take the countdown down and leave the
   marquee running: **[en:tran:Clear FG Messages]** (`MS`), **[en:tran:Clear FG Marquee Top]** (`M↑`), **[en:tran:Clear FG Marquee Bottom]** (`M↓`), **[en:tran:Clear FG Quick Text]** (`QT`), **[en:tran:Clear FG Countdown]** (`CD`), **[en:tran:Clear FG Stopwatch]** (`SW`), **[en:tran:Clear FG Time]** (`TM`), **[en:tran:Clear FG Video Show]** (`VD`), **[en:tran:Clear FG Image Show]** (`IM`), **[en:tran:Clear FG Camera Show]** (`CM`), **[en:tran:Clear FG Screen Show]** (`SS`) and **[en:tran:Clear FG Web Show]** (`WB`). Each does exactly what that widget's own hide button in the **[en:tran:Foreground]** panel does; the `Messages`, `Time`, `Video Show`, `Image Show`, `Camera Show`, `Screen Show` and `Web Show` ones clear all of their items at once.
2. **A screen action is run, not shown.** Click it to clear, drag it onto one mini screen
   to clear only that one, or right-click → **[en:tran:Apply on Screens]** to choose. It never
   lights up as "live", because there is nothing of it on the screen to be live. In the
   preview panel (W-22b) it is stopped on and fired like any other line — so a
   **[en:tran:Clear All]** between the last song and the sermon means one more press of the same
   key blanks the screen at exactly that point in the running order.
3. **Put the screen itself up and down.** Two more actions are not about what is _on_ a
   screen but about whether there is one: **[en:tran:Screen: Show]** and
   **[en:tran:Screen: Hide]**, the same thing the slides button on each mini screen
   does by hand. Use them when the running order has to work with nobody at the machine —
   a **[en:tran:Screen: Show]** at the top of a pre-service loop, a **[en:tran:Screen: Hide]** at the end of
   it, and the screen goes dark on its own instead of holding the last announcement until
   someone notices.

   **These two ask which screen** when you add them, and that is the whole point: a
   checklist of the screens you have open appears (**Screen id: 0**, **Screen id: 1**, …,
   each in that screen's own colour), and the line remembers your answer as its pin — the
   line shows the pin badge, and **[en:tran:Set Specific Screen]** re-aims it later. Unlike every
   other line, it goes to those screens and _only_ those: it will not fall back to
   whichever screen you happened to have selected, and it will never stop to ask, because
   at 7:05 on an unattended sheet there is nobody there to answer. Tick nothing and the
   app says **[en:tran:Please choose at least one screen]** rather than adding a line that would do
   nothing. Firing one twice is harmless — a **[en:tran:Screen: Show]** on a screen that is already
   up does nothing at all, so it is safe inside a loop. Nothing can be attached to them
   either, though they can themselves be attached to another line — "put this last slide
   up **and** light the screen" in one click. 📸
   Clicking one goes to the screens it names and nowhere else; **[en:tran:Apply on Screens]**
   still asks, since that entry is you saying "send this one somewhere else" — but it
   does not change what the line is pinned to.
4. **Where the actions live in the menu.** **[en:tran:Add Action]** opens with **[en:tran:Clear Screen]** —
   one row that adds nothing and opens the five clears, with **[en:tran:Other Clear FG Items]**
   under them for the twelve per-widget foreground clears — then **[en:tran:Screen: Show]** / **[en:tran:Screen: Hide]**, then the five that drive the run.
