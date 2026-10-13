---
id: W-22h
title: "Play the video or song inside a slide by itself (Media Control)"
section: "Configuration"
verify: []
screenshots: 2
generatedFrom: user-workflows.md
workflowsVersion: "2026-10-13"
---
# W-22h — Play the video or song inside a slide by itself (Media Control)

**Goal:** the running order presses play on a slide's own video or audio for you — from
where you say, for as long as you say.

1. **Media Control — playing the video or song inside a slide by itself.** A slide can hold
   a video or an audio clip of its own, and normally you press play on it by hand on the
   mini screen. Right-click the slide (or the document line, or the line of a slide inside
   a document) → **[en:tran:Add Media Control]** and the running order does it
   for you. A settings panel opens first — nothing is added until you press **[en:tran:Ok]**:

   - **[en:tran:Action]** — **[en:tran:Play]**, **[en:tran:Pause]** or **[en:tran:Stop]**. Play starts the media; Pause leaves it
     where it is; Stop pauses it and winds it back to the start point, so the same line can
     be used again. Put a Pause or a Stop on a later line to cut a clip short.
   - **[en:tran:Delay Before]** — wait this many seconds after the slide goes up before doing
     anything. Leave it at 0 to act at once.
   - **[en:tran:Media Start At]** — where in the clip to begin, in seconds.
   - **[en:tran:Then Pause]** — **[en:tran:Never]**, **[en:tran:After]** so many seconds of playing, or **[en:tran:At Media Time]**
     to stop at a point of the clip itself (so "play 0:10 to 1:10" is two numbers, not a
     stopwatch).
   - **[en:tran:Volume]** and **[en:tran:Speed]** — each behind a tick box, because leaving one un-ticked means
     "don't touch it": the level you set by hand on the mini screen stays as it is.
   - **[en:tran:Set Specific Screen]** — leave every box clear and it works on whatever screens the
     slide went to. Tick one and it works **only** where the slide also landed. It is
     controlling the media the slide put on a screen, so a screen the slide never reached
     has nothing on it to control.
2. The new line appears as a CC element under the slide, reading what it will do —
   `Slide: Media Control (Play +3s 10s→70s 70% 2x)` — with a small **cyan gear** at its
   right. Click the gear (or right-click → **[en:tran:Media Control Settings]**) to change it later;
   it opens on what you set last time. A plain `Slide: Media Control` line is also added at
   the end of the list: the CC points at that line, so leave it there — removing it removes
   the control with it. 📸

   Every video and audio clip in that slide is driven together. The sound comes out of the
   presenter machine, exactly as it does when you press play by hand, so the **[en:tran:Volume]** is
   the level you hear at the desk; the projected screen stays silent and simply keeps in
   step, at the same speed.
3. **Moving off the slide stops it.** When you put another slide on that screen — or clear
   the screen — everything the Media Control started is stopped and anything still waiting
   (a "stop at 1:10", a delayed start) is dropped, so nothing carries over to whatever you
   put up next. This is what lets the running order carry on: a clip you started **by
   hand** on the mini screen blocks the next slide until you pause it (the app says
   **[en:tran:Media is Playing]**), because there the app cannot know you meant to leave it — but a
   clip the running order started is the running order's to stop. 📸

   This one is only ever attached to a slide: you will not find it under **[en:tran:Add Action]** on
   the running order itself, because "start this video ten seconds in" is a sentence about
   one particular slide.
