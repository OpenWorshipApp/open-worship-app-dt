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

**workflowsVersion: 2026-08-04l** (bump when any workflow changes) — **W-22**'s sharing
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
lyric/document *creation* step — the Documents list offers **New App Document** and
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
- **Left column:** your content libraries — **Documents** (ឯកសារ) and **Lyrics**
  (អក្សរភ្លេង) lists.
- **Middle column:** the working area — **Documents / Lyrics / Bibles / Foreground**
  preview tabs on top, and the collapsible **Background** panel at the bottom.
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

1. In the left column, click a song in the **Lyrics** (អក្សរភ្លេង) list — the middle
   area switches to the **Lyrics** tab and shows its verses. 📸
2. **Double-click** a verse to send it to the screen.
3. Press **F8** / the clear button to take it down.

_Verify: PL-07..08, PM-11._

### W-06 — Look up and present a Bible verse

**Goal:** find a verse fast and put it on screen.

1. Press **Ctrl+B** (or click **Bible Lookup** / ស្វែងរកព្រះគម្ពីរ in the header). The
   lookup opens as a popup dialog. 📸
2. The input is a **step-by-step picker**: type the first letters of the book (e.g.
   `Joh`) and click the book, then pick the chapter, then the verse. Press **Tab** to
   auto-complete the current part; **Escape** clears the input.
   > Note: typing a full reference like `John 3:16` in THIS dialog only filters the
   > book list — for full-reference typing use the **Bible Reader** page (W-10).
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
2. Type a reference — here a **full reference** like `John 3:16` resolves straight to
   the verse. The picker keys still work (**Tab** complete, **Escape** clear,
   **Ctrl+Escape** clear one part).
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

**Lyrics:** right-click a song in the Lyrics list → **edit** — the Lyric Editor opens
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
2. **Drag things onto a playlist row to add them.** Anything you can present can go in:
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
   because there is nothing of it on the screen to be live.
5. Right-click an element for **Move up** / **Move down**, **Choose Color** (ជ្រើសរើសពណ៌)
   to group your running order by colour, or **Remove from Playlist**. You can also drag a
   line up or down **inside the same playlist** (dragging a line into a _different_
   playlist does nothing — add it there from its own list instead). A colour shows as a
   stripe down the left edge of the line and a dot at its right end; the lines stay in
   your running order — they are never re-sorted into colour groups, because the order
   _is_ the meaning here. The colour belongs to that playlist alone, so the same song can
   be marked differently in two services. Changes are saved as you make them — there is
   **no save button** anywhere in this panel.
6. Whatever is **live on the screen right now** is marked with a green `*` — on the
   element itself, on the document it belongs to, on the playlist, and on the
   **Playlists** heading — so you can see at a glance where you are in the running order.
7. Not sure which "5.jpg" a line means? Right-click it → **Reveal Original**
   (បង្ហាញកន្លែងដើម) — the app scrolls to the real item elsewhere in the window and
   flashes it. This works on the slides inside an opened document too. A colour or a
   camera has no original to point at, and the panel holding the original has to be
   open already.
8. To see the whole service at a glance, click the **window** icon on the playlist row (or
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
   the mouse. (A folded-away document is passed over instead; unfold it to walk it.) An
   audio track is skipped, and the last element is the end — it does not start over. The
   keys work while you are in this panel; click into the slides list and they drive that
   list again, as before. 📸
   **A screen action is stopped on and fired** like anything else — so putting a
   **Clear All** between the last song and the sermon means one more press of the same
   key blanks the screen at exactly that point in the running order.

**Sharing it with another machine**

9. Right-click the playlist → **Export** (នាំចេញ). You get one
   `<name>.owapl.tar.gz` file in your **Downloads** folder, and the folder opens. It
   contains the playlist _and every file it needs_ — the full documents behind your
   slides, the images and videos, and any background attached to those documents.
10. On the other machine, right-click an empty part of the **Playlists** list → **Import**
    (នាំចូល) and pick that file — or just **drag the `.owapl.tar.gz` file from your file
    manager onto the Playlists list**, which imports it the same way. The songs, documents
    and media are re-created in that machine's own folders, Bible verses are added to the
    **Default** list, and every link inside the playlist is re-pointed at the local
    copies. 📸
11. If the bundle is on a web server or a machine sharing it over the local network,
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

_Verify: PL-10, PL-29, PL-32..PL-76._

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
