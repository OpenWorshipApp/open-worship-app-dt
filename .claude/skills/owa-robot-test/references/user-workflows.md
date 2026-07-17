# OWA User Workflows — the tutorial source of truth

Canonical, **user-facing** task recipes for Open Worship App. Each workflow is written
in tutorial voice ("Click **X**, you should see **Y**") so it can be converted 1:1 into
a help page, and each is **traceable** (`Verify:` line) to
[coverage-matrix.md](./coverage-matrix.md) row IDs so a robot run can prove every step
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

**workflowsVersion: 2026-07-16** (bump when any workflow changes)

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

*Verify: GL-12, NAV-01..02, PL-01, PR-04.*

### W-02 — Switch between the main pages

**Goal:** move between Presenter, Bible Reader, and Slide Editor.

1. Click a header tab — the window switches to that page in place.
2. **Slide Editor** only opens when a slide document is selected; otherwise the app
   shows an alert ("No slide selected") and stays put. Select a document in the left
   list first (W-03).

*Verify: NAV-01..04.*

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

*Verify: PL-01, PM-05..09, KB-05, KB-08.*

### W-04 — Auto-play slides on a timer

**Goal:** advance slides hands-free.

1. Open a document's slides (W-03 step 1).
2. Click the **stopwatch icon** in the Documents-tab footer — the auto-play widget
   expands. 📸
3. Type the interval in seconds, then click **play**. Slides advance on the timer.
4. Click **pause** to stop, or the red **✕** to close the widget.

*Verify: PM-10.*

### W-05 — Present song lyrics

**Goal:** put a song's lyrics on the screen.

1. In the left column, click a song in the **Lyrics** (អក្សរភ្លេង) list — the middle
   area switches to the **Lyrics** tab and shows its verses. 📸
2. **Double-click** a verse to send it to the screen.
3. Press **F8** / the clear button to take it down.

*Verify: PL-07..08, PM-11.*

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

*Verify: NAV-06..07, RD-02, PM-12, PR-02, KB-01..02, KB-06, KB-09.*

### W-07 — Style the on-screen Bible text

**Goal:** change how verses look on the screen.

1. Open the middle **Bibles** (ព្រះគម្ពីរ) tab.
2. Open its settings split — the **Appearance** and **Text Shadow** cards. 📸
3. Adjust a control (size, color, shadow); the mini screen updates live.

*Verify: PM-13..14.*

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
   - **Web:** click a saved page, or **+** to add one (opens the Web Editor, W-15).
3. The live background's tab shows a `*` prefix (e.g. `*Videos`).
4. Press **F7** (Clear Background) to remove it.

*Verify: PM-26..33, KB-04.*

### W-09 — Play audio, and foreground extras (countdown, clock, marquee bottom…)

**Goal:** run service extras.

**Audio:** in the Background panel, toggle the **Audios** (សំលេង) tab open, click play
on a track — the tab is marked while playing; click stop to end. 📸

**Foreground widgets** — open the middle **Foreground** (ផ្ទៃខាងមុខ) tab; each widget
has its own controls and a Show/Start button:

- **Marquee Top:** type the scrolling text, click Show — it scrolls along the top edge.
- **Marquee Bottom:** type the scrolling text, click Show — it scrolls along the bottom
  edge. Top and bottom can be shown at the same time.
- Both marquees expose a **scroll speed** (%) under *Properties*: `100%` is the default
  pace, higher is faster, lower is slower. Changing it while a marquee is showing
  re-paces it without having to click Show again.
- **Quick Text:** type a short message, click Show.
- **Countdown:** two modes — *to a date/time* (set date + time, press Start) or *for a
  duration* (set hours/minutes, press Start). Hide with its Hide button. 📸
- **Stopwatch**, **Clock**, **Images slideshow**, **Camera overlay**, **Web overlay**:
  same pattern — configure, Show, Hide.
- The shared properties row (font size / color / position) restyles the live widget.
- Power move: **drag** a widget's Show button and **drop it on the mini screen** to
  start it there; **right-click** the button to choose a specific display.

Press **F10** (Clear Foreground) to clear all foreground widgets, or **F6** to clear
everything at once.

*Verify: PM-15..25, PM-28, PM-34, KB-03, KB-07.*

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

*Verify: PR-04..07, SP-01..09, KB-03..07, KB-13.*

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

*Verify: RD-01..07, RD-11.*

### W-12 — Search the whole Bible (Bible Find)

**Goal:** find verses by words, not reference.

1. In the Bible Reader (or the lookup dialog), open the **advanced lookup** toggle —
   a second panel ("Bible Online Lookup") appears beside the picker. 📸
2. Type your search words. Matching verses list page by page; click the **page
   numbers** to browse. 📸
3. Click a result to open that verse.

*Verify: RD-08..09.*

### W-13 — Cross references

**Goal:** see related verses.

1. With a verse open, open its **cross references** view — related passages are
   listed; click one to read it. 📸
2. AI-generated cross references require an API key configured in Settings; without
   one, only the built-in references appear.

*Verify: RD-10.*

### W-14 — Keep Bible notes

**Goal:** attach your own notes to study.

1. In the right column (Presenter) or the Reader, switch to the **Notes**
   (កំណត់ត្រាព្រះគម្ពីរ) sub-tab.
2. Open a note for editing — the **Bible Note** editor opens in its own window. 📸
3. Type your note and save (**Ctrl+S**).

*Verify: PR-03, PU-03, KB-11.*

---

## Creating & editing content

### W-15 — Create and edit slides / lyrics / web backgrounds

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

*Verify: ED-01..11, PU-02, PU-04, PL-09, PM-33.*

---

## Configuration

### W-16 — Settings: language, theme, fonts, folders

**Goal:** configure the app.

1. Click the **gear** (ការកំណត់) in the header — Settings opens in its own window. 📸
2. **General** tab:
   - **Language:** click **Khmer** or **English** — the whole UI switches immediately.
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

*Verify: ST-01..09, LT-02..04.*

### W-17 — Find text anywhere (Finder) & About

- **Finder:** opens in its own small window — type a query, jump between matches with
  the prev/next arrows or **Enter**; toggle case-sensitivity with its checkbox. 📸
- **About:** shows the app version and project links.

*Verify: PU-01, PU-05.*

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

*Verify: SP-04..05, SP-10..12.*

---

## Keyboard shortcut reference (tutorial appendix)

| Keys | Does | Where |
|---|---|---|
| `Ctrl+B` | Open Bible Lookup | Presenter / Editor |
| `Ctrl+Q` | Close the open dialog | any dialog |
| `F5` | Show / hide the presentation screen | Presenter |
| `F6` / `F7` / `F8` / `F9` / `F10` | Clear All / Background / Slide / Bible / Foreground | Presenter |
| `Ctrl/Alt+ArrowLeft/Right` | Previous / next Bible verse | the output screen |
| Arrows, `PageUp`/`PageDown`, `Space` | Move through slides / toggle | slide thumbnails focused |
| `Tab` / `Escape` / `Ctrl+Escape` | Complete / clear / clear-part in bible input | lookup & reader |
| `Ctrl+Enter` | Focus the editing canvas | Slide Editor |
| `Ctrl+S` | Save | all editors |
| `Enter` / `Escape` | Confirm / cancel | confirmation dialogs |

*Verify: KB-01..13, SC-03.*
