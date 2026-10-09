---
id: W-48
title: "Give a slide, a song, a background or an overlay its own transition"
section: "Keyboard shortcut reference (tutorial appendix)"
verify: [PM-154, PM-155, PM-156, SP-06, ED-54]
screenshots: 3
generatedFrom: user-workflows.md
workflowsVersion: "2026-10-08"
---
# W-48 — Give a slide, a song, a background or an overlay its own transition

**Goal:** have one song zoom in, one slide cut in, one canvas item fade, the
pictures fade and the countdown slide in — instead of everything changing the
same way.

How it works everywhere: the screen's **Tr:** row (W-10) is the fallback. Any
of the levels below can tick **[en:tran:Own transition]** and pick
**[en:tran:No Transition]**, **[en:tran:Fade]**, **[en:tran:Slide In]** or
**[en:tran:Zoom]**; the most specific ticked level wins. Every override selector
shows four icon buttons: a ban sign for **[en:tran:No Transition]**, shading
for **[en:tran:Fade]**, a slide against an edge for **[en:tran:Slide In]**, and
outward arrows for **[en:tran:Zoom]**. Hover an icon to
read its translated name; the selected one is highlighted. Unticked, the
buttons are disabled and show the inherited choice and what it **follows** —
the screen, the document, the tab or
the whole panel — so you can always see what will happen. A canvas item follows
its slide, then its document, then the screen when its own choice is unticked.

1. **A whole song or slide document.** In the slides preview, press the ⋮ at
   its top right (for a song, the ⋮ in the Stage Previewer header works too)
   and choose **[en:tran:Transition]**. The row says what it does now, e.g.
   _Transition: Fade (Screen setting)_. In the box that opens tick
   **[en:tran:Own transition]**, pick **[en:tran:Zoom]** and press
   **[en:tran:Ok]**. Every slide of that document now comes in zooming, on
   every screen. A cyan round button with the effect's icon appears beside
   the preview's top-right ⋮. Its tooltip names the effect. Press it to change
   or untick the document's choice. It disappears when the document follows
   the screen
   again. 📸
2. **One slide.** Press the ⋮ on that slide's card (or right-click it) and
   choose **[en:tran:Transition]** — it reads _Zoom (Slides preview)_, because
   it follows its document. Tick **[en:tran:Own transition]**, pick
   **[en:tran:No Transition]**, press **[en:tran:Ok]**. The same cyan effect
   icon appears in the card's header; press it to change or untick the
   slide's choice. Background attachments keep their separate grey icons.
   Tooltips show the full effect name, including on small cards. 📸
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
11. **One canvas item.** Open the document in the **[en:tran:Slide Editor]**,
    select an item on the canvas or in **[en:tran:Canvas Items]**, and open
    **[en:tran:Properties]**. **[en:tran:Canvas item transition]** is visible
    above **[en:tran:Box Properties]**, even when that group is collapsed.
    Tick **[en:tran:Own transition]** and pick **[en:tran:Fade]**,
    **[en:tran:Slide In]**, **[en:tran:Zoom]** or **[en:tran:No Transition]**.
    Untick it to follow the slide's choice again. **[en:tran:Undo]** and
    **[en:tran:Redo]** restore the choice; **[en:tran:Save]** keeps it in the
    document. 📸
12. Present that slide, then another. Each item enters and leaves with its
    own effect; items without a choice follow the slide, document or screen.
    **[en:tran:No Transition]** cuts immediately. Rotation and position stay
    as authored. These effects run when changing slides, including clearing
    the current slide. A slide with no item overrides keeps its whole-slide
    transition.

::: details 🤖 Robot-verified — coverage traceability
This page maps 1:1 to a workflow the QA robot drives live. It proves these `coverage-matrix.md` rows:

`PM-154` · `PM-155` · `PM-156` · `SP-06` · `ED-54`

Regenerated from `user-workflows.md` (workflowsVersion 2026-10-08).
:::
