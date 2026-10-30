---
id: W-22e
title: "Loop a set of slides, stop the loop, and jump back (Next: Interval, Jump to)"
section: "Configuration"
verify: []
screenshots: 2
generatedFrom: user-workflows.md
workflowsVersion: "2026-10-29"
---
# W-22e — Loop a set of slides, stop the loop, and jump back (Next: Interval, Jump to)

**Goal:** a loop of announcement slides that runs by itself before the service and stops
where you say, and a running order that can go back to an earlier line.

1. Right-click **the presenting flow itself** — its own row in the list, not the empty part of
   the list and not one of its lines — and choose **[en:tran:Add Action]** →
   **[en:tran:Next: Interval]**. It asks how many **[en:tran:Seconds]**, and the answer is part of the
   line; right-click the line → **[en:tran:Change Seconds]** to change it. Like every `Next:` line
   it works only while the preview panel is open (W-22b).
2. **[en:tran:Next: Interval]** keeps going. It moves the run on every so many seconds — a loop of
   announcement slides before the service. Going somewhere yourself does not stop it, it
   **starts the count again from there**, so a line you step to by hand gets the whole
   interval rather than the second that was left of the last one. To stop it, click the
   ⊗ (**[en:tran:Stop Auto Next]**) on the pill it puts at the top-right of the preview panel (it shows the seconds left, in
   the same colour as the line that started it); the ⏸ on the same pill (**[en:tran:Pause Auto Next]**) holds the count where it is until you press it again. Closing the panel stops it too, as does
   reaching the end of the sheet.
3. **[en:tran:Next: Clear Interval]** stops that loop, and it is the
   one way the SHEET can stop it: the pill, closing the panel and the end of the list are
   all you being at the machine. Add it — it asks nothing, there being only ever one clock
   running — and the line reads `⊘ Next: Clear Interval` in the interval's own colour,
   because it is that same thing undone. Put it where the run will reach it: after slides the
   interval walks once, or attached to a slide (below), so the loop stops when that slide is
   shown and waits for you. A line after a **[en:tran:Jump to]** that points back at the
   interval is never reached — the jump fires the moment the run lands on it — so a loop like
   that is ended by you: press this line's button in the preview panel, or the pill's ⊗.
   Firing it when nothing is looping does
   nothing at all and says nothing, so it is safe to leave in a sheet you re-run. It stops
   an interval you have PAUSED as well; a **[en:tran:Next: Timeout]** it leaves alone, so a wait
   attached to a slide is never killed by a line that only meant to end a loop. 📸
   **A Next: Interval cannot ride along with another line** —
   an interval is not stopped by anything you do, so one riding a slide would keep moving
   the running order on with nothing to call it off but the panel's own pill. A
   **[en:tran:Next: Clear Interval]** CAN be attached, for the opposite reason: "put this last slide
   up **and** stop the loop" is one click, and something that stops a loop can never run
   away with the running order.
4. **Go back, not just forward.** **[en:tran:Jump to]** is how a running
   order reaches a line that is not the next one. Add it from the same menu as the interval — right-click
   the presenting flow itself, not one of its lines → **[en:tran:Add Action]** →
   **[en:tran:Jump to]** — then drag the new line from the end of the list, where it
   lands, to where the run should meet it, and right-click it →
   **[en:tran:Add CC Elements]** and pick the line it should go to — its list is everything in the
   presenting flow, **a whole song included**, because here the attached line is not something
   that rides along, it is the destination. It takes exactly one, so once you have picked
   the **[en:tran:Add CC Elements]** entry is gone; to re-aim it, remove the CC and pick another.
   To jump now, right-click the presenting flow → **[en:tran:Open Preview]**, then click
   the **[en:tran:Jump to]** button in the preview; reaching it with **Space** does the same. 📸

   **It is the next key aimed at a line of your choosing**: when the run reaches it — or
   you click it — the panel goes to that line and does there exactly what stepping onto it
   would have done. A song opens at its first slide; a **[en:tran:Next: Interval]** or **[en:tran:Next: Timeout]** it lands on is STARTED. That last one is how a set loops: put the slides
   under a **[en:tran:Next: Interval]**, and a **[en:tran:Jump to]** at the end of them pointing back at that
   interval — the set then plays round and round on its own until you stop it with the
   pill. (A jump that lands on another jump stops there rather than jumping again, so a
   pair of them cannot send the run back and forth for ever.) If it has nothing attached,
   or the line it named has since been deleted, it says so instead of quietly doing
   nothing.
5. **A loop of slides before the service, from start to finish.** The slides of the set
   are lines of the presenting flow already. (a) Right-click the presenting flow →
   **[en:tran:Add Action]** → **[en:tran:Next: Interval]**, type the seconds each slide
   stays, and drag that line above the first slide of the set. (b) Right-click the
   presenting flow → **[en:tran:Add Action]** → **[en:tran:Jump to]** and drag it under
   the last slide of the set; then right-click the **[en:tran:Jump to]** line →
   **[en:tran:Add CC Elements]** and pick the **[en:tran:Next: Interval]** line. (c) Open
   the preview panel (W-22b) and click the **[en:tran:Next: Interval]** button there: the set
   plays round and round by itself. It stops when you click **⊗** on the pill at the
   top-right of the preview panel, or close the panel. Nothing is dragged ONTO the
   interval or the jump: they are lines of their own, in the list.
