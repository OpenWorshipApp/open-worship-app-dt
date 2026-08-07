# OWA User Workflows — the tutorial source of truth

Canonical, **user-facing** task recipes for Open Worship App. Each workflow is written
in tutorial voice ("Click **X**, you should see **Y**") so it can be converted 1:1 into
a help page, and each is **traceable** (`Verify:` line) to
[coverage-matrix.md](../../../../docs/test-paths/coverage-matrix.md) row IDs so a robot run can prove every step
still matches the live app.

**Contract for this file:**

1. **Truth follows the live app**, not memory. If a robot run observes different
   behavior, either it's an app bug (→ file a Finding) or this file has drifted
   (→ update the workflow in the same run and note it in the report).
2. Workflow IDs (`W-01`…) are **stable** — tutorials, help pages, and doc-verification
   reports reference them. Add new workflows at the end; never renumber.
3. Every step names the control by its **English label** with the **Khmer label** in
   parentheses on first use (full map: [knowledge-base.md](./knowledge-base.md) §1).
   The app renders whichever locale the user chose.
4. `📸` marks a **screenshot checkpoint** — when generating a tutorial page, capture a
   fresh screenshot of the live app at exactly that state.
5. `Verify:` lists the coverage-matrix rows that prove the workflow. Verifying a
   tutorial or learning doc = running those rows.

**workflowsVersion: 2026-08-07a** (**W-05** steps 4-5: a song's `- Attachments:` links
now each become a real slide at the end of the Stage Previewer — a YouTube video, an
image/video/audio, or the web page itself, full-bleed and presentable like a verse; a
`file:///…` link lets a chart or a backing track travel with the song, and a PDF or a
non-address line still gets its named but empty slide. **Driven live.**
Earlier: **2026-08-07** — **W-05** + the layout tour: songs are selected from
the Documents list like any other file — one highlighted row, no separate Lyrics tab —
and the Documents preview switches to the song view. Earlier: **W-22** step 2: a running order can now put the SCREEN
ITSELF up and down — **Screen: Show** / **Screen: Hide**, for a sheet that has to work with
nobody at the machine. They are the only actions that ask **which screen** when you add
them, and they go to those screens and only those: no falling back to whatever is selected
and no stopping to ask, because there is nobody there to answer. Firing one twice is
harmless. **Driven live.** Previous: **2026-08-06a** — **W-22** step 2: a fourth run action, **Keyboard Event**
— a **shortcut you set by pressing it** (Ctrl/Shift only, at least one, unique per playlist)
that sends the run to that line and puts **all** of its CC elements on the screens at once.
**W-22** step 8: the run no longer steps over a **folded-away** element — it **opens** what
it lands on, and **parked is now the only reason a line is passed by**; the preview panel
also takes the keyboard the moment it opens. **Add Action** folds its eight per-widget
foreground clears behind one **Other Clear FG Items** row. **Driven live**. Previous:
**W-22** step 2: a **Next: Timeout** can now wait until a
TIME ON THE CLOCK instead of counting seconds — its question has a **Seconds** / **At Time**
chooser, the line reads `⏱ Next: Timeout (7:05 AM)`, and a time already gone by is refused
out loud rather than waiting until tomorrow. Its menu entry is **Change Timing**.
**Driven live**. Previous: **W-22** step 2: a **Jump to** that lands on a
**Next: Interval** now STARTS it — it was being withheld, which broke the looping set (an
interval over a set of slides, a jump at the end of them pointing back at it). A jump is
the next key aimed at a line of your choosing, and does there whatever stepping onto that
line would have done. **Driven live**. Previous: **W-22** step 2: the two clocks now answer only to the
run MOVING — a **Next: Timeout** is called off by you going to another line (not by any
stray click, which used to kill it), and a **Next: Interval** starts its count again from
the line you step to. **Driven live**. Previous: **W-22** step 5: holding **Ctrl** while dropping
something from ANOTHER panel onto a line now inserts it as a new line THERE rather than
attaching it — previously the only way in was the end of the list. And the three `Next:` /
`Jump to` actions now wear three different colours (amber, teal, purple) instead of one.
Previous: **W-22** step 5: dragging a line onto another no longer
depends on hitting a 7px band — hold **Ctrl** (⌘) to force the MOVE or **Alt** to force the
ATTACH, anywhere on the line, with the mark following the key while you drag. Without
either, aiming works exactly as before. **Driven live** (all four combinations read off the
row's own mark, plus a real Ctrl-drop in the middle of a line that moved it instead of
attaching). Previous: **W-22** step 2: a third run action, **Jump to**
(លោតទៅ) — the one way a running order goes anywhere but forward. You point it at another
line by attaching that line to it as its single CC element (a whole song included, which
nothing else can be a CC of), and when the run reaches it — or you click it — the run goes
there and shows it. Put one at the end of a set of announcement slides with an interval
above them and the set loops by itself. **Driven live** (aimed one at a song, jumped
backwards to it from the last line of the sheet and watched the song open at its first
slide; the attach list, the one-CC cap and the three "nothing to jump to" messages
checked too). Previous: **W-22** step 2/5: a **Next: Timeout** can now be
attached to a line as a **CC element**, which is how you say "show this slide, and go on
by yourself ten seconds later" without putting a waiting line in the running order. A
**Next: Interval** deliberately cannot be attached to anything — nothing you do stops an
interval, so one riding a slide would keep walking the sheet on its own. **Driven live**
(attached one to a slide, stepped onto that slide with the next key and watched the
countdown carry the run on; the interval is absent from the attach list). Previous:
**W-22** step 2 and step 8: a running order can now
**walk itself**. The **Add Action** menu gained **Next: Interval** (⟳) and **Next:
Timeout** (⏱) under the clears; each asks for a number of **seconds** when it is added
(shown in the line, changeable later from the line's own **Change Seconds**). A
**timeout** counts that many seconds down and then moves the run on once — and any click
or key you make cancels it, so taking over is simply taking over; an **interval** keeps
moving it on every so many seconds and is stopped only by the pill it puts at the top of
the preview panel. Both work only while that playlist's **preview panel** is open — it is
the panel that walks the run — and elsewhere they say so rather than pretend. **Driven
live end to end** (armed, cancelled, handed an interval over to a timeout, stopped by the
pill, and the toast with the panel closed; playlist restored afterwards) — see PL-95.
Previous: **W-22** step 9: the **preview panel's right-click menus
are now the same as the list's**. Right-clicking a line in the floating preview used to
offer only **Show on Screens** and **Disable** (and nothing at all on an audio line), so a
running order could not be reordered, recoloured, duplicated or tidied from the panel you
actually watch during a service — you had to go back to the list. It now carries the whole
menu, and a slide thumbnail in the panel gained **Reveal Original**. **Driven live
2026-08-05**: opened the preview for `pl1`, read the full menu off an element's title line
and off a **Clear All** action line, off a song's slide thumbnail and off a CC line, then
moved a line down and back up from the panel and watched the list behind it follow.
Previous: **W-22** gained **CC elements** (new step 5): anything in a
run sheet — a background, a verse, a foreground preset, a whole song or one of its slides —
can now be attached to another line, and that line then brings it onto the screen with it.
One click puts verse 1 and the welcome marquee up together; a CC on a song's line rides with
every slide of it. Attach by dropping onto the line, or from **Add CC Elements**; clicking a
CC never projects it, it takes you to the element it is a copy of. **Dropping onto a LINE no
longer adds an element to the playlist** — step 2 now says to drop onto the playlist's NAME
row. **Driven live 2026-08-05**: attached a marquee to slide 1 of a song from the menu,
clicked the slide and read BOTH the slide and the marquee off the real `screen.html?screenId=0`
output, confirmed the preview's run cursor ignores a CC click, then removed it again.
Previous: **W-22**: a line YOU parked and a slide the DOCUMENT hides
no longer look alike — yours is crossed out with an amber 🚫, the document's keeps a plain grey
👁‍🗨, and the tooltips say which; the preview panel's dimmed thumbnails carry the same two marks
bottom-left. It matters because only one of the two comes back from the run sheet's own menu.
**Driven live 2026-08-05**: parked a slide of a document beside two the document hides and read
all three in the tree and in the floating preview, then released it again. Previous: **W-22**
gained **Move to Top** / **Move to Bottom** and
**Duplicate** — a line can now jump straight to either end of the run sheet instead of being
clicked up one step at a time (the entry is simply absent on a line already at that end), and
a line can be copied directly below itself with its colour, its pinned screens and its parked
slides already on the copy; the two are independent from then on. **Driven live 2026-08-05**:
moved a middle element to the bottom and back to the top, compared the first/last row menus,
duplicated a document line with parked slides, released the copy and confirmed the original
stayed parked, then removed the copy. Previous: **W-22** gained **Disable** / **Enable** — any line of a
run sheet, or one slide of a document line, can be PARKED out of the running order without
being deleted: it dims, its click and its drag stop projecting anything, and the
arrow/Space keys step past it. Parking is stored per playlist, so the same song stays live
in another service. **Driven live 2026-08-05**: parked and released an element, a document
(its slides parked with it) and a single slide, in the tree and in the floating preview.
Previous: **W-22** gained **Set Specific Screen** — a playlist
line, a document line, or one slide of a document can be PINNED to particular screens, and
every present from the panel then ignores which mini screens are selected. Drag-onto-a-mini-screen
and **Show on Screens** still override a pin on purpose; a pinned screen that is gone
toasts rather than projecting elsewhere. **Driven live end to end** on 2026-08-05 across
three screens: pin persisted into the `.owp`, beat the selected screen from the tree row,
the preview thumbnail and the Space key, and a per-slide pin overrode its document's while
its neighbours kept following it. Previous: new **W-24** — a **bible list** now exports/imports as
a `.owbible.tar.gz` bundle, and W-23 gained a note that a **lyric** rides the document
bundle unchanged (its attached slide backgrounds travel with it). **Driven live end to
end** on 2026-08-05: a Khmer-named lyric exported with both of its attached slide images
and re-imported with its `.bg.json` re-pointed at the reused local copies; a bible list
exported with its attached bg-colour sidecar and re-imported into the bibles folder.
Previous: new **W-23** — one document (slides, lyric, PDF, PPTX
or DOCX) can now be exported and imported on its own as a `.owadoc.tar.gz` bundle,
carrying its attached background and that background's media, any video inside its
slides, and its colour note. It behaves exactly like the playlist bundle in W-22 because
it runs the same code. **Driven live end to end** on 2026-08-05: exported an `.ows` and a
PDF (the PDF's attached background video and its green colour note both landed in the
manifest), then dropped a bundle back onto the Documents list — the document was written,
its `.bg.json` re-created pointing at the reused local video, and its colour note
restored. Previous: bump when any workflow changes) — **W-11** (Bible Reader)
and **W-09**'s lookup note corrected: typing a full reference like `John 3:16` does **not**
jump to the verse on the Reader page either — it book-filters and drops the `3:16` when the
book is picked, exactly like the lookup dialog. Verified live 2026-08-05. Previous: **W-22**'s sharing
notes now say what happens when the other machine already has a file of the same NAME
that is a DIFFERENT file: yours is kept and the bundled one arrives as `a (1).mp4`
(matching contents are still reused, so a repeat import adds nothing). They also say
that a video placed inside a slide now travels with the bundle and is re-pointed at the
local copy — it used to arrive as an empty box. **Driven live end to end** (round-tripped
a fixture bundle: differing `1.jpg` landed as `1 (1).jpg` with the original untouched,
the slide's video was bundled and re-pointed, and re-exporting carried it again) — see
PL-67 / PL-76. Previously: **W-22** gained
step 11: the Playlists list menu now also offers **Import From URL** (នាំចូលពី URL), so a
bundle published on a web server — or shared off another laptop over the local network —
is imported by pasting its link instead of copying the file across. The download lands in
a temporary folder, is imported exactly like a picked or dropped bundle, and is deleted
afterwards; plain `http://host:port/…` works as well as `https://`. **Driven live end to
end** (real 80 MB bundle over a local `http://localhost:8000` server, both locales, plus
the 404 and Cancel paths) — see PL-75. Previously: **W-22** step 2 now
also lists the **per-widget foreground clears** the **Add Action** menu offers under the
five broad ones (`M↑` `M↓` `QT` `CD` `SW` `TM` `CM` `WB`), each doing what that widget's
own hide button in the Foreground panel does, and says why the panel's **Background Images
Slide Show** has no action of its own (it is a background — **Clear Background** stops it).
Driven live: the 13-item menu in both locales, and `Clear FG Marquee Top` then
`Clear FG Stopwatch` on a real `screen.html` output, each taking only its own widget while
the bible verse stayed up. Previously: **W-22** gained
**screen actions**: a playlist can now hold something to _do_ as well as things to show.
Its step 2 covers **Add Action** (បន្ថែមសកម្មភាព) and the five clears it offers, step 4
that an action is _run_ on a screen (click / drag onto one mini screen / **Apply on
Screens**) rather than shown on one — and so never lights up as live — and step 8 that the
floating preview's next-key stops on an action and fires it, so a **Clear All** dropped
between the last song and the sermon blanks the screen at exactly that point.
**Driven live end to end** (both locales, real `screen.html` output, playlist restored
afterwards) — see PL-71..73. Previously: **W-22 is no longer
a development-only workflow**: commit `203d35cc` removed the `isDev` gate, so the
**Playlists** panel ships in packaged builds too (it took the slot the separate **Lyrics**
list used to hold — lyrics are rows of the **Documents** list now). The warning at the top
of W-22 is gone, its step 1 says where the panel actually sits, and steps 5/8 gained the
colour stripe, the per-element fold memory and the "no save button" note. **Source-verified
from `src/presenter/AppPresenterLeftComp.tsx`, not yet re-driven live** — the next robot
run must confirm the panel really is there on a packaged build before this claim is
treated as observed. Previously: **W-22** step 8
now says arriving at a document always shows its FIRST slide, and that folding is the
chevron rather than the whole title line (PL-46 / PL-48). Previously: **W-22** step 8
said the next-key walks a **document element's own slides** and only moves to the
next element once its last slide is on screen (PL-48). Previously: **W-22** step 8
named the floating preview's **Collapse All / Expand All** icons at its
bottom-right, which fold or unfold the whole running order in one click (PL-47). Previously: **W-22** step 8
covered running the service from the floating preview with the keyboard: click
anywhere on an element to mark where you are (its preview, or the title line of a
folded one), then **Space / ↓ / → / PageDown** moves to and shows the next element
(PL-46). Previously: the playlist
sharing workflow's import step now also accepts the `.owapl.tar.gz` **dropped straight
onto the Playlists list** (PL-45), not only the list menu's **Import** entry.
Previously: **every file list
now has one button, a gray ⋮ (More Options)**, opening the same menu as right-clicking
the empty list body; the old **↻ Reload** and **+ Add items** icons next to the folder
path are gone (Reload is the menu's first entry). Lists with a title bar put the ⋮
there; the background / foreground-web tabs put it in the path row. **W-15** gains the
lyric/document _creation_ step — the Documents list offers **New App Document** and
**New Lyric** as two direct entries (all observed live, English and Khmer); W-08's Web
tab step now points at the ⋮ instead of the `+`. Previously: new **W-22** (build a
service playlist and export/import it as a `.owapl.tar.gz` bundle); its step 7 now says
**right-click → Reveal Original** (the 3-second hover-to-locate it described was replaced
by that context-menu item, PL-37 / PL-34) — source-verified, not yet driven live;
dev-builds only, and
its steps are **source-verified + partly driven live**, so the next full robot run must
confirm every step by hand and correct anything that drifted. Previously: **W-08** gains the
Background thumbnail/list view toggle (Images / Videos / Web), observed live end-to-end.
Previously: new **W-21** (download a background video / audio from a link), observed live
end-to-end; W-16 Language now states that `Apply Settings` is required to complete the
switch (observed live).

> ⚠️ **Pending live re-verification (2026-07-18).** A `src/` sweep for the coverage-matrix
> expansion indicates the presenter UI has drifted from some steps below: **Foreground**
> (W-09) and **Bible text styling** (W-07) are now **floating widgets** (a toggle button)
> rather than middle-column split-tabs; presenting a slide is a **single-click toggle**
> (W-03/W-05 say double-click); Background **Web `+`** (W-08) opens a menu first; Settings
> **Theme** (W-16) offers **System / Light / Dark**. These are source-verified but **not
> yet confirmed on the live app**, so the tutorial prose is left as-is per this file's
> "truth follows the live app" contract — the next robot run must confirm each and correct
> the affected workflow (then bump `workflowsVersion`). The coverage-matrix REFINEs
> (`PM-01`, `PM-06`, `PM-13/14`, `PM-33`, `PM-57`, `ST` theme rows) already encode the
> observed behavior as test expectations.

---

## Orientation

### W-01 — Understand the Presenter window

**Goal:** know where everything lives.
**Where:** the main window (`presenter.html`), which opens on launch.

The Presenter has a header and three resizable columns:

- **Header:** page tabs — **Presenter** / **Bible Reader** (អានព្រះគម្ពីរ) /
  **Slide Editor** (កែសម្រួលស្លាយ) — the **Bible Lookup** (ស្វែងរកព្រះគម្ពីរ) button
  (center, `Ctrl+B`), and the **Settings** gear (ការកំណត់) + Help buttons (right). 📸
- **Left column:** your content libraries — the **Documents** (ឯកសារ) list (songs live
  here too, marked with a music note) and **Playlists**.
- **Middle column:** the working area — **Documents / Bibles** preview tabs plus the
  **Foreground** button on top, and the collapsible **Background** panel at the bottom.
  The Documents tab shows whatever kind of file you picked: slides for a slide document,
  pages for a PDF, and the song view for a lyric.
- **Right column:** **Bibles / Notes** lists and the **mini screen** — a live preview
  of exactly what the audience sees, with clear buttons and a zoom slider under it.

Drag any divider between panels to resize them; the size is remembered. 📸

_Verify: GL-12, NAV-01..02, PL-01, PR-04._

### W-02 — Switch between the main pages

**Goal:** move between Presenter, Bible Reader, and Slide Editor.

1. Click a header tab — the window switches to that page in place.
2. **Slide Editor** only opens when a slide document is selected; otherwise the app
   shows an alert ("No slide selected") and stays put. Select a document in the left
   list first (W-03).

_Verify: NAV-01..04._

---

## Presenting content

### W-03 — Present a slide from a document

**Goal:** put a slide on the screen.
**Preconditions:** at least one document in the **Documents** list.

1. In the left column, click a document in the **Documents** (ឯកសារ) list. It
   highlights, and its slides appear as thumbnails in the middle **Documents** tab. 📸
2. **Double-click** a slide thumbnail. The slide goes live: it appears on the mini
   screen, and the live item is marked highlighted (on-screen indicator). 📸
3. To step through slides with the keyboard, click once in the thumbnail area, then use
   **Arrow keys / PageUp / PageDown**; **Space** toggles the focused slide.
4. To remove the slide from the screen, press **F8** (Clear Slide — លុបស្លាយ) or click
   the matching clear button under the mini screen.

Tips:

- The slider in the Documents-tab footer resizes the thumbnails.
- The stopwatch icon in the same footer opens **auto-play**: set seconds, press play,
  and slides advance automatically; the red ✕ closes it (W-04).

_Verify: PL-01, PM-05..09, KB-05, KB-08._

### W-04 — Auto-play slides on a timer

**Goal:** advance slides hands-free.

1. Open a document's slides (W-03 step 1).
2. Click the **stopwatch icon** in the Documents-tab footer — the auto-play widget
   expands. 📸
3. Type the interval in seconds, then click **play**. Slides advance on the timer.
4. Click **pause** to stop, or the red **✕** to close the widget.

_Verify: PM-10._

### W-05 — Present song lyrics

**Goal:** put a song's lyrics on the screen.

1. In the left column, click a song in the **Documents** (ឯកសារ) list — songs carry a
   music-note icon. The middle **Documents** tab switches to the song view: the lyric
   **Previewer** on top and the **Stage Previewer** verses under it. Only one file in the
   list is ever highlighted, so picking a song releases whatever was selected before. 📸
2. **Double-click** a verse to send it to the screen.
3. Press **F8** / the clear button to take it down.
4. If the song's `ol:Config` block lists an **`- Attachments:`** field — one link per
   line — each link also becomes its **own slide at the end** of the Stage Previewer,
   named after the link. A YouTube link becomes a playable video, an image / video /
   audio link becomes that media, and any other web address becomes the page itself;
   each fills the whole slide. Present one the same way you present a verse. A link to
   a file on this computer works too (written `file:///C:/…`), which is how a chart or
   a backing track travels with the song. 📸
5. Links the app cannot show — a PDF, or a line that is not a web address — still get
   their named slide, just an empty one.

_Verify: PL-07..08, PM-11, PM-115._

### W-06 — Look up and present a Bible verse

**Goal:** find a verse fast and put it on screen.

1. Press **Ctrl+B** (or click **Bible Lookup** / ស្វែងរកព្រះគម្ពីរ in the header). The
   lookup opens as a popup dialog. 📸
2. The input is a **step-by-step picker**: type the first letters of the book (e.g.
   `Joh`) and click the book, then pick the chapter, then the verse. Press **Tab** to
   auto-complete the current part; **Escape** clears the input.
   > Note: typing a full reference like `John 3:16` only filters the book list — the
   > chapter and verse you typed are dropped when you pick the book. This is true of the
   > **Bible Reader** page too (W-10), so always pick book → chapter → verse in steps.
3. The verse renders in the preview panel. **Double-click** it to present. 📸
4. Close the dialog with the red ✕ button or **Ctrl+Q**.
5. Press **F9** (Clear Bible — លុបព្រះគម្ពីរ) to take the verse off screen.
6. The presented verse also appears in the **Bibles** tab (middle column) and the
   **Bibles** list (right column) for re-presenting later.

_Verify: NAV-06..07, RD-02, PM-12, PR-02, KB-01..02, KB-06, KB-09._

### W-07 — Style the on-screen Bible text

**Goal:** change how verses look on the screen.

1. Open the middle **Bibles** (ព្រះគម្ពីរ) tab.
2. Open its settings split — the **Appearance** and **Text Shadow** cards. 📸
3. Adjust a control (size, color, shadow); the mini screen updates live.

_Verify: PM-13..14._

### W-08 — Set the background (color / image / video / web)

**Goal:** put something behind your content.

1. At the bottom of the middle column, click the thin **Background** (ផ្ទៃខាងក្រោយ)
   bar — the panel expands to show its tabs. 📸
2. Pick a tab: **Colors / Images / Videos / Cameras / Web** (ពណ៌ / រូបភាព / វីដេអូ /
   កាមេរ៉ា / វេបសាយ).
   - **Colors:** click a swatch. If the color could clash with the text, the app asks
     whether to adjust the text color too — choose **Ok** or **Cancel**.
   - **Images / Videos:** **double-click** an item to make it the live background. 📸
   - **Cameras:** pick a connected camera device.
   - **Web:** click a saved page, or use the **⋮** next to the folder path (or
     right-click the empty list) → **Add URL** to add one (opens the Web Editor, W-15).
3. The live background's tab shows a `*` prefix (e.g. `*Videos`).
4. Press **F7** (Clear Background) to remove it.

**Thumbnail view vs list view (Images / Videos / Web).** By default each tab shows
picture previews. If you have a lot of files — or the app feels slow on an older
machine — switch to a plain name list: hover the bottom edge of the Background panel
(or click the small **⋯** button at its bottom-left) to bring up the footer bar, then
click the **list** icon (`☰`) at the far left; the **grid** icon next to it switches
back. 📸 The list shows each file's full name (with its extension), which screens it is
showing on, and its colour dot — clicking a row still puts it on screen exactly like a
thumbnail. Each tab remembers its own choice, and it survives restarting the app. The
thumbnail-size slider only appears in thumbnail view.

_Verify: PM-26..33, PM-101, PM-114, KB-04._

### W-09 — Play audio, and foreground extras (countdown, clock, marquee bottom…)

**Goal:** run service extras.

**Audio:** in the Background panel, toggle the **Audios** (សំលេង) tab open, click play
on a track — the tab is marked while playing; click stop to end. 📸

**Foreground widgets** — open the middle **Foreground** (ផ្ទៃខាងមុខ) tab; each widget
has its own controls and a Show/Start button:

- **Marquee Top:** type the scrolling text, click Show — it scrolls along the top edge.
- **Marquee Bottom:** type the scrolling text, click Show — it scrolls along the bottom
  edge. Top and bottom can be shown at the same time.
- Both marquees expose a **scroll speed** (%) under _Properties_: `100%` is the default
  pace, higher is faster, lower is slower. Changing it while a marquee is showing
  re-paces it without having to click Show again.
- **Quick Text:** type a short message, click Show.
- **Countdown:** two modes — _to a date/time_ (set date + time, press Start) or _for a
  duration_ (set hours/minutes, press Start). Hide with its Hide button. 📸
- **Stopwatch**, **Clock**, **Images slideshow**, **Camera overlay**, **Web overlay**:
  same pattern — configure, Show, Hide.
- The shared properties row (font size / color / position) restyles the live widget.
- Power move: **drag** a widget's Show button and **drop it on the mini screen** to
  start it there; **right-click** the button to choose a specific display.

Press **F10** (Clear Foreground) to clear all foreground widgets, or **F6** to clear
everything at once.

_Verify: PM-15..25, PM-28, PM-34, KB-03, KB-07._

### W-10 — Control what the audience sees (mini screen + clears)

**Goal:** manage the live output from the screen preview card.

- The **mini screen** (right column, bottom) always mirrors the audience view; the
  zoom slider under it only rescales your preview, not the output. 📸
- Each screen has its own preview card with a **header** and **footer** of controls:
- **Show / hide the screen** (header, leftmost — or press **F5**): turns the physical
  output display on or off. The icon fills in and brightens while showing. 📸
- **Clear buttons** (header — each also has a function key):
  **Clear All `F6` / BG `F7` / SL `F8` / BB `F9` / FG `F10`**
  (លុបទាំងអស់ / លុបផ្ទៃខាងក្រោយ / លុបស្លាយ / លុបព្រះគម្ពីរ / លុបផ្ទៃខាងមុខ).
  A button is only lit while its layer has something to clear.
- **Lock** (header, the padlock): when locked (red), the screen refuses slide changes —
  handy during a live moment; click again (green) to unlock.
- **Display** (footer, e.g. `(0):2678…`): click to pick **which physical display** this
  screen projects to — the menu lists every display with its resolution, and marks the
  current one with `*` and the primary one with `(primary)`.
- **Transitions** (footer, `Tr:`): the **Slide:** and **Background:** buttons choose the
  change animation — **none / fade / move / zoom**. 📸
- **Background audio** (footer, the soundwave icon — appears while a video background
  is live): opens a small player per video to play/pause its audio in sync; the
  repeat icon loops it. The app refuses to close the player while audio is playing.
- **Stage number** (footer, `St:`): click to assign this screen a stage number
  (0–4, or increment/decrement) for stage-view setups.

_Verify: PR-04..07, SP-01..09, KB-03..07, KB-13._

---

## Bible study

### W-11 — Read the Bible (full references, versions)

**Goal:** deeper reading than the quick lookup.
**Where:** header tab **Bible Reader** (អានព្រះគម្ពីរ).

1. Click the **Bible Reader** tab. 📸
2. Type a reference using the same step-by-step picker as the lookup dialog: book →
   chapter → verse. The picker keys work here too (**Tab** complete, **Escape** clear,
   **Ctrl+Escape** clear one part).
   > Note: typing a full `John 3:16` does **not** jump to the verse on this page either —
   > it only filters the book list, and the `3:16` is dropped when you pick the book.
3. Switch the Bible **version** from the header dropdown — the text re-renders. 📸
4. Recent lookups appear as **history** entries; click one to jump back.
5. Double-click a verse to present it.

_Verify: RD-01..07, RD-11._

### W-12 — Search the whole Bible (Bible Find)

**Goal:** find verses by words, not reference.

1. In the Bible Reader (or the lookup dialog), open the **advanced lookup** toggle —
   a second panel ("Bible Online Lookup") appears beside the picker. 📸
2. Type your search words. Matching verses list page by page; click the **page
   numbers** to browse. 📸
3. Click a result to open that verse.

_Verify: RD-08..09._

### W-13 — Cross references

**Goal:** see related verses.

1. With a verse open, open its **cross references** view — related passages are
   listed; click one to read it. 📸
2. AI-generated cross references require an API key configured in Settings; without
   one, only the built-in references appear.

_Verify: RD-10._

### W-14 — Keep Bible notes

**Goal:** attach your own notes to study.

1. In the right column (Presenter) or the Reader, switch to the **Notes**
   (កំណត់ត្រាព្រះគម្ពីរ) sub-tab.
2. Open a note for editing — the **Bible Note** editor opens in its own window. 📸
3. Type your note and save (**Ctrl+S**).

_Verify: PR-03, PU-03, KB-11._

---

## Creating & editing content

### W-15 — Create and edit slides / lyrics / web backgrounds

**Making a new file:** in the **Documents** list, click the **⋮** in the list header
(or right-click the empty area of the list) and pick **New App Document**
(ឯកសារកម្មវិធីថ្មី — a slide document) or **New Lyric** (អក្សរភ្លេងថ្មី — a song). Type
a name into the row that appears and press **Enter** (or click the ✓). Both kinds live
in the same documents folder. 📸

**Slides** (Slide Editor — កែសម្រួលស្លាយ):

1. Select a slide document, then click the **Slide Editor** header tab. 📸
2. Left: the slide list — click to select; right-click to **add / duplicate / delete**;
   drag to reorder.
3. Canvas: click a box to select it; drag to move; drag the handles to resize;
   **double-click a text box** to type into it; **Ctrl+Enter** focuses the canvas. 📸
   (From the **Presenter**, right-click a slide → **Edit ↗** opens this editor in its
   own window, focused on that slide.)
4. Add new boxes/images from the tools panel (click, or drag onto the canvas).
5. Save with **Ctrl+S**.

**Lyrics:** right-click a song in the Documents list → **edit** — the Lyric Editor opens
in its own window; edit the text/chords and save with **Ctrl+S**. 📸

**Web backgrounds:** Background panel → **Web** tab → **+** — the Web Editor opens;
enter the URL and title, save, and the new item appears in the Web tab.

_Verify: ED-01..11, PU-02, PU-04, PL-09, PL-11, PL-24, CM-23, PM-33._

---

## Configuration

### W-16 — Settings: language, theme, fonts, folders

**Goal:** configure the app.

1. Click the **gear** (ការកំណត់) in the header — Settings opens in its own window. 📸
2. **General** tab:
   - **Language:** click **Khmer** (ភាសាខ្មែរ) or **English** (ភាសាអង់គ្លេស). Some
     labels change straight away, but the switch is only complete once you click
     **Apply Settings** (អនុវត្តការកំណត់) at the bottom-left — that reloads every open
     window. Unsaved edits in the Slide Editor are kept.
   - **Theme:** system / light / dark.
   - **Font family:** the font used for on-screen text. A font marked `(Missing)` is
     configured but not installed on this computer.
   - **Directories:** where documents, lyrics, and bibles are stored on disk.
   - **Reset buttons** (`Reset All Child Directories` / `Reset Widgets Size` /
     `Clear All Settings`): each asks for confirmation first — **these erase
     configuration; use with care.**
3. **Bible** tab: search available Bible versions, download new ones, enable/disable
   downloaded ones. 📸
4. Click **Apply Settings** (top-right) to apply — the app windows reload.

_Verify: ST-01..09, LT-02..04._

### W-17 — Find text anywhere (Finder) & About

- **Finder:** opens in its own small window — type a query, jump between matches with
  the prev/next arrows or **Enter**; toggle case-sensitivity with its checkbox. 📸
- **About:** shows the app version and project links.

_Verify: PU-01, PU-05._

### W-18 — Use more than one screen (multi-screen)

**Goal:** project different (or the same) content to several displays.

1. **Right-click** an empty area of the mini-screen panel and choose **Add New
   Screen** — a second preview card appears with its own number and color. 📸
2. Each card targets its own physical display (W-10, the Display button) and has its
   own show/hide, clears, transitions, and lock.
3. Content goes to every **selected** screen. Right-click a card to **Select /
   Deselect** it, or **Solo** to make it the only selected one.
4. You can also **drag** a slide, background item, or foreground Show button and
   **drop it on one specific card** to present it on that screen only. 📸
5. While a Bible verse is live, the card's right-click menu offers **Set Line Sync**
   to keep verse highlighting in sync across screens.
6. Right-click a card → **Delete** removes a screen you no longer need (the first
   screen can't be deleted while it is the only one).

_Verify: SP-04..05, SP-10..12._

### W-19 — Draw and spotlight on the app itself (Presenting Control)

**Goal:** annotate **the app window** — not the audience screen — while showing the app
to other people (a training session, a screen share, a projector mirroring your laptop).
The audience screen has its own Draw and Focus tools on the mini-screen card (W-10);
this is the same pair of tools pointed at the app.

1. Open the **Tools** menu → **Start Controlling** (**Ctrl+Shift+P**, **⌘+Shift+P** on
   Mac). A floating **Presenting Control** panel appears — drag it by its title bar,
   resize it from any edge or corner, and collapse it with the chevron; it reopens where
   and how you last left it. 📸
2. The **title bar** carries everything you reach for mid-presentation: the four tools on
   the left, then the **keyboard screencast** switch (W-20) and **Undo** / **Redo** /
   **Clear** on the right. Only the settings live in the body, so collapsing the panel
   with the chevron leaves every group one click away — roll it up to get the sliders out
   of the way and keep drawing.
3. The panel opens on the **arrow** tool — the app stays completely usable and
   anything already drawn stays visible on top of it.
4. Click the **brush** to draw. A magenta frame around the window shows the app is no
   longer taking clicks; drag anywhere to draw. Pick **Color**, **Size** (`[` / `]`) and
   **Opacity** (`-` / `=`), and switch the stroke style with **Straight** (`S`), **3D**
   (`3`) or **Dots** (`D`). **HQ** (`Q`) trades smoothness for speed on weak machines. 📸
5. Click the **eraser** to rub parts of the drawing out, and use the title bar's
   **Undo** / **Redo** (`Ctrl+Z` / `Ctrl+Shift+Z`) to step back or the red **Clear** (`C`)
   to wipe it — one Undo brings a mis-hit Clear back. All three grey out when there is
   nothing to undo, redo or clear, and all three keys work from **any** tool and with the
   panel **collapsed**, matching the buttons they mirror.
6. Click the **spotlight** to dim the whole app except a circle. In **Follow** (the
   default) the circle simply tracks your pointer; press **Hold** (`H`) if you would
   rather dim only while the mouse button is down. **Contrast** (`X`) inverts it — the
   circle becomes the blocked area instead. Size, **Dim color**, dim amount and **edge
   blur** (`,` / `.`) all have sliders. 📸
7. Press **Escape** (or click the arrow) to hand the app back while keeping the
   drawing on screen. Move the panel if it covers what you are pointing at.
8. Click **✕** in the panel header to finish. The drawing is discarded; it is not saved
   between sessions. **Ctrl+Shift+P** and **Tools → Start Controlling** only ever _open_
   the panel — neither closes it, so a stray press mid-service cannot lose your drawing.

> Note: the panel owns the keyboard only while a tool is **armed** — the same moment it
> owns the pointer. On the **arrow** tool the app keeps every key it normally has (the
> Bible Lookup's Enter and Escape, `F5`–`F10`, `Ctrl+B`, `Ctrl+Z`, slide navigation)
> while `V` `B` `E` `F` `K` still reach in to pick a tool; whatever holds the keyboard
> still wins, as the tool letters defer while you are typing in a field and while a
> screen preview's own draw/spotlight overlay is focused. Arm a tool and the picture
> flips: the overlay covers the **whole** window and the app takes **nothing** — not a
> click, not a key. Every keystroke is swallowed before the app sees it, down to the
> plain ones nothing is bound to: typing goes nowhere, `Space` and the arrows stop
> scrolling, `Tab` stops walking the focus ring, and a dialog behind the overlay stays
> deaf. Only the panel's own keys stay live (`V` `B` `E` `F`, `Escape`, `Ctrl+Z` /
> `Ctrl+Shift+Z` / `C`, which now act on the **drawing**), along with anything typed into
> the panel's own sliders and color box. Escape or the arrow tool hands everything
> straight back. The Undo / Redo / Clear **buttons** work in every tool regardless.

_Verify: coverage rows pending — the matrix lives at `docs/test-paths/coverage-matrix.md`
but has no `PC-xx` (presenting-control) block yet; add one for this workflow._

### W-20 — Show the keys you press (Keyboard Screencast)

**Goal:** let the room see **which keys you are pressing** while you demonstrate the app —
a training session, a screen share, a recorded tutorial. It is the keyboard counterpart to
the drawing in W-19, and it lives in the same panel.

1. Open the **Presenting Control** panel (W-19 step 1: **Tools → Start Controlling**,
   **Ctrl+Shift+P**).
2. In the panel's title bar, click the **keyboard** button (`K`) — it sits between the
   four tools and Undo / Redo / Clear, and lights up while it is on. Nothing appears on
   screen yet; the strip only shows up once you press something.
3. Press any key. A dark strip of key pills appears **across the bottom** of the window,
   above everything else — including your own drawing and the spotlight. 📸
4. The strip keeps the **last six** keys. Pressing the same key over and over collapses
   into one pill with a **×N** counter (`→ ×2`), so a run of arrow presses does not push
   the rest of the strip away. Holding a key down counts as one press.
5. Chords are shown the way the app names them: **Ctrl+Z**, **Esc**, **Space**,
   **↑ ↓ ← →**. Plain typing shows the character you actually typed; a shortcut is shown
   on the en-US key the app binds it to, whatever your layout produces.
6. The strip **clears itself** about a second and a half after your last key, so it is
   never in the way between one demonstration and the next.
7. Click the keyboard button again (or press `K`) to turn it off. **Closing the panel
   turns it off too** — the screencast belongs to the panel, and reopening starts with it
   off again.
8. Picking the **brush**, **eraser** or **spotlight** turns it off as well, and greys the
   keyboard button out until you go back to the **arrow** — an armed tool swallows the
   keyboard (W-19), so there would be nothing left to echo. Turn it back on with `K` or
   the button once the arrow tool is back.

> Notes: the screencast belongs to the **arrow** tool — it narrates the app being driven,
> not a drawing being made. It never takes clicks and never blocks a key: it only
> **echoes** what you pressed. What you type into a **password** field is masked as `•`.

_Verify: coverage rows pending — same `PC-xx` block as W-19 when the matrix lands._

### W-21 — Add a background video or song from a link

**Goal:** get a video (or its audio as an MP3) from an online link straight into your
Videos / Audios folder, without leaving the app or installing anything.

1. Open the **Background** (ផ្ទៃខាងក្រោយ) panel (W-08 step 1) and choose the **Videos**
   (វីដេអូ) tab — or the **♫Audios♫** (សំលេង) split if you want the sound only.
2. **Right-click an empty part of the list** (or use the **+** button in the folder-path
   bar) and choose **Download From URL** (ទាញយកពី URL). 📸
3. A small box asks for the link — **Video URL:** on the Videos tab, **Audio URL:** on
   Audios. If you copied the link first, it is **already filled in**; otherwise paste it.
   The box is outlined red while it is empty.
4. Click **Ok**. The download runs in the background — a full song or video takes a
   couple of minutes, and you can keep using the app while it does.
5. When it finishes, the file **appears in the folder you were in**: the video shows up as
   a new thumbnail in the Videos tab, the audio as a new row under ♫Audios♫. 📸 From there
   it behaves like any other background (W-08) or track (W-09).

> Notes: audio is always converted to **MP3**, video keeps the site's best quality
> (`.webm`/`.mp4`). If a file with that name is already in the folder, the new one is
> saved as `name (1)`. Pasting something that is not a web link gets you an **Invalid
> URL** message and nothing is downloaded. Downloads need an internet connection — and
> a busy site can cut a large download off partway, in which case just try again.

_Verify: MD-01..03, CM-24, PM-102._

---

### W-22 — Build a service playlist (and share it)

**Goal:** collect everything one service needs — songs, slides, verses, backgrounds and
foreground presets — into one running order you can work down live, and hand the whole
thing to another machine.

1. Find the **Playlists** (តារាងកម្មវិធី) panel — it is the lower of the two lists on the
   left, under **Documents** (ឯកសារ). If the list is empty, right-click its empty area (or
   use the **⋮ More Options** button in its title bar) → **New File** to create one. 📸
2. **Drag things onto the playlist's NAME row to add them.** (Dropping onto a _line_ of an
   open playlist does something else — see step 5.) Anything you can present can go in:
   - a **background** — a colour, image, video, camera or website;
   - a **document** — drag its row out of the Documents list;
   - a **single slide** — from the previewer, or from a document already in the playlist;
   - a **Bible verse** — from the Bible list;
   - a **foreground preset** — drag the blue **Show Marquee Top** / **Start Countdown** /
     **Show Time** button itself. Whatever you typed and styled travels with it, so the
     playlist remembers _that_ announcement, not just "a marquee". 📸
   - an **audio track** — drag it out of the **♫Audios♫** (សំលេង) split.

   **Add a screen action.** A running order can also hold something to _do_ rather than
   something to show. Right-click the playlist → **Add Action** (បន្ថែមសកម្មភាព) and pick
   one of **Clear All** (លុបទាំងអស់), **Clear Background** (លុបផ្ទៃខាងក្រោយ), **Clear
   Slide** (លុបស្លាយ), **Clear Bible** (លុបព្រះគម្ពីរ) or **Clear Foreground**
   (លុបផ្ទៃខាងមុខ) — the same five clears as the buttons on each mini screen, and the line
   carries the same `ALL` / `BG` / `SL` / `BB` / `FG` badge so you can tell them apart at a
   glance. It lands at the end of the list; drag it up to where it belongs — say between
   the last song and the sermon. 📸

   Under those five the same menu offers a **finer clear for one foreground widget at a
   time**, so you can take the countdown down and leave the marquee running: **Clear FG
   Marquee Top** (`M↑`), **Marquee Bottom** (`M↓`), **Quick Text** (`QT`), **Countdown**
   (`CD`), **Stopwatch** (`SW`), **Time** (`TM`), **Camera Show** (`CM`) and **Web Show**
   (`WB`). Each does exactly what that widget's own hide button in the **Foreground** panel
   does; the `Time`, `Camera Show` and `Web Show` ones clear all of their items at once.
   The panel's **Background Images Slide Show** has no action of its own — it is a
   _background_ despite sitting in that panel, so **Clear Background** is what stops it.

   **Let the running order walk itself.** The same menu ends with two actions that move
   the RUN on instead of touching a screen: **Next: Interval** (បន្ទាប់៖ រៀងរាល់ចន្លោះពេល)
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

   Both only mean something while that playlist's **preview panel** is open (step 8) —
   that panel is what walks the running order. Click one with the panel closed and the app
   says so (**Open the playlist preview to use this action**) rather than looking as
   though it did something. They never go to a screen, so they have no **Apply on
   Screens** and no **Set Specific Screen**, and nothing can be attached to them.

   **A timeout does not have to be a line of its own.** Attach it to a line instead — a
   slide, a song, a verse — as a **CC element** (step 5), and that line means "show this,
   and go on by yourself N seconds later". Add the **Next: Timeout** once, right-click the
   line you want it on → **Add CC Elements** and pick it, and then you can delete the
   `Next: Timeout` line itself if you only wanted the follower: a CC is a copy. Attached to
   a whole SONG it rides every slide of it, which is how a song advances by itself. Change
   the wait from the CC's own **Change Timing** — seconds or a time of day, exactly as on a
   line of its own. 📸
   **A Next: Interval cannot be attached to anything** and is simply not in that list —
   an interval is not stopped by anything you do, so one riding a slide would keep moving
   the running order on with nothing to call it off but the panel's own pill.

   **Go back, not just forward.** The third one, **Jump to** (លោតទៅ), is how a running
   order reaches a line that is not the next one. Add it, then right-click it →
   **Add CC Elements** and pick the line it should go to — its list is everything in the
   playlist, **a whole song included**, because here the attached line is not something
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

   **Where the actions live in the menu.** **Add Action** lists the five clears, then
   **Other Clear FG Items** — one row that opens the eight per-widget foreground clears —
   then **Screen: Show** / **Screen: Hide**, then the four that drive the run.

3. Click the playlist name to **open it**. Each element is one short line: an icon for
   what it is, its id, and its name. A **document** line has its own arrow — open it to
   see that document's slides underneath. 📸
4. **Click an element to put it on the screen** (a document opens its previewer instead;
   an **audio track** opens the **♫Audios♫** split and flashes the track there — the
   playlist never plays audio itself, so that you keep the panel's safeguards like
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
     You can also drag a line **already in the playlist** — a clear action included — onto
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
     only way to put it anywhere but the end of the list, since dropping on the playlist's
     name adds to the end.
   - **right-click the line → Add CC Elements** (បន្ថែមធាតុ CC) and pick from the other
     lines already in this playlist. 📸

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
     view and flashes it — in the playlist and in the preview window at once — so you can
     always find what a short label refers to.
   - Right-click a CC line for **Remove CC Element** (ដកធាតុ CC ចេញ). There is no
     **Disable** on a CC: parking takes a _line_ out of the running order, and a CC is not
     a line of the running order — one you do not want is simply removed. (So attaching a
     line you have parked gives you a CC that _does_ fire, while the parked line itself
     stays parked.) A whole document and an audio track cannot be CC elements — neither
     reaches a screen — and the app says so if you try.

   An element can hold as many CC elements as you like; a CC element cannot have CC
   elements of its own.

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
   parking is remembered in that playlist only — the same song stays live in your other
   services.
   **Two kinds of greyed-out line, and they now look different.** A line YOU parked here is
   crossed out and carries the amber 🚫 ("This item is disabled in this playlist"). A slide
   that is greyed out because the **document itself** hides it is *not* crossed out and
   carries a plain grey 👁‍🗨 ("This item is disabled in its document") — right-clicking that
   one will not bring it back, because a running order cannot re-enable what the document
   turned off; open the document and enable the slide there. In the preview panel the same
   two marks sit in the **bottom-left corner** of each dimmed thumbnail. 📸

6. Right-click an element for **Move up** / **Move down**, **Choose Color** (ជ្រើសរើសពណ៌)
   to group your running order by colour, or **Remove from Playlist**. To move a line a long
   way, use **Move to Top** (ផ្លាស់ទីទៅលើគេ) or **Move to Bottom** (ផ្លាស់ទីទៅក្រោមគេ) instead of
   clicking **Move up** over and over — the line jumps straight to that end and everything
   else keeps its order. (A line that is already at the top is not offered **Move up** or
   **Move to Top**, and one already at the bottom is not offered **Move down** or
   **Move to Bottom**.) **Duplicate** (ស្ទួន) puts a copy of the line **directly below** it,
   with its colour, its pinned screens and its parked slides already on the copy — the quick
   way to sing a song twice in one service, then change only the second one. The two copies
   are separate from then on: parking or recolouring one leaves the other alone. 📸
   You can also drag a
   line up or down **inside the same playlist** (dragging a line into a _different_
   playlist does nothing — add it there from its own list instead). A colour shows as a
   stripe down the left edge of the line and a dot at its right end; the lines stay in
   your running order — they are never re-sorted into colour groups, because the order
   _is_ the meaning here. The colour belongs to that playlist alone, so the same song can
   be marked differently in two services. Changes are saved as you make them — there is
   **no save button** anywhere in this panel.
7. Whatever is **live on the screen right now** is marked with a green `*` — on the
   element itself, on the document it belongs to, on the playlist, and on the
   **Playlists** heading — so you can see at a glance where you are in the running order.
8. Not sure which "5.jpg" a line means? Right-click it → **Reveal Original**
   (បង្ហាញកន្លែងដើម) — the app scrolls to the real item elsewhere in the window and
   flashes it. This works on the slides inside an opened document too. A colour or a
   camera has no original to point at, and the panel holding the original has to be
   open already.
9. To see the whole service at a glance, click the **window** icon on the playlist row (or
   right-click → **Open Preview**). A floating panel shows every element with its real
   preview — slides look exactly as they will project, and a document shows all of its
   slides. Collapse the ones you are not working on — or fold the whole running order
   away at once with the **Collapse All** (បង្រួមទាំងអស់) icon at the bottom-right of the
   panel, and open it all again with **Expand All** (ពង្រីកទាំងអស់) beside it. Whichever
   of the two has nothing left to do fades out. Whatever you folded away is remembered for
   that playlist, so a running order trimmed down to the few things you are working on
   comes back that way next time — and it follows the element, not its position, so
   reordering the list does not shuffle what is folded. 📸
   To make the thumbnails bigger or smaller, use the zoom slider in the panel's footer
   (it tucks itself away into a **⋯** button at the bottom-left), **Ctrl + scroll**, or a
   two-finger **pinch**. This zoom is remembered separately from the one in the middle
   Documents tab.
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
   Playlist**, gated exactly as they are in the list. So you can tidy and re-order the
   running order from the panel you are actually watching during the service, without
   going back to the list — and the list behind it follows immediately. 📸
   Two things inside a box keep menus of their own, because they are not the element:
   a **slide thumbnail** gets the slide's menu (**Reveal Original**, **Show on Screens**,
   **Set Specific Screen**, **Disable**, **Add CC Elements**), and a **CC line** gets its
   short one (**Reveal Original**, **Set Specific Screen**, **Remove CC Element**).

**Sharing it with another machine**

10. Right-click the playlist → **Export** (នាំចេញ). You get one
   `<name>.owapl.tar.gz` file in your **Downloads** folder, and the folder opens. It
   contains the playlist _and every file it needs_ — the full documents behind your
   slides, the images and videos, and any background attached to those documents.
11. On the other machine, right-click an empty part of the **Playlists** list → **Import**
    (នាំចូល) and pick that file — or just **drag the `.owapl.tar.gz` file from your file
    manager onto the Playlists list**, which imports it the same way. The songs, documents
    and media are re-created in that machine's own folders, Bible verses are added to the
    **Default** list, and every link inside the playlist is re-pointed at the local
    copies. 📸
12. If the bundle is on a web server or a machine sharing it over the local network,
    you can skip copying the file about: right-click the **Playlists** list →
    **Import From URL** (នាំចូលពី URL), paste the link and press **Ok**. (If the link is
    already on your clipboard it is filled in for you.) The app downloads the bundle to a
    temporary folder, imports it exactly as above and then deletes the download — you end
    up with the playlist and nothing else left over. A plain `http://…` address with a
    port, such as one served off another laptop, works as well as `https://`. 📸

> Notes: a file that is already there **with the same contents** is reused rather than
> duplicated, so importing the same bundle twice is safe. If a file of the same NAME is
> already there but is actually a different file — your own `a.mp4` is not the `a.mp4`
> in the bundle — yours is left untouched and the bundled one is added beside it as
> `a (1).mp4`, with the playlist pointed at that copy. Slides and documents are
> stored as _references_, so editing a song later means the playlist projects the new
> words. Colours and cameras carry no file, so there is nothing to bundle for them.
>
> A video placed **inside a slide** travels too: the bundle carries the video file and
> the imported slide is re-pointed at the local copy, so it plays on the other machine.
> (Images placed in a slide are stored inside the slide itself, so they always travelled.)
>
> Importing needs the folders it will write into to be **chosen already** — if, say, no
> Videos folder has been picked yet and the bundle carries a video, the import stops
> before it copies anything and tells you which folder to choose first. Nothing is
> half-imported. And if a line in a playlist ever shows a warning triangle reading
> **Invalid item**, that one entry is damaged (usually a hand-edited file) — the rest of
> the running order still works; remove that line and re-add it.

_Verify: PL-10, PL-29, PL-32..PL-76, PL-81..PL-96._

---

### W-23 — Share one document (song, sermon slides, PDF) with another machine

Sometimes you only want to hand over **one** item, not a whole service. A document
travels as its own bundle, with everything attached to it.

1. In the **Documents** list, right-click the item you want — an Open Worship slide
   document, a lyric, a PDF, a PowerPoint or a Word file all work — and choose
   **Export** (នាំចេញ). 📸
2. You get one `<name>.owadoc.tar.gz` file in your **Downloads** folder, and the folder
   opens. It contains the document itself plus everything hanging off it: the background
   you attached to it (and that background's image or video file), any video placed
   inside its slides, and its colour note.
3. On the other machine, right-click an empty part of the **Documents** list →
   **Add Items** → **Import** (នាំចូល) and pick that file — or just **drag the
   `.owadoc.tar.gz` file from your file manager onto the Documents list**, which imports
   it the same way. 📸
4. The document appears in that machine's documents folder under its original name, with
   its background re-attached and its colour note restored, so it is ready to present
   straight away.
5. If the bundle is on a web server or a machine sharing it over the local network, use
   **Add Items** → **Import From URL** (នាំចូលពី URL) instead and paste the link. The
   download goes to a temporary folder, is imported exactly as above, and is then
   deleted.

> Notes: the same rules as a playlist bundle apply. A file already there **with the same
> contents** is reused rather than duplicated, so importing twice is safe; a file of the
> same NAME that is actually a different file is left untouched and the bundled one lands
> beside it as `a (1).pdf`. A document that already has a background attached keeps its
> own — an import never overwrites it, and it does not overwrite that document's colour
> note either. Importing needs the folders it writes into to be **chosen already** (for a
> document with a video background, the Videos folder too), and if one is missing the
> import stops before copying anything and tells you which to choose.
>
> If you export the same document twice, the second file is named
> `<name>.owadoc.tar (1).gz`. That name no longer ends in `.owadoc.tar.gz`, so dragging
> _that_ copy onto the list will not import it — use **Add Items → Import** and pick it
> instead (or rename it first).

_Verify: PL-77..PL-80, CM-36, CM-37._

> This works for a **lyric** too — a lyric is a row in the same Documents list. Its
> bundle carries the lyric plus every background you attached to its slides, so the song
> arrives on the other machine already looking the way you set it up.

---

### W-24 — Share a bible list with another machine

A bible list (the verses you lined up for a service) travels the same way.

1. In the **Bibles** panel, right-click the list you want and choose **Export**
   (នាំចេញ). You get one `<name>.owbible.tar.gz` file in your **Downloads** folder. 📸
2. The bundle is small: a bible list stores verse _references_, not the Bible text, so
   only the list and any background you attached to it (or to one of its verses) are
   inside.
3. On the other machine, right-click an empty part of the **Bibles** panel → **Import**
   (នាំចូល) and pick the file — or **drag the `.owbible.tar.gz` onto the Bibles panel**.
   **Import From URL** (នាំចូលពី URL) works here too. 📸
4. The list appears in that machine's bibles folder with its verses, their colours and
   its background, ready to present.

> Notes: the Bible **versions** the verses name are not part of the bundle — they are
> large, separately downloaded files. If the other machine does not have a version yet,
> download it there (Settings → Bible) and the verses show up. The **Bible Reader** page
> keeps its own bibles folder, so importing there adds the list to the reader's folder,
> not the presenter's.
>
> A bundle can only be imported by the list it came from: picking a document bundle in
> the Bibles panel (or a bible bundle in the Documents list) is refused with a message
> naming what the file actually holds, and nothing is written.

_Verify: PR-27..PR-29, CM-38, CM-39._

---

### W-25 — Back up everything, or move to a new computer

W-22 to W-24 each carry one thing. To take **all** your material at once — for a backup,
or to set up a second machine — use the app's **File** menu.

1. Open the **File** menu at the top of the window and choose **Export Data**
   (នាំចេញទិន្នន័យ). 📸
2. A panel lists every data folder you have set up — Documents, Playlists, Background
   Images, Videos and Audios, Bible Present, Bible Reader and Notes — with the folder each
   one points at. **They all start ticked.** Untick anything you do not want (the videos
   folder is usually the big one), or use **Select All** / **Deselect All**. 📸
3. Press **Ok**. You get one `open-worship-data.owadata.tar` file in your **Downloads**
   folder, and the folder opens. Copy it to a USB stick or the other machine.
4. On the other machine, choose **File → Import Data** (នាំចូលទិន្នន័យ) and pick that
   file. The panel now lists only the folders the file actually contains — again all
   ticked — so you can restore just the songs, or just the backgrounds. 📸
5. Press **Ok**. When it finishes you are told how many files were brought in and how
   many were already up to date.

> Notes: this is a **copy, not a replacement**. A file already on the machine with the
> same contents is left alone, so importing the same backup twice changes nothing and is
> safe to repeat. If a file has the same NAME but different contents — you edited the song
> on this machine — **your version is kept** and the one from the backup is added beside
> it as `song (1).ows`, for you to compare and delete whichever you do not want. Nothing
> is ever overwritten.
>
> Importing writes into the folders **this** machine has set up, so choose them first
> (Settings → Path Settings). If one of them has no folder yet, the import stops before
> copying anything and tells you which to set.
>
> The backup leaves out the working files the app can rebuild by itself — a document's
> undo history and the page images made for PDF/PowerPoint/Word previews — so it stays
> much smaller than the folders themselves, and those are regenerated on the other
> machine the first time you open the document.

_Verify: NAV-17..NAV-19._

---

## Keyboard shortcut reference (tutorial appendix)

| Keys                                 | Does                                                                    | Where                                                                 |
| ------------------------------------ | ----------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `Ctrl+B`                             | Open Bible Lookup                                                       | Presenter / Editor                                                    |
| `Ctrl+Q`                             | Close the open dialog                                                   | any dialog                                                            |
| `F5`                                 | Show / hide the presentation screen                                     | Presenter                                                             |
| `F6` / `F7` / `F8` / `F9` / `F10`    | Clear All / Background / Slide / Bible / Foreground                     | Presenter                                                             |
| `Ctrl/Alt+ArrowLeft/Right`           | Previous / next Bible verse                                             | the output screen                                                     |
| Arrows, `PageUp`/`PageDown`, `Space` | Move through slides / toggle                                            | slide thumbnails focused                                              |
| `Tab` / `Escape` / `Ctrl+Escape`     | Complete / clear / clear-part in bible input                            | lookup & reader                                                       |
| `Ctrl+Enter`                         | Focus the editing canvas                                                | Slide Editor                                                          |
| `Ctrl+S`                             | Save                                                                    | all editors                                                           |
| `Enter` / `Escape`                   | Confirm / cancel                                                        | confirmation dialogs                                                  |
| `Ctrl+Shift+P`                       | Open Presenting Control (draw & spotlight on the app); close with its ✕ | Presenter                                                             |
| `V` / `B` / `E` / `F`                | Arrow / brush / eraser / spotlight                                      | Presenting Control open (not while typing)                            |
| `Ctrl+Z` / `Ctrl+Shift+Z` / `Ctrl+Y` | Undo / redo the drawing                                                 | Presenting Control **armed** (buttons work in any tool)               |
| `C`                                  | Clear the drawing (one Undo brings it back)                             | Presenting Control **armed** (button works in any tool)               |
| `Escape`                             | Back to the arrow tool                                                  | Presenting Control **armed** (the app keeps Escape otherwise)         |
| `K`                                  | Show / hide the Keyboard Screencast                                     | Presenting Control on the **arrow** tool (an armed tool turns it off) |
| _every other key_                    | Nothing — swallowed by the overlay                                      | Presenting Control **armed**                                          |

_Verify: KB-01..13, SC-03._
