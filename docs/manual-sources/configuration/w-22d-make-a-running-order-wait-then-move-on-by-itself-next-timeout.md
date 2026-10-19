---
id: W-22d
title: "Make a running order wait, then move on by itself (Next: Timeout)"
section: "Configuration"
verify: []
screenshots: 4
generatedFrom: user-workflows.md
workflowsVersion: "2026-10-18"
---
# W-22d — Make a running order wait, then move on by itself (Next: Timeout)

**Goal:** a slide that lingers and then goes on without you, or a notice board that
ends exactly when the service starts.

1. **Let the running order walk itself.** In the **[en:tran:Presenting Flows]** list (not
   in the preview panel), right-click **the presenting flow itself** — the
   row with its name on it, not the empty part of the list and not one of its lines — and
   choose **[en:tran:Add Action]** → **[en:tran:Next: Timeout]**. That adds a NEW line to
   the running order; it is never added by right-clicking a line that is already there.
   It goes at the END of the running order: drag it up to just after the line it should
   follow.
   It asks how many **[en:tran:Seconds]**, and the answer is part of the new
   line — `⏱ Next: Timeout (5)` — so a glance at the sheet tells you how long it waits. Got
   it wrong? Right-click that `Next: Timeout` line → **[en:tran:Change Timing]**; it opens
   on what it is holding now. 📸
2. **[en:tran:Next: Timeout]** waits once. When the run reaches it, it counts down and then moves
   the run on by itself — a slide that should linger ten seconds and then go on without
   you. **Going somewhere yourself calls it off**: click another line, or press the next
   key, and the wait is over and you are driving again. A click that goes nowhere does
   NOT call it off: clicking a background or a foreground button, or a stray click on
   the panel, leaves it counting, so a mis-aimed click cannot silently cost you the wait.
3. **Or wait until a time on the clock.** A timeout does not have to be counted in
   seconds. The small box that asks for the seconds — it opens when you add the line
   (step 1, then drag the new line up to just after the line it should follow), and again from right-click → **[en:tran:Change Timing]** on that line — has a
   chooser at its left: switch it from **[en:tran:Seconds]** to **[en:tran:At Time]** and type the
   time you want the run to move on — `7:05 AM`, `8:30 PM`. The line then reads `⏱ Next: Timeout (7:05 AM)`, and
   the pill counts down in minutes and hours (`4:58`, `1:12:30`) instead of a long number
   of seconds. Use it for the notice board before a service: put it on the last
   announcement and the run leaves it exactly when the service starts, whether you armed
   it an hour or five minutes before. Its menu entry is **[en:tran:Change Timing]** rather than **[en:tran:Change Seconds]**, and it opens on whichever half
   you armed it with — the two are alternatives, so choosing one clears the other. If the
   time you set has **already gone by**, the app says so (**[en:tran:The set time is already due]**)
   and starts nothing: it will not quietly wait until tomorrow. Set a new time, or arm it
   in seconds. 📸
4. **It counts only in the preview panel.** A `Next:` line means something only while that
   presenting flow's **preview panel** is open (W-22b) — that panel is what walks the
   running order: clicking the line there starts its countdown, and a small pill at the
   panel's top-right shows the seconds left, with ⊗ to stop it and ⏸ to hold it. Click the
   line with the panel closed and the app says so
   (**[en:tran:Open the presenting flow preview to use this action]**) rather than looking as
   though it did something. It never goes to a screen, so it has no **[en:tran:Apply on Screens]**
   and no **[en:tran:Set Specific Screen]**, and nothing can be attached to it.
5. **A timeout can also ride along with another line.** Attach it to a line — a
   slide, a song, a verse — as a **CC element** (W-22g), and that line means "show this,
   and go on by yourself N seconds later". Add the **[en:tran:Next: Timeout]** once, right-click the
   line you want it on → **[en:tran:Add CC Elements]** and pick it. Keep the
   `Next: Timeout` line itself in the list, though: a CC points at that line rather than copying it, so removing the line removes every follower of it as well (park it with **[en:tran:Disable]** if the run should not stop there — its followers still fire). Attached to
   a whole SONG it rides every slide of it, which is how a song advances by itself. 📸
6. **Each line may wait for its own length.** First create a timeout if there is none:
   right-click the presenting flow's own name → **[en:tran:Add Action]** →
   **[en:tran:Next: Timeout]** and enter its seconds. Right-click each line that needs
   a wait → **[en:tran:Add CC Elements]** and pick that timeout. It appears as an
   indented CC row under each line it is attached to. A CC line normally reads whatever the
   `Next: Timeout` line is set to, so re-arming that one line re-arms every follower of it
   at once. When one line needs a different wait, click the small **stopwatch** at the
   right of **that CC line — the indented row under the line, not the line itself** (or
   right-click that CC line → **[en:tran:Change Timing]**) and
   answer with seconds or a time of day, exactly as on a line of its own. That answer
   belongs to **that attachment only**: the same `Next: Timeout` can hold the welcome slide
   for 4 seconds and the notice slide for 30, with one timeout in the running order instead
   of one per length. A row holding its own wait shows the stopwatch **filled** and reads
   its own number; one still following the element shows it hollow. To hand a row back,
   right-click it → **[en:tran:Use Element Timing]** — it goes back to the
   element's number and moves with it again. 📸
7. **If the run stopped moving on by itself**, one of three things happened. You went
   somewhere yourself — clicked another line, or pressed the next key — and that calls a
   timeout off. Or the preview panel was closed: no `Next:` line counts without it. Or the
   run reached the end of the list. To set it going again, click the `Next:` line (or the
   line it rides on) in the preview panel.
