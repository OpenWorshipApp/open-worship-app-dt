---
id: W-09
title: "Play audio, and foreground extras (countdown, clock, marquee bottom…)"
section: "Presenting content"
verify: [PM-15, PM-16, PM-17, PM-18, PM-19, PM-20, PM-21, PM-22, PM-23, PM-24, PM-25, PM-28, PM-34, PM-128, PM-129, PM-130, PM-131, PM-132, PM-133, PM-146, PM-147, PM-150, PM-151, PM-152, PM-153, PM-158, KB-03, KB-07, CB-67]
screenshots: 4
generatedFrom: user-workflows.md
workflowsVersion: "2026-11-09"
---
# W-09 — Play audio, and foreground extras (countdown, clock, marquee bottom…)

**Goal:** run service extras.

**Audio:** in the Background panel, toggle the **[en:tran:Audios]** tab open, click a track
to open its player and press play — the tab is marked while playing; pause it to end. 📸

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

- **[en:tran:Marquee Top]:** type the scrolling text, click
  **[en:tran:Show Marquee Top]** — it scrolls along the top edge.
- **[en:tran:Marquee Bottom]:** type the scrolling text, click
  **[en:tran:Show Marquee Bottom]** — it scrolls along the bottom edge. Top and bottom can be shown at the same time.
- Both marquees expose a **scroll speed** (%) under _Properties_: `100%` is the default
  pace, higher is faster, lower is slower. Changing it while a marquee is showing
  re-paces it without having to click Show again.
- **[en:tran:Quick Text]:** type a short message, click **[en:tran:Show Quick Text]**.
  The message is markdown (`## Title`, `**bold**`, `*italic*`): press
  **[en:tran:Preview]** above the box to read it as the screen will draw it,
  and **[en:tran:Edit]** to type again. **[en:tran:Markdown Lesson]** beside
  them opens a short lesson above the box: each mark as you type it next to
  how the screen draws it — headings, bold, italic, struck-through words,
  lists, a quote and a dividing line. Three rows show the thing most often
  missed: one Enter does not start a new line on the screen; end the line
  with `\` to break it, or leave an empty line for a new paragraph.
  **[en:tran:Open Link in Browser]** at the top of the lesson opens the full
  cheat sheet (markdownguide.org) in the computer's browser; press
  **[en:tran:Markdown Lesson]** again to close it. Its **[en:tran:Presets]** (first row
  of _Properties_, below) are **[en:tran:Bible Verse]**, **[en:tran:Speaker]**,
  **[en:tran:Song Title]**, **[en:tran:Sermon Title]**,
  **[en:tran:Event Session]** and **[en:tran:Announcement]**, and each also sets
  how many seconds the text stays and how its markdown is set: the first line
  becomes the title — **bold** for a song, a heading for a verse, a speaker,
  a sermon, a session or an announcement — and a song's or a sermon's lines
  under it turn *italic* (and upright again with any other preset). With
  nothing typed yet (the box empty, or still its sample) a preset fills in an
  example to type over: **[en:tran:Bible Verse]** puts in (KJV) John 3:16.
  **[en:tran:Bible Verse]** is a band the full width of the bottom (dark, or
  white under black words on the **[en:tran:Light]** side), the
  words at 45px set left, two minutes on screen; past about three verses it
  sets the words smaller, down to 28px, so a long passage stays a band
  instead of covering the slide. Every word you typed is kept; pressing a
  preset twice changes nothing more. The band sits flush on the bottom edge;
  **Y** in _Properties_ lifts it.
- **How long a quick text stays is each session's own.** Above the box,
  **[en:tran:Delay]** is the seconds it waits before it shows (0 to start)
  and **[en:tran:Live]** the seconds it stays on the screen (5 to start; a
  preset sets its own, two minutes for **[en:tran:Bible Verse]**). Switch on
  **[en:tran:Infinite]** under them and that session's text stays up until
  you take it down with its **[en:tran:Hide Quick Text]** row or a Clear;
  the Live box greys and keeps its number for when you switch it off again.
  Each session keeps its own three, so a verse can stay up while a speaker's
  name in another session leaves after a few seconds.
- In _Properties_ the **[en:tran:Round]** row's px box can be emptied to type
  another size: it keeps its place until you type a number, and shows the
  size in force again if you leave it empty. 0 px is a square corner.
- Quick Text's _Properties_ has **[en:tran:Horizontal Margin (%)]** and
  **[en:tran:Vertical Margin (%)]** in place of a width, as a Lyric stage's
  _Slide Margin_ has them: the side margin is kept on each side, the vertical
  one above or below the box (whichever edge it is set to), and the link left
  of the vertical slider moves both together.
- In every component the Show / Start row is the panel's footer: it stays at
  the bottom of the panel while the _Properties_ and the rest scroll under it,
  and its buttons are small. The **X** and **Y** nudge boxes sit on one line
  under the position pad.
- **[en:tran:Countdown]:** two modes. _To a date/time_: set date + time and press
  **[en:tran:Start Countdown to DateTime]** — it starts at once and always counts to that
  clock time. _For a duration_: set the **h**, **m** and **s** boxes (more than 24
  hours is fine: 25 h reads `25:00:00`) and press
  **[en:tran:Show Countdown]** — it goes up STOPPED on its full length (`00:05:00`), so it
  can be put up early and started on the cue. While it is on a screen,
  **[en:tran:Start]**, **[en:tran:Pause]** / **[en:tran:Resume]** and **[en:tran:Reset]**
  (back to the full length, stopped) sit under the button, with a word saying whether it
  is _[en:tran:Not started]_, _[en:tran:Running]_ or _[en:tran:Paused]_. Turn on
  **[en:tran:Auto-start]** and the button reads **[en:tran:Start Countdown]** and it counts
  the moment it is shown. When it reaches zero the digits flash red five times (about ten
  seconds) and then stay red; they hold `00:00:00` for one
  second, then count the time OVER behind a **+** (`+00:01:23`) until you
  hide it. The audience sees only the digits — a paused countdown simply stops. Hide
  with its Hide button. 📸
- **[en:tran:Stopwatch]:** the same controls. **[en:tran:Show Stopwatch]** puts it up on
  `00:00:00`, stopped (running at once with **[en:tran:Auto-start]**), then
  **[en:tran:Start]** / **[en:tran:Pause]** / **[en:tran:Resume]** / **[en:tran:Reset]**
  (back to zero). **[en:tran:Reset]** first SAVES the time it read into a
  **[en:tran:History]** list under the buttons — newest on top, numbered, with the time
  of day it was reset (in the app's language; in Khmer as numbers, e.g. `04/10 07:57`) — so the 7:42 a testimony ran is not lost with the zero. Each
  session keeps its own list (the last 20; a reset under one second is not kept), and
  **[en:tran:Clear]** beside it empties it after a confirm.
- **[en:tran:Time]** (the clock): same pattern — configure, Show, Hide.
  **[en:tran:Choose City]** puts the city's name above the clock in words
  (`Phnom Penh`) with its time; **[en:tran:Use Current Timezone]** goes back to
  this computer's time and takes that name away with it (a name you typed
  yourself stays). AM/PM is written in the app's language. A long name wraps
  inside the box instead of being cut off. With more than one clock, each
  **[en:tran:Show Time]** button is numbered for a screen reader, like its
  remove button. A clock added with **[en:tran:Add Time]** starts in a place
  of its own — the first clock in the middle, the next at the top, then the
  bottom — so two clocks shown together never sit on top of each other; move
  one under **[en:tran:Properties]** if you want it elsewhere.
- **[en:tran:Camera Show]**: same pattern — configure, Show, Hide. A camera that
  another program is holding says so in its tile instead of loading for ever.
- **[en:tran:Screen Show]:** what one screen holds, shown on another —
  screen 1's slide in the corner of screen 0. The panel has one card per
  screen, in that screen's own colour with its number. Click a card to
  put that screen on the selected screen, or press its **⋮**
  (**[en:tran:Show on Screens]**) to choose. Place and size it under
  _Properties_ like any other overlay. It shows that screen's
  background, slide, Bible text and overlays as they change, **even
  while that screen is hidden** — a screen that is up nowhere else can
  be shown only inside another. Where that screen draws nothing,
  the one beneath shows through. A screen never shows itself, and two
  screens never show each other: the app refuses with
  **[en:tran:A screen cannot show itself]** or
  **[en:tran:These screens would show each other]** instead. It never
  carries sound: the screen it shows plays that. Take it off with
  **[en:tran:Hide Screen Show]**. 📸
- **[en:tran:Video Show]**, **[en:tran:Image Show]** and **[en:tran:Web Show]:** a clip,
  a picture or a web page shown _over_ the slide instead of behind it. Each lists a
  folder the same way the Background tabs do — only the rows on screen are built, so a
  folder of thousands opens as fast as a folder of ten. Click a tile to put it up,
  click it again to take it off, right-click to choose a display. A clip plays muted
  and loops.
  **The volume of what is playing.** A track from the [en:tran:Audios] tab has no
  volume slider of the app's own: it is as loud as the computer's volume, so turn
  that up or down. A [en:tran:Video Show] clip has one. Open it from the
  [en:tran:Foreground] tab, open _[en:tran:Properties]_ in its panel and tick
  **[en:tran:Play With Sound]**: a **[en:tran:Volume]** slider appears under it, and
  that slider is the clip's volume.
- **Sessions — every foreground component keeps them**, except [en:tran:Camera Show] and
  [en:tran:Screen Show], which lay out one card per camera and per screen instead. They are
  the row of buttons pinned at the top of the panel, with **＋** to add one, and a session is one saved
  set-up of that panel: its **own** words or numbers **and** its **own**
  _Properties_ (size, place, colours, effects). So **[en:tran:Messages]** holds the
  pre-service notice board in one session and the mid-service alerts in another;
  **[en:tran:Countdown]** holds the five-minute one that starts the service beside
  the one counting to a date; **[en:tran:Marquee Bottom]** holds the standing welcome
  beside this morning's car-park notice; **[en:tran:Time]** holds a wall of world
  clocks beside the single service clock. Nothing has to be retyped over the set-up
  that was working. On **[en:tran:Video Show]**, **[en:tran:Image Show]**
  and **[en:tran:Web Show]** a session also owns its **own
  folder** and its **own slide show**, so one can run a show over your backgrounds
  folder while another holds a logo from somewhere else, both on screen at once.
  Setting a session up puts nothing on the screen: its show button does that, when
  you want that one.
- Right-click a session (or press its **⋮**) to rename or remove it. Only one session
  is shown at a time, so each button carries its own marks: the on-screen dot when
  that session has something up, and a blue ▶ while its slide show is advancing —
  that dot is the only sign of something live belonging to a session you are not
  looking at. Removing a session **takes what it put up off the screens first**, so
  nothing is left behind with no button to hide it.
- A session's _Properties_ and its Hide row act on **that session's own overlay and
  nothing else**. Changing size, colour or place on one session never re-dresses
  what another session has on the wall, and a session with nothing up shows no
  Hide button at all. To take down what another session put up, press the session
  button carrying the on-screen dot and use the Hide button there. Something that
  went up with no session (a dragged run-sheet row, the assistant) belongs to the
  first session button, which is **[en:tran:Default]** unless Default was removed.
- **[en:tran:Messages]** and **[en:tran:Time]** hold several items per session
  (several message editors, several clocks), so two sessions can each have something
  up at once, each listed on its own session's Hide row. **[en:tran:Countdown]**,
  **[en:tran:Stopwatch]**, **[en:tran:Quick Text]** and the two marquees put **one**
  thing on a screen **per session**: showing from another session puts its own up
  **beside** what is already there (a Bible verse band from one Quick Text session
  and a speaker's name from another, both on the wall), and showing a session again
  replaces only what that session had up. Each session's dot stays lit while its own
  is up, its **[en:tran:Start counting]** / **[en:tran:Pause]** run only its own
  clock, and its Hide row takes only its own down. Two sessions left at the same
  place cover one another, so give each its own place in _Properties_ (a Countdown's
  **[en:tran:Top Right]** preset, a Quick Text's **[en:tran:Bible Verse]** band).
  **[en:tran:Clear Foreground]** still takes every one down. **[en:tran:Image Show]**,
  **[en:tran:Video Show]** and **[en:tran:Web Show]** hold one file per session: clicking
  another tile replaces it. Two pictures up at once — an overlay and a logo — are two
  sessions: add one with **＋** and show a picture from each.
- The **[en:tran:Properties]** panel sits once beside the session buttons and governs
  every item that session shows — position, width, scale, opacity, corner and blend.
  That whole row — sessions, _Properties_, the slide show and the screen buttons that
  take the item off — **stays put while the file list scrolls**.
- **[en:tran:Presets]** — the first row of _Properties_ in every foreground
  component but [en:tran:Long Text Show] (which has its own looks) — dresses
  the session in one press for a job: [en:tran:Messages] has
  **[en:tran:Announcement]**, **[en:tran:Event Session]**,
  **[en:tran:Top Banner]** and **[en:tran:Bottom Banner]**; the marquees
  **[en:tran:Announcement]**, **[en:tran:Bible Verse]** (a slower scroll) and
  **[en:tran:Urgent Alert]** (a faster one); [en:tran:Countdown] and [en:tran:Stopwatch]
  **[en:tran:Top Right]**, **[en:tran:Bottom Right]**, **[en:tran:Center]** (twice
  the size) and **[en:tran:Bottom Banner]**; [en:tran:Time] the corners and
  **[en:tran:Center]**; the picture, camera, screen and web shows
  **[en:tran:Full Screen]**, **[en:tran:Picture in Picture]** and a small corner.
  At the right of the _Presets_ name, in every component with words and a box
  (all but the picture, camera, screen and web shows), is **[en:tran:Dark]** /
  **[en:tran:Light]** — light words on a dark box for a dark slide, or dark words
  on a light box for a light one. The side lit is read off the words' colour.
  Pressing the other one keeps both colours and only makes them lighter or
  darker — the box darker and the words lighter for **[en:tran:Dark]**, the
  reverse for **[en:tran:Light]** — until the words stand out clearly from the
  box; a blue box stays blue, only lighter or darker. A preset pressed then goes
  on in that side, and each preset's icon shows its colours on it. Until you
  pick a colour yourself, a session's words and box follow the app's theme:
  their **[en:tran:Light]** side in a light window.
  Every preset with words sets its own font size too (a clock or timer in a
  corner 40px, **[en:tran:Center]** 120px), and a clock's, a countdown's or a
  stopwatch's box is never drawn narrower than its digits, whatever its width.
  **[en:tran:Save as Preset]**, at the end of the row, keeps the session's whole
  _Properties_ as a preset of your own under a name you type — place, size,
  colours, font, Effects, layer and transition (and a marquee's size and speed).
  It is a button after the app's own in that component's row, on every session;
  pressing it puts that look back exactly. Right-click it for
  **[en:tran:Rename Preset]**, **[en:tran:Replace with Current Look]** and
  **[en:tran:Remove Preset]** (asked first). Thirty a component at most.
  One of the app's presets sets the place, size, colours, frame and Effects the component has,
  never its words' font, its transition or its layer; _Properties_ shows the
  new values at once, ready to adjust, and what that session has on a screen
  takes the new look straight away.
- **[en:tran:Always on Top]** (every foreground component but [en:tran:Long Text Show], not just these — under
  _[en:tran:Properties]_ in its own panel) keeps a
  widget over the others whatever order they went up in — a logo above the falling
  snow. The number beside it separates two that are both on top: the higher wins.
- **[en:tran:Behind Slide]** (every foreground component but [en:tran:Long Text Show]: under _Properties_ in its
  own panel, right above _Always on Top_) puts that session's item **behind** the slide and the Bible text — over the
  background, under the words — so a logo, a clock or a falling-snow clip never covers
  the lyrics. Tick it while the item is up and it moves at once; untick it and it comes
  back over the slide. A slide that fills the whole screen with its own picture hides
  it completely, which is the point. While it is ticked, _Always on Top_ is greyed out:
  an item behind the slide stays behind it, whatever its number.
- The slide show sits in the row of session buttons at the top of the panel once the
  session has something on a screen:
  **[en:tran:Start Slide Show]** and the seconds beside it. It keeps running while you
  are looking at another session, or with the whole Foreground panel closed, and stops
  by itself when that session's item is cleared. The file list is **not** scrolled to
  follow it — the tile that is up is marked when it happens to be in view, and the list
  stays where you left it so you can keep looking for the next picture while the show
  runs.
- **[en:tran:Blend Mode]** (under _Properties_ on Video Show, Image Show, Camera Show,
  Screen Show and Web Show) decides how the overlay mixes with whatever is under it. It is the
  answer to a clip that has a black background: pick **[en:tran:Screen Blend]** and the
  black drops out, leaving only the falling snow, sparks or light over the live slide.
  **[en:tran:Multiply]** does the opposite — white drops out. **[en:tran:Normal]** is
  the plain overlay that covers what is beneath it.
- **[en:tran:Effects]** is a fold under _Properties_, on **every** component but [en:tran:Long Text Show], and it
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

Press **F10** ([en:tran:Clear Foreground]) to clear all foreground widgets, or **F6** to clear
everything at once.

**Or ask for it.** In the help window (🤖), _Start a 5 minute countdown on the
screen_ or _Put the time on the screen_ starts the extra straight away and reads
the screen back — it is held even while the screen is off, and the screen's own
show button is offered, never pressed unasked. **/countdown 5**, **/countdown
10:30** and **/marquee Please silence your phones** do the same with no assistant,
and **/countdown stop** or **/clear-foreground** takes it off again (W-42 step 6).

::: details 🤖 Robot-verified — coverage traceability
This page maps 1:1 to a workflow the QA robot drives live. It proves these `coverage-matrix.md` rows:

`PM-15` · `PM-16` · `PM-17` · `PM-18` · `PM-19` · `PM-20` · `PM-21` · `PM-22` · `PM-23` · `PM-24` · `PM-25` · `PM-28` · `PM-34` · `PM-128` · `PM-129` · `PM-130` · `PM-131` · `PM-132` · `PM-133` · `PM-146` · `PM-147` · `PM-150` · `PM-151` · `PM-152` · `PM-153` · `PM-158` · `KB-03` · `KB-07` · `CB-67`

Regenerated from `user-workflows.md` (workflowsVersion 2026-11-09).
:::
