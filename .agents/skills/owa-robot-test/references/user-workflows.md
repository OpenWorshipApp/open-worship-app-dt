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

**workflowsVersion: 2026-09-26a** (**W-42 and W-46 — the Reader gains seven more
working zero-model demos, and broader Tips.** The empty Reader assistant now
offers 30 deterministic practice choices: the added choices type a complete
reference, remove one reference part, toggle automatic Bible audio, filter or
sort notes, and open Settings or Help. All Tips now has 61 Reader lessons,
including whole-panel and separate saved-Bibles/Bible-Notes visibility
guidance; those three stay self-guided because live testing proved an open pane
is a labeled container, not a pressable toggle. The old no-op whole-panel shelf
entry was retired, so the shelf grows by six while gaining seven working
actions. Thirty lessons begin with a safe action.
CB-77 and GL-25 expanded.)

Previous: **workflowsVersion: 2026-09-26** (**W-46 — the automatic Tip of the Day waits five minutes.**
Reported with a picture of the card over the Presenter's top-right controls at launch:
_"Tip of the Day should be delay at least 5 minutes at app launch"_. The card now
appears five minutes after the app starts, counted from the launch, so a reload or a
Presenter/Reader switch does not restart the wait; **Help → Tips of the Day** is not
delayed, and a tip opened from Help stands in for that launch's automatic one. GL-25
expanded.)

Previous: **workflowsVersion: 2026-09-25h** (**W-09 — a session's _Properties_ act on that session's OWN overlay.** Reported straight after the strip landed: _"each session should have its own properties"_ / _"`Properties` should be controlled per session"_. The values were already filed per session, and the panel already showed the right ones — what leaked was the live restyle: the refresh walked every overlay of that kind, so nudging Session 2's size or colour re-dressed the countdown Default had on the wall. It now walks only the entries that session owns. The Hide row is deliberately left alone: it reaches whatever is live from whichever session is in front, because there must always be a way to take something off a projector. Proven live 2026-09-25 by reading the screen's own saved style — Default's overlay held `opacity: 0.91` through a change to Session 2's, and followed a change to Default's. PM-146.)

Previous: **workflowsVersion: 2026-09-25g** (**W-09 — EVERY foreground component keeps sessions now, not only the four that show a file.** Asked for directly, pointing at the **[en:tran:Video Show]** panel's own **Default / ＋** strip and circling the components in the launcher menu: _"I like the idea of multiple session, add this feature in the highlighted components"_. **[en:tran:Messages]**, **[en:tran:Marquee Top]**, **[en:tran:Marquee Bottom]**, **[en:tran:Quick Text]**, **[en:tran:Countdown]**, **[en:tran:Stopwatch]** and **[en:tran:Time]** now carry the same strip, each session holding that panel's own words or numbers AND its own _Properties_ — so the pre-service notice board and the mid-service alert sit side by side, already the right size in the right corner, instead of one being retyped over the other. **Default** still writes the very keys the widget always has, so nothing already set up moves. Verified live 2026-09-25 on the presenter: a second Messages session written to its own keys with Default's two editors untouched, both sessions' messages on one screen at once with each one's own Hide button, and the **[en:tran:Marquee Bottom]** slot handed from Session 2 back to Default with the on-screen dot moving with it. PM-146, PM-147.)

Previous: **workflowsVersion: 2026-09-25f** (**W-08 — every background media tab keeps FOLDER SESSIONS.** Asked for directly, from the foreground **[en:tran:Image Show]** widget that already had them: _"I want this feature for Background Image, Background Video and Background Web… let user feel convenience to handle medias in different folders without changing the default selection"_, then Background Audio too. **[en:tran:Images]**, **[en:tran:Videos]**, **[en:tran:Webs]** and **[en:tran:Audios]** now carry the same **Default / ＋** strip, each session holding its own folder, view mode, sort and slide show, with **Default** still the folder Path Settings names. The strip and the slide show share ONE short row — the rail is the height of the slide-show pill now, in the foreground widgets too, which gives a 200px panel back most of a row of pictures. Verified live 2026-09-25 on the presenter: a second Images session written to its own folder key with Default's untouched, the strip surviving an empty folder, and the foreground widgets unchanged. PM-144, PM-145.)

Previous: **workflowsVersion: 2026-09-25e** (**W-15 — a canvas box can cast a **[en:tran:Shadow]**, and there are two kinds.** Asked for directly. It sits under **[en:tran:Shape Properties]** with Glass Effect, Round and Blend Mode. **[en:tran:Box Shadow]** is the shadow of the box itself, rounded corners included — right for a text box with a backing colour; **[en:tran:Drop Shadow]** follows what is actually painted, so it hugs the letters of a box with no backing and the cut-out edge of a logo picture. How far it falls (**X:** / **Y:**), how soft it is (**[en:tran:Blur:]**) and its colour are shown only once a shadow is picked; **[en:tran:No Shadow]** takes it off again and leaves nothing behind. Verified live 2026-09-25 in the Document Editor on a text box: the box shadow a slab under the box, the drop shadow the ghosted words, both the same in the canvas and in the slide thumbnail. ED-48.)

Previous: **workflowsVersion: 2026-09-25d** (**W-09 and W-47 — an overlay is DRESSED under
[en:tran:Effects].** Reported with a picture of the Messages panel: the words in a
message sat hard against the edge of their own coloured box, and nothing in
_Properties_ could move them. Every foreground component now carries an
**[en:tran:Effects]** fold holding a **[en:tran:Border]**, a
**[en:tran:Shadow]** and **[en:tran:Padding]** — and, wherever the component
shows words, **[en:tran:Text Align]**, **[en:tran:Line Height]**,
**[en:tran:Letter Spacing]**, a **[en:tran:Text Shadow]** (Soft / Glow /
Outline, for a notice over a moving video) and **[en:tran:Text Style]**. Padding
and the text measures are in text sizes, so a box keeps its shape when the font
size changes; stacked messages now count the padding and the frame, so they still
sit one under another. Verified live 2026-09-25 on the dev Presenter and its real
output window, in English and in Khmer.)

Previous: **workflowsVersion: 2026-09-25c** (**W-47 — Messages is a session of message
editors.** It shipped as two widgets (Alert, Announcements), was merged on
sight, and the merged one was still one text box where a message could not span
lines. Each message now has its OWN editor with its own show / move / remove,
a message can be as many lines as it needs, several can be on a screen at once
and they stack instead of covering each other, and
**[en:tran:Show All Messages]** puts the whole session up — as one block, or
one at a time with **[en:tran:Rotate]**. **[en:tran:Mask]** is unchanged.
Verified live 2026-09-25 on the dev Presenter and its real output window: two
multi-line messages up together, laid out one under the other; hide and
re-show; and the bars covering a full-screen video overlay. Not
keystroke-verified: the **F4** toggle, which is code only.)

Previous: **workflowsVersion: 2026-09-24d** (**W-46 — native-menu learning now covers every
menu from File through Help.** Presenter grows from 56 to 61 lessons and Reader
from 49 to 54. Five searchable, self-guided overviews name every command under
**File**, **Edit**, **Tools**, **Window**, and **Help**; the seven detailed
**View** lessons remain. Conditional and macOS-only commands are included. GL-25
expanded.)

Previous: **workflowsVersion: 2026-09-24c** (**W-15 — every canvas item kind carries a
[en:tran:Blend Mode].** It sits under **[en:tran:Shape Properties]** in the item's
**[en:tran:Properties]**, beside Glass Effect and Round, and offers the same modes the
foreground widgets do. It blends with the canvas items UNDER IT IN THE SAME SLIDE, not
with the background attached to the slide: a lone blended box shows no change at all,
so the recipe says to put a picture or video box behind it sized **[en:tran:Full]**.
Verified live 2026-09-24 on two overlapping boxes with **[en:tran:Difference]**.
ED-47.)

Previous: **workflowsVersion: 2026-09-24b** (**W-09 — the component panel is just the component,
and the menu is the status board.** No card header inside a panel any more: the floating
panel's own bar already carries the name, the on-screen mark and Close, and the panel is
now the ONE scroller, so the file grid fills it instead of stopping half way with the
slide-show bar floating over the last row. That bar moved INTO the sticky row beside the
sessions, _Properties_ and the screen buttons; **[en:tran:Start Slide Show]**,
**[en:tran:Stop Slide Show]** and **[en:tran:Hide Slide Show Controls]** are named
controls now rather than unnamed icons. Each session button carries its own on-screen dot
and a ▶ while its show runs; the chooser menu carries the **screen numbers** and the same
▶, and a row answers to its component's exact name. Removing a session takes its overlay
off the screens first. The slide show no longer scrolls the file list under you.
Verified live 2026-09-24. PM-128..PM-131.)

Previous: **workflowsVersion: 2026-09-24a** (**W-09 — the Foreground is a menu of components, each
in its own panel.** The Foreground tab now opens a context menu AT THE CURSOR; a picked
component opens in its own floating panel that remembers size and place, and several can
be open at once. `Background Images Slide Show` is gone -- **Image Show** does that job
on the foreground layer. Every component gained **Always on Top** with a z-index number.
Verified live 2026-09-24. PM-128..PM-131.)

Previous: **workflowsVersion: 2026-09-24** (**W-09 — Video Show and Image Show, sessions, and a
blend mode for every foreground overlay.** Two new Foreground widgets put a clip or a
picture OVER the slide, and Web Show joins them on the same shape: the Background tabs'
WINDOWED grid (a folder of 3 058 files mounts ~54 tiles), ONE Properties panel per
widget, and **sessions** — each its own folder, Properties and slide show, so one Image
Show can run a slide show over one folder while another holds a logo from another, both
on screen. A session's slide show runs OUTSIDE React, so it keeps going while another
session is being looked at and stops itself when its item is cleared. Video, Image,
Camera and Web Show gained a **Blend Mode** picker offering all 16 CSS blends, grouped:
a snow clip shot on black is shown with **Screen Blend** and only the snow lands over
the live slide. Verified live 2026-09-24 on the real `screen.html?screenId=1` output —
the clip's band let the slide text show through, lightened, instead of covering it.
PM-128..PM-131 new.)

Previous: **workflowsVersion: 2026-09-23e** (**W-46 — Presenter Show it is resilient and
actionable.** Fifty-one of 56 lessons begin with a safe **Do it**; mixed lessons
then switch to **Next**, and stale long-running MCP catalogs receive the current
lesson inline instead of failing. Five disruptive/native-menu-only lessons stay
self-guided. GL-25 expanded.)

Previous: **workflowsVersion: 2026-09-23d** (**W-46 — the Presenter learning library now
covers 56 topics.** Twenty-four deterministic walkthroughs point at safe app
controls; 32 self-guided lessons cover presenting, screens, backgrounds and
media, service planning, help, and every native View command without changing
congregation output or running disruptive menu actions. GL-25 expanded.)

Previous: **workflowsVersion: 2026-09-23c** (**W-46 — automatic Tips of the Day can be restored from Settings.**
After **Don't show again**, open **Settings → General → Other General Options** and turn
on **Show Tips of the Day automatically**. The shared Presenter/Reader setting takes
effect on the next app launch. GL-25 expanded.)

Previous: **workflowsVersion: 2026-09-23b** (**W-45 expanded — every visible lyric stage can
now be exported as its own PowerPoint file.** Select a lyric, open the Stage Previewer
header menu, and choose **Export to PPTX**; the app writes one deck per visible stage,
preserving that stage's layout and style. Verified live 2026-09-23 with Stage 0 and
Stage 1: both nine-slide packages opened without repair and retained their distinct
lyric/chord layouts. PL-106 expanded.)

Previous: **workflowsVersion: 2026-09-23a** (**W-46 — the Reader learning library now
covers 49 topics across the complete page and native View menu.** Search and
topic labels keep the expanded catalog navigable; the original 24 safe demos
remain featured in the Assistant, while the additional lessons cover reference
shortcuts and history, passage/version actions, study results, names, graphs,
resources, verse marks, Reader header tools and every View command. Reload,
Relaunch and Developer Tools remain available in All tips but are excluded from
the random daily suggestion. GL-25 expanded.)

Previous: **workflowsVersion: 2026-09-23** (**W-42 step 6 — the Reader's zero-model
practice shelf now covers 24 important jobs.** Twenty more checked-in demos add
passage history, reference clearing, names and places, side-by-side reading,
full view, copy/split/save, scrolling, line layout, advanced study views,
filtered search and the Bibles/Notes side panel. Each remains inside
`reader.html`, starts without a provider call, and performs at most one visible
action per **Do it** press. CB-77 expanded.)

Previous: **workflowsVersion: 2026-09-22a** (**W-11 — hidden Reader controls are opened by
clicking the visible **⋯** at the bottom-left before the user is sent to a slider or
button that is not yet on screen. Verified live with the Font Size control and the
chatbot's two-press Do path. New CB-76.)

Previous: **workflowsVersion: 2026-09-22** (**W-11 and W-42 — Reader help now starts with the
plain questions and mouse controls an older, non-technical reader is likely to use.**
The Reader's four opening questions ask where to type a reference, how to enlarge the
words, how to return to a lost passage and how to put two Bibles beside each other.
W-11 names the exact controls and their positions, so those everyday phrases reach a
short useful answer instead of the chatbot's own page or Settings. Verified live
2026-09-22 on the dev Reader: `John 3:16` opened from the **Bible Reference** box,
**Font Size** was at the bottom left, and **Add Extra Bible** opened the installed
versions. New CB-73.)

Previous: **workflowsVersion: 2026-09-21a** (**new W-45 — Save a slide document as a PowerPoint
file (Export to PPTX).** Asked for by the user with a picture of a slide document's
menu in the Documents list: _add `Export to PPTX` for the AppDocument slides_, then
_make sure the exported pptx slide look closely identical to the app slide_. The menu
of an Open Worship slide document gains **Export to PPTX** under **Export**. The slide
is drawn the way a screen draws it and read back, so the file keeps the words as
editable text broken where the screen breaks them, in the font the screen really used,
with the boxes, pictures, background, speaker notes and hidden slides. Verified live
2026-09-21 on five documents, each slide opened in PowerPoint 16 and compared with a
1:1 render of the screen: text within 0–3px, shapes and pictures exact. New PL-106.)

Previous: **workflowsVersion: 2026-09-21** (**W-37 step 6 — a PDF previews in the app.** Asked for by
the user, with a picture of the Documents list's menu: _add Preview PDF to pdf item's contextmenu
in Resources_, then _make the click (only for pdf) to preview the pdf_. A `.pdf` row in
Resources now opens the same PDF viewer window the Documents list's **Preview PDF** does, on a
click and from its menu; **Open** still hands it to the computer's own PDF reader. Verified live
2026-09-21 on `GEN.1.pdf` in the Reader: the menu lists **Preview PDF** first, and both it and
a plain click open `GEN.1.pdf?uuid=GEN.1.pdf` with its 4 pages drawn.)

Previous: **workflowsVersion: 2026-09-19a** (**W-16 step 2 — Repair Links.** From `/owa-enhance
reliability` (`EN-33`), the user's ask: _my data portable and supported on both Windows and
POSIX_. A data folder carried between computers still held links naming where it used to be —
files saved before `$DATA_DIR_PATH` existed, or while the folder lived elsewhere — and those
pictures and videos showed as missing. **Repair Links**, in the Child Directories header of
Path Settings, points every such link at the folder where it is now, and only a link whose
own path is gone and whose file exists here. Verified live 2026-09-19 on the dev data folder:
_Links repaired: 381. Files changed: 127._ for the lyric backgrounds and their editing history
written on a Mac, then 6 more in 4 files (folder links); no old path left, every file still
parses, the Documents folder kept in another folder untouched, and every window reloaded with
no errors. The rest of that change — a missing data folder named at start-up with Retry, one
on a new drive letter found by itself, a new computer offered one found on a drive, the
permanent-delete question on a USB stick, file names checked for every OS — is in
`coverage-matrix.md` as rows still to be seen live, not as steps here.)

Previous: **workflowsVersion: 2026-09-19** (**W-25 steps 2 and 5 — the backup carries the Resources
folder.** Asked for by the user: _add `$DATA_DIR_PATH/resources` part of export/import data as
well_. **Export Data** lists a **Resources** row, the app-managed `<data folder>/resources`
where the Resources panel's **Copy to Data Directory** puts a folder, and archives ALL of it,
sub-folders included. **Import Data** puts it back and adds each folder it restored to the
Resources panel's list — the list is a setting, not data, so on a new machine the files would
otherwise land and show nowhere. A folder only LISTED in the panel from elsewhere on the disk is
not carried. Verified live 2026-09-19 on the dev data folder: the row shown ticked with its path;
a Resources-only export held all 1 321 files and a manifest naming `app-dir-resources`;
importing it back reported `Imported 0 file(s); 1321 already up to date` with no `(1)` copies
and the list untouched; an archive holding a new sub-folder imported 1 file, added that folder
to the list, and the panel drew it as its own group after Reload.)

Previous: **workflowsVersion: 2026-09-18a** (**W-31 step 7 — the divider's arrows say what they do.** From
`/owa-enhance ui` (`EN-21`): the two small arrows on a hovered divider were titled _Disable left_ /
_Disable right_ — in English in every language, and wrong in English too, since they collapse a panel
and disable nothing. They read **Collapse left panel** / **Collapse right panel** (top / bottom on a
horizontal divider) now, in the window's language. They are deliberately NOT the menu's own words, so
the app's tools do not find a hover-only arrow where a walkthrough means the menu item. In the same
change the Reader's lookup history chips, verse numbers, Tab hint and split button and the Mini
Screen card's `Screen: N` title stopped being English in a Khmer window. Verified live 2026-09-18 in
English and in Khmer: all four arrow names on the Presenter's dividers in English and the left one in
Khmer, the Khmer tooltip on all 20 history chips and on the verse numbers, no console error, the
language restored after.)

Previous: **workflowsVersion: 2026-09-17g** (**W-38 step 11 — a Mermaid diagram opens in the Mermaid Live Editor.**
Asked for by the user with the three Mermaid rows circled in a picture: _as a user I want to be able to
open each copy mermaid diagram string in mermaid live editor directly_. Copying a diagram is only half of
what a diagram is for, and nothing on an ordinary machine draws one but this app's own markdown preview.
**Open in Mermaid Live** sits under a divider at the foot of the 📋 menu and opens a second menu with the
three Mermaid shapes named plainly; DOT and PlantUML are not there because that editor draws neither. The
whole diagram rides in the link's FRAGMENT, which a browser never sends to a server, so nothing about the
records leaves the machine. Verified live 2026-09-17 on David's graph: the row drew unclipped, Chrome
opened the editor, and the link read back showed it holding this app's own diagram, Khmer names intact.)

Previous: **workflowsVersion: 2026-09-17f** (**W-38 step 10 — FIVE diagram languages, not one.** Asked for by
the user: _add variety of diagrams, so this will let user to have more options to see many format of
diagrams they want_. The copy menu now offers the Markdown document plus Mermaid flowchart across,
Mermaid flowchart down, Mermaid mindmap, Graphviz DOT and PlantUML — which one is right depends on
what it is being pasted into, and that is not a question the app can answer for anyone. The rows are
named SHORT because a context menu here is 210px and clipped the first pair to two identical
`Copy as Mermaid Flowchar…` lines; the full name is on the hover and on the toast. Verified live
2026-09-17 on Jacob's graph: the six rows read distinctly, and all three Mermaid shapes render in the
app's own markdown preview (the mindmap as a branching tree around Jacob).)

Previous: **workflowsVersion: 2026-09-17e** (**W-38 step 10 — the Markdown copy CARRIES the diagram.** Asked
for by the user right after the first cut: _the markdown should include mermaid `mermaid ... ` for
the diagram_. The document now opens on a `## Diagram` section holding the drawing in a `mermaid`
fence, ahead of the tables, so pasting the Markdown anywhere that renders it brings the picture along;
**Copy as Mermaid Diagram** stays for handing the drawing alone to something that wants only that.
Verified live 2026-09-17: David's 38-box graph copied as ~12.5KB and rendered — heading, summary,
drawn diagram, then the tables — in the app's own markdown preview.)

Previous: **workflowsVersion: 2026-09-17d** (**W-38 step 10 — the connection graph copies as Markdown or as a
Mermaid diagram.** Asked for by the user with the spot circled in a picture: _in name/location-name lookup
graph preview, I want a copy icon, when click the icon it show contextmenu of `Copy as Markdown` and
`Copy as Mermaid Diagram`_. A clipboard button now sits left of the signpost icon and opens those two
items. The Markdown is the records as a table with the centre marked, the connections grouped by kind
with the gendered relation word, and the verses each record cites; the Mermaid is a `flowchart LR` whose
boxes carry the canvas's own per-kind colour. Record wording follows the lookup language, the document
furniture stays English, and both are built from the same visible boxes the saved picture uses. Verified
live 2026-09-17 on the dev reader: David's graph at 29 boxes copied as ~7.6KB of Markdown and as a
diagram that renders in the app's own markdown preview. New RD-121.)

Previous: **workflowsVersion: 2026-09-17c** (**W-37 step 8 — put files INTO a Resources folder with Add Files.**
Asked for by the user with a picture of a group's menu circled: _as a user I want to be able to copy one or
more files to the resources selected folder… add `Add Files` to select files to copy to the folder._ The
group menu now has **Add Files** under **Add Folder**: pick one or several files and they are copied into
that folder, the originals untouched. Nothing is overwritten — a name the folder already holds gets ` (1)`
— a file already sitting there is left alone rather than copied beside itself, and the group re-reads
itself and opens if it was folded. A copied file that the list cannot draw (named after no chapter, with
**Others** unticked) is SAID so in the note rather than landing in silence. Verified live 2026-09-17 on the
dev reader: the item sits between **Add Folder** and **Reveal in File Explorer**; a `GEN.1.claude-check.txt`
picked into the `Document` group appeared under `GEN.1.*` by itself, the same file picked again landed as
`GEN.1.claude-check (1).txt` beside it with the toast **Add Files — 1 file copied**, and both were removed
again. New RD-120; RD-87 amended.)

Previous: **workflowsVersion: 2026-09-17b** (**W-37 step 6 — a note file shows its highlights and comments, and a
markdown file its own HTML.** Asked for by the user the same day, twice: with a picture of the Bible Notes
panel, _it should have all like highlight and comments as well_, and with the README selected, _the
markdown preview should be rendered_. A `.own` row now lists everything the Bible Notes panel lists — its
notes, and each marked verse with its highlights in their colour and its comments underlined — and a mark
opens its verse beside the reading. The preview draws the HTML a README is written in (a centred picture, a
fold-away section, badges) with anything that could run taken out, and the step says why a file saved with
its markdown escaped shows the characters as written. Verified live 2026-09-17 on the dev reader:
`GEN.1.own` listed ccc2, Sunday May 31 2026, test, Unnamed, then _(KJV) Genesis 22:2_ (_and offer_
underlined, _testing comment_), _(KJV) Genesis 22:1_ (_pass after_ in pink) and _(KJV) Genesis 4:1_; two
verses folded to a count of 1; pressing _and she conceived_ opened Genesis 4:1 as another view with both
marks painted, and the file's MD5 and timestamp were unchanged; the app's own `README.md` rendered its
badges, centred screenshot, table of contents (a press scrolled to _Tech Stack_), contributors table and a
closed _Fedora Dependencies_ section; the user's `GEN.1.md`, saved with `\#` and `\*\*` escapes, showed
those characters as written.)

Previous: **workflowsVersion: 2026-09-17a** (**W-37 step 6 — a markdown file and a bible note file open inside the app.**
Asked for by the user with two pictures (a `GEN.1.md` and a `GEN.1.own` circled in Resources, and the
Bible Notes panel): _Resources should support in app preview for markdown file and Bible-note file… open
bible-note preview should be read-only, open markdown-file should popup like bible-note and render the
markdown. If possible add Mermaid diagram support._ A `.md` opens a **Markdown Preview** window (tables,
code, pictures beside the file, Mermaid diagrams; follows the file as it is saved; links to headings, to
other `.md` files with Back, and to the web); a `.own` row opens onto its notes, and a note opens in the
Bible Note window read-only. Verified live 2026-09-17 on the dev reader: `GEN.1.md` opened the preview; a
scratch document drew a flowchart and a sequence diagram, reported a broken one above its code, scrolled
to a heading, opened a linked `.md` with Back, and updated when the file was saved; `GEN.1.own` listed its
four notes and not its three verse marks, and **ccc2** opened with _(Read-only)_ in its title and a locked
editor, and pressing the editor's Undo left the file byte-identical on disk.)

Previous: **workflowsVersion: 2026-09-16a** (**W-37 step 8 — copy a Resources folder into the data folder.**
Asked for by the user with a picture of a Resources group's menu: _as a user I want to be able to move
selected folder in Resources to under selected-dir so I can manage it easily_, and then _after copied
then change the selection to the copied one_. A group's menu now has **Copy to Data Directory**
between **Reveal in File Explorer** and **Remove Folder**. It asks first, naming the folder and the
`resources` folder inside the data folder it goes to; then copies the whole folder there, sub-folders
and all, and the group switches to the copy in the same place, folded or open as it was. The original
stays on disk. A name already taken gets ` (1)`; a folder that is already a copy is not offered the
item; a folder holding the data folder itself is refused before anything is asked, since it would be copied
into itself. Verified live 2026-09-16 on the dev reader: the item and its confirm on a scratch folder, and the
refusal on a Desktop group holding the data folder. Not seen live: the copy after **Yes**, which an agent may
not press — unit-tested on a real folder tree.)

Previous: **workflowsVersion: 2026-09-15c** (**W-16 — a font's weights are listed beside it.**
Asked for by the user with a picture of the Slide Editor's font box: the font list came from a
package that could name a font but not its weights, so the weight list beside it never appeared.
The app now reads each installed font's real weights itself, and the list appears whenever the
chosen font ships more than one (`400 Regular`, `700 Bold`, `900 Black` for Arial), with
**Default** leaving the font's own weight. Settings, the Slide Editor and the Foreground widgets
share that one picker. Verified live 2026-09-15 on the dev Slide Editor: a text box in Arial
offered Default, 400 Regular, 700 Bold and 900 Black, 700 Bold thickened the text on the canvas and
its thumbnail, and Undo put it back. Not seen live in the Settings card itself.)

Previous: **workflowsVersion: 2026-09-15b** (**W-37 step 5 — tick Others to see every file that is not named after a chapter.**
Asked for by the user with a picture of the panel: _I want to be able to see others non related to
`<book>.<chapter>.*` files so I don't have to do search for those files_. A picture, a map or a handout
kept in the same folders as the chapter files could only be reached by typing part of its name. A box
marked **Others** now sits beside the magnifier; ticked, each folder also lists every file whose name is
not a book and chapter, under an **Others** heading after everything else, up to 200 a folder, and it
stays ticked next time. Verified live 2026-09-15 on the dev reader: ticking it listed a general folder's
files under **Others** while the two chapter-named folders beside it did not change, nothing appeared in
the console, and unticking it put the lists back.)

Previous: **workflowsVersion: 2026-09-15a** (**W-37 step 4 — Resources looks two folder levels down, not eight.**
Asked for by the user with a picture of the panel: a group for their whole home folder said **No
matching files** and **Too many folders to search**, and they asked for the search to stay near the
top. It had walked eight levels deep, and a home folder is mostly other programs' folders, so the walk
used up its whole allowance there and found nothing. Now each group reads its folder and the two levels
of folders under it and stops. Measured on that home folder: 64 folders read and the walk finishes, where
four levels or more ran out at 1 500. Verified live 2026-09-15 on the dev reader: the home-folder group
says **No matching files** with no warning, and the other groups still list their `GEN.4.pdf`,
`GEN.0.pdf` and `GEN.0.json` links. RD-84, RD-89 and RD-114 amended.)

Previous: **workflowsVersion: 2026-09-14c** (**W-44 step 6 — a link opens only when you pressed it, and the boxed site cannot reach this computer by any route.**
Security work, not a report. Measured from inside a live site: a page in the AI Chat window could
open your normal browser on its own, with nothing pressed, as often as it liked; and a WebSocket —
the kind of connection a live chat uses — could reach programs on this computer such as OBS or a
presentation remote, which ordinary web requests from the site already could not. Now your browser
is handed a page only right after you press something in the site, one page per press; a page that
tries anyway is not opened, and a line under the row above the page says so. And WebSockets are held
to the same wall as everything else, while the sites' own live connections still work. Verified live
2026-09-14 on the dev window: 43 checks held. CB-68 extended.)

Previous: **workflowsVersion: 2026-09-14b** (**W-44 step 6 — a site may ask for the microphone.**
Reported by the user with a picture of Claude's dictation button under _Microphone access is
blocked_ in the AI Chat window, whose advice points at a browser address bar the window does
not have. Pressing a site's microphone button now puts a line under the row above the page
asking to allow it, with **Don't allow** already selected; a yes is for that one site, lasts
until the app closes, and only counts while its tab is in front. Verified live 2026-09-14 on
the dev app with Claude's own **Dictate**: the line appeared, **Don't allow** and Escape kept
the microphone off, **Allow** let the site hear, and the same site behind another tab was
refused.)

Previous: **workflowsVersion: 2026-09-14a** (**W-42 step 13 — an assistant with no key can be chosen,
and choosing it opens its key box.** Asked for by the user with a picture of the help
window's assistant list open on **Kimi — needs an API key**, greyed out: the row said what
was missing and could not be pressed. It is in the list in a quieter colour now; choosing it
keeps the conversation on the assistant it had and opens **Settings** on **Others** with the
cursor in that assistant's key box, and a **Settings** window that is already open comes to
the front and turns to **Others** rather than a second one opening. Verified live 2026-09-14
on the dev app: with **Settings** closed the cursor was in **Kimi API Key** under a second
after the choice, and with **Settings** open on **General** the same window came forward on
**Others** with the cursor in the box.)

Previous: **workflowsVersion: 2026-09-12e** (**W-42 step 14 — on a Mac, the help window steps aside
ALONE.** Reported by the user with a picture from macOS: pressing **Do it for me**
minimised every window of the app, the presenter included, and closing the card brought
nothing back. The help window is a child of the app window, and a Mac cannot minimise a
child window on its own, so it took the app down with it. It now leaves the app window
first and rejoins it when it comes back. The step says the Dock as well as the taskbar,
and that the app itself stays on screen. Verified live 2026-09-12 on the dev app off the
OS window list: the help window alone went to the Dock and came back when the walkthrough
stopped, the presenter on screen throughout.)

Previous: **workflowsVersion: 2026-09-12d** (**W-30 step 1 — the view is picked by its NAME, and
there are four of them.** Found by a robot-test pass, not reported: the step said the
drop-down lists _three views_ and told the reader to _pick the third one_, and the live
list has had four since Resources joined it — so the third one is now the wrong view.
An ordinal is what drifted, so the step no longer uses one: it names all four and says
to pick **Location-Name (KJV)** by its name, which cannot go stale when a fifth view is
added. Verified live 2026-09-12 on the dev reader. RD-drift.)

Previous: **workflowsVersion: 2026-09-12c** (**W-37 step 3 — a folder can be dragged into Resources.**
Asked for by the user with a picture of the panel: _as a user I want to do drag/drop folder
to do folder adding_. Adding a shelf meant the button and the picker dialog, which is the
long way round when the folder is already open in front of you in Explorer. Dropping one
anywhere on the view now adds it — the view outlines itself and its top line says **Drop
folders here** while a folder is held over it — and several at once is one drop. A dropped
FILE is refused in words rather than being read as "add the folder it sits in": that parent
is as often the whole Downloads folder as it is a library, and Resources walks what it is
given eight levels deep. A folder already on the list says so instead of appearing to do
nothing. Verified live 2026-09-12 on the dev reader: the drop added the folder and listed
its `GEN.4.pdf` and book-level `GEN.0.notes.pdf` under Genesis 4, the second drop of the
same folder said **Folder is already added**, and a dropped `.pdf` said **Drop a folder, not
a file** and shelved nothing. New RD-114.)

Previous: **workflowsVersion: 2026-09-12b** (**W-37 step 7 — a `.json` beside the verse is a list of links you can click.** Asked for by the user with a picture of the Resources panel: a `GEN.0.json` in their own YouTube folder drawn with the "unknown file" diamond, and a whole library of `<BOOK>.0.json` files behind it holding a title and a YouTube address per video. Opening one in a text editor is not what anybody wants from it, so the panel now reads it: each entry's **title** is a row you press, and pressing it opens that address in the computer's own web browser. The shape is the one their files already had -- a list of `{ "title": ..., "url": ... }` -- with a bare address on its own allowed as a shorthand. **A `.json` that is not that is still just a file**: the panel tries the content, and anything it cannot read as links keeps the ordinary icon and opens in whatever application the machine uses for it, with no error and nothing to dismiss. Only `http` and `https` addresses are offered, because opening an address hands it to the desktop, which would launch whatever program has claimed some other scheme. Verified live 2026-09-12 on the dev reader: their own `GEN.0.json` listed three Khmer video titles, a probe file with a bad entry listed its two good rows and said **1 entry was not understood**, a probe holding ordinary data stayed an ordinary file row, and a press on a title opened the video in Chrome. New RD-115.)

Previous: **workflowsVersion: 2026-09-12a** (**W-44 steps 3 and 7 — Sign out of every site, and the boxed site can no longer reach this computer at all.** Security work, not a report. The window keeps you signed in on purpose — that is why it exists rather than a browser tab — and on a shared church computer that means the volunteer who opened ChatGPT before the service is still signed in for whoever sits down after it; closing every tab never touched it. There is now a **Sign out of every site** in the row above the page (**↤**) and in words on the card, it asks before it acts with _Keep me signed in_ already selected, and it takes the pages the tabs were on and the names the sites gave them — the previous person's conversation titles — while leaving any name you typed yourself. And the box got its fifth wall: measured from inside a live site, a page in this window could not READ anything on this computer, but it could still SEND a request to it, including to the app's own two doors — so the boxed site is now refused every address on this machine and its network (the router, a printer, a NAS, and loopback written any of the five ways that defeat a naive check) while the site's own pages are untouched. Verified live 2026-09-12 on the dev window: 33 checks held, the site still loaded and signed in. CB-68 extended.)

Previous: **workflowsVersion: 2026-09-11f** (**W-30 — the names in a Khmer verse are underlined too.** Reported with a picture of the reader showing Genesis 4 in two columns: the King James one underlined **Adam**, **Eve**, **Cain** and **Abel**, the Khmer one beside it underlined nothing, and the panel that lists who is in the passage had been answering for both all along. It is the dictionary that is English, not the feature — so a bible in a language the app ships records for now underlines that language's own spellings and a click opens the same record. A Khmer verse marks a name the dictionary records for that verse or somewhere in its chapter and nothing else, so it marks a little less than the King James column and never guesses; another English version still underlines nothing, because the dictionary was made from King James wording. Verified live 2026-09-11 on the dev reader: `អ័ដាម`, `អេវ៉ា`, `កាអ៊ីន` and `អេបិល` underlined in ពគប Genesis 4, and the Khmer `អេបិល` opened the record **អេបិល (Abel)**. W-29 step 3 and W-30's closing note say so; RD-80 covers it.)

Previous: **workflowsVersion: 2026-09-11e** (**W-06 and W-11 — you can type the whole reference now.** Both recipes told the reader to pick book → chapter → verse in steps because a full `John 3:16` "only filters the book list and the `3:16` is dropped when you pick the book". A robot run typed the reference char-by-char into both lookup surfaces — the header dialog and the Bible Reader page — and both went straight to the verse: `John 3:16` rendered with 16 selected in the chapter strip and Resources switched to `JHN.3`, and `Psalm 23:1`, a control whose words appear nowhere in the saved Bibles list, rendered "The LORD is my shepherd" on both against a clean baseline. The two notes now read as a tip that the step-by-step picking is optional, and the same correction went into the matrix RD-03, knowledge-base §5/§11, test-plan S11 and components-path. Verified live 2026-09-11 on the dev window.)

Previous: **workflowsVersion: 2026-09-11d** (**new W-44 — Chat with an AI website inside the app (AI Chat).** Asked for by the user with a picture of Firefox's AI sidebar: _like firefox, I want an ai chat panel … just open webpage from ai company directly_, with _another icon right next to the chatbot icon_, _deepseek kimi grok chatgpt claude gemini mistral …_ and _tabs for each session like what having in chatbot_. A **✨** button right of the **🤖** on the presenter, the slide editor and the reader (and **Help → AI Chat**, **Tools → AI Chat** everywhere) opens a window beside the app, the same size and place as the help window, on a card listing ten AI chat sites; a press loads that site itself — the user's own account, the site's own sign-in, kept across restarts — in a sandboxed box that can reach nothing on the machine. The tab strip is the help window's own; a tab is named after the page and comes back on its conversation; three tabs keep their site loaded at once and the rest reload on return, because every loaded site is a renderer process of its own. Not gated on **Enable AI features**: no key, no assistant. Verified live 2026-09-11 on the dev window: ChatGPT, Claude, Gemini and DeepSeek opened in four tabs, the fourth unloading the first. New CB-68; W-42 step 1 now places the **🤖** between the gear and the **✨**.)

Previous: **workflowsVersion: 2026-09-11c** (**W-09 and W-42 step 6 — a countdown, clock or scrolling message goes on the screen by its words, asked or by /countdown and /marquee.** Research, not a report: the standing questions held, so the next ask shape was followed through — _Start a 5 minute countdown on the screen_ — and the assistant's "yes" ran to its round cap hunting the Foreground tab's boxes (a toggle it had just closed) and started nothing. The Foreground panel is a form for a person, so the app now starts an extra by its words on the ticked screens and reads them back: one call with an assistant, **/countdown 5** and **/marquee <words>** with none, one offered button with no key. The five **/clear-** commands clear a layer the off screen HOLDS instead of saying there is nothing to clear. Verified live 2026-09-11 on the presenter with Claude Sonnet 5, the countdown read off the screen. New CB-67.)

Previous: **workflowsVersion: 2026-09-11b** (**W-42 step 8 — the auto-hide is gone.** The user, the morning after asking for it: _please remove all auto-hide feature from the chatbot_. The pickers, the credit lines and the ask box stay exactly where they always were; nothing in the help window tucks away on a scroll any more, there is no 📌, and the step's paragraph about it is removed. Verified live 2026-09-11 on the dev window: the head is a plain row again with no strip and no pin.)
Previous: **workflowsVersion: 2026-09-11a** (**W-37 step 1 — the verse context menu no longer offers Open in Resources.** Removed at the user's request; the Resources view is reached from the advanced lookup picker only. Test and matrix row CM-93 retired in the same change.)

Previous: **workflowsVersion: 2026-09-10i** (**W-42 step 6 — `/lyric https://…` writes a song
from a page with no assistant, and a song link is drafted offline.** Measured
2026-09-10: with the assistant paused, _Create a lyric file from https://…_ — the
app's own starter chip — was searched for in the guide and answered with how to make
an EMPTY file; on a live key the same ask drafted the song and created the file in
one breath, 3 rounds and 18 s, and still offered **Create** under _Done!_. Now
`/lyric <address>` reads the page and offers the song in ~3.5 s with no model round,
the built-in guide does the same for the chip's words with no key, and an answer
whose file the assistant already created carries **Show it in the list** and the
file instead of a second **Create**. Verified live 2026-09-10 on the dev window.)

Previous: **workflowsVersion: 2026-09-10h** (**W-37 steps 2 and 4 — Resources follows every
passage you have open, not one selected verse.** Asked for by the user with a
screenshot: three chapters open and the panel on `GEN.24.*` alone. The view no
longer shows a selected-verse block; its top line is one solid pattern chip per open
chapter, in pane order, then one dashed book-level chip per book, and each folder's
files are filed under the pattern they answered to, a book-level file once. The pane
being typed into follows its reference box. Verified live 2026-09-10 in the Bible
Reader on Genesis 24 beside Genesis 27.)

Previous: **2026-09-10g** (**W-42 step 8 — only the rows at the top tuck away; the ask box stays put.** The user, the same day: _I don't want auto-hide for the bottom one_. The pickers and the credit lines still tuck away to a thin strip while you scroll and come back at the top, under the mouse, or for good with the 📌; the ask box with its tip line no longer moves, so the next question can always be typed. Verified live 2026-09-10 on the dev window.)
Previous: **workflowsVersion: 2026-09-10f** (**W-42 step 8 — the rows at the top and the ask box tuck away while you scroll.** Asked for by the user, with a picture of the help window circled: _make those area auto-hide_, then _auto-hide while scrolling_. The three pickers, the CREDIT USED line and the ask box with its tip took 139px of a 630px window — a quarter of the answer out of sight for controls touched once a session. Now scrolling the conversation tucks both away to a thin strip with a grip on it; the mouse at either strip, a picker given the keyboard, anything left in the box, or scrolling back to the top (the pickers) or the bottom (the box) brings them back, and the 📌 at the end of the pickers keeps them in view for good. Verified live 2026-09-10 on the dev window by every rule, the pictures taken with the window in front. New CB-65.)
Previous: **workflowsVersion: 2026-09-10e** (**W-42 step 13 — a provider that cannot answer says what is wrong and carries the door to it.** Asked for by the user: _if there any unusual response from api then give buttons for user to go to the api dashboard_. Measured first on the ChatGPT key that has been out of credit for a week: the note hedged _out of credit or being rate-limited_ with the provider's own body saying `insufficient_quota`, and nothing under it to press. The failure is now read from what the provider said (its documented code or type and its words, not only the status — an empty Anthropic account is a 402 or a 400 saying "credit balance", which the stand-in had never once caught), the note says the one thing it knows, and the first button in the row opens the provider's own billing, keys, limits or status page in the browser — **Open ChatGPT billing**, **Open Claude API keys**, **Open Kimi usage limits** — or the app's AI settings for the Free assistant; the hover shows the address, the press says _Opening … in your browser._ Verified live 2026-09-10 on the presenter through the dead ChatGPT key with Claude standing in. New CB-64.)

Previous: **workflowsVersion: 2026-09-10d** (**W-30 steps 2 and 4 — every open passage is
listed, the pane being edited included.** Reported with a screenshot: two panes open,
**Genesis 29:1-35** in the reference box and **Genesis 27:1-46** under it, and the
**Names and locations in your reading** panel showing only Genesis 27. The pane being
edited was recognised by a marker that survived only a reload from settings; a split
or a retarget rebuilt the list without it, so that pane was listed by the passage it
had when it was LAST selected — here the same Genesis 27 it had been split from, which
then collapsed into one block. It is recognised by its selection now, so the block
follows the reference box, and every block is headed the way the Bibles list names a
reading — `(KJV) Genesis 29:1-35`, the full book name. Verified live 2026-09-10 in the
Bible Reader: both blocks, in pane order, the first following a retyped reference
within about a second and a half.)

Previous: **2026-09-10c** (**W-42 step 8 — a spending limit, and the assistant pauses at it.** Asked for by the user: _I don't want to mistakenly get stuck in an infinite loop of programmatic error that eats all my credit or floods the bill._ Until now the only things between a fault that keeps asking and the bill were the round cap on one question and a person pressing Stop, and a fault is not a person. Now a **LIMIT PER HOUR** picker sits beside CREDIT USED (a dollar an hour to begin with), the figure next to it says what the last hour has cost across every tab and turns amber past four fifths of the cap, and at the cap the assistant PAUSES: the question is answered from this guide instead, with a note saying why and an **Allow more** button that starts the hour again — a button, so a fault cannot press it, and remembered across a restart so a fault cannot reload past it. A fixed pace cap of 150 model calls an hour holds whatever the money cap is set to, which is what protects a free service. **/limit** reads or sets it with no assistant. Verified live 2026-09-10 on the presenter: the cap set to $0.25 with $0.21 already spent, one real question paid one round, was paused on its second and answered from the guide; Allow more re-asked it and Claude answered; 150 seeded calls with the money cap off refused the next question before any round was bought. New CB-63.)

Previous: **workflowsVersion: 2026-09-10b** (**W-42 step 8 — every answer says what it cost, and CREDIT USED totals the chat.** Asked for by the user: _as a user I want to see how many credit used per chat session_. Every model round reports the tokens it used and the window threw the number away, so a volunteer was spending the church's API credit with nothing on screen saying how much. Now the small grey figures at the end of an answer's Copy line say what that answer cost (*≈ $0.02 · 49k tokens*), a **CREDIT USED** line under the three pickers keeps the running total for the tab — counting a stopped or failed question's rounds too — and the hover on either has the sums; the dollars are an estimate from the list price, a free service reads *free*, an unpriced model *price not known*. Measured on the standing twelve questions the same morning: about $0.28 for all twelve on Claude Sonnet 5, every round after the first a cache read. Verified live 2026-09-10 on the presenter, the figures checked against the provider's own usage on the wire. New CB-62.)

Previous: **workflowsVersion: 2026-09-10a** (**W-06 step 7 and W-42 — a Bible passage goes up by its reference, asked in words or by /verse.** Research, not a report: the standing questions held, so the one shape left open was followed through — _Put John 3:16 on the screen_ — and the assistant could only describe the lookup's picker; the **Do it for me** under that answer opened the lookup and stopped where a person types the first letters of the book, the verse lost. The lookup is a picker for a person and no walkthrough can drive it, so the app now presents a passage by its reference through its own parser — the words the volunteer says, in the version the lookup is on — and reads the screen back: the assistant does it in one call and offers the screen's own show button, **/verse John 3:16** does it with no assistant, and with the network cut the guide checks the reference, quotes it and offers one button. Verified live 2026-09-10 on the presenter with Claude Sonnet 5, the passage read off the projector window. New CB-61.)

Previous: **workflowsVersion: 2026-09-09e** (**W-42 step 13 — a key that cannot answer hands the question to another of yours.** Research, not a report: the help window's own default assistant was a ChatGPT key a week out of credit, and every one of the standing twelve questions waited three to five seconds on three identical posts to it and then answered from this guide — with a working Claude key one option along in the row above. Now the next assistant whose key is set answers instead, once and at once, the note says which and why, and the tab moves to it; the dead key is asked once, not three times. The guide's own answers improved where they were measured wrong the same afternoon: _where is the button to change the background_ offered a line of Genesis as the nearest control (it shared the words _to_ and _the_) and now offers **Background**; _how do I edit a slide_ asked from the Bible Reader now opens with the way back to the Presenter before naming the Documents list. Verified live 2026-09-09 on the presenter and the reader, with the dead key and with the network cut. New CB-60.)

Previous: **workflowsVersion: 2026-09-09d** (**new W-43 — Remove a song, document or file (Move to Trash); W-42 step 6 — the assistant knows the RUN SHEET, and /run.** Research, not a report: the standing questions were asked again and the follow-up _and how do I undo that?_ under _How do I add a song?_ took the assistant six lookups and 17 seconds to end on **Delete** — a menu item this app does not have. The manual had no page for removing a file at all; this one names the real item, the confirm, and the Recycle Bin the file goes to, and the assistant's question list carries a question for it. Also: asked _How do I edit a slide?_ from the Bible Reader, the assistant had been starting its steps "in the Documents list", which the Reader has not got — it is now told which panels that page lacks and that the way back is the 🖥️ **Go Back to Presenter** button, and steps written from a search excerpt without opening the page are handed back to it once. And _What's next in my running order?_ — six lookups and an unverified guess about a green mark — is answered from the run sheet itself: which presenting flow is open in its run player, the line the run is on and the slide inside it, and what the next press puts up, in 2 rounds; **/run** says the same with no assistant. Verified live 2026-09-09 on the presenter and the reader with Claude Sonnet 5. New CB-58, CB-59.)

Previous: **workflowsVersion: 2026-09-09c** (**W-42 step 6 — the assistant knows what the user is in the MIDDLE of, and three more commands.** Research, not a report: the standing questions passed, so the other half of the situational rung was asked with the selection deliberately different from what the projector held — and the assistant named the song on the screen when asked which song was SELECTED, and ran to its round cap on _show the next slide_ (the slide cards had no name any tool could see; it pressed a slide's number badge and then said it could not find an answer). The app now tells it which song or document is selected, its slides with their first words, which one is up and which comes next, and every slide card answers to its own name (_Slide 5: …_), so the same asks are two rounds and one press, verified on the wall. **/selected**, **/next** and **/previous** do the same with no assistant. Verified live 2026-09-09 on the presenter with Claude Sonnet 5. New CB-56.)

Previous: **workflowsVersion: 2026-09-09b** (**W-31 steps 7–9 — the divider between two panels has the same menu, and the walkthrough can press it.** Reported with a screenshot: the walkthrough for this page on step 1 of 5 saying to open the View menu, beside a right-click the user had made themselves on a panel divider, open on _Reset Size / Close First Widget / Close Second Widget_ — _"the agent also use contextmenu of the resize"_. The page knew only the View menu, which lives in the menu bar where no walkthrough can press it (and which a popup window does not have), the divider had no name the assistant could find, and the View-menu step itself was being skipped in the Presenter because its example list says _presenter_. Now every divider is named after the two panels it sits between, the recipe says what a right-click, a double-click and a hover on it do, and the walkthrough opens the divider’s own menu, rings the item and chooses it on the next press. Verified live 2026-09-09 on the presenter. New CB-57. Also W-02 step 2 reworded to put the ORDER first — select the document, then click the tab — because the assistant was condensing it into "click the slide document, this opens the Slide Editor".)

Previous: **workflowsVersion: 2026-09-09a** (**W-42 step 6 — the assistant knows what is ON the projector.** Research, not a report: the standing questions passed, so the panic ones were followed through with the projector actually showing a verse — and the assistant said _“turning the screen on just gives you a blank canvas”_ to a screen showing Verse 2, said _“yes, the screen is on”_ with not a word about what, and took eight presses of its own to turn a screen on when asked. The app now tells it what each screen holds — the song and the verse with its first words, the passage, the background, the widgets, the lock — and the words on that screen’s own buttons, so the same questions name the verse on the wall, the _yes_ is one press, and **/screen** and the offline answer say the same with no assistant at all. Verified live 2026-09-09 on the presenter with Claude Sonnet 5. New CB-55.)

Previous: **workflowsVersion: 2026-09-08c** (**W-42 step 15 — Do it presses the button the step names, closes what is in the way first, and reads Next on a step that is only something to notice; W-12 step 1 names the toggle as the app does.** Reported with a screenshot: the Bible Lookup popup open over the Presenter and the walkthrough’s ring drawn through it onto a line of Genesis — _“does not work while modal present”_ — then _“many question fail during Do it”_. Do it was pressed through every step of every recipe (224 presses): 124 refused, and a check of the 92 counted as done found the wrong control pressed in at least ten of them — the projector’s Clear All for the drawing panel’s Clear, the help window opened for a bolded word. Now a control behind a popup, menu or floating panel is closed out of the way on the first press and never a question the app is asking; only a control called what the step says is pressed, a look-alike is named and handed to the assistant; a step that only describes what to see reads Next; and the four tour pages (W-01, W-09, W-10, W-17) that could not start a walkthrough at all now do. Verified live 2026-09-08 on the presenter and reader. New CB-52.)
Previous: **workflowsVersion: 2026-09-08b** (**W-42 steps 18 and 19 — the buttons under a drafted song are the only thing to press, a paste is written out even with no assistant, and a hymnal’s text page reads right.** Asked for from the app with the _Try asking_ chips circled: _“test all questions in the highlight then enhance until everything work smoothly”_. Graded on the assistant the window was set to — Kimi on a free account — the two how-do-I chips passed; under a drafted song the assistant’s own _Create the file_ / _Copy the text_ pills were drawn brighter than the real buttons and pressing one failed after half a minute, and the paste the third chip invites was refused a minute later and searched for in this guide. Now only the real buttons and genuine replies sit under a song; a refused or keyless paste is written out by the app itself in a second or two; and a hymnal’s text page comes out as its numbered stanzas with the title, author and _Public Domain_ off the page’s own table (it was sixteen verses of menus). Verified live 2026-09-08 on the presenter with Kimi K2.6 and Claude Sonnet 5. New CB-51.)
Previous: **workflowsVersion: 2026-09-08a** (**W-42 step 6 — a page is named by its title, never by a code.** Research, not a report: the standing questions asked on Claude, and the where-is one opened with _“W-08 has exactly what you need”_ — a code the assistant is told never to show, written from a search result, and written again when asked after the fix. The code now leaves the search excerpts and, if the assistant writes one anyway, the window replaces it with the page's title before you see it. The offline button has read **Read the whole thing** for some time; this step said **Read all of W-xx**, and now says what is on the screen. And the _“Yes, walk me through it”_ reply that sat beside **Show me step by step** on every multi-step answer — the same press twice — is dropped. Verified live 2026-09-08 on the presenter with Claude Sonnet 5. New CB-50.)

Previous: **workflowsVersion: 2026-09-05b** (**W-42 step 6 — a picked question is a label, not a search.** Measured on all 258 supported questions that name a page of this guide: searched for as typed, the search put that page first for 147 (57%) — so a question picked off the app's own list got the wrong page two times in five, with a paid assistant or without. A question that IS one of the corpus rows (a chip, a suggestion, the More… list) now goes straight to the page it is filed under, on the search itself and as a hint to the assistant, which then opens the page without searching (2 rounds where the free-worded version took 5). The 45 held-out paraphrases are untouched (22 of 45 before and after). And a search hit that merely shares a word — _Can it stream to Facebook?_ scored the Presenter overview 2 — no longer counts as an answer: no walkthrough buttons under an honest "it cannot", no page at all from the offline bot. Verified live 2026-09-03 on the presenter with Claude Sonnet 5 and with a dead key. New CB-49.)

Previous: **workflowsVersion: 2026-09-05a** (**W-42 step 6 — commands that need no assistant.** Asked for from the app: _"looking for a way to do pre-training the local assistant, for some task the chatbot should not ask the llm api"_, then _"add build action like `/presenter-screen-show` `/presenter-screen-hide`"_, _"buildin actions"_, _"so user don't have to ask llm"_. Measured the same afternoon before anything was built: three of the four assistants on the machine answered 429 within the hour (ChatGPT out of credit, Kimi rate-limited from the second question, the free pool after 62 seconds), so the standing question corpus fell through to the offline guide bot, which answered _"Turn off the screen for me"_ with the screen's state and no way to change it, and got 4 of 12 right. The ask box now takes `/` commands — `/screen`, `/screen-show`, `/screen-hide`, the five clears, `/find`, `/goto`, `/here`, `/help`, `/commands` — run through the app's own tools with no model, no key and no internet, each answering with what CHANGED, read back after the press. Typing `/` lists them. Two cheap offline-bot fixes rode along: a how-do-I that mentions the screen is no longer answered with the screen's state, and the window's name is no longer a search word (it made the Presenter overview page outrank the real answer). Verified live 2026-09-02 on the presenter: every command 0 model rounds, about 1.6 s, the screen really on and off. New CB-48.)

Previous: **workflowsVersion: 2026-09-04b** (**W-42 step 6 — the window says what it is doing while it works, the tip line walks, and the four suggestions are no longer all there is.** Asked for from the app with three screenshots: _"chatbot, should log progress and progress information (doing on what)"_, _"should `<-` and `->` for pre next tip"_, and _"should `More...`, when I click it show all list so can know what I can do"_. A question that reads a web page and drafts a song is most of a minute behind one unchanging line — _Looking it up…_ — which cannot tell a window that is working from one that has hung; the wait is now a short LOG of what it is actually doing, in the words a volunteer would use: _Connecting to the app_, _Searching the guide for "background"_, _Reading example.com_, _Creating a new song: "Amazing Grace"_. Finished steps stay above the running one, so it reads as progress rather than as a spinner, and no tool name, path or id can reach it. The 💡 line gained **‹** and **›**, which walk the tips in order and wrap, where pressing the sentence still gives a random one — the arrows are the only way to see them all and the only way back to one that changed while it was half-read. And the four **Try asking** chips gained **More…**, which opens every question the window is prepared for, grouped under the panel each belongs to — 184 of them in the Presenter. Verified live 2026-09-04 on the presenter with Claude Sonnet 5. New CB-47; CB-46 and CB-17 amended.)

Previous: **workflowsVersion: 2026-09-04a** (**W-42 step 6 — the ask box remembers what it has been asked, and a tip sits above it.** Asked for from the app with a screenshot of the chat window: _"chatbot, it should remember asking history, when editing the alt+arrow-up/down should get the text from history"_, then _"show this kind of tip somewhere to let user know any features"_ and _"showing tip randomly, maybe above the input text"_. **Alt+↑** / **Alt+↓** walk back through every question typed into this window — one list for the whole window, kept across tabs and across days, seeded from the conversations already saved — and a press past the newest hands back the half-written question the walk started from. The plain arrows are untouched: they belong to the cursor and to the suggestion list. Above the box, one line with a 💡 names a feature nothing on screen announces — the camera, the walkthrough cards, **Report**, **Alt+↑** itself — a different one each time the window opens, another on a click. Verified live 2026-09-04 on the presenter with Claude: two questions walked back, the empty box handed back, a real ask recorded and recalled, and the tip changing on each press. New CB-46.)

Previous: **workflowsVersion: 2026-09-03a** (**W-10 — the show/hide screen control is named, because "Show" is not its name.** Reported from the app with a screenshot: the assistant was asked _"How do I show a screen?"_, offered to do it, was told _"Yes, turn it on"_, and answered _"Done — the screen is now showing."_ while nothing was on the wall. Four toolbar-reveal decorations in the presenter carried the title **Show**, an exact match that outranked the screen's own control, so the press landed on one of them. Those are now **[en:tran:Reveal Hidden Controls]**, the screen control answers to **[en:tran:Toggle showing screen]** in whatever language the app is showing (it was hardcoded English), and a press now reports what it CHANGED rather than only what it hit. Verified live 2026-09-03. New CB-44.)

Previous: **workflowsVersion: 2026-09-01h** (**W-19 step 1 and W-42 steps 1 and 5 — the annotation overlay and the assistant now belong to EVERY window, and the help window can be asked about any of them.** Asked for from the app: _"add chatbot assistant and presenting-control to all pages except about.html, chatbot.html, finder.html, screen.html"_, then _"have to extend the list to support all question files"_ — the **ASKING ABOUT** list offered only Presenter and Bible Reader while the help was reachable from eight windows. Both features are now mounted on all nine pages by one component, reached by **Tools → Start Controlling** / **Ctrl+Shift+P** and **Tools → App Assistant** / **Ctrl+Shift+A**; the projector, the About box and the Find bar deliberately keep neither. The menu click now goes to the window in FRONT rather than to whichever one registered the entry last — opening Settings used to take _Start Controlling_ away from the Presenter. **ASKING ABOUT** names all eight windows, and the question corpus grew three files (Bible Note, Web Editor, Lyric Editor) with the Slide Editor's own split out of the Presenter's. Verified live 2026-09-01: the overlay and the shortcut on a Settings window and on the Experiment page — neither of which had ever had them — with the accent frame correctly themed on a page that loads none of the app's own stylesheets.)

Previous: **workflowsVersion: 2026-09-01g** (**W-42 steps 6 and 9 — the ask box holds several lines, and the window can report a bug for you.** Asked for from the app with a screenshot of the ask row: _"change input text to textarea to support multiple lines"_, then _"under `Ask` add `Report`"_ — investigate first, collect the evidence, prepare it for an issue tracker — then _"ctrl+enter to ask, for normal enter just make new line"_ and _"to prevent click REPORT by accident, should confirm before running report"_. The box now grows with what is typed in it, **Enter** starts a line and **Ctrl+Enter** asks. **Report**, under **Ask**, quotes back what it is about to report before it does anything; confirmed, it photographs the app, notes the build, the window, the screens and the error log, investigates the live app and writes the report in the volunteer's place. Nothing is sent by it — there is no issue tracker connected yet, so it saves the report and the picture into Downloads and says so rather than claiming it was filed. Verified live 2026-09-01 on the presenter with ChatGPT: two reports end to end, both files on disk. New CB-32.)

Previous: **workflowsVersion: 2026-09-01f** (**W-42 steps 6 and 7, and W-19 step 7 — the help window takes more than typed words, and stays listening while it answers.** Asked for from the app: attach files and images, paste an image from the clipboard, inspect a DOM element to attach, attach a screenshot — then widened mid-request to _"during waiting for api response user should able to add more input"_ and _"for something unclear the ai should ask for more input from user"_. The box is no longer disabled while an answer is on its way: **Add** folds what you type into the answer being written, and a **Stop** gives every added word back. Five ways to attach (paperclip, paste, drop, **📷** a picture of the app, **🎯** point at a control), capped at four per question, shown as chips with an **×**. Pointing does not press: the choosing click is swallowed, so asking what **Clear Bible** does never clears the bible. Pictures live only as long as the window — the chip greys out afterwards and says so — and a model that cannot see one says so before spending anything and offers one that can. The assistant can now ask to be SHOWN, with the button beside the request. W-19 gains a **camera** in the Presenting Control that photographs the app WITH the drawing on it and offers ask / copy / save-into-images. Pressing a chip shows what it stands for — a control is ringed again by its stored selector, a picture opens big, a file opens its folder. New CB-26..CB-31.)

Previous: **workflowsVersion: 2026-09-01e** (**W-42 step 6 — an answer on its way can be stopped.** Reported from the app with a screenshot: a question was asked, "Looking it up…" appeared, and there was no way back — the box was disabled, the Ask button was disabled, and the only way out of a question asked by mistake was to wait it out or close the window. A question can take a minute (ten model rounds), and it is being paid for the whole time. The **Ask** button now becomes **Stop** while an answer is on its way, **Esc** does the same, and pressing either drops the request on the wire rather than merely ignoring what comes back. Verified live 2026-09-01 on the presenter with ChatGPT: both the button and the key ended the answer at once, the network log shows the model call `net::ERR_ABORTED` mid-round, no late answer landed, and an answer left alone still arrives as before.)

Previous: **workflowsVersion: 2026-09-01d** (**W-42 steps 10 and 11 — a third assistant, Kimi, and the settings panel now says what each key is FOR.** The AI Providers panel had two hover hints that were both wrong: they named Bible Cross Ref and Bible Audio and left out the chatbot, which both keys had been driving for a while. Each provider card now carries a **Used by** row of chips saying it plainly — OpenAI answers in the chatbot and powers Bible Cross Reference and Bible Audio, Anthropic answers and powers Bible Cross Reference, Kimi answers only — so a volunteer can tell which key is worth fetching before they go and get one. Verified live 2026-09-01 on a real Kimi key, in English and in Khmer.)

Previous: **workflowsVersion: 2026-09-01c** (**W-42 step 6 — every answer now ends with buttons you can press instead of typing.** Reported from the app with a screenshot: the assistant asked “Would you like help turning one on for the congregation?” and the only way to say yes was to type it. The assistant now finishes each answer with two or three short replies — “Yes, walk me through it”, “Which button shows it?”, “No thanks” — and pressing one sends it as your own words. When it does not offer any, the window reads the question it just asked (yes/no, or “A or B?”) and offers those; failing that, it offers the nearest questions it is ready to be asked. Verified live 2026-09-01 on the presenter with ChatGPT, and on the offline guide with no working key.)

Previous: **workflowsVersion: 2026-09-01c** (**W-42 steps 5 and 11 — the top line of the
help window is three drop-downs.** Two of the three choices were segmented
pairs of buttons while the third, the model, was already a list. Six uppercase
words spent most of a 460px window on two either/or choices, which is why the
model name arrived ellipsised — and a third assistant would not have fitted at
all. All three are drop-downs now; a provider with no key stays in the list,
greyed out and reading **needs an API key**, which is what the disabled button
used to say only on hover. Verified live 2026-09-01 on the presenter and the
reader, in both themes.)

Previous: **workflowsVersion: 2026-09-01b** (**W-42 step 14 — a walkthrough step that cannot be done for you now asks the assistant.** Reported from the app with a screenshot: the card read “I could not do that one for you (nothing on screen to act on) — do it yourself, then press Skip”, which is the end of the road for someone who pressed **Do it** precisely because they did not know what to do. 68 of the manual's 251 steps can reach that message. The card now sends the stuck step to the chat window, which looks at the live app and writes one line back onto the card. Verified live 2026-09-01 on the presenter over W-06 step 3: 6 runs in 6 came back with a usable instruction, median 13s; with the help window closed it falls back to the plain instruction at once.)

Previous: **workflowsVersion: 2026-09-01a** (**W-42 step 6 — the help window can be replied to.** Reported from the app with a screenshot: it asked “Would you like help to show a screen?”, the answer was **yes**, and it came back with “It sounds like you might need help or have a question.” Every question was being asked on its own. A tab is now one conversation — **yes**, “the second one”, “how do I turn **it** off?” all land against what was just said — while each tab keeps its own thread. Verified live 2026-09-01 on the presenter with both Claude and ChatGPT.)

Previous: **workflowsVersion: 2026-09-01** (**W-19 — on the arrow tool the Presenting Control panel is a title bar and nothing else.** The arrow is the one tool with no settings of its own, but the panel went on holding the brush panel's height: an empty box parked over the app the operator had just asked to have back. It now shows the title bar alone — and drops the collapse chevron with it, since there is nothing left to roll up — and the body comes back at the size last left the moment the brush, eraser or spotlight is picked. Steps 1-3 updated. Verified live 2026-09-01 on the reader: it opened header-only, the brush restored the saved body, and the arrow rolled it away again.)

Previous: **workflowsVersion: 2026-08-31i** (**W-42 step 12 — the help window steps aside while it is walking you through something.** Reported from the app with a screenshot: the chat window sat over the middle of the presenter while its own card told the user to press a control behind it. It now minimises itself when a walkthrough starts and comes back when the card is closed — unless it was never in the way, or the user had already minimised it. Verified live 2026-08-31 on the presenter, both directions.)

Previous: **workflowsVersion: 2026-08-31h** (**W-21 step 2 named a button that does not exist.** It told you to “use the **+** button in the folder-path bar”; there is no **+** there. Observed live on the Videos tab: the control is the **⋮ More Options** button at the right of that bar, beside the search, sort and filter icons. The step now describes it — deliberately without bolding it, because several buttons in the app carry that same title and the walkthrough would ring the wrong one. The right-click route it leads with is unchanged and is what the app's own walkthrough now performs.)

Previous: **workflowsVersion: 2026-08-31g** (**W-42: every chat tab has a menu, and a chat can be locked.** A **⋮** at the left of each tab — or a right-click on it — opens that tab’s menu: rename it, lock it, close it, **Close other chats…**, **Clear all chats…**. The last two take more than one conversation, so they ask first, on a line under the strip that says how many will go. **Lock this chat** takes the tab’s **×** away, puts a 🔒 in its place, and makes both sweeping actions step around it — so the strip can be cleared at the end of a service with the one answer worth keeping still in it. Verified live 2026-08-31 on the reader: the menu on a plain and on a locked tab, both confirmations, a solo and a clear that each left the locked tab standing, and the lock read back off disk.)

Previous: **workflowsVersion: 2026-08-31f** (**W-42: the help window holds several chats,
and each one carries its own settings.** A tab strip runs along the top — **+** for
another conversation, **×** to close one, double-click to rename one — and every tab,
its answers and its half-typed question survive closing the window and the app. The
half of the app being asked about, Claude-or-ChatGPT and the **model** all belong to the
tab rather than to the window, so one tab can be on Claude about the presenter while the
next is on a cheap model about the reader. The model is a picker now, not a caption:
three per provider with what each is good for, how quick it is and what it costs on the
hover, plus **More models…**, which asks the user's own account what else it can run.
Every answer has **Copy** and every question **Ask again**. With no key at all the
window says Claude and ChatGPT need one and offers **Open AI settings**. Verified live
2026-08-31 on the reader: two tabs kept apart, a rename, a reopen, the OpenAI catalogue
listed from the account.)

Previous: **2026-08-31e** (**W-42: the help window was redesigned.** It reads
as a cue sheet now — each turn hangs off a brass rail with its own marker, the newest
answer lit; steps in an answer are set as a numbered list with the number in the margin;
**Presenter/Bible Reader** and **Claude/ChatGPT** are compact segmented switches with the
model named beside them; and the window follows the app's dark/light theme instead of
opening white in front of a dark app. The two walkthrough buttons lost their emoji and
are now ranked — **Do it for me** filled, **Show me step by step** outlined. Verified
live 2026-08-31 in both themes.)

Previous: **2026-08-31d** (**W-42 step 9 — the help window can drive the app
for you.** Beside **Show me step by step** there is now **Do it for me**: the same
numbered card, but each press of **Do it** clicks the circled button (or types the
text) and moves on — one step per press, with **Skip** for a step you would rather do
yourself, and a plain "I could not do that one" when a step has nothing to click.
Nothing that changes what the congregation sees is done unasked. Verified live
2026-08-31 in the Bible Reader.)

Previous: **2026-08-31c** (**W-42 steps 8 and 9 — the help window can walk
you through it, and it knows which window you are in.** Every answer now offers
**Show me step by step**, which draws a numbered card inside the app itself and
circles the button each step is about — clicking that button advances the card on its
own, and steps you have already done (the tab you are already looking through) are
dropped before it starts. Answers are also scoped to the half of the app you asked
from, so the reader is never told to press the presenter's **Ctrl+B**, and the whole
window is English: the Khmer twin the manual writes beside each label is stripped out.
W-11's goal line now says it is where you look a verse up when you are not presenting.
Verified live 2026-08-31 in the Bible Reader.)

Previous: **2026-08-31b** (**W-42 steps 1 and 7 — the chatbot has a button of
its own, and you choose who answers.** It opened only from the **Help** menu; a **🤖**
button now sits in the top-right corner of both the presenter and the reader, immediately
left of the **?**, and it is absent when AI features are switched off. Inside the window,
**Claude** and **ChatGPT** are a pair of buttons under the header: whichever keys you have
set are selectable, the model that will answer is named beneath them, and the choice is
remembered. Verified live 2026-08-31 — gpt-5 answered from the manual and from the internal
notes, and a failing provider still fell back to the manual and said which one failed.)

Previous: **2026-08-31a** (**new W-41 — share a whole page of Bible Notes.** A note could only leave the app one item at a time; a whole note file — every note in it, the pictures, clips and sound files inside them, and the background attached to it — now exports as a single `.owanote.tar.gz` from the file's `⋮` and imports from the top of the **Bible Notes** panel, by dialog, by URL or by dropping the bundle on the panel. A name already in use is never overwritten: the arriving file lands beside yours as `name (1)`. W-41 step 6 also records that the single-note **Import** is no longer limited to the **Default** file — a note exported from anywhere can be imported into any note file. Verified live 2026-08-30 on the reader, plain and password-protected. **New W-42 — the built-in help chatbot**, added 2026-08-31: a Help menu window that answers from this manual and from what the app is doing right now, and can outline the control it is talking about in the real window.)

Previous: **2026-08-30i** (**W-40 steps 7-9: a mark takes you to its verse now, and a verse row can be filed somewhere else.** Clicking a mark opens the verse beside what you are reading instead of only flashing it, so you keep your place; editing a comment moved onto the mark's own `⋮`. A verse row can be dragged onto another **Bible Notes** file to move it there, marks and all — the same drag still adds the verse to **Bibles** if you drop it there instead. Everything about a marked verse is now lettered in that bible's own font, and the little panel that appears over commented words waits much longer before it goes. Verified live 2026-08-30.)

Previous: **2026-08-30h** (**W-40 step 4: the marks list wears its own marks.** A highlight under a verse row used to be a grey dot beside the words in quotes; the words themselves now carry the same wash they carry in the passage, and a commented phrase carries the same wavy underline, so the panel reads as a miniature of the page and needs no key. The verse row is led by a highlighter pen instead of a bookmark, and its count steps aside once the row is open, where the marks are already on screen. Verified live 2026-08-30, dark and light.)

Previous: **2026-08-30g** (**W-40 steps 7-10: a verse row can do more than hold marks.** It now has a `⋮` of its own, and so does every mark under it, so nothing needs a right-click to be found. Its menu adds the verse to the **Bibles** list or moves the whole row to another note file, and the row can simply be dragged onto a bible file instead. “Move To” had never worked anywhere in Bible Notes — it always said `No other notes found` — and does now. The marking toolbar also follows the app's dark/light setting; it used to come up white on the dark reader. Verified live 2026-08-30.)

Previous: **2026-08-30f** (**new W-40 — mark up a passage while you study it.** Selecting words in a passage now raises a small toolbar: six highlighter colours, a comment button and an eraser. What you mark is kept in your own **Bible Notes**, under a row for that verse, so it is there next time you open the app and travels with your notes when you back them up. Hovering commented words shows the note with buttons to edit or delete it. Verified live 2026-08-30 on the reader, Genesis 22:1.)

Previous: **2026-08-30e** (**new W-39 — the passage can scroll itself, and now says how.** The double chevron under a long passage has always taken four different mouse actions - click, double-click, right-click, Alt + right-click - and named them only in a tooltip that vanishes the moment it starts moving. A **⋯** now appears beside it while it is scrolling and lists all four with the action written next to each, so they can be found, and used on a touch screen. Verified live 2026-08-30.)

Previous: **2026-08-30d** (**W-01b step 1: the `⋮` rests much quieter.** It now sits at the same near-silent alpha as the colour note beside it and comes to full strength on hover, so a long list reads as its names rather than as a column of buttons. Verified live 2026-08-30.)

Previous: **2026-08-30c** (**W-01b step 1: the `⋮` buttons line up.** They now share one size and one column down a list, each level with its own row, and a folder's own `⋮` stays on its name rather than drifting down among the files it holds. Verified live 2026-08-30.)

Previous: **2026-08-30b** (**new W-01b — the `⋮` button, app-wide.** Every surface whose extra actions were reachable only by right-clicking it now carries a visible `⋮` that opens the same menu — file rows, bible items and notes, lookup records and history, bible views, slide previews, background cards and rows, presenting flow lines and preview frames, screen previews, graph boxes, Resources folders and files, cross-reference cards, the foreground buttons' choose-a-screen menu, the verse audio player and canvas item cards. Right-click is unchanged. W-29 step 6 and W-38 step 2 now point at it rather than describing a right-click as the only way in. Verified live 2026-08-30 on the reader.)

Previous: **2026-08-30a** (**W-38 step 2 and W-29 step 6: a lookup row's menu has a button now, and a record window shows its kind in the body.** **Open Graph Preview** was reachable only by right-clicking the row — invisible unless you knew to try it, and out of reach without a right mouse button; every row in the lookup list and in the **names and locations in your reading** panel now carries a **⋮** that opens the same menu. The person/place/book icon that used to sit in a record window's title bar, crowded against its buttons, now leads the description it describes. Verified live 2026-08-30, km.)

Previous: **2026-08-29t** (**W-38 steps 5 and 10: opening a record always starts
fresh, and a box can be made the centre or the new starting point.** The graph no longer
resumes an invisible "last session" — clicking `David` gave you back whatever that window
had drifted into, which after a path or a re-root was somebody else's family under David's
name. It now opens one box, that record, every time; **Save preset** is how you keep an
arrangement. A box's right-click menu gains **Use as root** (clear the rest away and carry
on from this box) beside **Set as centre**, which now re-fans the graph around the box and
brings it into view instead of throwing it into the top-left corner. Verified live
2026-08-29, km.)

Previous: **2026-08-29s** (**W-38 step 8: Find Connection asks for ONE name, not
two.** The path always starts at the graph's own centre box — shown as a chip you cannot
type over — so you only say where you want to get to; the _Path from_ field and the swap
button are gone. Every name the picker offers now carries its English name beside it
(_ដាវីឌ (David)_), the way the lookup list and the boxes already did — eight Khmer names
beginning alike were unpickable. Step 10: reopening a record whose window you ran a path in
now starts you back at that record instead of at somebody else's family line. Verified live
2026-08-29, km.)

Previous: **2026-08-29r** (**W-38 step 7: the Connection Graph now has Undo and
Redo, and Re-layout tidies a path properly.** Every move is reversible — a dragged box, a
zoom, an expansion, a filter — from the two dock buttons or **Ctrl+Z** / **Ctrl+Y**, with a
whole wheel gesture counting as one step. **Re-layout** (now a ✨ wand, which no longer
reads as "reload") rebuilds a found path as its chain instead of spiralling 32 generations
into rings, and always brings the result back into view; it used to leave the graph in the
top-left corner. The panel is also written in the record's own language throughout — title
bar, chips, boxes and the curved edge labels — the title follows the graph's centre when a
path or a re-root changes it, and you can now zoom to 500%. Verified live 2026-08-29, km.)

Previous: **2026-08-29q** (**W-38 step 5: a box in the Connection Graph now has
a right-click menu, and its verse list reads in your own Bible.** The menu carries what the
box's own small buttons carry — _Open detail_, _Verses_, _Open all Related_, _Collapse_,
_Set as centre_, _Remove_ — reachable from anywhere on the box, including a collapsed one,
which draws no buttons at all; rows that would do nothing are left out rather than greyed,
and the press starts neither a box drag nor a canvas pan. The 📖 count beside it used to
list raw keys like `GEN 24:29-30`; it now names each verse the way the Bible you are reading
names it, _លោកុប្បត្តិ ២៤:២៩-៣០_, ranges and all. Previous entry: **W-38: a new Connection Graph shows a person or place and
everything it is related to as boxes you can explore.** Verified live 2026-08-29, km.)

Previous: **2026-08-29p** (**W-38: a new Connection Graph shows a person or place and everything it is related to as boxes you can explore, and can find the line between two people.** Previous entry: **W-29 steps 2 and 3, and W-30 step 3: a
translated name now carries its English name beside it, and you can search in either
language.** A Khmer record reads _ម៉ូសេ (Moses)_ the way a Bible book reads _លោកុប្បត្តិ
(Genesis)_ — in the lookup list, in the "in your reading" panel, across the top of a record
window, and in what the copy button copies — so a name you only know in English is still
recognizable. Typing `Moses` finds him with Khmer records on screen, and typing `ម៉ូសេ` still
does; the same holds for places. With **English** chosen nothing is added, because the name
already is the English one. Verified live 2026-08-29, km and en, names and locations.)

Previous: **2026-08-29n** (**W-13 rewritten: the Cross Reference view is
restyled and now says what it holds.** The wall of bordered boxes is gone — references are
grouped under their theme, hanging off one vertical rail, in reflowing columns, with a
**7 Themes · 35 Verses** count above them; pointing at a verse lights its segment of the
rail. The heading's lightbulb split into `bi-cpu` (a model wrote this) on the section and
`bi-translate` (this heading was machine-translated) on the headings that really were —
it used to show on every heading in every language, English included. Verse previews cut at
a word with one `…` instead of always appending `...`. The empty view says **No verse
selected** and what to do, and the row tooltip says **Open beside the current verse**, which
is what a click has always actually done. Rows take the keyboard. Verified live
2026-08-29, dark and light, English and Khmer.)
Previous: **2026-08-29m** (**W-12 rewritten: Bible Find tells you how many
verses it found, and marks the word it found.** The matched word is now highlighted in the
app's accent with an underline, so you can see at a glance WHY each verse is listed; the
reference beside it steps back to a quiet marker. The footer leads with **N verses found** and
no longer prints a button for every page — a common word runs to 1500-odd pages, and all of
them were drawn at once. The book filter is plain while it says **All Books** and only lights
up, with a funnel, once you have narrowed the search. Verified live 2026-08-29, dark and
light. Revised the same day: the **…** in the block numbers is clickable and opens the
blocks it hides, and a result's reference is set at full contrast — it is the column the eye
runs down, so it has to be read, not glanced past.)
Previous: **2026-08-29k** (**W-37 steps 2, 4 and 7 restyled: the Resources
view is now a list, not a stack of boxes.** Each folder is a header line with the folder it
lives in shown beside its name — two shelves both called `pdf` can finally be told apart —
and its files hang off a single vertical rail instead of each sitting in its own outlined
box. The pattern line is now two readable chips: the chapter you are on, and the dashed
book-level one. A file that matched the book-level half carries a dashed **[en:tran:Introduction]** tag, so a `1CH.0.pdf` listed under chapter 1 explains itself. Nothing moved
and no control changed. Verified live 2026-08-29, dark and light.)
Previous: **2026-08-29j** (**W-29 step 8: a record that names a book, a chapter or a
verse in its description now names it the way YOUR Bible does.** Those mentions ship written in
English whatever language the record is in, so a Khmer sentence used to strand `Genesis 14` in the
middle of it; under any language but English they are now re-read from the Bible on screen —
_លោកុប្បត្តិ ១៤_ — with book and chapter mentions staying part of the sentence and a cited verse still
opening like any other reference. Verified live 2026-08-29 in Khmer and English.)
Previous: **2026-08-29i** (**W-29 steps 2 and 9, and W-30's note: with a non-English
lookup language the verse references now read in YOUR Bible.** A Khmer record citing
`Genesis 10:4` in English beside its own Khmer prose was unreadable to exactly the person who
chose Khmer; a record's citations, the verse window it opens, the passage heading in
"in your reading" and the reference the eye button loads now all name the passage the way the
Bible on screen does, and the **(KJV)** note on that heading is dropped when it would no longer
be true. English still means King James, which is the Bible these records were built from. What
the lists FIND is read from the King James text either way. Verified live 2026-08-29, Khmer and
English both ways round.)
Previous: **2026-08-29h** (**W-37 new step 5: search your folders by file name.**
The magnifier at the right of the pattern line opens a box; type any part of a name and every
matching file in your folders is listed under the verse's own files, marked `*what you typed*`.
Your verse files stay where they were. `abc*` and `abc` do the same thing, and at most 200
extra files per folder are listed. Verified live 2026-08-29. New matrix rows RD-89, RD-90.)
Previous: **2026-08-29g** (**W-37 steps 3 and 6: the Resources view gains
**Reload**, and its whole body is right-clickable.** Reload re-reads your folder list and
every folder's files in one go — the per-folder **Refresh** is still there for one folder.
The `⋮` button is now titled **More Options**, and a right-click in the empty space below
the folder boxes opens that menu too, where before it did nothing.
New matrix row RD-88; RD-82 updated.)
Previous: **2026-08-29f** (**W-37: chapter `0` means the whole BOOK.** `PSA.0.pdf` is
your introduction to the Psalms and is now listed for every chapter of the Psalms, above that
chapter's own files; `-1`, `-2` … count as book-level too, for a second or third such
document. The pattern the panel prints names both halves now (`PSA.1.* · PSA.0.*`) and says
why on hover. Re-verified live 2026-08-29 across Psalm 1, Psalm 119 and 1 Chronicles 1 —
each shows its book's intro and its own chapter, and nothing from another book. Matrix row
RD-84 rewritten, RD-81 hint updated.)
Previous: **2026-08-29e** (**W-37 corrected: Resources matches by BOOK AND CHAPTER,
`<book key>.<chapter>.*`, not by verse.** Material is filed one file per chapter
(`PSA.1.pdf`, `PSA.119.pdf`), so every verse of a chapter shows the same files and the verse
only decides the heading. The numbering note is rewritten around the collision that actually
bites — Psalm 1 must not also list `PSA.10.pdf` and `PSA.100…149.pdf`. Re-verified live
2026-08-29. Matrix row RD-84 rewritten, RD-81 hint updated.)
Previous: **2026-08-29d** (**new W-37 — keep your own files beside the verse.**
If you already file sermon material on disk named after the verse it belongs to
(`PSA.1.pdf`), the new **Resources** view in the advanced bible lookup shows exactly those
files for whatever verse you are on, from as many folders as you care to add, and opens one in
its own application with a click. Verified live 2026-08-29 against a real 1255-file library —
(the match rule that shipped is the corrected one in 29e above). New matrix rows
RD-81..RD-87 and CM-93; RD-41 updated.)
Previous: **2026-08-29c** (**W-29 step 2: the name across the top of a record window
follows the lookup font too.** That title sits in the window's frame rather than its body, so
it was the one place a Khmer record name still came out in a fallback face. Verified live
2026-08-29. Previous: **W-29 step 2 and step 4 say more: the lookup language
now decides the SCRIPT and FONT the records are set in, and names each record's kind in it.**
Khmer records were being rendered in whatever font the system fell back to rather than the
app's own Khmer face, and the kind of a record — People / Groups / Places — stayed English in
the filter and on the record even with Khmer records on screen, because the datasets keep that
field in English in every language. Both now follow the lookup language. A new closing note
says what is NOT translated and why: Gender, Age and a place's Type are free-form dataset text,
not a fixed set. Verified live 2026-08-29 with km under an English interface. Previous:
**W-29 gains step 2, and W-30 a note: the
names-and-locations lookup now has a LANGUAGE of its own.** The person-and-pin button grew a
second half showing the lookup dataset's language code (`en`); clicking it lists every
language the app ships records in and picking one switches the floating panel, every record
window already open, and the "in your reading" list at once, with nothing to reload. It is
remembered, and it is a SEPARATE choice from the app's own language (W-16) — an English
interface with Khmer names is normal. The underlined names inside the King James verses do
NOT follow it: those match King James wording, which is what makes them findable. Verified
live 2026-08-29 on the reader — en→km→en with a record window open the whole time, the
underlines unchanged throughout. W-29's old steps 2..11 are now 3..12; the IDs are stable.
New matrix row RD-80; RD-53 updated.)
Previous: **2026-08-24** (**new W-35 — bring a song in from CCLI SongSelect.**
Settings → Others gains a **SongSelect Integration** card (credentials saved on blur, OAuth
**Sign In** opening a real CCLI window, **Sign Out**), and while signed in the Documents
list menu carries **Import From SongSelect**: a floating search panel that
downloads a song's lyrics and lands them as a ready-to-present `.owl` lyric document.
Driven live 2026-08-24 against a stand-in SongSelect server (CCLI retired new partner
signups, so no real credentials): card + saves + Sign-In gating, the canceled-sign-in toast,
the gated menu entry following the signed-in state with no reload, debounced search with
pagination and disabled unauthorized rows, an import previewing slide-per-part, and
duplicate-import suffixing. The completed hand-off on CCLI's real consent page is
source-verified only, and W-35 says so.
**Same-day addendum: new W-36 — import a public domain song, no account needed.** The
Documents list menu now always carries **Import From Public Domain Songs**:
a floating panel over a 36-hymn catalog embedded in the app (texts fetched from
hymnary.org / The Cyber Hymnal and validated against open-lyric), browsable with no typing,
filtered as you type, one click to land a ready-to-present `.owl` whose slides follow the
real singing order (chorus repeated after every verse). Driven live 2026-08-24: menu entry
present with SongSelect signed out and in, all 36 rows with count badge, instant filter,
Blessed Assurance imported (`Structure: V1CV2CV3C`) and previewing Verse 1 → Chorus →
Verse 2 → Chorus → Verse 3 → Chorus.
New matrix rows ST-52, PL-103, PL-104, PL-105.
**Same-day addendum: the `Add Items` sub menu is gone.** Every way of filling a file list —
**Add Local Files**, **Import**, **Import From URL**, **Download From URL**,
**Import From Public Domain Songs**, **Import From SongSelect**, **Paste Image**,
**Add URL** — now sits directly in the list menu (**⋮ More Options**, or a right-click on
the empty list body) instead of one step down, so every one of them is a single click and an
empty folder advertises all of them as its own buttons. Nothing was added or removed, only
un-nested; the background tabs also stop listing their download entries twice. Every
`Add Items → X` step below is now just `X`. Driven live 2026-08-24 over the Documents list
and the Colors/Images/Videos/Webs/Audios background tabs.
**Same-day addendum: an imported public domain song keeps a link to where its words came
from — W-36 step 4 rewritten.** Every hymn in the catalog now stores the hymnary.org page
its text was transcribed from, and the import saves that link with the document, so the
song ends with one extra slide named **Hymnary.org** showing that page. Driven live
2026-08-24: an imported Amazing Grace previewed Info → Verse 1-4 → **Hymnary.org**, the
slide showing hymnary.org's "Amazing grace! (how sweet the sound)" page.)
Previous: **2026-08-22** (**W-34 gains the "Putting the KJV back" note — the
KJV row now has a Reset Bible XML button.** Only the row whose code is `KJV` shows it; it
replaces that translation with the copy embedded in the app, the same data the empty-state
**Create KJV Bible XML** writes, and it is destructive with no undo. Verified live
2026-08-22 in the Setting window: present on KJV and on none of the other 20 installed
bibles, confirm wording as quoted, file replaced, reader re-read from it. The same note
gained a "Deleted it by mistake?" half: **Create KJV Bible XML** is no longer only the
first-run empty-state offer — it is the FIRST ROW of the **Bibles XML** list whenever that
list has no KJV, so a trashed KJV is one click from coming back. Verified live 2026-08-22
with the KJV trashed: the list led with the row, the click rebuilt the translation, the row
then went away.
New matrix row ST-51; ST-28 rewritten.)
Previous: **2026-08-12** (**W-30 step 1: the advance-lookup panel's three tabs are
now ONE drop-down.** **Find** / **Cross Reference** / **Location-Name (KJV)** never fitted the
narrow panel — the third label sat permanently cut off as "Location-Name (K…" and the old step
had to tell the reader the tab strip scrolls sideways. The header now holds a single `select`
with the active view's icon beside it, so every name reads in full at any panel width. Nothing
else about the panel changed. Verified live 2026-08-12 on the reader.)
Previous: **2026-08-11b** (**W-16's language step: each language is now listed under
its OWN name (`English`, `ខ្មែរ`) instead of being translated into whatever locale is in
force.** The person who needs the picker most is the one who cannot read the current script —
a list translated into it offered them no way back. The button's `title` still carries the
English name. NOT yet re-verified live; the previous entry's claims were.)
Previous: **2026-08-11** (**W-05 gains the two steps an operator actually asks about
while a song is on screen: edits made elsewhere show up by themselves, and where the manual
**Reload** lives.** A song edited in the Lyric Editor — or in another window, or by anything
that writes the file — now refreshes the **Stage Previewer** verses on its own, every stage,
without re-picking the song; before, the rendered song at the top refreshed while the verses
under it kept the pre-edit text for minutes. The Stage Previewer header also grew a **⋮** with
**Reload** in it, which re-renders every stage at once. Verified live 2026-08-11 (XW-08,
PM-127).)
Previous: **2026-08-10d** (**new W-34 — "Add a Bible translation from the internet
(XML), and make it read in its own language"**. W-33 moves translations you already have;
this ADDS a new one from a link, entirely in the UI — the flow that produced `ពគប`. Driven
live end to end on `github.com/Beblia/Holy-Bible-XML-Format/…/KhmerBFBSBible.xml`. Two halves
are worth reading twice. (1) An XML from the internet usually carries no short code, so the
app asks with a row of **Guessing keys** buttons built from the words in the file's own
header — the Beblia files leave a bible.com address there ending in `…GEN.23.ពគប`, which is
literally where that badge came from — and since the code is also the file name it has to be
settled at import time. (2) A raw import lands on **English**: English book names, `1 2 3`,
and the translation filed under English in the bible menu. The three right-click commands in
the **Info** editor (**🌎 Choose Locale**, **#️⃣ Edit Numbers Map**, **📚 Edit Books Map**) fix
that, **in that order** — the numbers and the book-name suggestions are both derived from the
locale set first — and **📖 Guessing Names** fills all 66 Khmer book names from the sets the
app ships. Proof it worked is in the reader: the translation leaves the English group and its
references render `(ពគប) កិច្ចការ ២៨:១៥`.)
Previous: **2026-08-10c** (**the mistyped-password panel now comes BACK holding what
you typed and ticked.** W-33 step 3 and W-21 step 10a used to promise that a mismatch "can
never quietly produce an unprotected file" — on Export Data and Export Bible Data it could,
because the panel was re-opened through an alert that wiped both the password fields and the
selection. Fixed 2026-08-10; the wording now says what the operator actually sees.)
Previous: **2026-08-10b** (**new W-33 — "Share your Bible translations (XML) with
another machine"**. W-24 already shared a bible LIST (verse references); this shares the
translations themselves, which until now could only be moved by digging the files out of
the app-managed bibles folder by hand. Settings → Bible grows a **[en:tran:Bible Data]** card under **Import XML File**, with the same picker + optional
password every other export uses, and the whole Bible XML page accepts the bundle as a
drop. Observed live in **both locales** on 20 installed translations — including the four
Khmer-keyed ones (`គកស១៦`, `គខប`, `ពគប`, `អគត`), which is exactly the case a translated row
label would have blanked the popup on. The part worth reading twice is step 6: an import
never overwrites and never makes a second copy, so a bible it cannot take becomes a red,
un-tickable row naming the reason — key already exists (upper/lower case are the same key),
duplicate key inside the bundle, or a file whose key cannot be read.)
Previous: **2026-08-10** (**new W-32 — "See who published a Bible translation
(and its copyright)"**. The bible pane header now carries an **ⓘ Bible Information**
button while no verse has resolved — in the book grid AND the chapter grid — opening a
read-only card with the edition's title, key, version, locale, publisher, copyright,
legal note, description and book count. It replaces the Settings → Bible → pencil →
**Info** detour for reading (editing still lives there). Observed live on
`Khmer BFBS (ព្រះគម្ពីរបរិសុទ្ធ ១៩៥៤)` in **both locales**: the button appears with an
empty lookup box, survives picking a book, and disappears the moment a chapter resolves
and the verse buttons take its slot; Escape and ✕ both close it without disturbing the
grid. A web address inside any of those values (publishers put their site in the
copyright or legal note) renders as a link and opens in the system browser, leaving the
app where it is.)
Previous: **2026-08-09c** (**new W-31 — "Hide, show, and reset the app's panels
(View menu)"**. Every collapsible panel now registers itself into a native
**View → Widgets** submenu as a tick-box that opens/closes it by name, and
**Reset Widgets Size moved out of Settings onto the View menu**, where it applies
immediately instead of waiting for an **Apply Settings** reload — and it also reopens
every panel that was collapsed. Observed live on the reader (4 widgets: toggled
`Bible Notes` open and `Bibles` closed with no reload) and on the presenter (13 widgets,
15 with an `.ows` document selected); the reset restored all four reader panes to
`1/1/1/4` and reopened the collapsed one. **W-16**'s reset-button bullet is corrected in
the same pass. Driven live in both locales.)
Previous: **2026-08-09b** (**new W-30 — "See who and where is in the passage you
are reading"**, the `Location-Name (KJV)` tab added beside **Find** and **Cross Reference**
in the advanced bible-lookup panel. It lists every person and place the Bible names in the
verses currently open, one block per passage, and each row opens the same record window
W-29 teaches. Observed live on KJV Luke 13:1-35 + a Khmer Genesis 3:5-9 side by side:
Names (6) / Locations (2) for Luke, Names (1) for Genesis, and clicking **Pilate** opened
his record. The list also carries people the verse means without naming — Satan in
Luke 13:16, which reads "the devil".)
Previous: **2026-08-09** (**every floating window maximizes on a double-click of
its title bar**, and goes back to the size and place it had on a second one. Added to
**W-26** step 3 and **W-19** step 1 (the two places that teach the floating-window chrome)
and to **W-29** step 1. Observed live on the Names & locations lookup: a 377×560 window at
the right edge filled the whole app window, and the next double-click put it back exactly.
The maximized size is deliberately NOT remembered — a window closed while maximized
reopens at the size you last dragged it to — and resizing it by an edge ends the
maximized state.)
Previous: **2026-08-08i** (**new W-29 — the Names & locations lookup**: the
person-and-pin button at the end of the Bible reference box opens a searchable browser
over the biblical names and places, with per-record windows, reference chasing between
them, verse text, a map for places that have coordinates, and a copy button. Every step
was observed on the live app in BOTH locales; the Khmer labels quoted in the recipe are
the ones the app actually rendered.)
Previous: **2026-08-08h** (**W-24** gains step 5 and **W-28**'s table is
reworded: a **website box now shows a screenshot of the page, not the running page**,
everywhere you edit and preview. Hover it for ~1s to see it live; right-click →
**Refresh Preview** to re-take the picture (it never updates itself). The audience
screen still shows the real live page. Same rule for a **web background**: a picture on
the presenter's mini screen, the live page on the projected screen — with no
hover-to-live there, because the background layer never receives the pointer.
Previous: **2026-08-08g** (**W-17** rewritten: the Finder is no longer a separate
popup window. **Ctrl/⌘+F** now drops a **Find bar** into the top-right of the window
being searched — pinned inside that window rather than floating over it — with a
`current/total` match counter, **Shift+Enter** for the previous match and a grip that
drags it sideways. It is drawn as app chrome, so the query never matches itself.)
Previous: **2026-08-08f** (new **W-28**: anything in the bottom **Background** panel
can now be **dragged straight onto the Slide Editor canvas** to become a box — an image,
video, audio, web page, camera or colour. A colour dropped **on** an existing box recolours
that box instead of covering it. **Driven live** (all six kinds dropped, each landing centred
on the cursor; the YouTube URL came in as a real YouTube box, the camera kept its device
name, and Undo took every one of them back). **W-15** step 4 corrected with it: the tools
panel is a select list, never a drag source. Previous: **2026-08-08e**
(**W-22** step 5, **Media Control**: moving off the slide
now STOPS what it started — putting another slide on that screen, or clearing it, pauses the
slide's media and drops anything still waiting. A running order that plays a slide's audio
could not move on before: the swap was refused with **Media is Playing**, which is still what
a clip you started BY HAND gets. **Driven live** (slide 1's audio playing under a
**Media Control (Play)**, slide 2 presented on the same screen: it landed, the audio paused,
no toast). Previous: **2026-08-08d** (**W-22** step 8: a **Next: Timeout** attached to a line
as a CC element can now be given **its own wait**, from the stopwatch at the right of that
CC row or its **Change Timing** menu entry — the answer belongs to that attachment, so one
timeout can hold one line for 4 seconds and another for 30. Filled stopwatch = its own
wait, hollow = still following the element; **Use Element Timing** hands it back. **Driven
live** (4s override counted 4→3→2→1 while the element stayed at 10, then reset).
Previous: **2026-08-08c** (**W-22** step 9: the running-order preview panel is no
longer one-at-a-time — **several may be open together, one per running order**, each with
its own place on screen, its own folding, its own marker and its own countdown, and each
closed on its own. Opening a second used to close the first and lose where its run had got
to. The thumbnail zoom stays shared across them. **Driven live** (two panels open side by
side, independent markers, independent rects, one closed while the other stayed).
Previous: **2026-08-08b** (**W-22** step 5 gained **Media Control** — a
running order can now play, pause or stop the video or song _inside_ a slide by itself:
wait N seconds, start at a point of the clip, stop after a while or at a point of the clip,
at a volume and a speed. It is attached to the slide it controls (**Add Media Control**,
beside **Add CC Elements**) rather than added to the sheet, its settings belong to that one
attachment, and a screen pin on it narrows where the slide went rather than redirecting it.
**Driven live.** Previous: **2026-08-08a** (**W-22** step 2: a fifth run action,
**Next: Clear Interval** — the loop's off switch written as a line of the running order.
An interval could only be stopped by hand (the pill, closing the panel, the end of the
sheet); now a sheet can stop its own loop, wait, and be picked up again. It asks nothing
when you add it, ends a running or paused interval and only an interval, and does nothing
— silently — when there is no loop to end. **Driven live.** Previous:
**2026-08-08** (**W-22** step 2: **Add Action** now opens with one
**Clear Screen** row instead of six clearing rows — the five clears and the per-widget
**Other Clear FG Items** row moved inside it, so the menu opens on the choice between
clearing something, putting the screen up or down, and moving the run on. Nothing was
renamed or removed, and sheets already written are untouched. **Driven live.** Earlier:
**2026-08-07g** (**W-26** amended: **Ctrl** (**⌘**) **+ click** a
Documents row is now a shortcut for **Open Slides Preview** — it toggles that document's
floating window without selecting the document, and does nothing on the row that is
already in the middle panel. **Driven live.** Earlier:
**2026-08-07f** (new **W-27**: the middle **Documents** tab heading now
carries a **pin** whenever a document is being previewed. Pinned, the previewer cannot be
swapped by anything the operator clicks — another Documents/Lyrics row, a document inside a
presenting flow, or the file name in the previewer footer — each one is refused with a toast and a
flash of the pin instead. A rename still follows, trashing the document unpins it, and the
pin is remembered across a restart. **Driven live, in both locales.** Earlier:
**2026-08-07e** (**W-26**: a Documents row's right-click menu now
offers **Open Slides Preview**, which gives that document its own floating previewer —
the full one, editing strip and Note boxes included — so several documents can be looked
at at once. One window per document, each with its own zoom and its own remembered
position/size, and each answering the arrow keys only while it has focus. A document is
previewed in ONE place: the entry is greyed out on the selected document, and selecting a
document that has a window closes that window. **Driven live, in both locales.** Earlier:
**2026-08-07d** (**W-05** steps 6-9: every stage chip in the Stage
Previewer now carries a **⚙** that opens a draggable **Stage Style** window — Slide
Padding, Background Opacity, Extra Font Size, Light/Dark and a Custom CSS box, plus
Reset. The settings belong to the STAGE and apply to every song, so two stages can look
completely different; Custom CSS is added to the stage's built-in look rather than
replacing it. A screen already showing a slide keeps it until the slide is presented
again. **Driven live, in both locales.** Earlier: **2026-08-07c** (**every** export now opens a panel first, asking for an
optional **Password** + **Confirm Password** — **W-22** step 10/10a (presenting flow), **W-23**
step 2 (document/lyric), **W-24** step 1 (bible list) and **W-25** step 2a (whole data).
Leaving both empty writes exactly the bundle it always did; a password writes `.enc`
instead of `.tar.gz`/`.tar` and import asks for it, with three tries. There is no password
recovery. **Driven live, in both locales.** Earlier: **2026-08-07b** — **W-25** step 2: the Export Data panel now also lists
**Background Webs** and **Bibles XML** — two folders a "back up everything" run used to
leave out. Bibles XML carries only the bible XML files you added yourself, not the
downloaded Bible versions, which you re-download on the new machine. **Driven live.**
Earlier: **2026-08-07a** — **W-05** steps 4-5: a song's `- Attachments:` links
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
— a **shortcut you set by pressing it** (Ctrl/Shift only, at least one, unique per presenting flow)
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
attaching). Previous: **W-22** step 2: a third run action, **[en:tran:Jump to]** — the one way a running order goes anywhere but forward. You point it at another
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
the preview panel. Both work only while that presenting flow's **preview panel** is open — it is
the panel that walks the run — and elsewhere they say so rather than pretend. **Driven
live end to end** (armed, cancelled, handed an interval over to a timeout, stopped by the
pill, and the toast with the panel closed; presenting flow restored afterwards) — see PL-95.
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
longer adds an element to the presenting flow** — step 2 now says to drop onto the presenting flow's NAME
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
arrow/Space keys step past it. Parking is stored per presenting flow, so the same song stays live
in another service. **Driven live 2026-08-05**: parked and released an element, a document
(its slides parked with it) and a single slide, in the tree and in the floating preview.
Previous: **W-22** gained **Set Specific Screen** — a presenting flow
line, a document line, or one slide of a document can be PINNED to particular screens, and
every present from the panel then ignores which mini screens are selected. Drag-onto-a-mini-screen
and **Show on Screens** still override a pin on purpose; a pinned screen that is gone
toasts rather than projecting elsewhere. **Driven live end to end** on 2026-08-05 across
three screens: pin persisted into the `.owpf`, beat the selected screen from the tree row,
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
slides, and its colour note. It behaves exactly like the presenting flow bundle in W-22 because
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
step 11: the Presenting Flows list menu now also offers **[en:tran:Import From URL]**, so a
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
**screen actions**: a presenting flow can now hold something to _do_ as well as things to show.
Its step 2 covers **[en:tran:Add Action]** and the five clears it offers, step 4
that an action is _run_ on a screen (click / drag onto one mini screen / **Apply on
Screens**) rather than shown on one — and so never lights up as live — and step 8 that the
floating preview's next-key stops on an action and fires it, so a **Clear All** dropped
between the last song and the sermon blanks the screen at exactly that point.
**Driven live end to end** (both locales, real `screen.html` output, presenting flow restored
afterwards) — see PL-71..73. Previously: **W-22 is no longer
a development-only workflow**: commit `203d35cc` removed the `isDev` gate, so the
**Presenting Flows** panel ships in packaged builds too (it took the slot the separate **Lyrics**
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
(PL-46). Previously: the presenting flow
sharing workflow's import step now also accepts the `.owapf.tar.gz` **dropped straight
onto the Presenting Flows list** (PL-45), not only the list menu's **Import** entry.
Previously: **every file list
now has one button, a gray ⋮ (More Options)**, opening the same menu as right-clicking
the empty list body; the old **↻ Reload** and **+ Add items** icons next to the folder
path are gone (Reload is the menu's first entry). Lists with a title bar put the ⋮
there; the background / foreground-web tabs put it in the path row. **W-15** gains the
lyric/document _creation_ step — the Documents list offers **New App Document** and
**New Lyric** as two direct entries (all observed live, English and Khmer); W-08's Web
tab step now points at the ⋮ instead of the `+`. Previously: new **W-22** (build a
service presenting flow and export/import it as a `.owapf.tar.gz` bundle); its step 7 now says
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

- **Header:** page tabs — **Presenter** / **[en:tran:Bible Reader]** /
  **[en:tran:Slide Editor]** — the **[en:tran:Bible Lookup]** button
  (center, `Ctrl+B`), and the **[en:tran:Settings]** gear + Help buttons (right). 📸
- **Left column:** your content libraries — the **[en:tran:Documents]** list (songs live
  here too, marked with a music note) and **Presenting Flows**.
- **Middle column:** the working area — **Documents / Bibles** preview tabs plus the
  **Foreground** button on top, and the collapsible **Background** panel at the bottom.
  The Documents tab shows whatever kind of file you picked: slides for a slide document,
  pages for a PDF, and the song view for a lyric.
- **Right column:** **Bibles / Notes** lists and the **mini screen** — a live preview
  of exactly what the audience sees, with clear buttons and a zoom slider under it.

Drag any divider between panels to resize them; the size is remembered. 📸

_Verify: GL-12, NAV-01..02, PL-01, PR-04._

### W-01b — The `⋮` button: everything a thing can do

**Goal:** find the actions that used to be hidden behind a right-click.

Almost everything in the app — a file in a list, a Bible verse in your reading list, a
note, a slide, a background, a line of a presenting flow, a screen preview, a folder in
**Resources**, a box in a connection graph — has more it can do than the click on it
does. Those extras live in a small menu.

1. Look at the right-hand end of the row, or the top-right of the card. There is a
   very faint **`⋮`** there — as quiet as the colour-note dot beside it, and it comes up to full
   strength as soon as you point at it. In a list they
   line up in a straight column down the right edge, each one level with the row it
   belongs to; a folder keeps its own `⋮` up on its name, beside the ones belonging to
   the files inside it. 📸
2. **Click it.** The menu opens right at the button — the same menu you get by
   **right-clicking** the row itself, which still works exactly as before.
   > Clicking `⋮` does NOT also do what clicking the row does: a document you open the
   > menu on is not selected, and a slide is not sent to a screen.
3. Pick an entry, or click anywhere else to close the menu without choosing.

> **Why it is there.** A right-click cannot be done on a touch screen, and some
> machines and browsers keep that button for a menu of their own. The `⋮` is the same
> menu with a button you can see.

_Verify: GL-24, GL-06._

### W-02 — Switch between the main pages

**Goal:** move between Presenter, Bible Reader, and Slide Editor.

1. Click a header tab — the window switches to that page in place.
2. The **Slide Editor** tab opens the editor only for a selected slide document:
   select one in the left list first (W-03), then click the tab; with nothing
   selected the app shows an alert ("No slide selected") and stays put.

_Verify: NAV-01..04._

---

## Presenting content

### W-03 — Present a slide from a document

**Goal:** put a slide on the screen.
**Preconditions:** at least one document in the **Documents** list.

1. In the left column, click a document in the **[en:tran:Documents]** list. It
   highlights, and its slides appear as thumbnails in the middle **Documents** tab. 📸
2. **Double-click** a slide thumbnail. The slide goes live: it appears on the mini
   screen, and the live item is marked highlighted (on-screen indicator). 📸
3. To step through slides with the keyboard, click once in the thumbnail area, then use
   **Arrow keys / PageUp / PageDown**; **Space** toggles the focused slide.
4. To remove the slide from the screen, press **F8** ([en:tran:Clear Slide]) or click
   the matching clear button under the mini screen.

Tips:

- The slider in the Documents-tab footer resizes the thumbnails.
- The stopwatch icon in the same footer opens **auto-play**: set seconds, press play,
  and slides advance automatically; the red ✕ closes it (W-04).
- **Pin the document so you cannot lose it by a stray click** — see W-27.

_Verify: PL-01, PM-05..09, KB-05, KB-08._

### W-04 — Auto-play slides on a timer

**Goal:** advance slides hands-free.

1. Open a document's slides (W-03 step 1).
2. Click the **stopwatch icon** at the bottom left of the slides previewer — a small
   strip opens: **✕**, play, the seconds box, the countdown, and a sliders button. 📸
3. Type the interval in seconds, then click **play**. Slides advance on the timer and
   the countdown says how long until the next one.
4. To change how it advances, click the **sliders** button. The rules open under the
   strip:
   - **[en:tran:Repeat All]** — keep going round. Unticked, the show stops at the last
     slide and leaves it on the screen.
   - **[en:tran:Step]** — how many slides each tick jumps.
   - **[en:tran:Random Up To]** — wait a random whole number of seconds up to this,
     drawn fresh for each slide. The draw is written into the seconds box before each
     wait, so you can see what it chose.
   - **[en:tran:Wait Until The Video Ends]** — clips only (Video Show, and a Videos
     background list): wait the length of the clip that is up. The seconds box shows
     that length.

   Close the rules with their **✕** or the sliders button again.

5. Click **pause** to stop, or the strip's **✕** to collapse it back to the stopwatch.

The same strip runs a show over a **Background** list — **[en:tran:Images]**,
**[en:tran:Videos]** and **[en:tran:Webs]**, appearing once that list has something on a
screen — and over each **Image Show** / **Video Show** / **Web Show** session, where it
rides the panel's top row. On the Webs list a saved **URL** is stepped just like a page
file.

_Verify: PM-10, PM-137, PM-138, PM-140._

### W-05 — Present song lyrics

**Goal:** put a song's lyrics on the screen.

1. In the left column, click a song in the **[en:tran:Documents]** list — songs carry a
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
6. To change how a stage's slides **look**, click the **⚙** on that stage's chip
   (`Stage 0`, `Stage 1`) in the Stage Previewer header. A small **Stage Style** window
   opens — drag it anywhere, it remembers where you left it. It sets **Slide Padding**,
   **Background Opacity**, **Extra Font Size**, a **Light/Dark** theme, and a
   **Custom CSS** box for anything else. 📸
7. These settings belong to the **stage**, not to the song — every song you open uses
   them, which is why the panel says _Applies to every song_. Stage 0 and Stage 1 keep
   separate settings, so you can leave the projected stage plain and make the chord
   stage larger. Custom CSS is **added to** the stage's built-in look rather than
   replacing it, so stage 0 keeps hiding its chords whatever you type.
8. **Reset** puts that stage back to the defaults.
9. A screen already showing a slide keeps it — present the slide again to push the new
   look out to it.
10. **Edit the words while the song is open and the verses follow by themselves.** Change the
    song in the **Lyric Editor** (right-click the song → **edit**) — or in any other window —
    and within a second or two the rendered song **and every Stage Previewer pane** show the
    new words. You do not have to re-pick the song, and you do not have to save first: the
    editor keeps your unsaved work on disk, and that is what the verses render. 📸
11. If you ever need to force it — a song changed by something outside the app, say — the
    **⋮** at the right end of the Stage Previewer header holds **Reload**, which re-renders
    every stage at once. The same **Reload** sits in the right-click menu of a stage pane and
    of the rendered song above it.

_Verify: PL-07..08, PM-11, PM-115, PM-116, PM-117, PM-127, XW-08._

### W-06 — Look up and present a Bible verse

**Goal:** find a verse fast and put it on screen.

1. Press **Ctrl+B** (or click **[en:tran:Bible Lookup]** in the header). The
   lookup opens as a popup dialog. 📸
2. The input is a **step-by-step picker**. Click the empty box to see the book grid,
   then click the book, the chapter and the verse. These buttons use the names and
   numbers of the Bible version you chose, so this is the preferred route for a
   non-English Bible.
   > Tip: typing the first letters or a full reference such as `John 3:16` is a shortcut
   > when that Bible recognizes what you type. **Tab** completes the current part;
   > **Escape** clears it. The **Bible Reader** page works the same way.
3. The verse renders in the preview panel. **Double-click** it to present. 📸
4. Close the dialog with the red ✕ button or **Ctrl+Q**.
5. Press **F9** ([en:tran:Clear Bible]) to take the verse off screen.
6. The presented verse also appears in the **Bibles** tab (middle column) and the
   **Bibles** list (right column) for re-presenting later.
7. In a hurry, ask the app instead: open the assistant (**🤖**, W-42) and type
   _Put John 3:16 on the screen_ — or the command **/verse John 3:16**, which
   needs no assistant. The passage goes up in the version the lookup is on, and
   the answer says what is on the screen now; it is not saved to the **Bibles**
   list. 📸

_Verify: NAV-06..07, RD-02, PM-12, PR-02, KB-01..02, KB-06, KB-09, CB-61._

### W-07 — Style the on-screen Bible text

**Goal:** change how verses look on the screen.

1. Open the middle **[en:tran:Bibles]** tab.
2. Open its settings split — the **Appearance** and **Text Shadow** cards. 📸
3. Adjust a control (size, color, shadow); the mini screen updates live.

_Verify: PM-13..14._

### W-08 — Set the background (color / image / video / web)

**Goal:** put something behind your content.

1. At the bottom of the middle column, click the thin **[en:tran:Background]**
   bar — the panel expands to show its tabs. 📸
2. Pick a tab: **[en:tran:Colors] / [en:tran:Images] / [en:tran:Videos] / [en:tran:Cameras] / [en:tran:Webs]**.
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

**Folder sessions (Images / Videos / Webs / Audios).** Above each of those lists is a
row of small buttons: **Default**, then any you add with **＋**. Each one is a folder of
its own — with its own view mode, sort and slide show — so you can flick between this
Sunday's pictures on a memory stick and your standing set of backgrounds without ever
re-pointing the folder the app was set up with. **Default** IS that folder: it is the
one Path Settings names, and adding sessions never touches it. A new session starts with
no folder and offers to use the default one; the **⋮** on the session you are on (or a
right-click on any of them) renames or removes it. Removing forgets that session's
folder and slide show — never the files themselves. On the Images, Videos and Webs tabs
the slide show sits on the same row, and a blue ▶ on a button means that session's show
is still running while you look at another one.

_Verify: PM-26..33, PM-101, PM-114, PM-144, PM-145, KB-04._

### W-09 — Play audio, and foreground extras (countdown, clock, marquee bottom…)

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

_Verify: PM-15..25, PM-28, PM-34, PM-128..PM-133, PM-146, PM-147, KB-03, KB-07, CB-67._

### W-10 — Control what the audience sees (mini screen + clears)

**Goal:** manage the live output from the screen preview card.

- The **mini screen** (right column, bottom) always mirrors the audience view; the
  zoom slider under it only rescales your preview, not the output. 📸
- Each screen has its own preview card with a **header** and **footer** of controls:
- **Show / hide the screen** (header, leftmost — or press **F5**): turns the physical
  output display on or off. The icon fills in and brightens while showing. It is
  the control named **[en:tran:Toggle showing screen]** — say those words when
  telling someone which one to press, because several other things in this window
  are also called "Show". 📸
- **Clear buttons** (header — each also has a function key):
  **Clear All `F6` / BG `F7` / SL `F8` / BB `F9` / FG `F10`**
  ([en:tran:Clear All] / [en:tran:Clear Background] / [en:tran:Clear Slide] / [en:tran:Clear Bible] / [en:tran:Clear Foreground]).
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

### W-11 — Read the Bible (references, text size, history, versions)

**Goal:** look up and read a verse in the Bible Reader — deeper reading than the
quick lookup, and where you look a verse up when you are not presenting.
**Where:** header tab **[en:tran:Bible Reader]**.

1. In **Bible Reader**, click the **Bible Reference** box at the top. If it already
   contains a reference, click **Clear input**. Click the book, then the chapter, then
   the verse from the buttons that appear; the passage opens. This is the preferred
   route for a non-English Bible because the buttons use that Bible's own names and
   numbers. 📸
   > Typing a full reference such as `John 3:16` is an optional shortcut when the
   > selected Bible recognizes it. **Tab** completes a piece, **Escape** clears the
   > last piece and **Ctrl+Escape** clears the box.
2. If the words are too small, click the small **⋯** at the bottom-left of the
   passage to open the hidden controls. Then press and hold the
   **[en:tran:Font Size]** slider, move it to the right, and let go when the words are
   large enough.
3. To read two Bible versions next to each other, click **[en:tran:Add Extra Bible]**
   beside the version name, then click the version you want. 📸
4. If you lose a passage, you do not need to remember and type it again. Click one of
   the recent reference rows near the top to go back to it.
5. To change the main Bible version, click its short name in the header and choose a
   version from the list. 📸
6. To read without the side panels, click the small **⋯** at the bottom-left if the
   footer is hidden, then click **[en:tran:Full]** at the bottom-right. Click
   **[en:tran:Exit Full]** to bring the panels back.
7. To put a verse on the audience screen, double-click that verse. A double-click
   means pressing the left mouse button twice quickly in the same place.

_Verify: RD-01..07, RD-11, RD-19, RD-38._

### W-12 — Search the whole Bible (Bible Find)

**Goal:** find verses by words, not reference.

1. In the Bible Reader (or the lookup dialog), click **[en:tran:Advance Bible Lookup]** (the
   magnifier at the top right of the lookup) —
   a second panel ("Bible Online Lookup") appears beside the picker, with **[en:tran:Find]** chosen in its dropdown. 📸
2. Type your search words. Every verse containing them is listed, with **the word you
   searched for marked** in each one, so you can see at a glance why a verse is there.
   The reference — _Psalm 23:1_ — leads each result; clicking anywhere on the result
   opens that verse. 📸
3. The bar under the search box says how many verses matched — **74 verses found**.
   Use it to judge whether to narrow the search: a common word runs to tens of
   thousands. 📸
4. Results arrive in blocks of twenty, each headed **Results 1–20**, **Results 21–40**
   and so on. The numbers at the bottom right move you through them: a **filled** number
   is a block already on screen, so clicking it scrolls straight there; a **plain**
   number has not been fetched yet, and clicking it loads that block in below. Only the
   numbers near where you are, plus the first, the last, and the blocks you have
   loaded, are listed — the rest sit behind **…**, which is a button: it names the
   blocks it is holding (_Show pages 4–139_) and clicking it lists them all. On a find
   big enough to run to thousands of blocks it opens in steps instead, and clicking a
   **…** between two steps opens that stretch — so any block is a click or two away
   without the app ever drawing a thousand numbers at once. 📸
5. To search part of the Bible only, click the **[en:tran:All Books]** button
   and pick a book — **Shift**-click to pick several, or choose **Old Testament** /
   **New Testament** for a whole half. Once a filter is on, the button shows a funnel
   and the books you chose; while it says **All Books** it stays plain, so a narrowed
   search never hides in plain sight. 📸
   The **⋮ More Options** button beside it offers **Reset Selected Books** to go back
   to the whole Bible, and **Reset Search Data**, which rebuilds the search index —
   that one takes a moment and reloads the app.

_Verify: RD-08, RD-09, RD-45, RD-46._

### W-13 — Cross references

**Goal:** see what else in scripture speaks to the verse you are reading.

1. In the bible lookup, click **Advance Bible Lookup** (`bi-search`, top right) to open
   the side panel, then pick **[en:tran:Cross Reference]** from the panel's dropdown —
   the second entry, after **Find**. 📸
   You can also get here from the verse itself: right-click any verse in the lookup body
   and choose **Open in Cross Reference**. That opens the panel on this view AND on that
   verse.
   Until you have picked a verse the view says **No verse selected** and tells you what to
   do about it.
2. The top of the view shows the verse it is working from — its version, its reference and
   its text, exactly as **Resources** shows it. Click the reference to move to another
   verse, or the version chip to read the references in another translation. 📸
3. Under it, **AI Cross References** with the version it is quoting on the right, and a
   line saying how much there is: **7 Themes · 35 Verses**. Click the title to collapse the
   whole section; right-click it for **[en:tran:Refresh]**, which re-fetches.
4. The references are grouped by **theme** — a sentence such as _Genealogy from Adam to
   Noah_ — set flush left, with that theme's verses hanging off a single vertical line
   beneath it. 📸 Each verse gives its reference on its own line and the opening of the
   verse under it, cut at a word with a single `…` when there is more.
   Themes set in columns and reflow to one column when the panel is narrow.
5. Point at any verse and the line beside it lights up, along with its reference: click to
   open it beside the verse you are on, drag it into a list, or right-click it for the
   usual verse menu. The keyboard reaches the same rows — **Tab** to one and press
   **Enter**.
6. The **`bi-cpu`** button on the section title says a model wrote these; click it for the
   page explaining what that costs you in accuracy. On a translation whose theme headings
   were machine-translated, each heading carries its own **`bi-translate`** button saying
   so — on an English bible nothing was translated and the mark is absent.
7. If you have put your own OpenAI or Anthropic key in Settings, **Custom OpenAI** and
   **Custom Anthropic** appear as their own sections below, each collapsing and refreshing
   the same way. The section above them needs no key.

_Verify: RD-10, RD-49, RD-50, RD-51, RD-52._

### W-14 — Keep Bible notes

**Goal:** attach your own notes to study.

1. In the right column (Presenter) or the Reader, switch to the **[en:tran:Notes]** sub-tab.
2. Open a note for editing — the **Bible Note** editor opens in its own window. 📸
3. Type your note and save (**Ctrl+S**).

_Verify: PR-03, PU-03, KB-11._

---

## Creating & editing content

### W-15 — Create and edit slides / lyrics / web backgrounds

**Making a new file:** in the **Documents** list, click the **⋮** in the list header
(or right-click the empty area of the list) and pick **[en:tran:New App Document]** (a slide document) or **[en:tran:New Lyric]** (a song). Type
a name into the row that appears and press **Enter** (or click the ✓). Both kinds live
in the same documents folder. 📸

**Slides** ([en:tran:Slide Editor]):

1. Select a slide document, then click the **Slide Editor** header tab. 📸
2. Left: the slide list — click to select; right-click to **add / duplicate / delete**;
   drag to reorder.
3. Canvas: click a box to select it; drag to move; drag the handles to resize;
   **double-click a text box** to type into it; **Ctrl+Enter** focuses the canvas. 📸
   (From the **Presenter**, right-click a slide → **Edit ↗** opens this editor in its
   own window, focused on that slide.)
4. Add new boxes with the toolbar above the canvas — **New**, **Insert Medias**,
   **Insert Media Link**, **Insert YouTube**, **Insert Website**, **Insert Camera** — or
   the same list from a right-click on the canvas. (The right-hand **Canvas Items** tab
   is a preview/select list, not a place to drag boxes from.) You can also **drag items
   in from the Background panel** — see W-28.
5. **A website box shows a picture of the page, not the running page.** Open Worship
   takes a screenshot and shows that everywhere you edit, so a service order full of
   web slides stays fast even on an old machine. Two things follow:
   - **Hover the box for about a second** to see the page live; move away and the
     picture comes back. 📸
   - The picture does not update itself. If the page changes (a clock, a countdown, a
     scoreboard), right-click the box → **Refresh Preview**.

   When you actually present the slide, the audience screen shows the **real, live
   page** — only your editing and preview views use the picture.

6. **Blend a box with the ones under it.** Select a box, and under
   **[en:tran:Shape Properties]** in the right-hand **[en:tran:Properties]** tab pick a
   **[en:tran:Blend Mode]** — **[en:tran:Multiply]** to darken, **[en:tran:Screen Blend]**
   to drop black out of a clip, **[en:tran:Overlay]** for a texture over a photo. It
   blends with the **canvas items underneath it in the same slide**, so it only shows
   where the box overlaps another one; put a picture or video box behind, sized
   **[en:tran:Full]**, and blend over that. It does **not** reach the background you
   attached to the slide. **[en:tran:Normal]** turns it off again.
7. **Give a box a shadow.** In the same **[en:tran:Shape Properties]** group, pick a
   **[en:tran:Shadow]**. There are two kinds and they are not the same thing:
   - **[en:tran:Box Shadow]** is the shadow of the box itself — its rectangle, with
     whatever corner rounding you gave it. This is the one for a text box with a
     coloured backing.
   - **[en:tran:Drop Shadow]** is the shadow of what is actually painted, so it hugs
     the **letters** of a box with no backing colour, and the cut-out edge of a logo
     picture. Giving a see-through logo a box shadow draws a rectangle in mid-air
     behind it — this is the setting that avoids that.

   Three boxes then appear: **X:** and **Y:** are how far the shadow falls (either
   way — a negative **Y:** throws it upwards), **[en:tran:Blur:]** is how soft it is,
   and the colour row under them sets its colour and how see-through it is. Keep the
   blur modest on an old machine: a big soft shadow is the one setting here that
   costs the computer real work. **[en:tran:No Shadow]** takes it off again.
8. Save with **Ctrl+S**.

**Lyrics:** right-click a song in the Documents list → **edit** — the Lyric Editor opens
in its own window; edit the text/chords and save with **Ctrl+S**. 📸

**Web backgrounds:** Background panel → **Web** tab → **+** — the Web Editor opens;
enter the URL and title, save, and the new item appears in the Web tab.

_Verify: ED-01..11, ED-45, ED-46, ED-47, ED-48, PU-02, PU-04, PL-09, PL-11, PL-24, CM-23, CM-43, PM-33, PM-124._

### W-43 — Remove a song, document or file (Move to Trash)

**Goal:** get rid of a file you no longer want — a song, a slide document, a PDF, a
background picture or video, a presenting flow, a Bible note — without losing it for good.

There is no **Delete** anywhere in the app. Every file row has **[en:tran:Move to Trash]**
instead, and it does what it says: the file goes to your computer's own Recycle Bin (Trash
on a Mac), where it can be brought back if you change your mind.

1. Find the row in its list — a song or slide document in **Documents**, a picture or video
   in the **Background** panel, a run sheet in **Presenting Flows**. 📸
2. Right-click the row, or point at it and click the **⋮** that appears at its right-hand
   end (W-01b). The row's menu opens.
3. Choose **[en:tran:Move to Trash]** — the last item, with a red trash icon. 📸
4. A small window asks **[en:tran:Moving File to Trash]** — _Are you sure you want to move
   "…" to trash?_ Click **Yes**. (**No** leaves everything as it was.)
5. The row disappears from the list. The file, and any pictures or media that belonged only
   to it, are in the Recycle Bin / Trash — open that from your desktop to restore them.

**Not there?** A background item that is **on a screen right now** has no **Move to Trash**
in its menu — clear it from the screen first (**[en:tran:Clear Background]** on the
Mini Screen panel, W-06), then try again. A slide INSIDE a document is not a file: to
remove one, open the document in the **Slide Editor** and right-click the slide in the
left-hand list (W-15).

_Verify: CM-06, EX-05, PL-03, PL-20, PM-35._

---

## Configuration

### W-16 — Settings: language, theme, fonts, folders

**Goal:** configure the app.

1. Click the **gear** ([en:tran:Settings]) in the header — Settings opens in its own window. 📸
2. **General** tab:
   - **Language:** click **English** or **ខ្មែរ**. Each language is listed under its
     OWN name, whatever locale you are currently in — so if a mis-click leaves you in
     a script you cannot read, the way back is still legible. (Hover a button and its
     `title` gives the English name.) Some
     labels change straight away, but the switch is only complete once you click
     **[en:tran:Apply Settings]** at the bottom-left — that reloads every open
     window. Unsaved edits in the Slide Editor are kept.
   - **Theme:** system / light / dark.
   - **Font family:** the font used for on-screen text. A font marked `(Missing)` is
     configured but not installed on this computer. When the chosen font comes in more
     than one weight, a second list beside it picks one (`400 Regular`, `700 Bold`…);
     **[en:tran:Default]** keeps the font's own weight.
   - **Directories:** where documents, lyrics, and bibles are stored on disk.
   - **[en:tran:Repair Links]** (beside **Reset All Child Directories**): after you
     bring the data folder from another computer — a USB stick, a copied folder — press
     it once. Pictures, videos and songs still pointing at where the folder USED to be
     are pointed at where it is now; a link to something that still exists is left as it
     is. A box says how many links it repaired, and the app reloads to show them. 📸
   - **Reset buttons** (`Reset All Child Directories` / `Clear All Settings`):
     **these erase configuration; use with care.** `Reset All Child Directories`
     asks for confirmation first; `Clear All Settings` does **not**.
   - Panel sizes are no longer reset from here — see **W-31**.
3. **Bible** tab: search available Bible versions, download new ones, enable/disable
   downloaded ones. 📸
4. Click **Apply Settings** (top-right) to apply — the app windows reload.

_Verify: ST-01..09, ST-52, LT-02..04._

### W-17 — Find text anywhere (Find bar) & About

- **Find bar:** press **Ctrl+F** (**⌘F** on macOS) or use **Edit → Find** in the app
  menu bar. A slim bar drops in at the **top-right of the window itself** and searches
  only that window. Presenter, Slide Editor, Bible Reader and Settings each have their
  own; the screens, the bible note and the code editors do not (they have their own
  search or nothing to find). 📸
  - Type to search as you go; the counter shows **`<current>/<total>`**.
  - **Enter** jumps to the next match, **Shift+Enter** to the previous one; the **⌃**
    and **⌄** buttons do the same and wrap around.
  - The **Aa** button toggles case-sensitivity. There is **no whole-word and no regex
    option** — Chromium's find-in-page does not offer them.
  - Drag the **grip** on the left to slide the bar **sideways** when it covers
    something you need to read; it stays inside the window and never leaves the top.
  - **Esc** or the **✕** button closes it and clears every highlight. Pressing
    **Ctrl/⌘+F** again re-selects the previous query instead of opening a second bar.
  - The bar is app chrome, not part of the page: it is drawn in its own view, so the
    query you type is never found by your own search.
- **About:** shows the app version and project links.

_Verify: PU-01, PU-05, PU-07._

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
   Mac). **Every window of the app answers it** — the Presenter, the Bible Reader, the
   Slide Editor, a Bible Note, Settings, the Web Editor, the Lyric Editor and Local Web
   Share — and the one you are looking at is the one that gets the panel. (The projector
   output, the About box and the Find bar deliberately do not: an overlay on what the
   congregation sees is the one place this must never appear.) The menu bar is hidden on
   the smaller windows, so the shortcut is the way in there.
   A floating **Presenting Control** panel appears — drag it by its title bar,
   resize it from any edge or corner, double-click the title bar to fill the window (and
   again to put it back), and collapse it with the chevron once a tool with settings is
   showing; it reopens where and how you last left it. 📸
2. The **title bar** carries everything you reach for mid-presentation: the four tools on
   the left, then the **keyboard screencast** switch (W-20) and **Undo** / **Redo** /
   **Clear** on the right. Only the settings live in the body, so collapsing the panel
   with the chevron leaves every group one click away — roll it up to get the sliders out
   of the way and keep drawing.
3. The panel opens on the **arrow** tool — the app stays completely usable and
   anything already drawn stays visible on top of it. The arrow has no settings of its
   own, so on it the panel is **just its title bar**: no empty body sitting over the app
   you have just asked to have back, and no chevron either, because there is nothing to
   roll up. Pick the brush, eraser or spotlight and the body opens again at the size you
   last left it.
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
7. The **camera** at the end of the title bar takes a picture of the app **as it looks
   right now** — your drawing, your spotlight and all — and asks what to do with it:
   **Ask the assistant about this** opens the help window with the picture already
   attached, so "what is this?" is one press and one sentence; **Copy** puts it on the
   clipboard; **Save into your images** puts it in the Background Images folder, where
   it can then be presented like any other picture. The help window itself never appears
   in the shot, even when it is sitting on top of the app. 📸
8. Press **Escape** (or click the arrow) to hand the app back while keeping the
   drawing on screen. Move the panel if it covers what you are pointing at.
9. Click **✕** in the panel header to finish. The drawing is discarded; it is not saved
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

_Verify: CB-30 (the snapshot). The rest is still pending — the matrix lives at
`docs/test-paths/coverage-matrix.md` but has no `PC-xx` (presenting-control) block yet;
add one for this workflow._

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

1. Open the **[en:tran:Background]** panel (W-08 step 1) and choose the **[en:tran:Videos]** tab — or the **[en:tran:Audios]** split if you want the sound only.
2. **Right-click an empty part of the list** (or use the ⋮ More Options button at
   the right of the folder-path bar) and choose **[en:tran:Download From URL]**. 📸
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

### W-22 — Build a service presenting flow (and share it)

**Goal:** collect everything one service needs — songs, slides, verses, backgrounds and
foreground presets — into one running order you can work down live, and hand the whole
thing to another machine.

1. Find the **[en:tran:Presenting Flows]** panel — it is the lower of the two lists on the
   left, under **[en:tran:Documents]**. If the list is empty, right-click its empty area (or
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
   - an **audio track** — drag it out of the **[en:tran:Audios]** split.

   **Add a screen action.** A running order can also hold something to _do_ rather than
   something to show. Right-click the presenting flow → **[en:tran:Add Action]** →
   **[en:tran:Clear Screen]** — a row that adds nothing and opens the clears — and pick
   one of **[en:tran:Clear All]**, **[en:tran:Clear Background]**, **Clear
   Slide** ([en:tran:Clear Slide]), **[en:tran:Clear Bible]** or **[en:tran:Clear Foreground]** — the same five clears as the buttons on each mini screen, and the line
   carries the same `ALL` / `BG` / `SL` / `BB` / `FG` badge so you can tell them apart at a
   glance. It lands at the end of the list; drag it up to where it belongs — say between
   the last song and the sermon. 📸

   Under those five, **[en:tran:Other Clear FG Items]** offers a **finer clear
   for one foreground widget at a time**, so you can take the countdown down and leave the
   marquee running: **Clear FG
   Marquee Top** (`M↑`), **Marquee Bottom** (`M↓`), **Quick Text** (`QT`), **Countdown**
   (`CD`), **Stopwatch** (`SW`), **Time** (`TM`), **Camera Show** (`CM`) and **Web Show**
   (`WB`). Each does exactly what that widget's own hide button in the **Foreground** panel
   does; the `Time`, `Camera Show` and `Web Show` ones clear all of their items at once.
   The panel's **Background Images Slide Show** has no action of its own — it is a
   _background_ despite sitting in that panel, so **Clear Background** is what stops it.

   **Let the running order walk itself.** Back on the first menu — beside **Clear Screen**,
   not inside it — are two actions that move the RUN on instead of touching a screen: **[en:tran:Next: Interval]**
   and **[en:tran:Next: Timeout]**. Each asks how many **[en:tran:Seconds]** when you add it, and the answer is part of the line — `⏱ Next: Timeout (5)` —
   so a glance at the sheet tells you how long it waits. Got it wrong? Right-click the
   line → **[en:tran:Change Seconds]**; it opens on the number it is holding
   now. 📸

   - **Next: Timeout** waits once. When the run reaches it, it counts down and then moves
     the run on by itself — a slide that should linger ten seconds and then go on without
     you. **Going somewhere yourself calls it off**: click another line, or press the next
     key, and the wait is over and you are driving again. Anything else — clicking a
     background, a foreground button, a stray click on the panel — leaves it counting, so
     a mis-aimed click cannot silently cost you the wait.

     **Or wait until a time on the clock.** A timeout is the one that does not have to be
     counted in seconds: the left-hand side of its question is a chooser, and switching it
     from **Seconds** to **[en:tran:At Time]** lets you type the time you want the run to
     move on — `7:05 AM`, `8:30 PM`. The line then reads `⏱ Next: Timeout (7:05 AM)`, and
     the pill counts down in minutes and hours (`4:58`, `1:12:30`) instead of a long number
     of seconds. Use it for the notice board before a service: put it on the last
     announcement and the run leaves it exactly when the service starts, whether you armed
     it an hour or five minutes before. Its menu entry is **[en:tran:Change Timing]** rather than **Change Seconds**, and it opens on whichever half
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

   - **[en:tran:Next: Clear Interval]** stops that loop, and it is the
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
   right of that CC row (or right-click it → **[en:tran:Change Timing]**) and
   answer with seconds or a time of day, exactly as on a line of its own. That answer
   belongs to **that attachment only**: the same `Next: Timeout` can hold the welcome slide
   for 4 seconds and the notice slide for 30, with one timeout in the running order instead
   of one per length. A row holding its own wait shows the stopwatch **filled** and reads
   its own number; one still following the element shows it hollow. To hand a row back,
   right-click it → **[en:tran:Use Element Timing]** — it goes back to the
   element's number and moves with it again. 📸
   **A Next: Interval cannot be attached to anything** and is simply not in that list —
   an interval is not stopped by anything you do, so one riding a slide would keep moving
   the running order on with nothing to call it off but the panel's own pill. A
   **Next: Clear Interval** CAN be attached, for the opposite reason: "put this last slide
   up **and** stop the loop" is one click, and something that stops a loop can never run
   away with the running order.

   **Go back, not just forward.** The third one, **[en:tran:Jump to]**, is how a running
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

   **Reach a line with a key of your own.** The fourth one, **[en:tran:Keyboard Event]**, is a shortcut you set yourself. Adding it asks for the
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
   screen but about whether there is one: **[en:tran:Screen: Show]** and
   **[en:tran:Screen: Hide]**, the same thing the slides button on each mini screen
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
   Screens** ([en:tran:Show on Screens]) to pick the screen.
   A **screen action** works the same way, except it is _run_ rather than shown: click it
   to clear, drag it onto one mini screen to clear only that one, or right-click →
   **[en:tran:Apply on Screens]** to choose. It never lights up as "live",
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
   over and over. Right-click the line → **[en:tran:Set Specific Screen]** and
   tick the screens it should go to — `Screen id: 0`, `Screen id: 1`, … The menu stays open
   so you can tick more than one, and the line then shows a small 📌 with those numbers —
   **each number in its own screen's colour**, the very colour that screen's mini-screen
   badge wears, so you can tell at a glance where a line goes without reading the digit.
   (The tick boxes in the menu are tinted the same way.) 📸
   From then on **clicking that line ignores which mini screens are selected**
   and goes straight to its own; so do the arrow/Space keys in the preview panel. Untick
   them, or choose **[en:tran:No Specific Screen]**, to hand it back to the
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

   - **[en:tran:Add CC Elements]** and pick from the other
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
   - Right-click a CC line for **[en:tran:Remove CC Element]**. There is no
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
   a document) → **[en:tran:Add Media Control]** and the running order does it
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
   of the running order without deleting it: right-click it → **[en:tran:Disable]**. The line dims, is written in italics, is **crossed out** and gains a small
   amber 🚫 at its right end, and from then on **clicking it does nothing at all** — nothing
   is projected, and a document line does not even open. Dragging it onto a mini screen puts nothing there,
   and the arrow/Space keys in the preview panel step straight past it. Right-click →
   **[en:tran:Enable]** puts it back. (While a line is parked its menu drops
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

6. Right-click an element for **Move up** / **Move down**, **[en:tran:Choose Color]**
   to group your running order by colour, or **Remove from Presenting Flow**. To move a line a long
   way, use **[en:tran:Move to Top]** or **[en:tran:Move to Bottom]** instead of
   clicking **Move up** over and over — the line jumps straight to that end and everything
   else keeps its order. (A line that is already at the top is not offered **Move up** or
   **Move to Top**, and one already at the bottom is not offered **Move down** or
   **Move to Bottom**.) **[en:tran:Duplicate]** puts a copy of the line **directly below** it,
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
8. Not sure which "5.jpg" a line means? Right-click it → **[en:tran:Reveal Original]** — the app scrolls to the real item elsewhere in the window and
   flashes it. This works on the slides inside an opened document too. A colour or a
   camera has no original to point at, and the panel holding the original has to be
   open already.
9. To see the whole service at a glance, click the **window** icon on the presenting flow row (or
   right-click → **Open Preview**). A floating panel shows every element with its real
   preview — slides look exactly as they will project, and a document shows all of its
   slides. Collapse the ones you are not working on — or fold the whole running order
   away at once with the **[en:tran:Collapse All]** icon at the bottom-right of the
   panel, and open it all again with **[en:tran:Expand All]** beside it. Whichever
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

10. Right-click the presenting flow → **[en:tran:Export]**. A small panel asks for a
    **[en:tran:Password]** and a **[en:tran:Confirm Password]**.
    **Leave both empty and press Ok** for the ordinary bundle: one
    `<name>.owapf.tar.gz` file in your **Downloads** folder, and the folder opens. It
    contains the presenting flow _and every file it needs_ — the full documents behind your
    slides, the images and videos, and any background attached to those documents.
    (See step 10a to put a password on it instead.)
    10a. **To protect it with a password**, type the same password in both fields and press
    **Ok**. **[en:tran:Show Password]** reveals what you typed if you want to
    check it. You get `<name>.owapf.enc` instead — the same bundle, locked. If the two
    fields do not match the panel says **[en:tran:Passwords do not match]** and asks again rather than exporting, keeping what you
    already typed so you only fix the half that is wrong. Clearing both fields is always
    allowed — that just means "no password".

    > **There is no way to recover a forgotten password.** Nobody — not you, not the app,
    > not the person you send it to — can open the bundle without it. Write it down
    > somewhere safe before you hand the file over, and send it by a different route than
    > the file itself.

11. On the other machine, right-click an empty part of the **Presenting Flows** list → **[en:tran:Import]** and pick that file — or just **drag the `.owapf.tar.gz` (or `.owapf.enc`)
    file from your file manager onto the Presenting Flows list**, which imports it the same way.
    A protected bundle asks for its password first, saying **This archive is password
    protected** ([en:tran:This archive is password protected]); get it wrong and it says
    **[en:tran:Wrong password, try again]** and lets
    you retype it, up to three tries. An ordinary bundle never asks. The songs, documents
    and media are re-created in that machine's own folders, Bible verses are added to the
    **Default** list, and every link inside the presenting flow is re-pointed at the local
    copies. 📸
12. If the bundle is on a web server or a machine sharing it over the local network,
    you can skip copying the file about: right-click the **Presenting Flows** list →
    **[en:tran:Import From URL]**, paste the link and press **Ok**. (If the link is
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

_Verify: PL-10, PL-29, PL-32..PL-76, PL-81..PL-96, PL-101._

---

### W-23 — Share one document (song, sermon slides, PDF) with another machine

Sometimes you only want to hand over **one** item, not a whole service. A document
travels as its own bundle, with everything attached to it.

1. In the **Documents** list, right-click the item you want — an Open Worship slide
   document, a lyric, a PDF, a PowerPoint or a Word file all work — and choose
   **[en:tran:Export]**. 📸
2. A small panel asks for a **[en:tran:Password]** and a **[en:tran:Confirm Password]**. Leave both empty and press **Ok** for the ordinary bundle, or
   type the same password in both to lock it — see W-22 step 10a, it works identically
   here and there is no way to recover a forgotten one. 📸
3. You get one `<name>.owadoc.tar.gz` file in your **Downloads** folder (or
   `<name>.owadoc.enc` if you set a password), and the folder opens. It contains the
   document itself plus everything hanging off it: the background you attached to it
   (and that background's image or video file), any video placed inside its slides, and
   its colour note.
4. On the other machine, right-click an empty part of the **Documents** list →
   **[en:tran:Import]** and pick that file — or just **drag the
   `.owadoc.tar.gz` (or `.owadoc.enc`) file from your file manager onto the Documents
   list**, which imports it the same way. A protected bundle asks for its password
   first; an ordinary one never does. 📸
5. The document appears in that machine's documents folder under its original name, with
   its background re-attached and its colour note restored, so it is ready to present
   straight away.
6. If the bundle is on a web server or a machine sharing it over the local network, use
   **[en:tran:Import From URL]** instead and paste the link. The
   download goes to a temporary folder, is imported exactly as above, and is then
   deleted.

> Notes: the same rules as a presenting flow bundle apply. A file already there **with the same
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
> _that_ copy onto the list will not import it — use **Import** and pick it
> instead (or rename it first).

_Verify: PL-77..PL-80, CM-36, CM-37._

> This works for a **lyric** too — a lyric is a row in the same Documents list. Its
> bundle carries the lyric plus every background you attached to its slides, so the song
> arrives on the other machine already looking the way you set it up.

---

### W-45 — Save a slide document as a PowerPoint file (Export to PPTX)

For when a slide document has to be shown or edited where this app is not — a guest
speaker's laptop, a church that uses PowerPoint, Google Slides or Keynote. Unlike
**Export** (W-23), which carries the document to another Open Worship app, this makes a
PowerPoint file anyone can open.

1. In the **Documents** list, right-click an Open Worship slide document (or press the
   **⋮** at the end of its row) and choose **[en:tran:Export to PPTX]**. It sits just
   under **[en:tran:Export]**. 📸
2. For a lyric, select its row so the **[en:tran:Stage Previewer]** opens. Add or remove
   stages until the layouts you want are visible, then press the **⋮** in the Stage
   Previewer header and choose **[en:tran:Export to PPTX]**. The app writes one deck per
   visible stage: `<song> - Stage 0.pptx`, `<song> - Stage 1.pptx`, and so on. Each deck
   uses that stage's own lyric layout and style. 📸
3. A message **[en:tran:Export to PPTX]** appears saying **[en:tran:Exported to]** and
   where: a `<name>.pptx` in your **Downloads** folder, which opens with the file in it.
   A lyric batch opens the Downloads folder once; exporting again adds numbered copies
   beside the earlier decks. 📸
4. Open it in PowerPoint. Each slide looks the way the screen shows it:
   - the words stay words you can change, broken into lines exactly where the app breaks
     them, in the same font — and where that font has no letter for part of the text (the
     English inside a Khmer title), in the font the app used for it instead;
   - text boxes keep their colour, see-through fill and rounded corners, and a box that
     blurs what is behind it carries that blur as a picture underneath it;
   - pictures keep their place and size; a video becomes its first frame and a website
     box its picture of the page;
   - behind each slide is the background the screen would be showing: the slide's own,
     else the document's, else the one the slide before it left up — so the slides that
     follow a video background keep it, as they do when you present them in order. 📸
5. Anything you wrote in a slide's **Slide Note** is in that slide's **Notes** in
   PowerPoint, and a slide you disabled comes out as a **hidden** slide, skipped when the
   show runs.

> Notes: a slide document exports from its row menu; a lyric exports from the Stage
> Previewer header because each visible stage is a separate rendered layout. A PDF,
> PowerPoint or Word file in the list already is its own file. The
> file is a copy: changing it changes nothing in the app. A YouTube box becomes the
> video's picture when the computer is online; a camera box, a camera background and a
> live web page as a background cannot be exported, the same as printing leaves them out.
> PowerPoint on another computer uses the fonts THAT computer has, so for the same look
> there install the same fonts (the lines break in the same places either way).

_Verify: PL-106._

---

### W-24 — Share a bible list with another machine

A bible list (the verses you lined up for a service) travels the same way.

1. In the **Bibles** panel, right-click the list you want and choose **[en:tran:Export]**. A small panel asks for a **[en:tran:Password]** and a **Confirm
   Password** ([en:tran:Confirm Password]) — leave both empty for the ordinary bundle, or type
   the same password in both to lock it (W-22 step 10a). You get one
   `<name>.owbible.tar.gz` file in your **Downloads** folder, or `<name>.owbible.enc`
   if you set a password. 📸
2. The bundle is small: a bible list stores verse _references_, not the Bible text, so
   only the list and any background you attached to it (or to one of its verses) are
   inside.
3. On the other machine, right-click an empty part of the **Bibles** panel → **[en:tran:Import]** and pick the file — or **drag the `.owbible.tar.gz` (or `.owbible.enc`) onto
   the Bibles panel**; a protected one asks for its password first. **[en:tran:Import From URL]** works here too. 📸
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

1. Open the **File** menu at the top of the window and choose **[en:tran:Export Data]**. 📸
2. A panel lists every data folder you have set up — Documents, Presenting Flows, Background
   Images, Videos, Audios and Webs, Bible Present, Bible Reader, Notes, **Bibles XML** and
   **Resources** — with the folder each one points at. **They all start ticked.** Untick
   anything you do not want (the videos folder is usually the big one), or use
   **Select All** / **Deselect All**. 📸

   > **Bibles XML** and **Resources** are the two folders you never chose yourself — the
   > app keeps them.
   >
   > **Bibles XML** carries the Bible XML files you added by hand (Settings → Bible →
   > Bibles XML), and **only those**: the Bible versions you downloaded in the app are
   > left out, because you simply download them again on the other machine. If you have
   > never added an XML Bible, the row is not offered at all.
   >
   > **Resources** is the `resources` folder inside your data folder — where
   > **[en:tran:Copy to Data Directory]** in the Resources panel (W-37) puts a folder of
   > chapter PDFs, notes or links. All of it goes in, so it can be big; untick it like the videos if you do
   > not need it. A folder you left somewhere else on the computer and only listed in the
   > panel is **not** in the backup — copy it into the data folder first. If you have
   > never copied one there, the row is not offered.
   > 2a. Below the folder list, the same panel asks for a **[en:tran:Password]** and a
   > **[en:tran:Confirm Password]**. Leave both empty for an ordinary backup.
   > Type the same password in both to lock it — a backup carried on a USB stick holds your
   > whole document set, so this is the one worth protecting. 📸

   > **There is no way to recover a forgotten password**, and this file is everything you
   > have. Write it down somewhere that is not the same USB stick.

3. Press **Ok**. You get one `open-worship-data.owadata.tar` file in your **Downloads**
   folder — or `open-worship-data.owadata.enc` if you set a password — and the folder
   opens. Copy it to a USB stick or the other machine.
4. On the other machine, choose **[en:tran:Import Data]** and pick that
   file. A protected backup asks for its password first. The panel then lists only the
   folders the file actually contains — again all ticked — so you can restore just the
   songs, or just the backgrounds. 📸

   > A protected backup is unlocked in one pass before that list can be shown, so a big
   > one takes a moment longer to open than an ordinary one. An ordinary backup is read
   > as quickly as it always was.

5. Press **Ok**. When it finishes you are told how many files were brought in and how
   many were already up to date. Every folder the **Resources** row brought back is also
   added to the Resources panel's list, so it shows up there without being added by hand
   (press **[en:tran:Reload]** in the panel's ⋮ menu if the panel was already open).

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

### W-26 — Compare two documents side by side (floating slide previews)

**Goal:** look at the slides of more than one document at the same time, without losing
the one you already had open.

**Preconditions:** at least two documents in the **Documents** list.

The middle panel previews the **one** document you have selected. To look at another one
as well, give it a window of its own.

1. In the left **[en:tran:Documents]** list, **right-click** a document you have NOT
   selected and choose **[en:tran:Open Slides Preview]**. A window titled
   **Slides: ‹name›** appears over the app. 📸
   Faster, once you know it: hold **Ctrl** (**⌘** on a Mac) and click the row. Same
   thing, no menu — and holding Ctrl again on that row closes the window. The menu
   entry's tooltip reminds you of the shortcut.
2. It is the full previewer, not a thumbnail strip: the undo / redo / discard / save
   strip at the top, the slides, the **Note** boxes, and a zoom slider with the document
   name at the bottom. Everything you can do in the middle panel you can do here —
   click a slide to put it on the screen, drag a slide to reorder it, drop an image or a
   video onto it, right-click a slide for its menu.
3. Drag the window by its title bar to move it, drag any edge or corner to resize it, and
   use the **chevron** to fold it away to just its title. The **✕** closes it.
   **Double-click the title bar** to blow the window up to the whole app window;
   double-click it again to drop it back to the exact size and place it had. Every
   floating window in the app works this way.
4. Repeat step 1 on a second document. You get a **second** window — one per document, as
   many as you need, each opening slightly offset from the last. 📸
5. Zoom one window with its slider (or hold **Ctrl** and scroll over it). Only that
   window changes: every window and the middle panel keep their own zoom.
6. Click inside a window's slide area, then use **Arrow keys / PageUp / PageDown /
   Space** — they step **that** window's document, not whichever one the middle panel is
   showing.

Tips:

- **A document is previewed in one place at a time.** On the document you currently have
  selected, **Open Slides Preview** is greyed out ("Already showing in the main
  previewer" / កំពុងបង្ហាញក្នុងកម្មវិធីមើលមេ) — it is already in the middle panel;
  Ctrl-clicking that row does nothing at all, and in particular does not re-select it. And if
  you click a document that has a window open, the window closes and the document moves
  into the middle panel instead.
- Each window remembers **where you put it, how big you made it and how far you zoomed
  it**, per document — reopen it later and it comes back the same.
- Windows are **not** reopened when you restart the app; you start with a clean screen.
- Renaming or trashing a document closes its window.

_Verify: PM-118, PM-119, PM-120, PM-126, PL-01, CM-06._

### W-27 — Pin the document you are presenting from

**Goal:** stop a stray click in the Documents list from swapping the document you are
half-way through.

**Preconditions:** a document selected in the middle **Documents** tab.

1. Look at the middle **[en:tran:Documents]** tab heading. With a document selected, a
   faint **pin** sits just after the word — nothing selected, no pin. 📸
2. Click the pin. It fills in and turns amber: the document is now **pinned**. Hovering it
   reads **[en:tran:Unpin document]**. 📸
3. Click a different document in the left list. **Nothing changes** — the previewer keeps
   your document. A message says **Document is pinned** / _Unpin the document to preview
   another one_ ([en:tran:Document is pinned]), and the pin flashes so you can see what stopped
   it. 📸
4. The same protection covers every way of swapping the document: a song row, a document
   inside a **presenting flow**, and clicking the file name in the previewer's own footer (which
   normally opens a list of the other documents in the folder — while pinned it does not
   even open).
5. Click the pin again to unpin. The clicks from step 3 now work normally.

Tips:

- The pin stays on when you **restart the app** — it is remembered with the selection.
- **Renaming** the pinned document is not a swap: the previewer follows the new name and
  stays pinned.
- **Trashing** the pinned document unpins automatically and the pin disappears, since
  there is nothing left to hold on to.
- Clicking the pinned document's own row again is silent — that is not a swap either.

_Verify: PM-121, PM-122, PM-123, PL-01._

---

### W-28 — Build a slide by dragging from the Background panel

**Goal:** put a picture, video, song, web page, camera or colour onto a slide without
walking the Insert menu — just drag it out of the panel you are already browsing.

**Preconditions:** a slide document open in the **Slide Editor**, and the bottom
**Background** panel visible.

1. Pick a tab in the bottom **Background** panel — **[en:tran:Colors]**, **[en:tran:Images]**,
   **[en:tran:Videos]**, **[en:tran:Cameras]** or **[en:tran:Webs]**. The presenter also has an
   **Audios** pane. 📸
2. Drag one item out of the panel and hold it over the canvas. The canvas **dims** to show
   it will take the drop. (It stays bright for things it cannot use — a Bible verse, for
   example.) 📸
3. Let go. A box appears **centred on where you dropped it**:

   | Dragged from        | You get                                                                               |
   | ------------------- | ------------------------------------------------------------------------------------- |
   | Images              | an image box                                                                          |
   | Videos              | a video box                                                                           |
   | Audios              | an audio player box                                                                   |
   | Webs — a local page | a website box showing a **screenshot** of that page (see W-24 step 4)                 |
   | Webs — a saved URL  | a website box showing a **screenshot**; a **YouTube** link becomes a real YouTube box |
   | Cameras             | a camera box, labelled with that camera                                               |
   | Colors              | a plain coloured box (see step 4)                                                     |

   📸

4. **Colours are the special one.** Drop a colour **on top of an existing box** and it
   **repaints that box** — no new box is added. Drop it on **empty canvas** and you get a
   new coloured rectangle instead. That rectangle is an ordinary text box underneath, so
   you can double-click it and type into it later. 📸
5. Anything you drop in is an ordinary box: move it, resize it, reorder it, and **Undo**
   (Ctrl+Z) takes it straight back out. Save with **Ctrl+S**.

Tips:

- Dropping onto a box only matters for **colours**. Every other kind lands as a new box
  wherever the cursor was, on top of whatever is underneath.
- This is the same drag that sets a screen background — the panel item is unchanged, you
  are only making a copy of it on the slide.
- A camera box remembers **which** camera by name as well as by id, so it still finds the
  right device after a restart.

_Verify: ED-40, ED-41, ED-42, ED-43, ED-44, ED-21, ED-37, PM-06._

---

### W-29 — Look up a Bible name or place (people, tribes, cities, maps)

**Goal:** find out who someone in the Bible was, or where a place is, without leaving
your Bible reading.

1. Open the **Bible Reader**, or the **Bible Lookup** popup in the Presenter. At the
   right-hand end of the reference box, click the person-and-pin button
   **[en:tran:Names and locations lookup]**. A small floating
   window opens. The first open takes a few seconds while the dictionary loads — after
   that it is instant. It is a floating window like any other: drag it by its title bar,
   resize it from any edge, and **double-click the title bar** to make it fill the app
   window when you want to read a long list — double-click again to put it back where
   it was. 📸
2. The small **language code** beside that button (`en`) is the language the names and
   places themselves are written in. Click it and pick another — `km - Khmer
(ភាសាខ្មែរ)` — and every list, every record window already open, and the
   "in your reading" panel switch to it at once, with nothing to reload. The choice is
   remembered for next time, and it is **separate** from the app's own language
   (**W-16**): an English menu with Khmer names is a perfectly normal combination. The
   verse references a record cites are read back in **the Bible you are reading**, so
   they name the passage the way your own Bible does. Only the underlined names inside
   the verses themselves do not change — those follow the Bible each verse is IN (the
   King James one in English, a Khmer bible in Khmer), which is what makes them findable
   at all, and not this setting. The lists, the record
   windows and the "in your reading" panel are also **typed in that language's own
   script and font** — the name across the top of a record window included — and the
   kind of each record — **[en:tran:People]**, **[en:tran:Groups]**, **[en:tran:Places]** — is named in it too, in the filter and on each
   record. Every record also carries its **English name in brackets** beside its own —
   _ម៉ូសេ (Moses)_, _យេរូសាឡិម (Jerusalem)_ — the way a Bible book reads
   _លោកុប្បត្តិ (Genesis)_, so a name you only know in English is still recognizable.
   With `en` chosen nothing is added: the name already is the English one. 📸
3. Use the **[en:tran:Names]** and **[en:tran:Locations]** tabs to choose what you are
   looking for, and type in the search box. Each tab remembers what you typed, so you
   can switch back and forth. The list updates as you type. You may type in **either
   language** — with Khmer records on screen, `Moses` and `ម៉ូសេ` both find him.
4. On the **Names** tab the dropdown beside the tabs narrows the list by kind —
   **[en:tran:All Types]**, **[en:tran:People]**, **[en:tran:Groups]**,
   **[en:tran:Places]** and so on. These follow the **lookup** language from step 2,
   not the app's, so they read the same way as the records they filter. It is greyed
   out on the **Locations** tab, where there is nothing to filter.
5. Use the arrows at the bottom to page through results, or type a page number in the
   little box and press **Enter**. Starting a new search always takes you back to
   page 1. 📸
6. Click a result to open it in its own small window: a small icon for what kind of
   record it is — a person, a place, a book for a verse — then a short description, then
   a **[en:tran:Details]** section with things like **Also called**, **Type**,
   **Gender**, **Parents**, **Children** and **[en:tran:Verses]**. 📸
   > Every row in the list — and in the **names and locations in your reading** panel —
   > also carries a **⋮** button at its right end. It opens the same short menu that
   > right-clicking the row gives you, so you never need a right mouse button
   > (see **W-38**).
7. **Verses** starts closed and shows how many there are — some entries have hundreds
   (Jerusalem has 712). Click it to open, and the references turn into readable
   titles like _Joshua 10:1-43_.
8. Any underlined name or place — in the description or in a list — opens as another
   small window **beside** the one you are reading, so you can follow a family or a
   journey without losing your place. Clicking the same entry twice just brings its
   window back to the front.
   Where a description names a book, a chapter or a single verse — _Acts_,
   _Genesis 14_, _Acts 28:15_ — it is written the way **your own Bible** writes it
   once you have picked a language other than English in step 2, so a Khmer sentence
   reads _លោកុប្បត្តិ ១៤_ instead of stranding one English name in the middle of it. A
   book or a chapter is simply part of the sentence; a single verse is underlined and
   opens like any other reference.
9. Click a verse reference to read it. With **English** chosen in step 2 you get the
   King James text, because that is the Bible these records were built from; with any
   other language you get the Bible you are currently reading, and the eye button
   below leaves you in it rather than switching you to the King James. The eye button in that
   window's title bar, **[en:tran:Open in bible lookup]**, loads
   that passage into the reference box behind it. 📸
10. For a place that has coordinates, a map appears at the bottom of its window under
    **Approximate location, the marker is an estimated point**, with an **Open in
    Google Maps** link. The map needs an internet connection; places without
    coordinates (Egypt, for example) simply show no map. 📸
11. The copy button in a record window's title bar copies the whole entry — its name
    with the English one in brackets, and all of its verse references whether or not you
    opened the **Verses** section — ready to paste into a note or a document.
12. Closing the lookup window leaves the record windows you opened where they are.
    Each has its own **×**.

**Tip:** the lookup text grows and shrinks with your Bible text, so the bible font
slider (or **Ctrl+Scroll** on the verses) resizes these windows too.

**A note on what is not translated:** a person's **Gender** and **Age**, and a place's
**Type**, are shown exactly as the dataset wrote them. Only a person's kind is one of a
fixed set of nine, so only that one can be said in another language.

_Verify: RD-53, RD-54, RD-55, RD-56, RD-57, RD-58, RD-59, RD-60, RD-61, RD-62, RD-63,
RD-64, RD-80, RD-91, PM-126._

### W-30 — See who and where is in the passage you are reading

**Goal:** while you read, get the list of every person and place the Bible names in
those exact verses — without searching for them one by one.

1. Open the **Bible Reader** (or the **Bible Lookup** popup in the Presenter) and read
   a passage. At the top right, click **Advance Bible Lookup** (the magnifier). A panel
   opens on the right, its header a **drop-down** listing four views: **[en:tran:Find]**, **[en:tran:Cross Reference]**, **[en:tran:Location-Name (KJV)]** and **[en:tran:Resources]**. Pick **[en:tran:Location-Name (KJV)]** — by its name, not by its place in the list, which moves as views are added. 📸
   _The icon to the left of the drop-down changes with your pick — a signpost for cross
   references, a map pin for names and locations — so you can tell at a glance which
   view the panel is showing._
2. Under the heading **Names and locations in your reading** — it says **(KJV)** too
   while you are reading these records in English; see the note at the end — you get
   **one block
   per passage you have open**. Each block is titled with the passage it belongs to,
   e.g. `(KJV) Luke 13:1-35`, and lists **[en:tran:Names]** first, then **[en:tran:Locations]**, with a count beside each. 📸
   _One block per passage, not per pane: two panes reading the same verses in two
   versions share one block, and the pane you are typing in is listed by what its
   reference box says._
3. Every row shows the person or place, the verses of that passage where it comes up
   (`13:4, 13:22, 13:33, 13:34`), and a one-line description. A name that appears in
   several verses is listed **once**, with all of its verses on the row. Reading the
   records in a language other than English, each row carries its **English name in
   brackets** too — _យ៉ូហាន (John)_ — exactly as the lookup list does.
4. Open a second passage (split the reading area, or open another reference) and the
   panel grows a second block for it — so you can see the people of two passages at
   once. A passage with nobody in it says **[en:tran:No matches]**.
5. Type a different reference into the box at the top and the list follows along as
   soon as the reference is complete. 📸
6. Click any row to open that person or place in its own small window — the same record
   window as **W-29**, with the full description, family, verses and map. From there you
   can chase references, copy the entry, or send a verse back to your reading. 📸

**Good to know:** the list is built from the King James text, which is what the
names dictionary was made from — that is what the **(KJV)** in the view's name means. You
can be reading any version, or Khmer; the panel still tells you who is in those verses.
It also includes people the verse means without naming — Luke 13:16 lists **Satan**,
which the verse calls "the devil".

**The names in this list follow the lookup language** — the little language code beside
the person-and-pin button (**W-29** step 2), not the language of the app, and they are set
in that language's own font. The passage heading above each block is named the way **your
Bible** names it, and the **(KJV)** note beside the title only appears while that heading is
still a King James one. What the list FINDS is always read from the King James text.

**The underlined names inside the verses follow the BIBLE, not that setting.** A King
James verse underlines its English names; a Khmer bible underlines the Khmer ones, and
clicking either opens the same record. A Khmer verse only underlines a name the
dictionary records for that verse or somewhere in its chapter, so it marks a little less
than the King James column beside it — a name it is not sure of is left as plain words
rather than guessed at. Another English version (NIV, ESV) underlines nothing: the
dictionary was made from the King James wording, and that is the one English text it can
be trusted against.

_Verify: RD-72, RD-73, RD-74, RD-75, RD-76, RD-57, RD-80, RD-91, RD-113._

---

### W-44 — Chat with an AI website inside the app (AI Chat)

**Goal:** use ChatGPT, Claude, Gemini, DeepSeek, Kimi, Grok, Mistral, Perplexity, Qwen or
Copilot — the company's own website, with your own account — in a window beside the app,
the way a browser's AI sidebar does, without leaving the app.

This is not the app's own assistant (W-42): nothing here reads this manual or presses
anything in the app, and no API key is needed. It is the site itself, in a box.

1. Click the **✨** ([en:tran:AI Chat]) button in the top-right corner of the window, right
   of the **🤖** and left of the **?**, or open **Help** → **AI Chat** in the menu bar. From
   a window with no top bar, use **Tools** → **AI Chat**. A narrow window opens beside the
   app, the same size and place as the help window. 📸 It works whether or not **AI
   features** is switched on in Settings → Others: this window holds no key and opens no
   door of the app's.
2. The window opens on a card, **Choose an AI chat to use in this window**, listing the
   sites. Click one. The site loads in the window, and its own sign-in appears if you are
   not signed in; sign in there exactly as you would in a browser. You stay signed in the
   next time the app starts. 📸
3. The row above the site says **CHAT WITH** and which site it is. Change it there to move
   the same tab to another site. Beside it: **←** goes back a page, **↻** reloads,
   **↗** (**Open in your browser**) opens the same page in your normal browser — for the one
   thing a boxed site cannot do, such as a sign-in that insists on opening a popup window —
   and **↤** (**Sign out of every site**), which is step 7.
4. The strip of **tabs** along the top works like the help window's (W-42 step 2): **+**
   starts another tab (it opens on the card again), **×** closes one, a **double-click on a
   tab's name** renames it, and the **⋮** on a tab (or a right-click) opens **Rename**,
   **Lock**, **Close**, **Close other chats…** and **Clear all chats…**. Until you rename
   it, a tab is called after the page — the conversation's own name, on most of these
   sites. Tabs are kept when the window and the app close, up to eight of them, and each
   comes back on the conversation it was on. 📸
5. Only three tabs keep their site loaded at once — the one in front and the two you used
   most recently. The others unload to save memory and load their last page again when
   you click them, which takes a second and loses nothing: the conversation lives on the
   site, under your account.
6. A link the site opens in a new window (a citation, a "learn more") opens in your normal
   browser, never in the app — and only when you pressed something in the site just before.
   A page that tries to open one on its own is stopped, and a line under the row above the
   page says _This site tried to open … in your browser without a press, so it was not
   opened_; press the link again if you meant it. 📸 The site cannot use the camera or your
   location from inside this window, cannot open anything on this computer, and cannot
   reach anything on it or on the building's network — not the app itself, not the router,
   not a printer, not a program such as OBS that listens for connections. Only the
   internet, which is all a chat site wants.

   **Talking instead of typing.** The microphone is the one thing a site may ask for. Press
   its microphone button (Claude's **Dictate**, for one) and a line appears under the row
   above the page: _claude.ai wants to use your microphone. Allow it until the app
   closes?_ 📸 **Allow** lets that site hear you; **Don't allow** — already selected, so
   Enter or Escape picks it — keeps the microphone off, and the site shows its own
   "blocked" message until you press its button and answer again. A yes is for that one
   site, lasts until the app closes, and only counts while its tab is the one in front; a
   tab behind is never let in. **Sign out of every site** (step 7) takes it back. The
   camera stays off whatever you answer.

7. **Sharing this computer?** You stay signed in to these sites until you say otherwise,
   and closing the tabs does not sign you out — that is worth knowing in a church back
   room where several people use the same machine. Click **↤** (**Sign out of every
   site**) in the row above the page, or the same words on the card in step 2, and answer
   **Sign out**. 📸 It asks first, and **Keep me signed in** is the answer already
   selected, so a mis-click costs nothing. Your tabs stay where they are; the pages they
   were on and the names the sites gave them are forgotten, a name you typed on a tab
   yourself is kept, and every site asks you to sign in again. It cannot be undone.

**Not loading?** The window says _… could not be loaded_ with a **Try again** button when
the site cannot be reached — check the building's internet first. A site that refuses to
sign you in inside the window can be opened in your browser with **↗** and used there.

_Verify: CB-68._

---

### W-46 — Learn the page with Tips of the Day

**Goal:** learn the Presenter or Bible Reader at your own pace and see the exact
control without having to search the manual.

1. Five minutes after the app starts, the Presenter or Bible Reader page in
   front shows one **Tip of the Day** in the top-right corner — never at launch,
   when it would cover the controls you reach for while opening the service.
   Reloading or switching between Presenter and Reader does not restart those
   five minutes. The card stays there until you choose an action. The tip
   belongs to that page only, and the first tip is chosen at random without
   repeating the last automatic tip shown for that page. **Help → Tips of the
   Day** opens one at once, and a tip opened that way stands in for that
   launch's automatic card.
2. Click **Next tip** to move through that page's tips in order. The list wraps to
   the first tip after the last. Click **All tips** to open the numbered learning
   list for the current page. Search by a control or task, or scan the topic badges;
   the counter shows how many lessons match. Each lesson says what it teaches;
   choose one to return to its card and practise it at your own pace. The
   Presenter has **74 topics**: 64 start with a safe **Do it** for a visible
   control or shortcut, while ten disruptive or native-menu lessons stay self-guided. They
   cover documents and slides, audience screens, backgrounds and media, service
   planning, app help, and every native application menu from **File** through
   **Help**. The Reader has **61 topics**: 30 start with a safe **Do it** and
   31 stateful, file-dependent, native-menu, pane-visibility or audience-output lessons stay
   self-guided. They cover reference entry and
   history, reading panes and formatting, Find and cross references,
   people/places and connection graphs, Resources, verse marks and notes,
   presenting a verse, the Reader header, every native application menu, and
   detailed lessons for every command under **View**. The **×** closes the card
   for now; reloading or moving between
   Presenter and Reader does not show a second automatic card in the same app
   launch.
3. Click **Show it** to start a numbered card in the current page, with the control
   ringed in red. This uses a checked-in walkthrough and no model or provider
   credit. The Presenter's deterministic walkthroughs only open, toggle, or
   adjust safe app controls. Press **Do it** once per actionable step; when the
   safe setup is complete, an explanation-only follow-up uses **Next**, never a
   disabled or failing **Do it**. If the renderer refreshed before the local
   walkthrough service, Show it sends the current lesson inline and still opens
   the card. Steps that would present, control an audience screen, export, or use
   a disruptive native-menu action remain self-guided numbered cards.
   Reader lessons that depend on selected text, files, a graph, or the native
   menu are self-guided too. They explain the exact action but do not reload,
   relaunch, export, reset the layout, open Developer Tools, or change what the
   congregation sees. If **AI features** is off, the app
   offers to open Settings → Others because the local walkthrough server is
   switched off with it.
4. Click **Don't show again** to stop automatic tips on both pages in future app
   launches. This does not remove the lessons: use **Help → Tips of the Day** to
   open one suggestion, or **Help → All tips** to browse the whole learning list
   for the page in front. Opening either from Help does not turn automatic tips
   back on. To restore the automatic card, open **Settings → General → Other
   General Options**, turn on **[en:tran:Show Tips of the Day automatically]**, and
   start the app again. The switch restores tips for both Presenter and Bible Reader.

The **File**, **Edit**, **Tools**, **Window**, and **Help** overviews name every
row users can encounter, including conditional and macOS-only rows, so searching
for a command finds the menu that owns it. They are self-guided because Electron
draws the operating-system menu outside the page and a walkthrough cannot safely
ring or press it. The detailed **View** lessons remain separate so each View
command can explain its effect and risk.

The Presenter and Reader catalogs deliberately keep **Reload**, **Force Reload**,
**Relaunch** and **Toggle Developer Tools** under the **View menu** topic for
completeness, but do not put those troubleshooting commands into the random
daily rotation.
**Actual Size / Zoom In / Zoom Out** are taught as whole-window zoom, separately
from the passage's **Font Size**. **Toggle Full Screen** is taught as whole-window
full screen, separately from the passage's **Full** button. **Widgets** explains
the checked pane list; **Reset Widgets Size** explains its confirmation and that
it both restores default sizes and reopens collapsed panes.

_Verify: GL-25._

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

### W-31 — Hide, show, and reset the app's panels (View menu)

**Goal:** get a panel back after it collapsed, hide one you don't need, or put the
whole layout back the way it shipped.

Every resizable panel in the app is a **widget**. You can already collapse one by
dragging its divider all the way to the edge — it shrinks to a thin green strip with
its name on it, and clicking that strip brings it back. The **View** menu on the top
menu bar does the same thing by name, which is easier when the strip is hard to find.
And the divider itself has a right-click menu that does it in place (steps 7–9) —
the only way in a popup window, whose menu bar is hidden.

1. Open **View** on the top menu bar → **Widgets** (Widgets). 📸
   You get one tick-box per panel on the page you are looking at, e.g. on the
   presenter: `App Presenter Left` / `App Presenter Middle` / `App Presenter Right`,
   `Document List`, `Presenting Flow List`, `Presenter`, `Background`,
   `Bible and Notes`, `Mini Screen`, `Bibles`, `Bible Notes`, `Previewer`, `Slides`.
   - **Ticked** = the panel is open. **Unticked** = it is collapsed to its strip.
2. Click a ticked one — that panel collapses to its green strip, and the space goes to
   its neighbour. 📸
3. Click it again — the panel comes straight back. Nothing reloads and nothing you
   were doing is interrupted.
4. Panels that the app does not let you collapse (the Background media/audio split,
   the bible previewer, the lyric Stage Previewer) are simply not listed.

**Put everything back:**

5. **[en:tran:Reset Widgets Size]**. Answer **Yes** to
   `Are you sure to reset every widget size and reopen the widgets?` 📸
6. Every panel returns to the width and height it had when the app was installed, and
   **any panel you had collapsed is reopened**. This happens immediately — no reload.
   Answer **No** and nothing changes.

**Or use the divider between two panels** — no menu bar needed, so this also works
in a popup window:

7. Right-click the **divider between Document List and Presenting Flow List** — the
   thin line between the two panels on the left of the presenter (every divider in the
   app has this menu) — and choose **[en:tran:Close First Widget]**. 📸 The first of
   the two panels (the left one, or the upper one) collapses to its green strip and the
   other takes its space. `Close Second Widget` does the same to the other panel.
   Hovering the divider shows the same two choices as small arrows, each named for
   the side it closes — **[en:tran:Collapse left panel]** / **[en:tran:Collapse right panel]**,
   or **[en:tran:Collapse top panel]** / **[en:tran:Collapse bottom panel]** on a
   divider between an upper and a lower panel. A collapsed panel has no divider — if
   one of the two is already a strip, click the strip first.
8. Click the green **Document List** strip — the panel comes straight back.
9. Right-click the **divider between Document List and Presenting Flow List** again and
   choose **[en:tran:Reset Size]** — just those two panels return to the sizes they
   shipped with. Double-clicking the divider does the same. The View menu's
   `Reset Widgets Size` (step 5) is the version for every panel at once.

> This used to be a button in Settings → General, where it did nothing until you also
> clicked **Apply Settings** and the app reloaded. It is on the View menu now and takes
> effect at once.

_Verify: NAV-20, NAV-21, ST-22, GL-17, GL-18._

### W-32 — See who published a Bible translation (and its copyright)

**Goal:** find out which edition of the Bible you are reading — its publisher,
version, language and copyright notice — without leaving the reader.

You do not need Settings for this. The information is one click away, but only while
you are still choosing what to read: once a verse is on screen the header gives that
space to the verse buttons instead.

1. Open **Bible Reader** (see W-11) and make sure the lookup box at the top is
   **empty**, so the pane shows the grid of book names (**លោកុប្បត្តិ (Genesis)**,
   **និក្ខមនំ (Exodus)**, …). 📸
2. Look at the **top-right corner of that pane**, on the same line as the small
   version badge (e.g. `ពគប`). There is a round **ⓘ** button — hover it and the tip
   reads **[en:tran:Bible Information]**.
3. Click **ⓘ**. A card opens in the middle of the window. 📸 It lists:
   - **[en:tran:title]** — the edition's full name, e.g.
     `Khmer BFBS (ព្រះគម្ពីរបរិសុទ្ធ ១៩៥៤)`
   - **[en:tran:Key]** — the short code shown on the badge, e.g. `ពគប`
   - **[en:tran:Version]**, **[en:tran:Locale]** — e.g. `Khmer (ភាសាខ្មែរ) (km-KH)`
   - **[en:tran:Publisher]**, **[en:tran:Copy Rights]**,
     **[en:tran:Legal Note]** — e.g.
     `© BFBS/UBS 1954, 1962. All Rights Reserved.`
   - **[en:tran:Description]**, **[en:tran:Books]** — how many books this edition
     contains, e.g. `66`
   - Anything the edition does not record is simply left out of the list.
4. If any of those lines mentions a **web address** — publishers often put their site
   in the copyright or legal note — it is shown as a link. Click it and the page opens
   in your normal web browser; the app itself stays where it is. 📸
5. You can select and copy any of it — handy when a copyright line has to go on a
   printed order of service.
6. Close it with the **✕** in its corner, or press **Escape**. You come straight back
   to the book grid exactly as you left it.
7. Pick a book, then a chapter. As soon as the verses appear, the **ⓘ** is gone and the
   verse buttons (copy, split, save, present…) take its place. Clear the box again and
   it returns.

> Want to change any of this rather than just read it? That is still
> **Settings → Bible**, the pencil next to the translation, then the **Info** tab.

_Verify: RD-77, RD-78, RD-11, LT-01._

---

### W-33 — Share your Bible translations (XML) with another machine

W-24 shares a **bible list** — the verses you lined up. This shares the **translations
themselves**: the XML bibles you added or edited under **Settings → Bible**, which
until now could only be moved by digging the files out by hand.

1. Open **[en:tran:Bible]**. Under the **[en:tran:Import XML File]** box on the left there is a card headed **[en:tran:Bible Data]**. 📸
2. Click **[en:tran:Export Bible Data]**. A panel opens listing every
   translation you have, one row each, showing its short **key** (`KJV`, `GKHB`, `ពគប`…)
   and its full title. Everything starts ticked. Untick the ones you do not want, or use
   **[en:tran:Deselect All]** and pick just a few. 📸
3. Below the list, the same **[en:tran:Password]** / **[en:tran:Confirm Password]** pair as every other export: leave both empty for the ordinary
   bundle, or type the same password in both to lock it. Type them differently and the
   app tells you **Passwords do not match** in the panel itself and brings it straight
   back — still holding the bibles you ticked and the password you typed — so a mistyped
   password can never quietly produce an unprotected file, and you never have to pick your
   translations a second time.
4. Click **Ok**. You get one `Bible Data.owabdata.tar.gz` in your **Downloads** folder
   (or `Bible Data.owabdata.enc` if you set a password), and the folder opens on it.
   Bibles are big files — a couple of translations can run to tens of MB.
5. On the other machine, open **Settings → Bible** and **drag the file anywhere onto
   that page** — the whole Bible settings area accepts it, not just the small card. Or
   click **[en:tran:Import Bible Data]** and pick it. A protected
   bundle asks for its password first, and says **Wrong password, try again** rather
   than failing outright. 📸
6. A panel lists what is inside. Anything that can come in is ticked. Anything that
   **cannot** is shown as a **red row** you are not allowed to tick, with the reason on
   the right:
   - **[en:tran:Bible key already exists]** — you already have a
     translation with that key. Upper and lower case count as the same key, so a `kjv`
     in the bundle is refused against a `KJV` you already have.
   - **[en:tran:Duplicate bible key in this archive]**
     — two entries in the same bundle claim the same key; the first one is offered.
   - **[en:tran:Unable to read this bible file]** — the app
     could not read a bible key out of that file, so it cannot check it and will not
     touch it. 📸
7. Click **Ok**. The ticked translations are added and the list on the right refreshes
   to show them. A message tells you how many came in and how many were skipped.

> Notes: an import **never replaces** a translation you already have, and never leaves
> you with two copies of one. That is the whole point of the red rows — where documents
> and backgrounds add a second copy as `a (1).mp4`, a bible is identified by its key,
> and two bibles with the same key would be ambiguous everywhere else in the app. If you
> genuinely want the incoming version, delete yours first (the 🗑 next to it) and import
> again.
>
> Only the **XML** translations are in the bundle — the ones listed under **Bibles XML**.
> Bible versions you downloaded inside the app are not: they are hundreds of MB and can
> simply be downloaded again on the other machine.
>
> The check is done against the **file inside the bundle**, not against what the bundle
> claims — so a hand-edited bundle cannot talk the app into overwriting a bible.

_Verify: ST-34..ST-40, LT-01._

---

### W-34 — Add a Bible translation from the internet (XML), and make it read in its own language

W-33 moves translations you already have. This one **adds a new translation from a link** —
the way `ពគប` (Khmer BFBS 1954) was added — with no file to download by hand and no file
manager: every step is in the app.

The example throughout is the free Beblia XML collection, whose Khmer edition lives at
`https://github.com/Beblia/Holy-Bible-XML-Format/raw/refs/heads/master/KhmerBFBSBible.xml`.
Any XML in the app's format works the same way (**Import XML File → ?** shows the format).

**Part 1 — bring the file in**

1. Open **Settings** (Tools → Settings, or the ⚙ button) and pick the **[en:tran:Bible]** tab. Top-left is the **[en:tran:Import XML File]** box. 📸
2. Leave **Choose File** alone and paste the link into the **URL:** box instead. As soon as
   the link is a valid address the file row dims out and **[en:tran:Import]** lights up.
   (A malformed address turns the box red with the tip **Invalid URL**.)
3. Click **Import**. A progress line walks through **Downloading file… → Reading file… →
   Deleting file…** — the app fetches the file itself, reads it, and throws the download
   away. Bibles are big; the Khmer one is about 14 MB, so give it a moment.
   > A GitHub `…/raw/…` link is fine as-is — the app follows the redirect. So is any plain
   > `http://` address, e.g. a file served off another laptop on your own network.

**Part 2 — name it (the "Key is missing" question)**

4. Most XML bibles on the internet carry no short code, so the app asks: a **Key is
   missing** window with **Define a Bible key**, a **Key:** box, and a row of **Guessing
   keys:** buttons. 📸
   The buttons are every word the app could find in the file's own header, so one of them
   is usually the right answer — for the Khmer file the publisher left a bible.com address
   in the header ending in `…GEN.23.ពគប`, and **`ពគប` is offered as a button**. Click it and
   the box fills in. Otherwise type your own short code; anything works, including Khmer.
   > A code you already use is refused — the box turns red with **Key is already taken**.
   > This code is the badge you will see everywhere in the app, and it also becomes the
   > file name, so **choose it now**: changing it later in the editor renames the badge but
   > not the file.
5. Click **Ok**. The app asks once more — **Confirm Key for Bible**, _Do you want to
   continue with key="ពគប"?_ — click **Yes**. (**No** takes you back to the box; the way
   out entirely is **Cancel** then **No**.)
6. The new translation appears in the **Bibles XML** list on the right, badge on the left
   and full title beside it. 📸 It works already — but if it is not an English bible, read on.

**Part 3 — make it read in its own language**

A file downloaded from the internet almost never says what language it is in, so the app
assumes English: book names in English, `1 2 3` instead of `១ ២ ៣`, and the translation
filed under **English** in the bible menu. Three settings fix that, and **the order
matters** — the last two take their suggestions from the language you set first.

7. Click the ✏️ **pencil** next to your new translation. The **Info** tab opens a text
   editor holding the translation's settings. **Right-click inside it** — below the usual
   editing commands are three of the app's own:
   **🌎 Choose Locale**, **#️⃣ Edit Numbers Map**, **📚 Edit Books Map**. 📸
8. **🌎 Choose Locale** first. Pick the language from the list — for Khmer that is
   **km-KH (Khmer (ភាសាខ្មែរ))**. The `"locale"` line in the editor changes and the bar at
   the bottom starts warning **Unsaved changes**.
9. **#️⃣ Edit Numbers Map** next. The window is titled **Numbers map** and now says _Define
   numbers map for km_ — because of step 8. Click **Use ១ ២ ៣** to fill in that language's
   own digits and click **Ok**. (There is also a **Translate** link to Google Translate if
   your language is not one the app knows.) 📸
10. **📚 Edit Books Map** last. This opens the 66 book names, one per line, with the
    English name of each book shown down the left so you can never lose your place. Click
    **📖 Guessing Names** — the app lists the book-name sets it ships for that language,
    labelled by the translations that use them (for Khmer: `អគត`, `ពគប, គកស១៦, GKHB`,
    `គខប`), with the set matching your code shown first and in bold. Pick one and all 66
    lines fill in. Click **Ok**. 📸
    > No set to pick from? Use **Translate** to translate the whole list in one go, paste
    > it back, and — if what you paste comes back as web markup — **Parse Markup String**
    > cleans it up. **Reset** puts the English names back.
11. Click **Save**. The app reloads its windows, which is normal.
12. Check it: in the **Bible Reader**, open the bible chooser. Your translation has moved
    out of **English** and now sits under its own language heading, and its references read
    in its own script and numerals — `(ពគប) កិច្ចការ ២៨:១៥` rather than `(ពគប) Acts 28:15`. 📸

> **Removing one.** The 🗑 next to a translation asks _Are you sure to delete bible XML
> "…"?_ — **Yes** sends the file to the Recycle Bin. Its badge disappears from every bible
> menu. (A small hidden `…​.xml.cache` folder is left beside it in the app's bible folder;
> it is harmless, and reusing the same code later just refills it.)

> **Putting the KJV back.** The **KJV** row — and only that row — carries an extra
> orange ↺ button, **[en:tran:Reset Bible XML]**, to the LEFT of the ✏️ pencil.
> It asks _Reset this bible XML with the app embedded KJV? All your changes will be
> lost._ — **Yes** throws away the KJV file you have and writes the copy that ships inside
> the app (the same copy the **Create KJV Bible XML** row below writes),
> then reloads the windows. Use it when your KJV has been edited into a state you no longer
> want, or looks broken; there is no undo, so export it first (W-33) if you want it back.
> If the KJV editor is open with unsaved changes the button refuses and warns
> **Unsaved Bible Data** — save or discard first.
>
> **Deleted it by mistake?** The KJV is the one translation the app carries inside
> itself, so it can always be rebuilt. Whenever your list has no **KJV**, a green
> **[en:tran:Create KJV Bible XML]** row sits at the TOP
> of the **Bibles XML** list, above the translations — not only on a brand-new install
> with nothing in the list. Click it and the KJV comes back; the button then disappears
> because there is nothing left to create.

_Verify: ST-41..ST-50, ST-24..ST-26, ST-29, ST-31, ST-32, ST-51, RD-11, LT-01._

### W-35 — Bring a song in from CCLI SongSelect

If your church has CCLI **SongSelect Partner API** access, the app can search SongSelect
and turn a song straight into a lyric document — no retyping. You need the API
credentials CCLI issued to you (a **Client ID**, a **Subscription Key**, and the
**Redirect URI** you registered; some clients also have a **Client Secret**).

> CCLI has retired new partner signups, so this only works with credentials you already
> hold. Everything below was driven live against a stand-in SongSelect server; the final
> sign-in hand-off to CCLI's real consent page is source-verified but **not observed**
> end-to-end, for want of real credentials.

1. Open **[en:tran:Others]**. Between the AI-key card and **Extra Binaries**
   there is a card headed **[en:tran:SongSelect Integration]**, with a
   **SongSelect ↗** button that opens songselect.ccli.com in your browser. 📸
2. Fill **Client ID**, **Subscription Key** and **Redirect URI** (and **Client Secret**
   if you have one). Each field saves the moment you click away from it and gains a
   green ✓. Until all three are filled, **[en:tran:Sign In]** stays grey — hovering it
   tells you what is missing.
3. Click **Sign In**. A CCLI window opens for you to log in and approve. If you close
   it instead, the app says **Sign in failed — Sign in was canceled** ([en:tran:Sign in was canceled]) and nothing changes. Once signed in, the card shows a
   green **[en:tran:Signed in]** with a **[en:tran:Sign Out]** button, and the
   app keeps the session refreshed by itself.
4. Back in the presenter, open the **Documents** list's **⋮ More Options**. A new entry,
   **[en:tran:Import From SongSelect]**, now sits under
   **Download From URL** — it is only there while you are signed in. 📸
5. Click it. A floating **Import From SongSelect** panel opens (drag it anywhere; the
   app remembers where you put it). Type in **[en:tran:Search songs]** — results
   appear as you pause, with the writers, the CCLI song number, a line of the lyrics,
   and a **[en:tran:Public Domain]** badge where it applies. Page through
   long result lists with the ‹ › arrows at the bottom. A song your account is not
   licensed to take has its download button greyed out. 📸
6. Click a song's ☁⬇ download button. A moment later the app confirms **Lyric document
   created successfully** ([en:tran:Lyric document created successfully]) and the song appears
   in your **Documents** list as a lyric (♪), named after its title. The panel stays
   open, so you can keep downloading; pulling the same song twice keeps both —
   the second becomes `<Title> (1)`. 📸
7. Click the new row: it previews slide by slide — an **Info** slide with the title,
   writers and the `CCLI Song #` copyright line, then one slide per part (**Verse 1**,
   **Chorus**, …). Present it like any other lyric (W-04), or polish the wording in the
   lyric editor first. 📸

> **If a search or download fails**, the reason shows right in the panel or as a toast:
> too many requests in a row asks you to wait a moment; a lapsed session says
> **SongSelect sign-in expired, please sign in again in Settings**; no internet says
> **Could not reach SongSelect**.

_Verify: ST-52, PL-103, PL-104._

### W-36 — Import a public domain song (no account needed)

The app ships with a small hymnal of classic English public-domain songs — Amazing Grace,
It Is Well with My Soul, Holy Holy Holy, and some three dozen more. They import as lyric
documents with **no sign-in, no credentials and no internet**, so this works on a fresh
install anywhere.

1. In the presenter, open the **Documents** list's **⋮ More Options** →
   **[en:tran:Import From Public Domain Songs]**. Unlike the SongSelect entry above it is
   _always_ there. 📸
2. A floating panel opens listing the whole catalog straight away — each row shows the
   title, the writers, the year, and the first line, with a count at the top right of the
   search box (36 at the time of writing). Scroll to browse, or type in **[en:tran:Search songs]** to filter instantly by title or writer — the count follows. 📸
3. Click a song's ☁⬇ download button. The app confirms **Lyric document created
   successfully** ([en:tran:Lyric document created successfully]) and the song appears in your
   **Documents** list as a lyric (♪) named after its title. The panel stays open so you
   can keep importing.
4. Click the new row: it previews an **Info** slide (title, writer, `Public Domain` with
   the year) and then the song in **real singing order** — a hymn with a refrain repeats
   its **Chorus** slide after every verse (Blessed Assurance previews Verse 1, Chorus,
   Verse 2, Chorus, Verse 3, Chorus). Present it like any other lyric (W-04), or adjust
   the words in the lyric editor first — they are ordinary editable lyric documents. 📸
5. Scroll to the **end** of that preview: after the last verse sits one more slide named
   **Hymnary.org** — the page the song's words were taken from, kept with the document as
   an attachment so you can always check the wording against the source. It behaves like
   any other slide (you can present it, or simply leave it at the end). 📸

_Verify: PL-105._

### W-37 — Keep your own files beside the verse (Resources)

If you already keep study material on disk named after the chapter it belongs to —
`PSA.1.pdf`, `GEN.49.pptx` — **[en:tran:Resources]** puts those files
right beside whatever you are reading, from as many folders as you like — and it
follows **every passage you have open**, not one verse you clicked: three panes on
Genesis 24, 27 and 29 list the files of all three.

The name has to follow one pattern: **`<book key>.<chapter>.<anything>`**. The book key is
the three-character one the app uses (Psalm is `PSA`, Genesis `GEN`, 1 Chronicles `1CH`), so
anywhere in Psalm 1 looks for `PSA.1.*` — `PSA.1.pdf`, `PSA.1.outline.docx`. Any file type
at all. It is the **chapter** that decides, not the verse, so every verse of a chapter shows
you the same files.

**Files for the whole book** get chapter number **0**: `PSA.0.pdf` is your introduction to
the Psalms, and it is listed for _every_ chapter of the Psalms, above that chapter's own
files. If you have more than one such document, keep going downwards — `-1`, `-2` and so on
all count as book-level too.

1. In the bible lookup, click **Advance Bible Lookup** (`bi-search`, top right) to open
   the side panel, then pick **Resources** from the panel's dropdown — the fourth entry
   after **Find**, **Cross Reference** and **Location-Name (KJV)**. 📸
2. The top line of the view is the file-name patterns being looked for, one for **each
   passage you have open**, in the order of your panes, so you can always see what it is
   matching — reading Genesis 24 beside Genesis 27, a solid `GEN.24.*` and a solid
   `GEN.27.*` for the chapters' own files, then one dashed `GEN.0.*` for the book's.
   Two panes on the same chapter in two versions count once. The pane you are typing a
   reference into follows what its box says, as soon as the reference is complete;
   moving to another verse of the same chapter changes nothing here — it is the chapter
   that decides. 📸
3. The first time, the body holds a single **[en:tran:Add Folder]** button. Click it and
   pick the folder your files are in. You can add as many as you want — the **⋮ More
   Options** button, or a right-click anywhere in the view including the empty space below
   the folders, offers **Add Folder** again. Adding the same folder twice does nothing. 📸
   **Or drag the folder straight in.** Take it from your file manager — Explorer, Finder —
   and drop it anywhere on the Resources view: while you hold it there the view outlines
   itself and its top line reads **[en:tran:Drop folders here]** in place of the patterns,
   and letting go shelves the folder exactly as the button does, with its matching files
   already listed under it. Several folders at once is one drop. 📸
   Nothing is copied or moved — the folder stays where it is, and Resources only
   remembers where to look. Drop a **file** by mistake and nothing is added: it says
   **[en:tran:Drop a folder, not a file]**, because the folder a stray file sits in is as
   often your whole Downloads as it is a library, and pointing Resources at that would
   set it walking everything you own. A folder that is already on the list says
   **[en:tran:Folder is already added]** rather than changing nothing in silence.
   That same menu has **[en:tran:Reload]**, which re-reads everything at once: your
   folder list, and the files inside every folder. Use it after adding files on disk while
   the app is open, or after changing the list from another window. 📸
4. Each folder becomes its own group, named after the folder, with the folder it lives in
   shown beside the name and the full path if you hover it. Under the name, hanging off a
   single vertical line, are the matching files — **from that folder and the folders
   inside it, two levels down** (`Library/Genesis/Sermons/GEN.24.pdf` is found, a file one
   folder deeper than that is not) — filed under the pattern each one answered to (`GEN.24.*`, then
   `GEN.27.*`, then the dashed `GEN.0.*`), sorted by file type within each, each with its
   own icon (PDF, Word, PowerPoint, video, image, bible note). The extension is set quieter
   than the rest of the name so the reference reads first. Hover a file to see where it
   actually lives. 📸
   A book-level file is listed **once**, under its dashed pattern, however many chapters
   of that book you have open, and carries a dashed **[en:tran:Introduction]** tag so a
   `PSA.0.pdf` says why it is there. A group with nothing for what you are reading says
   **No matching files**.
5. Sometimes you want a file that is _not_ named after this verse. Click the **magnifier**
   (`bi-search`) at the right-hand end of the pattern line and a search box opens under it.
   Type any part of a file's name — `abc`, `baptism`, `PSA.11` — and every file in your
   folders whose name contains it is listed too, added below that folder's verse files under
   a `*abc*` heading so you can tell the two apart. Your verse files stay exactly where they
   were. 📸
   Upper and lower case do not matter, and it looks anywhere in the name, not just at the
   start — searching `abc` finds `abc.pdf` and `01-abc-notes.docx` alike. If you are used to
   writing `abc*`, that works too; the `*` is simply ignored.
   Click the magnifier again to close the box and put the lists back as they were. If a
   folder has hundreds of matches only the first 200 are shown, and the box says **Too many
   matching files** — type a bit more to narrow it down.
   **To see everything else without typing, tick [en:tran:Others]**, the box just left of the
   magnifier. Each folder then also lists every file whose name is _not_ a book and a
   chapter — `family-tree.jpeg`, `church-map.pdf`, `README.txt` — under an
   **[en:tran:Others]** heading after its verse files and anything you searched for. 📸
   A file only counts as a book-and-chapter file when it starts with a real book key and a
   plainly written chapter, so `GEN.5.pdf` stays out of this list while `IMG.2.jpg` and a
   misnumbered `GEN.01.pdf` show up in it — handy for spotting a file you named wrongly. A
   file your search found is listed under the search heading instead, never twice. Up to 200
   are shown per folder; past that the group says **Too many other files**, and pointing
   Resources at the folder your material is actually in keeps the list short. Untick
   **[en:tran:Others]** to hide them again — the box stays the way you left it next time.
6. Click a file to open it in whatever application your computer normally uses for it — a
   PowerPoint in PowerPoint, a picture in your picture viewer. Right-click one for **Open**,
   **Copy Path to Clipboard**, or **Reveal in Finder** / **Reveal in File Explorer**.
   Three kinds of file open **inside the app** instead:
   - **A PDF** (`.pdf`) opens in the app's own PDF viewer window — the same one
     **[en:tran:Preview PDF]** opens from a PDF in the Documents list — with its pages down
     the side, zoom and print. Right-click the row for **[en:tran:Preview PDF]**, or **Open**
     to use your own PDF reader instead. Pressing a PDF whose preview is already open brings
     that window forward. 📸
   - **A markdown file** (`.md`, `.markdown`, drawn with the `bi-markdown` icon) opens in its
     own **Markdown Preview** window, like a Bible Note does: headings, lists, tables, quotes,
     code, pictures kept beside the file, and **Mermaid diagrams** written in a ` ```mermaid `
     block are drawn as diagrams (a diagram with a mistake in it shows the error above its
     code). The window follows the file — save it in your editor and the preview changes.
     A link to a heading scrolls there; a link to another `.md` opens it in the same window,
     with **[en:tran:Back]** (`bi-arrow-left`) to return; a web link opens in your browser; a
     link to any other file shows it in its folder rather than running it. HTML written
     inside the file is drawn the way GitHub shows a README — a centred picture, a table, a
     section that folds away — but nothing in it can run: scripts, buttons, forms and styles
     are taken out. If a file shows `#` and `**` instead of a heading and bold, the file itself
     was saved with them escaped (`\#`, `\*\*`), which some editors' formatted view does
     when text is pasted into it; the preview shows what is written. The head row also has
     **[en:tran:Reload]**, **[en:tran:Open in Default App]** (to edit it) and **Reveal in
     File Explorer**. Right-click the row for **[en:tran:Preview]** or **Open**. Pressing a
     file whose preview is already open brings that window forward. 📸
   - **A bible note file** (`.own`) gains a chevron: click it and everything in it is
     listed under it, as the **Bible Notes** panel lists it — its notes, and each verse
     marked in it (`bi-highlighter`) with its highlights in their colour and its comments
     underlined, what was written beside them. Click a note to open it in the **Bible Note**
     window **read-only** — the title bar says **([en:tran:Read-only])**, the lock at the
     bottom shows it is locked, and nothing you do there is saved to the file. Click a
     highlight or comment to open that verse beside what you are reading; click a verse to
     fold it away to a count. Nothing in the file can be changed from here. A file that is
     not a bible note says **[en:tran:Not a bible note file]**. 📸
7. **A `.json` file can hold a list of links** — videos, articles, anything on the web for
   that chapter — and the panel shows them instead of opening the file. Write it as a list
   of entries, each with a **title** to read and a **url** to open:

   ```json
   [
     {
       "title": "Overview: 1-2 Chronicles",
       "url": "https://www.example.com/watch?v=overview-chronicles"
     },
     {
       "title": "Notes on the genealogies",
       "url": "https://www.example.com/notes"
     }
   ]
   ```

   Save that as `1CH.0.json` beside your other files and the row for it gains a chevron
   (`bi-chevron-down`) and a 🔗 icon, with one row per entry hanging under it. **Click a
   title to open it in your own web browser** — Chrome, Edge, Safari, whatever you
   normally use — and the site it goes to is shown after the title when the panel is wide
   enough, with the title and the full address on the tooltip either way. Right-click a
   link (or use its **⋮**) for **Open Link in Browser** and **Copy URL to Clipboard**. 📸
   A few details worth knowing:
   - A bare address on its own line — `"https://www.example.com/talk"` — is a link that
     titles itself, so a quick list needs no titles at all. An entry with no title shows
     its address as the title.
   - Only **`http`** and **`https`** addresses are offered. Anything else is left out and
     the panel says how many entries it could not read (**1 entry was not understood**),
     so a typo shows instead of a row quietly going missing.
   - **A `.json` that is not a list of links is just a file.** If it holds other data, or
     is not valid JSON at all, the row keeps the ordinary file icon with no chevron and a
     click opens it in your text editor like any other file — nothing to dismiss.
   - The file is read when its row appears, so editing it on disk and folding the group
     shut and open again shows your change. Files found by the **search** in step 5 are
     read on the first click instead, which is why a link list found that way needs one
     press to show its links.
   - Right-click the `.json` row itself (or its **⋮**) for **Open** if you want to edit
     the file rather than follow a link.

8. Click a group's header to fold it away; it stays folded next time. Right-click a header
   for **Refresh** (re-reads that one folder — **Reload** in step 3 does all of them),
   **Add Folder**, **[en:tran:Add Files]**, **Reveal in Finder**/**File Explorer**,
   **[en:tran:Copy to Data Directory]** and **Remove Folder**, which asks you to confirm and
   then only removes it from this list — nothing on disk is touched. 📸
   **[en:tran:Add Files]** is the other way round: it puts files you already have INTO that
   folder. Pick one or several in the picker and they are **copied** in — the originals stay
   exactly where they were — then the group re-reads itself, opening if it was folded, and a
   note says how many were copied. **Nothing is ever overwritten**: a name the folder already
   holds gets a number beside it, so a second `GEN.4.pdf` lands as `GEN.4 (1).pdf`. Pick a file
   that is already in that folder and it is left alone rather than copied beside itself. Copy in
   a file named after no chapter — `notes.docx` — and it is on the shelf but not in the list;
   the note says so and tells you to tick **[en:tran:Others]** (step 5) to see it. 📸
   **[en:tran:Copy to Data Directory]** brings a folder you keep somewhere else in with the rest
   of the app's data, so it lives and moves with it — **[en:tran:Export Data]** (W-25) carries
   it in a backup, which a folder only listed here does not. It asks first, naming the folder and where
   the copy goes — a `resources` folder inside your data folder (the one Settings calls the
   parent directory). Press **Yes** and everything in the folder is copied there, sub-folders
   and all, while the progress bar runs; then the group switches to the copy, in the same place
   and folded or open as it was, and a note says where it went. **Your original folder is not
   touched** — it only leaves this list, so delete it yourself once you are happy with the copy.
   A second copy of a folder with the same name is called `YouTube (1)` rather than mixed into
   the first. The item is not offered on a folder that already is a copy, and a folder that
   holds your data folder — your whole Desktop, when the data lives on the Desktop — is refused
   straight away with **[en:tran:The data directory is inside this folder]**, because it would
   be copied into itself. 📸

> **Watch the numbering.** The chapter number has to stand on its own between two dots. For
> Psalm 1 that means `PSA.1.pdf` is found while `PSA.10.pdf`, `PSA.100.pdf` and `PSA.149.pdf`
> are left alone — which is exactly what you want, since a full set of the Psalms has all of
> them in one folder. Write the numbers plainly: no leading zeros (`PSA.01.pdf` is not
> found), and `-0` is not a number. Upper and lower case do not matter.

> **If a group shows a warning** instead of files: **Folder not found** means the folder was
> moved, renamed or deleted since you added it (remove it and add it again);
> **Cannot read folder** means the app is not allowed to read it. **Too many folders to
> search** means even those two levels held more folders than it could read — point
> Resources at the folder your material is actually in rather than at a whole drive.
> A file you expected that is simply **not listed** is usually more than two folders down:
> add the folder it sits in (or the one above it) as a group of its own.

_Verify: RD-81, RD-82, RD-83, RD-84, RD-85, RD-86, RD-87, RD-88, RD-89, RD-90, RD-114, RD-115, RD-116, RD-117, RD-118, RD-119, RD-120, CM-93._

---

### W-38 — See how people and places connect (Connection Graph)

The record window tells you _who_ someone is. The graph shows you _how they connect_ —
parents, spouses, children, cousins and places, all on one canvas you can explore.

1. Open the **Names and locations lookup** (`👤📍`) from the Bible Lookup header and find
   a person — try **Jacob** (យ៉ាកុប). 📸
2. Click the **⋮** at the right end of the row — or **right-click** the row — and
   choose **[en:tran:Open Graph Preview]**. A floating window opens with
   that person in the middle.
   > You can right-click a name anywhere it is already clickable — in the list, in the
   > **names and locations in your reading** panel, underlined inside a verse, or in the
   > related-names list of a record window. The **⋮** is on the rows of the first two,
   > which is where you would go looking for it; a record window also has a `⛶`-style
   > graph icon beside its title.
3. Each box shows a number next to a small diagram icon — that is how many related
   records it has. **Click the number.** A menu opens listing **All (44)** first, then
   only the kinds this record actually has: _Parents (2)_, _Spouses (4)_, _Siblings (2)_,
   _Children (13)_, _Cousins (22)_, _Locations (1)_. 📸
4. Pick one kind — say **Children** — and just those boxes appear, ringed around the
   person and joined by curved lines. Each line is labelled with the relationship as you
   would say it: _son_, _daughter_, _wife_, _father_, _located at_.
   > Choosing **All** on a record with many relations asks you to confirm first, because
   > forty-odd boxes at once is a lot to read.
5. Explore: **drag** any box to move it (it stays where you put it), **drag the empty
   canvas** to pan, and **scroll** to zoom in and out around your pointer.
   **Double-click** a box to make it the new centre.
   > **Right-click a box** for a menu of everything that box can do: **Open detail**,
   > **Verses (8)**, **Open all Related (23)**, **Collapse**, **Set as centre**,
   > **Use as root** and **Remove**. _Set as centre_ re-arranges the whole graph around
   > that box; _Use as root_ clears everything else away and leaves just it, so you can
   > start exploring again from a record already in front of you. It is the same set as the small buttons along the bottom of the box, but
   > it also works on a box you have collapsed, which shows no buttons at all. Rows you
   > could not use are simply absent — the centre box offers no _Remove_, and a record
   > with no relations offers no _Open all Related_.
   > The **Verses** list names each verse the way YOUR Bible names it —
   > _លោកុប្បត្តិ ២៤:២៩-៣០_, not `GEN 24:29-30` — and picking one opens it.
6. Too busy? The coloured chips along the top switch each kind of connection on and off —
   turning **Cousins** off is usually the difference between a tangle and a family tree.
   **Right-click a chip** to show _only_ that kind, and right-click it again to bring
   everything back. 📸
7. Bottom-right: **↺ Undo** and **↻ Redo** step through everything you have done to the
   graph — a box you dragged, a zoom, an expansion, a filter — and **Ctrl+Z** / **Ctrl+Y**
   do the same. One wheel gesture is one step, however many notches it took.
   **Fit to view** (`⛶`) brings every box back on screen, **Re-layout** (✨) tidies the
   whole arrangement — a family fan back into rings, a found path back into its chain —
   and the `^` button collapses every box to a single line so a big graph fits.
   > Nothing here is one-way: if a tidy-up is not what you wanted, Undo puts every box
   > back where it was.
8. **Find the line from this person to another.** Click the signpost icon at the top
   right. The graph's own centre is already the starting point — it sits there as a chip —
   so you only say where you want to get TO: type **jesus**, pick **យេស៊ូវ (Jesus)** from
   the list (every name is offered with its English name beside it), and press
   **[en:tran:Find Connection]**. The canvas fills with the generations from David
   down to Jesus, the connecting line highlighted, and every box on it still expandable. 📸
   > The panel takes the name of the person the chain STARTS from, and that first box
   > becomes the graph's new centre.
   > Paths run through people only. A place like Jerusalem touches almost everyone, so
   > allowing places as stepping stones would "connect" any two people meaninglessly.
   > If there is genuinely no link you will see **No connection found** — that is an
   > answer, not an error.
9. Keep it: the `⋯` menu at the top right offers **Save as image** (a PNG saved to your
   Downloads folder and revealed for you), **Print** (which prints on white paper
   whatever theme the app is using), and **Save preset** to name an arrangement and come
   back to it later.
10. **Take it away as words.** The clipboard button (📋) left of the signpost opens six
    ways to copy the graph: **[en:tran:Copy as Markdown]** on its own, then five diagram
    languages — **[en:tran:Copy as Mermaid (across)]**, **[en:tran:Copy as Mermaid (down)]**,
    **[en:tran:Copy as Mermaid Mindmap]**, **[en:tran:Copy as Graphviz DOT]** and
    **[en:tran:Copy as PlantUML]**. Hover a row for its full name; the message that
    follows the copy says which one landed. 📸
    > **Markdown** is the graph written out for a note or a document — **the diagram
    > included**. It opens with the drawing itself in a `mermaid` block, so a wiki, a
    > repository, a notes app or this app's own markdown preview draws the same boxes
    > and lines; under it come every record with its kind and one-line description in a
    > table (the one in the middle marked _(centre)_), the connections grouped by kind
    > — _son_, _wife_, _located at_ — and the verses each record cites. Names, kinds
    > and relationship words come out in the same language the records are in.
    > **Which diagram language?** Whichever the thing you are pasting into reads.
    > **Mermaid** is drawn by most places that show markdown, and comes three ways: the
    > usual one runs **across** the page, **down** suits a line of generations, and the
    > **mindmap** turns the graph into a branching tree around the middle record —
    > easiest to read at a glance, but a tree cannot show a second link between two
    > people, and it carries no relationship words. **Graphviz DOT** and **PlantUML**
    > are for tools and wikis that draw those instead. Every one of them describes
    > exactly the boxes on the canvas, so switching a kind of connection off first is
    > how you copy only part of a graph.
11. **See it drawn, without leaving anything behind.** The last row on that same 📋 menu,
    under a divider, is **[en:tran:Open in Mermaid Live]**. It opens a second little menu
    — **[en:tran:Mermaid (across)]**, **[en:tran:Mermaid (down)]**,
    **[en:tran:Mermaid Mindmap]** — and picking one opens the Mermaid Live Editor in your
    web browser with this graph already in it, drawn. 📸
    > **Nothing is uploaded.** The diagram travels inside the address, after the `#`, and
    > a browser never sends that part to anybody's server — it is the same thing the
    > editor's own Share box does, which is why that site says the diagrams you make
    > never leave your browser. Your names, places and notes stay on this machine.
    > Only the three Mermaid rows are offered, because that editor draws Mermaid and not
    > Graphviz DOT or PlantUML.
    > It is the quickest way to get a **picture** of a graph out of the app for a slide or
    > a handout — the editor can zoom it, recolour it and save it as a PNG or an SVG.
    > A very large graph makes an address too long for the browser to be handed. If that
    > happens the app says so and puts the link on your clipboard instead: open your
    > browser and paste it into the address bar.
12. Opening a record always starts you at that record, with one box — every time, however
    you left the window last time. 📸
    > If an arrangement is worth coming back to, say so: `⋯` → **Save preset**, name it,
    > and it is waiting in that same menu next time.

_Verify: RD-92, RD-93, RD-94, RD-95, RD-96, RD-97, RD-98, RD-99, RD-100, RD-101,
RD-102, RD-103, RD-104, RD-105, RD-106, RD-121._

### W-39 — Let the passage scroll itself while you read

When a chapter is longer than the panel, you do not have to keep reaching for the mouse
wheel — the app can scroll it for you, at whatever pace you set.

1. Open a passage long enough to scroll, in a Bible panel or on the screen preview.
   Down in the bottom-right corner of the text, two faint controls sit one above the
   other: an up-arrow (**[en:tran:Scroll to the top]**) and a double chevron below it.
   The double chevron is the auto-scroll button. 📸
2. Click the double chevron once. The text starts creeping downward. Click it again and
   it goes faster; each click adds a little more speed.
3. As soon as it is moving, a **⋯** appears just to its left. Click it. 📸
   A small menu opens listing everything this button can do, with the mouse action for
   each one written beside it:
   - **[en:tran:Auto Scroll Speed]** — how fast it is going right now.
   - **[en:tran:Speed Up]** — the same as clicking the chevron.
   - **[en:tran:Speed Up Faster]** — a bigger jump, the same as double-clicking it.
   - **[en:tran:Slow Down]** — the same as right-clicking it.
   - **[en:tran:Stop Auto Scrolling]** — the same as Alt + right-click.
4. Pick **Slow Down** a couple of times and watch the speed number fall each time you
   reopen the menu. Pick **Stop Auto Scrolling** to end it — the text stops and the **⋯**
   disappears, because there is nothing left to control. 📸
   > The **⋯** is only ever there while the passage is actually scrolling. If you cannot
   > see it, the passage is not moving — click the double chevron first.
   > You never have to use the menu: the four mouse actions it lists work directly on the
   > double chevron itself, and always did. The menu is there so you can find them, and
   > so they work on a touch screen, where there is no right-click at all.

_Verify: RD-107._

---

### W-40 — Mark up a passage while you study it

**Goal:** highlight words in a passage in colour, and attach a note to a phrase, so both
are still there the next time you open the app.

1. Open the **Reader** (📖) and bring up a passage — say `Genesis 22:1-24`.
2. Drag across a few words inside a verse, the way you would to copy them. A small
   toolbar appears just above what you selected. 📸
   It has six coloured dots, then a **speech bubble** and an **eraser**.
3. Click the **yellow** dot. The words you selected — and only those — take on a soft
   yellow wash, and the toolbar goes away.
   > The colours are a fixed set of six. They are meant to read like a highlighter pen
   > over the text, so the verse still reads as scripture underneath.
4. Look at the left panel and open **[en:tran:Bible Notes]**. Under
   **Default** there is now a new row named after the verse — `(KJV) Genesis 22:1` — with a
   highlighter pen in front of it and a small number on the right saying how many marks it
   holds. Click it to fold it open. 📸
   Inside are the words you marked, wearing the very colour you gave them — the panel shows
   the mark rather than describing it, so the number on the right steps aside while the row
   is open.
   > This row lives in the same note file as your ordinary bible notes, so it is saved,
   > backed up and exported along with them. You never have to put it anywhere.
5. Back in the passage, select a different phrase and click the **speech bubble**. 📸
   The phrase gets a wavy underline instead of a wash, and a small window opens with the
   verse's name at the top and an empty box. Type your note into it.
   Close the window with the **✕**. Nothing else to press — it saves as you type.
6. Now move the mouse over those underlined words. 📸
   A little panel appears under them showing what you wrote, with two buttons: a **pencil**
   to open the note again, and a **bin** to delete it.
   > Move the pointer straight down onto the panel to use its buttons — it waits for you.
7. Each mark under the verse has a **⋮** at its right end (right-clicking the mark does
   the same). Its menu offers the five other colours, so you can recolour a highlight,
   **Edit Comment** on a comment, and **Delete**.
8. Click any mark in that list. 📸 The verse it belongs to opens as a new passage
   beside the one you are reading — the passage you were in stays where it is — and it
   flashes if it happens to be on screen already.
   > A mark is a place you kept inside something you were reading. Reaching it should not
   > cost you your place, which is why it opens beside rather than on top.
9. The verse row itself has a **⋮** too. 📸 It can do three things:
   - **[en:tran:Add to Bible List]** — puts that verse in your **Bibles**
     list, ready to present, without going and looking it up again.
   - **[en:tran:Move To]** — moves the whole row, marks and all, into one of your other
     note files.
   - **[en:tran:Delete]** — removes the verse and everything marked on it, after asking.
   > You can also just **drag the verse row and let go**. Dropped on a file in the
   > **Bibles** panel it arrives as an ordinary bible item, the same as if you had looked
   > it up; dropped on another file in **Bible Notes** it moves there instead, marks and
   > all. One drag, and where you let go decides which it means.
10. Delete the last mark on a verse and the verse's row disappears from **Bible Notes**
    too — an empty row would only be something else to tidy up later.

> Marks belong to the translation you made them in, because they remember which words
> they cover and every translation words a verse differently. A mark made on KJV is not
> painted over a Khmer column of the same verse. That is also why a verse row, its
> marks, your comments and the comment window are all lettered in the font that bible
> is read in rather than the app's own.
> They also stay in the app: what you highlight here is never shown on the screen your
> congregation sees.

_Verify: RD-108, RD-109, RD-110, RD-111, RD-112._

---

### W-41 — Share a whole page of Bible Notes with another machine

Until now a note could only leave the app **one item at a time**. A whole note file —
every note in it, the pictures and clips inside them, and the background you attached
to it — travels as one bundle.

1. In the **Bible Notes** panel, click the `⋮` on the note file you want (or right-click
   its name) and choose **[en:tran:Export]**. It sits just under **Import**. 📸
2. A small panel asks for a **[en:tran:Password]** and a **[en:tran:Confirm Password]**. Leave both empty for an ordinary bundle, or type the same
   password in both to lock it. Press **[en:tran:Ok]**.
3. You get one `<name>.owanote.tar.gz` file in your **Downloads** folder —
   `<name>.owanote.enc` if you set a password — and the app opens the folder on it. 📸

   > Everything a note points at rides inside: a picture you pasted, a clip you inserted,
   > the sound file you attached. That makes this bundle much larger than a bible list's,
   > so give a note full of video a moment to finish.

4. On the other machine, click the `⋮` at the top of the **Bible Notes** panel → **[en:tran:Import]** and pick the file — or **drag the `.owanote.tar.gz` (or `.owanote.enc`) onto
   the Bible Notes panel**. A protected one asks for its password first.
   **[en:tran:Import From URL]** works here too if the bundle is on the web. 📸
5. The note file appears in that machine's notes folder with all its notes, your
   highlights and comments, and its pictures and clips playing from the local copies.

   > If a note file of that name is already there, yours is never overwritten: the
   > imported one arrives beside it as `name (1)`. Rename whichever you prefer.

6. To move a **single note** instead of the whole page, use the `⋮` on that note →
   **Export**, and **Import** on the note file you want it to land in — any note file,
   not only **Default**.

_Verify: PR-30, PR-31, CM-69, CM-98, CM-99._

---

### W-42 — Ask the app for help (the chatbot)

The app can answer its own "how do I …?" questions. It reads the same manual you are
reading now, looks at what the app is doing at that moment, and can point at the button
it is describing.

1. Click the **🤖** button in the top-right corner of the window, between the gear
   and the **✨** (the AI Chat window, W-44 — a different thing: a company's chat site
   in a box), or open **Help** → **App Help (Chatbot)** in the menu bar. A narrow
   window opens beside the app. 📸
   **The 🤖 button is only on the three windows with a top bar** — the Presenter, the
   Bible Reader and the Slide Editor. Everywhere else, and on those three as well, the
   way in is the **Tools** menu → **App Assistant**, or **Ctrl+Shift+A**
   (**⌘+Shift+A** on Mac). That works from a Bible Note, Settings, the Web Editor, the
   Lyric Editor and Local Web Share — the windows a volunteer is most likely to be
   stuck in — and the menu bar is hidden on those, so the shortcut is the way in. If a
   help window is already open it comes to the front rather than a second one opening.
   With **AI features** switched off in Settings → Others, the button, the menu entry
   and the shortcut all go quiet together.
2. A strip of **tabs** runs along the very top — several conversations at once, the way
   a browser holds several pages. **+** starts another, **×** closes one, and a
   **double-click on a tab's name** renames it (useful once three of them start "how do
   I"). Until you rename it, a tab is called after the first question you asked in it.
   Everything is kept: close the window — close the app — and the tabs, their answers
   and even a half-typed question are all there when you open it again. 📸
3. Every tab opens with a **⋮** on its left, and a right-click anywhere on the tab
   does the same thing: it is that chat's own menu — **Rename this chat**, **Lock this
   chat**, **Close this chat**, and, when there is more than one chat to take, **Close
   other chats…** and **Clear all chats…**. Those last two are never done on the first
   press: a line appears under the strip saying how many chats will go, with **Keep
   them** beside the button that does it. 📸
4. **Lock this chat** is how you keep one. A locked tab has no **×** any more — a 🔒
   sits there instead — and neither **Close other chats** nor **Clear all chats** takes
   it, so the strip can be cleared at the end of a service with the one answer worth
   keeping still in it. **Unlock this chat**, in the same menu, gives the **×** back.
   The lock is remembered with everything else, so it is still locked next Sunday. 📸
5. The rest of the top line belongs to the tab in front, and it is three **drop-down
   lists**, each with its own small grey caption saying what it is for —
   **ASKING ABOUT**, **ASSISTANT** and **MODEL**. (Narrow the window and the captions
   move to sit above their lists instead of beside them.) The first,
   **ASKING ABOUT**, says which window of the app you are asking about —
   **Presenter**, **Bible Reader**, **Document Editor**, **Bible Note**, **Settings**,
   **Web Editor**, **Lyric Editor** or **Local Web Share**. Every time you open the
   help — including bringing an already-open help window back to the front — the
   active tab starts on the window you opened it from. A choice you make afterwards
   stays with that tab until the next launch, and the other chat tabs keep their own
   choices. The suggested questions change with it: opened from
   the Lyric Editor it offers marking verses and choruses, opened from Settings it
   offers the language and the Bible downloads. Answers follow it too — a recipe
   belonging to another window names buttons that are not on your screen, so it is
   left out. Another tab can be asking about a different window at the same time. **ASSISTANT** is which service answers and **MODEL** is which of
   its models; with no API key at all the third one reads **app guide · offline** under
   **ANSWERS FROM**, and clicking it opens the settings panel that takes a key. 📸
   When **ASKING ABOUT** is **Bible Reader**, answers lead with the easiest mouse or
   touch route, use no more than three steps at first, say where the control is, and
   explain actions such as double-clicking or dragging. A lost item starts with a
   history or recovery route, not a request to remember it, and a failed step gets a
   different safe route or one short question that identifies the next exact step.
   Any steps shown begin at 1, and the choices below the answer stay specific to that
   answer, including a recovery choice when the first route may fail. The wording is
   respectful and plain; it does not assume the reader knows computer terms or
   keyboard shortcuts.
6. Type a question and press **Ctrl+Enter**, click **Ask**, or click one of the
   suggestions. Answers arrive with follow-up buttons: **Read the whole thing** opens
   the full recipe, the other button is the next-best match. Pages of this guide are
   always named by their **title** — _the guide page “Set the background”_ — never
   by a code or a number, whatever the assistant was reading. 📸
   **The four suggestions are not all it can answer — press More… to see the
   rest.** Under the **Try asking** chips on an empty chat is a small
   **More… — everything it can answer** button. It opens the whole list for the
   window you are asking about, sorted under the panel each question belongs to
   — _Bible_, _Backgrounds_, _The screen the audience sees_, _Nothing on the
   projector_, and so on. There are 184 of them for the Presenter, and every one
   has a page of this guide or a look at the live app behind it, so nothing on
   that list can be pressed and come back with a shrug. It is worth a scroll
   once: most people use this window for the one thing they first saw it do.
   Press any of them to ask it, or type a few words in the box and the same list
   narrows itself as you type. **Fewer** folds it away again. 📸
   **The Bible Reader also has 30 guided demos that need no AI model, key or
   account.** Set **ASKING ABOUT** to **Bible Reader** and, in an empty chat,
   use **Try a guided demo**. The original four practise text size, opening
   John 3:16 with buttons and finding Bible words. Twenty more cover passage
   history, clearing the reference, people and places, two Bible versions,
   distraction-free reading, copy/split/save, automatic scrolling, line
   layout, cross references, names in the current passage, Resources, book
   filters and the Bibles/Notes side panel. Seven more practise typing a
   complete reference, removing only its last part, automatic Bible audio,
   note filtering and sorting, Settings and Help. The full Tips list also
   explains how View > Widgets shows or hides the whole saved-passages panel,
   saved Bibles, or Bible Notes; those three are self-guided because an open
   pane is not itself a toggle.
   A card appears in the Reader. Press
   **Do it** for one visible action at a time, or **Skip** to do that step
   yourself. The reference demo uses the Bible's own book, chapter and verse
   buttons, so it also works when those buttons are not in English. Study-view
   demos choose the named view even when the panel remembered a different one.
   📸
   **The box takes as many lines as you need.** Plain **Enter** starts a new line
   rather than sending, so a question can be written out properly — what you did,
   what happened, what you expected — and the box grows as you type, up to about
   eight lines, then scrolls. **Ctrl+Enter** is what sends it.
   **A question you asked before comes back with Alt+↑.** The window remembers what
   you have typed into it — across every tab, and from one day to the next — and
   **Alt+↑** puts the question before back in the box, with the cursor at the end of
   it, ready to be changed. **Alt+↓** walks forward again, and one press past the
   newest gives you back whatever you were halfway through typing, untouched. It is
   for the question that was nearly right: bring it back, fix the verse reference or
   the screen number, and ask it again without writing the whole sentence out twice.
   (The plain arrow keys still move the cursor and still walk the list of
   suggestions, which is why this one wants **Alt** as well.) 📸
   **You can just carry on talking.** Each tab is one conversation, so the answer to
   "is any screen showing?" can be replied to with **yes**, or with "how do I turn it
   off?", and it knows what you mean — you do not have to say the whole thing again.
   Each tab keeps its own thread: a question asked here is never answered out of the
   chat next door.
   **And you rarely have to type the next thing.** Every answer ends with two or
   three short buttons in the assistant's own words — _“How do I style the verse
   text?”_, _“Which button shows it?”_, _“No thanks”_ — and pressing one says it for
   you, as if you had typed it. A reply that only repeats **Show me step by step**
   in other words is not offered beside it. They are the round-cornered buttons on the bottom row; the
   square ones above them, in capitals, are the ones that DO something in the app.
   Only the newest answer carries them, so a **Yes** is always a yes to the question
   you were just asked. 📸
   **It tells you what it is doing while you wait.** Under your question, a
   short list builds up as it works — _Connecting to the app_, _Thinking about
   it_, _Searching the guide for "background"_, _Checking the projector
   screens_, _Reading example.com_, _Creating a new song: "Amazing
   Grace"_. The one it is on now is the bright line at the bottom with the
   pulsing dot; the ones above it are done and go grey. A question that has to
   read a web page and write a song out of it takes the best part of a minute,
   and this is how you can tell it is getting somewhere rather than stuck — and
   whether it is doing what you meant. If it says _Reading_ a site you did not
   ask about, or _Pressing_ something you did not want pressed, that is the
   moment to press **Stop**. 📸
   **Changed your mind? Press Stop.** While an answer is on its way the **Ask**
   button becomes **Stop**, and the last line under the steps says so —
   _press Stop to give up on it._ Pressing it (or **Esc**) calls
   the question off there and then: the chat says **Stopped**, nothing arrives
   afterwards, and your question is still sitting above it with **Ask again**
   under it. Use it for a question asked by mistake, one taking longer than you
   have before the service starts, or an assistant that is thinking its way
   round the houses. 📸
   **And you can keep talking while it works.** The box is not locked while an
   answer is coming: type the thing you forgot to say and press **Add** (or
   Enter) and it goes into the answer that is already being written, rather than
   starting a second question — the line joins the conversation marked _Added
   while it was working_. If it arrives too late to be worked in, it is answered
   on its own and the reply says so. Press **Stop** instead and every word you
   added comes straight back into the box: nothing you typed is thrown away. 📸
   **A question you picked from the list is answered from its own page.** The
   **Try asking** chips, the suggestions under the box and the **More…** list are
   the app's own supported questions, and each one is filed under the page of this
   guide that answers it — so picking one goes straight to that page rather than
   searching for it, with an assistant or without one. Type the question in your
   own words and it is searched for as before.
   **Some things need no assistant at all — type `/`.** A line that starts with
   `/` is a **command**: it runs on the spot, on this machine, with no assistant,
   no key and no internet, and the answer says what CHANGED. Type `/` on its own
   and the list of them appears above the box — walk it with the arrows or click
   one. **/screen** says whether anything is on the projector AND what is on it
   — the song and the verse, the passage, the background — even while the screen
   is off, so _the screen is off but already holds Verse 2, turning it on shows
   that_ is the answer rather than a bare _nothing is showing_; **/screen-show**
   turns the screen on and **/screen-hide** turns every screen off, and both read
   the screens back afterwards, so _the screen is on now_ is never a guess;
   **/clear-all**, **/clear-background**, **/clear-slide**, **/clear-bible** and
   **/clear-foreground** press the five clear buttons (**F6**–**F10**);
   **/selected** says which song is selected, which of its slides is up and
   which comes next; **/next** and **/previous** put the next or the previous
   slide of the selected song on the screen — the arrow keys, from the ask box —
   and read the screens back afterwards, saying so when the screen itself is off;
   **/run** says which run sheet (presenting flow) is open in its run player,
   the line the run is on — and the slide inside it — and what the next press
   puts up, or names the sheets there are to open when none is (it presses
   nothing: advancing a run is your own **Space** in the run player);
   **/verse John 3:16** puts that passage on the screen — read by the app's own
   reference parser, in the Bible version the Bible Lookup is on (or another
   installed one that reads it), and read back afterwards: _John 3:16 (KJV) is
   on the screen now — "For God so loved…"_, with _Turn the screen on_ offered
   when the screen is off and _Take it off again_ beside it (**F9**). Asking in
   words does the same: _Put John 3:16 on the screen_ puts it up straight away
   with an assistant, and offers one button that does it without one;
   **/countdown 5** starts a five-minute countdown on the screen (**/countdown
   10:30** counts down to a time, **/countdown stop** takes it off; **/timer** is
   the same command) and **/marquee Please silence your phones** scrolls the
   words along the bottom (**/marquee-top** along the top; **stop** takes either
   off) — each read back afterwards, _a 5 minute countdown, ending at 11:45 AM is
   on the screen now_, with _Turn the screen on_ offered while the screen is off
   and _Take it off again_ beside it. Asking in words does the same: _Start a 5
   minute countdown on the screen_ or _Put the time on the screen_ starts it
   straight away with an assistant and offers the screen's own show button, and
   without one the guide offers one button that starts it; the five **/clear-**
   commands clear a layer the screen HOLDS even while it is off;
   **/find Clear Bible** outlines a control in red; **/goto reader** switches the
   main window (the projector is untouched); **/here** says which window is in
   front; **/help clear bible** searches this guide without an assistant;
   **/credit** says what this chat has cost so far (also **/cost**); **/limit**
   says or sets the hourly spending limit (**/limit 2**, **/limit off**, and
   **/limit more** to carry on after a pause); **/lyric https://…** reads a
   song page — a hymnal's text page, a chord sheet — and writes the song out
   for the Lyric Editor with its chords where the page puts them, and
   **/lyric** followed by pasted words writes those out (also **/lyrics**,
   **/hymn**, **/new-song**); either answers in a few seconds with what the
   song is and the two buttons — **Create "…"** and **Copy song text** — and
   the song text as it will be saved drawn above them, and NOTHING is saved
   until you press Create (a _page on hymnary.org was read_ notice appears in
   the app window while the page is read). Asking in words does the same
   without an assistant — _Create a lyric file from https://…_ is answered by
   the built-in guide with the same buttons when no assistant can answer;
   **/commands**
   lists them all. The square buttons under a command's answer are
   commands too — _Turn the screen on_ under _nothing is showing_ — and pressing
   one writes the command into the chat as though you had typed it, so the word is
   there for next time. A command with a spelling mistake lists the real ones
   rather than guessing. 📸
   **One line above the box tells you something this window can do.** A 💡 and a
   short sentence — the picture button, the walkthrough cards, **Report**, **Alt+↑**,
   locking a tab. It is a different one each time the window opens, and clicking the
   line gives you another; the cursor goes straight back to the box, so reading one
   never costs you the question you were writing. 📸
   **The two small arrows at the end of that line walk them in order.** **›**
   goes to the next one and **‹** back to the one before, round and round, so
   you can read the lot in a quiet minute before a service instead of waiting
   for the right one to come up — and, more usefully, **‹** brings back the tip
   that changed while you were still reading it. (Clicking the sentence itself
   still picks one at random, which is the quick way to be shown something
   new.) 📸
7. **Show it, instead of describing it.** Beside the box are three buttons.
   **📎** attaches a picture or a file from your computer; **📷** takes a picture
   of the app as it looks right now; **🎯** lets you POINT — an outline follows
   your mouse over the app and the control you click is the one you meant.
   You can also paste a picture straight into the box (**Ctrl+V**) or drag a file
   onto the window. Whatever you attach shows as a small chip above the box, with
   an **×** to take it off again, and up to four can ride one question. Clicking a
   control to point at it does **not** press it — the app does not act on that
   click, so it is safe to point at **Clear Bible** and ask what it does. 📸
   **Press a chip to see what it stands for.** A control you pointed at is
   **circled in red** in the app window again, so you can find it after looking
   away; and **every file or picture opens** — big enough to read, right here
   over the conversation (press anywhere, or **Esc**, to close it).
   **Answers can carry them too.** When the assistant points you at a button or a
   file, it puts a chip under its answer as well: press it and the button is
   circled in the app, or the file opens.
   **Whatever opens, you can keep it.** Under every preview is **Download**,
   which saves the file into your **Downloads** folder and opens it there —
   a picture, a report, a song, anything. Beside it are **Copy**, which puts
   the picture or the words on your clipboard, and **Open folder**, which
   shows you where the file already lives. A file that is already in
   Downloads is opened rather than copied again, so pressing Download twice
   never leaves you with two of them. A kind this window cannot draw — a
   video, a PDF — opens as a card naming it, with the same buttons under it.
   Every picture chip also carries a small clipboard icon that copies the
   picture without opening it, so it can go straight into an email. 📸
   **Pictures are kept only while the window is open.** Close the help window and
   the conversation is all still there, but the picture itself is gone — the chip
   goes grey and says so. Ask again with a fresh one if you need to.
   **Some assistants cannot see pictures.** If the one you have chosen cannot, the
   window says so before spending anything and offers you one that can, in a
   single press.
   **And it can ask to be shown.** When the assistant cannot answer without
   seeing your screen it says so and puts the button right there — _Send a picture
   of my screen_, _Point at the control_, _Attach a file_ — so you never have to
   work out how to send it one. 📸
8. Under every answer is **Copy**, which puts that answer on the clipboard and says
   **✓ Copied**. Under every question of yours is **Ask again** — or just click the
   question itself — and the same words go back in the box, ready to be changed a
   little and asked again. 📸
   **And every answer says what it cost.** At the right-hand end of that same line,
   in small grey figures, is what the assistant spent answering — a few cents at
   most for an ordinary question, and the tokens it used — and a line under the
   three pickers at the top, **CREDIT USED**,
   keeps the running total for the whole chat: every question in this tab, including
   one you stopped part-way or one that failed, because the credit is spent whether
   or not an answer arrived. Each tab keeps its own total, and it is remembered with
   the rest of the tab. Hover either figure for the sums — how many times the model
   was called, how many tokens went in and came out, how much of that was served
   from the cache. The dollars are an **estimate from the model's list price**, so
   the bill from your provider is the figure that counts; a free service reads
   **free**, and a model this app has no list price for reads **price not known**
   with the tokens still counted. Nothing at all is shown until a question has been
   asked. The assistant itself cannot read these figures — it can only say where
   they are — so for the total in words type **/credit**, which answers from the tab
   itself with no assistant involved. 📸
   **And it cannot run up the bill on its own.** At the right-hand end of the
   pickers' own line, after MODEL, is **LIMIT PER HOUR**, a small list that starts on **$1** —
   the most the assistant may spend in any one hour, across every tab of this
   window. Beside it, once something has been spent, a figure says where the hour
   stands (*≈ $0.31 of $1 this hour*); it turns **amber** past four fifths of the
   cap, and the answer that crosses that line carries a *Heads-up* note. At the
   cap the assistant **pauses**: the next question is answered from this guide
   instead, under a note saying why, the figure reads *paused*, and an
   **Allow more** button appears in the note and in the top line. Pressing it
   starts the hour again with the whole limit available and asks your question
   once more; nothing else lifts a pause — not time passing, not a restart — because
   the point of it is that a fault which keeps asking cannot press a button.
   Pick a different amount from the list (**$0.25** to **$20**, or **No limit**)
   to change it; **No limit** keeps only the pace cap, which pauses after **150
   model calls in one hour** whatever they cost — more than a person asks for, and
   the one thing that protects a free service, which the money cap cannot see.
   **/limit** says all of this in words and **/limit 2**, **/limit off** or
   **/limit more** do the same as the list and the button. The figures are the same
   estimate the credit line is. 📸
9. **Something wrong with the app itself? Press Report.** Under **Ask** is a quieter
   **Report** button, for when the answer is not "how do I" but "this is broken".
   Say what went wrong in the box — one line is enough — and press it. It asks
   first, quoting back what it is about to report, with **Not now** beside
   **Report it**, so a mis-hit costs you nothing. (Press it with an empty box and it
   takes the last thing you asked, which after a wrong answer is usually what you
   mean.) 📸
   Say yes and it goes and looks: it photographs the app as it stands, notes the
   version, the window you are in and what the screens are doing, reads the app's own
   error log, and then investigates the problem in the running app. A few seconds
   later it comes back with what it found and a report written up in your place,
   with a **Send report** button under it. **Nothing is sent until you press that** —
   and there is no bug tracker connected to this app yet, so what it does today is
   save the whole thing, with the picture, into your **Downloads** folder and tell
   you where and who wants it: the answer names the maintainers' email address and
   the subject line to use, and five buttons do the rest — **Copy report** puts the
   whole write-up on your clipboard, **Copy subject** the subject line,
   **Copy picture** the screenshot (paste it into the message and most mail apps
   attach it), **Copy email address** the address, and
   **Email it** opens your own mail app with the address and subject filled in (the
   report is on your clipboard, so paste it in and attach the picture from
   Downloads). The address is read from the app's help page at the time, and only
   when that cannot be reached does it fall back to the one built into the app —
   the answer says which. The saved file opens with the same "How to send this"
   section, so it still says where to go a week later. 📸
10. Ask **"where is …"** and name a button — the chatbot outlines it in **red** in the app
    window for a few seconds, and tells you where it is. Nothing is clicked for you. 📸
11. Ask about screens ("is any screen showing?") and the answer comes from the live app,
    not the manual — with a **Hide every screen** button offered, never pressed for you.
12. With an **AI key** set in **[en:tran:Settings]** → **Others** → **AI Providers**, the
    same window becomes a real conversation: the model answers, using the same app
    knowledge and the same tools. Without a key — or when the internet is down — it
    still answers from the manual, and says so; with no key at all it also tells you that
    Claude, ChatGPT and Kimi need one, and gives you an **Open AI settings** button that
    goes straight to the panel that takes it. That panel has one card per provider, and
    each card says in plain words what its key is used for — **OpenAI** answers here and
    powers Bible Cross Reference and Bible Audio, **Anthropic** answers here and powers
    Bible Cross Reference, **Kimi** answers here only — so you can tell which key is
    worth getting before you go and fetch one.
13. The second list is **who answers** — **Claude**, **ChatGPT**, **Kimi** — and you
    can change your mind between two questions. The ones whose key you have set can be
    chosen; the others are still in the list, in a quieter colour and reading
    **needs an API key**, so you can see they are there and what they want. Choose one of
    those and the conversation stays on the assistant it had, while **[en:tran:Settings]**
    opens on **Others** with the cursor already in that assistant's key box — for Kimi,
    **Kimi API Key** — ready for the key to be pasted in. If **[en:tran:Settings]** was
    already open on another page, that same window comes to the front and turns to
    **Others**. Beside it is the third list, the
    **model** that will answer — **Opus 5**, **GPT-5**, **Kimi K3** — and it is a list
    you can change.
    Hold the mouse over a name to see what it is good for, how quick it is and what it
    costs, e.g. `gpt-5 · best answers · slower · $1.25/$10 per 1M tokens`; the smaller
    models answer a "how do I" just as well for a fraction of it. A model whose price the
    maker does not publish simply shows no price line rather than a guessed one. Choose **More models…**
    at the bottom of the list and the window asks your own account what else it can run
    and adds those too. Each tab keeps its own provider and model, and a new tab starts
    on the last pair you picked. 📸
    **A key that cannot answer does not leave you with the guide while another of
    yours can.** When the assistant you chose is out of credit, refused, or its
    service is down, the question goes to the next assistant whose key you have set —
    once, at once — and the answer opens with a note saying so: _ChatGPT could not
    answer — the AI account is out of credit or being rate-limited. Claude answered
    instead and this chat now uses it; pick ChatGPT in the row above to switch back._
    The tab's own list moves to the one that answered, so the next question in it does
    not wait on the dead key again; a new tab still starts on the one you picked, and
    the moment that key works it answers as before. The **Free** assistant is never
    stood in for and never stands in — it is a choice you make yourself. With no
    other key, or when the internet itself is down, the answer comes from this guide,
    as before, under a note that says which. 📸
    **The note says what is wrong, and carries the door to it.** The reason is read
    from what the provider actually said, not only from how loudly it said it: _the
    AI account is out of credit_ when the account is empty, _being rate-limited
    (asked too often)_ when it is a rate limit, _out of credit or being rate-limited_
    only when the provider said nothing more, _the API key was refused_ for a wrong
    or revoked key, _the AI service is overloaded_ or _having trouble_ when it is the
    service's own fault. And the first button in the row under the note takes you to
    the page that fixes it, in your browser — **Open ChatGPT billing** for an empty
    account, **Open AI settings** and **Open Claude API keys** for a refused key,
    **Open Kimi usage limits** for a rate limit, **Claude status page** when the
    service is down — named for the assistant that FAILED, so with two keys you top
    up the right one. Hold the mouse over the button to see the address it opens;
    pressing it opens the page and the window says _Opening … in your browser._ The
    **Free** assistant has no account to go to, so its button is **Open AI settings**,
    where a key of your own goes. 📸
14. Every answer offers **Show me step by step**. Press it and a numbered card
    appears in the corner of the app window itself, with the button for the current
    step **circled in red**: press **Next** on the card when you have done it, or
    just do it — clicking the circled button moves the card on by itself. **Back**
    returns a step, **✕** stops. Steps you have already done are not shown: asked
    from the Bible Reader, a recipe that starts "click the Bible Reader tab" starts
    at the step after it instead. 📸
    The help window **gets out of your way while the card is up**: it tucks itself
    down to the taskbar (the Dock on a Mac) the moment the walkthrough starts, so
    nothing it was sitting on top of is hidden from you, and it comes back on its own
    when you close the card. Only the help window goes: the app itself stays on
    screen. If you had already put it out of the way yourself, or it was not covering
    the app in the first place, it is left exactly where you had it. To fetch it back
    in the middle of a walkthrough, click it in the taskbar or the Dock, or press the **🤖**
    button again — that reopens the chat you were in, not a new one.
15. **Do it for me** runs the same walkthrough with the app driven for you: the
    card's button becomes **Do it**, and each press clicks the circled control (or
    types the text) and moves to the next step. One press per step — nothing runs
    ahead of you — and **Skip** does a step yourself. Anything that changes what
    the congregation sees is offered, never done for you unasked. 📸
    **It presses the button the step names, and nothing that merely resembles
    it.** A step about the drawing panel's _Clear_ does not press the projector's
    _Clear All_; when the only thing on screen is a look-alike, the card says
    what it can see — _the closest control on screen is "Clear All", which is not
    "Clear"_ — and asks the assistant instead. 📸
    **Something in the way is closed first.** With the Bible Lookup popup, a
    right-click menu or a floating panel over the control the step needs, the
    card rings the way out (the popup's red ✕) and says so; in **Do it for me**
    the first press closes it and the next does the step. A question the app is
    asking — _Ok_ / _Cancel_ — is never answered for you: answer it and the card
    carries on. 📸
    **A step that is something to notice reads Next, not Do it.** _The bar under
    the search box says how many verses matched_ has nothing to press; the card
    says so and the button moves you on. 📸
16. **When a step cannot be done for you, the card goes and asks.** Some steps are
    not a button — a double-click on a verse, something to watch happen, a control
    that is not on screen yet. The card used to say it could not do that one and
    leave you to it. It now asks the assistant, which looks at your window as it is
    right now and writes one line back onto the card telling you exactly what to do
    and where. It takes a few seconds, and the card says it is asking while it
    waits. With the help window closed there is nobody to ask, and you get the plain
    instruction instead. 📸
17. The window answers about the half of the app you are in — asked from the Bible
    Reader, you are told the reader's way, never the presenter's (they differ: the
    presenter looks a verse up in a **Ctrl+B** popup, the reader has no such popup).
    It follows you: switch the app to the other page and the next answer follows,
    unless you have chosen a half yourself in the first list. Answers are in English.

> Nothing here leaves the machine unless you set a key. The manual is bundled inside
> the app.

18. **It can turn words you already have into a song.** Paste the verses of a song
    into the box — from an email, from a hymn sheet, from a page you found — and ask
    for a song; or attach a `.txt` of the words with the paperclip; or give it the
    address of a page the words are on. One of the **Try asking** chips offers this
    outright: _Can you make a song from words I paste in?_ 📸
    The answer comes back in plain words — what the song came out as, its parts and
    the order they play in, and **what it had to guess**, which is usually the key,
    the tempo, the time signature and the author, because ordinary lyrics say none of
    those. Underneath it are two buttons: **Create "<the song's title>"** and
    **Copy song text**. 📸
    The song's own notation never appears in the chat, and you never have to type it.
    **Create** writes a real song into your documents list, ready to put on a screen,
    and answers with two things to press: **Show it in the list**, which draws a red
    ring round the new song's row in the app window behind, so you can see exactly
    where it landed; and the song's name, which opens the folder it was written to.
    📸 It never replaces a song you already have: press it twice and the second is
    saved beside the first with `(1)` after the name. **Copy song text** puts the same thing on the clipboard, to paste
    straight into the Lyric Editor.
    Labels help it: write `Chorus`, `Verse 2`, `Bridge` or just `1.` and `2.` above
    the blocks and it uses them. Without labels each block becomes a verse, and a
    block repeated word for word is written once and sung each time it appears. Chord
    lines above the words are left out — Open Lyric puts chords inside the words —
    and a section it cannot make sense of is kept whole, with your own label above it,
    rather than dropped. If you paste something that is not a song, it says so instead
    of inventing one.
    **Those two buttons are the only thing to press.** The assistant sometimes
    writes its own suggestions under an answer, but under a song it never repeats
    the buttons in other words — _Create the file_ or _Copy the text_ are not
    offered, because the real buttons are right there and do the job without
    asking anybody. 📸
    **Pasted words become a song even when the assistant cannot answer.** With no
    key set, out of credit, or refused for asking too often in a minute (a free
    Kimi account allows about three questions a minute), a paste of song words is
    written out by the app itself in a second or two, under a note that reads
    _I wrote the song out myself instead_ — with the same **Create** and **Copy
    song text** buttons, and nothing searched in this guide for the words. 📸
19. **Give it the address of a song page and it reads the page for you.** The fourth
    **Try asking** chip is not a question but the start of one:
    _Create a lyric file from https://example.com/lyric/amazing_grace_. Pressing it
    does not ask anything — it drops the sentence into the box with the cursor in it,
    so you can swap that example address for the one you actually have and press
    **Ctrl+Enter**. 📸 A banner appears in the app window naming the site while it
    reads.
    A song page is never just the song: there is a toolbar above it, a strumming
    diagram, a fretboard chart at the bottom, a row of related songs and the site's
    own footer — and the words themselves are laid out in columns, with the chords
    over them, which comes out as one broken fragment per line. It sorts all of that
    out on its own. It finds the part of the page the song is on, puts the fragments
    of each line back together, and reads the **key, tempo and time** off the page
    when the page prints them.
    **The chords come with the song.** Each one is written into the line at the
    syllable the page puts it over, the way Open Lyric writes chords, so what you get
    is something a musician can play from rather than the words on their own. Where
    the page prints a chord it cannot place — a whole row of them above a line, or
    the fretboard chart at the bottom — it leaves that one off rather than guess,
    because a chord over the wrong syllable is worse than a chord left out. Verse and
    chorus labels are used as written, a `(2x)` beside one is read as _sing it twice_,
    and a line like _Repeat Chorus_ is read as the play order rather than as another
    copy of the words.
    **A hymnal's text page works too.** Such a page has no chords at all: the
    stanzas are printed numbered, `1`, `2`, `3`, in the middle of the site's menus,
    and the song's own facts sit in a table far below them. The numbered stanzas
    are taken as the song and nothing else, and the **title**, **author** and
    **copyright** — _Public Domain_, for a hymn — are read off that table, with
    the page's address kept with the song as its source. 📸
    **A song printed in two languages stays in two languages.** Where a page prints
    the meaning underneath the line that is sung, the two are kept paired, so the
    slide can show both.
    **The copyright line on the page is kept with the song**, in its `Copyright`
    field, so whoever opens the file later can see whose song it is. Most pages
    print that at the very bottom, a long way from the words, and it is read from
    there. **The address of the page is kept too**, in the song's `Attachments`,
    so anyone who opens the file can go and look at where the words came from.
    **You can read the song before you make it.** The text of the file appears in
    a box above the two buttons, exactly as it will be saved, so nothing is
    created out of sight. (If you closed the help window since the song was
    drafted, the box is not there — ask again and it comes back.) Whether your
    church may sing it is your own licence and your own decision — the app copies
    nothing anywhere and sends nothing to anyone, and no file is written until you
    press **Create**.
    Because it is a guess about someone else's page, the answer always says **which
    part of the page it used**, quoting the first and last line it took and how many
    lines of menus and links it left out. Read that line. If it took in too much or
    stopped too early, say so in your own words — _the song starts at "…" and ends at
    "…"_ — and ask again. Everything else is the same as pasting the words yourself:
    the two buttons underneath, and nothing written to disk until you press
    **Create**.
20. To turn the whole feature off, untick **Enable AI features** in the same settings
    section and restart the app: the chatbot, its tools and the debugging endpoint they
    use are then never started.

_Verify: CB-01, CB-02, CB-03, CB-04, CB-05, CB-06, CB-07, CB-08, CB-12, CB-13, CB-14, CB-15, CB-26, CB-27, CB-28, CB-29, CB-31, CB-32, CB-43, CB-46, CB-48, CB-62, CB-66, CB-71._

### W-47 — Put messages on the screen, and blank the edges of the picture

**Goal:** handle the two things that come up around a service and are not
slides — words everyone needs to read, and a projector whose picture spills off
the screen.

1. Open the **[en:tran:Foreground]** tab. The launcher that opens is a menu of
   components, and the first row in it is **[en:tran:Messages]** — it is first
   because it is the one you open in a hurry.
2. **Write your messages.** Press **[en:tran:Add Message]** for each one. Every
   message gets its own box and can be **as many lines as you like** — a line
   break in the box is a line break on the screen. The arrows beside a box move
   that message up or down the list; the ✕ removes it.
3. **Put one up.** Press the screen button on a message's own row. It appears
   over whatever is already on the screen — the slide, the verse, the background
   — and it **stays there until you take it down**. There is no delay and no
   countdown: nothing removes it but you. Press the same button again to take it
   off; it now reads _hide_.
4. **Several at once.** Show a second message and it sits **underneath** the
   first rather than on top of it, however many lines each one has. Hide the one
   above and the one below moves up to close the gap. This is how you put a
   parking notice and an offering notice up together.
5. **The whole set.** **[en:tran:Show All Messages]** puts every message up at
   once as one block. Tick **[en:tran:Rotate]** first and a seconds box appears:
   now the same button shows them **one at a time**, cycling until you hide it.
   That is the notice board before a service.
6. **Make it look like a notice.** Open **[en:tran:Properties]**, then the
   **[en:tran:Effects]** fold under it. **[en:tran:Padding]** is the room between
   your words and the edge of the coloured box behind them — it starts at a
   quarter of a text size, and because it is measured in text sizes the box keeps
   its shape when you change **[en:tran:Font Size]**. Add a
   **[en:tran:Border]** to frame it, a **[en:tran:Shadow]** to lift it off the
   picture, **[en:tran:Text Align]** to centre it, and a
   **[en:tran:Text Shadow]** of **[en:tran:Outline]** when the message has to be
   read over a busy photograph or a moving video. Changing any of them while
   messages are showing restyles them where they stand and keeps them stacked. 📸
7. **F4** is the shortcut: with a screen ticked it puts the session up, and
   pressing it again takes everything down. If no screen is ticked it tells you
   so rather than guessing.
8. The text is plain. Typing `<b>loud</b>` puts those angle brackets on the
   screen exactly as you typed them; a message is never treated as formatting.
   Use the save buttons at the top to keep a whole session — every message in it
   — and pick it back next week.
9. **Blanking the edges.** If the projector's picture runs past your screen —
   onto the wall, over an organ pipe, or below a screen that only comes half way
   down — find the **[en:tran:Mask]** button in the **[en:tran:Mini Screen]**
   footer, just right of the drawing button. Press it to open four sliders.
10. Drag **[en:tran:Cover from the top]**, **[en:tran:Cover from the bottom]**,
    **[en:tran:Cover from the left]** and **[en:tran:Cover from the right]** until
    the picture stops where your screen does. The bars are solid and sit over
    everything, including a video overlay. You can change the colour if black is
    not the right answer for your room.
11. **The mask is not content, and it behaves differently on purpose.** It is
    measured once for the room and then left alone: it survives closing the
    panel, it survives restarting the app, and **[en:tran:Clear All]** (F6) does
    **not** remove it. That is deliberate — the panic key must never hand you a
    picture spilling onto the wall. The only thing that removes it is
    **[en:tran:Remove Mask]** in that same panel.

_Verify: PM-134, PM-135, PM-136._
