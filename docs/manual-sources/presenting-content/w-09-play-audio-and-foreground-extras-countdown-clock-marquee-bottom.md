---
id: W-09
title: "Play audio, and foreground extras (countdown, clock, marquee bottom…)"
section: "Presenting content"
verify: [PM-15, PM-16, PM-17, PM-18, PM-19, PM-20, PM-21, PM-22, PM-23, PM-24, PM-25, PM-28, PM-34, PM-128, PM-129, PM-130, PM-131, PM-132, PM-133, PM-146, PM-147, KB-03, KB-07, CB-67]
screenshots: 3
generatedFrom: user-workflows.md
workflowsVersion: "2026-09-25"
---
# W-09 — Play audio, and foreground extras (countdown, clock, marquee bottom…)

**Goal:** run service extras.

**Audio:** in the Background panel, toggle the **[en:tran:Audios]** tab open, click play
on a track — the tab is marked while playing; click stop to end. 📸

**Foreground widgets** — press the middle **[en:tran:Foreground]** tab and a menu
opens **at the cursor** listing every component. Pick one and it opens in **its own
floating panel**, which remembers its size and place across a restart; the menu closes
itself. Open as many as you like side by side — the panels are independent. The menu is
also the status board: a ticked box marks a panel that is already open, a component with
something on a screen is marked the way the tab is **and carries the number of each
screen it is on**, and a blue ▶ marks a component whose slide show is running — which is
how you find a show that is still advancing behind a panel nobody has open. The panel
itself has no second title bar to collapse: its own header carries the name, the
on-screen mark and the close button. Each panel has its own controls and a Show/Start
button:

- **Marquee Top:** type the scrolling text, click Show — it scrolls along the top edge.
- **Marquee Bottom:** type the scrolling text, click Show — it scrolls along the bottom
  edge. Top and bottom can be shown at the same time.
- Both marquees expose a **scroll speed** (%) under _Properties_: `100%` is the default
  pace, higher is faster, lower is slower. Changing it while a marquee is showing
  re-paces it without having to click Show again.
- **Quick Text:** type a short message, click Show.
- **Countdown:** two modes — _to a date/time_ (set date + time, press Start) or _for a
  duration_ (set hours/minutes, press Start). Hide with its Hide button. 📸
- **Stopwatch**, **Clock**, **Camera Show**: same pattern — configure, Show, Hide.
- **[en:tran:Video Show]**, **[en:tran:Image Show]** and **[en:tran:Web Show]:** a clip,
  a picture or a web page shown _over_ the slide instead of behind it. Each lists a
  folder the same way the Background tabs do — only the rows on screen are built, so a
  folder of thousands opens as fast as a folder of ten. Click a tile to put it up,
  click it again to take it off, right-click to choose a display. A clip plays muted
  and loops.
- **Sessions — every foreground component keeps them.** They are the row of buttons
  pinned at the top of the panel, with **＋** to add one, and a session is one saved
  set-up of that panel: its **own** words or numbers **and** its **own**
  _Properties_ (size, place, colours, effects). So **[en:tran:Messages]** holds the
  pre-service notice board in one session and the mid-service alerts in another;
  **[en:tran:Countdown]** holds the five-minute one that starts the service beside
  the one counting to a date; **[en:tran:Marquee Bottom]** holds the standing welcome
  beside this morning's car-park notice; **[en:tran:Time]** holds a wall of world
  clocks beside the single service clock. Nothing has to be retyped over the set-up
  that was working. On **[en:tran:Video Show]**, **[en:tran:Image Show]**,
  **[en:tran:Camera Show]** and **[en:tran:Web Show]** a session also owns its **own
  folder** and its **own slide show**, so one can run a show over your backgrounds
  folder while another holds a logo from somewhere else, both on screen at once.
- Right-click a session (or press its **⋮**) to rename or remove it. Only one session
  is shown at a time, so each button carries its own marks: the on-screen dot when
  that session has something up, and a blue ▶ while its slide show is advancing —
  that dot is the only sign of something live belonging to a session you are not
  looking at. Removing a session **takes what it put up off the screens first**, so
  nothing is left behind with no button to hide it.
- A session's _Properties_ act on **that session's own overlay and nothing else**.
  The Hide row still reaches whatever is live, whichever session put it there —
  there must always be a way to take something off a projector — but changing
  size, colour or place while you are on another session no longer re-dresses
  the overlay somebody else's session has on the wall.
- **[en:tran:Messages]** and **[en:tran:Time]** hold several items per session
  (several message editors, several clocks), so two sessions can each have something
  up at once and both stay listed on the Hide row. **[en:tran:Countdown]**,
  **[en:tran:Stopwatch]**, **[en:tran:Quick Text]** and the two marquees put **one**
  thing on a screen, so showing from another session replaces what was there and the
  on-screen dot moves to the session that now owns it.
- The **[en:tran:Properties]** panel sits once beside the session buttons and governs
  every item that session shows — position, width, scale, opacity, corner and blend.
  That whole row — sessions, _Properties_, the slide show and the screen buttons that
  take the item off — **stays put while the file list scrolls**.
- **[en:tran:Always on Top]** (every foreground component, not just these) keeps a
  widget over the others whatever order they went up in — a logo above the falling
  snow. The number beside it separates two that are both on top: the higher wins.
- The **stopwatch** button in that same row opens the slide show:
  **[en:tran:Start Slide Show]** and the seconds beside it. It keeps running while you
  are looking at another session, or with the whole Foreground panel closed, and stops
  by itself when that session's item is cleared. The file list is **not** scrolled to
  follow it — the tile that is up is marked when it happens to be in view, and the list
  stays where you left it so you can keep looking for the next picture while the show
  runs.
- **[en:tran:Blend Mode]** (under _Properties_ on Video Show, Image Show, Camera Show
  and Web Show) decides how the overlay mixes with whatever is under it. It is the
  answer to a clip that has a black background: pick **[en:tran:Screen Blend]** and the
  black drops out, leaving only the falling snow, sparks or light over the live slide.
  **[en:tran:Multiply]** does the opposite — white drops out. **[en:tran:Normal]** is
  the plain overlay that covers what is beneath it.
- **[en:tran:Effects]** is a fold under _Properties_, on **every** component, and it
  dresses the overlay: a **[en:tran:Border]** (style, thickness, colour), a
  **[en:tran:Shadow]** (Soft / Medium / Strong / Glow, with a colour of its own) and
  **[en:tran:Padding]** — the room between what is shown and the edge of its own box,
  measured in text sizes so it keeps its proportions when you change the font size.
  On the components that put WORDS on the screen there is more:
  **[en:tran:Text Align]**, **[en:tran:Line Height]**, **[en:tran:Letter Spacing]**,
  a **[en:tran:Text Shadow]** (Soft / Glow / Outline) — which is what makes a notice
  readable over a busy picture or a moving video — and **[en:tran:Text Style]**:
  italic, underline, UPPERCASE. The fold carries a dot while anything inside it is
  set, so a look you cannot find is never the reason a message looks wrong. 📸
- The shared properties row (font size / color / position) restyles the live widget.
- Power move: **drag** a widget's Show button and **drop it on the mini screen** to
  start it there; **right-click** the button to choose a specific display.

Press **F10** (Clear Foreground) to clear all foreground widgets, or **F6** to clear
everything at once.

**Or ask for it.** In the help window (🤖), _Start a 5 minute countdown on the
screen_ or _Put the time on the screen_ starts the extra straight away and reads
the screen back — it is held even while the screen is off, and the screen's own
show button is offered, never pressed unasked. **/countdown 5**, **/countdown
10:30** and **/marquee Please silence your phones** do the same with no assistant,
and **/countdown stop** or **/clear-foreground** takes it off again (W-42 step 6).

::: details 🤖 Robot-verified — coverage traceability
This page maps 1:1 to a workflow the QA robot drives live. It proves these `coverage-matrix.md` rows:

`PM-15` · `PM-16` · `PM-17` · `PM-18` · `PM-19` · `PM-20` · `PM-21` · `PM-22` · `PM-23` · `PM-24` · `PM-25` · `PM-28` · `PM-34` · `PM-128` · `PM-129` · `PM-130` · `PM-131` · `PM-132` · `PM-133` · `PM-146` · `PM-147` · `KB-03` · `KB-07` · `CB-67`

Regenerated from `user-workflows.md` (workflowsVersion 2026-09-25).
:::
