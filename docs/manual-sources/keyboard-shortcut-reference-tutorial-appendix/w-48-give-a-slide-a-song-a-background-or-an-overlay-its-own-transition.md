---
id: W-48
title: "Give a slide, a song, a background or an overlay its own transition"
section: "Keyboard shortcut reference (tutorial appendix)"
verify: [PM-154, PM-155, PM-156, SP-06]
screenshots: 2
generatedFrom: user-workflows.md
workflowsVersion: "2026-10-04"
---
# W-48 — Give a slide, a song, a background or an overlay its own transition

**Goal:** have one song zoom in, one slide cut in, the pictures fade and the
countdown slide in — instead of everything changing the same way.

How it works everywhere: the screen's **Tr:** row (W-10) is the fallback. Any
of the levels below can tick **[en:tran:Own transition]** and pick
**[en:tran:No Transition]**, **[en:tran:Fade]**, **[en:tran:Slide In]** or
**[en:tran:Zoom]**; the most specific ticked level wins. Unticked, the picker
is greyed and says what it **follows** — the screen, the document, the tab or
the whole panel — so you can always see what will happen.

1. **A whole song or slide document.** In the slides preview, press the ⋮ at
   its top right (for a song, the ⋮ in the Stage Previewer header works too)
   and choose **[en:tran:Transition]**. The row says what it does now, e.g.
   _Transition: Fade (Screen setting)_. In the box that opens tick
   **[en:tran:Own transition]**, pick **[en:tran:Zoom]** and press
   **[en:tran:Ok]**. Every slide of that document now comes in zooming, on
   every screen. 📸
2. **One slide.** Press the ⋮ on that slide's card (or right-click it) and
   choose **[en:tran:Transition]** — it reads _Zoom (Slides preview)_, because
   it follows its document. Tick **[en:tran:Own transition]**, pick
   **[en:tran:No Transition]**, press **[en:tran:Ok]**. A small icon appears in
   the card's header; press it to change or untick the slide's choice. 📸
3. Present the slides. Each slide leaves the way it came in: going from a
   zoomed slide to the cut-in slide, the new one is there at once while the old
   one zooms away.
4. **A Background tab.** Right-click **[en:tran:Images]** (or
   **[en:tran:Colors]**, **[en:tran:Videos]**, **[en:tran:Cameras]**,
   **[en:tran:Webs]**) and choose **[en:tran:Transition]**. Ticked, every
   background from that tab comes in that way; the tab shows the effect's icon
   after its name.
5. **One background.** Press the ⋮ on a picture, video or web tile (right-click
   a colour swatch, a camera or a web link) and choose
   **[en:tran:Transition]**. It follows its tab until you tick it; the tile then
   shows the effect's icon in its corner.
6. **A foreground panel, all its sessions.** Each foreground panel
   (**[en:tran:Countdown]**, **[en:tran:Quick Text]**, **[en:tran:Marquee Top]**
   …) has a transition button in its title bar, next to the collapse arrow.
   Press it, tick **[en:tran:Own transition]** and pick one: every session of
   that panel uses it.
7. **One session.** Open the panel's **[en:tran:Properties]**: the
   **[en:tran:Transition]** row has the same checkbox, for the session you are
   on (Default, Session 2 …). It wins over the panel's button. A change applies
   the next time you show it — what is already up keeps the way it came in.
8. A marquee band that has no transition of its own keeps sliding in from its
   edge; **[en:tran:Slide In]** is that same slide.
9. To go back to the screen's transition, open the same box and untick
   **[en:tran:Own transition]**. Nothing is kept once every level is unticked.
10. The choices travel with the document: renaming it, moving it to the trash,
    and sharing it as an archive take its transitions along.

::: details 🤖 Robot-verified — coverage traceability
This page maps 1:1 to a workflow the QA robot drives live. It proves these `coverage-matrix.md` rows:

`PM-154` · `PM-155` · `PM-156` · `SP-06`

Regenerated from `user-workflows.md` (workflowsVersion 2026-10-04).
:::
