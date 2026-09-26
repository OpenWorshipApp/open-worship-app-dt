---
id: W-04
title: "Auto-play slides on a timer"
section: "Presenting content"
verify: [PM-10, PM-137, PM-138, PM-140]
screenshots: 1
generatedFrom: user-workflows.md
workflowsVersion: "2026-09-25"
---
# W-04 — Auto-play slides on a timer

**Goal:** advance slides hands-free.

1. Open a document's slides (W-03 step 1).
2. Click the **stopwatch icon** at the bottom left of the slides previewer — a small
   strip opens: **✕**, play, the seconds box, the countdown, and a sliders button. 📸
3. Type the interval in seconds, then click **play**. Slides advance on the timer and
   the countdown says how long until the next one.
4. To change how it advances, click the **sliders** button. The rules open under the
   strip:
   - **[en:tran:Repeat All]** — keep going round. Unticked, the show stops at the last
     slide and leaves it on the screen.
   - **[en:tran:Step]** — how many slides each tick jumps.
   - **[en:tran:Random Up To]** — wait a random whole number of seconds up to this,
     drawn fresh for each slide. The draw is written into the seconds box before each
     wait, so you can see what it chose.
   - **[en:tran:Wait Until The Video Ends]** — clips only (Video Show, and a Videos
     background list): wait the length of the clip that is up. The seconds box shows
     that length.

   Close the rules with their **✕** or the sliders button again.

5. Click **pause** to stop, or the strip's **✕** to collapse it back to the stopwatch.

The same strip runs a show over a **Background** list — **[en:tran:Images]**,
**[en:tran:Videos]** and **[en:tran:Webs]**, appearing once that list has something on a
screen — and over each **Image Show** / **Video Show** / **Web Show** session, where it
rides the panel's top row. On the Webs list a saved **URL** is stepped just like a page
file.

::: details 🤖 Robot-verified — coverage traceability
This page maps 1:1 to a workflow the QA robot drives live. It proves these `coverage-matrix.md` rows:

`PM-10` · `PM-137` · `PM-138` · `PM-140`

Regenerated from `user-workflows.md` (workflowsVersion 2026-09-25).
:::
