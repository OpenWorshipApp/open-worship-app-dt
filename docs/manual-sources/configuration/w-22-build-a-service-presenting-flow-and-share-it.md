---
id: W-22
title: "Build a service presenting flow (and share it)"
section: "Configuration"
verify: [PL-10, PL-29, PL-32, PL-33, PL-34, PL-35, PL-36, PL-37, PL-38, PL-39, PL-40, PL-41, PL-42, PL-43, PL-44, PL-45, PL-46, PL-47, PL-48, PL-49, PL-50, PL-51, PL-52, PL-53, PL-54, PL-55, PL-56, PL-57, PL-58, PL-59, PL-60, PL-61, PL-62, PL-63, PL-64, PL-65, PL-66, PL-67, PL-68, PL-69, PL-70, PL-71, PL-72, PL-73, PL-74, PL-75, PL-76, PL-81, PL-82, PL-83, PL-84, PL-85, PL-86, PL-87, PL-88, PL-89, PL-90, PL-91, PL-92, PL-93, PL-94, PL-95, PL-96, PL-101]
screenshots: 27
generatedFrom: user-workflows.md
workflowsVersion: "2026-08-31"
---
# W-22 — Build a service presenting flow (and share it)

**Goal:** collect everything one service needs — songs, slides, verses, backgrounds and
foreground presets — into one running order you can work down live, and hand the whole
thing to another machine.

1. Find the **Presenting Flows** (តារាងកម្មវិធី) panel — it is the lower of the two lists on the
   left, under **Documents** (ឯកសារ). If the list is empty, right-click its empty area (or
   use the **⋮ More Options** button in its title bar) → **New File** to create one. 📸
2. **Drag things onto the presenting flow's NAME row to add them.** (Dropping onto a _line_ of an
   open presenting flow does something else — see step 5.) Anything you can present can go in:
   - a **background** — a colour, image, video, camera or website;
   - a **document** — drag its row out of the Documents list;
   - a **single slide** — from the previewer, or from a document already in the presenting flow;
   - a **Bible verse** — from the Bible list;
   - a **foreground preset** — drag the blue **Show Marquee Top** / **Start Countdown** /
     **Show Time** button itself. Whatever you typed and styled travels with it, so the
     presenting flow remembers _that_ announcement, not just "a marquee". 📸
   - an **audio track** — drag it out of the **♫Audios♫** (សំលេង) split.

   **Add a screen action.** A running order can also hold something to _do_ rather than
   something to show. Right-click the presenting flow → **Add Action** (បន្ថែមសកម្មភាព) →
   **Clear Screen** (លុបអេក្រង់) — a row that adds nothing and opens the clears — and pick
   one of **Clear All** (លុបទាំងអស់), **Clear Background** (លុបផ្ទៃខាងក្រោយ), **Clear
   Slide** (លុបស្លាយ), **Clear Bible** (លុបព្រះគម្ពីរ) or **Clear Foreground**
   (លុបផ្ទៃខាងមុខ) — the same five clears as the buttons on each mini screen, and the line
   carries the same `ALL` / `BG` / `SL` / `BB` / `FG` badge so you can tell them apart at a
   glance. It lands at the end of the list; drag it up to where it belongs — say between
   the last song and the sermon. 📸

   Under those five, **Other Clear FG Items** (ការលុប FG ផ្សេងទៀត) offers a **finer clear
   for one foreground widget at a time**, so you can take the countdown down and leave the
   marquee running: **Clear FG
   Marquee Top** (`M↑`), **Marquee Bottom** (`M↓`), **Quick Text** (`QT`), **Countdown**
   (`CD`), **Stopwatch** (`SW`), **Time** (`TM`), **Camera Show** (`CM`) and **Web Show**
   (`WB`). Each does exactly what that widget's own hide button in the **Foreground** panel
   does; the `Time`, `Camera Show` and `Web Show` ones clear all of their items at once.
   The panel's **Background Images Slide Show** has no action of its own — it is a
   _background_ despite sitting in that panel, so **Clear Background** is what stops it.

   **Let the running order walk itself.** Back on the first menu — beside **Clear Screen**,
   not inside it — are two actions that move the RUN on instead of touching a screen: **Next: Interval** (បន្ទាប់៖ រៀងរាល់ចន្លោះពេល)
   and **Next: Timeout** (បន្ទាប់៖ អស់ពេលកំណត់). Each asks how many **seconds**
   (វិនាទី) when you add it, and the answer is part of the line — `⏱ Next: Timeout (5)` —
   so a glance at the sheet tells you how long it waits. Got it wrong? Right-click the
   line → **Change Seconds** (ផ្លាស់ប្តូរវិនាទី); it opens on the number it is holding
   now. 📸

   - **Next: Timeout** waits once. When the run reaches it, it counts down and then moves
     the run on by itself — a slide that should linger ten seconds and then go on without
     you. **Going somewhere yourself calls it off**: click another line, or press the next
     key, and the wait is over and you are driving again. Anything else — clicking a
     background, a foreground button, a stray click on the panel — leaves it counting, so
     a mis-aimed click cannot silently cost you the wait.

     **Or wait until a time on the clock.** A timeout is the one that does not have to be
     counted in seconds: the left-hand side of its question is a chooser, and switching it
     from **Seconds** to **At Time** (នៅម៉ោង) lets you type the time you want the run to
     move on — `7:05 AM`, `8:30 PM`. The line then reads `⏱ Next: Timeout (7:05 AM)`, and
     the pill counts down in minutes and hours (`4:58`, `1:12:30`) instead of a long number
     of seconds. Use it for the notice board before a service: put it on the last
     announcement and the run leaves it exactly when the service starts, whether you armed
     it an hour or five minutes before. Its menu entry is **Change Timing**
     (ផ្លាស់ប្តូរការកំណត់ពេល) rather than **Change Seconds**, and it opens on whichever half
     you armed it with — the two are alternatives, so choosing one clears the other. If the
     time you set has **already gone by**, the app says so (**The set time is already due**)
     and starts nothing: it will not quietly wait until tomorrow. Set a new time, or arm it
     in seconds. 📸

   - **Next: Interval** keeps going. It moves the run on every so many seconds — a loop of
     announcement slides before the service. Going somewhere yourself does not stop it, it
     **starts the count again from there**, so a line you step to by hand gets the whole
     interval rather than the second that was left of the last one. To stop it, click the
     ⊗ pill it puts at the top-right of the preview panel (it shows the seconds left, in
     the same colour as the line that started it). Closing the panel stops it too, as does
     reaching the end of the sheet.

   - **Next: Clear Interval** (បន្ទាប់៖ បញ្ឈប់រៀងរាល់ចន្លោះពេល) stops that loop, and it is the
     one way the SHEET can stop it: the pill, closing the panel and the end of the list are
     all you being at the machine. Add it — it asks nothing, there being only ever one clock
     running — and the line reads `⊘ Next: Clear Interval` in the interval's own colour,
     because it is that same thing undone. Put it after a looping set (an interval, a few
     slides, a **Jump to** pointing back at the interval) and the loop runs until the run
     reaches this line, then stops and waits for you. Firing it when nothing is looping does
     nothing at all and says nothing, so it is safe to leave in a sheet you re-run. It stops
     an interval you have PAUSED as well; a **Next: Timeout** it leaves alone, so a wait
     attached to a slide is never killed by a line that only meant to end a loop. 📸

   Both only mean something while that presenting flow's **preview panel** is open (step 8) —
   that panel is what walks the running order. Click one with the panel closed and the app
   says so (**Open the presenting flow preview to use this action**) rather than looking as
   though it did something. They never go to a screen, so they have no **Apply on
   Screens** and no **Set Specific Screen**, and nothing can be attached to them.

   **A timeout does not have to be a line of its own.** Attach it to a line instead — a
   slide, a song, a verse — as a **CC element** (step 5), and that line means "show this,
   and go on by yourself N seconds later". Add the **Next: Timeout** once, right-click the
   line you want it on → **Add CC Elements** and pick it, and then you can delete the
   `Next: Timeout` line itself if you only wanted the follower: a CC is a copy. Attached to
   a whole SONG it rides every slide of it, which is how a song advances by itself. 📸

   **Each line may wait for its own length.** A CC element normally reads whatever the
   `Next: Timeout` line is set to, so re-arming that one line re-arms every follower of it
   at once. When one line needs a different wait, click the small **stopwatch** at the
   right of that CC row (or right-click it → **Change Timing** / ផ្លាស់ប្តូរការកំណត់ពេល) and
   answer with seconds or a time of day, exactly as on a line of its own. That answer
   belongs to **that attachment only**: the same `Next: Timeout` can hold the welcome slide
   for 4 seconds and the notice slide for 30, with one timeout in the running order instead
   of one per length. A row holding its own wait shows the stopwatch **filled** and reads
   its own number; one still following the element shows it hollow. To hand a row back,
   right-click it → **Use Element Timing** (ប្រើការកំណត់ពេលរបស់ធាតុ) — it goes back to the
   element's number and moves with it again. 📸
   **A Next: Interval cannot be attached to anything** and is simply not in that list —
   an interval is not stopped by anything you do, so one riding a slide would keep moving
   the running order on with nothing to call it off but the panel's own pill. A
   **Next: Clear Interval** CAN be attached, for the opposite reason: "put this last slide
   up **and** stop the loop" is one click, and something that stops a loop can never run
   away with the running order.

   **Go back, not just forward.** The third one, **Jump to** (លោតទៅ), is how a running
   order reaches a line that is not the next one. Add it, then right-click it →
   **Add CC Elements** and pick the line it should go to — its list is everything in the
   presenting flow, **a whole song included**, because here the attached line is not something
   that rides along, it is the destination. It takes exactly one, so once you have picked
   the **Add CC Elements** entry is gone; to re-aim it, remove the CC and pick another. 📸

   **It is the next key aimed at a line of your choosing**: when the run reaches it — or
   you click it — the panel goes to that line and does there exactly what stepping onto it
   would have done. A song opens at its first slide; a **Next: Interval** or **Next:
   Timeout** it lands on is STARTED. That last one is how a set loops: put the slides
   under a **Next: Interval**, and a **Jump to** at the end of them pointing back at that
   interval — the set then plays round and round on its own until you stop it with the
   pill. (A jump that lands on another jump stops there rather than jumping again, so a
   pair of them cannot send the run back and forth for ever.) If it has nothing attached,
   or the line it named has since been deleted, it says so instead of quietly doing
   nothing.

   **Reach a line with a key of your own.** The fourth one, **Keyboard Event**
   (ព្រឹត្តិការណ៍ក្តារចុច), is a shortcut you set yourself. Adding it asks for the
   shortcut, and you answer by **pressing it** — the box is not typed into. Hold **Ctrl**
   or **Shift** (those two only, and at least one of them, so the shortcut means the same
   thing on any machine and cannot take a key the running order already uses) and press
   the key. The line then reads `⌨ Keyboard Event (Shift+A)`. Re-set it later from
   **Change Shortcut**. Two lines may not share a shortcut — the second one is refused
   out loud — and duplicating a line leaves the copy without one. 📸

   Now attach what it should put up, with **Add CC Elements** — as many as you like, which
   is what makes one key worth more than one click: a slide _and_ its marquee together,
   say. Then, with the preview panel open (step 6), pressing **Shift+A** sends the run to
   that line and puts all of it on the screens at once, wherever the run had got to.
   Pin the line to a screen with **Set Specific Screen** if it should always go to the
   same one. The shortcut only answers while the preview panel has the keyboard, exactly
   as its arrow keys do — the panel takes it the moment you open it, so there is nothing
   to click first. With nothing attached yet it says so rather than doing nothing. 📸

   **Put the screen itself up and down.** Two more actions are not about what is _on_ a
   screen but about whether there is one: **Screen: Show** (អេក្រង់៖ បង្ហាញ) and
   **Screen: Hide** (អេក្រង់៖ លាក់), the same thing the slides button on each mini screen
   does by hand. Use them when the running order has to work with nobody at the machine —
   a **Screen: Show** at the top of a pre-service loop, a **Screen: Hide** at the end of
   it, and the screen goes dark on its own instead of holding the last announcement until
   someone notices.

   **These two ask which screen** when you add them, and that is the whole point: a
   checklist of the screens you have open appears (**Screen id: 0**, **Screen id: 1**, …,
   each in that screen's own colour), and the line remembers your answer as its pin — the
   line shows the pin badge, and **Set Specific Screen** re-aims it later. Unlike every
   other line, it goes to those screens and _only_ those: it will not fall back to
   whichever screen you happened to have selected, and it will never stop to ask, because
   at 7:05 on an unattended sheet there is nobody there to answer. Tick nothing and the
   app says **Please choose at least one screen** rather than adding a line that would do
   nothing. Firing one twice is harmless — a **Screen: Show** on a screen that is already
   up does nothing at all, so it is safe inside a loop. Nothing can be attached to them
   either, though they can themselves be attached to another line — "put this last slide
   up **and** light the screen" in one click. 📸

   **Where the actions live in the menu.** **Add Action** opens with **Clear Screen** —
   one row that adds nothing and opens the five clears, with **Other Clear FG Items**
   under them for the eight per-widget foreground clears — then **Screen: Show** /
   **Screen: Hide**, then the four that drive the run.

3. Click the presenting flow name to **open it**. Each element is one short line: an icon for
   what it is, its id, and its name. A **document** line has its own arrow — open it to
   see that document's slides underneath. 📸
4. **Click an element to put it on the screen** (a document opens its previewer instead;
   an **audio track** opens the **♫Audios♫** split and flashes the track there — the
   presenting flow never plays audio itself, so that you keep the panel's safeguards like
   "one track at a time").
   You can also **drag an element onto a mini screen**, or **right-click → Show on
   Screens** (បង្ហាញលើអេក្រង់) to pick the screen.
   A **screen action** works the same way, except it is _run_ rather than shown: click it
   to clear, drag it onto one mini screen to clear only that one, or right-click →
   **Apply on Screens** (អនុវត្តនៅលើអេក្រង់) to choose. It never lights up as "live",
   because there is nothing of it on the screen to be live. **Screen: Show** /
   **Screen: Hide** are the exception to the first of those: clicking one goes to the
   screens it names and nowhere else. **Apply on Screens** still asks, since that entry
   is you saying "send this one somewhere else" — but it does not change what the line
   is pinned to.
   The two **`Next:`** actions are the exception: they drive the RUN, not a screen, so
   they have none of that — clicking one starts its countdown in the preview panel
   (step 8), and with that panel closed the app simply tells you to open it.

   **Send a line to one particular screen, every time.** If a lyric always belongs on the
   stage screen and the sermon slides on the main one, you do not have to drag them there
   over and over. Right-click the line → **Set Specific Screen** (កំណត់អេក្រង់ជាក់លាក់) and
   tick the screens it should go to — `Screen id: 0`, `Screen id: 1`, … The menu stays open
   so you can tick more than one, and the line then shows a small 📌 with those numbers —
   **each number in its own screen's colour**, the very colour that screen's mini-screen
   badge wears, so you can tell at a glance where a line goes without reading the digit.
   (The tick boxes in the menu are tinted the same way.) 📸
   From then on **clicking that line ignores which mini screens are selected**
   and goes straight to its own; so do the arrow/Space keys in the preview panel. Untick
   them, or choose **No Specific Screen** (គ្មានអេក្រង់ជាក់លាក់), to hand it back to the
   normal behaviour.

   Two things deliberately still override a pin, so you are never stuck: **dragging** the
   line onto a mini screen puts it on _that_ screen just this once, and right-click →
   **Show on Screens** still asks which screen you mean. If the pinned screen has been
   closed, nothing is projected anywhere and the app tells you so ("Please make sure the
   screen is open") rather than quietly using a different screen.

5. **Make one line bring others with it — CC elements.** Some things belong _together_: the
   moment verse 1 goes up, the welcome marquee has to be up too. Attach the marquee to that
   line as a **CC element** and one click does both.

   Attach one in either of two ways:
   - **drop it onto the line** — drag the marquee button, a background, a verse or a slide
     out of its own panel and drop it _on the line it belongs to_ (the line outlines in
     dashed amber as you hover it). Dropping onto a **document's slide** attaches it to
     that one slide; dropping onto the document's own line attaches it to the whole song.
     You can also drag a line **already in the presenting flow** — a clear action included — onto
     another line.

     **Aim at the middle of a line to attach, at its top or bottom edge to move.** A line
     of the running order does both jobs, and it tells you which one it is about to do:
     lines along the top and bottom edges mean "this line moves here", a dashed box round
     the whole line means "this goes _onto_ that line". Slides and CC lines have no order
     of their own, so anywhere on them attaches.

     **Or say which you mean and stop aiming**: hold **Ctrl** (⌘ on a Mac) while you drag
     and the drop takes that PLACE, hold **Alt** and it always ATTACHES, anywhere on the
     line. Press or release the key mid-drag and the mark under the pointer changes with
     it, so you can see what the drop will do before you let go. (Holding both, the place
     wins.) For a line of this running order "takes that place" means it MOVES there; for
     something dragged in from another panel it means it is INSERTED there — which is the
     only way to put it anywhere but the end of the list, since dropping on the presenting flow's
     name adds to the end.

   - **right-click the line → Add CC Elements** (បន្ថែមធាតុ CC) and pick from the other
     lines already in this presenting flow. 📸

   A CC element shows as a `↳` line just under the one it rides with. From then on,
   **clicking that line — or reaching it with the arrow/Space keys in the preview — puts
   the line AND its CC elements on the screen together**, on the same screens the line
   itself went to. You are never asked "which screen?" twice for one click.

   - A CC on a **document line** rides with _every_ slide of that song (a document line has
     nothing of its own to show, so this is what "keep this marquee up for this song"
     means); a CC on **one slide** rides with that slide only.
   - A CC can have a screen of its own: right-click it → **Set Specific Screen** to send it
     somewhere else while its line goes to the usual place. **No Specific Screen** hands it
     back to following the line.
   - **Clicking a CC line never projects it.** It scrolls the element it is a copy of into
     view and flashes it — in the presenting flow and in the preview window at once — so you can
     always find what a short label refers to.
   - Right-click a CC line for **Remove CC Element** (ដកធាតុ CC ចេញ). There is no
     **Disable** on a CC: parking takes a _line_ out of the running order, and a CC is not
     a line of the running order — one you do not want is simply removed. (So attaching a
     line you have parked gives you a CC that _does_ fire, while the parked line itself
     stays parked.) A whole document and an audio track cannot be CC elements — neither
     reaches a screen — and the app says so if you try.

   An element can hold as many CC elements as you like; a CC element cannot have CC
   elements of its own.

   **Media Control — playing the video or song inside a slide by itself.** A slide can hold
   a video or an audio clip of its own, and normally you press play on it by hand on the
   mini screen. Right-click the slide (or the document line, or the line of a slide inside
   a document) → **Add Media Control** (បន្ថែមការគ្រប់គ្រងមេឌៀ) and the running order does it
   for you. A settings panel opens first — nothing is added until you press **Ok**:

   - **Action** — **Play**, **Pause** or **Stop**. Play starts the media; Pause leaves it
     where it is; Stop pauses it and winds it back to the start point, so the same line can
     be used again. Put a Pause or a Stop on a later line to cut a clip short.
   - **Delay Before** — wait this many seconds after the slide goes up before doing
     anything. Leave it at 0 to act at once.
   - **Media Start At** — where in the clip to begin, in seconds.
   - **Then Pause** — **Never**, **After** so many seconds of playing, or **At Media Time**
     to stop at a point of the clip itself (so "play 0:10 to 1:10" is two numbers, not a
     stopwatch).
   - **Volume** and **Speed** — each behind a tick box, because leaving one un-ticked means
     "don't touch it": the level you set by hand on the mini screen stays as it is.
   - **Set Specific Screen** — leave every box clear and it works on whatever screens the
     slide went to. Tick one and it works **only** where the slide also landed. It is
     controlling the media the slide put on a screen, so a screen the slide never reached
     has nothing on it to control.

   The new line appears as a CC element under the slide, reading what it will do —
   `Slide: Media Control (Play +3s 10s→70s 70% 2x)` — with a small **cyan gear** at its
   right. Click the gear (or right-click → **Media Control Settings**) to change it later;
   it opens on what you set last time. 📸

   Every video and audio clip in that slide is driven together. The sound comes out of the
   presenter machine, exactly as it does when you press play by hand, so the **Volume** is
   the level you hear at the desk; the projected screen stays silent and simply keeps in
   step, at the same speed.

   **Moving off the slide stops it.** When you put another slide on that screen — or clear
   the screen — everything the Media Control started is stopped and anything still waiting
   (a "stop at 1:10", a delayed start) is dropped, so nothing carries over to whatever you
   put up next. This is what lets the running order carry on: a clip you started **by
   hand** on the mini screen blocks the next slide until you pause it (the app says
   **Media is Playing**), because there the app cannot know you meant to leave it — but a
   clip the running order started is the running order's to stop. 📸

   This one is only ever attached to a slide: you will not find it under **Add Action** on
   the running order itself, because "start this video ten seconds in" is a sentence about
   one particular slide.

   A **document** line can be pinned too — its slides then all follow it — and you can pin
   **one slide on its own**: open the document's arrow, right-click the slide and set its
   screen. That slide overrides the document; its neighbours keep following the document.
   A slide pinned in its own right shows the 📌 on its own line **and in the bottom-right
   corner of its thumbnail in the preview panel**, so a run sheet you are reading as
   pictures still tells you which slide breaks away from its document. Clearing it hands
   that slide back to the document rather than pinning it to nothing. The same right-click
   is on the slide thumbnails inside the preview panel.
   **Park a line you do not want touched.** A line you might click by accident — an
   alternate verse, last week's notice, a song you may or may not reach — can be taken out
   of the running order without deleting it: right-click it → **Disable**
   (បិទដំណើរការ). The line dims, is written in italics, is **crossed out** and gains a small
   amber 🚫 at its right end, and from then on **clicking it does nothing at all** — nothing
   is projected, and a document line does not even open. Dragging it onto a mini screen puts nothing there,
   and the arrow/Space keys in the preview panel step straight past it. Right-click →
   **Enable** (បើកដំណើរការ) puts it back. (While a line is parked its menu drops
   **Show on Screens** — an entry that could no longer do anything — but everything else
   stays, so you can still recolour it, move it, or turn it back on.) 📸
   You can park **one slide of a document** the same way: open the document's arrow and
   right-click the slide. Park the **document itself** and every slide under it is parked
   with it. A parked line can still be dragged up and down to tidy your running order, and
   parking is remembered in that presenting flow only — the same song stays live in your other
   services.
   **Two kinds of greyed-out line, and they now look different.** A line YOU parked here is
   crossed out and carries the amber 🚫 ("This item is disabled in this presenting flow"). A slide
   that is greyed out because the **document itself** hides it is _not_ crossed out and
   carries a plain grey 👁‍🗨 ("This item is disabled in its document") — right-clicking that
   one will not bring it back, because a running order cannot re-enable what the document
   turned off; open the document and enable the slide there. In the preview panel the same
   two marks sit in the **bottom-left corner** of each dimmed thumbnail. 📸

6. Right-click an element for **Move up** / **Move down**, **Choose Color** (ជ្រើសរើសពណ៌)
   to group your running order by colour, or **Remove from Presenting Flow**. To move a line a long
   way, use **Move to Top** (ផ្លាស់ទីទៅលើគេ) or **Move to Bottom** (ផ្លាស់ទីទៅក្រោមគេ) instead of
   clicking **Move up** over and over — the line jumps straight to that end and everything
   else keeps its order. (A line that is already at the top is not offered **Move up** or
   **Move to Top**, and one already at the bottom is not offered **Move down** or
   **Move to Bottom**.) **Duplicate** (ស្ទួន) puts a copy of the line **directly below** it,
   with its colour, its pinned screens and its parked slides already on the copy — the quick
   way to sing a song twice in one service, then change only the second one. The two copies
   are separate from then on: parking or recolouring one leaves the other alone. 📸
   You can also drag a
   line up or down **inside the same presenting flow** (dragging a line into a _different_
   presenting flow does nothing — add it there from its own list instead). A colour shows as a
   stripe down the left edge of the line and a dot at its right end; the lines stay in
   your running order — they are never re-sorted into colour groups, because the order
   _is_ the meaning here. The colour belongs to that presenting flow alone, so the same song can
   be marked differently in two services. Changes are saved as you make them — there is
   **no save button** anywhere in this panel.
7. Whatever is **live on the screen right now** is marked with a green `*` — on the
   element itself, on the document it belongs to, on the presenting flow, and on the
   **Presenting Flows** heading — so you can see at a glance where you are in the running order.
8. Not sure which "5.jpg" a line means? Right-click it → **Reveal Original**
   (បង្ហាញកន្លែងដើម) — the app scrolls to the real item elsewhere in the window and
   flashes it. This works on the slides inside an opened document too. A colour or a
   camera has no original to point at, and the panel holding the original has to be
   open already.
9. To see the whole service at a glance, click the **window** icon on the presenting flow row (or
   right-click → **Open Preview**). A floating panel shows every element with its real
   preview — slides look exactly as they will project, and a document shows all of its
   slides. Collapse the ones you are not working on — or fold the whole running order
   away at once with the **Collapse All** (បង្រួមទាំងអស់) icon at the bottom-right of the
   panel, and open it all again with **Expand All** (ពង្រីកទាំងអស់) beside it. Whichever
   of the two has nothing left to do fades out. Whatever you folded away is remembered for
   that presenting flow, so a running order trimmed down to the few things you are working on
   comes back that way next time — and it follows the element, not its position, so
   reordering the list does not shuffle what is folded. 📸
   To make the thumbnails bigger or smaller, use the zoom slider in the panel's footer
   (it tucks itself away into a **⋯** button at the bottom-left), **Ctrl + scroll**, or a
   two-finger **pinch**. This zoom is remembered separately from the one in the middle
   Documents tab — and it is shared by every one of these panels, so zooming one resizes
   them all.
   **You can have several of these panels open at once**, one per running order — the
   songs in one and the sermon in another, side by side. Each opens beside the last rather
   than on top of it, remembers its own size and place, and is closed on its own with its
   ✕ (or by clicking its window icon in the list again). Each is its own run, too: where
   you are, what you have folded away and any countdown belong to that panel alone, and
   the keys below always drive the one you last clicked into. 📸
   **Run the service from this panel.** Click an element — the panel outlines it and
   remembers it as where you are. Clicking its preview also shows it, and clicking the
   title line of a folded element marks it just the same — folding is the chevron on its
   left, so pointing the run at an element never folds it away.
   Then **Space**, **↓**, **→** or **Page Down** moves to the next
   element and shows it, so you can walk the whole running order without going back to
   the mouse. **A document is walked slide by slide:** arriving at it always shows its
   **first** slide, each further press shows the next one, and the keys only move on to
   the next element once its **last** slide is the one on screen — so a whole song or sermon deck plays from here without touching
   the mouse. A **folded-away** element is not passed over: the run **opens it** when it
   gets there, and a song folded away is unfolded and walked from its first slide like any
   other. Folding is how you _read_ a long running order; it never decides what is in the
   service. **The only line the keys step over is one you have parked** (step 9) — an audio
   track and a damaged line still take the marker, so you can see where the run has got to,
   they simply have nothing to show. The last element is the end — it does not start over.
   The keys work while you are in this panel, and it takes them the moment you open it, so
   there is nothing to click first; click into the slides list and they drive that list
   again, as before. 📸
   **A screen action is stopped on and fired** like anything else — so putting a
   **Clear All** between the last song and the sermon means one more press of the same
   key blanks the screen at exactly that point in the running order.

   **And the run can walk itself.** The two `Next:` actions of step 2 are stopped on and
   fired the same way, but what they fire is this panel: a **Next: Timeout** waits its
   seconds and then makes the very same move the next key would have made, and a
   **Next: Interval** keeps making it. While either is counting, a small pill at the
   panel's top-right shows the seconds left — click it to stop. Remember the difference:
   a timeout gets out of your way the moment you click or press anything, an interval
   keeps going until you stop it there. 📸

   **Everything you can right-click in the list, you can right-click here.** The menus in
   this panel are the very same menus — right-click an element's **title line** (or any
   empty part of its box) and you get its full menu: **Reveal Original**, **Show on
   Screens** / **Apply on Screens**, **Set Specific Screen**, **Add CC Elements**, the four
   moves, **Duplicate**, **Choose Color**, **Disable** / **Enable** and **Remove from
   Presenting Flow**, gated exactly as they are in the list. So you can tidy and re-order the
   running order from the panel you are actually watching during the service, without
   going back to the list — and the list behind it follows immediately. 📸
   Two things inside a box keep menus of their own, because they are not the element:
   a **slide thumbnail** gets the slide's menu (**Reveal Original**, **Show on Screens**,
   **Set Specific Screen**, **Disable**, **Add CC Elements**), and a **CC line** gets its
   short one (**Reveal Original**, **Set Specific Screen**, **Remove CC Element**).

**Sharing it with another machine**

10. Right-click the presenting flow → **Export** (នាំចេញ). A small panel asks for a
    **Password** (ពាក្យសម្ងាត់) and a **Confirm Password** (បញ្ជាក់ពាក្យសម្ងាត់).
    **Leave both empty and press Ok** for the ordinary bundle: one
    `<name>.owapf.tar.gz` file in your **Downloads** folder, and the folder opens. It
    contains the presenting flow _and every file it needs_ — the full documents behind your
    slides, the images and videos, and any background attached to those documents.
    (See step 10a to put a password on it instead.)
    10a. **To protect it with a password**, type the same password in both fields and press
    **Ok**. **Show Password** (បង្ហាញពាក្យសម្ងាត់) reveals what you typed if you want to
    check it. You get `<name>.owapf.enc` instead — the same bundle, locked. If the two
    fields do not match the panel says **Passwords do not match**
    (ពាក្យសម្ងាត់មិនត្រូវគ្នាទេ) and asks again rather than exporting, keeping what you
    already typed so you only fix the half that is wrong. Clearing both fields is always
    allowed — that just means "no password".

    > **There is no way to recover a forgotten password.** Nobody — not you, not the app,
    > not the person you send it to — can open the bundle without it. Write it down
    > somewhere safe before you hand the file over, and send it by a different route than
    > the file itself.

11. On the other machine, right-click an empty part of the **Presenting Flows** list → **Import**
    (នាំចូល) and pick that file — or just **drag the `.owapf.tar.gz` (or `.owapf.enc`)
    file from your file manager onto the Presenting Flows list**, which imports it the same way.
    A protected bundle asks for its password first, saying **This archive is password
    protected** (ឯកសារបណ្ណសារនេះត្រូវបានការពារដោយពាក្យសម្ងាត់); get it wrong and it says
    **Wrong password, try again** (ពាក្យសម្ងាត់មិនត្រឹមត្រូវ សូមព្យាយាមម្តងទៀត) and lets
    you retype it, up to three tries. An ordinary bundle never asks. The songs, documents
    and media are re-created in that machine's own folders, Bible verses are added to the
    **Default** list, and every link inside the presenting flow is re-pointed at the local
    copies. 📸
12. If the bundle is on a web server or a machine sharing it over the local network,
    you can skip copying the file about: right-click the **Presenting Flows** list →
    **Import From URL** (នាំចូលពី URL), paste the link and press **Ok**. (If the link is
    already on your clipboard it is filled in for you.) The app downloads the bundle to a
    temporary folder, imports it exactly as above and then deletes the download — you end
    up with the presenting flow and nothing else left over. A plain `http://…` address with a
    port, such as one served off another laptop, works as well as `https://`. 📸

> Notes: a file that is already there **with the same contents** is reused rather than
> duplicated, so importing the same bundle twice is safe. If a file of the same NAME is
> already there but is actually a different file — your own `a.mp4` is not the `a.mp4`
> in the bundle — yours is left untouched and the bundled one is added beside it as
> `a (1).mp4`, with the presenting flow pointed at that copy. Slides and documents are
> stored as _references_, so editing a song later means the presenting flow projects the new
> words. Colours and cameras carry no file, so there is nothing to bundle for them.
>
> A video placed **inside a slide** travels too: the bundle carries the video file and
> the imported slide is re-pointed at the local copy, so it plays on the other machine.
> (Images placed in a slide are stored inside the slide itself, so they always travelled.)
>
> Importing needs the folders it will write into to be **chosen already** — if, say, no
> Videos folder has been picked yet and the bundle carries a video, the import stops
> before it copies anything and tells you which folder to choose first. Nothing is
> half-imported. And if a line in a presenting flow ever shows a warning triangle reading
> **Invalid item**, that one entry is damaged (usually a hand-edited file) — the rest of
> the running order still works; remove that line and re-add it.

::: details 🤖 Robot-verified — coverage traceability
This page maps 1:1 to a workflow the QA robot drives live. It proves these `coverage-matrix.md` rows:

`PL-10` · `PL-29` · `PL-32` · `PL-33` · `PL-34` · `PL-35` · `PL-36` · `PL-37` · `PL-38` · `PL-39` · `PL-40` · `PL-41` · `PL-42` · `PL-43` · `PL-44` · `PL-45` · `PL-46` · `PL-47` · `PL-48` · `PL-49` · `PL-50` · `PL-51` · `PL-52` · `PL-53` · `PL-54` · `PL-55` · `PL-56` · `PL-57` · `PL-58` · `PL-59` · `PL-60` · `PL-61` · `PL-62` · `PL-63` · `PL-64` · `PL-65` · `PL-66` · `PL-67` · `PL-68` · `PL-69` · `PL-70` · `PL-71` · `PL-72` · `PL-73` · `PL-74` · `PL-75` · `PL-76` · `PL-81` · `PL-82` · `PL-83` · `PL-84` · `PL-85` · `PL-86` · `PL-87` · `PL-88` · `PL-89` · `PL-90` · `PL-91` · `PL-92` · `PL-93` · `PL-94` · `PL-95` · `PL-96` · `PL-101`

Regenerated from `user-workflows.md` (workflowsVersion 2026-08-31).
:::
