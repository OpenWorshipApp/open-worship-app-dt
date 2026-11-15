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
3. Every step names a control the app draws through `tran()` as `**[en:tran:Key]**`, its
   English dictionary key — never with a hand-written Khmer twin beside it
   (`tran.test.mjs` fails on one); the help shows it in whichever language the app is in.
4. `📸` marks a **screenshot checkpoint** — when generating a tutorial page, capture a
   fresh screenshot of the live app at exactly that state.
5. `Verify:` lists the coverage-matrix rows that prove the workflow. Verifying a
   tutorial or learning doc = running those rows.

**workflowsVersion: 2026-11-14n** (**W-08, W-28 and W-48 — the Background panel's Colors tab is [en:tran:Fills]: a color, a gradient or a pattern.** The user asked for gradients, then patterns under a name that covers both (_Fills_), moving ones, Customize and saved fills, then the layout: _make each section collapsible_, _make the collapsing icon colored follow screen color_, _add a toggle icon somewhere in the gradient|pattern panel to open/close the customizing panel_, _the preset section should be part of gradient|pattern_, _each element (gradient pattern) should be able to copy the css_. Seen live 2026-11-14 on the dev app: a tile pressed goes up and is lit; Dark / Light swaps the rows below it; a moving tile's wind mark, and neither the tile nor the Mini Screen moving; a screen's section folded to its line by the arrow in its color, its number and what it holds kept; Customize's rows, a change going up after the pause, and its toggle at the end of the Gradients line; a saved fill's button under the patterns; the Fills tab's and a tile's right-click offering [en:tran:Transition]; **[en:tran:Copy CSS]** on a still and a moving tile and on a saved button, its toast, and what it copied painting -- and the moving ones moving -- in a page of its own. Not seen: the motion on a showing screen, the save itself (its name box is the person's) and a press on a saved fill. W-28's table row reads _Fills — a colour_, the one a slide takes. PM-181..PM-186.)

Previous: **workflowsVersion: 2026-11-14m** (**The AI-agent recipe is W-64 now; W-62 is the song from a PowerPoint alone.** Two recipes had carried W-62 since 2026-11-13e, so the help read one page for both and neither could be marked read. The one added later, _Connect your own AI agent to the app (MCP)_, took the next free id, with its known questions, the French and Khmer pages and every note that named it; a `W-62` about the AI agent in an entry from 2026-11-13e on means W-64. `docs:gen` and a gate test now refuse an id used twice. No step changed.)

Previous: **workflowsVersion: 2026-11-14l** (**Forty-four recipes read against the code, no app** (`/owa-enhance-agent-docs`, HEAD `0285748bb`): every recipe whose words or code had moved since it was last read, step by step against the files its Verify rows cite. Corrected: W-42 step 1 and step 5 (the Screen Mirror page has a top bar with the 🤖 too, and is a choice under ASKING ABOUT); W-57 steps 2 and 3 (the card has six buttons, **[en:tran:Make a song from it]** the sixth); W-63 (with no assistant, a look other than the size answers _Done._ alone); W-06 step 7 (the Lookup saves and shows by its own **[en:tran:Save bible item and show on screen]**, not by a double-click); W-14 step 1 (a Markdown row's menu: Open in Chatbot while AI is on, and Duplicate and Reload in the usual tail); W-61 step 2 (the strip's **＋** opens no menu, and the Long Text Show panel has no transition button); W-07 step 1 (Long Text Show keeps the book and gear at the far end of the row Add Language starts); controls written as templates in W-05, W-42 and W-62's song recipe. Not seen live (no app was running; `references/live-checks.md` of `owa-enhance-agent-docs` lists each): W-14 Open in Chatbot on a Markdown row, W-37 step 6, W-42 step 6's third topic button, W-50 step 2's 🤖, W-61 step 3, W-62's Read the words off the pictures, W-63 step 4. **Two recipes carry the id W-62**: the song from a PowerPoint (2026-11-11c) and the AI agent (2026-11-13e), so the help reads one page for both; left for a decision, nothing renumbered.)

Previous: **workflowsVersion: 2026-11-14k** (**W-63 — a new screen, asked for.** The user's goal, _chatbot is very smart to help user control screen_ … _should cover everything in screen control_: the Mini Screen menu's **[en:tran:Add New Screen]** was the one control of the screens no ask could reach (EC-630). Seen live 2026-11-14 on a scratch profile, the Presenter with screen 0 showing John 3:16 and screen 1 off, Auto answering on the shared no-cost assistant: _Add a new screen for the stage_ in the English window, the menu's own Spanish label and an everyday Spanish line in a Spanish window, that Spanish line in the English window, a French line in a French window and the Khmer label and a Khmer line in a Khmer window each added screen 2, off and not ticked, the answer naming it, and **[en:tran:Undo this change]** took it away each time; with no assistant (the hourly limit paused it) _add a new screen_ got **[en:tran:Add New Screen]**, pressed it added screen 2 and its Undo took it away. Step 5 and W-63's last paragraph say so. CB-197.)

Previous: **workflowsVersion: 2026-11-14j** (**W-50 step 2 — the guest’s page carries the Presenter header’s buttons, and the 🤖 opened there answers about it.** The user, with a picture of the Screen Mirror page beside the Presenter’s header: _screen mirror page should has all of this buttons_, the story _as a user I want chatbot help control screen mirror page as well especially ask for help_. Seen live 2026-11-14 on a scratch instance, Screen Mirror page: at the right of its top bar the [en:tran:Stay Awake] cup, the gear, 🤖, ✨ and **?**; **?** opened its menu ([en:tran:Open Online Help], [en:tran:Open Chatbot], [en:tran:Report a Problem]); the 🤖 asked the AI caution first (pressed [en:tran:Cancel] by the run — the caution’s **Open** is a person’s press, so the help window’s own picker on the page was not seen); the guide search asked from the page put this recipe first, its questions came up as the page’s own, and Help → [en:tran:All tips] listed the page’s lesson, which a walkthrough shows in words. A new paragraph says what to check when no host is listed. SP-32.)

Previous: **workflowsVersion: 2026-11-14i** (**W-42 step 20 — the Bibles panel's **[en:tran:Add Bible Item]** asks how, and **[en:tran:Open in Chatbot]** opens a chat with its first line written.** The user, with the button circled: _when click `Add Bible Item` should open a context menu for `Bible Lookup` and `Open in Chatbot`, `Open in Chatbot` should open the chatbot and put pretext prompt to let user continue editing by pasting more bible paragraph_, the story _as a user I want to open chatbot with pre-existing prompt for letting assistant help extract bible items for me_. Seen live 2026-11-14 on a scratch instance, Presenter, no assistant: the button opened a menu of the two under it; **[en:tran:Open in Chatbot]** asked the AI caution first (pressed **[en:tran:Cancel]** by the run, which handed nothing over; the caution's **Open** is a person's press), and the request left as the button leaves it opened a new chat with _Add the Bible passages in this text to my Bibles list:_ in the box and the caret under it; a sermon paragraph pasted under it saved Psalm 23 -- read in the middle of a sentence -- John 3:16-17, Romans 5:8, 1 Corinthians 13:4-7 and Genesis 1:1 to Default; the line sent alone was answered and put back in the box; with the app in Khmer the menu, the line, a Khmer paragraph's passages (saved in the Khmer Bible) and both answers were Khmer (EC-760). PR-20, CB-181.)

Previous: **workflowsVersion: 2026-11-14h** (**W-06 step 7 — a passage the assistant puts up is saved to the Bibles list first.** The user's rule, _the rule is bible verse have to save to list first (if not added) before show on screen_: _show gen 3 on screen_ had put Genesis 3 up, and the list never got it (EC-704). Seen live 2026-11-14 on a scratch instance, Presenter, Auto. `/verse Romans 8:28` saved the passage and put it up, and the answer said it was saved. _show gen 2 on screen_ and _put john 1:1 on the screen_ were each saved once and put up. A passage the list already held was put up and not saved again. Step 7 says so, in French and Khmer too. CB-61.)

Previous: **workflowsVersion: 2026-11-14g** (**W-63 — with no assistant, the change as a button.** The user's goal, _chatbot is very smart to help user control screen_: with no assistant answering, a screen ask was told the setting and that nothing had changed, and nothing in the window could make the change (EC-627). Seen live 2026-11-14 on a scratch profile with the hourly limit paused, the window in English, screen 0 showing John 3:16 (KJV): a bigger verse, a lock, a zoom slide transition, another version (both side by side on the Mini Screen), _Centre it_ typed under the answer, bold and the Bible taken off screen 0 were each offered as a button, each pressed and each put back with **Undo this change**; a Spanish lock in the English window the same. W-63's last paragraph says so. CB-196.)

Previous: **workflowsVersion: 2026-11-14f** (**W-42 step 20 — adding a passage is never showing it.** The user's report, _chatbot confused between adding bible item and showing bible verse on screen_: _add bible items for me for: john 3:16 gen 1_ had put Genesis 1 on the screen and saved nothing. Seen live 2026-11-14 on a scratch instance, Presenter, Auto: that line saved both passages with no assistant and the screen stayed blank; asked for _the verse that says the Lord is my shepherd_, the answer offered **Psalm 23:1** and pressing it saved it (EC-703).)

Previous: **workflowsVersion: 2026-11-14e** (**W-42 step 20 — a list of passages pasted as it is, or inside a paragraph, saved to a Bibles list, and what is unclear asked.** The user's story: _sometime I carry a list of bible verses so I expect chatbot can parse and add those items into to the list_, _parse a messy bible verse_, _extract from a given paragraph, if ambigous bible verse then have to follow up to ask for user input_. Seen live 2026-11-14 on a scratch instance with the KJV and a Khmer Bible, the Bible Reader in front, no assistant: a messy list of four saved two at once and asked about an open range and a Bible not installed, each press saving its passage; a paragraph saved three and asked which book _Ph_ meant; with the app in Khmer the questions and **Skip** were Khmer (EC-626).)

Previous: **workflowsVersion: 2026-11-14d** (**W-06 step 7 — a passage asked for in another language, with no assistant.** The user's goal, _chatbot is very smart to help user control screen_: with no assistant answering, a passage asked for in a language other than English, to put it up or to read it, had been answered with a guide page, because the offline reader knew English words only (EC-622). Seen live 2026-11-14 on a scratch profile with the hourly limit paused, the window in English, a Khmer Bible and the KJV installed: a Khmer line putting John 3:16 on the screen was read from the Khmer Bible, written as it names the book, with one button, which put it on the screen when pressed; a Spanish one, and a Spanish question about John 3:16 in the NVI, with no Spanish Bible installed, said the passage could not be read and offered **[en:tran:Import a Bible for me]**, whose press listed the 31 Spanish Bibles of the free collection; an English one was put up as before. A Spanish how-to is still answered from the wrong guide page (EC-454). Step 7 says so, in French and Khmer too. CB-61.)

Previous: **workflowsVersion: 2026-11-14c** (**W-63 — with no assistant, the setting asked about.** The user's goal, _chatbot is very smart to help user control screen_, _check display_: with no assistant answering (the hourly limit paused it), a screen ask had been answered with what each screen showed — _check the display: which monitor is each screen on?_ named no monitor, and _make the Bible text on screen 1 bigger_ never said that nothing had changed (EC-625). Seen live 2026-11-14 on a scratch profile with the limit paused, the window in English: the monitor each screen is on, the transitions, the lock, the groups, the Bible versions, Line Sync, the Bible text's size, the stage and the tick, each said per screen, then what each screen shows and how to make the change; a Spanish monitor ask in the English window the same. W-63's last paragraph says so. CB-195.)

Previous: **workflowsVersion: 2026-11-14b** (**W-63 — a line typed in another language.** The user's goal, _should cover everything in screen control_: until now only English asks went to the screens. Each installed language reads its own words for the screens' controls (EC-614), and W-63 says so in one paragraph. Seen live 2026-11-14 on a scratch profile, the assistant paused by its hourly limit: in an English window with Spanish installed, a Spanish line making the Bible text on screen 1 bigger and one locking screen 1 were each taken as about the screens and answered with what each screen is showing; a Spanish HOW question and a verse put up were not. The same in Japanese, which does not space its words: its style and lock asks were taken, its how-to and a song's words made bigger were not. Not yet seen with an assistant answering, so no step says what it changes. CB-194.)

Previous: **workflowsVersion: 2026-11-14a** (**New W-63 — change the screens with the assistant.** The user: _chatbot is very smart to help user control screen_ -- _change font-size color or style for bible showing_, _add another bible version to existing showing bible_, _change transition_, _check display_, _group screen_, _should cover everything in screen control_. Typed in the help window on a scratch profile, the Bible text's size, colour, bold and shadow, centring, outline, line spacing and the style back to normal; a second Bible added beside John 3:16, lined up verse by verse and taken off; the slide and background transitions; the stage, the tick and a clear were changed by the assistant (`owa_screen_edit`, EC-611, EC-615), and _Undo that_ put a change back; which display each screen is on, what is showing, the versions and the transitions were read. Only those steps are written: moving a screen to another display, grouping screens and locking one were driven through the tool alone, and pressing **[en:tran:Undo this change]** in the window is not seen yet. CB-192, CB-193.)

Previous: **workflowsVersion: 2026-11-13l** (**W-05 step 15 — a song's `Note` blocks shown, read-only, under its slides.** The user, with the song's `Note` block circled in the Lyric Editor, its slides showing nothing, and a PowerPoint's and a slide document's note boxes beside them: _like pptx I want those are rendered as read-only note, render all note on one whole document note, just make it looks division for each note element_, then _`Note *` is the special element that should be render in slide note_. Every `ol:Note` / `ol:Note N` block is a division of one **[en:tran:Document Note]** box under the Stage Previewer, the Presenter's only, there only for a song that has one. Seen live 2026-11-13 on the dev app in English, on the user's song: the box under the Stage Previewer with its one `Note` division, the collapsed Previewer above left as it was. Not yet seen live: a second note added and the last one removed in the Lyric Editor (held by `LyricHandlerComp.test.tsx`), a non-English pass. Verify: PM-180.)

Previous: **workflowsVersion: 2026-11-13k** (**W-09 — a countdown a day or more away reads its days first.** The user, shown that 42 days read `⏳ 1001:54:52`, chose _41d 17:54:52, translated_. W-09's duration line said 25 h reads `25:00:00`; it reads `1d 01:00:00`, the day in the app's language. Seen live 2026-11-13 on a scratch instance in Khmer: 25 h 0 m 7 s and **[en:tran:Show Countdown]** read `⏳ 1 ថ្ងៃ 01:00:07` in the Mini Screen, and a countdown to Christmas `⏳ 41 ថ្ងៃ 23:16:57`. The French and Khmer pages say it too. Verify: PM-18.)

Previous: **workflowsVersion: 2026-11-13j** (**W-57's "Not there?" — a PDF, PowerPoint or Word row carries **[en:tran:Open in Chatbot]** too.** Since 2026-11-13i a PowerPoint, Word or PDF row in **[en:tran:Documents]** carries the item, and the line still said a slide document only. Seen live 2026-11-13 on a scratch instance of the dev app, in Khmer: the item second in the menu of a PowerPoint, a Word, a PDF and a slide document row; not pressed (it asks the AI caution first). W-57 now says only a slide document has slides the assistant can change, and sends a song from such a file to W-42 step 18. Verify: PL-108.)

Previous: **workflowsVersion: 2026-11-13i** (**W-42 step 18 — a song from a PowerPoint, a slide document, a Word file or a PDF in your Documents list.** The user: _chatbot have to support turning powerpoint to lyric, it related to creating lyric from documents file_, then _it should use the tool pptx-to-html-conv like what the app using, then extract text from the html_, _after powerpoint to lyric then appdocument to lyric_ and _also add other support like docx pdf ..._. _new lyric from powerpoint_ had been answered that the app cannot. Seen live 2026-11-13 on a scratch instance of the dev app holding a copy of the user's eight hymnal decks, a slide document, a Word file and a PDF, in English and in Khmer, no assistant asked: six decks listed as buttons and the way to the other two said; each deck written out under its whole title, all eight; a slide document's song saved through **[en:tran:Create]**; a Word file named in the question, and attached; a PDF's button; the slide document's card's **[en:tran:Make a song from it]**. Not pressed live: a Documents row's **[en:tran:Open in Chatbot]** (it asks the AI caution first) and a Resources file's card. W-42's Verify gains CB-189, which step 6's change named, and CB-190.)

Previous: **workflowsVersion: 2026-11-13h** (**W-62 step 2 — choose your own AI program, and the agent asks which app.** The user: _for mcp connection, let user choose tool specific like chatgpt clause or just binary file path and so on_, _provide maximum options for user_, then _make the mcp to remind agent to check mcp version and app version_ and _this machine running 3 instances of open worship app so the mcp should check and let user pick one to work with_. The **[en:tran:AI agents (MCP)]** line is a picker now: a terminal command, a settings file's text, a plain JSON block or the program's path for the program chosen, one **[en:tran:Copy]**, and **[en:tran:Copy JSON]** gone. Seen live 2026-11-13 on the dev app and a scratch instance in Khmer: Claude Code, Cursor, the Codex config file, Continue and the program path copied exactly as shown, the choice kept; with two and three apps open a fresh server listed them and drove only the one chosen. Verify: ST-93.)

Previous: **workflowsVersion: 2026-11-13g** (**W-42 step 6 — a word or two on its own is asked about first, and up to five buttons under an answer; steps 18 and 19 say which ⋮.** The user, with _lyric_ typed alone and answered with an apology: _when user type only few word, chatbot should follow up, before provide result should confirm_ -- the job in mind was a lyric file made from a PowerPoint -- and _keep providing user with maximum amount of options_. A word or two typed alone in a new chat is answered by the window with no assistant: a question and up to six of its own questions as buttons, a PowerPoint song into a lyric file among them; further down a conversation the assistant asks the same way. An answer ends with up to five buttons (two or three before). And the attach in steps 18 and 19 names the ⋮ at the left of the box -- the assistant had sent people to the TAB's ⋮. Seen live 2026-11-13 on a scratch instance of the dev app (Auto, the shared gemma4:cloud): _lyric_ answered at once with six buttons, the PowerPoint one pressed and answered with the attach steps, _background_ further down answered with a question and five options; in a French window _chant_ answered in French. CB-189.)

Previous: **workflowsVersion: 2026-11-13f** (**W-42 steps 18 and 19 — several songs at once, from their links or their PowerPoint slides.** The user: _it work for only one url, I wish it could create multiple … also multiple files_, with eight PowerPoint decks of a hymnal dropped into their Documents to test with. Three links in one message had offered only the third song, two links were no song link at all, and a PowerPoint file could not be attached. Seen live 2026-11-13 on a scratch instance of the dev app, Auto on gemma4:cloud: four decks attached under _Create lyric files from these_ drafted in 2 s with no assistant asked, and **Create all 4 songs** saved four; three links in one message drafted three in 8 s and **Create all 3 songs** saved them; `/lyric` with two links drafted two in 6 s; all seven valid. A Word file is read the same way and unit-tested, not driven live, so this page names PowerPoint only. Verify: CB-188.)

Older entries — 380 of them, 2026-11-13e and before, with the notes that followed them — are in [user-workflows-history.md](./user-workflows-history.md), moved there unchanged on 2026-11-14 (`AD-33`): they were nearly half of this file, read whole by every agent that opened it for a row or a recipe. New entries still go on top here; when the head passes about 20, the oldest move to the top of that file.

---

## Orientation

### W-01 — Understand the Presenter window

**Goal:** know where everything lives.
**Where:** the main window (`presenter.html`), which opens on launch.

The Presenter has a header and three resizable columns:

- **Header:** page tabs — **[en:tran:Slide Editor]** / **[en:tran:Bible Reader]** /
  **[en:tran:Screen Mirror]** (the page you are on has no tab of its own;
  **[en:tran:Presenter]** is the tab that brings you back from the Slide Editor) — the
  **[en:tran:Bible Lookup]** button
  (center, `Ctrl+B`), and the **[en:tran:Setting]** gear + Help buttons (right). 📸
  Left of the gear, the cup is **[en:tran:Stay Awake]**: while it is on — and
  it is, unless you switch it off — this computer does not go to sleep or
  turn its display off for as long as the Presenter is open. Click the cup to
  switch it off (it turns grey and empty) and again to switch it back on; the
  choice is kept for the next launch. The Bible Reader and the Slide Editor
  never hold the computer awake, so they have no cup. A screen that is
  showing keeps the display on by itself, whatever the cup says.
  The **?** at the far right (**[en:tran:Help]**) opens a small menu of three rows:
  **[en:tran:Open Online Help]** opens the app's help page on its website, in
  your web browser, **[en:tran:Open Chatbot]** opens the help window that
  answers inside the app (W-42), and **[en:tran:Report a Problem]** opens it on a
  card that asks what went wrong. The first is in the menu bar too, as **Help** →
  **[en:tran:Open Online Help]**.
- **Left column:** your content libraries — the **[en:tran:Documents]** list (songs live
  here too, marked with a music note) and **[en:tran:Presenting Flows]**.
- **Middle column:** the working area — **[en:tran:Documents] / [en:tran:Bibles]** preview tabs plus the
  **[en:tran:Foreground]** button on top, and the collapsible **[en:tran:Background]** panel at the bottom.
  The Documents tab shows whatever kind of file you picked: slides for a slide document,
  pages for a PDF, and the song view for a lyric.
- **Right column:** **[en:tran:Bibles] / [en:tran:Bible Notes]** lists and the **mini screen** — a live preview
  of exactly what the audience sees, with clear buttons in its header and a zoom slider under it.

Drag any divider between panels to resize them; the size is remembered. 📸

_Verify: GL-12, NAV-01..02, NAV-10, NAV-24, NAV-25, PL-01, PR-04._

### W-01b — The `⋮` button: everything a thing can do

**Goal:** find the actions that used to be hidden behind a right-click.

Almost everything in the app — a file in a list, a Bible verse in your reading list, a
note, a slide, a background, a line of a presenting flow, a screen preview, a folder in
**[en:tran:Resources]**, a box in a connection graph — has more it can do than the click on it
does. Those extras live in a small menu.

1. Look at the right-hand end of the row, or the top-right of the card. There is a
   very faint **`⋮`** there — as quiet as the colour-note dot beside it, and it comes up to full
   strength as soon as you point at it. In a list they
   line up in a straight column down the right edge, each one level with the row it
   belongs to; a folder keeps its own `⋮` up on its name, beside the ones belonging to
   the files inside it. 📸
2. **Click it.** The menu opens right at the button — the same menu you get by
   **right-clicking** the row itself, which still works exactly as before.
   The menu shifts into view and can use the full window height, regardless of
   where you clicked.
   **A long menu scrolls only when it is taller than the whole window.** Its entries
   scroll inside it only when they exceed the window's height, or when the menu has its
   own smaller height limit.
   > Clicking `⋮` does NOT also do what clicking the row does: a document you open the
   > menu on is not selected, and a slide is not sent to a screen.
3. Pick an entry, or click anywhere else to close the menu without choosing.

> **Why it is there.** A right-click cannot be done on a touch screen, and some
> machines and browsers keep that button for a menu of their own. The `⋮` is the same
> menu with a button you can see.

**To rename a file** — a document or a song — open its menu and pick
**[en:tran:Rename]**. The name turns into a box holding the name it has: change it and
press **Enter** (or click the ✓). The file is renamed where it lives, and it stays
selected.

**A name Windows keeps for itself is refused**, when a file is made or given a new name.
`CON`, `PRN`, `AUX`, `NUL`, `COM1`…, `LPT1`… — with or without something after a dot,
such as `NUL.old` — cannot name a file on Windows, so the app refuses them on every
computer (**[en:tran:Invalid file name]**: _This name is reserved by Windows. Please
choose another one._) and a file made here can always be moved to another machine.

_Verify: GL-24, GL-06, CM-04, PL-31._

### W-02 — Switch between the main pages

**Goal:** move between Presenter, Bible Reader, and Slide Editor.

1. Click a header tab — the window switches to that page in place. A page has no tab
   for itself, and the Bible Reader has no tabs at all: come back from it with its 🖥️
   **[en:tran:Go Back to Presenter]** button.
2. The **[en:tran:Slide Editor]** tab opens the editor only for a selected slide document:
   select one in the left list first (W-03), then click the tab; with nothing
   selected the app shows an alert ("[en:tran:No slide selected]") and stays put.

_Verify: NAV-01..04._

---

## Presenting content

### W-03 — Present a slide from a document

**Goal:** put a slide on the screen.
**Preconditions:** at least one document in the **[en:tran:Documents]** list.

1. In the left column, click a document in the **[en:tran:Documents]** list. It
   highlights, and its slides appear as thumbnails in the middle **[en:tran:Documents]** tab. That is the document
   open; nothing goes on the screen until you click a slide (step 2). 📸
2. **Click** a slide thumbnail. The slide goes live: it appears on the mini
   screen, and the live item is marked highlighted (on-screen indicator). 📸
3. To step through slides with the keyboard, click once in the thumbnail area, then press
   **→**, **↓**, **PageDown** or **Space** for the next slide, and **←**, **↑**, **PageUp**
   or **Shift+Space** for the one before. The preview scrolls smoothly to the selected slide, including after several quick
   Next presses or wrapping from the last slide to the first.
4. To remove the slide from the screen, press **F8** ([en:tran:Clear Slide]) or click
   the matching clear button (`SL`) in the mini screen's header.
   **The first card of a PowerPoint, PDF or Word document is blank, on purpose.** It is
   not a page of your document, though its card is numbered 1: your own page 1 is the card
   after it, numbered 2, so a five-slide PowerPoint shows six cards. Presenting the blank card puts a blank
   slide on the screen.
   **What the projector shows is what the editor holds, saved or not.** A document you
   have changed and not saved carries a red `*` after its name, and the Presenter and the
   screen show it WITH those changes — the editor keeps your unsaved work on disk. To go
   back to the saved version press **[en:tran:Discard changed]** in the editor's row of
   buttons (it asks first, and it empties Undo as well), then present the slide again.
5. **Show the person on the stage what comes next.** A screen's **St:** number (the badge at
   the right of its mini screen's footer) decides how a slide is drawn on it, for every kind
   of document — a slide document, a PDF, a PowerPoint or a Word file — just as it does for a
   song (W-05):
   - **[en:tran:Stage] 0** — the slide exactly as it is.
   - **[en:tran:Stage] 1** — the slide, with its place in the document in the bottom-right corner
     (`3/12`, or `Welcome · 3/12` when the slide has a name).
   - **[en:tran:Stage] 2** — the slide at the top, the **next** slide smaller under it — at full
     brightness, not faded — and the count. The pair grows to fill the screen's height
     whatever shape the slides are, flush with its top left corner, no margin, and the
     slides touch — no gap between them, only each one's frame.
   - **[en:tran:Stage] 3** — the same with the next **two** slides.
   - **[en:tran:Stage] 4** — the next slide under it, without the count.
   - **[en:tran:Stage] 5** — the **previous** slide top left, the slide, and the **next** slide bottom
     right.

   As on a song's stages (W-05), the slides around the current one are never faded.
   On every stage that shows a count, **each** slide on the screen carries its own — the
   coming ones too (`2/7`, `3/7`) — in a large figure on a half-transparent dark pill.

   Set a stage monitor's **St:** to **2** and the singer always sees what is coming.
   Moving a screen to any stage above 0 also sets its **[en:tran:Slide]:** transition to **none**
   (W-10). To see
   it here first, click **[en:tran:Add Stage]** in the **[en:tran:Stage Previewer]** header
   above the slides and pick a stage: it arrives as its own chip and its own pane, side by
   side with **[en:tran:Stage] 0**, which always stays. The **×** on a chip
   (**[en:tran:Hide Stage] 2**) takes that pane away again, and **[en:tran:Add Stage]**
   brings it straight back. In a narrow pane — beside the Bibles tab, say — the header's
   title gives way first and **[en:tran:Add Stage]** folds to its **+**, so every chip stays
   in view. There is nothing to set on a document's stage — unlike a song's, its chips have no
   ⚙. Clicking a slide in any pane presents the same slide; each screen draws it at its own
   **St:**. 📸

Tips:

- The slider in the Documents-tab footer resizes the thumbnails.
- The stopwatch icon at the bottom left of the slide list — there once a slide is live —
  opens **auto-play**: set seconds, press play, and slides advance automatically; the
  red ✕ closes it (W-04).
- **Pin the document so you cannot lose it by a stray click** — see W-27.
- **Notes for yourself:** under the slide previews there is a thin grey-striped **[en:tran:Note]**
  strip. Click it and a **[en:tran:Document Note]** box (one for the whole document) and a
  **[en:tran:Slide Note]** box (one per slide) open below the slides. They are saved for you as
  you type and are **never sent to an audience screen**. The panel starts closed, so
  it costs nothing until you want it; to put it away again drag the divider above it
  down to the bottom edge, or untick **View** → **[en:tran:Widgets]** → **[en:tran:Note]** (W-31).
- **A slide that is the wrong shape for the screen.** A slide document keeps its own
  width and height, and one made for another display does not match yours. While a slide
  and the display differ, an amber button with a hammer — **[en:tran:Fix slide dimension]**,
  the sizes in its tooltip — shows in the row of buttons at the top of the slides, here
  and in the Slide Editor: press it and the slides that differ take the display's size,
  and the button goes away. One slide at a time is the Slide Editor's **[en:tran:Width]** and
  **[en:tran:Height]** boxes, with **[en:tran:Apply All Slides]** for the whole document.

- **More than one folder of songs and slides.** The row of buttons under the
  **[en:tran:Documents]** title — **[en:tran:Default]** and **＋** — keeps other folders
  one press away (W-58).

_Verify: PL-01, PM-05..09, PM-54, PM-149, PM-157, ED-17, ED-39, KB-05, KB-08, PM-170._

### W-04 — Auto-play slides on a timer

**Goal:** advance slides hands-free.

1. Open a document's slides and put one on the screen (W-03 steps 1–2) — the
   stopwatch is only there while a slide of that document is live.
2. Click the **stopwatch icon** at the bottom left of the slides previewer — a small
   strip opens: **✕**, play, the seconds box, the countdown (only while slides are
   advancing), and a sliders button. 📸
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

5. **Stop slides that are already advancing.** The timer strip is already open at
   the bottom left of the slides previewer, in place of the stopwatch. Click its
   **pause** button to stop, or its **✕** to stop and collapse it back to the stopwatch.

The same strip runs a show over a **[en:tran:Background]** list — **[en:tran:Images]**,
**[en:tran:Videos]** and **[en:tran:Webs]**, appearing once that list has something on a
screen — and over each **[en:tran:Image Show]** / **[en:tran:Video Show]** / **[en:tran:Web Show]** session, where it
rides the panel's top row. On the Webs list a saved **URL** is stepped just like a page
file.

_Verify: PM-10, PM-137, PM-138, PM-140._

### W-05 — Present song lyrics

**Goal:** put a song's lyrics on the screen.

1. In the left column, click a song in the **[en:tran:Documents]** list — songs carry a
   music-note icon. The middle **[en:tran:Documents]** tab switches to the song view: the lyric
   **[en:tran:Previewer]** on top and the **[en:tran:Stage Previewer]** verses under it. Only one file in the
   list is ever highlighted, so picking a song releases whatever was selected before.
   Those two show how the song will look on the screen; nothing reaches the screen
   until you click a verse. 📸
2. **Click** a verse to send it to the screen. After the song's last verse comes an empty
   **None** slide, just like the one after its title: click it when the song ends and the
   words leave the screen.
3. Press **F8** / the clear button to take it down.
4. To attach links to a song — web addresses, or files on this computer written
   `file:///C:/…` — open it in the **Lyric Editor** (right-click the song →
   **[en:tran:Edit]**) and add an **`- Attachments:`** field to its `ol:Config` block, one
   link per line. Each link also becomes its **own slide at the end** of the Stage Previewer,
   after that closing blank, named after the link. A YouTube link becomes a playable video, an image / video /
   audio link becomes that media, and any other web address becomes the page itself;
   each fills the whole slide. Present one the same way you present a verse. A link to
   a file on this computer works too (written `file:///C:/…`), which is how a chart or
   a backing track travels with the song. 📸
5. Links the app cannot show — a PDF, or a line that is not a web address — still get
   their named slide, just an empty one.
6. **One song can be previewed at several stages at once.** **[en:tran:Add Stage]** in
    the Stage Previewer header opens the same menu the mini screen's **St:** badge does:
    **[en:tran:Stage] 0** to **[en:tran:Stage] 5** — a stage already on screen is listed but greyed out — and
    **[en:tran:Increment] · [en:tran:Stage] N** at the foot, which adds one past the highest stage you have.
    Increment is how you get past Stage 5, and it is what matches a screen whose **St:**
    number you have already pushed up there. Each stage arrives as its own chip and its
    own pane, in its own colour; the **×** on a chip (**[en:tran:Hide Stage] N**) hides
    that stage's pane again — its look under **⚙** is kept for when you add it back — and
    the padlocked **[en:tran:Stage] 0** stays. 📸
7. To change how a stage's slides **look**, click the **⚙** on that stage's chip
   (`Stage 0`, `Stage 3`, …) in the Stage Previewer header. A small **[en:tran:Stage Style]** window
   opens — drag it anywhere, it remembers where you left it. It sets the
   **[en:tran:Slide Margin (%)]** — how much of the screen's width (↔) and height (↕) is left around the
   lyrics' box, from 0 (the box is the whole screen) to 99 — with a ↔ slider for the sides and a ↕
   one for the top and bottom: while the 🔗 beside them
   (**[en:tran:Link horizontal and vertical margin]**) is lit, as it is to start with, moving one moves both;
   press it off to set them apart. The margins decide how big the lyrics' box is; under them,
   **[en:tran:Position]** is a pad of nine dots for where that box sits: **[en:tran:Middle center]**, lit to
   start with, shares the margin out evenly; any other dot moves the same box until it touches
   the edges it names — **[en:tran:Bottom center]** with ↕ at 77 puts the lyrics in a band over the
   bottom quarter of the screen. A verse — or the song's title card — that needs more room
   than that box is **never cut**: its box grows into the margin, up from a box at the bottom,
   down from one at the top, both ways from the middle, as far as the screen's edge. Then
   **[en:tran:Background Opacity (%)]**, **[en:tran:Extra Font Size]**, a **[en:tran:Light]/[en:tran:Dark]** theme, and a
   **[en:tran:Custom CSS]** box for anything else — empty, it shows in grey the CSS the stage already
   uses, and the ✎ beside its name (**[en:tran:Edit a copy of the stage's CSS]**) puts a copy of that in
   the box to change. 📸
8. These settings belong to the **stage**, not to the song — every song you open uses
   them, which is why the panel says _[en:tran:Applies to every song]_. **Every stage number keeps
   its own settings**, so you can leave the projected stage plain, make the chord stage
   larger, and give a third stage a dark theme for the person on the sound desk. Stage 0
   is the plain lyrics-only look, and so is stage 4; every other stage starts from the
   chord-and-notes look, and a stage past 5 differs from stage 1 only by what you set here. Custom CSS is **added to** the stage's
   built-in look rather than replacing it, so stage 0 keeps hiding its chords.
   **Stages 2 to 5 show what comes next** around the verse being sung: 2 the next verse
   under it, 3 the next two, 4 like 2 in the plain look, 5 the previous one top left and
   the next one bottom right. The coming verse is at **full brightness**, not faded, and
   on 2 to 4 the verse sits flush in the screen's top left corner with the next one flush left
   under it, touching it — no margin around them and no gap between them, whatever **[en:tran:Slide Margin (%)]** says (the margin stays
   inside each verse's own box). A screen moved to any stage above 0 has its **[en:tran:Slide]:**
   transition set to **none** (W-10).
9. In that **[en:tran:Stage Style]** window — the **⚙** on the stage's chip in the Presenter's
   Stage Previewer — **[en:tran:Reset]** puts that stage back to the defaults. At its top,
   **[en:tran:Presets]** offers **[en:tran:Full Screen]**, **[en:tran:Center]** (the starting
   layout), **[en:tran:Top Banner]** and **[en:tran:Bottom Banner]**, which set the layout and
   keep the theme and **[en:tran:Custom CSS]**; **[en:tran:Save as Preset]** keeps the whole look
   for **every** stage (right-click a saved one to rename, replace or remove it). 📸
10. A screen already showing a slide keeps it — present the slide again to push the new
    look out to it.
11. **Edit the words while the song is open and the verses follow by themselves; a verse
    already on the screen changes when you click it again.** Change the
    song in the **Lyric Editor** (right-click the song → **[en:tran:Edit]**) — or in any other window —
    and within a second or two the rendered song **and every Stage Previewer pane** show the
    new words, once the editor has saved them (**Ctrl+S**): the verses render what the
    song's file holds. You do not have to re-pick the song. A verse already on the
    screen keeps its old words until you click it again. 📸
12. If you ever need to force it — a song changed by something outside the app, say — the
    **⋮** at the right end of the Stage Previewer header holds **[en:tran:Reload]**, which re-renders
    every stage at once. The same **[en:tran:Reload]** sits in the right-click menu of a stage pane and
    of the rendered song above it.
    **How a song is written: its parts, and the order they are sung in.** In the Lyric
    Editor a song is plain text in blocks. Each part is a block of its own: a line of three
    backticks followed by `ol:` and the part's name — `ol:Verse 1`, `ol:Verse 2`,
    `ol:Chorus`, `ol:Bridge` — then its words, then a line of three backticks to close it.
    A chord goes in square brackets just before the syllable it falls on, like `[G]`.
    **The order it is sung in is its Structure line, in short codes such as V1CV2C, verse 1, chorus, verse 2, chorus.** The Structure line, in the first
    block (`ol:Config`, beside the song's **Title**), is the order the song is sung and
    shown in, so to change the order, change that line — the parts themselves stay where
    they are. Write it in short codes run together with NO spaces: `- Structure: V1CV2C`
    is verse 1, chorus, verse 2, chorus, and `x2` after a code repeats it (`Cx2`). The
    codes: Verse `V`, Chorus `C`, Pre-Chorus `P`, Bridge `B`, Intro `I`, Outro `O`, Tag
    `T`, Interlude `L`, Instrumental `IS`; a numbered part takes its number (`V2`), Intro
    and Outro take none.
    **The editor marks a mistake in red where it is.** It marks a Structure line that
    is empty, has spaces in it or names a part that has no block (`V3` with no
    `Verse 3`), two parts with the same name, and a chord it does not know — it knows
    `[Cm7]`, not `[Cm7b5]`, so write a chord it knows in its place. Put the marked
    line right and the red goes.

13. **One line at a time — [en:tran:Atom Mode].** At the right end of the row under the
    Stage Previewer header, press **[en:tran:Atom Mode]** and every line of the song becomes a
    slide of its own: a verse of four lines is four slides, named `(1)-Verse 1 · 1/4` to
    `(1)-Verse 1 · 4/4`, and a chorus sung twice is its lines twice. A blank line inside a
    part is an empty slide — a pause. Click a line to send it to the screen. Every stage pane
    splits the song the same way, so a card is the same line on every stage, and stage 1 and
    up write the line in the slide's corner too (`Chorus · 1/8 · 2/7`). It is one switch for
    every song. A song's slide that a screen holds moves to that part's first line when you
    turn it on, and back to the whole part when you turn it off. 📸
14. **A song can keep a font of its own, on every stage.** At the top of the
    **[en:tran:Stage Style]** window, above _[en:tran:Applies to every song]_,
    **[en:tran:Song Font]** — _[en:tran:This song only, on every stage]_ — is the font THIS
    song is drawn in on every stage, while every other song keeps the app's own font. A
    song made from a PowerPoint file starts in the font its slides were set in; pick
    another, or press **[en:tran:Use the app font]** to draw it like every other song. The
    change is one of the song's own edits, so the song's **[en:tran:Undo]** takes it back,
    on every stage and in this window. 📸

15. **Notes for yourself in the song — a `Note` block.** In the Lyric Editor, a block
    named `ol:Note` (or `ol:Note 2`, `ol:Note 3`, …) holds a note for whoever presents the
    song: _play verses 3 and 4 again_. While the song is selected in the Presenter, every
    such block shows under the Stage Previewer in one **[en:tran:Document Note]** box, each
    note its own division headed by its block's name, in the order the song writes them.
    The box is read-only (change a note in the Lyric Editor, and the box follows), it is
    **never sent to an audience screen**, and a song with no `Note` block has no box at all.
    To put it away, drag the divider above it down to the bottom edge, or untick
    **View** → **[en:tran:Widgets]** → **[en:tran:Note]** (W-31); it stays put away for every song. 📸

_Verify: PL-07..08, PM-11, PM-115, PM-116, PM-117, PM-127, PM-148, PM-169, PM-178, PM-179, PM-180, XW-08._

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
   > **Escape** clears it. The **[en:tran:Bible Reader]** page works the same way.
3. The verse renders in the preview panel. To present it, point at the passage's
   title (_John 3:16_) — its buttons appear over the end of the title — and click
   **[en:tran:Save bible item and show on screen]** (the cast icon), or just press
   **Ctrl+Shift+Enter**. The passage is saved to the **[en:tran:Bibles]** list as it goes up.
   To keep a passage without putting it on the screen, click **[en:tran:Save bible item]**
   (the floppy disk) beside it instead: it goes to the **[en:tran:Bibles]** list only. The
   Bible Reader's lookup has the same button.
   Double-clicking a verse only brings it into view; it does not present. 📸
4. The dialog closes by itself once the passage is saved, unless _[en:tran:Keep Open]_
   is ticked; to close it yourself use the red ✕ button or **Ctrl+Q**.
5. Press **F9** ([en:tran:Clear Long Text]) to take the verse off screen.
6. The presented verse also appears in the **[en:tran:Bibles]** tab (middle column) and the
   **[en:tran:Bibles]** list (right column) for re-presenting later.
   **More than one verse.** In the grid of verse numbers, click the first verse and then
   **Shift**-click the last one (or press on the first and drag to the last);
   **[en:tran:Show all verses]**, at the end of the grid, takes the whole chapter. Typed into
   the **[en:tran:Bible Reference]** box it is `John 3:16-18`.
   **A passage across chapters.** Type it the way you would say it —
   `John 1:50-6:3`, `John 1-3`, `John 3:16-4:2` — and present it as above. The
   projector shows the first three chapters, each starting with its chapter
   number on a thin rule. On the mini screen card the passage ends with **...**
   (**[en:tran:Show the next chapter]**): each press puts one more chapter on the
   projector. The projector itself never shows the **...**. From the projector
   window, **Ctrl+→** steps to the verse just after the passage (John 6:4) and
   **Ctrl+←** to the verse just before it (John 1:49).
   **The next verses, from the projector window.** Click the projector window itself and
   press **Ctrl+→** (or **Alt+→**): the screen moves on by as many verses as it is showing —
   John 3:16 becomes 3:17, John 3:16-18 becomes 3:19-21 — into the next chapter when the
   chapter ends, and **Ctrl+←** goes back. It only works while the main window is on the
   Presenter: from the Bible Reader, press **[en:tran:Go Back to Presenter]** first. Nothing
   on the mini screen card steps the verse; from the Presenter itself, present the next
   passage the same way you presented this one.
   **Another version on the screen.** If no passage is on the screen yet, press **Ctrl+B**,
   choose the book, chapter and verse, then press **Ctrl+Shift+Enter** to present it.
   On the mini screen card, each column of the passage
   begins with the short name of its version (`KJV`, say). Click that name and a list of
   versions opens. A plain click on one **changes** that column to it — it adds nothing.
   To put a second version **beside** the first, hold **Shift** while you click it
   (the list says **[en:tran:Shift Click to Add]** at its top). With two
   or more versions showing, the same list has a red row that takes that column away.
7. In a hurry, ask the app instead: open the assistant (**🤖**, W-42) and type
   _Put John 3:16 on the screen_ — or the command **/verse John 3:16**, which
   needs no assistant. The passage goes up in the version the lookup is on, and
   the answer says what is on the screen now. Like the lookup's **[en:tran:Save bible item and show on screen]** (step 3),
   it is saved to the **[en:tran:Bibles]** list first, unless the list already
   holds it, and the answer says so. With no assistant to answer, a passage asked for in another language is
   read from the installed Bible that names its book, with one button that puts it
   up; when no installed Bible names the book, the answer says it could not be read,
   and offers **[en:tran:Import a Bible for me]** when no Bible in that language is
   installed. 📸

8. To make an editable slide document from a saved passage, first save one if needed:
   press **Ctrl+B**, choose the book, chapter and verse, then point at the passage's title
   to reveal its buttons and click **[en:tran:Save bible item]** (the floppy disk).
   Open that item's
   **⋮** menu in the Presenter's **[en:tran:Bibles]** list (the right column) and choose
   **[en:tran:Generate Slides]**. In the floating panel, tick every other Bible version
   you want on the same slides — one document holds them all, so this is done once, not
   once for each version. The original version stays selected. Enter an optional
   **[en:tran:Font Size]** in pixels, or leave it empty for **[en:tran:Auto]**.
   Choose **[en:tran:Dark]** or **[en:tran:Light]** under **[en:tran:Theme]** to set
   the generated slides' background and text colors. Both themes retain the
   translucent, inset background. 📸
9. Click **[en:tran:Generate Slides]** in the panel. The new document contains a
   title slide with the passage and Bible keys, then one slide per verse, with
   all selected versions together. Each version uses its own configured font.
   Compact margins leave room for the text; long verses resize to fit, with a
   consistent reading size throughout the passage, reducing your chosen size only
   when needed to fit. The upcoming verse appears
   at the bottom right in muted text at 85% of the current verse's font size.
   The last slide has no upcoming verse. 📸
10. Find the file in **[en:tran:Documents]**. Its name is every selected version's own
    reference, as a song made with **[en:tran:Create Lyric]** is named, for example
    `(ពគប) សុភាសិត ១៧ ២២-២៨, (NIV) Proverbs 17 22-28.ows` (the colon becomes a
    space for the filename). Generating again adds a numbered suffix to preserve
    the earlier file. **[en:tran:Cancel]** closes the panel without creating a
    file. If a selected version lacks a verse, generation reports it without
    saving a partial passage.
11. To have the passage as a song instead, open the same **⋮** menu and choose
    **[en:tran:Create Lyric]**, right under **[en:tran:Generate Slides]**. The
    floating panel picks versions the same way: the passage's own version stays
    ticked, and every other version you tick is added. Click
    **[en:tran:Create Lyric]** in the panel. The new song appears in
    **[en:tran:Documents]**, already selected and saved. Its title is the
    passage in its own version, for example `(ពគប) សុភាសិត ១៧:២២-២៨`, and its
    subtitle the other versions' on one line,
    `(NIV) Proverbs 17:22-28, (KJV) Proverbs 17:22-28` — both on its Info
    slide; the file is named after them all. Each Bible verse is a
    part named after its number (`Verse 22`, `Verse 23` …), and in it one line
    per version, the verse number first — `22: A cheerful heart is good
    medicine …` — in that version's own digits. Edit it like any other song
    (W-05); with **[en:tran:Atom Mode]** on, each version's line is a slide of
    its own. 📸
12. To put the passage up as a short notice over whatever is on the screen,
    choose **[en:tran:Create Quick Text]** from the same menu, right under
    **[en:tran:Create Lyric]**. The **[en:tran:Foreground]** panel's
    **[en:tran:Quick Text]** opens on a NEW session named after the passage,
    for example `(ពគប) សុភាសិត ១៧:២២-២៨` — the session you had open keeps its
    words. The box holds the reference as a `### ` heading and the verses after
    it (one verse without its number, several with `(22): …`), and the session
    is already dressed by the **[en:tran:Bible Verse]** preset: a dark band the
    full width of the bottom, words at 45px set left (smaller, down to 28px, past about three verses), on screen as long as
    the passage takes to read aloud (its **[en:tran:Live]** seconds: 20 for
    one verse like John 3:16, about a minute for six verses), in the
    Bible's own font — **[en:tran:Properties]** → **[en:tran:Font]**
    reads `app-Battambang` for a Khmer Bible.
    Press **[en:tran:Preview]** to
    read it as it will look, then **[en:tran:Show Quick Text]** when it is
    time. Nothing goes on a screen before that. 📸

_Verify: NAV-06..07, RD-02, PM-12, PR-02, KB-01..02, KB-06, KB-09, SC-03, SP-33, SP-34, CB-61, CB-131, CM-101, CM-102, CM-103._

### W-07 — Style the on-screen Bible text

**Goal:** change how verses look on the screen — their size, their colour, and
the edge or shadow that keeps them readable over a picture. A
**[en:tran:Long Text Show]** is drawn in the same look.

1. In the **[en:tran:Mini Screen]** panel, press **[en:tran:Reveal Hidden Controls]** —
   the three dots **⋯** at its bottom edge. The buttons under the Mini Screen
   are hidden until you do, and they stay up while the mouse is on them. The
   passage in the middle **[en:tran:Bibles]** tab has the same **⋯** under it,
   with the same button behind it, and **[en:tran:Long Text Show]** has it
   at the far end of the row that starts with **[en:tran:Add Language]**, always in view.
2. In the row of buttons that came up, press **[en:tran:Bible/LongText Properties]** —
   the one with a book and a gear. A floating panel opens; there is no card to
   open inside it, and no separate colour for verse numbers. 📸
3. **Say what is behind the words.** The top of the panel shows a verse on a
   background. Press **[en:tran:Dark]** when the words go over a dark picture
   or video — they turn white — or **[en:tran:Light]** for a light background —
   they turn black. The look you had is kept and edged the other way round.
4. **Pick a look.** Each tile under the verse is two letters wearing it:
   **[en:tran:Normal]** is plain words; **[en:tran:Thin Outline]**,
   **[en:tran:Outline]** and **[en:tran:Heavy Outline]** edge the letters;
   **[en:tran:Soft Shadow]**, **[en:tran:Deep Shadow]** and
   **[en:tran:Hard Shadow]** drop a shadow behind them; **[en:tran:Lifted]**
   does both; **[en:tran:Glow]**, **[en:tran:Haze]**, **[en:tran:Halo]** and
   **[en:tran:Blue Edge]** put a soft light behind the words so they can be
   read over a busy picture. One press changes every screen at once, and the
   tile in use is ringed.
5. **Change the size.** Drag **[en:tran:Font Size]**, or type a number in the
   box beside it.
6. **Change the colour.** Press the small square at the end of the
   **[en:tran:Text Color]** row; a colour picker opens under it. Pick a colour
   and the words on the screen change at once. Press the square again to close
   the picker. **[en:tran:Highlight Color]**, a section of its own under these
   rows, is the faint band under a selected verse or section:
   **[en:tran:Highlight on Dark]** (the moon; pink until you choose) is the band
   while the words are on **[en:tran:Dark]**, and **[en:tran:Highlight on Light]**
   (the sun; blue) while they are on **[en:tran:Light]** — the one in use has
   its icon lit. Press a square to choose a colour, keeping the picker's
   opacity low (the band lies under every line of what is selected); the arrow
   beside it puts that side back to its default.
7. **Change how the words are set.** **[en:tran:Font Family]** is a list of
   the app's own fonts and then the fonts on this computer. At the top is each
   enabled language's own face (`app-Google-Sans`, `app-Battambang` — the
   face a Bible in that language is drawn in), then the fonts the languages
   ship under their own names (Google Sans, Battambang, a sticky-note hand).
   Pick one
   and every verse is drawn in it; pick
   the first line of the list, `--`, to go back to each Bible's own font. Letters
   the font you picked does not have — Khmer under an English font — stay in
   the Bible's own. **[en:tran:Text Style]** has
   **[en:tran:Bold]** and **[en:tran:Italic]**; **[en:tran:Text Align]** puts
   the lines left, centre, right or justified; **[en:tran:Line Height]** and
   **[en:tran:Letter Spacing]** open the lines and the letters up.
8. **Make a look of your own.** **[en:tran:Outline]** is how thick the edge is;
   **[en:tran:Shadow Blur]**, **[en:tran:Shadow Offset X]** and
   **[en:tran:Shadow Offset Y]** soften the shadow and move it;
   **[en:tran:Glow]** is the size of the light behind the words. Each has a
   square for its own colour, and picking a colour switches that part on.
   Somebody who knows CSS can type a `text-shadow` in the
   **[en:tran:Text Shadow]** box instead.
9. **Keep it.** Press **[en:tran:Save as Preset]** — the last tile, with a plus
   — type a name and confirm. The look, its size and colour included, becomes a
   tile of its own, and pressing that tile later puts all of it back.
   Right-click a saved tile for **[en:tran:Rename Preset]**,
   **[en:tran:Replace with Current Look]** and **[en:tran:Remove Preset]**.
10. **[en:tran:Reset]**, at the bottom, goes back to plain words and keeps the
   size. The font goes back to each Bible's own, and both highlight colours
   to their own.

_Verify: PM-13..14, PM-57, PM-159..162, PM-167, SP-21._

### W-08 — Set the background (color / image / video / web)

**Goal:** put something behind your content.

1. Find the **[en:tran:Background]** panel at the bottom of the middle column,
   open with its tabs showing. If it has been folded to a thin bar, click the
   bar and the panel opens again. 📸
2. Pick a tab: **[en:tran:Fills] / [en:tran:Images] / [en:tran:Videos] / [en:tran:Cameras] / [en:tran:Webs]**.
   - **[en:tran:Fills]:** a plain color, a gradient or a pattern. Click a color swatch, or a tile
     under **[en:tran:Gradients]** or **[en:tran:Patterns]**. **[en:tran:Dark]** /
     **[en:tran:Light]** at the top swaps the rows below between deep and pale ones. A tile with
     a small wind mark moves on the screen; the tile itself and the Mini Screen stay still. If a
     color could clash with the Bible text, the app changes the text color so it stays visible
     and says so in a message with its own **[en:tran:Undo]** — it asks nothing. 📸
   - Once a screen holds a fill, the tab has a section for each such screen. The arrow at the
     left of its line, in that screen's color, folds the section to that line, which then shows
     the screen's number and what it holds; press the arrow again to open it.
   - **[en:tran:Customize]**, beside the tiles while a screen holds a gradient or a pattern,
     changes its colors, **[en:tran:Type]**, **[en:tran:Angle]**, **[en:tran:Opacity]**,
     **[en:tran:Size]** and **[en:tran:Speed]**; the screen follows half a second after you
     stop. The sliders button at the end of the **[en:tran:Gradients]** line opens and closes it.
   - **[en:tran:Save as Preset]**, under the patterns, keeps what is up as a button of its own
     under **[en:tran:Presets]**.
   - Right-click a gradient or pattern tile, or a saved button, → **[en:tran:Copy CSS]** to
     take its CSS somewhere else, at a screen's size. A still one copies as its lines of CSS; a
     moving one as a short stylesheet that moves it as the screen does — put the class
     `owa-fill` on what it is to fill.
   - **[en:tran:Images] / [en:tran:Videos]:** **click** an item to make it the live background;
     click the same item again to take it off. 📸
   - **[en:tran:Cameras]:** pick a connected camera device.
   - **[en:tran:Webs]:** click a saved page, or use the **⋮** next to the folder path (or
     right-click the empty list) → **[en:tran:Add URL]** to add one (a small box asks for the
     web address; the Web Editor, W-15, is for a page file of your own).
     **A saved address cannot be edited.** To change it, right-click its tile →
     **[en:tran:Remove URL]** (it asks first, and is not offered while that page is on a
     screen), then **[en:tran:Add URL]** with the new address — on the tab's **⋮** at the
     right of the folder path, or a right-click on an empty part of the list.
3. The live background's tab carries the on-screen dot before its name (e.g. `● Videos`).
4. Press **F7** ([en:tran:Clear Background]) to remove it.

**Thumbnail view vs list view (Images / Videos / Web).** By default each tab shows
picture previews. If you have a lot of files — or the app feels slow on an older
machine — switch to a plain name list: click the small **⋯** button at the bottom-left of the Background panel
(**[en:tran:Reveal Hidden Controls]**) to bring up the footer bar, then
click the **list** icon (`☰`, **[en:tran:List View]**) at its far right; the **grid** icon
beside it (**[en:tran:Thumbnail View]**) switches back. 📸 The list shows each file's full name (with its extension), which screens it is
showing on, and its colour dot — clicking a row still puts it on screen exactly like a
thumbnail. Each tab remembers its own choice, and it survives restarting the app. The
thumbnail-size slider only appears in thumbnail view.

**Folder sessions (Images / Videos / Webs / Audios).** Above each of those lists is a
row of small buttons: **[en:tran:Default]**, then any you add with **＋**. Each one is a folder of
its own — with its own view mode, sort and slide show — so you can flick between this
Sunday's pictures on a memory stick and your standing set of backgrounds without ever
re-pointing the folder the app was set up with. **[en:tran:Default]** IS that folder: it is the
one Path Settings names, and adding sessions never touches it. A new session starts with
no folder and offers to use the default one. To point a session at a folder of your own,
press the folder line above the list (the path it is reading): a box opens under it — type
the folder's path and press Enter, or press **[en:tran:Choose a folder]** (the folder icon)
and pick it. The **⋮** on the session you are on (or a
right-click on any of them) renames or removes it — **[en:tran:Default]** can be renamed,
never removed. Removing forgets that session's folder and slide show — never the files
themselves. **[en:tran:Documents]**, **[en:tran:Presenting Flows]**, **[en:tran:Bibles]**
and **[en:tran:Bible Notes]** carry the same row under their titles (W-58). On the Images, Videos and Webs tabs
the slide show sits on the same row, and a blue ▶ on a button means that session's show
is still running while you look at another one.

_Verify: PM-26..33, PM-101, PM-114, PM-144, PM-145, PM-181..186, KB-04._

### W-09 — Play audio, and foreground extras (countdown, clock, marquee bottom…)

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
  words at 45px set left, on screen as long as they take to read aloud;
  past about three verses it
  sets the words smaller, down to 28px, so a long passage stays a band
  instead of covering the slide. Every word you typed is kept; pressing a
  preset twice changes nothing more. The band sits flush on the bottom edge;
  **Y** in _Properties_ lifts it.
- **How long a quick text stays is each session's own.** On one line above
  the box, **[en:tran:Delay]** is the seconds it waits before it shows (0 to
  start) and **[en:tran:Live]** the seconds it stays on the screen (5 to
  start; a preset sets its own; **[en:tran:Bible Verse]** works it out from
  the words in the box, about 150 a minute read aloud with a few seconds
  more, never under 10). The dial button after Live works Live out from the
  words in the box, at the pace it then names: the first press
  **[en:tran:Slow]**, the next **[en:tran:Medium]**, then
  **[en:tran:Fast]**, then **[en:tran:Slow]** again — press it again after
  changing the words. Switch on
  **[en:tran:Infinite]** beside them and that session's text stays up until
  you take it down with its **[en:tran:Hide Quick Text]** row or a Clear;
  the Live box and the dial grey and Live keeps its number for when you
  switch it off again. Each session keeps its own three, so a verse can stay up while a speaker's
  name in another session leaves after a few seconds.
- In _Properties_ the **[en:tran:Round]** row's px box can be emptied to type
  another size: it keeps its place until you type a number, and shows the
  size in force again if you leave it empty. 0 px is a square corner.
- Quick Text's _Properties_ has **[en:tran:Horizontal Margin (%)]** and
  **[en:tran:Vertical Margin (%)]** in place of a width, as a Lyric stage's
  _Slide Margin_ has them: the side margin is kept on each side, the vertical
  one above or below the box (whichever edge it is set to), and the link at the
  left of both sliders moves both together.
- The Show / Start row is the panel's footer in [en:tran:Messages], the
  marquees, [en:tran:Quick Text], [en:tran:Stopwatch] and [en:tran:Long Text Show]
  ([en:tran:Countdown] docks its Start / Pause row there; [en:tran:Time],
  [en:tran:Camera Show] and [en:tran:Screen Show] their Hide row): it stays at
  the bottom of the panel while the _Properties_ and the rest scroll under it,
  and its buttons are small. The **X** and **Y** nudge boxes sit on one line
  under the position pad.
- **[en:tran:Countdown]:** two modes. _To a date/time_: set date + time and press
  **[en:tran:Start Countdown to DateTime]** — it starts at once and always counts to that
  clock time. _For a duration_: set the **h**, **m** and **s** boxes (more than 24
  hours is fine: a day or more reads its days first, in the app's language —
  25 h reads `1d 01:00:00`) and press
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
- **[en:tran:Time]** (the clock): same pattern — configure, then
  **[en:tran:Show Time]** puts it up, and the **[en:tran:Hide Time]** button
  under it (one for each screen holding it) takes it down.
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
  went up with no session (a dragged run-sheet row) belongs to the
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
  **[en:tran:Top Right]**, **[en:tran:Bottom Right]**, **[en:tran:Center]** (large, in
  the middle) and **[en:tran:Bottom Banner]**; [en:tran:Time] **[en:tran:Top Left]**, **[en:tran:Top Right]**, **[en:tran:Bottom Right]** and
  **[en:tran:Center]**; the picture, screen and web shows
  **[en:tran:Full Screen]**, **[en:tran:Picture in Picture]**, **[en:tran:Center]** and a small corner;
  the camera **[en:tran:Full Screen]**, **[en:tran:Picture in Picture]** and **[en:tran:Bottom Left]**.
  At the right of the _Presets_ name, in every component with words and a box
  (all but the picture, screen and web shows), is **[en:tran:Dark]** /
  **[en:tran:Light]** — light words on a dark box for a dark slide, or dark words
  on a light box for a light one. The side lit is read off the words' colour.
  Pressing the other one keeps both colours and only makes them lighter or
  darker — the box darker and the words lighter for **[en:tran:Dark]**, the
  reverse for **[en:tran:Light]** — until the words stand out clearly from the
  box; a blue box stays blue, only lighter or darker. A preset pressed then goes
  on in that side, and each preset's icon shows its colours on it. Until you
  pick a colour yourself, a session's words and box follow the app's theme:
  their **[en:tran:Light]** side in a light window.
  Every preset with words but a marquee's sets its own font size too (a clock or timer in a
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

_Verify: PM-15..25, PM-28, PM-34, PM-128..PM-133, PM-146, PM-147, PM-150, PM-151, PM-152, PM-153, PM-158, KB-03, KB-07, CB-67._

### W-53 — Show a song in several languages for everyone to sing (Long Text Show)

**Goal:** put one text — usually a song — on the screen in two or more
languages side by side, each part beside its translation, and let it scroll
while the room sings.

**Quickest for one song:** right-click it in the **[en:tran:Documents]** list and choose
**[en:tran:Long Text Show]**. The panel opens on a new session named after the
song, holding it as an **EN** card read from its **[en:tran:Lyric File]**, and
**[en:tran:Show Long Text]** is on as soon as the card has read the song — go
on at step 5, or at step 2 to put a translation beside it. Each press makes
another session; the ones you no longer need are removed from their tab's
menu.

1. Open the **[en:tran:Foreground]** tab and choose **[en:tran:Long Text Show]**
   in the menu. Its panel opens.
2. **Add the languages.** Press **[en:tran:Add Language]** and pick one; press it
   again for the next. Each language gets a card of its own, named by its code
   (KM, EN), and a language can be in the list only once. The top card is the
   left column on the screen; the arrows on a card move it, and its ✕ takes
   that language out.
3. **Give each language its words**, one of two ways, chosen on its card:
   - **[en:tran:Raw Text]** — type a **[en:tran:Title]**, then one box per
     section (a verse, a chorus). **[en:tran:Add Section]** adds the next box;
     the ✕ beside a box removes it and the arrows move it. A line break in a
     box is a line break on the screen.
   - **[en:tran:Lyric File]** — press **[en:tran:Choose Lyric]** and pick one of
     the songs in your Documents list. The card then says the song's title and
     how many parts it sings. The words come from the song in the order it is
     SUNG, so a chorus sung three times is there three times. Chords are left
     out, and so is a part that has chords and no words (an intro, an
     instrumental).
4. **The languages have to line up.** Until they do,
   **[en:tran:Show Long Text]** stays off and the panel says the first thing
   that does not match: typed languages need the same number of sections, none
   of them empty, and two songs need the same parts in the same order. It
   reads like this: _The songs do not have the same structure: 1. KM Verse 1 ≠
   EN Intro_.
5. Tick the screen in the Mini Screen panel and press
   **[en:tran:Show Long Text]**. Each language is a column under its title and
   each section is a numbered row, so a verse sits beside its translation. 📸
   It takes the place of a Bible passage or a slide on that screen.
6. **Let it scroll.** On the Mini Screen card, press the double arrow at the
   bottom right of the picture: the text starts moving up by itself, on the
   screen too.
7. **Jump to a part.** Every card lists its parts as buttons — `1 Verse 1`,
   `2 Chorus` … on a song, the section's own number on typed text. While the
   text is on a screen, press one and that row is marked, faintly, and
   brought to the middle of the screen in every language. The button you
   pressed stays lit, on every language's card, so the panel shows where the
   song has got to. A chorus sung twice
   has two buttons, and each goes to its own row. On a song's card each
   part starts as a card holding that part's words, run on in one line with
   a slash between its lines, for following the song by its words — press
   anywhere on a card to bring it to the middle. The first button of that
   row, **[en:tran:View as Text Cards]**, turns them into small buttons
   with only the part's name, and back; the card remembers which.

   A row is never thrown into view: it glides there, quickly at first and
   then slowing into place, so a room reading along is not lost — a Bible
   passage's selected verse moves the same way.

   **Every line on a row of its own.** Press **[en:tran:Atom Mode]**, beside
   the book and gear at the top of the panel, and each LINE of a part
   becomes a card, a button and a screen row of its own, numbered on
   through the whole song: a verse of four lines is `1 Verse 1` to
   `4 Verse 1`, and the chorus after it starts at `5 Chorus`. A blank line
   in typed text is kept as an empty row. The buttons, the light and the
   keys then go line by line. Every language must break each part into the
   same number of lines, or the panel says which part differs and
   **[en:tran:Show Long Text]** stays off. Pressed while the text is up, it
   goes up again on the same screens at once, at the same place. The
   session remembers it; press it again to go back to a row per part.

   **Every language in the same row.** Press **[en:tran:Stack]** and the
   languages stop standing side by side: each row holds every language, one
   under the other in the order of the cards, the way the Bible Reader shows
   versions together. The row's number sits on a line of its own above them,
   in each language's digits (`4, ៤`), and the one header reads `EN | KM`
   with the titles `Still | Still`. Each language keeps its own font and
   size. **[en:tran:Stack]** waits for a second language: with one card it
   is greyed out, and it comes back as you left it when you add another.
   Press **[en:tran:Hide Number]** to put the rows up without their
   numbers and the header without its language codes (`EN`, `EN | KM`),
   side by side or stacked; the titles stay, and the cards in the panel
   keep their numbers. Both go up again at once on a screen showing the
   text, with the same row marked.

   **Step with the keys.** Once you have pressed a part, its button has the
   keys, the way the slides do: **Space**, **→**, **↓** or **Page Down**
   presses the next part's button, and **Shift+Space**, **←**, **↑** or
   **Page Up** the one before. The light and the keys move along with it, on
   the card you pressed, so you can follow the song from the keyboard or a
   presenter remote. It stops at the last part, and at the first: it never
   goes round to the beginning. A part that is not lit keeps its own keys —
   **Space** presses that one.
8. **Give a language its own font and size.** The whole text is drawn in
   **[en:tran:Bible/LongText Properties]**, the book and gear at the right
   end of the row at the top of the panel (W-07): its colour, boldness, alignment, shadow
   and highlight are every language's. Open **[en:tran:Properties]** on a card
   for the two things a language may need of its own: **[en:tran:Font]**, and
   **[en:tran:Text Size (%)]** (its size beside the other languages — 80 makes
   it a little smaller; two fonts at the same size can look different sizes).
   Both are unset until you choose them, and unset they follow the panel. A
   change reaches a showing text about half a second after you stop.
9. **Change the words.** Edit a card and press **[en:tran:Show Long Text]**
   again: what is on the screen is the text as it was when you last pressed it.
10. **Take it down.** **[en:tran:Hide Long Text]** beside the show button, or
    **[en:tran:Clear Long Text]** (the **LT** button) or
    **[en:tran:Clear Foreground]** (**FG**) on the Mini Screen card.
11. The tabs at the top of the panel keep several texts — a song a tab — each
    with its own languages and looks.

_Verify: PM-163, PM-164, PM-165, PM-166, PM-167._

### W-10 — Control what the audience sees (mini screen + clears)

**Goal:** manage the live output from the screen preview card.

- The **mini screen** (right column, bottom) mirrors the audience view; the
  zoom slider under it only rescales your preview, not the output. 📸
- Behind everything the card draws sits **that monitor's own desktop wallpaper**.
  The audience screen is a transparent window, so wherever you have put nothing
  up this is genuinely what the room would see. Right-click an empty part of the
  mini-screen panel (or press the **⋮** at its bottom-right) → **[en:tran:Show Monitor Wallpaper]**
  turns it off and puts the plain checkered pattern back — that is all it takes.
  **[en:tran:Refresh Preview]** in the same menu is for something else: it re-reads the
  wallpaper after you change your desktop background. A machine
  that will not say what its background is keeps the pattern.
- Each screen has its own preview card with a **header** and **footer** of controls:
- **Show / hide the screen** (header, leftmost — or press **F5**): turns the physical
  output display on or off. The toggle acts on its own screen; **F5** acts on the
  **selected** screens (every screen when none is selected) and turns them all the
  same way: on only when all of them are off, otherwise all off.
  An unselected screen stays as it is when another screen is selected. The icon fills in and brightens while showing. It is
  the control named **[en:tran:Toggle showing screen]** — say those words when
  telling someone which one to press, because several other things in this window
  are also called "Show". 📸
- **Hide every screen.** In the Presenter's mini-screen panel (bottom right), check
  every screen card, including unselected ones. On each card whose leftmost header
  button **[en:tran:Toggle showing screen]** is filled and bright, click it once to
  hide that screen; leave an unlit button alone. When every such button is unlit,
  all screens are hidden and their content is kept. **F5** is a toggle for the
  selected screens, so use these individual buttons to hide every screen safely.
- **Clear buttons** (header — each also has a function key):
  **Clear All `F6` / BG `F7` / SL `F8` / LT `F9` / FG `F10`**
  ([en:tran:Clear All] / [en:tran:Clear Background] / [en:tran:Clear Slide] / [en:tran:Clear Long Text] / [en:tran:Clear Foreground]).
  A button is only lit while its layer has something to clear. **LT** is the
  long text layer: a Bible passage, or the text of a
  **[en:tran:Long Text Show]**.
- **Stop drawing the preview** (header, the eye right after **FG** —
  **[en:tran:Stop rendering preview]**): for a slow computer. Click it and that card
  stops drawing: its body turns into a striped pattern that says
  **[en:tran:No rendering]**, while the audience screen goes on showing everything.
  Every other button on the card still works, the clear buttons still light up, and
  whatever you present from the lists still goes to the screen — only the picture
  of it here is gone, and with it the work of drawing it twice. A slide's video or
  audio still plays its sound as before, but its play button is part of the picture:
  click the slashed eye (**[en:tran:Resume rendering preview]**) to bring the
  picture back and start one by hand — the card picks up exactly what is on the
  screen, and a clip that was playing carries on. The card remembers the choice for
  that screen, even after a restart. 📸
- **[en:tran:Lock]** (header, the padlock): when locked (red), the screen refuses any change to its slide, background, Bible text or overlays —
  handy during a live moment; click again (green) to unlock. A change it refuses says
  _[en:tran:Screen Manager is locked]_ in a message with its own **[en:tran:Unlock]**: pressing it
  unlocks the screens and closes the message.
- **[en:tran:Display]** (footer, e.g. `(0):2678…`): click to pick **which physical display** this
  screen projects to — the menu lists every display with its resolution, and marks the
  current one with `*` and the primary one with `(primary)`.
- **Nothing on the projector?** Check its card from the top: it is showing
  (**[en:tran:Toggle showing screen]**, or **F5**); its footer's **[en:tran:Display]** names the
  projector, not this computer's own screen — pick it there; and something is on it — a
  lit clear button says which layer holds something.
- **Transitions** (footer, `Tr:`): the **[en:tran:Slide]:**, **[en:tran:Background]:** and
  **[en:tran:Foreground]:** buttons choose the change animation for that screen —
  **none / fade / move / zoom**. They are the fallback: a document, a slide, a
  Background tab, one background, a foreground panel or one of its sessions can
  carry its own transition instead (W-48). 📸
- **Background audio** (footer, the soundwave icon — appears while a video background
  is live): opens a small player per video to play/pause its audio in sync; the
  repeat icon loops it. The app refuses to close the player while audio is playing.
- **Stage number** (footer, `St:`): click to assign this screen a stage number
  (0–5, or increment/decrement) for stage-view setups. Moving a screen to any stage
  above 0 also sets its **[en:tran:Slide]:** transition to **none**, and a note in the
  corner says so; you can pick another one
  afterwards, and going back to stage 0 leaves the transition as it is. A document's
  or a slide's own transition (W-48) still wins over it.
- **Draw or spotlight on the screen** (footer, the brush — **[en:tran:Drawing]**): press it to
  draw on that screen; its settings open in a strip under the card. Its **⋮**
  (**[en:tran:Choose Drawing or Focusing]**) turns it into **[en:tran:Focusing]**, a spotlight
  that dims the rest; press the lit button again to stop either. The strip opens on
  **[en:tran:Presets]**: **[en:tran:Highlight]** (a see-through yellow marker),
  **[en:tran:Underline]** and **[en:tran:Bold]** for the brush, **[en:tran:Haze]** (light),
  **[en:tran:Strong]** (dark) and **[en:tran:Halo]** (wide) for the spotlight.
  **[en:tran:Save as Preset]** keeps the current look; right-click a saved one to rename,
  replace or remove it. Every screen and Presenting Control (W-19) share the saved ones. 📸

_Verify: PR-04..07, SP-01..09, SP-23, SP-24, SP-35, KB-03..07, KB-13._

---

## Bible study

### W-11 — Read the Bible (references, text size, history, versions)

**Goal:** look up and read a verse in the Bible Reader — deeper reading than the
quick lookup, and where you look a verse up when you are not presenting.
**Where:** the **[en:tran:Bible Reader]** page. If you are on the Presenter,
click its **[en:tran:Bible Reader]** header tab to get here; the Reader itself
has no header tabs.

1. In **[en:tran:Bible Reader]**, click the **[en:tran:Bible Reference]** box at the top. If it already
   contains a reference, click **[en:tran:Clear input]**. Click the book, then the chapter, then
   the verse from the buttons that appear; the passage opens. This is the preferred
   route for a non-English Bible because the buttons use that Bible's own names and
   numbers. 📸
   > Typing a full reference such as `John 3:16` is an optional shortcut when the
   > selected Bible recognizes it. **Tab** completes a piece, **Escape** clears the
   > last piece and **Shift+Escape** clears the box.

   **A passage that runs on into later chapters of the same book.** Type its
   first verse and its last verse, each with its chapter: `John 1:50-6:3` is one
   passage, from John 1:50 to John 6:3. `John 1-3` takes chapters 1 to 3 whole,
   `John 1:-2:` runs from 1:1 to the end of chapter 2, and a dot does what a colon
   does (`យ៉ូហាន ១៨.៣៩-១៩.១៦`). Each chapter of it starts under a line with the
   chapter's number, `─ 2 ─────`. A passage over more than three chapters opens
   with the first three and a **...** button under them
   (**[en:tran:Show the next chapter]**): each click adds the next chapter, and
   the button goes once the last one is shown. 📸
   **Open a reference in a section heading.** Some Bibles print references in their section headings — `(… យ៉ូហាន
   ១៨.៣៩-១៩.១៦)` under a heading of Mark 15. Click one and the whole passage it
   names opens in a small floating panel — a long one the same way, three chapters
   and **...** — and the passage you are reading stays as it is.
2. If the words are too small, click the small **⋯** at the bottom-left of the
   passage to open the hidden controls. Then press and hold the
   **[en:tran:Font Size]** slider, move it to the right, and let go when the words are
   large enough.
3. To read two Bible versions side by side in one pane, click **[en:tran:Add Extra Bible]**
   beside the version name, then click the version you want. 📸
4. **Panes that share a color scroll together.** In the Bible Reader, click the dot
   at the start of the passage pane's header (**[en:tran:Color Note]**) and pick a color.
   Point at that header to reveal its buttons, click **[en:tran:Split Horizontal to]**
   or **[en:tran:Split Vertical to]**, then choose another Bible version. The new pane
   joins the same color group. Scroll either pane: the other version follows the same
   verse. If it does not follow, turn on **[en:tran:Sync group scrolling]** with the
   small up/down arrows directly below the color dot.
   The color, sync-scroll and audio icons are dimmed until you hover over
   their group or reach one of them with the keyboard.
   It starts enabled: scroll any pane and the other translations move along
   with it, smoothly and continuously, keeping the same verse at the same
   height. When it reaches the top or the end of the passage, they reach theirs
   too. Scroll another member to make it lead; the others glide into line with
   it instead of jumping. Click the arrows in any member to turn following off
   for the group; the previous scrolling behavior remains. Click again to turn
   it on: the group immediately glides into line with the pane where you
   clicked, without needing another scroll.
   The choice is remembered for that color group, and the toggle appears only
   while the group has at least two panes.
   **Every pane has a color — lime until you pick another.** Its two split
   buttons, in the row that appears while the mouse is over its header, read
   **[en:tran:Split Horizontal to]** and **[en:tran:Split Vertical to]**: click
   one, then click a version in the list, and the same passage opens beside (or
   below) it in that version, in the same color group. Panes left on the default
   lime are one group already, so they follow the same passage and scroll
   together until one is given a different color; **[en:tran:No Color]** (or
   clearing the color) returns a pane to that lime group. A pane that was NOT
   split off another — a passage dragged onto the edge of a pane from the
   **[en:tran:Bibles]** list, a recent reference row or a search result, or one
   opened with **[en:tran:Open beside the current verse]** — starts in a color no
   pane is using yet, so it keeps its own passage instead of following the lime
   group.
5. If you lose a passage, you do not need to remember and type it again: the recent
   reference rows near the top keep it. Click one to read it in a small floating
   panel, in the version it was read in; the passage you are on stays as it is. To
   go back to it, open that row's **⋮** (or right-click it) and choose
   **[en:tran:Set to current editing]**. **[en:tran:Open beside the current verse]**
   in the same menu opens it next to the passage you are on instead.
6. To change the main Bible version, click its short name in the header and choose a
   version from the list. 📸
7. To read without the side panels, click the small **⋯** at the bottom-left if the
   footer is hidden, then click **[en:tran:Full]** at the bottom-right. Click
   **[en:tran:Exit Full]** to bring the panels back.
8. The Bible Reader does not put a verse on the audience screen: double-clicking a verse
   here only selects it. (A double-click means pressing the left mouse button twice
   quickly in the same place.) To show a verse to the audience, go back to the Presenter
   and present it from there (W-06). To keep a verse for later, point at the top right of
   the Bible Lookup and click **[en:tran:Save bible item]** (the floppy disk), or press
   **Ctrl+Enter**: it goes to the **[en:tran:Bibles]** list, ready to present from the Presenter.
9. To let supported passages start their generated audio automatically, open
   **[en:tran:Setting]** → **[en:tran:AI Providers]**. After an **OpenAI API
   Key** is saved, turn on **[en:tran:Auto Play Audio AI when available]** under
   the OpenAI key. The switch lives with the provider setting, not in the Bible
   Reference toolbar.

_Verify: RD-01..07, RD-11, RD-19, RD-21, RD-29, RD-38, RD-122, RD-124..126, ST-59, CB-125._

### W-12 — Search the whole Bible (Bible Find)

**Goal:** find verses by words, not reference.

1. In the Bible Reader (or the lookup dialog), click **[en:tran:Advance Bible Lookup]** (the
   binoculars at the top right of the lookup) to open **[en:tran:Advance Lookup]**,
   the rightmost horizontal section beside **[en:tran:Bible and Notes]** and
   **[en:tran:Bible Lookup]**. Choose **[en:tran:Find]** in its dropdown; it remembers
   the last study view used. The binoculars mirror the section's open/closed state. 📸
   Close or resize it with its divider just like the other sections, and click its
   collapsed **[en:tran:Advance Lookup]** strip to reopen it. The toolbar stays available
   above the sections, even with **[en:tran:Bible Lookup]** collapsed.
2. Type your search words. Every verse containing them is listed, with **the word you
   searched for marked** in each one, so you can see at a glance why a verse is there.
   The reference — _Psalm 23:1_ — leads each result; clicking anywhere on the result
   opens that verse in a small floating panel, in the version you searched, and the passage
   you are reading stays as it is. Its **⋮** menu has **[en:tran:Open]**, which does the same,
   and **[en:tran:Open beside the current verse]**, which opens it as a passage beside the one
   you are reading. 📸
3. The bar under the results, at the bottom of the panel, says how many verses matched — **74 [en:tran:verses found]**.
   Use it to judge whether to narrow the search: a common word runs to tens of
   thousands. If a completed search has no matches, the panel says
   **[en:tran:No verses found]**. Try different words or widen the book filter.
   To clear the search and start again, empty the words in the search box: the panel
   then shows **[en:tran:No data available]**, ready for new words. 📸
4. Results arrive in blocks of twenty, each headed **[en:tran:Results] 1–20**, **[en:tran:Results] 21–40**
   and so on. The numbers at the bottom right move you through them: a **filled** number
   is a block already on screen, so clicking it scrolls straight there; a **plain**
   number has not been fetched yet, and clicking it loads that block in below. Only the
   numbers near where you are, plus the first, the last, and the blocks you have
   loaded, are listed — the rest sit behind **…**, which is a button: it names the
   blocks it is holding (_Show pages 4–139_) and clicking it lists them all. On a find
   big enough to run to thousands of blocks it opens in steps instead, and clicking a
   **…** between two steps opens that stretch — so any block is a click or two away
   without the app ever drawing a thousand numbers at once. 📸
5. To search part of the Bible only, in the **[en:tran:Find]** view of step 1, click the **[en:tran:All Books]** button
   and pick a book — **Shift**-click to pick several, or choose **[en:tran:Old Testament]** /
   **[en:tran:New Testament]** for a whole half. Once a filter is on, the button shows a funnel
   and the books you chose; while it says **[en:tran:All Books]** it stays plain, so a narrowed
   search never hides in plain sight. 📸
   The **⋮ [en:tran:More Options]** button beside it offers **[en:tran:Reset Selected Books]** to go back
   to the whole Bible, and **[en:tran:Reset Search Data]**, which rebuilds the search index —
   that one takes a moment and reloads the app.
   **To put a result on the screen.** Search in the Presenter's Bible Lookup — open it with
   **[en:tran:Bible Lookup]** at the top of the Presenter, or **Ctrl+B** — because the
   Bible Reader puts nothing on the audience screen (W-11). There, open its search with the
   binoculars and **[en:tran:Find]**, as in step 1, and type your words. A result has no show button of its own. Open its **⋮**
   menu and choose **[en:tran:Open beside the current verse]** — it opens as a passage in the
   lookup — then, in the Presenter, point at that passage's title and press the cast icon,
   **[en:tran:Save bible item and show on screen]**, as for any passage (W-06 step 3).
6. **Cannot remember the words exactly?** Press **[en:tran:Find a Verse with the Assistant]** —
   the robot at the right end of the **[en:tran:All Books]** row. The help window opens a chat of
   its own and asks **Which Bible should I search?**, the one Find is on first. Press one, then
   type what you remember: a few of its words in any order — _love enemies pray_ — or what the
   verse is about — _Jesus asked Peter three times if he loved him_. The assistant searches that
   Bible, and the internet when it cannot place the verse there, and quotes only verses it found
   in YOUR Bible; under its answer each one has **Open … in Bible Lookup**, which opens it in the
   lookup and puts nothing on a screen. Say more under the answer — _no, it was about sheep_ — and
   it searches again. Under every answer, **[en:tran:Show in another Bible]** — **[en:tran:Search another Bible]**
   when nothing was found — lists the other Bibles on this computer: press one (English, say,
   when you were searching a Khmer one) and the verses found are shown from it, or what you
   typed is searched in it, with nothing to type again; the search then goes on in that Bible.
   With no assistant set up, the window searches your words itself and lists
   the verses that hold the most of them, with **[en:tran:Search Google for it]**. 📸
   You can also just ask in the help window, in any chat: _which verse says do not worry about
   tomorrow?_ — or in one line, `Help me find a Bible verse in "KJV": love your enemies`.
   **Typed your words in Find first?** Press the robot then, and it searches them at once
   in the Bible Find is on — no question about which Bible.
   **A story works too.** Ask _where in the Bible is the story of the flood?_ — or tell the
   finder _the story of David and Goliath_ — and the answer says where it is told first,
   _told in 1 Samuel 17_, with a button that opens that whole chapter, then its key verses.
   Name the book if you remember it — _in Genesis, Noah and the dove_ — and only that book
   is searched; it is understood even spelt a little wrong.
   **Every verse with a word.** Look for one word — _shepherd_ — and the answer says how many
   verses have it and in which books. Press **[en:tran:Every verse with these words]** to see them
   eight at a time, the chapters where the word gathers first, and **[en:tran:More verses]** for the
   next eight. 📸

_Verify: RD-08, RD-09, RD-45, RD-46, RD-47, RD-124, CB-146._

### W-13 — Cross references

**Goal:** see what else in scripture speaks to the verse you are reading.

1. In the bible lookup, click **[en:tran:Advance Bible Lookup]** (the binoculars, top right) to open
   the side panel, then pick **[en:tran:Cross Reference]** from the panel's dropdown —
   the second entry, after **[en:tran:Find]**. 📸
   You can also get here from the verse itself: right-click any verse in the lookup body
   and choose **[en:tran:Open in Cross Reference]**. That opens the panel on this view AND on that
   verse.
   Until you have picked a verse the view says **[en:tran:No verse selected]** and tells you what to
   do about it.
2. The top of the view shows the verse it is working from — its version, its reference and
   its text. Click the reference to move to another
   verse, or the version chip to read the references in another translation. 📸
3. Under it, **AI [en:tran:Cross References]** with the version it is quoting on the right, and a
   line saying how much there is: **7 [en:tran:Themes] · 35 [en:tran:Verses]**. Click the title to collapse the
   whole section; right-click the title (not the references under it) for
   **[en:tran:Refresh]**, which re-fetches.
4. The references are grouped by **theme** — a sentence such as _Genealogy from Adam to
   Noah_ — set flush left, with that theme's verses hanging off a single vertical line
   beneath it. 📸 Each verse gives its reference on its own line and the opening of the
   verse under it, cut at a word with a single `…` when there is more.
   Themes set in columns and reflow to one column when the panel is narrow.
5. Point at any verse and the line beside it lights up, along with its reference: click to
   read it in a small floating panel, in the version the references are quoting — the
   verse you are on stays as it is. Drag it into a list, or right-click it (or press its
   **⋮**) for the usual verse menu: **[en:tran:Open]** does what a click does, and
   **[en:tran:Open beside the current verse]** opens it as a passage beside the verse you
   are on. The keyboard reaches the same rows — **Tab** to one and press **Enter**.
   The version in front of the reference in the panel's title — **KJV** — is a button: click it and
   choose another Bible, and the same verse opens in a second panel of its own, so the two
   can be read side by side. Close a panel with its **×**.
6. The **chip** button on the section title (**[en:tran:Generated using AI technology.]**) says a model wrote these; click it for the
   page explaining what that costs you in accuracy. On a translation whose theme headings
   were machine-translated, each heading carries its own **translate** button
   (**[en:tran:Generated using Google Translate.]**) saying so — on an English bible nothing was translated and the mark is absent.
7. If you have put your own OpenAI or Anthropic key in Settings, **OpenAI ([en:tran:Custom])** and
   **Anthropic ([en:tran:Custom])** appear as their own sections below, each collapsing and refreshing
   the same way. The section above them needs no key.

_Verify: RD-10, RD-49, RD-50, RD-51, RD-52, RD-124._

### W-14 — Keep Bible notes

**Goal:** attach your own notes to study.

1. Find the **[en:tran:Bible Notes]** panel. It is a panel, not a tab: it sits beside
   **[en:tran:Bibles]** (under it when the column is narrow) inside the
   **[en:tran:Bible and Notes]** section — at the top of the right column in the Presenter,
   on the left in the Bible Reader.
   **Making a new file:** click the **⋮ [en:tran:More Options]** in the panel's title
   (or right-click the empty space under the files) and pick **[en:tran:New Bible Note]**
   (a notes file, holding notes) or **[en:tran:New Markdown File]** (a `.md` page of your
   own). Type a name and press **Enter**. A Markdown file is listed with the markdown icon
   among the notes files, its first line the name as a heading, and it opens in its own
   **Markdown Preview** window — click its row to open it again, and press
   **[en:tran:Edit]** there to write (W-37 step 6). Its row's menu adds
   **[en:tran:Preview]**, **[en:tran:Open in Chatbot]** (while AI is on) and
   **[en:tran:Open in Default App]** to the usual Rename, Duplicate, Reload, Copy
   Path, Reveal and **[en:tran:Move to Trash]**. A Markdown file dropped on the panel is
   copied into its folder, as a notes file is. 📸
2. Open a note for editing — the **Bible Note** editor opens in its own window. 📸
3. Type your note. Nothing is written to the note file yet — your typing is kept
   in an editing history, and the row of buttons that appears at the bottom
   right of the window is how you decide what happens to it.
4. Press **[en:tran:Save]** (**Ctrl+S**) to write it into the note file.
5. **[en:tran:Undo Saved Change]** and **[en:tran:Redo Saved Change]** walk that
   history — they step through what has been typed, back past a save as well, and they
   still work after the window has been closed and opened again, so an edit made
   by mistake can be taken back. **[en:tran:Discard changed]** throws the
   unsaved typing away, with that history, and returns the note to what was last saved.

::: tip
The arrows at the TOP of the window are the text editor's own undo and redo;
the ones at the bottom are the note FILE's.
:::

Notes for a sermon series can live in a folder of their own: the row under the
**[en:tran:Bible Notes]** title switches between them (W-58).

The help window can change a note for you, or answer how to do something in the
note editor: **[en:tran:Open in Chatbot]** in a note row's menu, or the robot at
the bottom of the Bible Note window (W-60).

_Verify: PR-03, PU-03, KB-11, PM-170, PL-111._

---

## Creating & editing content

### W-15 — Create and edit slides / lyrics / web backgrounds

**Making a new file:** in the **[en:tran:Documents]** list, click the **⋮** in the list header
(or right-click the empty area of the list) and pick **[en:tran:New App Document]** (a slide document) or **[en:tran:New Lyric]** (a song). Type
a name into the row that appears and press **Enter** (or click the ✓). Both kinds live
in the same documents folder. 📸

**Slides** ([en:tran:Slide Editor]):

1. Select a slide document, then click the **[en:tran:Slide Editor]** header tab. 📸
2. Left: the slide list — click to select, drag to reorder. Right-click its empty
   area → **[en:tran:New Slide]**; right-click a slide → **[en:tran:Duplicate]** / **[en:tran:Delete]**.
3. Canvas: click a box to select it; drag to move; drag the handles to resize;
   **double-click a text box** to type into it; **Ctrl+Enter** focuses the canvas. 📸
   (From the **[en:tran:Presenter]**, right-click a slide → **[en:tran:Edit] ↗** opens this editor in its
   own window, focused on that slide.)
4. Add new boxes with the toolbar above the canvas — **[en:tran:New]**, **[en:tran:Insert Medias]**,
   **[en:tran:Insert Media Link]**, **[en:tran:Insert YouTube]**, **[en:tran:Insert Website]**, **[en:tran:Insert Camera]** — or
   the same list from a right-click on the canvas. (The right-hand **[en:tran:Canvas Items]** tab
   is a preview/select list, not a place to drag boxes from.) You can also **drag items
   in from the Background panel** — see W-28.
   **Insert a video from a link.** In the **[en:tran:Slide Editor]**, select the slide, press **[en:tran:Insert Media Link]** above the canvas, paste the direct video address into **[en:tran:Media URL:]**, and press **[en:tran:Ok]**. For a YouTube address, use **[en:tran:Insert YouTube]** and its **[en:tran:YouTube URL:]** box instead, then press **[en:tran:Ok]**. Move or resize the new box on the slide and save with **Ctrl+S**.
   **Insert a camera on a slide.** Select the slide in **[en:tran:Slide Editor]**, press **[en:tran:Insert Camera]**, then select the camera's name from the device menu that opens. Selecting a device adds its camera box to the slide. Move or resize the box and save with **Ctrl+S**. If the app says **[en:tran:No camera found]**, connect a camera and try again.
5. **A website box shows a picture of the page, not the running page.** Open Worship
   takes a screenshot and shows that everywhere you edit, so a service order full of
   web slides stays fast even on an old machine. Two things follow:
   - **Hover the box for about a second** to see the page live; move away and the
     picture comes back. 📸
   - The picture does not update itself. If the page changes (a clock, a countdown, a
     scoreboard), right-click the box → **[en:tran:Refresh Preview]**.

   When you actually present the slide, the audience screen shows the **real, live
   page** — only your editing and preview views use the picture.

6. **Blend a box with the ones under it.** Select a box, and under
   **[en:tran:Shape Properties]** in the right-hand **[en:tran:Properties]** tab (inside
   **[en:tran:Box Properties]** — expand it if it is collapsed) pick a
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

8. **Apply a font setting to several items.** Under **[en:tran:Properties]**, expand
   **[en:tran:Bulk Font]**. Leave **[en:tran:Apply to]** on **[en:tran:All Slides]**
   for the whole document, or pick **[en:tran:Choose slides and items]**. Tick a
   slide to select its text items; expand its **[en:tran:Canvas Items]** list to
   tick individual items. You can combine items from several slides. A partially
   selected slide shows a dash in its checkbox. Text, Bible and HTML items are
   included; media items have no font setting. Locked items stay unchanged unless
   you tick **[en:tran:Include locked items]**. Enter a positive **[en:tran:Font Size]**
   in pixels and press **[en:tran:Apply Font Size]**, or choose a
   **[en:tran:Font Family]** and press **[en:tran:Apply Font Family]**. Each button
   applies only that property, leaving the other styles and positions intact.
   The result reports how many items changed. Each application is one
   **[en:tran:Undo]** step; **[en:tran:Redo]** reapplies it. To change the words'
   colour as well, select the box and click the hex value under
   **[en:tran:Text Properties] → [en:tran:Color]**. Type or paste the new hex color,
   then press **Enter** or click away to apply it (step 9). 📸
9. **Type an exact color.** Select a box, then click the hex value beside
   **[en:tran:Background Color]** (also inside **[en:tran:Box Properties]**) or under **[en:tran:Text Properties] → [en:tran:Color]**.
   Type or paste a hex color, then press **Enter** or click away to apply it.
   Three-, four-, six- and eight-digit hex values work, with or without `#`;
   eight digits include opacity, for example `#2468AC80`. **Escape** cancels the
   unfinished edit. Invalid or incomplete values return to the current color
   without changing the slide. The arrow still opens the swatches and opacity
   slider. **[en:tran:Undo]** / **[en:tran:Redo]** restore and reapply changes. 📸
10. Save with **Ctrl+S**.

**A ready-made look for a box:** select it, and **[en:tran:Presets]** at the top of
**[en:tran:Properties]** offers **[en:tran:Plain]** (no backing, shadow, blend or bold),
**[en:tran:Shadow]** and **[en:tran:Glass Effect]** (not on a picture or a video). A box of
words also gets **[en:tran:Highlight]** and **[en:tran:Urgent Alert]** (bold words) and a
**[en:tran:Dark]** / **[en:tran:Light]** switch: light words for a dark background or dark
words for a light one — the other side trades the lightness of the words and their backing,
each keeping its hue. A look never changes the box's size, place, words or font, and one press
is one **[en:tran:Undo]**. **[en:tran:Save as Preset]** keeps the box's look — from a box of
words its words' style too, and then it is offered to boxes of words only; right-click a saved
one to rename, replace or remove it. 📸

**HTML and plain text:** imported HTML keeps its formatting, but scripts, event
handlers and embedded pages are removed in the editor, previews, screen rendering
and print. Use **[en:tran:Insert Website]** or **[en:tran:Insert YouTube]** for a
page or video embed. A **Text** box displays markup literally and keeps line breaks;
use an HTML box for rich formatting. Existing files are kept as saved.

**Lyrics:** right-click a song in the Documents list → **[en:tran:Edit]** — the Lyric Editor opens
in its own window; edit the text/chords and save with **Ctrl+S**. 📸
Once a song has been changed, the Presenter also shows **[en:tran:Undo]**, **[en:tran:Redo]**,
**[en:tran:Discard changed]** and **[en:tran:Save]** in a row under its **[en:tran:Stage Previewer]**
header — the same row a slide document has above its slides. **[en:tran:Undo]** steps every stage
back at once; **[en:tran:Save]** is lit while a change is not saved yet (a red **\*** beside the
song's name), and **Ctrl+S** saves the song from anywhere in the Presenter.

**Web backgrounds:** **[en:tran:Background]** panel → **[en:tran:Webs]** tab, then the
**⋮ [en:tran:More Options]** button at the right of the folder-path bar (or right-click an
empty part of the list). **[en:tran:Add URL]** asks for a web address and saves it as a new
tile in the tab. **[en:tran:New File]** asks for a name and makes an `.html` page in the
folder; right-click that page → **[en:tran:Edit]** to open the Web Editor in its own window,
its code beside a preview. The Web Editor saves itself as you type, so there is no Save
to press.

_Verify: ED-01..11, ED-21, ED-25, ED-45, ED-46, ED-47, ED-48, ED-52, ED-53, ED-55, PU-02, PU-04, PL-09, PL-11, PL-24, CM-23, CM-27, CM-32, CM-33, CM-43, PM-33, PM-124, PM-168._

### W-43 — Remove a song, document or file (Move to Trash)

**Goal:** get rid of a file you no longer want — a song, a slide document, a PDF, a
background picture or video, a presenting flow, a Bible note — without losing it for good.

No file row has a **[en:tran:Delete]**. Every file row has **[en:tran:Move to Trash]**
instead, and it does what it says: the file goes to your computer's own Recycle Bin (Trash
on a Mac), where it can be brought back if you change your mind.

1. Find the row in its list — a song or slide document in **[en:tran:Documents]**, a picture or video
   in the **[en:tran:Background]** panel, a run sheet in **[en:tran:Presenting Flows]**. 📸
2. Right-click the row, or click the faint **⋮** at its right-hand
   end (W-01b). The row's menu opens.
3. Choose **[en:tran:Move to Trash]** — the last item, with a red trash icon. 📸
4. A small window asks **[en:tran:Moving File to Trash]** — _Are you sure you want to move
   "…" to trash?_ Click **[en:tran:Yes]**. (**[en:tran:No]** leaves everything as it was.)
   A USB flash drive on Windows has no Recycle Bin: there a second window,
   **[en:tran:Delete Permanently]**, asks whether to delete the file for good instead —
   that cannot be undone, and **[en:tran:Cancel]** keeps it.
5. The row disappears from the list. The file, and the small files beside it that remember
   its backgrounds and transitions, are in the Recycle Bin / Trash — open that from your desktop to restore them.

**Not there?** A background item that is **on a screen right now** has no **[en:tran:Move to Trash]**
in its menu — clear it from the screen first (**[en:tran:Clear Background]** on the
Mini Screen panel, W-10), then try again. A slide INSIDE a document is not a file: to
remove one, open the document in the **[en:tran:Slide Editor]** and right-click the slide in the
left-hand list (W-15). A file in the **[en:tran:Resources]** panel has none at all: remove it
from its folder on your computer.

_Verify: CM-06, EX-05, PL-03, PL-20, PM-35._

---

### W-56 — Change a song with the assistant (translate it, add a part, chords, its key)

**Goal:** have the help window change one of your songs for you — put it into another
language, add a verse or a note for the band, change its words, add chords or move it to
another key — without writing the song's own notation.

1. In **[en:tran:Documents]**, right-click a song (a row with the 🎵 note), or click the
   faint **⋮** at its right-hand end (W-01b), and choose **[en:tran:Open in Chatbot]**. 📸
   In the **Lyric Editor**, the robot button left of **Reset** and **Save** does the same
   for the song it shows.
2. The help window opens a chat of its own with the song attached under the box, and a
   card that says what it can change: add a verse or another part, change its words,
   translate it, add chords, change its key, or reorder or remove its parts. 📸
3. Press a button under the card, or type what you want:
   - **Replace the words with …** puts the song into that language in place of its words,
     its title and subtitle too. Do this on a copy (**[en:tran:Duplicate]** in the row's
     menu) when you want both languages: the copy keeps the same parts in the same order,
     which is what **[en:tran:Long Text Show]** needs to show them side by side (W-53).
   - **Add … under each line** keeps the words and writes the translation under each line:
     one song in two languages.
   - The language offered is the one the song's name says, if not English (`Still khmer`);
     else, for a name written in a language other than English, English when the app is
     shown in that language and the app's when it is not; else the one the app is shown in,
     unless that is English: then the buttons say _another language_ and the assistant asks
     which; asked to translate without saying which way, it asks that first.
   - **[en:tran:Add a section]**, **[en:tran:Add chords]**, **[en:tran:Change the key]**:
     the assistant asks for the words or the key when it needs them. A note for the band is
     a part of its own, kept out of the play order and so off the screen -- unless the assistant places it after a part (asked for _after verse 1_, say): placed, it is played there, a slide like any other part.
   - Typed, in your own words: _translate it into Khmer_, _add a verse after verse 2: …_,
     _move it to G_, _take out the bridge_.
   - A word fixed or changed — _fix the typo in verse 1: "grase" should be "grace"_,
     _change "grace" to "mercy" everywhere_, _check the spelling_ — changes those words
     and nothing else: every chord stays on its word and a translation line stays under
     its line. A spelling check leaves an old form such as _'Twas_ alone, and a title that
     holds the word is named in the answer, not changed. _Change the line under the first
     line of verse 1 to …_ changes that translation line alone; _take out the translation
     lines_ takes them all out, the chords kept.
   - Parts and chords — _rename the chorus to Refrain_ renames that part where it stands,
     its chords and lines kept, and every place it plays in the order with it. _Take the
     chords out of the chorus_ (or _remove all the chords from the song_) leaves the words;
     an Instrumental keeps its chords, and the answer says so. _Change every F chord to
     Fmaj7_ changes that chord wherever it is played and leaves F# and F/A alone.
4. The answer says what changed. The change is **not saved yet**: the song shows a red
   **\*** beside its name in **[en:tran:Documents]**. **[en:tran:Undo this change]** under
   the answer puts it back; **[en:tran:Show it in the list]** finds its row.
5. To keep it, press **[en:tran:Save]** in the row under the song's
   **[en:tran:Stage Previewer]** header in the Presenter (**[en:tran:Undo]** there steps it back
   too), or open the song with **[en:tran:Edit]** in its menu and press **Save**. A
   Lyric Editor already open on the song shows the change by itself; if you were typing in
   it at that moment, your typing is kept and the line
   **[en:tran:The assistant changed this song.]** offers **[en:tran:Load the change]**.

**Not there?** **[en:tran:Open in Chatbot]** is in a song's menu only while AI is on
(**[en:tran:Settings]** → **[en:tran:AI Providers]** → **[en:tran:Enable AI features]**). When no
assistant can answer, the chat says so and offers **[en:tran:Open AI settings]**: changing a song
needs one.

_Verify: PL-107, CB-166, PM-168, CB-179, CB-182._

### W-57 — Change slides with the assistant (translate them, restyle them, make slides like a picture)

**Goal:** have the help window change one of your slide documents for you — put its words
into another language or add a language under them, check the spelling, make the words
larger, change colours and layout, add, copy, move or remove slides, or make slides that look
like a picture of slides you like.

1. In **[en:tran:Documents]**, right-click a slide document (a row with the slides icon), or
   click the faint **⋮** at its right-hand end (W-01b), and choose
   **[en:tran:Open in Chatbot]**, right under **[en:tran:Open Slides Preview]**. 📸 In the
   **Slide Editor**, the robot button right of **[en:tran:Undo]**, **[en:tran:Redo]**,
   **[en:tran:Discard changed]** and **[en:tran:Save]** at the bottom of the canvas does the
   same for the document being edited.
2. The help window opens a chat of its own with the document attached under the box, and a
   card that says what it can change, with six buttons. 📸
3. Press a button under the card, or type what you want:
   - **Replace the words with …** puts the slides' words into that language in place of
     theirs; **Add … under each line** keeps the words and writes the translation on the line
     under each line, the words made a little smaller so the box still holds them. The
     language offered is the one the document's name says, if not English; else, for a name
     written in a language other than English, English when the app is shown in that
     language and the app's when it is not; else the one the app is shown in, unless that is
     English: then the buttons say _another language_ and the assistant asks which. Typed,
     say the language: _Add Spanish under each line_.
   - **[en:tran:Check the spelling]** fixes only what is misspelt and says what it fixed.
   - **[en:tran:Make the words larger]** makes every box's words larger in one change, each
     box keeping its size against the others (a title stays larger than the line under it).
     Typed, _Make the words smaller_ or _Make every box 110 px_ do the same. These three the
     help window does by itself, at once — no assistant is needed for them, so they work
     with no AI key and no internet.
   - **[en:tran:Make slides like a picture]**: attach a picture of the slides you want — the
     **⋮** at the left of the box has **[en:tran:Attach a picture of the app]** and
     **[en:tran:Attach a file]** for a picture file — and say
     what the slides should say, e.g. _Add 2 slides that look like slide 2 in this picture:
     one says Welcome, one says Let us pray_ — or send the picture with no words at all.
     Without a picture it asks for one. A photo or video behind the words is the slide's
     **background**, not a box: the assistant puts one of the **[en:tran:Background]** panel's
     own pictures or videos behind the slides, the one whose name fits (_mountain_ finds
     `wp_mountain_reflection.jpg`), and says which. When none fits, drop that picture into the
     **[en:tran:Background]** panel's pictures first and ask again.
   - **[en:tran:Make a song from it]** writes the slides' words out as a new song, done by the
     help window with no assistant asked (W-42 step 18).
   - **Backgrounds** by words: _Put the sunrise picture behind every slide_, _Make slide 3's
     background dark blue_, _Take the background off slide 2_. A background is **kept at
     once** — it is not one of the unsaved changes, and needs no Save — and the slide card
     shows it.
   - _list me more options_ shows the card and its buttons again.
4. The answer says what changed. The change is **not saved yet**: the document shows a red
   **\*** beside its name in **[en:tran:Documents]**. **[en:tran:Undo this change]** under the
   answer puts the whole change back — every slide it touched, and a background it put
   behind them — and
   **[en:tran:Show it in the list]** finds its row.
5. To keep it, press **[en:tran:Save]** in the slides' history row in the Presenter
   (**[en:tran:Undo]** there steps it back too), or in the Slide Editor.

**Not there?** **[en:tran:Open in Chatbot]** is in a document's menu only while AI is on
(**[en:tran:Settings]** → **[en:tran:AI Providers]** → **[en:tran:Enable AI features]**). A PDF,
PowerPoint or Word file carries it too, but only an Open Worship slide document has slides
the assistant can change; to make a song from such a file's words, see W-42 step 18. When no
assistant can answer, the chat says so and offers **[en:tran:Open AI settings]**.

_Verify: PL-108, CB-167._

---

### W-59 — Change a presenting flow with the assistant (build it from your order of service, a clear between items, move on by itself)

**Goal:** have the help window change one of your presenting flows (the running order of a
service, W-22) for you — build it from your order of service, typed or photographed, check
it, put a clear between items, make the songs move on by themselves, and add, move, copy,
park, colour, pin or arm its lines, countdowns and CC elements.

1. In **[en:tran:Presenting Flows]**, right-click a presenting flow's NAME row (its own row
   with its name on it, not one of its lines), or click the faint **⋮** at its right-hand
   end, and choose **[en:tran:Open in Chatbot]**, right under **[en:tran:Open Preview]**. 📸
2. The help window opens a chat of its own with the presenting flow attached under the box,
   and a card that says what it can change, with four buttons. 📸
3. Press a button under the card, or type what you want:
   - **[en:tran:Check the running order]** reads every line and says what is wrong or missing — a song
     whose file was renamed or deleted, a **[en:tran:Jump to]** with nowhere to go, a
     **[en:tran:Keyboard Event]** with no shortcut — and offers the fixes. It changes
     nothing until you say.
   - **[en:tran:Build it from my order of service]**: paste your order of service into the box, or
     attach a picture of the printed bulletin (**[en:tran:Attach a file]** in the **⋮** at
     the left of the box), or both, and the assistant
     adds every item in order — songs and slide documents by their names in
     **[en:tran:Documents]**, Bible passages, a countdown or a notice where the order says
     one. It says which items had no document to match; it never makes up a song.
   - **[en:tran:Clear the screen between items]** puts a **[en:tran:Clear All]** after every song,
     slide document and passage that has none after it.
   - **[en:tran:Move on by itself]** asks how many seconds a slide stays, then gives every song and
     slide document a **[en:tran:Next: Timeout]** that rides along with it (a CC element,
     W-22d), so its slides go on by themselves — one timeout line shared by all of them; a
     song that already moves on by itself has its time changed rather than a second one
     added.
   - Or type it: _Add a 5 minute countdown at the top_, _Make line 2's timeout 10 seconds_,
     _Pin line 3 to screen 1_, _Colour the songs blue_, _Park the sermon_, _Move the
     offering after the second song_, _Add Psalm 23 after line 4_, _Remove the last line_.
   - _list me more options_ shows the card and its buttons again.
4. The answer says what changed. A presenting flow has no Save: the change is **kept at
   once**, and the panel shows it. **[en:tran:Undo this change]** under the answer puts the
   whole change back, and **[en:tran:Show it in the list]** finds its row in
   **[en:tran:Presenting Flows]**.

**Not there?** **[en:tran:Open in Chatbot]** is in a presenting flow's menu only while AI is
on (**[en:tran:Settings]** → **[en:tran:AI Providers]** → **[en:tran:Enable AI features]**). When no
assistant can answer, the chat says so and offers **[en:tran:Open AI settings]**. A video, a picture,
a camera, another screen or a web page on the **[en:tran:Foreground]** is picked in its
panel and dragged in (W-22) — the assistant does not add those from words.

_Verify: PL-109, CB-168._

---

### W-60 — Change a Bible note with the assistant (translate it, tidy it, add verses, ask about the note editor)

**Goal:** have the help window change one of your Bible notes for you — put its words into
another language or add a language under them, check the spelling, tidy it into headings and
lists, add Bible verses — sum it up, or explain how to do something in the note editor; or
have it make a new note for you, about what you are reading or from what it just taught you.

**A new note:** in any chat — a Bible Reader conversation, the chat of a passage, a person or
a place (a Bible view's or a lookup panel's robot), a Resources file's chat, or a note's own —
ask _make a bible note for me_, or, under something the assistant has just taught you, _put
this lesson in a new note_. The assistant writes the note itself — headings, lists, bold, and
the verses it names with their words read from the Bible on this computer — into your
**Default** notes file, even while one of its notes is open in a window. 📸 The note opens in
its own **Bible Note** window and is attached to the chat under the card of step 2, so
everything from step 2 on works on it. **[en:tran:Undo this change]** under the answer takes
the new note away again. The assistant never deletes a note or a notes file: that stays the
row's own **[en:tran:Delete]** (a notes file's **[en:tran:Move to Trash]**).

1. In **[en:tran:Bible Notes]** (W-14), open a notes file, then right-click a note's row, or
   click the faint **⋮** at its right-hand end, and choose **[en:tran:Open in Chatbot]**, right
   under **[en:tran:Open]**. 📸 The note opens in its own **Bible Note** window first, when it
   is not open already. In the **Bible Note** window, the robot button among the buttons
   at the bottom (right after **[en:tran:Toggle Always On Top]**) does the same for the note it shows, after
   keeping what was just typed.

   **About some words of it:** in the **Bible Note** window, select the words — the bar
   that comes up over them ends with a robot, **[en:tran:Ask the assistant about this]**.
   📸 The help window opens on this note — in the chat already on it when there is one,
   else in a chat working in this note's window, else in a new chat with the note
   attached as in step 2 — and puts the words in the box: _Selected text_, the note's
   name and, when they are on one line, where they sit in it (their first and last
   character, like _43-47_), then that line with the selected words between two
   asterisks. The cursor waits on the line under it: write your question there and
   press **[en:tran:Send]**. If you would rather press than write, the card under it asks _What
   would you like to do with “…”?_: **[en:tran:Explain it in simple words]**,
   **[en:tran:Check the spelling]**, **[en:tran:Replace the words with another language]**,
   **[en:tran:Add another language under each line]** and **[en:tran:Uppercase]** ask the
   assistant about those words; **[en:tran:Search Selected Text on Google]** opens a search
   in your browser and **[en:tran:Copy Selected Text]** copies them, with no assistant.
   Select other words and press the robot again: they go under the first ones, in the
   same chat.
2. The help window opens a chat of its own with that one note attached under the box, and a
   card that says what it can do, with five buttons. 📸 The chat works in the note's own
   window: at the top it is asking about **[en:tran:Bible Note]**, and **[en:tran:Working in]** above the box
   names that note's window, so a walkthrough points at the note editor and every change
   shows there as it is made. While the chat works in it, the note's window stays above the
   app's main window, so pressing in the main window or the help window does not hide it;
   the help window and any AI Chat window stay above the note's window. It goes back to
   normal when the chat works in another window or the help window is closed. Other
   programs can still cover it; for that, use its own **[en:tran:Toggle Always On Top]**.
3. Press a button under the card, or type what you want:
   - **Replace the words with …** puts the note's words into that language in place of
     theirs; **Add … under each line** keeps the words and writes the translation under them.
     The language offered is the one the note's title names, if not English; else, for a
     title written in a language other than English, English when the app is shown in that
     language and the app's when it is not (a Khmer note in a Khmer window offers English,
     an English one Khmer); else the one the app is shown in, unless that is English: then
     the buttons say _another language_ and the assistant asks which.
   - **[en:tran:Check the spelling]** fixes only what is misspelt and says what it fixed.
   - **[en:tran:Summarize this note]** sums the note up in the chat; nothing in the note
     changes.
   - **[en:tran:Format it so it is neat and easy to read]** turns a messy note into a
     tidy one in one change, its words kept: the title a heading, the parts (points,
     prayer, questions) headings of their own, points or questions run together on
     one line one item each, a reference written in words (_luke 15 verse 4 to 7_) a
     verse, lines in capitals in normal case and a reminder in bold. _My note is
     messy, can you tidy it up?_ does the same.
   - Text size: _Make the words larger_ (or _make text bigger_), _make the words smaller_
     and _make the words 20 px_ change every part of the note at once, each part
     keeping its size against the others (a heading stays larger than its lines). The
     help window does these by itself, so they work with no AI key and no internet --
     typed in the language of almost any installed language pack, and pressed as a card's
     button in any language.
     _Make only the heading bigger_ and other sizes for one part, the assistant does.
   - Anything the note editor's toolbar does, asked in words: _make the word grace red
     and bold_, _use Georgia for the whole note_, _highlight the verse references_,
     _put the second point in capitals_, _clear the formatting of the first line_,
     _centre the title_, _indent the second bullet under the first_. Name some words
     and only those words change, as a selection in the editor would -- in a language
     written with no spaces (Khmer, Thai, Chinese) too: the word itself, not the same
     letters at the start of a longer word, and never half of a letter with its marks.
     Ask in any language: the assistant answers in it. The **+** Insert
     menu too: _add a table of the readings with book and chapter_, _add a pink sticky
     note saying call Tom_, _put today's date at the top_, _add a poll_, an equation,
     two columns, a collapsible part, a page break, a YouTube video or a website by
     its link, a picture or a file by its link or its place on this computer, and a
     person or place from the names lookup (_mention Moses in the first line_). _Undo
     that_ and _redo it_ step back and forward through what the note has kept. A
     drawing (the Insert menu's **Excalidraw**) is described in words, a box a line and an
     arrow as _A -> B_ (_make a drawing of my three points with arrows_, _draw a timeline
     from creation to Jesus_, _a circle drawing: the sheep wanders off, the shepherd goes
     looking, the sheep is found_); it is drawn top to bottom, or across, round a circle or
     round one box in the middle when asked. A drawing already in the note can be made
     bigger or smaller, its boxes coloured (_colour the boxes green_), centred, moved or
     taken out, and drawn again with a box added or its words changed (_add one more box
     saying The shepherd finds the lost one_). The board draws boxes, words and arrows --
     asked for a picture of a thing (a sheep, a cross), the assistant says it cannot draw
     one and offers a drawing of words. _link the heading to the prayer_ joins the words of two
     parts as the editor's Link block text does; _show the invisible characters_ turns
     on the **¶**; _put the editor's example in_ adds its sample study note; a code block
     takes a language (_make it Python_) and a colour theme. A style for the whole note
     in a short line -- _make all the text bold_, _centre everything_, _use Georgia for
     the whole note_, _clear the formatting_ -- the help window does by itself, with no
     AI key and no internet, as it does the size: all of them in English and in a language whose
     package carries the assistant's words for them, and _make all the text bold_ in most
     other installed languages -- said
     with the word _bold_ where the language's own word for it also means black, and
     left to the assistant where it also means big. The rest, in those languages, the assistant does.
   - Bible verses: _Put John 3:16 in as a passage under the heading_ adds the passage, its
     words read from the Bible installed on this computer — the assistant never types a
     verse itself. A verse can also go in the middle of a line as a verse mention. Asked in
     another language than English, the verse comes from a Bible in that language when one
     is installed and the Bible Lookup is on another (asked in Khmer with the Lookup on the
     KJV, the Khmer Bible's words, in Khmer digits); name a Bible to have another.
   - A preaching lesson: a note that is still empty opens its conversation with three
     buttons — **[en:tran:Help me prepare a preaching lesson]**,
     **[en:tran:Help me prepare a children's lesson]** and
     **[en:tran:Help me prepare a short devotion]** — and the assistant asks which passage;
     or type _help me prepare a sermon on John 10:11-18_ (or _I'm preaching on Psalm 23 this
     Sunday_), in your own language too. It writes a whole lesson into the note,
     ready to preach — the passage printed from your Bible, the big idea, the background,
     an introduction, three points each with its verses, an example and how to live it
     this week, how it points to Jesus, a response, a closing prayer, questions for
     discussion and a memory verse (a short devotion keeps to one point, and a children's
     lesson tells the story in a child's words, printing only the verse or two it turns
     on); beside a note with words in it, or in any other chat,
     the lesson is a new note. With no passage named, the assistant asks which one. Then
     ask as you prepare: _add an illustration to point 2_, _give me two cross references
     for point 1_, _add two more discussion questions_, _write a stronger conclusion with
     an invitation_, _add a short object lesson for the children_, _make a version for the
     children's class_ (a new note). _How long will this take to preach?_ is answered; _is
     this a good sermon?_ is answered as a teacher of preaching would — what is strong, then
     the two or three changes that would most improve it, each a button that makes that
     change, nothing changed until you press one (ask it again after, for the next);
     _finish my sermon_ (or _finish it_)
     adds the parts it lacks, each where it belongs, and keeps your words: a point you
     wrote stays where it is and grows under its own line, and a few loose lines become
     the lesson around them, none of them lost or written twice; _it is too long, make it
     fit 15 minutes_ tightens the
     words and takes the extras out first, every point keeping its verse, an example and
     how to live it; _check that my verses are right_ reads every verse the note cites
     from your Bible and names any line that gives a verse words it does not have.
   - Put an answer into the note: right after the assistant has answered or taught you
     something in this chat, _add it_, _put it in_ or _new section_ adds that answer at the
     end of the note — its headings, points and verses as the editor's own — and _new page_
     puts a page break before it.
   - Questions about the note itself (_what verses does it use?_) or about the note editor
     (_How do I add a sticky note?_, _How do I print this note?_) are answered from the note
     and from the editor's own guide.
   - _list me more options_ shows the card and its buttons again.
4. The answer says what changed. Only the parts asked about are rewritten: the rest of the
   note — its headings, lists, verse mentions, tables, pictures, drawings and sticky notes —
   stays exactly as it was. A table, picture, sticky note or passage can be moved or taken
   out, never rewritten; a drawing the assistant made can also be drawn again, and one you
   drew by hand only coloured, sized or moved. The change is **not saved yet**; a Bible Note window that is
   open on the note shows it at once. **[en:tran:Undo this change]** under the answer puts it
   back, and **[en:tran:Show it in the list]** finds its row. Words you typed to go into the
   note go in letter for letter as you typed them. If the assistant changes the note and
   then stops without an answer, the answer still says the note was changed, with the same
   two buttons under it.
5. To keep it, open the note (W-14) and press **[en:tran:Save]** (**Ctrl+S**); a new title
   asked for in the chat is kept at once, as **[en:tran:Edit Title]** does.

**Not there?** **[en:tran:Open in Chatbot]** is on a note only — not on a verse's highlights
and comments, nor on a note that could not be read — and only while AI is on
(**[en:tran:Settings]** → **[en:tran:AI Providers]** → **[en:tran:Enable AI features]**). When no
assistant can answer, the chat says so and offers **[en:tran:Open AI settings]**.

_Verify: PL-110, CB-169._

---

### W-61 — Change a foreground component with the assistant (a countdown, a marquee, a quick text for a verse)

**Goal:** have the help window set up and change the **[en:tran:Foreground]** extras (W-09)
for you: start a countdown for so many minutes, put a message scrolling along the top, make
a quick text of a Bible verse, and change how one looks or where it sits on the screen.

1. In any chat, type what you want: _Start a countdown for 5 minutes_, _Show the top
   marquee saying Welcome to our service_, _Make a quick text for John 3:16_. The assistant
   writes it into a NEW session of that panel, named after what it holds (`5:00`,
   `Welcome to our service`, `(KJV) John 3:16`). It opens the panel on that session and
   does what the panel's own Show or Start button does on the ticked screens, with the
   panel's own look. A session that already holds the same, or already has that name, is
   used again; what you typed in another session is never written over. A verse is read
   from the Bible the Bible Lookup is on, never from the assistant's memory. A new verse
   quick text gets the **[en:tran:Bible Verse]** preset (W-09), and any component can be
   given one of its own presets by name — _Make the countdown big in the center_, _Use the
   Speaker look_ (W-09 lists each component's). Words that should go away by themselves
   are a quick text with its time and place: _Show a message at the bottom of the screen
   for 15 seconds: the owner of car ABC 123, your lights are on_ puts them up at the bottom
   for 15 seconds. _Put the long text up_ shows the song or words a
   **[en:tran:Long Text Show]** session already holds; they go in on its panel (W-53).
   When the screen is off,
   the answer says so and offers its show button. The assistant never turns a screen on
   by itself. The session it put up or changed is attached to its answer, the same chip
   as step 3, so what you type next is about that one without naming it again: _make it
   bigger and red_, _pause it_, _take it off the screen_.
2. To talk about ONE session of a panel, attach it to the chat:
   - right-click a session's button on the panel's strip (**[en:tran:Default]**,
     **Session 2**), or press the **⋮** on the one you are on, and choose
     **[en:tran:Open in Chatbot]**; 📸
   - or press the robot in the panel's own header, beside its transition button (the **[en:tran:Long Text Show]** panel has none): it
     attaches the session you are on (**[en:tran:Camera Show]** and
     **[en:tran:Screen Show]** have no sessions, so their robot attaches the panel);
   - or, in the help window, press the **⋮** at the left of the box and choose
     **[en:tran:Attach a foreground session]**. It lists the panels open in the Presenter
     with their sessions. Pick one, or several one after another. When no panel is
     open, it says to open one from the **[en:tran:Foreground]** tab.
3. The session is attached under the box as _Quick Text › Session 2_. A card says what the
   assistant can change, with four buttons: **[en:tran:Show it on the screen]**,
   **[en:tran:Make the words larger]**, **[en:tran:Move it to the top]** and
   **[en:tran:Take it off the screen]**. The session goes with every question in that
   chat until you press the **×** on its **[en:tran:Still asking about]** line. Pressing
   the chip outlines its session button in the Presenter.
4. Press a button, or type what you want: _make it red_, _move it to the bottom left_,
   _make the words smaller_, _put a frame round it_, _put it behind the slide_, _make the
   marquee slower_, _pause the countdown_, _make it 10 minutes_, _change it to Psalm 23:1_.
   _Add 2 more minutes_ gives the countdown that is up two minutes more where it stands —
   running, it keeps running; paused, it stays paused with the time added — and never starts
   it over. _Clear everything from the foreground_ takes every extra off every screen, as
   **[en:tran:Clear Foreground]** (F10) does. Asked what is on a screen that is off, the
   answer names what it holds and says the screen is off.
   An attached session is changed in place. What it has on a screen changes at once, and
   its panel shows the new values. A change the component cannot take is refused in a
   sentence naming what it can. For example, a marquee always runs along its edge, so it
   cannot be moved.
5. The answer says what changed. After a session was started, or its words or look were
   changed, **[en:tran:Undo this change]** under it puts the panel's words and look back, and
   the screen as it was: a countdown or a Long Text Show it started comes off the screen
   again (a verse the long text had covered is back up), and a marquee that is up shows
   its old words again. One press takes back every session that answer
   changed (a countdown and a marquee started together come off together), and anything
   else on the screen stays; the window then names each one, saying whether it was taken
   away or is back as it was. Hiding, pausing, adding time and clearing everything
   keep no Undo: the answer says how to reverse them instead (_show it again_, _resume
   it_), and after a clear it names what it took off and offers to put that back. Words
   already put up come off with the panel's Hide button, or by asking _take it off the screen_.

**Not there?** **[en:tran:Open in Chatbot]** and the robots are there only while AI is on
(**[en:tran:Settings]** → **[en:tran:AI Providers]** → **[en:tran:Enable AI features]**). The panels
belong to the Presenter, so the assistant works on them while the main window is on the
Presenter. A video, picture or web page is named by a file in that panel's own folder,
and a camera by its name; the assistant never picks a file from elsewhere on the computer.

_Verify: PM-174, CB-172, CB-183._

---

### W-62 — Make a song from a PowerPoint, Word, PDF or slide file with the assistant

**Goal:** turn the words of a song someone typed into a PowerPoint (or a Word file, a PDF or
one of the app's slide documents) into a song of your own without typing it again, and keep
the font its slides were set in.

1. The file must be in the **[en:tran:Documents]** list, in the Presenter's left column: that
   is the list the help window looks in. 📸
2. In the help window (the 🤖), type _make a song from my PowerPoint_ and press **[en:tran:Send]**. The
   window answers by itself, with no assistant asked: _Which file should I make the song
   from? Press its name, or type its number._ over the PowerPoint files in
   **[en:tran:Documents]**. `/lyric-from` does the same with every PowerPoint, Word, PDF and
   slide file listed. 📸
3. Press a file's name, or type its number. A file named in the question (_make a song from
   Hymns 21&22.pptx_) is read straight away, with no list.
4. The answer is the song, written out in a box exactly as it will be saved, before anything
   is written: its title and parts, what had to be guessed, the headings at the top of the
   slides that were left out of the words, and the font its slides were set in — _Every
   stage shows it in …, the font of its slides._ 📸
5. Press **Create "…"** to add it to your songs, or **[en:tran:Copy song text]** to paste it into the
   Lyric Editor yourself. Created, it is in **[en:tran:Documents]** —
   **[en:tran:Show it in the list]** finds its row — and every stage draws it in the font of
   its slides; **[en:tran:Song Font]** in Stage Style changes that (W-05 step 14).
6. A file whose pages are pictures, or whose words are in a font that does not copy, has no
   words the app can read: the window says so and offers
   **[en:tran:Read the words off the pictures]** instead. 📸

_Verify: CB-188, PM-179._

---

### W-63 — Change the screens with the assistant (the Bible text's look, another version, a transition, the display)

**Goal:** have the help window change what a screen's Mini Screen card and the Bible text
panel set — the size, colour and style of the Bible text on the screens, a second Bible
beside the verse that is up, a transition, the stage, which screens get what you put up, a
new screen — and tell you which display each screen is on and what it shows, without finding
the control yourself.

1. Keep the main window on the **[en:tran:Presenter]**: the screens belong to it. With a
   passage up on a screen (W-06), type in a chat what to change and press
   **[en:tran:Send]**: _Make the Bible verse on the screen bigger_, _The verse on the
   projector is too small, people at the back can't read it_, _Give the Bible text a thick
   black outline_, _Put the lines of the verse closer together_, _Set the Bible text style
   back to normal_. The assistant reads the screens first, then changes the Bible text the
   way the Bible text panel's own controls do (W-07). That look is one for every screen.
   The answer says in a sentence what changed, and **[en:tran:Undo this change]** is under
   it. 📸
2. What you type next under that answer is about the screens too, without naming them
   again: _Change its colour to yellow_, _Make it bold and give it a shadow_, _Centre it_.
   _Undo that_ puts the change before it back.
3. A second Bible beside the verse that is up: _Add the … Bible to the verse on the screen so
   both versions show_, naming a Bible installed here — by its language, for example. It
   goes after the versions already up, the way Shift+click on the screen card's version
   menu adds one. Then _Which Bible versions are on the screen now?_, _Line the two
   versions up verse by verse_, and _Take the … one off again_.
4. Transitions: _Change the slide transition to zoom_ changes it on the ticked screens and
   says which screens kept theirs; _Turn the background transition off_; _What transition
   does each screen use now?_ names each screen's slide, background and foreground
   transitions (W-48).
5. The screens themselves (W-10, W-18): _Check the display: which monitor is each screen
   on?_ and _Is anything showing on the projector right now?_ are answered from the screens
   as they are, each by its number. _Use stage 1 on screen 1_; _Only work with screen 1 for
   now_ ticks screen 1 alone, so what you put up next goes there; _Take the Bible off
   screen 0_ clears that screen's passage. _Add a new screen for the stage_ adds one the way
   the Mini Screen menu's **[en:tran:Add New Screen]** does: it is off and not ticked, the
   answer says its number, and **[en:tran:Undo this change]** takes it away again.

**Not there?** The screens belong to the Presenter: ask while the main window is on it.
Asked HOW to do something (_How do I add a second version?_), the assistant answers with the
steps, as for any question.

**In another language:** a line like these typed in a language installed on the
**[en:tran:Languages]** tab is taken as one about the screens too, whichever language the
app is shown in.

**No assistant just now?** When none can answer (the hourly limit paused it, for example),
nothing is changed by itself, and a line like these is answered with the setting it is about
as each screen has it now: the monitor it is on, the transitions, whether it is locked, the
groups, the Bible versions, Line Sync, the size of the Bible text, the stage or which screens
are ticked. Then comes what each screen is showing, and under the answer the button that
makes the change, named the way the screen card and the Bible text panel name it, with the
screen's number first when there is more than one screen: **[en:tran:Make the words larger]**,
**[en:tran:Bold]**, **[en:tran:Lock]**, **[en:tran:Slide transition]: zoom**, **Add …** for a
Bible installed here, **[en:tran:Clear Long Text]**. Press it: the answer says the setting as
it is now (a look other than the size, such as bold, a colour or centring, says just _Done._),
with **[en:tran:Undo this change]** under it. A line typed under that answer —
_Centre it_ — gets its button too. _Add a new screen_ gets **[en:tran:Add New Screen]**:
pressed, the answer says the new screen's number, the display it is on and which screens are
ticked. A question that names no value, a change that is already
so, a locked screen's passage and a Bible not installed get no button; then ask again when an
assistant can answer, or ask how to do it yourself.

_Verify: CB-192, CB-193, CB-194, CB-195, CB-196, CB-197._

## Configuration

### W-16 — Settings: language, theme, fonts, folders

**Goal:** configure the app.

1. Click the **gear** ([en:tran:Setting]) in the header — Settings opens in its own window,
   on **[en:tran:Path Settings]** the first time, and on the tab you last used after that.
   **[en:tran:App Assistant]** above
   **[en:tran:Apply Settings]** at the bottom-left opens the help window, to ask about
   any setting. 📸
2. **[en:tran:General]** tab (the language is chosen on the **[en:tran:Languages]**
   tab, step 4a):
   - **[en:tran:Theme]:** system / light / dark.
   - **[en:tran:Font Family]:** the font the app's own windows are drawn in — not the text on the audience screen. The list starts
     with the app's own fonts, which no computer has installed: each enabled language's own face first (`app-Google-Sans`,
     `app-Battambang` -- the face that language's Bible text is drawn in), then the fonts the languages ship under their own
     names (Google Sans, Battambang, a sticky-note hand), then the computer's fonts. Every font list in the app starts the same
     way: the Slide Editor's, the foreground **[en:tran:Properties]**, **[en:tran:Bible/LongText Properties]**, the Lyric
     Editor's (a section per language, above the computer's) and the Bible Note editor's two font boxes (its main box sorts
     its fonts by name, which puts the `app-` faces first). A language installed or turned on is in every list the next time
     a list is opened. A font marked `(Missing)` is
     configured but neither installed on this computer nor shipped by an installed language. When the chosen font comes in more
     than one weight, a second list beside it picks one (`400 Regular`, `700 Bold`…);
     **[en:tran:Default]** keeps the font's own weight.
   - **Reset button** (**[en:tran:Clear All Settings]**):
     **this erases configuration; use with care.** It asks for confirmation first.
   - **Help → Factory Reset** in the menu bar is the way back when a setting has
     broken the app so badly that Settings cannot be opened at all: it works with
     every page blank. It asks first, naming the data folder in use, then closes
     the app and opens it again with every setting as on a new install — the
     language, the chosen data folder, window positions, screens, AI keys and
     sign-ins included — and it cannot be undone. Documents, songs, Bibles and
     installed languages are not deleted: the app opens on
     **[en:tran:No Parent Directory Selected]**, and choosing the same folder
     again under **[en:tran:Path Settings]** brings them back.
   - **[en:tran:Show Tips of the Day automatically]:** controls whether each app window shows
     its own automatic tip after the next app launch.
   - Panel sizes are no longer reset from here — see **W-31**.
2a. **[en:tran:Path Settings]** tab (below **[en:tran:Languages]**): where everything
    lives on disk.
   - **Directories:** where documents, lyrics, and bibles are stored on disk. A data
     folder is required: everything you make and set up — songs, slides, Bibles, notes
     and most settings — is kept in it, so it can be backed up, carried on a stick and
     found again. Until one is chosen, every window but Settings shows only
     **[en:tran:No Parent Directory Selected]**, **[en:tran:Go to Settings]** and
     **[en:tran:App Assistant]**, and Settings opens on this tab by itself, with only
     **[en:tran:General]** (the theme), **[en:tran:Languages]** (the language) and
     **[en:tran:AI Providers]** beside it.
     Under **[en:tran:Parent Directory:]**, **[en:tran:Suggested]** offers
     `.owa\open-worship-data` in your user folder: **[en:tran:Use This Folder]** makes
     it if it is not there and uses it. **[en:tran:Found Data Folders]** lists the data
     folders at the top of this computer's drives — one on a stick — each with
     **[en:tran:Switch]**. Nothing is chosen for you. A chosen folder that is not there
     — a stick not plugged in — counts as none; plug it in and press
     **[en:tran:Apply Settings]**. A data folder on the Desktop is never suggested; while
     one is in use, every window shows the card
     **[en:tran:Move Your Data Folder Off the Desktop]**, which says the Desktop is not a
     safe place for it, with **[en:tran:Move Now]** and **[en:tran:Hide for 30 days]** —
     see **W-54**.
   - **[en:tran:Copy Data Folder]** (under **[en:tran:Parent Directory:]**, while a
     folder is in use): choose a USB stick, another drive or any folder, and a whole
     copy is made there as `open-worship-data`, every file counted and checked. Links
     inside it point at the copy itself, so the copy never reads or changes the
     original's songs and pictures. The folder in use is not changed; the app then
     offers to **[en:tran:Switch]** to the copy.
   - **To keep everything somewhere else**, press the folder line
     under **[en:tran:Parent Directory:]** (the folder in use) and a box opens under it: type the
     folder's whole path (starting with the drive, like `D:\`, or with `/`) and press
     Enter, or press **[en:tran:Choose a folder]** and pick it. A typed folder that is
     not there yet is asked about first (**[en:tran:Create Data Folder]**) and made only
     with **[en:tran:Create]**; emptying the box changes nothing.
     The app asks **[en:tran:Set according paths]** once, and **[en:tran:Yes]** makes the
     standard folders (Documents, Videos, Images and the rest) inside it, uses them and
     reloads. What you already have is not moved. It stays in the old folder, where
     **[en:tran:Recent Folders]** below takes you back, or a backup brings it along (W-25).
   - **To switch back to a previous data folder.** In **[en:tran:Path Settings]**, under **[en:tran:Parent Directory:]** → **[en:tran:Recent Folders]**, press
     **[en:tran:Switch]** beside the folder, then confirm with **[en:tran:Switch]**
     in the **[en:tran:Switch Data Folder]** dialog. Every open window reloads onto
     that folder automatically. The list shows this computer's previously used
     folders, newest first, excluding the one in use. A folder that is not there
     (a stick that is not plugged in) reads **[en:tran:Missing]** and cannot be
     switched to. **✕** takes a folder off the list; the folder itself is not
     touched. The list keeps the last 10 and appears once a second folder has
     been used. 📸
   - **[en:tran:Repair Links]** (beside **[en:tran:Reset All Child Directories]**): after you
     bring the data folder from another computer — a USB stick, a copied folder — press
     it once. Pictures, videos and songs still pointing at where the folder USED to be
     are pointed at where it is now; a link to something that still exists is left as it
     is. A box says how many links it repaired, and the app reloads to show them. 📸
   - **Reset button** (**[en:tran:Reset All Child Directories]**):
     **this erases configuration; use with care.** It asks for confirmation first.
3. **[en:tran:Bible]** tab: import a Bible XML from a file or URL, edit installed XML Bibles,
   or export/import a **[en:tran:Bible Data]** archive. The old online version list is
   development-only and can be unavailable. 📸
   **An installed Bible has no on/off switch.** Every Bible in that list is offered
   wherever a version is chosen. To stop one being offered, take it off the computer: the
   trash icon on its row, **[en:tran:Move to Trash]**, opens a confirmation titled
   **[en:tran:Delete Bible XML]**. Press **[en:tran:Yes]** in that dialog to send
   its file to the Recycle Bin, from where it can be brought back or imported again. (A data
   folder on a USB flash drive under Windows has no Recycle Bin; there a
   **[en:tran:Delete Permanently]** box follows, and that cannot be undone.)
4. **[en:tran:AI Providers]** tab: the AI master switch, the provider keys and the
   custom servers — see **W-42**.
4a. **[en:tran:Languages]** tab: the language the app is shown in, the languages on
    this computer, turned on or off, and the ones to install (those two — see **W-55**).
   - **[en:tran:Language]** (at the top): click **English** or
     another language you installed — the list holds the languages turned on under
     **[en:tran:Installed Languages]** just below it. Each language is listed under its
     OWN name, whatever locale you are currently in — so if a mis-click leaves you in
     a script you cannot read, the way back is still legible. (Hover a button and its
     `title` gives the English name.) The switch is applied at once: every open
     window reloads in the language you clicked, with nothing more to press —
     **[en:tran:Apply Settings]** is not needed for it. Clicking the language already
     in use does nothing. Unsaved edits in the Slide Editor are kept. The language belongs to this
     computer, not to the data folder: switch to another data folder and the app stays
     in the language you chose. A language written right to left (Hebrew) keeps the
     windows laid out as they are in English: each label reads right to left, and a
     Bible, a file name or a word in English keeps its own direction. 📸
5. Click **[en:tran:Apply Settings]** (bottom-left) to apply — the app windows reload.
   A change on the **[en:tran:Languages]** tab applies itself (step 4a, W-55).

_Verify: ST-01..ST-09, ST-20, ST-22, ST-52, ST-54, ST-55, ST-58, ST-83..ST-86, ST-87, ST-92, CB-163, LT-02..04._

### W-58 — Keep songs, running orders, Bible lists and notes in more than one folder (folder sessions)

**Goal:** keep this Sunday's songs, last Easter's set or a sermon series' notes in folders
of their own, and switch between them from the list itself — without re-pointing the
folder the app was set up with.

1. Under the title of **[en:tran:Documents]**, **[en:tran:Presenting Flows]**,
   **[en:tran:Bibles]** and **[en:tran:Bible Notes]** is a row of small buttons:
   **[en:tran:Default]** and a **＋** (**[en:tran:Add Session]**). 📸 **[en:tran:Default]**
   is the folder the list has always shown — the one **[en:tran:Path Settings]** names
   (W-16) — and nothing on this row ever changes it.
2. Press **＋**. A **Session 2** button appears and is the one you are on; its list is
   empty and says **[en:tran:No directory selected]**.
3. Give it a folder: press **[en:tran:Choose a folder]** and pick one, or press the folder
   line above the list, type the folder's path and press Enter.
   **[en:tran:Select Default]** points it at the list's usual folder instead. The list now
   shows that folder's files, with a sort and filter of its own. 📸
4. Press **[en:tran:Default]** to go back and **Session 2** to come again — the app
   remembers the one you were on.
5. The **⋮** on the session you are on (or a right-click on any of them) has
   **[en:tran:Rename Session]**, and on every session but **[en:tran:Default]**
   **[en:tran:Remove Session]**, which asks first. Removing forgets the session and its
   folder setting — the files in that folder are never touched. **[en:tran:Default]** can
   be renamed, never removed.

What follows the session you are on:

- a song or a slide document opened with **[en:tran:Edit]**, and a Bible note opened from
  the list, opens from that session's folder;
- what you make from somewhere else lands in it — a song or slides made from a Bible
  passage (W-06), a verse saved from **[en:tran:Bible Lookup]** into the **Default** list
  of **[en:tran:Bibles]**, a song or slides the assistant writes (W-42, W-56, W-57), and a
  file you import (W-23, W-22j, W-24, W-41);
- a session's folder outside the data folder is watched like the data folder, so a file
  copied into it shows up in the list.

What does NOT follow it: your highlights and comments on Bible verses (W-40) are always
kept in the **Default** session's notes, so switching **[en:tran:Bible Notes]** never hides
them, and the Reader marks a verse that has notes from both the **Default** session and the
one you are on. The Presenter and the Bible Reader keep their **[en:tran:Bibles]** sessions
apart, as they keep their folders apart.

Steps 1–5 were observed live 2026-11-07 on the dev Presenter: the row under all four
titles; **＋** on **[en:tran:Documents]** making **Session 2** with
**[en:tran:Choose a folder]** in its empty list; a typed folder listing its song and slide
document; **[en:tran:Edit]** on each opening it from that folder (the Lyric Editor and the
Document Editor); **[en:tran:Default]** bringing the usual list back; and
**[en:tran:Default]**'s menu offering **[en:tran:Rename Session]** alone. Unit-tested, not
seen live: a verse saved from Lookup into a session's list, a song made from a passage into
a session, verse marks staying in the **Default** session's notes, and the Lookup popup's
**[en:tran:Bibles]** row following the right column's.

_Verify: PM-170, PM-171._

### W-55 — Find and install a language (Settings → Languages)

**Goal:** show the app in your own language, or stop offering one you never use.

English is part of the app. Every other language is a
separate package, installed from the list Open Worship publishes online. An installed
language is kept in your data folder, under `lang`.

1. Open Settings (the **gear**, W-16) and choose the **[en:tran:Languages]** tab. Its
   first section, **[en:tran:Language]**, holds the buttons that choose the language the
   app is shown in (W-16 step 4a). 📸
2. **[en:tran:Installed Languages]** lists every language on this computer, each under
   its own name with its English name beside it, its version, and
   **[en:tran:Installed]** (you installed it). English is first, reads
   **[en:tran:Built in]**, and is always on. To see where a language is kept, press
   the folder icon (**[en:tran:Reveal Folder]**) on its row: your file manager opens
   on its folder, and nothing in the app changes.
3. **To stop offering a language**, turn its switch off. It is no longer offered under
   **[en:tran:Language]** at the top of this tab (or anywhere else a language is
   chosen) and its row reads
   **[en:tran:Turned off]**. If the app was shown in it, the app goes back to English.
   Turn the switch on to offer it again. Either way every open window reloads at once
   to follow; there is nothing more to press. Every change on this tab — turning a
   language on or off, installing, updating, deleting, importing, choosing one — is
   applied that way, without **[en:tran:Apply Settings]**.
4. **To install a language**, type its name into **[en:tran:Search languages]** under
   **[en:tran:Find a Language]** — in English (`hebrew`) or in its own words — and press
   **[en:tran:Install]** on its row. Once it is installed every open window reloads, and
   it is listed under **[en:tran:Installed Languages]**. The list needs the
   internet; with none it says it could not be reached, and **[en:tran:Refresh]** (the
   round arrow) tries again.
5. **To show the app in it**, press the language's button under **[en:tran:Language]**
   at the top of this tab: every window reloads in it (W-16 step 4a).
6. **When a newer version is out**, its row shows **[en:tran:Update to]** with the new
   number, and the section reads **[en:tran:Update Available]**. Press it: the new
   version replaces the old one, and every window reloads with it.
   You do not have to come looking: a few seconds after the app starts, it checks the
   languages you installed against the list once, and when one has a newer version a
   small amber dot appears on the **gear** at the top right of the window. Follow the
   dots — in Settings one stands after **[en:tran:Languages]**, another after
   **[en:tran:Installed Languages]**, and one on the language's own row. They go away
   once it is updated. With no internet nothing is checked and no dot appears.
7. **To delete a language you installed**, press the trash icon on its row and confirm
   with **[en:tran:Delete]** in **[en:tran:Delete Language]**. Every window reloads; if
   the app was shown in the deleted language, it is in English again. When some of the
   language's files are still in use, nothing reloads: a message says to close the app
   and press it again to finish, and **[en:tran:Apply Settings]** turns amber for what
   did change.
8. **To pass a language on to a computer with no internet**, press the download arrow
   (**[en:tran:Download]**) on its row under **[en:tran:Find a Language]**. The language
   is saved as a file into your Downloads folder, which opens on it — named like
   `es-0.0.1.tar.gz`. Copy it to the other computer (a USB stick, a shared folder).
   There, press **[en:tran:Import]** at the top right of **[en:tran:Installed Languages]**
   and choose the file: it installs as if from the list, every window reloads, and it
   is listed under **[en:tran:Installed Languages]**.
   The app first checks the file against the list Open Worship publishes. When it
   cannot — the file was changed, or there is no internet to check with — it asks
   before installing: a language carries code the app runs, so press
   **[en:tran:Import]** only for a file from someone you trust, otherwise
   **[en:tran:Cancel]**. A file that is not a language this app can install is refused
   with a message saying so.

Steps 1–7 were observed live on 2026-11-04 in the development app, with Hebrew from the
development list: found by `hebr` and by its own name, installed, shown right to left,
updated, deleted while in use (back to English), and French turned off and on. Step 8
was observed live the same day: Spanish saved to Downloads by its download arrow,
imported from that file (installed again, nothing left behind), and a changed copy of
it asked about first. The dots of step 6 were observed live on 2026-11-05 on a fresh
development profile holding an older Khmer: on the gear, after **[en:tran:Languages]**,
**[en:tran:Installed Languages]** and Khmer's row, all gone after its
**[en:tran:Update to]**. The reload at once was observed live on 2026-11-05 in the
development app for steps 3, 5 and 6: French to English and back reloaded the Presenter
and Settings in the new language, Settings back on this tab; Khmer turned off and on
again reloaded them too; and **[en:tran:Update to]** on Khmer, then on French (the
language in use), reloaded them once each update was in — **[en:tran:Apply Settings]**
never lit. Install, delete and import call the same reload once they succeed (unit
tested; not driven live, to keep the installed languages as they were). The folder
icon of step 2 was observed live on 2026-11-06 in the development app: on every one
of the forty installed rows, beside the trash icon; Khmer's opened the file manager
on the data folder's `lang` folder with Khmer's own folder chosen, and nothing
reloaded.

_Verify: ST-87, ST-88, ST-89, ST-90._

### W-17 — Find text anywhere (Find bar) & About

- **Find bar:** press **Ctrl+F** (**⌘F** on macOS) or use **Edit → Find** in the app
  menu bar. A slim bar drops in at the **top-right of the window itself** and searches
  only that window. Each of these has its own: the Presenter, Slide Editor, Bible
  Reader, Screen Mirror and Settings, the About and Local Web Share windows, the Web
  Editor and Lyric Editor, the help window (🤖) and **[en:tran:AI Chat]** (✨) — where it searches
  the website's own words too, Khmer included. The screens (nothing to search on a
  projector) and the bible note (it has its own search) have none. In the Web Editor
  the bar finds only the lines the editor is showing, so scroll to the rest. There and in the
  Lyric Editor, **Ctrl+F** pressed while you type in the code opens the editor's own search
  box instead. 📸
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

_Verify: PU-01, PU-05, PU-07, PU-21, PU-22._

### W-18 — Use more than one screen (multi-screen)

**Goal:** project different (or the same) content to several displays.

1. **Right-click** an empty area of the mini-screen panel and choose
   **[en:tran:Add New Screen]** — a second preview card appears with its own number and color. 📸
2. Point the new card at the display it should fill with the **[en:tran:Display]** button in its
   footer (W-10), then turn it on with its own show/hide button. Every card has its own
   clears, transitions and lock too.
3. Content goes to every **selected** screen. To stop one screen receiving content
   without deleting it, right-click its card and choose **[en:tran:Deselect]**, and
   **[en:tran:Select]** there takes it back. **[en:tran:Solo]** does something else. It makes that
   card the ONLY selected one, so every other screen stops receiving. A screen that is not
   selected keeps what it last showed, and that, or an item dropped on one card (step 4),
   is why two screens can show different things. Select every card — right-click one
   that is not and choose **[en:tran:Select]** — and present the item again to put the
   same thing on all of them.
4. You can also **drag** a slide, background item, or foreground Show button and
   **drop it on one specific card** to present it on that screen only. 📸
5. A Bible passage shown in more than one version is drawn as one column per version, and
   the columns keep together: scroll one of them on the card — the wheel, its scrollbar or
   the auto-scroll button — and the others move to the same verse, on the screen it shows
   as well. To line the versions up verse by verse, in rows, right-click the card of the screen showing it and
   choose **[en:tran:Set Line Sync]** — one screen is all it needs, and a screen already
   showing changes with its card at once — and
   **[en:tran:Unset Line Sync]** goes back to columns. Its scrolling follows the card either way.
6. Right-click a card → **[en:tran:Delete]** removes a screen you no longer need (a screen
   can't be deleted while it is the only one).

_Verify: SP-04..05, SP-10..12, SP-33._

### W-19 — Draw and spotlight on the app itself (Presenting Control)

**Goal:** annotate **the app window** — not the audience screen — while showing the app
to other people (a training session, a screen share, a projector mirroring your laptop).
The audience screen has its own Draw and Focus tools on the mini-screen card (W-10);
this is the same pair of tools pointed at the app.

1. Open the **Tools** menu → **[en:tran:Start Controlling]**, or press **Ctrl+Shift+P**
   instead (**⌘+Shift+P** on Mac) — one or the other. **Every window of the app answers it** — the Presenter, the Bible Reader, the
   Slide Editor, a Bible Note, Settings, the Web Editor, the Lyric Editor, Local Web
   Share and Screen Mirror — and the one you are looking at is the one that gets the panel. (The projector
   output, the About box, the Find bar and the help window deliberately do not: an overlay on what the
   congregation sees is the one place this must never appear. AI Chat and the Markdown
   preview have none either.) The menu bar is hidden on
   the smaller windows, so the shortcut is the way in there.
   A floating **[en:tran:Presenting Control]** panel appears — drag it by its title bar,
   resize it from any edge or corner, double-click the title bar to fill the window (and
   again to put it back), and collapse it with the chevron once a tool with settings is
   showing; it reopens where and how you last left it. 📸
2. The **title bar** carries everything you reach for mid-presentation: the four tools on
   the left, then the **keyboard screencast** switch (W-20) and **[en:tran:Undo]** / **[en:tran:Redo]** /
   **[en:tran:Clear drawing]** on the right. Only the settings live in the body, so collapsing the panel
   with the chevron leaves every group one click away — roll it up to get the sliders out
   of the way and keep drawing.
3. The panel opens on the **arrow** tool — the app stays completely usable and
   anything already drawn stays visible on top of it. The arrow has no settings of its
   own, so on it the panel is **just its title bar**: no empty body sitting over the app
   you have just asked to have back, and no chevron either, because there is nothing to
   roll up. Pick the brush, eraser or spotlight and the body opens again at the size you
   last left it.
4. Click the **brush** to draw. A thin teal frame around the window shows the app is no
   longer taking clicks; drag anywhere to draw. Pick **[en:tran:Color]**, **[en:tran:Size]** (`[` / `]`) and
   **[en:tran:Opacity]** (`-` / `=`), and switch the stroke style with **[en:tran:Straight]** (`S`), **[en:tran:3D]**
   (`3`) or **[en:tran:Dots]** (`D`). **[en:tran:HQ]** (`Q`) trades smoothness for speed on weak machines. 📸
5. Click the **eraser** to rub parts of the drawing out, and use the title bar's
   **[en:tran:Undo]** / **[en:tran:Redo]** (`Ctrl+Z` / `Ctrl+Shift+Z`) to step back or the red **[en:tran:Clear drawing]** (`C`)
   to wipe it — one Undo brings a mis-hit Clear back. All three grey out when there is
   nothing to undo, redo or clear, and all three keys work from any **armed** tool (brush, eraser or
   spotlight) and with the panel **collapsed**. On the arrow tool those keys go to the app
   instead, and only the buttons act on the drawing.
6. Click the **spotlight** to dim the whole app except a circle. In **[en:tran:Follow]** (the
   default) the circle simply tracks your pointer; press the **[en:tran:Follow]** button itself (`H`) and it reads
   **[en:tran:Hold]**, which dims only while the mouse button is down. **[en:tran:Contrast]** (`X`) inverts it — the
   circle becomes the blocked area instead. Size, dim amount and **edge
   blur** (`,` / `.`) have sliders, and **[en:tran:Dim color]** picks the colour of the dimming.
   Brush and spotlight both open on **[en:tran:Presets]**, as on the Mini Screen (W-10). 📸
7. The **camera** at the end of the title bar takes a picture of the app **as it looks
   right now** — your drawing, your spotlight and all — and asks what to do with it:
   **[en:tran:Ask the assistant about this]** opens the help window with the picture already
   attached, so "what is this?" is one press and one sentence; **[en:tran:Copy]** puts it on the
   clipboard; **[en:tran:Save into your images]** puts it in the Background Images folder, where
   it can then be presented like any other picture. The help window itself never appears
   in the shot, even when it is sitting on top of the app. 📸
8. Press **Escape** (or click the arrow) to hand the app back while keeping the
   drawing on screen. Move the panel if it covers what you are pointing at.
9. Click **✕** in the panel header to finish. The drawing is discarded; it is not saved
   between sessions. **Ctrl+Shift+P** and **Tools → [en:tran:Start Controlling]** are a toggle:
   pressed again while the panel is open, they close it — and the drawing goes with it,
   exactly as **✕** does. While a drawing tool is armed the shortcut does nothing — the
   keyboard belongs to the drawing then: press **Escape** first, or use the menu entry,
   which closes the panel either way.

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

_Verify: CB-30 (the snapshot), PC-33 (every window), PC-34 (the brush's and the spotlight's
Presets). The rest is still pending — the matrix lives at `docs/test-paths/coverage-matrix.md`,
whose `PC-xx` (presenting-control) block holds PC-33 and PC-34 alone; add the rest for this
workflow._

### W-20 — Show the keys you press (Keyboard Screencast)

**Goal:** let the room see **which keys you are pressing** while you demonstrate the app —
a training session, a screen share, a recorded tutorial. It is the keyboard counterpart to
the drawing in W-19, and it lives in the same panel.

1. Open the **[en:tran:Presenting Control]** panel (W-19 step 1: **Tools → [en:tran:Start Controlling]**,
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
Videos / Audios folder, without leaving the app. The download tools are not built into the
app: the first time, a **[en:tran:Media Tools Required]** box asks before anything is
downloaded — **[en:tran:Download and Install]** installs them once and the download goes on
by itself. When a newer version of them has come out, an **[en:tran:Update Available]** box
asks first: **[en:tran:Update]** updates them and then downloads, **[en:tran:Not Now]**
downloads with the ones you have. They are also kept up to date in **[en:tran:Setting]** →
**[en:tran:Others]** → **[en:tran:Extra Binaries]**.

1. Open the **[en:tran:Background]** panel (W-08 step 1) and choose the **[en:tran:Videos]** tab — or the **[en:tran:Audios]** split if you want the sound only.
2. **Right-click an empty part of the list** (or use the ⋮ [en:tran:More Options] button at
   the right of the folder-path bar) and choose **[en:tran:Download From URL]**. 📸
3. A small box asks for the link — **[en:tran:Video URL:]** on the Videos tab, **[en:tran:Audio URL:]** on
   Audios. If you copied the link first, it is **already filled in**; otherwise paste it.
   The box is only outlined red — with **[en:tran:Cannot be empty]** under it — once you
   have typed in it and emptied it again.
4. Click **[en:tran:Ok]**. The download runs in the background — a full song or video takes a
   couple of minutes, and you can keep using the app while it does.
5. When it finishes, the file **appears in the folder you were in**: the video shows up as
   a new thumbnail in the Videos tab, the audio as a new row under **[en:tran:Audios]**. 📸 From there
   it behaves like any other background (W-08) or track (W-09).

> Notes: audio is always converted to **MP3**, video keeps the site's best quality
> (`.webm`/`.mp4`). If a file with that name is already in the folder, the new one is
> saved as `name (1)`. Pasting something that is not a web link gets you an
> **[en:tran:Invalid URL]** message and nothing is downloaded. Downloads need an internet connection — and
> a busy site can cut a large download off partway, in which case just try again.

> **A download that fails leaves nothing in your folders.** The app downloads into the
> computer's own temporary folder and takes its unfinished pieces away when the download
> fails (you are told why under **[en:tran:Download From URL]**). Only when the app was
> closed in the middle of a download can a file named `temp-…` be left in that temporary
> folder: nothing in the app uses it, and it is safe to delete once no download is running.

> **A computer with no internet** can get the download tools from one that has them.
> There, open **[en:tran:Extra Binaries]** and press **[en:tran:Export]** (it is there
> once the tools are installed): they are saved as one file into your Downloads folder,
> which opens on it, named for the kind of computer they run on — `bin-0.0.4-win.tar.gz`
> (`win`, `mac`, `linux` …). Copy it across, then on the other computer press
> **[en:tran:Import]** in the same place and choose it. A file for another kind of
> computer is refused. The app checks the file against what Open Worship publishes, and
> when it cannot — the file was changed, or there is no internet to check with — it asks
> first: the tools are programs the app runs, so press **[en:tran:Import]** only for a
> file from someone you trust.

> **When newer tools are out**, the app says so by itself: a few seconds after it
> starts, it compares the installed tools with what Open Worship publishes, and a small
> amber dot appears on the **gear** at the top right of the window, again after
> **[en:tran:Others]** in Settings and after **[en:tran:Extra Binaries]**, which reads
> **[en:tran:Update Available]** with an **[en:tran:Update to]** button. Press it and
> the dots go away. Tools never installed are never checked.

_Verify: MD-01..03, MD-06..08, CM-24, PM-102, ST-90._

---

### W-22 — Build a service presenting flow (a running order)

**Goal:** collect everything one service needs — songs, slides, verses, backgrounds and
foreground presets — into one running order you can work down live.

1. Find the **[en:tran:Presenting Flows]** panel — it is the lower of the two lists on the
   left, under **[en:tran:Documents]**. If the list is empty, right-click its empty area (or
   use the **⋮ [en:tran:More Options]** button in its title bar) → **[en:tran:New File]** to create one. 📸
2. **Drag things onto the presenting flow's NAME row to add them.** The NAME row is the
   presenting flow's own row in the list — the one with its name on it; not the empty part of
   the list, and not a line inside an open presenting flow (dropping onto a _line_ does
   something else — it attaches: see W-22g). So, to add a song or a verse: take hold of
   its row — in the Documents list, or in the Bible list — drag it over to the Presenting
   Flows list and let go on the row that shows the presenting flow’s name. It is added
   at the end. Anything you can present can go in:
   - a **background** — a colour, image, video, camera or website;
   - a **document** — a slide document or a **song** (a song is a document too): drag its row out of the Documents list;
   - a **single slide** — from the previewer, or from a document already in the presenting flow;
   - a **Bible verse** — from the Bible list;
   - a **foreground preset** — drag the blue **[en:tran:Show Marquee Top]** / **[en:tran:Start Countdown]** /
     **[en:tran:Show Time]** button itself. Whatever you typed and styled travels with it, so the
     presenting flow remembers _that_ announcement, not just "a marquee". 📸
   - an **audio track** — drag it out of the **[en:tran:Audios]** split.
3. Click the presenting flow name to **open it**. Each element is one short line: an icon for
   what it is, its id, and its name. A **document** line has its own arrow at its left end —
   a song is a document too. Click the **arrow**, not the line, to see that document's
   slides underneath; clicking the line itself opens the document in the previewer. 📸
4. **A song or document line opens its previewer.** To present one of its slides,
   click that slide in the previewer, or expand the document with its arrow and
   click a slide underneath. An **audio track** opens the **[en:tran:Audios]** split
   and flashes the track there; use that panel's play button to play it.
   Click a **single slide**, Bible verse, background or foreground preset to put
   it on the screen. You can also **drag an element onto a mini screen**, or
   **right-click → [en:tran:Show on Screens]** to pick the screen.
5. Right-click an element for **[en:tran:Move up]** / **[en:tran:Move down]**, **[en:tran:Choose Color]**
   to group your running order by colour, or **[en:tran:Remove from Presenting Flow]**. To move a line a long
   way, use **[en:tran:Move to Top]** or **[en:tran:Move to Bottom]** instead of
   clicking **[en:tran:Move up]** over and over — the line jumps straight to that end and everything
   else keeps its order. (A line that is already at the top is not offered **[en:tran:Move up]** or
   **[en:tran:Move to Top]**, and one already at the bottom is not offered **[en:tran:Move down]** or
   **[en:tran:Move to Bottom]**.) **[en:tran:Duplicate]** puts a copy of the line **directly below** it,
   with its colour, its pinned screens and its parked slides already on the copy — the quick
   way to sing a song twice in one service, then change only the second one. The two copies
   are separate from then on: parking or recolouring one leaves the other alone. 📸
   You can also drag a
   line up or down **inside the same presenting flow** (dragging a line into a _different_
   presenting flow does not move it there — add it there from its own list instead). A colour shows as a
   stripe down the left edge of the line and a dot at its right end; the lines stay in
   your running order — they are never re-sorted into colour groups, because the order
   _is_ the meaning here. The colour belongs to that presenting flow alone, so the same song can
   be marked differently in two services. Changes are saved as you make them — there is
   **no save button** anywhere in this panel.
6. Whatever is **live on the screen right now** is marked with a magenta `●` — on the
   element itself, on the document it belongs to, on the presenting flow, and on the
   **[en:tran:Presenting Flows]** heading — so you can see at a glance where you are in the running order.
7. Not sure which "5.jpg" a line means? Right-click it → **[en:tran:Reveal Original]** — the app scrolls to the real item elsewhere in the window and
   flashes it. This works on the slides inside an opened document too. A colour or a
   camera has no original to point at, and the panel holding the original has to be
   open already.

**What else a running order can do** — each has a page of its own:

- be run from one floating panel, with the keyboard (W-22b);
- hold a line that clears the screen, or shows or hides it (W-22c);
- wait on a line and then move on by itself (W-22d), loop a set of slides or jump back
  (W-22e), answer to a key of your own (W-22f);
- make one line bring others up with it (W-22g), or play the video inside a slide (W-22h);
- send a line to one particular screen every time, or park a line (W-22i);
- be handed to another machine as one file (W-22j);
- live in a folder of its own, one press away under the **[en:tran:Presenting Flows]**
  title (W-58).

_Verify: PL-10, PL-29, PL-32..PL-76, PL-81..PL-96, PL-101, PM-170._

---

### W-22b — Run the service from the presenting flow's preview panel

**Goal:** see the whole running order at a glance, and walk the service with one key.

1. To see the whole service at a glance, click the **window** icon on the presenting flow row once (or
   right-click → **[en:tran:Open Preview]**) — a second click on it closes the panel again. A floating panel shows every element with its real
   preview — slides look exactly as they will project, and a document shows all of its
   slides. Opening it puts nothing on a screen, and neither does scrolling it: that is
   how you look ahead. An element goes up only when you click its preview or press one
   of the keys below — those keys run the service, they are not for looking.
   Collapse the ones you are not working on — or fold the whole running order
   away at once with the **[en:tran:Collapse All]** icon at the bottom-left of the
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
   songs in one and the sermon in another, side by side once you drag them apart. Each opens a little below and to
   the left of the last, so it never lands exactly on top of it; each remembers its own
   size and place, and is closed on its own with its
   ✕ (or by clicking its window icon in the list again). Each is its own run, too: where
   you are, what you have folded away and any countdown belong to that panel alone, and
   the keys below always drive the one you last clicked into. 📸
2. **Run the service from this panel.** Click an element — the panel outlines it and
   remembers it as where you are. Clicking its preview also shows it, and clicking the
   title line of a folded element marks it just the same — folding is the chevron on its
   left, so pointing the run at an element never folds it away.
   Then **Space**, **↓**, **→** or **Page Down** puts the next element on the
   screen: every press shows the congregation the next thing, so one key runs the whole
   service. **A document is walked slide by slide:** arriving at it always shows its
   **first** slide, each further press shows the next one, and the keys only move on to
   the next element once its **last** slide is the one on screen — so a whole song or sermon deck plays from here without touching
   the mouse. A **folded-away** element is not passed over: the run **opens it** when it
   gets there, and a song folded away is unfolded and walked from its first slide like any
   other. Folding is how you _read_ a long running order; it never decides what is in the
   service. **The only line the keys step over is one you have parked** (W-22i) — an audio
   track and a damaged line still take the marker, so you can see where the run has got to,
   they simply have nothing to show. The last element is the end — it does not start over.
   The keys work while you are in this panel, and it takes them the moment you open it, so
   there is nothing to click first; click into the slides list and they drive that list
   again, as before. Clicked somewhere else and the keys stopped? Press the key **three
   times quickly** and this panel takes them back (W-49b). 📸
3. **A screen action is stopped on and fired** like anything else (W-22c) — so putting a
   **[en:tran:Clear All]** between the last song and the sermon means one more press of the same
   key blanks the screen at exactly that point in the running order.
   The `Next:` lines are fired the same way, and what they fire is this panel: a wait that
   moves the run on by itself (W-22d), or a loop that keeps moving it (W-22e).
4. **Every line you can right-click in the list, you can right-click here.** The menus in
   this panel are the very same menus — right-click an element's **title line** (or any
   empty part of its box) and you get its full menu: **[en:tran:Reveal Original]**, **[en:tran:Show on Screens]** / **[en:tran:Apply on Screens]**, **[en:tran:Set Specific Screen]**, **[en:tran:Add CC Elements]**, **[en:tran:Add Media Control]**, the four
   moves, **[en:tran:Duplicate]**, **[en:tran:Choose Color]**, **[en:tran:Disable]** / **[en:tran:Enable]** and **[en:tran:Remove from Presenting Flow]**, gated exactly as they are in the list. So you can tidy and re-order the
   running order from the panel you are actually watching during the service, without
   going back to the list — and the list behind it follows immediately. 📸
   Two things inside a box keep menus of their own, because they are not the element:
   a **slide thumbnail** gets the slide's menu (**[en:tran:Reveal Original]**, **[en:tran:Show on Screens]**,
   **[en:tran:Set Specific Screen]**, **[en:tran:Disable]**, **[en:tran:Add CC Elements]**, **[en:tran:Add Media Control]**; a single-slide line's thumbnail has only the first two and **[en:tran:Disable]**, the rest being on its title line), and a **CC line** gets its
   short one (**[en:tran:Reveal Original]**, **[en:tran:Set Specific Screen]**, **[en:tran:Remove CC Element]**).

---

### W-22c — Clear the screen, or show and hide it, from a running order

**Goal:** put something to _do_ in the running order — clear a screen, light it, darken
it — rather than something to show.

1. **Add a screen action.** A running order can also hold something to _do_ rather than
   something to show. Right-click **the presenting flow itself** — its own row in the
   list, not the empty part of the list and not one of its lines — and choose
   **[en:tran:Add Action]**: every action but a slide's Media Control (W-22h) is added from that one menu. For a clear,
   pick **[en:tran:Clear Screen]** there — a row that adds nothing and opens the clears — and then
   one of **[en:tran:Clear All]**, **[en:tran:Clear Background]**, **Clear
   Slide** ([en:tran:Clear Slide]), **[en:tran:Clear Long Text]** or **[en:tran:Clear Foreground]** — the same five clears as the buttons on each mini screen, and the line
   carries an `ALL` / `BG` / `SL` / `LT` / `FG` badge so you can tell them apart at a
   glance. It lands at the end of the list; drag it up to where it belongs — say between
   the last song and the sermon. 📸

   Under those five, **[en:tran:Other Clear FG Items]** offers a **finer clear
   for one foreground widget at a time**, so you can take the countdown down and leave the
   marquee running: **[en:tran:Clear FG Messages]** (`MS`), **[en:tran:Clear FG Marquee Top]** (`M↑`), **[en:tran:Clear FG Marquee Bottom]** (`M↓`), **[en:tran:Clear FG Quick Text]** (`QT`), **[en:tran:Clear FG Countdown]** (`CD`), **[en:tran:Clear FG Stopwatch]** (`SW`), **[en:tran:Clear FG Time]** (`TM`), **[en:tran:Clear FG Video Show]** (`VD`), **[en:tran:Clear FG Image Show]** (`IM`), **[en:tran:Clear FG Camera Show]** (`CM`), **[en:tran:Clear FG Screen Show]** (`SS`) and **[en:tran:Clear FG Web Show]** (`WB`). Each does exactly what that widget's own hide button in the **[en:tran:Foreground]** panel does; the `Messages`, `Time`, `Video Show`, `Image Show`, `Camera Show`, `Screen Show` and `Web Show` ones clear all of their items at once.
2. **A screen action is run, not shown.** Click it to clear, drag it onto one mini screen
   to clear only that one, or right-click → **[en:tran:Apply on Screens]** to choose. It never
   lights up as "live", because there is nothing of it on the screen to be live. In the
   preview panel (W-22b) it is stopped on and fired like any other line — so a
   **[en:tran:Clear All]** between the last song and the sermon means one more press of the same
   key blanks the screen at exactly that point in the running order.
3. **Put the screen itself up and down.** Two more actions are not about what is _on_ a
   screen but about whether there is one: **[en:tran:Screen: Show]** and
   **[en:tran:Screen: Hide]**, the same thing the slides button on each mini screen
   does by hand. Use them when the running order has to work with nobody at the machine —
   a **[en:tran:Screen: Show]** at the top of a pre-service run of announcements, a
   **[en:tran:Screen: Hide]** at the end of it, and the screen goes dark on its own instead of
   holding the last announcement until someone notices — unless a **[en:tran:Jump to]** loops
   the run back, because then its end is never reached (W-22e step 3).

   **These two ask which screen** when you add them, and that is the whole point: a
   checklist of the screens you have open appears (`Screen id: 0`, `Screen id: 1`, …,
   each in that screen's own colour), and the line remembers your answer as its pin — the
   line shows the pin badge, and **[en:tran:Set Specific Screen]** re-aims it later. Unlike every
   other line, it goes to those screens and _only_ those: it will not fall back to
   whichever screen you happened to have selected, and it will never stop to ask, because
   at 7:05 on an unattended sheet there is nobody there to answer. Tick nothing and the
   app says **[en:tran:Please choose at least one screen]** rather than adding a line that would do
   nothing. Like every action, the line lands at the end of the list: drag it up to where it
   should fire. Firing one twice is harmless — a **[en:tran:Screen: Show]** on a screen that is already
   up does nothing at all, so it is safe inside a loop. Nothing can be attached to them
   either, though they can themselves be attached to another line — "put this last slide
   up **and** light the screen" in one click. 📸
   Clicking one goes to the screens it names and nowhere else; **[en:tran:Apply on Screens]**
   still asks, since that entry is you saying "send this one somewhere else" — but it
   does not change what the line is pinned to.
4. **Where the actions live in the menu.** **[en:tran:Add Action]** opens with **[en:tran:Clear Screen]** —
   one row that adds nothing and opens the five clears, with **[en:tran:Other Clear FG Items]**
   under them for the twelve per-widget foreground clears — then **[en:tran:Screen: Show]** / **[en:tran:Screen: Hide]**, then the five that drive the run.

---

### W-22d — Make a running order wait, then move on by itself (Next: Timeout)

**Goal:** a slide that lingers and then goes on without you, or a notice board that
ends exactly when the service starts.

1. **Let the running order walk itself.** In the **[en:tran:Presenting Flows]** list (not
   in the preview panel), right-click **the presenting flow itself** — the
   row with its name on it, not the empty part of the list and not one of its lines — and
   choose **[en:tran:Add Action]** → **[en:tran:Next: Timeout]**. That adds a NEW line to
   the running order; it is never added by right-clicking a line that is already there.
   It goes at the END of the running order: drag it up to just after the line it should
   follow.
   It asks how many **[en:tran:Seconds]**, and the answer is part of the new
   line — `⏱ Next: Timeout (5)` — so a glance at the sheet tells you how long it waits. Got
   it wrong? Right-click that `Next: Timeout` line → **[en:tran:Change Timing]**; it opens
   on what it is holding now. 📸
2. **[en:tran:Next: Timeout]** waits once. When the run reaches it, it counts down and then moves
   the run on by itself — a slide that should linger ten seconds and then go on without
   you. **Going somewhere yourself calls it off**: click another line in the preview panel, or press the next
   key, and the wait is over and you are driving again. A click that goes nowhere does
   NOT call it off: clicking a background or a foreground button in its own panel, or a stray click on
   the panel, leaves it counting, so a mis-aimed click cannot silently cost you the wait.
3. **Or wait until a time on the clock.** A timeout does not have to be counted in
   seconds. The small box that asks for the seconds — it opens when you add the line
   (step 1, then drag the new line up to just after the line it should follow), and again from right-click → **[en:tran:Change Timing]** on that line — has a
   chooser at its left: switch it from **[en:tran:Seconds]** to **[en:tran:At Time]** and type the
   time you want the run to move on — `7:05 AM`, `8:30 PM`. The line then reads `⏱ Next: Timeout (7:05 AM)`, and
   the pill counts down in minutes and hours (`4:58`, `1:12:30`) instead of a long number
   of seconds. Use it for the notice board before a service: put it on the last
   announcement and the run leaves it exactly when the service starts, whether you armed
   it an hour or five minutes before. Its menu entry is **[en:tran:Change Timing]** rather than **[en:tran:Change Seconds]**, and it opens on whichever half
   you armed it with — the two are alternatives, so choosing one clears the other. If the
   time you set has **already gone by**, the app says so (**[en:tran:The set time is already due]**)
   and starts nothing: it will not quietly wait until tomorrow. Set a new time, or arm it
   in seconds. 📸
4. **It counts only in the preview panel.** A `Next:` line means something only while that
   presenting flow's **preview panel** is open (W-22b) — that panel is what walks the
   running order: clicking its button there starts its countdown, and a small pill at the
   panel's top-right shows the seconds left, with ⊗ to stop it and ⏸ to hold it. Click the
   line with the panel closed and the app says so
   (**[en:tran:Open the presenting flow preview to use this action]**) rather than looking as
   though it did something. It never goes to a screen, so it has no **[en:tran:Apply on Screens]**
   and no **[en:tran:Set Specific Screen]**, and nothing can be attached to it.
5. **A timeout can also ride along with another line.** Attach it to a line — a
   slide, a song, a verse — as a **CC element** (W-22g), and that line means "show this,
   and go on by yourself N seconds later". Add the **[en:tran:Next: Timeout]** once, right-click the
   line you want it on → **[en:tran:Add CC Elements]** and pick it. Keep the
   `Next: Timeout` line itself in the list, though: a CC points at that line rather than copying it, so removing the line removes every follower of it as well (park it with **[en:tran:Disable]** if the run should not stop there — its followers still fire). Attached to
   a whole SONG it rides every slide of it, which is how a song advances by itself. 📸
6. **Each line may wait for its own length.** First create a timeout if there is none:
   right-click the presenting flow's own name → **[en:tran:Add Action]** →
   **[en:tran:Next: Timeout]** and enter its seconds. Right-click each line that needs
   a wait → **[en:tran:Add CC Elements]** and pick that timeout. It appears as an
   indented CC row under each line it is attached to. A CC line normally reads whatever the
   `Next: Timeout` line is set to, so re-arming that one line re-arms every follower of it
   at once. When one line needs a different wait, click the small **stopwatch** at the
   right of **that CC line — the indented row under the line, not the line itself** (or
   right-click that CC line → **[en:tran:Change Timing]**) and
   answer with seconds or a time of day, exactly as on a line of its own. That answer
   belongs to **that attachment only**: the same `Next: Timeout` can hold the welcome slide
   for 4 seconds and the notice slide for 30, with one timeout in the running order instead
   of one per length. A row holding its own wait shows the stopwatch **filled** and reads
   its own number; one still following the element shows it hollow. To hand a row back,
   right-click it → **[en:tran:Use Element Timing]** — it goes back to the
   element's number and moves with it again. 📸
7. **If the run stopped moving on by itself**, one of four things happened. You went
   somewhere yourself — clicked another line in the preview panel, or pressed the next key — and that calls a
   timeout off. Or the preview panel was closed: no `Next:` line counts without it. Or the
   run reached the end of the list. Or someone pressed the pill's ⊗, or its ⏸ is holding it. To set it going again, click the `Next:` line's button (or the
   preview of the line it rides on) in the preview panel.

---

### W-22e — Loop a set of slides, stop the loop, and jump back (Next: Interval, Jump to)

**Goal:** a loop of announcement slides that runs by itself before the service and stops
where you say, and a running order that can go back to an earlier line.

1. Right-click **the presenting flow itself** — its own row in the list, not the empty part of
   the list and not one of its lines — and choose **[en:tran:Add Action]** →
   **[en:tran:Next: Interval]**. It asks how many **[en:tran:Seconds]**, and the answer is part of the
   line; right-click the line → **[en:tran:Change Seconds]** to change it. Like every `Next:` line
   it works only while the preview panel is open (W-22b).
2. **[en:tran:Next: Interval]** keeps going. It moves the run on every so many seconds — a loop of
   announcement slides before the service. Going somewhere yourself does not stop it, it
   **starts the count again from there**, so a line you step to by hand gets the whole
   interval rather than the second that was left of the last one. To stop it, click the
   ⊗ (**[en:tran:Stop Auto Next]**) on the pill it puts at the top-right of the preview panel (it shows the seconds left, in
   the same colour as the line that started it); the ⏸ on the same pill (**[en:tran:Pause Auto Next]**) holds the count where it is until you press it again. Closing the panel stops it too, as does
   reaching the end of the sheet.
3. **[en:tran:Next: Clear Interval]** stops that loop, and it is the
   one way the SHEET can stop it: the pill, closing the panel and the end of the list are
   all you being at the machine. Add it — it asks nothing, there being only ever one clock
   running — and the line reads `⊘ Next: Clear Interval` in the interval's own colour,
   because it is that same thing undone. Put it where the run will reach it: after slides the
   interval walks once, or attached to a slide (below), so the loop stops when that slide is
   shown and waits for you. A line after a **[en:tran:Jump to]** that points back at the
   interval is never reached — the jump fires the moment the run lands on it — so a loop like
   that is ended by you: press this line's button in the preview panel, or the pill's ⊗.
   Firing it when nothing is looping does
   nothing at all and says nothing, so it is safe to leave in a sheet you re-run. It stops
   an interval you have PAUSED as well; a **[en:tran:Next: Timeout]** it leaves alone, so a wait
   attached to a slide is never killed by a line that only meant to end a loop. 📸
   **A Next: Interval cannot ride along with another line** —
   an interval is not stopped by anything you do, so one riding a slide would keep moving
   the running order on with nothing to call it off but the panel's own pill. A
   **[en:tran:Next: Clear Interval]** CAN be attached, for the opposite reason: "put this last slide
   up **and** stop the loop" is one click, and something that stops a loop can never run
   away with the running order.
4. **Go back, not just forward.** **[en:tran:Jump to]** is how a running
   order reaches a line that is not the next one. Add it from the same menu as the interval — right-click
   the presenting flow itself, not one of its lines → **[en:tran:Add Action]** →
   **[en:tran:Jump to]** — then drag the new line from the end of the list, where it
   lands, to where the run should meet it, and right-click it →
   **[en:tran:Add CC Elements]** and pick the line it should go to — its list is everything in the
   presenting flow, **a whole song included**, because here the attached line is not something
   that rides along, it is the destination. It takes exactly one, so once you have picked
   the **[en:tran:Add CC Elements]** entry is gone; to re-aim it, remove the CC and pick another.
   To jump now, right-click the presenting flow → **[en:tran:Open Preview]**, then click
   the **[en:tran:Jump to]** button in the preview; reaching it with **Space** does the same. 📸

   **It is the next key aimed at a line of your choosing**: when the run reaches it — or
   you click it — the panel goes to that line and does there exactly what stepping onto it
   would have done. A song opens at its first slide; a **[en:tran:Next: Interval]** or **[en:tran:Next: Timeout]** it lands on is STARTED. That last one is how a set loops: put the slides
   under a **[en:tran:Next: Interval]**, and a **[en:tran:Jump to]** at the end of them pointing back at that
   interval — the set then plays round and round on its own until you stop it with the
   pill. (A jump that lands on another jump stops there rather than jumping again, so a
   pair of them cannot send the run back and forth for ever.) If it has nothing attached,
   or the line it named has since been deleted, it says so instead of quietly doing
   nothing.
5. **A loop of slides before the service, from start to finish.** The slides of the set
   are lines of the presenting flow already. (a) Right-click the presenting flow →
   **[en:tran:Add Action]** → **[en:tran:Next: Interval]**, type the seconds each slide
   stays, and drag that line above the first slide of the set. (b) Right-click the
   presenting flow → **[en:tran:Add Action]** → **[en:tran:Jump to]** and drag it under
   the last slide of the set; then right-click the **[en:tran:Jump to]** line →
   **[en:tran:Add CC Elements]** and pick the **[en:tran:Next: Interval]** line. (c) Open
   the preview panel (W-22b) and click the **[en:tran:Next: Interval]** button there: the set
   plays round and round by itself. It stops when you click **⊗** on the pill at the
   top-right of the preview panel, or close the panel. Nothing is dragged ONTO the
   interval or the jump: they are lines of their own, in the list.

---

### W-22f — Reach a line with a key of your own (Keyboard Event)

**Goal:** one shortcut that sends the run to a line and puts it — and everything attached
to it — on the screens at once, wherever the run had got to.

1. **Reach a line with a key of your own.** A **[en:tran:Keyboard Event]** is a shortcut you set yourself. Add it from the menu of the presenting flow (right-click the presenting
   flow itself → **[en:tran:Add Action]** → **[en:tran:Keyboard Event]**): it asks for the
   shortcut, and you answer by **pressing it** — the box is not typed into. Hold **Ctrl**
   or **Shift** (those two only, and at least one of them, so the shortcut means the same
   thing on any machine and cannot take a key the running order already uses) and press
   the key. The line then reads `⌨ Keyboard Event (Shift+A)`. Re-set it later from
   **[en:tran:Change Shortcut]**. Two lines may not share a shortcut — the second one is refused
   out loud — and duplicating a line leaves the copy without one. 📸
2. **Attach what it should put up, and keep the preview panel open: the key works only
   while it is.** Right-click the new line → **[en:tran:Add CC Elements]** — as many as you like, which
   is what makes one key worth more than one click: a slide _and_ its marquee together,
   say. Then, with the preview panel open (W-22b), pressing **Shift+A** sends the run to
   that line and puts all of it on the screens at once, wherever the run had got to.
   Pin the line to a screen with **[en:tran:Set Specific Screen]** if it should always go to the
   same one. The shortcut only answers while the preview panel has the keyboard, exactly
   as its arrow keys do — the panel takes it the moment you open it, so there is nothing
   to click first. With nothing attached yet it says so rather than doing nothing. 📸

---

### W-22g — Make one line bring others with it (CC elements)

**Goal:** the moment verse 1 goes up, the welcome marquee is up too — one click, both.

1. **Make one line bring others with it — CC elements.** Some things belong _together_: the
   moment verse 1 goes up, the welcome marquee has to be up too. Attach the marquee to that
   line as a **CC element** and one click does both.

   Attach one in either of two ways:
   - **drop it onto the line** — drag the marquee button, a background, a verse or a slide
     out of its own panel and drop it _on the line it belongs to_ (the line outlines in
     dashed amber as you hover it). Dropping onto a **document's slide** attaches it to
     that one slide; dropping onto the document's own line attaches it to the whole song.
     You can also drag a line **already in the presenting flow** — a clear action included — onto
     another line. Something dragged in from another panel is also added as a line of its
     own at the end of the list — a CC points at a line of the running order — so leave that
     line in place: removing it removes the CC with it.

     **Aim at the middle of a line to attach, at its top or bottom edge to move.** To drop one line onto another, drag that line
     itself. A line
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

   - right-click the line → **[en:tran:Add CC Elements]** and pick from the other
     lines already in this presenting flow. 📸

   A CC element shows as a `↳` line just under the one it rides with. From then on,
   **clicking that line — or reaching it with the arrow/Space keys in the preview — puts
   the line AND its CC elements on the screen together**, on the same screens the line
   itself went to. You are never asked "which screen?" twice for one click.

   - A CC on a **document line** rides with _every_ slide of that song (a document line has
     nothing of its own to show, so this is what "keep this marquee up for this song"
     means); a CC on **one slide** rides with that slide only.
   - A CC can have a screen of its own: right-click it → **[en:tran:Set Specific Screen]** to send it
     somewhere else while its line goes to the usual place. **[en:tran:No Specific Screen]** hands it
     back to following the line.
   - **Clicking a CC line never projects it.** It scrolls the element it points at into
     view and flashes it — in the presenting flow and in the preview window at once — so you can
     always find what a short label refers to.
   - Right-click a CC line for **[en:tran:Remove CC Element]**. There is no
     **[en:tran:Disable]** on a CC: parking takes a _line_ out of the running order, and a CC is not
     a line of the running order — one you do not want is simply removed. (So attaching a
     line you have parked gives you a CC that _does_ fire, while the parked line itself
     stays parked.) A whole document and an audio track cannot ride along as CC elements — neither
     reaches a screen — and the app says so if you try.

   Most lines can hold as many CC elements as you like; a CC element cannot have CC
   elements of its own.

---

### W-22h — Play the video or song inside a slide by itself (Media Control)

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

---

### W-22i — Send a line to one particular screen, or park a line

**Goal:** a lyric that always goes to the stage screen without being dragged there, and a
line you cannot fire by accident.

1. **Send a line to one particular screen, every time.** If a lyric always belongs on the
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
   **[en:tran:Show on Screens]** still asks which screen you mean. If the pinned screen has been
   closed, nothing is projected anywhere and the app tells you so ("Please make sure the
   screen is open") rather than quietly using a different screen.
2. A **document** line can be pinned too — its slides then all follow it — and you can pin
   **one slide on its own**: open the document's arrow, right-click the slide and set its
   screen. That slide overrides the document; its neighbours keep following the document.
   A slide pinned in its own right shows the 📌 on its own line **and in the bottom-right
   corner of its thumbnail in the preview panel**, so a run sheet you are reading as
   pictures still tells you which slide breaks away from its document. Clearing it hands
   that slide back to the document rather than pinning it to nothing. The same right-click
   is on the slide thumbnails inside the preview panel.
3. **Park a line you do not want touched.** A line you might click by accident — an
   alternate verse, last week's notice, a song you may or may not reach — can be taken out
   of the running order without deleting it: right-click it → **[en:tran:Disable]**. The line dims, is written in italics, is **crossed out** and gains a small
   amber 🚫 at its right end, and from then on **clicking it does nothing at all** — nothing
   is projected, and a document line does not even open. Dragging it onto a mini screen puts nothing there,
   and the arrow/Space keys in the preview panel step straight past it. Right-click →
   **[en:tran:Enable]** puts it back. (While a line is parked its menu drops
   **[en:tran:Show on Screens]** (on an action, the entry that fires it) — an entry that could no longer do anything — but everything else
   stays, so you can still recolour it, move it, or turn it back on.) 📸
   You can park **one slide of a document** the same way: open the document's arrow and
   right-click the slide. Park the **document itself** and every slide under it is parked
   with it. A parked line can still be dragged up and down to tidy your running order, and
   parking is remembered in that presenting flow only — the same song stays live in your other
   services.
4. **Two kinds of greyed-out line, and they now look different.** A line YOU parked here is
   crossed out and carries the amber 🚫 ("This item is disabled in this presenting flow"). A slide
   that is greyed out because the **document itself** hides it is _not_ crossed out and
   carries a plain grey 👁‍🗨 ("This item is disabled in its document") — right-clicking that
   one will not bring it back, because a running order cannot re-enable what the document
   turned off; open the document and enable the slide there. In the preview panel the same
   two marks sit in the **bottom-left corner** of each dimmed thumbnail. 📸

---

### W-22j — Share a presenting flow with another machine

**Goal:** hand the whole service — the running order and every file it needs — to another
machine as one file.

1. Right-click the presenting flow → **[en:tran:Export]**. A small panel asks for a
    **[en:tran:Password]** and a **[en:tran:Confirm Password]**.
    **Leave both empty and press Ok** for the ordinary bundle: one
    `<name>.owapf.tar.gz` file in your **Downloads** folder, and the folder opens. It
    contains the presenting flow _and every file it needs_ — the full documents behind your
    slides, the images and videos, and any background attached to those documents.
    (See step 1a to put a password on it instead.)
    1a. **To protect it with a password**, type the same password in both fields and press
    **[en:tran:Ok]**. **[en:tran:Show Password]** reveals what you typed if you want to
    check it. You get `<name>.owapf.enc` instead — the same bundle, locked. If the two
    fields do not match the panel says **[en:tran:Passwords do not match]** and asks again rather than exporting, keeping what you
    already typed so you only fix the half that is wrong. Clearing both fields is always
    allowed — that just means "no password".

    > **There is no way to recover a forgotten password.** Nobody — not you, not the app,
    > not the person you send it to — can open the bundle without it. Write it down
    > somewhere safe before you hand the file over, and send it by a different route than
    > the file itself.

2. **Import on the receiving machine.** First open **[en:tran:Settings]** →
    **[en:tran:Path Settings]** and choose the destination folders for the file
    types in the bundle. Then right-click an empty part of the **[en:tran:Presenting Flows]** list → **[en:tran:Import]** and pick that file — or just **drag the `.owapf.tar.gz` (or `.owapf.enc`)
    file from your file manager onto the Presenting Flows list**, which imports it the same way.
    A protected bundle asks for its password first, saying **This archive is password
    protected** ([en:tran:This archive is password protected]); get it wrong and it says
    **[en:tran:Wrong password, try again]** and lets
    you retype it, up to three tries. An ordinary bundle never asks. The songs, documents
    and media are re-created in that machine's own folders, Bible verses are added to the
    **Default** list, and every link inside the presenting flow is re-pointed at the local
    copies. 📸
3. If the bundle is on a web server or a machine sharing it over the local network,
    you can skip copying the file about: right-click the **[en:tran:Presenting Flows]** list →
    **[en:tran:Import From URL]**, paste the link and press **[en:tran:Ok]**. (If the link is
    already on your clipboard it is filled in for you.) The app downloads the bundle to a
    temporary folder, imports it exactly as above and then deletes the download — you end
    up with the presenting flow and nothing else left over. A plain `http://…` address with a
    port, such as one served off another laptop, works as well as `https://`. 📸

> Notes: a picture, video or other media file that is already there **with the same
> contents** is reused rather than duplicated. The presenting flow itself, its songs and its
> documents always arrive as new files — beside one of the same name, even the same one
> imported before, as `name (1)` — so importing the same bundle twice gives you a second
> copy of each. If a media file of the same NAME is
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
> **[en:tran:Invalid item]**, that one entry is damaged (usually a hand-edited file) — the rest of
> the running order still works; remove that line and re-add it.

---
### W-23 — Share one document (song, sermon slides, PDF) with another machine

Sometimes you only want to hand over **one** item, not a whole service. A document
travels as its own bundle, with everything attached to it.

1. In the **[en:tran:Documents]** list, right-click the item you want — an Open Worship slide
   document, a lyric, a PDF, a PowerPoint or a Word file all work — and choose
   **[en:tran:Export]**. 📸
2. A small panel asks for a **[en:tran:Password]** and a **[en:tran:Confirm Password]**. Leave both empty and press **[en:tran:Ok]** for the ordinary bundle, or
   type the same password in both to lock it — see W-22j step 1a, it works identically
   here and there is no way to recover a forgotten one. 📸
3. You get one `<name>.owadoc.tar.gz` file in your **Downloads** folder (or
   `<name>.owadoc.enc` if you set a password), and the folder opens. It contains the
   document itself plus everything hanging off it: the background you attached to it
   (and that background's image or video file), any video or audio placed inside its slides, its
   own transitions and its colour note.
4. On the other machine, right-click an empty part of the **[en:tran:Documents]** list →
   **[en:tran:Import]** and pick that file — or just **drag the
   `.owadoc.tar.gz` (or `.owadoc.enc`) file from your file manager onto the Documents
   list**, which imports it the same way. A protected bundle asks for its password
   first; an ordinary one never does. 📸
5. The document appears in that machine's documents folder — the one the list is showing (W-58) — under its original name, with
   its background re-attached and its colour note restored, so it is ready to present
   straight away.
6. If the bundle is on a web server or a machine sharing it over the local network, use
   **[en:tran:Import From URL]** instead and paste the link. The
   download goes to a temporary folder, is imported exactly as above, and is then
   deleted.

> Notes: the same rules as a presenting flow bundle apply. A picture, video or other media file already there
> **with the same contents** is reused rather than duplicated; one of the same NAME that is
> actually a different file is left untouched and the bundled one lands beside it as
> `a (1).mp4`. The document itself always arrives as a new file: when one of that name is
> already there — even the same document, imported before — yours is left untouched, with
> its background and colour note, and the bundled one lands beside it as `a (1).pdf`. Importing needs the folders it writes into to be **chosen already** (for a
> document with a video background, the Videos folder too), and if one is missing the
> import stops before copying anything and tells you which to choose.
>
> If you export the same document twice, the second file is named
> `<name> (1).owadoc.tar.gz`. That name still ends in `.owadoc.tar.gz`, so dragging
> _that_ copy onto the list imports it like the first (a `<name>.owadoc.tar (1).gz`
> written by an older version of the app is taken the same way).

_Verify: PL-77..PL-80, CM-36, CM-37._

> This works for a **lyric** too — a lyric is a row in the same Documents list. Its
> bundle carries the lyric plus every background you attached to its slides, so the song
> arrives on the other machine already looking the way you set it up.

---

### W-45 — Save a slide document as a PowerPoint file (Export to PPTX)

For when a slide document has to be shown or edited where this app is not — a guest
speaker's laptop, a church that uses PowerPoint, Google Slides or Keynote. Unlike
**[en:tran:Export]** (W-23), which carries the document to another Open Worship app, this makes a
PowerPoint file anyone can open.

1. In the **[en:tran:Documents]** list, right-click an Open Worship slide document (or press the
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
5. Anything you wrote in a slide's **[en:tran:Slide Note]** is in that slide's **Notes** in
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

1. In the **[en:tran:Bibles]** panel, right-click the list you want and choose **[en:tran:Export]**. A small panel asks for a **[en:tran:Password]** and a
   **[en:tran:Confirm Password]** — leave both empty for the ordinary bundle, or type
   the same password in both to lock it (W-22j step 1a). You get one
   `<name>.owbible.tar.gz` file in your **Downloads** folder, or `<name>.owbible.enc`
   if you set a password. 📸
2. The bundle is small: a bible list stores verse _references_, not the Bible text, so
   only the list and any background you attached to it (or to one of its verses) are
   inside.
3. On the other machine, right-click an empty part of the **[en:tran:Bibles]** panel → **[en:tran:Import]** and pick the file — or **drag the `.owbible.tar.gz` (or `.owbible.enc`) onto
   the Bibles panel**; a protected one asks for its password first. **[en:tran:Import From URL]** works here too. 📸
4. The list appears in that machine's bibles folder — the one the list is showing (W-58) — with its verses, their colours and
   its background, ready to present. If a list of the same name is already there, the
   verses it does not have yet are added to that list instead of a second one appearing.

> Notes: the Bible **versions** the verses name are not part of the bundle — they are
> large, separately downloaded files. If the other machine does not have a version yet,
> download it there (Settings → Bible) and the verses show up. The **[en:tran:Bible Reader]** page
> keeps its own bibles folder, so importing there adds the list to the reader's folder,
> not the presenter's.
>
> A bundle can only be imported by the list it came from: picking a document bundle in
> the Bibles panel (or a bible bundle in the Documents list) is refused with a message
> naming what the file actually holds, and nothing is written.

_Verify: PR-27..PR-29, CM-38, CM-39._

---

### W-25 — Back up everything, or move to a new computer

W-22j to W-24 each carry one thing. To take **all** your material at once — for a backup,
or to set up a second machine — use the app's **File** menu.

1. Open the **File** menu at the top of the window and choose **[en:tran:Export Data]**. 📸
2. A panel lists every data folder you have set up — Documents, Presenting Flows, Background
   Images, Videos, Audios and Webs, Foreground Images and Videos, Bible Present, Bible Reader,
   Bible Notes, **[en:tran:Bibles XML]** and
   **[en:tran:Resources]** — with the folder each one points at. **They all start ticked.** Untick
   anything you do not want (the videos folder is usually the big one), or use
   **[en:tran:Select All]** / **[en:tran:Deselect All]**. 📸

   > **[en:tran:Bibles XML]** and **[en:tran:Resources]** are the two folders you never chose yourself — the
   > app keeps them.
   >
   > **[en:tran:Bibles XML]** carries the Bible XML files you added by hand (Settings → Bible →
   > Bibles XML), and **only those**: the Bible versions you downloaded in the app are
   > left out, because you simply download them again on the other machine. If you have
   > never added an XML Bible, the row is not offered at all.
   >
   > **[en:tran:Resources]** is the `resources` folder inside your data folder — where
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

3. Press **[en:tran:Ok]**. You get one `open-worship-data.owadata.tar` file in your **Downloads**
   folder — or `open-worship-data.owadata.enc` if you set a password — and the folder
   opens. Copy it to a USB stick or the other machine.
4. On the other machine, open **[en:tran:Settings]** → **[en:tran:Path Settings]**
   and choose the destination folders first. Then choose **File** → **[en:tran:Import Data]** and pick that file. A protected backup asks for its password first. A password typed wrong is asked
   for again under _[en:tran:Wrong password, try again]_ — three tries in all — and then the
   import stops with nothing brought in. Type it exactly as it was set, capital letters and
   all, or ask whoever made the file for it. No one can open it without. The panel then lists only the
   folders the file actually contains — again all ticked — so you can restore just the
   songs, or just the backgrounds. 📸

   > A protected backup is unlocked in one pass before that list can be shown, so a big
   > one takes a moment longer to open than an ordinary one. An ordinary backup is read
   > as quickly as it always was.

5. Press **[en:tran:Ok]**. When it finishes you are told how many files were brought in and how
   many were already up to date. Every folder the **[en:tran:Resources]** row brought back is also
   added to the Resources panel's list, so it shows up there without being added by hand
   (press **[en:tran:Reload]** in the panel's ⋮ menu if the panel was already open).

> Notes: this is a **copy, not a replacement**. A song, a document, a presenting flow or a
> Bible note with the same NAME as one already on the machine is always added beside it
> as `song (1).owl` — **your version is kept**, for you to compare and delete whichever you
> do not want — even when the two are the very same file, so importing the same backup
> twice gives you a second copy of each. A bible list of the same name only gains the
> verses it does not have yet. Any other file — a picture, a video, a Resources file — is
> left alone when the one here has the same contents, and added beside it as `a (1).mp4`
> when it does not. Nothing is ever overwritten.
>
> Importing writes into the folders **this** machine has set up, so choose them first
> (Settings → Path Settings). If one of them has no folder yet, the import stops before
> copying anything and tells you which to set.
>
> The backup leaves out the working files the app can rebuild by itself — a document's
> undo history and the page images made for PDF/PowerPoint/Word previews — so it stays
> much smaller than the folders themselves, and the page images are made again on
> the other machine the first time you open the document (the undo history starts afresh).

_Verify: NAV-17..NAV-19._

### W-26 — Compare two documents side by side (floating slide previews)

**Goal:** look at the slides of more than one document at the same time, without losing
the one you already had open.

**Preconditions:** at least two documents in the **[en:tran:Documents]** list.

The middle panel previews the **one** document you have selected. To look at another one
as well, give it a window of its own.

1. In the left **[en:tran:Documents]** list, **right-click** a document you have NOT
   selected and choose **[en:tran:Open Slides Preview]**. A window titled
   **[en:tran:Slides]: ‹name›** appears over the app. 📸
   Faster, once you know it: hold **Ctrl** (**⌘** on a Mac) and click the row. Same
   thing, no menu — and holding Ctrl again on that row closes the window. The menu
   entry's tooltip reminds you of the shortcut.
2. It is the full previewer, not a thumbnail strip: the undo / redo / discard / save
   strip at the top, the slides, the grey-striped **[en:tran:Note]** strip (the note boxes start closed — click it to open them), and a zoom slider with the document
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
   Space** — while one of its slides is on the screen, they step **that** window's
   document, not whichever one the middle panel is showing.

Tips:

- **A document is previewed in one place at a time.** On the document you currently have
  selected, **[en:tran:Open Slides Preview]** is greyed out ("[en:tran:Already showing in the main previewer]") — it is already in the middle panel;
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

**Preconditions:** a document selected in the middle **[en:tran:Documents]** tab.

1. Look at the middle **[en:tran:Documents]** tab heading. With a document selected, a
   faint **pin** (drawn as an open padlock) sits just after the word — nothing selected, no pin. 📸
2. Click the pin. The padlock closes and turns solid amber: the document is now **pinned**. Hovering it
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

**Preconditions:** a slide document open in the **[en:tran:Slide Editor]**, and the bottom
**[en:tran:Background]** panel visible.

1. Pick a tab in the bottom **[en:tran:Background]** panel — **[en:tran:Fills]**, **[en:tran:Images]**,
   **[en:tran:Videos]**, **[en:tran:Cameras]** or **[en:tran:Webs]**. At the right end of the same row,
   **[en:tran:Audios]** opens the audio list beside them. 📸
2. Drag one item out of the panel and hold it over the canvas. The canvas **dims** to show
   it will take the drop. (It stays bright for things it cannot use — a Bible verse, for
   example.) 📸
3. Let go. A box appears **centred on where you dropped it**:

   | Dragged from        | You get                                                                               |
   | ------------------- | ------------------------------------------------------------------------------------- |
   | Images              | an image box                                                                          |
   | Videos              | a video box                                                                           |
   | Audios              | an audio player box                                                                   |
   | Webs — a local page | a website box showing a **screenshot** of that page (see W-15 step 5)                 |
   | Webs — a saved URL  | a website box showing a **screenshot**; a **YouTube** link becomes a real YouTube box |
   | Cameras             | a camera box, labelled with that camera                                               |
   | Fills — a colour    | a plain coloured box (see step 4)                                                     |

   📸

4. **Colours are the special one.** Drop a colour **on top of an existing box** and it
   **repaints that box** — no new box is added. Drop it on **empty canvas** and you get a
   new coloured rectangle instead. That rectangle is an ordinary text box underneath, so
   you can double-click it and type into it later. A **locked** box (🔒) keeps its colour:
   the app says _[en:tran:This item is locked]_ and adds nothing — unlock it first. 📸
5. Anything you drop in is an ordinary box: move it, resize it, reorder it, and **[en:tran:Undo]**
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

1. Open the **[en:tran:Bible Reader]**, or the **[en:tran:Bible Lookup]** popup in the Presenter. At the
   right-hand end of the reference box, click the person-and-pin button
   **[en:tran:Names and locations lookup]**. A small floating
   window opens. The first open takes a few seconds while the dictionary loads. While the
   window stays open it is instant; once you close it the dictionary is let go
   after about ten seconds, and the next open waits for it again. It is a floating window like any other: drag it by its title bar,
   resize it from any edge, and **double-click the title bar** to make it fill the app
   window when you want to read a long list — double-click again to put it back where
   it was. 📸
2. The small **language code** beside that button (`en`) is the language the names and
   places themselves are written in. It is **green** while that is the language of the
   Bible you are reading and **red** while it is not — `en` beside a Khmer Bible such as
   `ពគប` is red, and its tooltip adds **[en:tran:Not the language of the Bible]** with
   that Bible's language. Click it and pick another language the names come
   in — one installed from Settings → **[en:tran:Languages]** (W-55), such as `km - Khmer
(ភាសាខ្មែរ)` — and the lookup list and the
   "in your reading" panel switch to it at once, with nothing to reload.
   Person and location windows already open keep their own language. The choice is
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
4. On the **[en:tran:Names]** tab the dropdown beside the tabs narrows the list by kind —
   **[en:tran:All Types]**, **[en:tran:People]**, **[en:tran:Groups]**,
   **[en:tran:Places]** and so on. These follow the **lookup** language from step 2,
   not the app's, so they read the same way as the records they filter. It is greyed
   out on the **[en:tran:Locations]** tab, where there is nothing to filter.
5. Use the arrows at the bottom to page through results, or type a page number in the
   little box and press **Enter**. Starting a new search always takes you back to
   page 1. 📸
6. Click a result to open it in its own small window: a small icon for what kind of
   record it is — a person, a place, a book for a verse — then a short description, then
   a **[en:tran:Details]** section with things like **[en:tran:Also called]**, **[en:tran:Type]**,
   **[en:tran:Gender]**, **[en:tran:Parents]**, **[en:tran:Children]** and **[en:tran:Verses]**. 📸
   A long record scrolls inside its window. Once you have scrolled down, a faint up-arrow
   (**[en:tran:Scroll to the top]**) shows in the window's bottom-right corner: click it
   to go straight back to the top.
   The language code in its header, **[en:tran:Names and locations language]**,
   opens the same language menu. Pick another language to open that same record
   in a second window while keeping the first one open. If that record is
   already open in the chosen language, its window comes to the front. This
   choice leaves the language beside the person-and-pin button unchanged.
   > Every row in the list — and in the **[en:tran:Names and locations in your reading]** panel —
   > also carries a **⋮** button at its right end. It opens the same short menu that
   > right-clicking the row gives you, so you never need a right mouse button.
   > The menu does what the person's or place's own window does, without opening it
   > first: **[en:tran:Open]** opens that window, as a click on the row does;
   > **[en:tran:Copy]** copies the whole entry, as the window's **[en:tran:Copy]** does (step 11);
   > **[en:tran:Open in Chatbot]** — there while AI features are on — opens a chat about it, as the
   > window's robot does (step 13); and **[en:tran:Open Graph Preview]** opens its
   > connection graph (see **W-38**).
7. **[en:tran:Verses]** starts closed and shows how many there are — some entries have hundreds
   (Jerusalem has 710). Click it to open, and the references turn into readable
   titles like _Joshua 10:1-43_.
8. Any underlined name or place — in the description or in a list — opens as another
   small window **beside** the one you are reading, so you can follow a family or a
   journey without losing your place. Person and place links use the language
   of the window you followed them from. Clicking the same entry twice in the
   same language just brings its window back to the front.
   Where a description names a book, a chapter or a single verse — _Acts_,
   _Genesis 14_, _Acts 28:15_ — it is written the way **your own Bible** writes it
   when the record window's language is other than English, so a Khmer sentence
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
    **[en:tran:Approximate location, the marker is an estimated point]**, with an **[en:tran:Open in Google Maps]** link. The map needs an internet connection; places without
    coordinates (Egypt, for example) simply show no map. 📸
11. **⋮** → **[en:tran:Copy]** in a person's or a place's window copies the whole entry — its name
    with the English one in brackets, and all of its verse references whether or not you
    opened the **[en:tran:Verses]** section — ready to paste into a note or a document.
    In a verse window the same **[en:tran:Copy]** opens the copy menu of a Bible
    view: **[en:tran:Copy Title]**, **[en:tran:Copy Text]**, **[en:tran:Copy All]**, the two
    keys, and **[en:tran:More…]**, which lists every way to write the title and the text
    (the version before or after the title or left out; verses numbered `(1):`, `1:` or not
    at all). Rest the mouse on a row to see what it copies.
12. Closing the lookup window leaves the record windows you opened where they are.
    Each has its own **×**.
13. **Ask the assistant about it.** The robot at the left end of a record window's
    title bar — **[en:tran:Ask the Assistant About This Person]**, **[en:tran:Ask the Assistant About This Place]**,
    or on a verse window **[en:tran:Ask the Assistant About This Passage]** — opens the
    help window (**W-42**) in a chat of its own about what that window shows. It is
    there only while AI features are on, and it asks the same two questions the
    🤖 asks first. The chat reads the whole record from the app — the description,
    the family and the places, every verse reference and the first verses
    themselves — says it is ready and offers a few questions to press, such as
    _Who was Adam?_. Everything you type in that chat is then about that person,
    place or passage, and the assistant looks up the people, places and verses it
    leads to by itself. The names and places come from the King James Version,
    and the assistant says so if you ask. The **[en:tran:Still asking about]** line above
    the box names it; press its **×** to ask about something else. A person's
    card also carries **[en:tran:Family line to Jesus]**, which reads the Bible's
    own genealogy — Matthew 1:1-17, or Luke 3:23-38 when Matthew does not name
    them — and answers with it; _how many children did he have?_ is counted
    from the record itself, with every name; and a question about a theme or a
    verse you half-remember is searched in your Bible. 📸
    A passage you are reading opens the same way: the robot at the end of a Bible
    view's toolbar (the row that shows when the mouse is over its title), or
    right-click the text and choose **[en:tran:Ask the Assistant About This Verse]** for
    the verse under the mouse or **[en:tran:Ask the Assistant About This Passage]** for
    the whole passage. Or select some words of a verse: the bar that comes up over them
    (W-40) ends with a robot, **[en:tran:Ask the assistant about this]**, which opens that
    verse's chat — the one already on it, when there is one — and puts the words in the
    box: _Selected text_, the verse and their first and last character in it, then the
    whole verse with the selected words between two asterisks. The cursor waits on the
    line under it for your question.
    **Or open it from the menu of a passage.** Anywhere a passage has
    **[en:tran:Open]** in its menu — a row of your Bibles list, an entry of the
    lookup's history strip at the top, a Bible Find result, a cross reference, or a
    passage a heading cites — **[en:tran:Open in Chatbot]** sits right under it and
    opens the same chat. The card says which Bible the passage was read in (_I have
    read Matthew 18:15-17 in the Bible KJV_), and the assistant is told that Bible
    with every question, so it quotes the passage from it.
    **Buttons do the rest, with no question needed.** Under a passage's card:
    **[en:tran:Open in bible lookup]**, **[en:tran:Previous chapter]** and **[en:tran:Next chapter]**
    (**[en:tran:Previous verse]** and **[en:tran:Next verse]** for a single verse),
    **[en:tran:Read it in another Bible]**, **[en:tran:Who and where is in it]**,
    **[en:tran:Open another passage]** (type the one you want, like _John 3:16_),
    **[en:tran:Save to my Bibles list]** and **[en:tran:Copy the passage]**. Under a person's or a
    place's card: **[en:tran:Its verses]**, **[en:tran:Family and places]** (a place:
    **[en:tran:Related places]**), **[en:tran:Read it in another Bible]** and, for a place
    that has coordinates, **[en:tran:Show it on a map]**. A name, a place, a
    verse or a Bible in the list that comes back opens its own card in the same chat, and
    every answer ends with **[en:tran:More things to do]**.
    **Ask for one of them and it tells you which button.** Type _show this passage in Khmer_
    and the chat lists the Khmer Bibles on this computer to choose from — or shows the
    passage again when it is already in that language — and on an English passage _show this passage in English_
    repeats the record's own words. _How do I save this?_ and _copy this passage_ name
    **[en:tran:Save to my Bibles list]** and **[en:tran:Copy the passage]** and put the
    button beside the answer. Ask to keep something that is not the passage itself —
    _save to a bible note_, _save the preaching lesson to a file_ — and no button is named:
    the assistant writes it into a new Bible note, which opens in its own window (W-60). A
    question about using the app — _how do I put this passage
    on the screen?_ — is answered by the app's own help, with the Presenter's Bible Lookup.
    **Everything related to it.** As a passage's card opens it also gathers what the
    app's own cross references — the same ones the Reader's
    **[en:tran:Cross References]** shows — lead to from it, and the study files
    **[en:tran:Resources]** has for its chapter, and says how many: _The app's cross
    references lead from it to 952 other verses. Resources has 3 study files for its
    chapter._ **[en:tran:Related verses]** lists what most of its verses point to, where
    the New Testament speaks of it (the Old Testament, for a passage of the New) — and of
    the chapters around it, the rest of the same story, such as Jesus on the days of Noah
    under Genesis 8 — and each verse's theme, every reference a button that opens it in a
    card of its own, with its own related verses. **[en:tran:Study files for this chapter]** lists the files, each
    with **Ask about …**. Or just ask: _Which other verses are related to this passage?_
    is the first question on the card, and _where else does God remember someone?_ or
    _what does verse 22 promise, and where is it promised again?_ are answered from those
    cross references, each verse named the way your Bible names it and quoted from it. A
    question about one verse by its number reads that verse's own cross references first,
    and one about what came before or after — _what did Jesus teach after this?_, _how long
    was Noah in the ark?_ — reads the verses right before or after the passage first and
    answers from them. Your own study comes too: when one of your Bible notes names a
    verse of the passage, or you highlighted or commented on its words, the card says
    so — _You have notes or marks of your own on 3 of its verses._ — and its first
    question is _What did I note on these verses?_, answered with your notes and marks,
    as yours.
    **Study its words.** A passage's card also carries **[en:tran:Study the words]**.
    For a passage of several verses it asks which verse, a button for each with its
    first words; press one and the verse comes up with a button for every word in it,
    in its Bible's own spelling, and **[en:tran:All words]** first. Press a word and the
    assistant teaches it in the language the app is shown in: the word as the verse
    writes it, its dictionary form, how to say it, what kind of word it is and what it
    means in this verse — a Greek or Hebrew word stays in its own letters. Under the
    lesson, one button goes on to the verse's next word, **[en:tran:Choose a word]**
    brings the verse's words back, and another searches Google for the word in your
    browser. **[en:tran:All words]** teaches every word of the verse, one line each,
    and ends with **[en:tran:Next verse]** and **[en:tran:Another verse]**. Or type it:
    _teach me the vocabulary_ opens the verse list, and _explain each word in verse 1_
    teaches verse 1's words straight away. 📸

**Tip:** the text of a person's, place's or passage's window grows and shrinks with your
Bible text, so the bible font slider (or **Ctrl+Scroll** on the verses) resizes it too. The
list of names and places and the small buttons on a window's title bar keep their size.

**A note on what is translated:** a person's kind and **[en:tran:Gender]** and a place's **[en:tran:Type]**
come in the lookup language — Jacob is **ប្រុស**, the Pool of Siloam a **ស្រះ** — because each
is one word out of a short, fixed list. A person's **[en:tran:Age]** comes in it too, its number kept: the datasets write
every age in one of three set phrases, such as _175 years_. Only a phrase or a word — a gender, a
place type — a newer dataset adds before the app knows it is shown exactly as the dataset wrote it.

_Verify: RD-53, RD-54, RD-55, RD-56, RD-57, RD-58, RD-59, RD-60, RD-61, RD-62, RD-63,
RD-64, RD-80, RD-91, PM-126, CB-149, CB-154, CB-162._

### W-30 — See who and where is in the passage you are reading

**Goal:** while you read, get the list of every person and place the Bible names in
those exact verses — without searching for them one by one.

1. Open the **[en:tran:Bible Reader]** (or the **[en:tran:Bible Lookup]** popup in the Presenter) and read
   a passage. At the top right, click **[en:tran:Advance Bible Lookup]** (the binoculars). A panel
   opens on the right, its header a **drop-down** listing four views: **[en:tran:Find]**, **[en:tran:Cross Reference]**, **[en:tran:Location-Name (KJV)]** and **[en:tran:Resources]**. Pick **[en:tran:Location-Name (KJV)]** — by its name, not by its place in the list, which moves as views are added. 📸
   _The icon to the left of the drop-down changes with your pick — a signpost for cross
   references, a map pin for names and locations — so you can tell at a glance which
   view the panel is showing._
2. Under the heading **[en:tran:Names and locations in your reading]** — it says **(KJV)** too
   while you are reading these records in English; see the note at the end — you get
   **one block
   per passage you have open**. Each block is titled with the passage it belongs to,
   e.g. `(KJV) Luke 13:1-35`, and lists **[en:tran:Names]** first, then **[en:tran:Locations]**, with a count beside each. 📸
   _One block per passage, not per pane: two panes reading the same verses in two
   versions share one block, and the pane you are typing in is listed by what its
   reference box says. A passage that runs on into later chapters gets a block for
   each chapter, its first three only._
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

**The names in this list follow the lookup language** — the little language code beside
the person-and-pin button (**W-29** step 2), not the language of the app, and they are set
in that language's own font. The passage heading above each block is named the way **your
Bible** names it — by the King James while the lookup language is English — and the **(KJV)** note beside the title only appears while that heading is
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

**The ✨ is not the 🤖.** The **✨** opens a company's own AI chat website — ChatGPT,
Claude, Gemini and the like — in a box, signed in with your own account there. The **🤖**
is the app's own assistant: it answers from this
manual and can point at things in the app. This is not the app's own assistant (W-42): nothing here reads this manual or presses
anything in the app, and no API key is needed. It is the site itself, in a box.

1. Click the **✨** ([en:tran:AI Chat]) button in the top-right corner of the window, right
   of the **🤖** and left of the **?**, or open **Help** → **AI Chat** in the menu bar. From
   a window with no top bar, use **Tools** → **[en:tran:AI Chat]**. Answer the **[en:tran:Be careful with AI]** question with
   **[en:tran:Open]**, and a narrow window opens beside the app, the same size and place as the
   help window. 📸 It works whether or not **AI
   features** is switched on in Settings → **[en:tran:AI Providers]**: this window holds no key and opens no
   door of the app's.
2. The window opens on a card, **[en:tran:Choose an AI chat to use in this window]**, listing the
   sites. Click one. The site loads in the window, and its own sign-in appears if you are
   not signed in; sign in there exactly as you would in a browser. You stay signed in the
   next time the app starts. 📸
3. The row above the site says **[en:tran:Chat with]** and which site it is. Change it there to move
   the same tab to another site. Beside it: **←** goes back a page, **↻** reloads,
   **↗** (**[en:tran:Open in your browser]**) opens the same page in your normal browser — for the one
   thing a boxed site cannot do, such as a sign-in that insists on opening a popup window —
   and **↤** (**[en:tran:Sign out of every site]**), which is step 7.
4. The strip of **tabs** along the top works like the help window's (W-42 step 2): **+**
   starts another tab (it opens on the card again), **×** closes one, a **double-click on a
   tab's name** renames it, and the **⋮** on a tab (or a right-click) opens **[en:tran:Rename this chat]**,
   **[en:tran:Lock this chat]**, **[en:tran:Close this chat]**, **[en:tran:Close other chats…]** and **[en:tran:Clear all chats…]**. Until you rename
   it, a tab is called after the page — the conversation's own name, on most of these
   sites. Tabs are kept when the window and the app close, up to eight of them, and each
   comes back on the conversation it was on. 📸 **Drag a tab** along the strip to put it
   somewhere else among the others.
   **Closed one by mistake?** A closed tab is not lost: it goes to **[en:tran:Recently closed]**,
   listed on the card a new tab opens on and behind the **🕘** (**[en:tran:Recently closed tabs]**) in
   the row above the page. Click it and it opens again on the conversation it was on;
   **Ctrl+Shift+T** brings back the last one. The list is shared by every AI Chat window,
   keeps the last twenty, and **[en:tran:Clear this list]** under it empties it. 📸

5. Only three tabs keep their site loaded at once — the one in front and the two you used
   most recently. The others unload to save memory and load their last page again when
   you click them, which takes a second and loses nothing: the conversation lives on the
   site, under your account.
   **More than one window.** Each press of the **✨** opens another AI Chat window, and so
   does the **[en:tran:New window]** button right of **+** in the strip — up to three at once; a
   fourth press brings the open ones forward instead, because every open site takes
   memory. Each window keeps its own tabs. To give a tab a window of its own, **drag it out**
   of the strip and let go anywhere outside the window, or choose **[en:tran:Open in new window]**
   from its **⋮**: a new window opens holding that tab, on the conversation it was on, and
   the tab leaves the first window. You stay signed in, because every window shares the
   same sign-ins. 📸

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
   closes?_ 📸 **[en:tran:Allow]** lets that site hear you; **[en:tran:Don’t allow]** — already selected, so
   Enter or Escape picks it — keeps the microphone off, and the site shows its own
   "blocked" message until you press its button and answer again. A yes is for that one
   site, lasts until the app closes, and only counts while its tab is the one in front; a
   tab behind is never let in. **[en:tran:Sign out of every site]** (step 7) takes it back. The
   camera stays off whatever you answer.

7. **Sharing this computer?** You stay signed in to these sites until you say otherwise,
   and closing the tabs does not sign you out — that is worth knowing in a church back
   room where several people use the same machine. Click **↤** (**[en:tran:Sign out of every site]**) in the row above the page, or the same words on
   the card in step 2, and answer **[en:tran:Sign out]**. 📸 It asks first, and
   **[en:tran:Keep me signed in]** is the answer already
   selected, so a mis-click costs nothing. It signs out of every site in every AI Chat
   window, since they all share the one sign-in. Your tabs stay where they are; the pages
   they were on, the names the sites gave them and the **[en:tran:Recently closed]** list are
   forgotten, a name you typed on a tab yourself is kept, and every site asks you to sign
   in again. It cannot be undone.

**Not loading?** The window says _… could not be loaded_ with a **[en:tran:Try again]** button when
the site cannot be reached — check the building's internet first. A site that refuses to
sign you in inside the window can be opened in your browser with **↗** and used there.

_Verify: CB-68._

---

### W-46 — Learn the page with Tips of the Day

**Goal:** learn each operator page at your own pace and see the exact
control without having to search the manual.

1. Five minutes after an operator page is first opened in its window, it
   shows one **[en:tran:Tip of the Day]** in the top-right corner — never at launch,
   when it would cover the controls you reach for while opening the service.
   Reloading, or going back to a page, does not restart its five minutes; a page
   opened later — the Reader after the Presenter, a Settings window — waits five
   minutes of its own. The card then takes itself off after one minute: a thin bar
   along its bottom edge drains over that minute, and resting the mouse
   pointer on the card freezes the bar and the minute with it, so nothing
   disappears while you are reading it. Moving away carries on from where the
   bar stopped. **[en:tran:Next tip]** starts the minute again, browsing **[en:tran:All tips]**
   holds it, and **×** closes the card at once. The tip
   belongs to that page only, and the first tip is chosen at random without
   repeating the last tip shown on that page. **Help → [en:tran:Tips of the Day]**
   opens one at once in EVERY open window that has tips — the main window and
   each open Settings, Bible Note, editor or Local Web Share window, each with
   its own page's tip — and a tip opened that way stands in for that page's
   automatic card. A card you asked for from Help has no
   **[en:tran:Hide for 30 days]**: that link is on the automatic card only.
   **Help → [en:tran:All tips]** does the same with each page's list. Those
   windows hide their menu bar, so the main window's **Help** is how you ask
   for their tips. Settings, Slide Editor, Bible Note, Web Editor, Lyric
   Editor, and Local Web Share also have their own tips. Each page remembers
   whether its automatic tip has already appeared; visiting another page lets
   you learn that page too. Audience screens and help-only windows show no tips.
2. Click **[en:tran:Next tip]** to move through that page's tips in order. The list wraps to
   the first tip after the last. Click **[en:tran:All tips]** to open the numbered learning
   list for the current page. Search by a control or task, or scan the topic name
   that leads each lesson's line;
   the counter shows how many lessons match. Each lesson says what it teaches;
   choose one to return to its card and practise it at your own pace: press
   **[en:tran:Show it]** on the card to start it — the control is ringed in red — and then
   **[en:tran:Do it]** for each safe step. The
   Presenter has **91 topics**: 81 start with a safe **[en:tran:Do it]** for a visible
   control or shortcut, while ten disruptive or native-menu lessons stay self-guided. They
   cover documents and slides, audience screens, backgrounds and media, service
   planning, app help, and every native application menu from **File** through
   **Help**. _[en:tran:Write a note on a document or slide]_ opens the previewer's **[en:tran:Note]**
   panel, which ships closed (W-03, W-31). Presenter lessons also cover lookup references and history, study
   tools inside Bible Lookup, media folder filtering and sorting, finding a service
   flow, and **[en:tran:Messages]** for separate notices, rotation and spacing
   (_[en:tran:Prepare several audience messages]_, _[en:tran:Rotate notices before the service]_ and _[en:tran:Give audience messages room to breathe]_) — search
   **[en:tran:Messages]** in **[en:tran:All tips]** to find them.
   Foreground lessons explain **[en:tran:Effects]** and preparing an Image Show
   slide show; output and style changes stay in your hands.
   The Reader has **106 topics**: 52 start with a safe **[en:tran:Do it]** and
   54 stateful, file-dependent, native-menu, pane-visibility or audience-output lessons stay
   self-guided. They cover reference entry and
   history, reading panes and formatting, Find and cross references,
   people/places and connection graphs, Resources, verse marks and notes,
   presenting a verse, the Reader header, every native application menu, and
   detailed lessons for every command under **View**. The **×** closes the card
   for now; reloading a page does not show its automatic card again in the same
   window session. A page whose delay expires while it is behind another window
   waits until you focus it.
3. With Settings open, **Help → [en:tran:All tips]** in the main window's
   menu bar shows Settings' own list inside Settings: four lessons for **[en:tran:General]**,
   **[en:tran:Path Settings]**, **[en:tran:Bible]**, and **[en:tran:Others]**. Choose **[en:tran:Explore General settings]**, then **[en:tran:Show it]**:
   the demo card and its red outline appear inside Settings.
   **[en:tran:Show it]** always starts in the originating window, even when a popup and
   the main window show the same kind of page. With an actionable lesson, the control
   is ringed in red. This uses a checked-in walkthrough and no model or provider
   credit. The deterministic walkthroughs open, copy, toggle, or
   adjust safe app controls. Press **[en:tran:Do it]** once per actionable step; when the
   safe setup is complete, an explanation-only follow-up uses **[en:tran:Next]**, never a
   disabled or failing **[en:tran:Do it]**. If the renderer refreshed before the local
   walkthrough service, Show it sends the current lesson inline and still opens
   the card. Steps that would present, control an audience screen, export, or use
   a disruptive native-menu action remain self-guided numbered cards.
   In the Reader, search for **[en:tran:Copy Text]**, **[en:tran:New File]**,
   **[en:tran:Search file name]**, or **[en:tran:Find Connection]** to find a
   focused lesson. Each tip explains when to use that control. Saved Bibles
   lists and Bible Notes have separate folder, creation, organization and
   import/export tips — open **Help → [en:tran:All tips]** in the Reader and search
   **[en:tran:New File]** to find them. Graph and Resources tools have their own lessons
   too: the graph's, its presets among them, are found by searching the word **graph**.
   The **[en:tran:Resources]** lessons are found by searching the word **resource**.
   Use **[en:tran:Back]** to revisit a guide step. If a panel is hidden, reopen it through
   **View → [en:tran:Widgets]** before practising. An older walkthrough service can
   show the complete Reader lesson as a self-guided fallback.
   Reader lessons that depend on selected text, files, a graph, or the native
   menu are self-guided too. They explain the exact action but do not reload,
   relaunch, export, reset the layout, open Developer Tools, or change what the
   congregation sees. If **AI features** is off, the app
   offers to open Settings → **[en:tran:AI Providers]** because the local walkthrough server is
   switched off with it.
4. On the automatic card, click **[en:tran:Hide for 30 days]** to put automatic tips away on all operator
   pages for 30 days; after that they come back by themselves. This does not
   remove the lessons: use **Help → [en:tran:Tips of the Day]** to
   open one suggestion, or **Help → [en:tran:All tips]** to browse the whole learning list
   for the page in front. Opening either from Help does not end the 30 days.
   To bring the automatic card back sooner, open **Settings → [en:tran:General] → [en:tran:Other General Options]**, turn on **[en:tran:Show Tips of the Day automatically]**, and
   start the app again; that switch reads off while the tips are hidden. Turned
   off there instead, automatic tips stay off until the switch is turned on
   again. The switch covers every supported operator page.

The **File**, **Edit**, **Tools**, **Window**, and **Help** overviews name every
row users can encounter, including conditional and macOS-only rows, so searching
for a command finds the menu that owns it. They are self-guided because Electron
draws the operating-system menu outside the page and a walkthrough cannot safely
ring or press it. The detailed **View** lessons remain separate so each View
command can explain its effect and risk.

For support information, open **Help → Copy Debug Info** or
**Help → Copy Full Debug Info**. Both commands are in **Help**; the full
version also includes the complete build metadata.

The Presenter and Reader catalogs deliberately keep **Reload**, **Force Reload**,
**Relaunch** and **Toggle Developer Tools** under the **[en:tran:View menu]** topic for
completeness, but do not put those troubleshooting commands into the random
daily rotation.
**Actual Size / Zoom In / Zoom Out** are taught as whole-window zoom, separately
from the passage's **[en:tran:Font Size]**. **Toggle Full Screen** is taught as whole-window
full screen, separately from the passage's **[en:tran:Full]** button. **[en:tran:Widgets]** explains
the checked pane list; **[en:tran:Reset Widgets Size]** explains its confirmation and that
it both restores default sizes and reopens collapsed panes.

_Verify: GL-25._

---

### W-54 — Move your data folder off the Desktop (OneDrive)

**Goal:** keep your songs, slides, Bibles and settings where a backup program cannot
take them away.

The app used to make its data folder on the Desktop, `Desktop\open-worship-data`. On
Windows, Microsoft OneDrive often backs up the Desktop, and while it syncs it can
replace files with online-only copies or take them off the computer — songs, slides
and settings went missing. A new data folder now goes to `.owa\open-worship-data` in
your user folder (`~/.owa/open-worship-data` on a Mac or Linux), which nothing syncs.

1. Start the app. While your data folder is still `Desktop\open-worship-data`, every
   start asks **[en:tran:Move Your Data Folder Off the Desktop]**. It names your folder,
   says why it is at risk on this computer — OneDrive on Windows, iCloud Drive on a
   Mac — and where it will go. Until it is moved, every window also shows a card with
   the same title, saying the Desktop is not a safe place for your data folder, with
   **[en:tran:Move Now]** and **[en:tran:Hide for 30 days]**. 📸
2. Press **[en:tran:Move Now]**. The app closes and opens again, and moves the folder
   before it opens anything in it. Outside OneDrive the folder is simply moved. Inside
   OneDrive, or when a file in it is in use, every file is copied and checked, and the
   old folder stays where it was.
3. **[en:tran:Data Folder Moved]** says where your data is now — and, after a copy,
   where the old copy is. Press **[en:tran:Ok]**. Pictures, videos and songs still
   show: links that named the old place follow the folder. 📸
4. After a copy, every start shows **[en:tran:Old Copy of Your Data Folder]** with the
   day it was moved. Check that your songs and slides are all there, then press
   **[en:tran:Show Folder]** and move the old folder to the Recycle Bin (Trash)
   yourself — the app never deletes it. Once it is gone, the reminder stops. 📸
5. Not now? **[en:tran:Not Now]** asks again at the next start.
   **[en:tran:Hide for 30 days]** keeps the question away for 30 days.

> Notes: `migration-moved-from.txt` in the new folder says where it came from and
> when; `migration-moved-to.txt` in an old copy says where it went. A move that fails
> changes nothing: **[en:tran:Data Folder Not Moved]** says why, the app keeps using
> the folder where it is, and it asks again at the next start. On a Mac, a file that is
> only in iCloud Drive stops the move until it is downloaded (Finder → **Download
> Now**). The new folder's name starts with a dot, so Finder and Linux file managers
> hide it; the folder picker in Settings shows it.

Steps 1–5 were observed live 2026-10-17 on a scratch dev profile with a throwaway
Desktop folder, in English and Khmer: the question with each of its three answers,
the move as the app started again (renamed; then copied, with a file held open), the
result, the reminder with its date in Khmer digits, and the reminder gone once the old
copy was. **[en:tran:Show Folder]** was not pressed — it opens the computer's file
window — and is unit-tested. Not seen live: OneDrive itself (the copy was forced by a
file held open) and a Mac.

_Verify: ST-20, ST-80, ST-81, ST-82._

### W-64 — Connect your own AI agent to the app (MCP)

**Goal:** let an AI agent you run on this computer — Claude Code, Claude Desktop, Cursor
or another program that speaks MCP (the Model Context Protocol) — see Open Worship and
use it the way the app's own assistant does. The program the agent talks to comes with
the download tools, so the computer needs nothing else installed.

1. Open **[en:tran:Setting]** → **[en:tran:Others]** → **[en:tran:Extra Binaries]**. If it
   reads **[en:tran:Not installed]**, press **[en:tran:Download and Install]** (W-21); if it
   offers **[en:tran:Update to]**, press that — tools from before version 0.0.6 have no
   program for an agent. 📸
2. Once the tools are installed, the card has an **[en:tran:AI agents (MCP)]** picker.
   Choose your AI program in it: under **[en:tran:Terminal command]** the ones set up by
   typing a command (Claude Code, Codex — which the ChatGPT desktop app shares —, Gemini
   CLI, GitHub Copilot CLI …), under **[en:tran:Settings file]** the ones set up in a file
   (Claude Desktop, Cursor, Windsurf, VS Code, Zed, Cline, Continue …), and under
   **[en:tran:Others]** a plain JSON block for any other program, or
   **[en:tran:Program path]**, the program's own path. Under the picker is the text for
   the program chosen: a command, with **[en:tran:Run this in a terminal.]**, or what goes
   in its settings file, with **[en:tran:Paste into:]** and that file. Press
   **[en:tran:Copy]** — a note at the top right says the text has been copied — and paste
   it there. The picker keeps your choice for next time. 📸
3. Keep Open Worship open: the agent finds the open app by itself. It needs the app's AI
   features on (**[en:tran:AI Providers]** → **[en:tran:Enable AI features]**, which is on
   unless someone turned it off).
4. Ask the agent about the app, for example _what is on the screen?_ When it presses
   something, a note at the bottom of the window says the assistant did. Like the app's
   own assistant it may point at anything and press most things, but a button that
   cannot be undone — delete, remove, clear all … — stays yours to press.
5. With more than one Open Worship open on this computer — the installed app and a test
   copy, say — the agent lists them (each by its data profile, kind and version) and asks
   you which one to work with; it does nothing in any of them until you answer. It also
   checks that its program is the same version as the app, and tells you when it is not.

> Notes: the program sits in your data folder under `extra-bin`, in a folder called
> `mcp` with a `README.md` beside it. Keep that folder whole: the program reads the
> files beside it. The command puts the program's path in single quotes on a Mac or
> Linux and in double quotes on Windows, because a data folder's path can have spaces.
> Tools installed from a file (W-21) carry the program too when the file is from
> version 0.0.6 or later. ChatGPT in a web browser cannot start a program on this
> computer; the ChatGPT desktop app reaches it through Codex's settings.

Steps 1–4 were observed live 2026-11-13 on a scratch dev profile on a Mac, in English
and Khmer: **[en:tran:Download and Install]** put 0.0.6 in, the line showed the command,
**[en:tran:Copy]** put exactly that command on the clipboard with its note and the
line's JSON button (gone since) the JSON; the program, started on its own with no setting,
found the app, took a picture of the Presenter, pressed a Settings tab and refused
_Delete everything_; Claude Code took the copied command and reported it connected.
With the program's folder moved away the card still read **[en:tran:Installed]** and
the line was gone. The picker (step 2) was seen live the same day on the dev app and on
a scratch instance in Khmer: Claude Code, Cursor, the Codex config file, Continue and
**[en:tran:Program path]** each put exactly the text shown on the clipboard, Cursor and
Claude Desktop named their files, and the choice was still there after the tab was left
and opened again. Step 5 was seen through a fresh copy of the program with two and then
three apps open: it listed them, answered every press with the list until one was chosen,
then worked in that one alone, following a switch to another. Not seen live: Claude
Desktop or Cursor themselves, Windows or Linux, an update from 0.0.5.

_Verify: ST-93, MD-05._

## Keyboard shortcut reference (tutorial appendix)

Every page lists its own keys, searchable, under **Help → [en:tran:Keyboard Shortcuts]** (W-49). This table is the short version.

| Keys                                 | Does                                                                    | Where                                                                 |
| ------------------------------------ | ----------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `Ctrl+B`                             | Open Bible Lookup                                                       | Presenter / Editor                                                    |
| `Ctrl+Q`                             | Close the Bible Lookup popup                                            | Presenter / Editor, Bible Lookup open                                 |
| `F5`                                 | Show / hide the selected screens (all, when none is selected)           | Presenter                                                             |
| `F6` / `F7` / `F8` / `F9` / `F10`    | Clear All / Background / Slide / Bible / Foreground                     | Presenter                                                             |
| `Ctrl/Alt+ArrowLeft/Right`           | Previous / next Bible verse                                             | the output screen                                                     |
| Arrows, `PageUp`/`PageDown`, `Space` | Next / previous slide (`Shift+Space` goes back)                         | slide thumbnails focused                                              |
| Arrows, `PageUp`/`PageDown`, `Space` | Next / previous part, stopping at either end (`Shift+Space` goes back)  | Long Text Show, its lit part focused                                  |
| `Tab` / `Escape` / `Shift+Escape`    | Complete the reference / remove its last part / clear it                | lookup & reader                                                       |
| `Ctrl+Enter`                         | Focus the editing canvas                                                | Slide Editor                                                          |
| `Ctrl+S`                             | Save                                                                    | Slide Editor, Bible Note, Lyric Editor (Web Editor saves itself)      |
| `Enter` / `Escape`                   | Confirm / cancel                                                        | confirmation dialogs                                                  |
| `Ctrl+Shift+P`                       | Start or stop Presenting Control (draw & spotlight on the app)          | every window                                                          |
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
dragging its divider all the way to the edge — it shrinks to a thin grey-striped strip with
its name on it, and clicking that strip brings it back. The **View** menu on the top
menu bar does the same thing by name, which is easier when the strip is hard to find.
And the divider itself has a right-click menu that does it in place (steps 7–9) —
the only way in a popup window, whose menu bar is hidden.

1. Open **View** on the top menu bar → **[en:tran:Widgets]**. 📸
   You get one tick-box per panel on the page you are looking at, e.g. on the
   presenter: `App Presenter Left` / `App Presenter Middle` / `App Presenter Right`,
   `Document List`, `Presenting Flow List`, `Presenter`, `Background`,
   `Bible and Notes`, `Mini Screen`, `Bibles`, `Bible Notes`, `Previewer`, `Slides`,
   `Note`.
   In the Reader, the three horizontal sections are **[en:tran:Bible and Notes]**,
   **[en:tran:Bible Lookup]**, and **[en:tran:Advance Lookup]**. The top-right
   **[en:tran:Advance Bible Lookup]** binoculars toggle that same Advance Lookup section.
   - **Ticked** = the panel is open. **Unticked** = it is collapsed to its strip.
   - `Note` — the document and slide notes under the slide previews (W-03) — is a
     panel that **starts unticked**: it ships collapsed to its strip,
     because most services never need it. Tick it, or click the strip, to open it.
     **[en:tran:Advance Lookup]**, which the binoculars open, starts unticked too.
2. Click a ticked one — that panel collapses to its strip, and the space goes to
   its neighbour. 📸
3. Click it again — the panel comes straight back. Nothing reloads and nothing you
   were doing is interrupted.
4. Panels that the app does not let you collapse (the Background media/audio split,
   the bible previewer, the lyric Stage Previewer) are simply not listed.

**Put everything back:**

5. Open **View** on the top menu bar again and click
   **[en:tran:Reset Widgets Size]**. Do not open **[en:tran:Widgets]** for this one:
   **[en:tran:Reset Widgets Size]** is a row of the **View** menu itself, the row
   right under **[en:tran:Widgets]**. Answer **[en:tran:Yes]** to
   `Are you sure to reset every widget size and reopen the widgets?` 📸
6. Every panel returns to the width and height it had when the app was installed, and
   **any panel you had collapsed is reopened** — except **[en:tran:Note]**, which goes back to
   its strip, the way it shipped. This happens immediately — no reload.
   Answer **[en:tran:No]** and nothing changes.

**Or use the divider between two panels** — no menu bar needed, so this also works
in a popup window:

7. Right-click the **divider between Document List and Presenting Flow List** — the
   thin line between the two panels on the left of the presenter (every divider in the
   app has this menu, though one between two panels you cannot collapse, as in step 4,
   offers only **[en:tran:Reset Size]**) — and choose **[en:tran:Close First Widget]**. 📸 The first of
   the two panels (the left one, or the upper one) collapses to its strip and the
   other takes its space. `Close Second Widget` does the same to the other panel. The
   menu holds those two and **[en:tran:Reset Size]** (step 9), nothing else.
   Hovering the divider shows the same two choices as small arrows, each named for
   the side it closes — **[en:tran:Collapse left panel]** / **[en:tran:Collapse right panel]**,
   or **[en:tran:Collapse top panel]** / **[en:tran:Collapse bottom panel]** on a
   divider between an upper and a lower panel. A collapsed panel has no divider — if
   one of the two is already a strip, click the strip first.
8. Click the **[en:tran:Document List]** strip — the panel comes straight back.
9. Right-click the **divider between Document List and Presenting Flow List** again and
   choose **[en:tran:Reset Size]** — just those two panels return to the sizes they
   shipped with. Double-clicking the divider does the same. The View menu's
   `Reset Widgets Size` (step 5) is the version for every panel at once.

**With the keyboard:** press **Tab** until a divider shows a blue outline. The **Menu**
key (or **Shift+F10**) opens the same menu as the right-click, and the arrow keys move
the divider — **←/→** for one between side-by-side panels, **↑/↓** for one between an
upper and a lower panel, **Shift** for bigger steps. The arrows never collapse a panel;
the menu does that.

> This used to be a button in Settings → General, where it did nothing until you also
> clicked **[en:tran:Apply Settings]** and the app reloaded. It is on the View menu now and takes
> effect at once.

_Verify: NAV-20, NAV-21, ST-22, GL-17, GL-18._

### W-32 — See who published a Bible translation (and its copyright)

**Goal:** find out which edition of the Bible you are reading — its publisher,
version, language and copyright notice — without leaving the reader.

You do not need Settings for this. The information is one click away, but only while
you are still choosing what to read: once a verse is on screen the header gives that
space to the verse buttons instead.

1. Open **[en:tran:Bible Reader]** (see W-11) and make sure the lookup box at the top is
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
7. Left of the **ⓘ** sit the two split buttons, **[en:tran:Split horizontal]** and
   **[en:tran:Split vertical]** (also **Ctrl+Shift+S** / **Ctrl+Shift+V**, and in the
   **⋮** or right-click menu). A view always holds a passage, so the new one opens the
   book you picked at chapter 1 — or Genesis 1 if no book is picked yet — while the
   view you are typing in keeps its grid. 📸
   Moving the editing to another view (its pencil, **Ctrl+Shift+arrow**, or
   **[en:tran:Edit]** in its menu) does the same to the view you leave: it stays
   open on the book you picked at chapter 1, or on Genesis 1. 📸
8. Pick a book, then a chapter. As soon as the verses appear, the **ⓘ** is gone and the
   verse buttons (copy, split, save…) take its place, shown while the mouse is over
   the pane's top line. Clear the box again and it returns.

> Want to change any of this rather than just read it? That is still
> **Settings → [en:tran:Bible]**, the pencil next to the translation, then the **[en:tran:Info]** tab.

_Verify: RD-77, RD-78, RD-11, RD-26, LT-01, KB-25, KB-26, CM-79._

---

### W-33 — Share your Bible translations (XML) with another machine

Sharing a **bible list** moves only the verses you lined up. This shares the **translations
themselves**: the XML bibles you added or edited under **Settings → [en:tran:Bible]**, which
until now could only be moved by digging the files out by hand.

1. Open **[en:tran:Bible]**. Under the **[en:tran:Import XML File]** box on the left there is a card headed **[en:tran:Bible Data]**. 📸
2. Click **[en:tran:Export Bible Data]**. A panel opens listing every
   translation you have, one row each, showing its short **key** (`KJV`, `GKHB`, `ពគប`…)
   and its full title. Everything starts ticked. Untick the ones you do not want, or use
   **[en:tran:Deselect All]** and pick just a few. 📸
3. Below the list, the same **[en:tran:Password]** / **[en:tran:Confirm Password]** pair as every other export: leave both empty for the ordinary
   bundle, or type the same password in both to lock it. Type them differently and the
   app tells you **[en:tran:Passwords do not match]** in the panel itself and brings it straight
   back — still holding the bibles you ticked and the password you typed — so a mistyped
   password can never quietly produce an unprotected file, and you never have to pick your
   translations a second time.
4. Click **[en:tran:Ok]**. You get one `Bible Data.owabdata.tar.gz` in your **Downloads** folder
   (or `Bible Data.owabdata.enc` if you set a password), and the folder opens on it.
   The file is compressed, so a couple of translations come to only a few MB (a whole Bible takes about 1–2 MB in it).
5. On the other machine, open **Settings → [en:tran:Bible]** and **drag the file anywhere onto
   that page** — the whole Bible settings area accepts it, not just the small card. Or
   click **[en:tran:Import Bible Data]** and pick it. A protected
   bundle asks for its password first, and says **[en:tran:Wrong password, try again]** rather
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
7. Click **[en:tran:Ok]**. The ticked translations are added and the list on the right refreshes
   to show them. A message tells you how many came in and how many were skipped.

> Notes: an import **never replaces** a translation you already have, and never leaves
> you with two copies of one. That is the whole point of the red rows — where documents
> and backgrounds add a second copy as `a (1).mp4`, a bible is identified by its key,
> and two bibles with the same key would be ambiguous everywhere else in the app. If you
> genuinely want the incoming version, delete yours first (the 🗑 next to it) and import
> again.
>
> Only the **XML** translations are in the bundle — the ones listed under **[en:tran:Bibles XML]**.
> Bible versions you downloaded inside the app are not: they are hundreds of MB and can
> simply be downloaded again on the other machine.
>
> The check is done against the **file inside the bundle**, not against what the bundle
> claims — so a hand-edited bundle cannot talk the app into overwriting a bible.

_Verify: ST-34..ST-40, LT-01._

---

### W-34 — Add a Bible translation from the internet (XML), and make it read in its own language

Sharing your translations moves the ones you already have to another machine. This workflow
adds a translation from an XML link and lets you review its language and mappings before
saving it.

Example: `https://github.com/Beblia/Holy-Bible-XML-Format/raw/refs/heads/master/KhmerBible.xml`.
The GitHub redirect works as supplied. You can also use **[en:tran:Choose File]** for
an XML file already on your computer.

**The easy way: let the assistant do it**

**Import from the internet with the assistant.** Open **[en:tran:Settings]** → **[en:tran:Bible]** → **[en:tran:Let the assistant import a Bible for me]**, then accept the AI caution with **[en:tran:Open]**. Before it asks which language, it checks for the **KJV** Bible Open Worship provides. On a computer that does not have it, it says so, recommends it, and carries **[en:tran:Create the provided KJV]**: press that, and the app writes its own KJV with no internet and no download. The import you asked for then starts again from its language question. Choose the language and the Bible edition, read where it comes from, and press **[en:tran:I agree]**. Choose an unused short name, confirm the language, choose the numbers when asked, then choose one of the book-name lists. After all four choices, review the summary and press **[en:tran:Install it]**. Choose the installed translation from the Bible version button. You do not need a link or an AI key: this runs on buttons.

1. Open **[en:tran:Settings]** (the gear at the top of the window) → **[en:tran:Bible]** and press the blue
   **[en:tran:Let the assistant import a Bible for me]** at the top of
   **[en:tran:Import XML File]**. (Or open the assistant 🤖 and type
   `Import bible for khmer`, `Import bible`, or `Import bible from` and a link. Say it
   your own way: `I want a Khmer bible`, `Do you have a Korean bible?` and a country —
   `Import a Bible in Cambodia` — are understood too. And when you ask **how** to
   import a Bible, the answer has an **[en:tran:Import a Bible for me]** button that starts
   here.) Answer the _Be careful with AI_ question with **[en:tran:Open]**. 📸
2. Before the language question, a computer with no **KJV** is offered the one Open Worship
   provides: **[en:tran:Create the provided KJV]** writes it from the app's own copy, with no
   internet and no download, and then the import starts again here. (If you only
   wanted the KJV, that is done: the language question that follows needs no answer.) Press
   **[en:tran:Import another Bible anyway]** to go on without it.
   The assistant then asks **Which language do you want the Bible in?** Press
   the language the app is shown in, **[en:tran:English]** or another language you installed, or type the language — in English
   or in its own words (`Thai`, `ខ្មែរ`, `Español`) — or paste a link to a Bible file.
   **[en:tran:A file on this computer]** opens the form below instead. A word it cannot find
   (`kmer`) is passed to the assistant to work out the language you meant; with no
   assistant to ask, the question stays, with its buttons. A language you type that is
   turned off, or not installed and on the list Open Worship publishes, is offered first:
   the assistant says so and that it gives the app that language's Bible book names,
   numbers and search words (for a download, how big it is, and that the language the
   app is shown in does not change), with **[en:tran:Install it]** —
   **[en:tran:Enable]** for one turned off — and **[en:tran:Not now]**.
   **[en:tran:Install it]** says _Done — … is ready_ and goes on to the list;
   **[en:tran:Not now]** goes on to it without the language. Each language is asked about
   once in an import: one first met at Step 2 (step 6) is offered there, before the
   numbers. With no internet nothing is offered.
3. It lists **every** Bible in that language, up to twelve, from a free collection of about a
   thousand (Beblia, on GitHub), each with the title its own file gives — for Khmer,
   seven, from _Khmer Standard Version 1954 = Hammond Version_ to _Khmer BFBS (ព្រះគម្ពីរបរិសុទ្ធ ១៩៥៤)_. One you have installed is marked **you already have this
   one**, with its short name. Press the one you want, or type its number. 📸
4. It downloads and reads it, then says what it is — for example _66 books, 1,189
   chapters, 31,102 verses_, or _It has the New Testament only_ — and, when it is one
   you have, **You already have this Bible** with the name it is installed under
   (press **[en:tran:Cancel]**, or go on to keep a second copy under another name). Nothing is
   installed yet.
   Before it asks you anything, it says **where the Bible is from** and asks you to
   agree: it was found on the internet — in the free collection on GitHub, with that
   collection's address and the file's own — it is **not from Open Worship**, and you
   are **responsible to its publisher**: a Bible translation belongs to the publisher
   or Bible society that made it, and many are under copyright, so make sure the
   publisher allows how you will use it. Both addresses are links: press one to open
   it in your web browser, as **[en:tran:Open the website]** does for the collection (or the
   page the file was listed on). Press **[en:tran:I agree]** to go on, or **[en:tran:Cancel]** and
   nothing is installed. 📸
5. **Step 1 — a short name**: the options, four at most, are the names this app knows a Bible
   by, in the language the Bible is in — the language the next step confirms.
   In Khmer **ពគប**, **គខប**, **គកស១៦**, **អគត**, **GKHB**, **KCB**; in
   English **KJV**, **NKJV**, **NIV** and the rest; in French **LSG**. The one
   the downloaded edition is named after comes first. Hover a key to read its
   full name (Khmer 2023 is **GKHB**, hovering reads _ព្រះគម្ពីរខ្មែរសាកល_).
   A short name a Bible is already installed under is not offered at all. A
   language this app has no names for — Thai, or one not installed or turned off (W-55) — shows the file's own suggested
   names instead. You can also type your own, letters and numbers with no
   spaces; a name you type that you already have is refused and asked again.
6. **Step 2 — the language**: it says which it looks like and why (_the verses are
   written in Khmer script_). Press it, or type another, such as `ខ្មែរ`.
   Your choice controls the imported Bible's book names and numbers, even when
   the file was detected as another language. You can change it again while
   choosing numbers or book names; the choices reload for that language.
7. **Step 3 — numbers**: **០ ១ ២ ៣ …** or **0 1 2 3 …** (skipped for a language that
   writes 0–9).
8. **Step 4 — book names**: each list shows its first names, the names only it has,
   and how many of its names appear in this Bible's own verses; the suggested one
   uses the most. **[en:tran:Find more lists online]** adds lists from Bible.com and
   Wordproject. You can also paste a Bible website link here, including a chapter
   link. The assistant reads that edition's book-name list in your selected
   language and shows a source link. If it cannot find a complete matching list,
   your previous choices remain. 📸
9. **Ready to install** sums it up. Press **[en:tran:Install it]**. _Done — KSV is installed_:
   choose it from the Bible version button. **[en:tran:Undo]** under that answer moves it to
   the trash again. **[en:tran:Add another Bible]** under it starts another import in the
   same conversation, back at the language question — nothing of the one just
   installed is carried over. **[en:tran:Cancel]** at any step stops with nothing installed.

You can type instead of pressing at every step: `yes` (or `ok`) takes the suggested
choice — under the notice of where it is from, **[en:tran:I agree]**; at the end, **[en:tran:Install it]**
— a number takes that line of a list (`2`,
`list 2`), the words on a button press it, and `cancel` stops.

Pasting a link works the same way, and the link does not have to be the file: a
GitHub **page** of the file is turned into its download address, and a GitHub
**repository** lists its Bible files — type a word (`Khmer`, then `2019`) to narrow
the list. Under the language question, and under an answer that says a link did not
lead to a Bible, the link can be pasted on its own.

**When a window says a Bible is not available**

The Bible Reader or the Bible Lookup opens on _Bible key "KJV" is not available!_ when
it is set to a Bible this computer does not have — on a new computer, the KJV. **For the
KJV the card asks first**, one question at a time in each window: a question titled
**[en:tran:Create the KJV Bible?]** says Open Worship provides it and that creating it
needs no internet and no separate download, with **[en:tran:Create the provided KJV]**
and **[en:tran:Cancel]**. Agreeing writes the copy the app carries inside itself, with a
progress bar while it does, and the card goes away by itself in every window.
**[en:tran:Cancel]** leaves the card exactly as it was, with the same
**[en:tran:Create the provided KJV]** button under its heading (a window that cannot draw
a question shows that button alone). 📸

For any other missing Bible the card says how the assistant gets a Bible in your
language, in three steps, and carries the button:

1. Press **[en:tran:Let the assistant import a Bible for me]** on that card and
   answer the _Be careful with AI_ question with **[en:tran:Open]**. 📸
2. The assistant opens in a new tab already asking for a Bible in the language this
   window is shown in — Khmer in a Khmer window. A computer with no **KJV** is offered
   the one Open Worship provides first: press **[en:tran:Create the provided KJV]**. It is
   written from the app's own copy with no internet and no download, and any card saying
   the KJV is not available goes away by itself. Then the import starts again from its
   list of Bibles in that language;
   if you only wanted the KJV, press **[en:tran:Cancel]** there. 📸
3. Press the Bible you want in the list, or type its language (`Khmer`), then read
   where it comes from and press **[en:tran:I agree]**. Choose its short name, language, numbers
   and book names as above, then press **[en:tran:Install it]**. 📸
4. The imported Bible appears in the list at the top of the card: choose it there,
   and the card goes away with the passage showing.

Typing `Import the Bible called "KJV"` in the assistant gets the same offer: the
provided KJV first, and **[en:tran:Use the internet copy anyway]** still lets you
install one from the internet, after the source notice and **[en:tran:I agree]**.
Pasting a link to an English KJV from the internet is answered with a sentence saying
Open Worship provides it and recommends it, beside the downloaded file's own
**[en:tran:I agree]**.

**Import a Bible XML file with the form.** Give it the link or choose the file, press
**[en:tran:Import]**, answer the review, and press **[en:tran:Import]** again to install it:

1. Open **[en:tran:Settings]** → **[en:tran:Bible]**. In
   **[en:tran:Import XML File]**, paste the link into **[en:tran:URL:]** — or, for an XML
   file already on this computer, press **[en:tran:Choose File]** and pick it.
2. Press **[en:tran:Import]**. The download is read and its temporary file removed.
   **[en:tran:Review Bible import]** appears with the translation title. Nothing has
   been installed yet. 📸
3. Choose an unused **[en:tran:Bible key]**. Buttons suggest a language code, a code
   with the year, and usable words from the file header; you can type your own key.
   This becomes the badge and file name. Empty, unsafe or already installed keys
   cannot be imported, and the key is checked again when saving.
4. Review **[en:tran:Locale]**. A locale stored in the XML is kept; otherwise the
   filename provides a hint. `KhmerBible.xml` suggests `km-KH`. You can correct it.
5. Choose **[en:tran:Number mapping]**. Khmer offers `០ ១ ២ ៣ ៤ ៥ ៦ ៧ ៨ ៩` first
   and `0 1 2 3 4 5 6 7 8 9` as an alternative.
6. Choose **[en:tran:Book name mapping]**. With the Khmer language installed and turned on (W-55), its built-in naming sets appear first;
   online lookup adds complete lists from Bible.com and Wordproject. Each option
   shows its edition/source, and **[en:tran:Preview book names]** expands all 66 names.
   **[en:tran:Keep existing book names]** preserves the names already in the XML.
   The recommended option is a suggestion: select the wording your church uses.
   **[en:tran:Find more editions]** checks another batch when available;
   **[en:tran:Search for more book name lists]** opens a wider web search.
   If online sources fail, you can still choose built-in names or keep the existing map.
7. Press **[en:tran:Import]** in the review. The new translation appears in
   **[en:tran:Bibles XML]**. **[en:tran:Cancel]** exits the review without saving. 📸

**Where an imported Bible came from**

Every Bible imported this way — by the assistant or with the form — keeps a note of
where it came from: when it was imported and by whom, the link it was downloaded from
(and the file link really used, when a GitHub page was turned into its file), the
file's name and size, how many books, chapters and verses it has, and the key,
language, numbers and book names chosen for it. In **[en:tran:Bibles XML]** its row
shows **[en:tran:Source]:** and that link — press it to open the page in your
browser — and **[en:tran:Note]** under it opens the whole note. 📸 The note is part of
the Bible's info (`"note"` in the pencil → **[en:tran:Info]** editor), so you can add
to it or clear it there, and a Bible you export (W-33) takes it along. A Bible
imported before this note existed has none.

A Bible already installed whose book names or numbers still read in English needs no
second import, and nothing of the import — its review, the assistant's steps — is
needed again. Later changes remain available through the pencil beside the translation in
**[en:tran:Settings]** → **[en:tran:Bible]** (its name opens nothing) → **[en:tran:Info]** editor.
Right-click inside that editor for its three commands, in this order: first
**🌎 [en:tran:Choose Locale]**, and pick the language; then **#️⃣ [en:tran:Edit Numbers Map]**,
and press **[en:tran:Ok]**; then **📚 [en:tran:Edit Books Map]**, which opens the 66 book
names one to a line — press **[en:tran:Guessing Names]** to fill them from the lists the app
has for that language, or type your own, and press **[en:tran:Ok]**. Those editor actions use
the locale currently in the editor buffer; save after editing.

**A Bible whose language is not installed**

English is part of the app; every other language is a package you install (W-55), and a
Bible in that language takes its book names, numbers, letters and search words from it.
So a row of **[en:tran:Bibles XML]** whose language is not on this computer asks for it,
under the Bible's title: _This Bible is in Français (French). Install that language to give
the Bible its full language data._ Press **[en:tran:Install]** at the end of that line: the
language installs as it does from **[en:tran:Find a Language]**, and every open window
reloads at once to use it, the line gone. 📸 A language you turned off says _…which is
turned off…_ instead, with **[en:tran:Enable]** to turn it on again, which reloads every
window the same way. With no internet the button reads
**[en:tran:Languages]** and opens that tab, where **[en:tran:Import]** installs a language
from a file (W-55 step 8). A Bible in English, or in a language Open Worship has no package
for, has no such line.

**[en:tran:Key is already taken]**

If it says the Bible key is already taken, choose a different unused key in the review.
The installed translation is kept. Import does not replace it, even if another window
installed that key while you were choosing mappings. Cancel if you meant to edit the
existing Bible, then use its pencil instead.

> **Removing one.** The 🗑 next to a translation asks _Are you sure to delete bible XML
> "…"?_ — **[en:tran:Yes]** sends the file to the Recycle Bin. Its badge disappears from every bible
> menu. The sibling `…​.xml.cache` folder is removed too, so stale parsed data cannot
> reappear if the same key is imported later.

> **Putting the KJV back.** The **KJV** row — and only that row — carries an extra
> orange ↺ button, **[en:tran:Reset Bible XML]**, to the LEFT of the ✏️ pencil.
> It asks _Reset this bible XML with the app embedded KJV? All your changes will be
> lost._ — **[en:tran:Yes]** throws away the KJV file you have and writes the copy that ships inside
> the app (the same copy the **[en:tran:Create KJV Bible XML]** row below writes),
> then reloads the windows. Use it when your KJV has been edited into a state you no longer
> want, or looks broken; there is no undo, so export it first (W-33) if you want it back.
> If the KJV editor is open with unsaved changes the button refuses and warns
> **[en:tran:Unsaved Bible Data]** — save or discard first.
>
> **Deleted it by mistake?** The KJV is the one translation the app carries inside
> itself, so it can always be rebuilt. Whenever your list has no **KJV**, a green
> **[en:tran:Create KJV Bible XML]** row sits at the TOP
> of the **[en:tran:Bibles XML]** list, above the translations — not only on a brand-new install
> with nothing in the list. Click it and the KJV comes back; the button then disappears
> because there is nothing left to create. Any other translation is not carried inside the
> app. Its file went to the Recycle Bin when it was deleted, and the way back is to import
> it again the way it came in — **[en:tran:Let the assistant import a Bible for me]**, or
> **[en:tran:Import XML File]** with its link or file.

_Verify: ST-41..ST-50, ST-24..ST-26, ST-29, ST-31, ST-32, ST-51, ST-60, ST-79, ST-91, RD-11, RD-123, CB-80..CB-82, CB-107..CB-109, CB-145, LT-01._

### W-35 — Bring a song in from CCLI SongSelect

If your church has CCLI **SongSelect Partner API** access, the app can search SongSelect
and turn a song straight into a lyric document — no retyping. You need the API
credentials CCLI issued to you (a **Client ID**, a **Subscription Key**, and the
**Redirect URI** you registered; some clients also have a **Client Secret**).

> CCLI has retired new partner signups, so this only works with credentials you already
> hold. Everything below was driven live against a stand-in SongSelect server; the final
> sign-in hand-off to CCLI's real consent page is source-verified but **not observed**
> end-to-end, for want of real credentials.

1. Open **[en:tran:Settings]** → **[en:tran:Others]**. Above **[en:tran:Extra Binaries]**
   there is a card headed **[en:tran:SongSelect Integration]**, with a
   **SongSelect ↗** button that opens songselect.ccli.com in your browser. A card
   showing only its heading is folded — click the heading to open it. 📸
2. Fill **Client ID**, **Subscription Key** and **Redirect URI** (and **Client Secret**
   if you have one). Each field saves the moment you click away from it and gains a
   green ✓. Until all three are filled, **[en:tran:Sign In]** stays grey — hovering it
   names the three it needs.
3. Click **[en:tran:Sign In]**. A CCLI window opens for you to log in and approve. If you close
   it instead, the app says **Sign in failed — Sign in was canceled** ([en:tran:Sign in was canceled]) and nothing changes. Once signed in, the card shows a
   green **[en:tran:Signed in]** with a **[en:tran:Sign Out]** button, and the
   app keeps the session refreshed by itself.
4. Back in the presenter, open the **[en:tran:Documents]** list's **⋮ [en:tran:More Options]**. A new entry,
   **[en:tran:Import From SongSelect]**, now sits under
   **[en:tran:Import From Public Domain Songs]** — it is only there while you are signed in. 📸
5. Click it. A floating **[en:tran:Import From SongSelect]** panel opens (drag it anywhere; the
   app remembers where you put it). Type in **[en:tran:Search songs]** — results
   appear as you pause, with the writers, the CCLI song number, a line of the lyrics,
   and a **[en:tran:Public Domain]** badge where it applies. Page through
   long result lists with the ‹ › arrows at the bottom. A song your account is not
   licensed to take has its download button greyed out. 📸
6. Click a song's ☁⬇ download button. A moment later the app confirms **Lyric document
   created successfully** ([en:tran:Lyric document created successfully]) and the song appears
   in your **[en:tran:Documents]** list as a lyric (♪), named after its title. The panel stays
   open, so you can keep downloading; pulling the same song twice keeps both —
   the second becomes `<Title> (1)`. 📸
7. Click the new row: it previews slide by slide — an **Info** slide with the title,
   writers and the `CCLI Song #` copyright line, then one slide per part (**Verse 1**,
   **Chorus**, …). Present it like any other lyric (W-04), or polish the wording in the
   lyric editor first. 📸

> **If SongSelect will not connect, check these.** A grey **[en:tran:Sign In]** means one
> of the three boxes — Client ID, Subscription Key, Redirect URI — is still empty: hover
> it and it names all three; of those, the one without a green ✓ is empty. A search or download that fails says why, right in the panel or
> as a toast: too many requests in a row asks you to wait a moment; a lapsed session says
> **[en:tran:SongSelect sign-in expired, please sign in again in Settings]**, so sign in
> again; no internet says **[en:tran:Could not reach SongSelect]**.

_Verify: ST-57, ST-71, PL-103, PL-104._

### W-36 — Import a public domain song (no account needed)

The app ships with a small hymnal of classic English public-domain songs — Amazing Grace,
It Is Well with My Soul, Holy Holy Holy, and some three dozen more. They import as lyric
documents with **no sign-in, no credentials and no internet**, so this works on a fresh
install anywhere.

1. In the presenter, open the **[en:tran:Documents]** list's **⋮ [en:tran:More Options]** →
   **[en:tran:Import From Public Domain Songs]**. Unlike the SongSelect entry (W-35) it is
   _always_ there. 📸
2. A floating panel opens listing the whole catalog straight away — each row shows the
   title, the writers, the year, and the first line, with a count at the top right of the
   search box (36 at the time of writing). Scroll to browse, or type in **[en:tran:Search songs]** to filter instantly by title or writer — the count follows. 📸
3. Click a song's ☁⬇ download button. The app confirms **Lyric document created
   successfully** ([en:tran:Lyric document created successfully]) and the song appears in your
   **[en:tran:Documents]** list as a lyric (♪) named after its title. The panel stays open so you
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

1. In the bible lookup, click **[en:tran:Advance Bible Lookup]** (the binoculars, top right) to open
   the side panel, then pick **[en:tran:Resources]** from the panel's dropdown — the fourth entry
   after **[en:tran:Find]**, **[en:tran:Cross Reference]** and **[en:tran:Location-Name (KJV)]**. 📸
2. The top line of the view is the file-name patterns being looked for, one for **each
   passage you have open**, in the order of your panes, so you can always see what it is
   matching — reading Genesis 24 beside Genesis 27, a solid `GEN.24.*` and a solid
   `GEN.27.*` for the chapters' own files, then one dashed `GEN.0.*` for the book's.
   Above each group of files, the heading also spells out the book and chapter:
   `JHN.3.*, John chapter 3` or `JHN.0.*, John Introduction`. These full names
   follow the interface language and are visible without hovering.
   Two panes on the same chapter in two versions count once. The pane you are typing a
   reference into follows what its box says, as soon as the reference is complete;
   moving to another verse of the same chapter changes nothing here — it is the chapter
   that decides. 📸
3. The first time, the body holds a single **[en:tran:Add Folder]** button. Click it and
   pick the folder your files are in. You can add as many as you want — the
   **⋮ [en:tran:More Options]** button, or a right-click anywhere in the view including the empty space below
   the folders, offers **[en:tran:Add Folder]** again. Adding the same folder twice does nothing. 📸
   **Folders already in your data folder are one press away.** Everything
   **[en:tran:Copy to Data Directory]** (step 8) makes lands in a `resources` folder inside
   your data folder, and so does what **[en:tran:Import Data]** (W-25) brings back. Any
   folder in there that is not on the list yet is listed at the bottom of the view under
   **[en:tran:In the data directory]** — the first time, right under the **[en:tran:Add Folder]**
   button. Click one and it becomes a group straight away, with its matching files already
   listed and no folder picker; it leaves that list as it joins the shelf, and
   **[en:tran:Remove Folder]** puts it back. A folder you make in there while the view is
   open appears after **[en:tran:Reload]**. Nothing is offered that the view already shows —
   including every folder in there when the whole `resources` folder is itself on the list —
   and the heading is not drawn at all when there is nothing to offer. 📸
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
   of that book you have open, and, unless the panel is very narrow, carries a dashed **[en:tran:Introduction]** tag so a
   `PSA.0.pdf` says why it is there. A group with nothing for what you are reading says
   **[en:tran:No matching files]**.
5. Sometimes you want a file that is _not_ named after this verse. Click the **magnifier**
   at the right-hand end of the pattern line and a search box opens under it.
   Type any part of a file's name — `abc`, `baptism`, `PSA.11` — and every file in your
   folders whose name contains it is listed too, added below that folder's verse files under
   a `*abc*` heading so you can tell the two apart. Your verse files stay exactly where they
   were. 📸
   Upper and lower case do not matter, and it looks anywhere in the name, not just at the
   start — searching `abc` finds `abc.pdf` and `01-abc-notes.docx` alike. If you are used to
   writing `abc*`, that works too; the `*` is simply ignored.
   Click the magnifier again to close the box and put the lists back as they were. If a
   folder has hundreds of matches only the first 200 are shown, and the box says
   **[en:tran:Too many matching files]** — type a bit more to narrow it down.
   **To see everything else without typing, tick [en:tran:Others]**, the box just left of the
   magnifier. Each folder then also lists every file whose name is _not_ a book and a
   chapter — `family-tree.jpeg`, `church-map.pdf`, `README.txt` — under an
   **[en:tran:Others]** heading after its verse files and anything you searched for. 📸
   A file only counts as a book-and-chapter file when it starts with a real book key and a
   plainly written chapter, so `GEN.5.pdf` stays out of this list while `IMG.2.jpg` and a
   misnumbered `GEN.01.pdf` show up in it — handy for spotting a file you named wrongly. A
   file your search found is listed under the search heading instead, never twice. Up to 200
   are shown per folder; past that the group says **[en:tran:Too many other files]**, and pointing
   Resources at the folder your material is actually in keeps the list short. Untick
   **[en:tran:Others]** to hide them again — the box stays the way you left it next time.
6. Click a file to open it in whatever application your computer normally uses for it — a
   PowerPoint in PowerPoint, a picture in your picture viewer. Right-click one for **[en:tran:Open]**,
   **[en:tran:Copy Path to Clipboard]**, or **[en:tran:Reveal in Finder]** / **[en:tran:Reveal in File Explorer]**.
   Three kinds of file open **inside the app** instead:
   - **A PDF** (`.pdf`) opens in the app's own PDF viewer window — the same one
     **[en:tran:Preview PDF]** opens from a PDF in the Documents list — with its pages down
     the side, zoom and print. Right-click the row for **[en:tran:Preview PDF]**, or **[en:tran:Open]**
     to use your own PDF reader instead. Each press opens one more window on the file, a
     little below and to the right of the last, so two parts of it can be read side by side. 📸
   - **A markdown file** (`.md`, `.markdown`, drawn with the markdown icon) opens in its
     own **Markdown Preview** window, like a Bible Note does: headings, lists, tables, quotes,
     code, pictures kept beside the file, and **Mermaid diagrams** written in a ` ```mermaid `
     block are drawn as diagrams (a diagram with a mistake in it shows the error above its
     code). The window follows the file — save it in your editor and the preview changes.
     A link to a heading scrolls there; a web link opens in your browser; a link to another
     file opens it in a window of its own, and this window keeps its file: another `.md` in a
     Markdown Preview of its own (one already open on that file comes forward instead), a
     PDF in the PDF window, a bible note file on its first note, and any other file is shown
     in its folder rather than run. HTML written
     inside the file is drawn the way GitHub shows a README — a centred picture, a table, a
     section that folds away — but nothing in it can run: scripts, buttons, forms and styles
     are taken out. If a file shows `#` and `**` instead of a heading and bold, the file itself
     was saved with them escaped (`\#`, `\*\*`), which some editors' formatted view does
     when text is pasted into it; the preview shows what is written.
     **People, places, verses and other files named in the page are links too**, drawn in
     the link colour with a dotted underline, as the names in a Bible Reader verse are: a
     person or place of the chapter the file is named after (a `JHN.3.…` file links Nicodemus
     and Moses; a file named after no chapter links only a name one person or place in the
     whole Bible has), a verse reference written the way an installed Bible names its books
     (`Ezek. 36:25-27`, `John 3:16; 5:8`, a reference in Khmer), and the name of another
     resource file (`JHN.3.pdf`, `JHN.0.pdf`) that is beside this file or in one of your
     Resources folders. Names light up once the Bible Reader has highlighted the names of a
     verse for the first time. Click a person, place or verse to open its detail panel in
     the Bible Reader, which comes forward: the main window when it shows the Reader, else a
     Reader window you have open, else the main window as it is, which stays on the page it
     is on. Click a file's name to open it in a window of its own, as a link does. Words in
     code, in a diagram or in a link stay as written, and a file that does not exist is not
     linked; selecting words across a link opens nothing. The head row also has
     **[en:tran:Reload]**, **[en:tran:Open in Default App]** and
     **[en:tran:Reveal in File Explorer]**.
     **To jump to a part of a long page:** press **[en:tran:Sections]** (the list, first
     of the head row's buttons, there when the page has headings). The page's headings are
     listed under the head row, each set in under the one before it by its level (`#`,
     `##`, `###` …), the one you are reading in the link colour; click one and the page
     jumps to it. The arrow keys, Home and End move along the list; Esc, a click anywhere
     else or the button again closes it. Once you scroll down, an arrow in the page's
     bottom-right corner, **[en:tran:Scroll to the top]**, takes you back to the top.
     Neither is printed. 📸 **[en:tran:Print]** (the printer) opens a Print
     Preview of the page in the light theme, whatever the window shows: a dark window prints
     exactly what it would show in light, its diagrams too, with the same fonts and layout,
     on as many pages as it needs, without the head row or the editor; print it or save it
     as a PDF from there. Nothing of the page is left off: a fold closed on screen prints
     open, every picture is there however far down the page, and words typed in the editor
     a moment before are printed too.
     **When the page names a verse, a person or a place, [en:tran:Print] asks first.** The
     window shows **[en:tran:Add the Bible text and the name and place details to the end of the printout?]**
     with how many verses, names and places it found. **[en:tran:Add and Print]** adds them
     after the page's last line: the words of each passage, from the Bible named in
     brackets right after its reference when that Bible is installed (`John 3:1-36
     (Amplified)` from the Amplified), else from the Bible whose book names it is written
     in (a Khmer reference from a Khmer Bible), else the KJV. A passage already printed as
     part of a longer one is not printed again, and one that begins within it goes on from
     that one's Bible: a longer one from any Bible of its language holds it, or from its
     own Bible only when that Bible is named after it. Then each
     person and place with what the names lookup says of them,
     in the language that lookup is set to, a place's modern site too. A page that names
     very many says at the end how many more could not be added.
     **[en:tran:Print Page Only]** prints the page alone, and **[en:tran:Cancel]** (or Esc)
     prints nothing. A page that names none prints straight away. Ctrl+P (⌘+P on a Mac)
     and **File** → **Print Without Preview** in the menu bar (Alt shows it when it is
     hidden) ask the same question first. What is added is on the paper only: the window
     never shows it.
     **[en:tran:Ask the Assistant About This File]** (the 🤖, last in the row, shown while
     AI is on) brings the help window forward with this file attached in a chat of its own,
     as the 🤖 on its Resources row does.
     **To change the file right there:** press **[en:tran:Edit]** (the pencil). An editor
     of the file's markdown opens on the left, its lines wrapped, and the page stays on the right, drawing what you type a moment
     after you stop. The editor opens at the part of the page you were reading. Scroll either
     side and, once you stop, the other jumps to the same line. Nothing is written until you
     press **[en:tran:Save]** (the disk) or
     Ctrl+S (⌘+S on a Mac); until then a `*` after the name says there are
     **[en:tran:Unsaved changes]**, and **[en:tran:Discard unsaved changes]** (the round
     arrow) puts back what is saved. **[en:tran:Hide Editor]** (the pencil again) gives the
     whole window back to the page — your unsaved words still drawn there as they will
     look, still waiting for **[en:tran:Save]**. **To ask the assistant about some of the
     words**, select them in the editor, right-click them (or press Shift+F10) and choose
     **[en:tran:Ask the assistant about this]**: the help window comes forward with them
     quoted in its box under _Selected text_, the file's name and their line number, in the
     chat that already holds this file, else in a new one with the file attached. Nothing
     is sent until you type your question under the quote and press **[en:tran:Send]**.
     While something is unsaved,
     **[en:tran:Reload]** waits, and closing the window is stopped once with a note to save or discard first (keep trying and it
     closes anyway). A change saved in your own editor reaches an open editor here that
     has nothing unsaved; one with unsaved words keeps them, and **[en:tran:Save]** writes
     them over the file. Right-click the row for **[en:tran:Preview]** or **[en:tran:Open]**. Each
     press opens one more window on the file, as a PDF's does: scroll one to the
     diagrams and keep the other on the passage. 📸
   - **A bible note file** (`.own`) gains a chevron: click it and everything in it is
     listed under it, as the **[en:tran:Bible Notes]** panel lists it — its notes, and each verse
     marked in it (the highlighter icon) with its highlights in their colour and its comments
     underlined, what was written beside them. Click a note to open it in the **Bible Note**
     window **read-only** — the title bar says **([en:tran:Read-only])**, the lock at the
     bottom shows it is locked, and nothing you do there is saved to the file. Click a
     highlight or comment to open that verse beside what you are reading; click a verse to
     fold it away to a count. Nothing in the file can be changed from here. A file that is
     not a bible note says **[en:tran:Not a bible note file]**. 📸
7. **A `.json` file can hold a list of links** — videos, articles, anything on the web for
   that chapter — and the panel shows them instead of opening the file. Save the file
   inside a folder listed in **[en:tran:Resources]**; to add its folder, click the panel's
   **⋮** → **[en:tran:Add Folder]** and choose that folder. Write it as a list
   of entries, each with a **title** to read and a **url** to open — one link is
   `[{"title": "Notes", "url": "https://www.example.com/notes"}]` — exactly as in this example:

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

   Save it named after its chapter, as the files beside it are (`JHN.3.json` for John 3,
   `1CH.0.json` for the whole of 1 Chronicles), and the row for it gains a chevron
   and a 🔗 icon, with one row per entry hanging under it. **Click a
   title to open it in your own web browser** — Chrome, Edge, Safari, whatever you
   normally use — and the site it goes to is shown after the title when the panel is wide
   enough, with the title and the full address on the tooltip either way. Right-click a
   link (or use its **⋮**) for **[en:tran:Open Link in Browser]** and **[en:tran:Copy URL to Clipboard]**. 📸
   A few details worth knowing:
   - A bare address on its own line — `"https://www.example.com/talk"` — is a link that
     titles itself, so a quick list needs no titles at all. An entry with no title shows
     its address as the title.
   - Only **`http`** and **`https`** addresses are offered. Anything else is left out and
     the panel says how many entries it could not read (**1 [en:tran:entry was not understood]**),
     so a typo shows instead of a row quietly going missing.
   - **A `.json` that is not a list of links is just a file.** If it holds other data, or
     is not valid JSON at all, the row keeps the ordinary file icon with no chevron and a
     click opens it in your text editor like any other file — nothing to dismiss.
   - The file is read when its row appears, so editing it on disk and folding the group
     shut and open again shows your change. Files found by the **search** in step 5 are
     read on the first click instead, which is why a link list found that way needs one
     press to show its links.
   - Right-click the `.json` row itself (or its **⋮**) for **[en:tran:Open]** if you want to edit
     the file rather than follow a link.

8. Click a group's header to fold it away; it opens again the next time Resources is shown. Right-click a header
   for **[en:tran:Refresh]** (re-reads that one folder — **[en:tran:Reload]** in step 3 does all of them),
   **[en:tran:Add Folder]**, **[en:tran:Add Files]**, **[en:tran:Reveal in Finder]**/**[en:tran:Reveal in File Explorer]**,
   **[en:tran:Copy to Data Directory]** and **[en:tran:Remove Folder]**, which asks you to confirm and
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
   parent directory). Press **[en:tran:Yes]** and everything in the folder is copied there, sub-folders
   and all, while the progress bar runs; then the group switches to the copy, in the same place
   and open, and a note says where it went. **Your original folder is not
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

> **If a group shows a warning** instead of files: **[en:tran:Folder not found]** means the folder was
> moved, renamed or deleted since you added it (remove it and add it again);
> **[en:tran:Cannot read folder]** means the app is not allowed to read it. **[en:tran:Too many folders to search]**
> means even those two levels held more folders than it could read — point
> Resources at the folder your material is actually in rather than at a whole drive.
> A file you expected that is simply **not listed** is usually more than two folders down:
> add the folder it sits in (or the one above it) as a group of its own.

_Verify: RD-81, RD-82, RD-83, RD-84, RD-85, RD-86, RD-87, RD-88, RD-89, RD-90, RD-114, RD-115, RD-116, RD-117, RD-118, RD-119, RD-120, RD-122, RD-127, RD-128, RD-129, RD-130, RD-131, RD-132, RD-133, RD-134, RD-135, CM-93._

---

### W-38 — See how people and places connect (Connection Graph)

The record window tells you _who_ someone is. The graph shows you _how they connect_ —
parents, spouses, children, cousins and places, all on one canvas you can explore.

1. Open the **[en:tran:Names and locations lookup]** (`👤📍`) from the Bible Lookup header and find
   a person — try **Jacob** (យ៉ាកុប). 📸
2. Click the **⋮** at the right end of the row — or **right-click** the row — and
   choose **[en:tran:Open Graph Preview]**. A floating window opens with
   that person in the middle.
   > You can right-click a name anywhere it is already clickable — in the list, in the
   > **[en:tran:Names and locations in your reading]** panel, underlined inside a verse, or in the
   > related-names list of a record window. The **⋮** is on the rows of the first two,
   > which is where you would go looking for it; a record window also has a small
   > diagram icon beside its title.
3. Each box shows a number next to a small diagram icon — that is how many related
   records it has. **Click the number.** A menu opens listing **[en:tran:All] (47)** first, then
   only the kinds this record actually has: _Parents (2)_, _Spouses (4)_, _Siblings (2)_,
   _Children (16)_, _Cousins (22)_, _Locations (1)_. 📸
4. Pick one kind — say **[en:tran:Children]** — and just those boxes appear, ringed around the
   person and joined by curved lines. Each line is labelled with the relationship as you
   would say it: _son_, _daughter_, _wife_, _father_, _located at_.
   > Choosing **[en:tran:All]** on a record with many relations asks you to confirm first, because
   > forty-odd boxes at once is a lot to read.
5. Explore: **drag** any box to move it (it stays where you put it), **drag the empty
   canvas** to pan, and **scroll** to zoom in and out around your pointer.
   **Double-click** a box to make it the new centre.
   > **Right-click a box** for a menu of everything that box can do: **[en:tran:Open detail]**,
   > **[en:tran:Verses] (8)**, **[en:tran:Open all Related] (23)**, **[en:tran:Collapse]**, **[en:tran:Set as centre]**,
   > **[en:tran:Use as root]** and **[en:tran:Remove]**. _Set as centre_ re-arranges the whole graph around
   > that box; _Use as root_ clears everything else away and leaves just it, so you can
   > start exploring again from a record already in front of you. It has everything the small buttons along the bottom of the box do, and
   > it also works on a box you have collapsed, which hides those buttons. Rows you
   > could not use are simply absent — the centre box offers no _Remove_, and a record
   > with no relations offers no _Open all Related_.
   > The **[en:tran:Verses]** list names each verse the way YOUR Bible names it —
   > _លោកុប្បត្តិ ២៤:២៩-៣០_, not `GEN 24:29-30` — and picking one opens it.
6. Too busy? The coloured chips along the top switch each kind of connection on and off —
   turning **[en:tran:Cousins]** off is usually the difference between a tangle and a family tree.
   **Right-click a chip** to show _only_ that kind, and right-click it again to bring
   everything back. 📸
7. Bottom-right: **↺ [en:tran:Undo]** and **↻ [en:tran:Redo]** step through everything you have done to the
   graph — a box you dragged, a zoom, an expansion, a filter — and **Ctrl+Z** / **Ctrl+Y**
   do the same. One wheel gesture is one step, however many notches it took.
   **[en:tran:Fit to view]** (`⛶`) brings every box back on screen, **[en:tran:Re-layout]** (✨) tidies the
   whole arrangement — a family fan back into rings, a found path back into its chain —
   and the `^` button collapses every box to a single line so a big graph fits.
   > Nothing here is one-way: if a tidy-up is not what you wanted, Undo puts every box
   > back where it was.
8. **Find the line from this person to another.** Click the signpost icon at the top
   right. The graph's own centre is already the starting point — it sits there as a chip —
   so you only say where you want to get TO. For this example open the graph on **David**
   (step 2, from his row) rather than on Jacob — from Jacob the chain is longer than the
   search allows, as the note below says — then type **jesus**, pick **យេស៊ូវ (Jesus)** from
   the list (every name is offered with its English name beside it), and press
   **[en:tran:Find Connection]**. The canvas fills with the generations from David
   down to Jesus, the connecting line highlighted, and every box on it still expandable. 📸
   > The panel takes the name of the person the chain STARTS from, and that first box
   > becomes the graph's new centre.
   > Paths run through people only. A place like Jerusalem touches almost everyone, so
   > allowing places as stepping stones would "connect" any two people meaninglessly.
   > If there is no link within 30 steps you will see **No connection found within 30
   > steps** — that is an answer, not an error. The search stops there, so two people
   > further apart than that (Jacob and Jesus are about forty generations apart) are not
   > shown as connected even though they are.
9. Keep it: the `⋯` menu at the top right offers **[en:tran:Save as image]** (a PNG saved to your
   Downloads folder and revealed for you), **[en:tran:Print]** (which prints on white paper
   whatever theme the app is using), and **[en:tran:Save preset]** to name an arrangement and come
   back to it later.
   > **[en:tran:Fullscreen]** gives the graph the whole window. Its
   > **[en:tran:Presets]** and **[en:tran:Copy]** menus still work there,
   > and **[en:tran:Save preset]** opens the name dialog over the graph.
   > **[en:tran:Cancel]** returns to the graph without saving;
   > **[en:tran:Exit fullscreen]** returns to the floating window.
10. **Copy a graph into your notes.** On the graph, press the clipboard button (📋) left of the signpost and choose **[en:tran:Copy as Markdown]**. Open the destination note or document, click where the graph should go, and paste with **Ctrl+V** (on macOS, **⌘V**). Save the note or document in that application. The clipboard button opens six
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
    you left the window last time. A window still open for that record is only brought to
    the front. 📸
    > If an arrangement is worth coming back to, say so: `⋯` → **[en:tran:Save preset]**, name it,
    > and it is waiting in that same menu next time.

_Verify: RD-92, RD-93, RD-94, RD-95, RD-96, RD-97, RD-98, RD-99, RD-100, RD-101,
RD-102, RD-103, RD-104, RD-105, RD-106, RD-121._

### W-39 — Let the passage scroll itself while you read

When a chapter is longer than the panel, you do not have to keep reaching for the mouse
wheel — the app can scroll it for you, at whatever pace you set.

1. Open a passage long enough to scroll, in a Bible panel, on the screen preview, or in
   the small floating panel a passage opens in (right-click the passage →
   **[en:tran:Floating]**, or click a cross reference).
   Down in the bottom-right corner of the text, two faint controls sit one above the
   other: an up-arrow (**[en:tran:Scroll to the top]**, shown only once the text has moved
   down) and a double chevron below it.
   The double chevron is the auto-scroll button. 📸
2. Click the double chevron once. The text starts creeping downward. Click it again and
   it goes faster; each click adds a little more speed.
   It glides at a steady pace on any computer, and the pace follows the text size: make
   the text bigger and it travels further each second, so you still read the same number
   of lines a minute. Scroll it yourself while it plays — back up to re-read, or ahead —
   and it carries on from where you left it.
3. As soon as it is moving, a **⋯** appears just to its left. Click it. 📸
   A small menu opens listing everything this button can do, with the mouse action for
   each one written beside it:
   - **[en:tran:Auto Scroll Speed]** — how fast it is going right now.
   - **[en:tran:Speed Up]** — the same as clicking the chevron.
   - **[en:tran:Speed Up Faster]** — a bigger jump, the same as double-clicking it.
   - **[en:tran:Slow Down]** — the same as right-clicking it.
   - **[en:tran:Stop Auto Scrolling]** — the same as Alt + right-click.
4. Pick **[en:tran:Slow Down]** once, reopen the menu and see that the speed number has
   fallen — after the two clicks of step 2 a second **[en:tran:Slow Down]** would bring it to
   zero, which stops the scroll by itself. Pick **[en:tran:Stop Auto Scrolling]** to end it — the text stops and the **⋯**
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

1. Open the **[en:tran:Bible Reader]** (📖) and bring up a passage — say `Genesis 22:1-24`.
2. Drag across a few words inside a verse, the way you would to copy them. A small
   toolbar appears just above what you selected. 📸
   It has six coloured dots, then a **speech bubble** and an **eraser** — and, while AI
   is on, a **robot** that asks the assistant about those words (W-29).
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
   A little panel appears under them showing what you wrote, with three buttons: a **✕**
   to put the panel away, a **pencil** to open the note again, and a **bin** to delete it.
   > Move the pointer straight down onto the panel to use its buttons — it waits for you.
7. Each mark under the verse has a **⋮** at its right end (right-clicking the mark does
   the same). Its menu offers the five other colours, so you can recolour a highlight,
   **[en:tran:Edit Comment]** on a comment, and **[en:tran:Delete]**.
8. Click any mark in that list. 📸 The verse it belongs to opens as a new passage
   beside the one you are reading — the passage you were in stays where it is — and it
   flashes if it happens to be on screen already.
   > A mark is a place you kept inside something you were reading. Reaching it should not
   > cost you your place, which is why it opens beside rather than on top.
9. The verse row itself has a **⋮** too. 📸 It can do three things:
   - **[en:tran:Add to Bible List]** — puts that verse in your **[en:tran:Bibles]**
     list, ready to present, without going and looking it up again.
   - **[en:tran:Move To]** — moves the whole row, marks and all, into one of your other
     note files.
   - **[en:tran:Delete]** — removes the verse and everything marked on it, after asking.
   > You can also just **drag the verse row and let go**. Dropped on a file in the
   > **[en:tran:Bibles]** panel it arrives as an ordinary bible item, the same as if you had looked
   > it up; dropped on another file in **[en:tran:Bible Notes]** it moves there instead, marks and
   > all. One drag, and where you let go decides which it means.
10. Delete the last mark on a verse and the verse's row disappears from **[en:tran:Bible Notes]**
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

1. In the **[en:tran:Bible Notes]** panel, click the `⋮` on the note file you want (or right-click
   its name) and choose **[en:tran:Export]**. It sits just under **[en:tran:Import]**. 📸
2. A small panel asks for a **[en:tran:Password]** and a **[en:tran:Confirm Password]**. Leave both empty for an ordinary bundle, or type the same
   password in both to lock it. Press **[en:tran:Ok]**.
3. You get one `<name>.owanote.tar.gz` file in your **Downloads** folder —
   `<name>.owanote.enc` if you set a password — and the app opens the folder on it. 📸

   > Everything a note points at rides inside: a picture you pasted, a clip you inserted,
   > the sound file you attached. That makes this bundle much larger than a bible list's,
   > so give a note full of video a moment to finish.

   > **It carries what you typed last, not what you saved last.** A note window
   > keeps your typing until you press **[en:tran:Save]** (W-14), and the bundle
   > is written from the note as that window has it — so nothing you have typed
   > is left behind, whether or not you remembered to save it first.

4. On the other machine, click the `⋮` at the top of the **[en:tran:Bible Notes]** panel → **[en:tran:Import]** and pick the file — or **drag the `.owanote.tar.gz` (or `.owanote.enc`) onto
   the Bible Notes panel**. A protected one asks for its password first.
   **[en:tran:Import From URL]** works here too if the bundle is on the web. 📸
5. The note file appears in that machine's notes folder with all its notes, your
   highlights and comments, and its pictures and clips playing from the local copies.

   > If a note file of that name is already there, yours is never overwritten: the
   > imported one arrives beside it as `name (1)`. Rename whichever you prefer.

6. To move a **single note** instead of the whole page, use the `⋮` on that note →
   **[en:tran:Export]**, and **[en:tran:Import]** on the note file you want it to land in — any note file,
   not only **Default**. That one carries your unsaved typing too.

_Verify: PR-30, PR-31, CM-69, CM-98, CM-99._

---

### W-42 — Ask the app for help (the chatbot)

The app can answer its own "how do I …?" questions. It reads the same manual you are
reading now, looks at what the app is doing at that moment, and can point at the button
it is describing.

1. Click the **🤖** button in the top-right corner of the window, between the gear
   and the **✨** (the AI Chat window, W-44 — a different thing: a company's chat site
   in a box), or open **Help** → **App Help (Chatbot)** in the menu bar, or click
   the **?** at the end of the same row and choose **[en:tran:Open Chatbot]**. Answer
   the **[en:tran:Be careful with AI]** question with **[en:tran:Open]** — ticking
   **[en:tran:Do not show this again for 30 days]** first puts the question away for that
   long — and a narrow window opens beside the app. 📸
   **The 🤖 button is only on the four windows with a top bar** — the Presenter, the
   Bible Reader, the Slide Editor and the Screen Mirror page — and Settings has a 🤖 **[en:tran:App Assistant]**
   button of its own, at the foot of its list of tabs. Everywhere else, and on those as
   well, the way in is the **Tools** menu → **[en:tran:App Assistant]**, or **Ctrl+Shift+A**
   (**⌘+Shift+A** on Mac). That works from a Bible Note, Settings, the Web Editor, the
   Lyric Editor and Local Web Share — the windows a volunteer is most likely to be
   stuck in — and the menu bar is hidden on those, so the shortcut is the way in. If a
   help window is already open it comes to the front rather than a second one opening.
   **On Windows the taskbar has it too, and asks no question first:** right-click the app's icon on the taskbar and
   choose **App Help (Chatbot)** under **Tasks** — the app comes forward and the help
   opens straight away, without the **[en:tran:Be careful with AI]** question, which is the
   quickest way when the app is minimised or behind something else.
   With **[en:tran:Enable AI features]** switched off in Settings → **[en:tran:AI Providers]**, the menu entries,
   the taskbar entry and the shortcut go quiet together; the 🤖 button stays, and pressing it says that AI
   features are turned off and offers to open Settings, where the switch is (it takes
   effect after a restart).
2. A strip of **tabs** runs along the very top — several conversations at once, the way
   a browser holds several pages. **+** starts a new chat (its tab reads **[en:tran:New chat]**
   until a question is asked in it), **×** closes one. The
   window holds at most 12 chats — pressing **+** with all 12 open says so on a line
   under the tabs and asks you to close one first. A
   **double-click on a tab's name** renames it (useful once three of them start "how do
   I"). Until you rename it, a tab is called after the first question you asked in it.
   Everything is kept: close the window — close the app — and the tabs, their answers
   and even a half-typed question are all there when you open it again. 📸
3. Every tab opens with a **⋮** on its left, and a right-click anywhere on the tab
   does the same thing: it is that chat's own menu — **[en:tran:Rename this chat]**, **[en:tran:Lock this chat]**,
   **[en:tran:Close this chat]**, and, when there is more than one chat to take,
   **[en:tran:Close other chats…]** and **[en:tran:Clear all chats…]**. Those last two are never done on the first
   press: a line appears under the strip saying how many chats will go, with
   **[en:tran:Keep them]** beside the button that does it. 📸
4. **[en:tran:Lock this chat]** is how you keep one. A locked tab has no **×** any more — a 🔒
   sits there instead — and neither **[en:tran:Close other chats]** nor **[en:tran:Clear all chats]** takes
   it, so the strip can be cleared at the end of a service with the one answer worth
   keeping still in it. **[en:tran:Unlock this chat]**, in the same menu, gives the **×** back.
   The lock is remembered with everything else, so it is still locked next Sunday. 📸
5. The rest of the top line belongs to the tab in front, and it is three **drop-down
   lists**, each with its own small grey caption saying what it is for —
   **[en:tran:ASKING ABOUT]**, **[en:tran:ASSISTANT]** and **[en:tran:MODEL]**. (While the window is narrower than about 560 pixels — and it opens at 460 —
   each caption sits above its list; drag the window wider and the captions move
   beside their lists.) The first,
   **[en:tran:ASKING ABOUT]**, says which window of the app you are asking about —
   **[en:tran:Presenter]**, **[en:tran:Bible Reader]**, **[en:tran:Document Editor]**, **[en:tran:Screen Mirror]**, **[en:tran:Bible Note]**, **[en:tran:Settings]**,
   **[en:tran:Web Editor]**, **[en:tran:Lyric Editor]** or **[en:tran:Local Web Share]**. Every time you open the
   help — including bringing an already-open help window back to the front — the
   active tab starts on the window you opened it from. A choice you make afterwards
   stays with that tab until the next launch, and the other chat tabs keep their own
   choices. The suggested questions change with it: opened from
   the Lyric Editor it offers marking verses and choruses, opened from Settings it
   offers the data folder and the language. Answers follow it too — a recipe
   belonging to another window names buttons that are not on your screen, so it is
   left out. Another tab can be asking about a different window at the same time.
   **More than one window of the app open? Choose it on the [en:tran:WORKING IN] line above the box.**
   That line, just over the box you type in, names each open window — the main
   window, and for example a Slide Editor (by its document's name), Settings or a
   Bible Reader opened in a window of its own — and the help then works with the
   one you choose: it reads what that window shows, outlines buttons in it, walks you
   through steps there, **[en:tran:Attach a picture of the app]** in the **⋮** at the left of
   the box takes a picture of that window and
   **[en:tran:Point at a control in the app]** points in it.
   Choosing one sets **[en:tran:ASKING ABOUT]** to match and marks the line with a coloured
   bar; choosing the main window goes back to the usual way. The choice belongs to
   that chat tab while the help window stays open; the line appears only while there
   is a second window to choose, and it keeps up by itself: a window you open or
   close, or the main window moving to another page, shows in the list within a
   second, with nothing to press in the help window. A picture from **[en:tran:Attach a picture of the app]** and a
   control from **[en:tran:Point at a control in the app]** remember the window they came from — rest the mouse on the
   chip to see it — and the assistant is told which window each is of; pressing a
   pointed-at chip outlines that control in its own window, whichever window is
   chosen now. 📸 **[en:tran:ASSISTANT]** is which service answers and **[en:tran:MODEL]** is which of
   its models; until you pick one by name **[en:tran:ASSISTANT]** starts on **[en:tran:Auto]**
   (step 13), which asks an assistant that costs nothing — with no server of your own,
   **[en:tran:Free]**, a shared public service that needs no key — and a notice pinned above
   the conversation says so and carries **[en:tran:Open AI settings]**, which opens the
   settings panel that takes a key. 📸
   **Short of room? Fold those lists to one line.** A small arrow sits at the left
   edge of the window's top line — the line with the three lists, not the list of
   suggested questions under it. Click it and the lists — with the **[en:tran:LIMIT PER HOUR]** list and
   the **[en:tran:CREDIT USED]** line of step 8 — fold into a single line that still says
   what each one is set to, such as _Presenter · Claude · Sonnet 5_, with the hourly
   limit at its end (it turns amber when the assistant is close to that limit or
   paused). Click that line to bring the lists back, exactly as they were. It only
   ever folds when you press the arrow — never while you scroll or read — and it
   stays the way you left it in every chat tab. 📸
   When **[en:tran:ASKING ABOUT]** is **[en:tran:Bible Reader]**, answers lead with the easiest mouse or
   touch route, use no more than three steps at first, say where the control is, and
   explain actions such as double-clicking or dragging. A lost item starts with a
   history or recovery route, not a request to remember it, and a failed step gets a
   different safe route or one short question that identifies the next exact step.
   Any steps shown begin at 1, and the choices below the answer stay specific to that
   answer, including a recovery choice when the first route may fail. The wording is
   respectful and plain; it does not assume the reader knows computer terms or
   keyboard shortcuts.
6. Type a question and press **Ctrl+Enter**, click **[en:tran:Send]**, or click one of the
   suggestions. Answers arrive with follow-up buttons: **[en:tran:Read the whole thing]** opens
   the full recipe, the other button is the next-best match. Pages of this guide are
   always named by their **title** — _the guide page “Set the background”_ — never
   by a code or a number, whatever the assistant was reading. 📸
   **The four suggestions are not all it can answer — press More… to see the
   rest.** Under the **[en:tran:Try asking]** chips on an empty chat is a small
   **[en:tran:More… — everything it can answer]** button. It opens the whole list for the
   window you are asking about, sorted under the panel each question belongs to
   — _Bible verses on screen_, _Backgrounds_, _The screen the audience sees_, _Nothing on the
   projector_, and so on. There are more than 300 of them for the Presenter, and every one
   has a page of this guide or a look at the live app behind it, so nothing on
   that list can be pressed and come back with a shrug. It is worth a scroll
   once: most people use this window for the one thing they first saw it do.
   Press any of them to ask it, or type a few words in the box and the same list
   narrows itself as you type. **[en:tran:Fewer]** folds it away again. 📸
   **A Bible can be installed from the chat, with no model call.** Ask
   `Import bible from xml url https://github.com/Beblia/Holy-Bible-XML-Format/raw/refs/heads/master/KhmerBible.xml`
   — the **Bible versions** section under **[en:tran:More… — everything it can answer]** contains an editable sample like it, for an English Bible. Asking it
   downloads the file, says where it is from and asks you to press **[en:tran:I agree]** (on a
   computer with no KJV yet it offers **[en:tran:Create the provided KJV]** first), then asks a
   few quick questions in the chat, each with buttons to
   press — a short name, the language, the digits and the book names — and installs
   nothing until you press **[en:tran:Install it]**, with **[en:tran:Undo]** under the answer afterwards (W-34).
   **The Bible Reader also has 30 guided demos that need no AI model, key or
   account.** Set **[en:tran:ASKING ABOUT]** to **[en:tran:Bible Reader]** and, in an empty chat,
   press one of the demo buttons listed under **[en:tran:Try a guided demo]** — those words
   are a heading, and typing them does nothing. The original four practise text size, opening
   John 3:16 with buttons and finding Bible words. Nineteen more cover passage
   history, clearing the reference, people and places, two Bible versions,
   distraction-free reading, copy/split/save, automatic scrolling, line
   layout, cross references, names in the current passage, Resources and book
   filters. Seven more practise typing a
   complete reference, removing only its last part, automatic Bible audio,
   note filtering and sorting, Settings and Help. The full Tips list also
   explains how View > Widgets shows or hides the whole saved-passages panel,
   saved Bibles, or Bible Notes; those three are self-guided because an open
   pane is not itself a toggle.
   A card appears in the Reader. Press
   **[en:tran:Do it]** for one visible action at a time, or **[en:tran:Skip]** to do that step
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
   **The list above the box is worked from the keyboard.** As you type, the
   questions it can already answer — or, after a `/`, the commands — open in a list
   above the box. **↑** and **↓** walk it, and the list scrolls with you, so the row
   you are on is always in view (**↑** from the box starts at the bottom row, the
   one nearest the box). **Tab** takes a row: the one you walked to, or the first one
   when you have not walked at all. Type `/bt`, press **Tab**, and the box reads
   `/btw ` with the cursor after it, ready for your question. **Tab only fills the
   box — it never sends.** Finishing `/screen-hide` with **Tab** turns nothing off
   until you press **Ctrl+Enter**. (**Enter** on a row you walked to, and a click,
   still run a command that needs no words after it.) The list closes by itself once
   it has nothing left to offer — a command typed in full, or the first word typed
   after one — and **Esc** closes it sooner. With no list open, **Tab** moves on to
   the **[en:tran:Send]** button as it always did. 📸
   **You can just carry on talking.** Each tab is one conversation, so the answer to
   "is any screen showing?" can be replied to with **yes**, or with "how do I turn it
   off?", and it knows what you mean — you do not have to say the whole thing again.
   Each tab keeps its own thread: a question asked here is never answered out of the
   chat next door.
   **And you rarely have to type the next thing.** Every answer ends with up to
   five short buttons in the assistant's own words — _“How do I style the verse
   text?”_, _“Which button shows it?”_, _“No thanks”_ — and pressing one says it for
   you, as if you had typed it. A reply that only repeats **[en:tran:Show me step by step]**
   in other words is not offered beside it. They are the round-cornered buttons on the bottom row; the
   square ones above them, in capitals, are the ones that DO something in the app.
   Only the newest answer carries them, so a **Yes** is always a yes to the question
   you were just asked. 📸
   **A word or two on its own is asked about first.** Type just _lyric_ (or
   _background_, _bible_) in a new chat and the window answers at once, with no
   assistant asked: _What would you like to do with “lyric”?_ and up to six of the
   questions it is ready for as buttons — _How do I make a new song?_, _Can you
   turn a PowerPoint song into a lyric file?_, _How do I put a song's lyrics on
   the screen?_ … — so nothing is guessed. Press the one you meant and it is
   answered; or type more in your own words. Further down a conversation, a word
   or two that the conversation does not already explain is answered the same
   way: a short question, with the likely jobs as buttons. 📸
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
   moment to press **[en:tran:Stop]**. 📸
   **Changed your mind? Press Stop.** While an answer is on its way the **[en:tran:Send]**
   button becomes **[en:tran:Stop]**, and the last line under the steps says so —
   _press Stop to give up on it._ Pressing it (or **Esc**, while the cursor is not in the box) calls
   the question off there and then: the chat says **Stopped**, nothing arrives
   afterwards, and your question is still sitting above it with **[en:tran:Ask again]**
   under it. Use it for a question asked by mistake, one taking longer than you
   have before the service starts, or an assistant that is thinking its way
   round the houses. 📸
   **And you can keep talking while it works.** The box is not locked while an
   answer is coming: type the thing you forgot to say and press **Add** (or
   **Ctrl+Enter**) and it goes into the answer that is already being written, rather than
   starting a second question — the line joins the conversation marked _Added
   while it was working_. If it arrives too late to be worked in, it is answered
   on its own and the reply says so. Press **[en:tran:Stop]** instead and every word you
   added comes straight back into the box: nothing you typed is thrown away. 📸
   **A question you picked from the list is answered from its own page.** The
   **[en:tran:Try asking]** chips, the suggestions under the box and the **[en:tran:More…]** list are
   the app's own supported questions, and each one is filed under the page of this
   guide that answers it — so picking one goes straight to that page rather than
   searching for it, with an assistant or without one. Type the question in your
   own words and it is searched for as before.
   **Some things need no assistant at all — type `/`.** A line that starts with
   `/` is a **command**: it runs on the spot, on this machine, with no assistant,
   no key and no internet, and the answer says what CHANGED. Type `/` on its own
   and the list of them appears above the box — every one of them, the list
   scrolls — walk it with the arrows, finish one with **Tab**, or click one.
   **/screen** says whether anything is on the projector AND what is on it
   — the song and the verse, the passage, the background — even while the screen
   is off, so _the screen is off but already holds Verse 2, turning it on shows
   that_ is the answer rather than a bare _nothing is showing_; **/screen-show**
   turns the screen on and **/screen-hide** turns every screen off, and both read
   the screens back afterwards, so _the screen is on now_ is never a guess;
   **/screen-clear-all**, **/screen-clear-background**, **/screen-clear-slide**,
   **/screen-clear-bible** and **/screen-clear-foreground** press the five clear
   buttons (**F6**–**F10**; the older **/clear-all** … **/clear-foreground**
   spellings still reach them, and **/clear** on its own empties the chat in
   front of you — a locked tab keeps its messages and says so);
   **/selected** says which song is selected, which of its slides is up and
   which comes next; **/next** and **/previous** put the next or the previous
   slide of the selected song on the screen — the arrow keys, from the ask box —
   and read the screens back afterwards, saying so when the screen itself is off;
   **/slide 3** or **/slide verse 1** puts one slide of the selected song on
   the screen by its number or by the words in its name, and reads the screens
   back the same way (with no slide named it lists them);
   **/run** says which run sheet (presenting flow) is open in its run player,
   the line the run is on — and the slide inside it — and what the next press
   puts up, or names the sheets there are to open when none is (it presses
   nothing: advancing a run is your own **Space** in the run player);
   **/verse John 3:16** puts that passage on the screen — read by the app's own
   reference parser, in the Bible version the Bible Lookup is on (or another
   installed one that reads it), and read back afterwards: _John 3:16 (KJV) is
   on the screen now — "For God so loved…"_, with **[en:tran:Turn the screen on]** offered
   when the screen is off and **[en:tran:Take it off again]** beside it (**F9**). Asking in
   words does the same: _Put John 3:16 on the screen_ puts it up straight away
   with an assistant, and offers one button that does it without one;
   **/countdown 5** starts a five-minute countdown on the screen (**/countdown
   10:30** counts down to a time, **/countdown stop** takes it off; **/timer** is
   the same command) and **/marquee Please silence your phones** scrolls the
   words along the bottom (**/marquee-top** along the top; **stop** takes either
   off) — each read back afterwards, _a 5 minute countdown, ending at 11:45 AM is
   on the screen now_, with **[en:tran:Turn the screen on]** offered while the screen is off
   and **[en:tran:Take it off again]** beside it. Asking in words does the same: _Start a 5
   minute countdown on the screen_ or _Put the time on the screen_ starts it
   straight away with an assistant and offers the screen's own show button, and
   without one the guide offers one button that starts it; the five
   **/screen-clear-** commands clear a layer the screen HOLDS even while it is
   off. **The commands that work on the Presenter alone** — **/screen** and the
   screen's show, hide and clears, **/selected**, **/next**, **/previous**, **/slide**, **/run**,
   **/verse**, **/countdown**, **/marquee** — are offered in the list only while
   **[en:tran:Asking about]** is **[en:tran:Presenter]**, and typed under another page they answer
   _works on the Presenter page_ with **[en:tran:Go to the Presenter]** under it
   (**/commands** names them on one line there); the rest work everywhere,
   and anything the Reader has is on the Presenter too. Asked in words from
   the Bible Reader, _Is anything showing on the projector?_ says whether a
   screen is on and, under the answer, that the main window needs to be on the
   Presenter page to see what it holds — with the same **[en:tran:Go to the Presenter]**
   button, which switches the main window and leaves the projector untouched;
   **/find Clear Long Text** outlines a control in red; **/goto reader** switches the
   main window (the projector is untouched); **/here** says which window is in
   front; **/help clear bible** searches this guide without an assistant;
   **/credit** says what this chat has cost so far (also **/cost**); **/limit**
   says or sets the hourly spending limit (**/limit 2**, **/limit off**, and
   **/limit more** to carry on after a pause); **/lyric https://…** reads a
   song page — a hymnal's text page, a chord sheet — and writes the song out
   for the Lyric Editor with its chords where the page puts them, and
   **/lyric** followed by pasted words writes those out (also **/lyrics**,
   **/hymn**, **/new-song**); either answers in a few seconds with what the
   song is and the two buttons — **Create "…"** and **[en:tran:Copy song text]** — and
   the song text as it will be saved drawn above them, and NOTHING is saved
   until you press Create (an _Assistant read a page on hymnary.org_ notice appears in
   the app window while the page is read). **/lyric Amazing Grace** — a song's
   NAME on one line — looks it up instead: in your own songs, and in the
   app's collection of public-domain hymns (the ones
   **[en:tran:Import From Public Domain Songs]** brings in), and offers it under the same two buttons; a song
   that is in neither is said so, with a request for its words or a page,
   because the help window never writes a song out from memory. Asking in
   words does the same without an assistant — _Create a lyric file from
   https://…_ and _Create a lyric file for song "Amazing Grace"_ are answered
   by the built-in guide with the same buttons when no assistant can answer;
   **/btw what is the Bible?** is the one command that DOES ask the assistant
   — "by the way", a general question that is not about this app: it is
   answered from the assistant's own knowledge in one go, with nothing of the
   app looked up and no walkthrough offered (the quotes in `/btw "what is
holy bible"` are fine), and with no assistant to ask it says so and offers
   **[en:tran:Open AI settings]**, because the built-in guide only knows this app. A
   plain question typed under it — _in Khmer please_ — stays general, so the
   conversation goes on without retyping **/btw** (any **/** command ends
   that, and a new tab starts fresh); ask the assistant something not about
   the app without it — or _how can I ask a general question_ — and it tells
   you to put **/btw** in front, which the 💡 tip line above the box says too;
   a question about what the Bible itself says is never answered with a page
   about something else — with no assistant answering, or typed after
   **/help**, _what bible verse talk about lover your enemy?_ is answered with
   how to search the Bible's own words in Bible Find, the words to try named,
   and _who wrote the book of Psalms?_ with how to ask an assistant, **/btw**
   in front; in the Bible Reader an assistant's answer to a verse asked for by
   its words ends with the same search and a **[en:tran:Show me Bible Find]** button,
   whose card rings **[en:tran:Advance Bible Lookup]**;
   on LM Studio and Ollama a general question goes out with the model's
   thinking switched off, so it answers in seconds rather than in half a
   minute; a follow-up that names something of the app — a screen, a
   display, a slide, a verse — leaves the general chain and is answered as
   an app question, which is how _How do I cast the virtual display to a TV
   from my phone?_ under a **/btw** about casting still reaches the
   **[en:tran:Cast to a TV]** button; and **Escape** in the box, with no
   suggestion list open, empties it (with the list open it only closes the
   list). On a server of your own, _Create a lyric file for song "Amazing
   Grace"_ is looked up and written out by the app itself, with the same
   **[en:tran:Create]** button, because a small local model is not handed the song
   tools; and on such a server _Turn off the screen for me_, _Turn the screen
   on_, _show verse 1 on screen for me_ or _put slide 3 on the projector_ are
   answered from the app's own state at once, with ONE button that does it —
   _Nothing to turn off_ when no screen is on (never a Clear), **[en:tran:Turn every screen off]** when one is, **Put "(1)-Verse 1" on the screen** for a slide
   the selected song has — and _Show the next slide?_ or _show the previous
   slide_ the same way, naming the slide the arrow keys would go to and
   offering the one button that puts it up — and _Where is the button for
   Clear All_ is answered by the window itself, which looks for a control
   called that and outlines it in red where it is, with **[en:tran:Highlight again]**
   under the answer (a name no control carries goes on to the assistant) —
   and a sentence that is not a
   slide of the song
   (_Put John 3:16 on the screen_) goes on to the assistant as before;
   **/commands**
   lists them all. The square buttons under a command's answer are
   commands too — **[en:tran:Turn the screen on]** under _nothing is showing_ — and pressing
   one writes the command into the chat as though you had typed it, so the word is
   there for next time. A command with a spelling mistake lists the real ones
   rather than guessing. 📸
   **One line above the box tells you something this window can do.** A 💡 and a
   short sentence — the picture button, the walkthrough cards, **[en:tran:Report]**, **Alt+↑**,
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
   **The ✕ at the very end of the tip line puts it away for 30 days.** It comes
   back by itself after that. **Want the tips back sooner?
   Type /tips** in the box and ask: the line is back at once, and the answer
   gives you one tip straight away. 📸
7. **Show it, instead of describing it.** Press the **⋮** at the left of the box
   (**[en:tran:More Options]**): it opens a short menu, each row an icon and its
   name. **[en:tran:Attach a file]** attaches a picture or a file from your computer;
   **[en:tran:Attach a picture of the app]** takes a picture of the app as it looks
   right now; **[en:tran:Point at a control in the app]** lets you POINT — an outline
   follows your mouse over the app and the control you click is the one you meant.
   The same menu holds **[en:tran:Attach a foreground session]** and, last,
   **[en:tran:List every command]**, which puts **/** in the box and lists the
   commands. **Esc**, or a press anywhere else, closes the menu.
   You can also paste a picture straight into the box (**Ctrl+V**) or drag a file
   onto the window. Whatever you attach shows as a small chip above the box, with
   an **×** to take it off again, and up to four can ride one question.
   **Each chip carries a number** — 1, 2, 3 — so you can say which one you mean
   in your own words: _in 2 the button is missing_, _compare 1 and 3_. The
   assistant is told which is which. A number stays with its chip: take a chip
   off and the others keep theirs, and the numbers carry on through the chat, so
   they still mean the same thing in the conversation above. Clicking a
   control to point at it does **not** press it — the app does not act on that
   click, so it is safe to point at **[en:tran:Clear Long Text]** and ask what it does. 📸
   **Press a chip to see what it stands for.** A control you pointed at is
   **circled in red** in the app window again, so you can find it after looking
   away; and **every file or picture opens** — big enough to read, right here
   over the conversation (press anywhere, or **Esc**, to close it).
   **Answers can carry them too.** When the assistant points you at a button or a
   file, it puts a chip under its answer as well: press it and the button is
   circled in the app, or the file opens.
   **Whatever opens, you can keep it.** Under every preview is **[en:tran:Download]**,
   which saves the file into your **Downloads** folder and opens it there —
   a picture, a report, a song, anything. Beside it are **[en:tran:Copy]**, which puts
   the picture or the words on your clipboard, and **[en:tran:Open folder]**, which
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
   seeing your screen it says so and puts the button right there — **[en:tran:Send a picture of my screen]**,
   **[en:tran:Point at the control]**, **[en:tran:Attach a file]** — so you never have to
   work out how to send it one. 📸
   **Read a study PDF one verse or range at a time.** In the Bible Reader's
   Resources panel, press the 🤖 (**[en:tran:Ask the Assistant About This File]**) beside a chapter PDF
   such as `JHN.3.pdf`. Its
   chat briefly describes the file and, when the Reader is on verses of that
   chapter, says which — _You are reading Matthew 18:15-17 in the Bible
   Reader_ — and offers those verses (`15-17`) as its first button, so one
   press reads what the file says about the passage in front of you. Press
   **[en:tran:Read]**; it asks at once which verse in that chapter to focus
   on, shows `1` as the typing example, and offers the verses you are reading
   first, then the first three verses plus **[en:tran:Full chapter]**. A file
   for the whole book, such as `MAT.0.pdf`, is not read verse by verse: its
   chat says it belongs to the whole book and offers to ask what it says about
   the passage you are reading. You can also type a small
   range such as `1-3`: each card quotes every verse in it, and every printed
   cross-reference becomes a button. Press one to read that verse in its own
   card; when its chapter has its own PDF in Resources, that file's closest
   explanation comes with it. Full chapter continues automatically, one verse
   card at a time, through the chapter's end; direct references to another
   Resources PDF may add that file's explanation and an
   **[en:tran:Ask about {name}]** button. The PDF's embedded text is
   not used because a legacy Khmer font can decode as unrelated Latin
   characters. If a visual reading repeats itself, or no assistant can answer,
   the explanation is left out and the verses from your own Bible remain, with
   the next verse buttons under them. AI can misread a PDF page,
   so read the original Bible and PDF yourself too; **[en:tran:Hide for 30 days]** puts
   that caution away temporarily.
   **You do not have to press the 🤖 first, and you do not have to say “chapter”.**
   With **[en:tran:ASKING ABOUT]** on **[en:tran:Bible Reader]**, type the sentence the way you say it —
   _summarize Matthew 18_, _show the resources for John 3_, _what does MAT.18.pdf
   say?_ — in English or in your own language, with your Bible's own book names and
   digits. The assistant reads the chapter from your Bible, or the file you named from
   Resources, and answers from it. A PDF is read up to eight pages at a time and the
   assistant reads on by itself when the file is longer; you are not asked to turn
   pages.
8. Under every answer is **[en:tran:Copy]**, which puts that answer on the clipboard and says
   **✓ Copied**. Under every question of yours is **[en:tran:Ask again]** — or just click the
   question itself — and the same words go back in the box, ready to be changed a
   little and asked again. 📸
   **And every answer has a reply arrow beside Copy, to follow up on it.** Press the
   arrow (**[en:tran:Reply]**) and the answer is written into the box under a line
   _Replying to your answer:_, each of its lines starting with `>`; type your question
   under it and send, and the assistant knows which answer you mean, however far up the
   chat it is. To follow up on one part of it — a section, a sentence, a word — select
   those words in the answer first, then press the arrow: only they are written in,
   under _Replying to this part of your answer:_. Nothing is sent until you press
   **[en:tran:Send]**, a long answer is written in up to about 800 characters, and
   pressing the arrow twice writes it in once.
   **And every answer has a Retry beside the reply arrow, for a different answer.**
   Press the round arrows (**[en:tran:Retry]**) under an answer and the same
   question is asked again — with the file or picture it was asked with — and
   the new answer comes at the bottom under _A different answer: worked out
   another way, with more effort._ Each press tries another way in: another
   way to do it that the app has (or, when there is only one, it says so and
   adds what to do when a step does not work), the question read another way,
   or the answer worked out again step by step — and it thinks harder each
   time, but keeps every button name right. And where there is another assistant to ask, the press asks it,
   for that one question: on **[en:tran:Auto]** — or on your own server, OWA Shared or
   **[en:tran:Free]** — the one that wrote the answer goes to the back of the line and the
   note says who answered this time (_Auto asked … this time._); with a key of
   your own for **Claude**, **ChatGPT** or **[en:tran:Kimi]**, the next model up of that
   same key answers — or, on its best model already, the next one down. The next question
   goes to the one picked at the top of the window, as before — nothing there
   changes. Anything you were typing in the box stays there, and the round
   arrows wait, greyed, while an answer is on its way. An answer to one of the
   `/` commands has none — pressed again, a command would just do the same
   thing again.
   **Asked about reading the Bible from the wrong page?** A stray press is enough
   to leave the Bible Reader for the Presenter. Ask something like _how can I open
   bible_ or _where do I find the Bible to read_ while the main window is on the
   Presenter or the Document Editor, and the answer ends with one more line and
   one more button, **[en:tran:Go to the Bible Reader]**: press it and the main window
   changes to the Bible Reader, and whatever is on the projector is left as it
   is. The **[en:tran:Bible Reader]** tab in the header at the top of the Presenter
   takes you there too. A question about showing a verse on the screen does not
   get it — that is what the Presenter is for.
   **And every answer has two thumbs beside Copy.** 👍 says the answer helped and
   👎 says it was wrong or did not help. The one you pressed stays filled, and
   pressing it again takes it off; the mark is kept with the chat on this
   computer and is sent nowhere. The first time you press 👎 under an answer the
   help window follows up by itself — no assistant is asked, so it costs nothing:
   it asks what was wrong, with three things to press (**[en:tran:A button it names is not there]**,
   **[en:tran:The steps did not work]**, **[en:tran:That is wrong for the window I am in]**), and
   says what most often helps, a smarter model. When the assistant answering has
   one — **Claude**, **ChatGPT** and **[en:tran:Kimi]** list theirs best first — a button
   **Ask again with …** names the next model up: it asks the same question of
   that model and leaves this chat on it, and the new answer says so, because the
   model above costs more. Pick another in the model list at the top to go back.
   On the best model already, on **[en:tran:Auto]**, **Bedrock**, **[en:tran:Free]** or a server of
   your own, it says in words what to try instead. **Typing that an answer is
   wrong** — _that is wrong_, _I cannot find that button_ — brings the same
   advice, and the same button, with the answer to it.
   **And what you clicked stays marked.** A card you click keeps a thin ring
   round it, and a button you press in it — a thumb, **[en:tran:Copy]**, a walkthrough
   button — keeps a ring of its own, until you click somewhere else; **Tab**
   moves the same mark from the keyboard. A thumb pressed on an answer further
   up no longer makes the chat jump to its end.
   **And every answer says what it cost.** At the right-hand end of the line under each
   answer, the one with **[en:tran:Copy]** and the thumbs, in small grey figures, is what the assistant spent answering — a few cents at
   most for an ordinary question, and the tokens it used — and a line under the
   three pickers at the top, **[en:tran:CREDIT USED]**,
   keeps the running total for the whole chat: every question in this tab, including
   one you stopped part-way or one that failed, because the credit is spent whether
   or not an answer arrived. Each tab keeps its own total, and it is remembered with
   the rest of the tab. Hover either figure for the sums — how many times the model
   was called, how many tokens went in and came out, how much of that was served
   from the cache. The dollars are an **estimate from the model's list price**, so
   the bill from your provider is the figure that counts; a free service reads
   **[en:tran:free]**, and a model this app has no list price for reads **[en:tran:price not known]**
   with the tokens still counted. Nothing at all is shown until a question has been
   asked. The assistant itself cannot read these figures — it can only say where
   they are — so for the total in words type **/credit**, which answers from the tab
   itself with no assistant involved. 📸
   **And it cannot run up the bill on its own.** At the right-hand end of the
   pickers' own line, after MODEL, is **[en:tran:LIMIT PER HOUR]**, a small list that starts on **$1** —
   the most the assistant may spend in any one hour, across every tab of this
   window. Beside it, once something has been spent, a figure says where the hour
   stands (*≈ $0.31 of $1 this hour*); it turns **amber** past four fifths of the
   cap, and the answer that crosses that line carries a *Heads-up* note. At the
   cap the assistant **pauses**: the next question is answered from this guide
   instead, under a note saying why, the figure reads *paused*, and an
   **[en:tran:Allow more]** button appears in the note and in the top line. Pressing it
   starts the hour again with the whole limit available and asks your question
   once more; nothing else lifts a pause — not time passing, not a restart — because
   the point of it is that a fault which keeps asking cannot press a button.
   Pick a different amount from the list (**$0.25** to **$20**, or **[en:tran:No limit]**)
   to change it; **[en:tran:No limit]** keeps only the pace cap, which pauses after **150
   model calls in one hour** whatever they cost — more than a person asks for, and
   the one thing that protects a free service, which the money cap cannot see.
   **/limit** says all of this in words and **/limit 2**, **/limit off** or
   **/limit more** do the same as the list and the button. The figures are the same
   estimate the credit line is. 📸
9. **Something wrong with the app itself? Press Report.** Under **[en:tran:Send]** is a quieter
   **[en:tran:Report]** button, for when the answer is not "how do I" but "this is broken".
   Say what went wrong in the box — one line is enough — and press it. It asks
   first, quoting back what it is about to report, with **[en:tran:Not now]** beside
   **[en:tran:Report it]**, so a mis-hit costs you nothing. (Press it with an empty box and it
   takes the last thing you asked, which after a wrong answer is usually what you
   mean.) 📸
   **Attach a picture or PDF to a problem report.** In this help window, type what
   went wrong into the question box, then press the **⋮** at its left and
   **[en:tran:Attach a file]** to choose the picture,
   text file or PDF. Press **[en:tran:Report]** below **[en:tran:Send]**, then
   **[en:tran:Report it]** in the confirmation. Read the prepared report and its
   attachment list, then press **[en:tran:Send report]** when ready to send it.
   **Two more ways lead here, from the app window.** The **[en:tran:Help]** button's
   third row, **[en:tran:Report a Problem]** (the menu bar's Help menu has the
   same row), opens the help window on a card
   that asks what went wrong — or what you wish the app did better — with a
   **[en:tran:Report]** button on it: type a line, attach a picture or a file if it
   helps (**[en:tran:Attach a file]** in the **⋮** takes pictures, text files and a PDF), and
   press **[en:tran:Send]** or **[en:tran:Report]** — either starts it. From then on that tab IS
   the report: its name starts with **Report:**, and anything more you type
   or attach there is added to the report rather than answered as a
   question, until you press **[en:tran:Send report]**. And when the app itself
   hits an error it asks first, **[en:tran:Something Went Wrong]**, with
   **[en:tran:Not Now]** beside **[en:tran:Report a Problem]**; say yes and the
   help window opens on a card naming the error, with the same **[en:tran:Report]**
   button (type what you were doing first, if you remember — it goes into the
   report). Nothing is looked into before that press, and every one of these
   says first what a report carries: the app's version and build, this
   computer's system information, the window you are in and what is selected,
   what each screen holds, the app's console log, the end of the conversation,
   a picture of the app and any file you attach.
   **Say yes and it goes and looks.** It photographs the app as it stands, notes the
   version, the window you are in and what the screens are doing, reads the app's own
   error log (the errors and warnings the main window has logged, with the name of
   this computer's account taken out of any file path), and then investigates the
   problem in the running app. A few seconds
   later it comes back with what it found and a report written up in your place,
   with a **[en:tran:Send report]** button under it — and, when you attached files, their
   names, so you see what would go. **Nothing is sent until you press that.**
   Thought of something more while it is still writing? Type it and press **Add**:
   it starts the write-up again with your new words in it, and what you attached
   earlier stays with it.
   **Not every problem is a fault in the app, so it helps first.** When what you
   describe looks like something you can put right yourself — a setting, a step
   that was missed — the answer is **Try this first** with the steps, and the
   question _Did that solve it?_ Press **[en:tran:That fixed it]** (or just type _yes_) and
   the report is closed with nothing sent. Press **[en:tran:Still a problem — report it]**
   and the report it wrote while you tried is put in front of you, saying what you
   were told to try.
   **Press Send report and it goes to the people who make the app.** The line under
   the conversation reads _Sending the report_ for a moment. When the app's
   maintainers have a report server open, the write-up goes straight to it together
   with its files — the picture of the app and whatever you attached: pictures, a
   PDF, text files, each up to 5 MB — and the answer starts **Sent**, with the
   report's reference and the names of the files that went. A file that could not
   go is named too, with why. Whatever happens to it, the whole report, with the
   picture, is also saved into your **Downloads** folder.
   **When the report server is not answering, the report is kept for later.** When the
   report server is there but not answering — the computer it runs on is asleep
   or restarting — the app KEEPS the report and sends it by itself as soon as that
   server is back. It tries a minute after the app starts and every half hour
   while it is open, for up to a week, and the answer says so, so there is nothing
   more you need to do.
   **When nothing was sent, email it.** When no report server is open at all, or it
   does not take the report, the answer says plainly that nothing was sent, and why,
   and tells you who wants it. It names the maintainers' email address and
   the subject line to use, and five buttons do the rest — **[en:tran:Copy report]** puts the
   whole write-up on your clipboard, **[en:tran:Copy subject]** the subject line,
   **[en:tran:Copy picture]** the screenshot (paste it into the message and most mail apps
   attach it), **[en:tran:Copy email address]** the address, and
   **[en:tran:Email it]** opens your own mail app with the address and subject filled in (the
   report is on your clipboard, so paste it in and attach the picture from
   Downloads). The address is read from the app's help page at the time, and only
   when that cannot be reached does it fall back to the one built into the app —
   the answer says which. The saved file opens with the same "How to send this"
   section, so it still says where to go a week later. 📸
10. Ask **"where is …"** and name a button — the chatbot outlines it in **red** in the app
    window for a few seconds, and tells you where it is. Nothing is clicked for you. 📸
11. Ask about screens ("is any screen showing?") and the answer comes from the live app,
    not the manual — with a **[en:tran:Hide every screen]** button offered, never pressed for you.
12. With an **AI key** set in **[en:tran:Settings]** → **[en:tran:AI Providers]**, the
    same window becomes a real conversation: the model answers, using the same app
    knowledge and the same tools. Without a key the **[en:tran:Free]** assistant answers instead — a
    shared public service, weaker and sometimes busy — and when no assistant can answer
    (the internet is down, the service is busy) it still answers from the manual, and says
    so. A notice at the top of a **[en:tran:Free]** conversation says that your questions leave this
    computer, and gives you an **[en:tran:Open AI settings]** button that goes straight to the panel
    that takes a key. That panel has one card per provider, and
    each card says in plain words what its key is used for — **OpenAI** answers here and
    powers Bible Cross Reference and Bible Audio, **Anthropic** answers here and powers
    Bible Cross Reference, **Kimi** and **Amazon Bedrock** answer here only — so you can tell which key is
    worth getting before you go and fetch one.
    **Play Bible audio automatically.** Open **[en:tran:Settings]** → **[en:tran:AI Providers]**, then open the **OpenAI** card and save an **OpenAI API key** there. Once that key is saved, this card shows **[en:tran:Auto Play Audio AI when available]**. Turn that switch on so supported Reader passages begin their generated audio automatically. A key for a different provider does not reveal or power this switch.
    **No internet?** The help window still answers from the manual by itself, and
    says so. The `/` commands still work, because they need no key and no
    internet. A server of your own on this computer (below) still answers in full,
    with a model that runs there — not one whose name ends in `cloud`.
    **Every part of the AI Providers and Others pages of Settings folds.** Click a section's
    title — **[en:tran:AI Providers]**, **[en:tran:SongSelect Integration]** or
    **[en:tran:Extra Binaries]** — and it folds to one row, which still says whether it
    is set up (**[en:tran:Key set]**, **[en:tran:Installed]**) and keeps its buttons;
    click the title again to open it. Inside **[en:tran:AI Providers]**, each provider's card,
    **[en:tran:Custom servers]** and each server in it fold the same way: a folded
    card shows a green ✓ beside its name when its key is saved, a folded server when
    the chatbot is offering it. The app remembers what you folded. So when a key box
    or **[en:tran:Add server]** is not where this page says, the part holding it is
    folded — click its title. Choosing an assistant that needs a key (the next step)
    opens whatever is folded in front of its key box by itself.
13. The second list is **who answers** — **Claude**, **ChatGPT**, **[en:tran:Kimi]**, **Bedrock**, and
    **[en:tran:Free]**, which needs no key — and you
    can change your mind between two questions. The ones whose key you have set can be
    chosen; the others are still in the list, in a quieter colour and reading
    **needs an API key**, so you can see they are there and what they want. Choose one of
    those and the conversation stays on the assistant it had, while **[en:tran:Settings]**
    opens on **[en:tran:AI Providers]** with the cursor already in that assistant's key box — for Kimi,
    **Kimi API Key** — ready for the key to be pasted in. If **[en:tran:Settings]** was
    already open on another page, that same window comes to the front and turns to
    **[en:tran:AI Providers]**. Beside it is the third list, the
    **model** that will answer — **Opus 5**, **GPT-5**, **Kimi K3** — and it is a list
    you can change.
    Hold the mouse over a name to see what it is good for, how quick it is and what it
    costs, e.g. `gpt-5`, `best answers · slower` and `$1.25/$10 per 1M tokens (in/out)`, a
    line each; the smaller
    models answer a "how do I" just as well for a fraction of it. A model whose price the
    maker does not publish simply shows no price line rather than a guessed one. Choose **[en:tran:More models…]**
    at the bottom of the list and the window asks your own account what else it can run
    and adds those too. Each tab keeps its own provider and model, and a new tab starts
    on the last pair you picked. 📸
    **Auto, the last row of that list, chooses for you — among the assistants that
    cost nothing.** Pick **[en:tran:Auto]** and the tab stays on it: in front of every question
    the window looks at each of your own servers that costs nothing to ask (one on
    this computer or on the church's own network, or a shared one marked free) and
    asks the best assistant that can answer right now. A server that does not answer
    is left out. One that is already answering another chat tab, and one that has
    just failed or taken more than three minutes over an answer, go to the back of
    the line. Among the rest, a model whose name ends in `cloud` comes first
    (`gemma4:31b-cloud`, `gemma4:cloud`: Ollama runs it on its own computers, so it
    is quicker and stronger than one on a church machine, and your question leaves
    the building to reach it) — the biggest of them first, one whose name gives no
    size last. After those the bigger model is asked first, read off the size in
    its name (`9b`, `12b`); the **[en:tran:Free]** service counts as 8B, so a server model of
    8B or more is asked before it and a smaller one after it — which keeps a small
    model of your own for the day the internet is down. On LM Studio only a model
    that is loaded is asked while one is, because asking for another would load it
    in place of yours. An assistant that needs a paid key is never asked by Auto.
    While it looks, the waiting line reads _Auto is checking which assistants can
    answer_ and then _Auto picked_ with the name; where the model list stood,
    **[en:tran:AUTO PICK]** reads _chosen at each question_ until the first answer and names
    who answered after it. When the one it picked fails before saying anything, the
    next one is asked, and a small line over the answer says who could not answer
    and who did. Because the **[en:tran:Free]** service may be the one that answers, an Auto
    chat carries a notice saying that your questions may leave this computer. A
    server of your own picked by name, with a model whose name does not end in
    `cloud`, is asked first — but when it cannot answer, the question goes on to
    your other servers and then to the **[en:tran:Free]** service (below). Picking
    any named row ends Auto for that tab. **Auto is what a chat starts on** until
    you pick an assistant by name: the help window opens on it the first time, and
    so does every new chat after it. Once you have picked a named assistant, new
    chats start on that one instead, and picking **[en:tran:Auto]** again brings it back. 📸
    **Your own AI server answers too** — LM Studio, Ollama, llama.cpp's `llama-server`
    or llamafile, LocalAI, Jan, GPT4All, vLLM, SGLang or a LiteLLM proxy on this
    computer or on another computer in the church, or any service that speaks the
    OpenAI API. In **[en:tran:Settings]** (the gear at the top of the app's main window, not this one) → **[en:tran:AI Providers]** → **[en:tran:Custom servers]** —
    where, for anyone who has no server yet,
    **[en:tran:Watch how to set up a free AI assistant on your own computer]** is
    followed by **[en:tran:LM Studio videos]** and **[en:tran:Ollama videos]**, each
    opening a page of YouTube videos in your browser — press
    **[en:tran:Add server]**, give it a **[en:tran:Server name]** and its
    **[en:tran:Base URL]** — the address usually ends in `/v1`: LM Studio
    `http://localhost:1234/v1`, Ollama `http://localhost:11434/v1`, llama.cpp,
    llamafile and LocalAI `http://localhost:8080/v1`, Jan `http://localhost:1337/v1`,
    GPT4All `http://localhost:4891/v1`, vLLM `http://localhost:8000/v1`, SGLang
    `http://localhost:30000/v1`, LiteLLM `http://localhost:4000/v1`, or the other
    computer's name in place of `localhost`; a server that asks for a key (LiteLLM,
    vLLM started with one, Jan) takes it in **[en:tran:API key (optional)]** — then
    press **[en:tran:Test]** and **[en:tran:Load models from server]**. **To use it, return to the help window, select your server by its name in the second list (who answers), then select its model in the third list.** An address
    typed one path off is put right by **[en:tran:Test]**: Ollama's bare
    `http://localhost:11434`, an address without its `/v1`, or a door of the
    server's own such as Ollama's `/v1/systemone` is tried at the same computer and
    port's `/v1` and root, the one that answers is saved and the line reads
    _Address corrected to http://localhost:11434/v1_; when nothing there speaks the
    OpenAI API the line says so and names the usual addresses. The server then
    shows in the **who answers** list under its own name, with its models in the
    third list, and a question to it costs nothing when it is on this computer or
    on the church's own network. On LM Studio, Ollama and llama.cpp,
    **[en:tran:Test]** also writes under each model what that program says of it
    in its own words: **Not loaded in LM Studio right now** / **Not loaded in
    Ollama right now** / **Not loaded in llama.cpp right now** (a `llama-server`
    started on a folder of models loads one on the first question that names
    it), or **Loaded in Ollama. Context length: 4k** with the fix
    beside it — load the model again in LM Studio with a **Context Length** of
    32k, set **Settings → Context length** in the Ollama app (or start Ollama with
    `OLLAMA_CONTEXT_LENGTH=32768`), start `llama-server` again with `-c 32768` —
    because the assistant's instructions alone fill most of 16k, and a follow-up
    question runs out of room there. A server of your own is sent the essential
    tools only (14 of the 26 an online assistant gets, about half the words), so
    a cold round costs it half the reading; while it reads, the waiting line says
    _<server> is reading the instructions first — the first answer takes longer on
    a local model_, and a computer that takes more than ten minutes over it is
    told so — _this computer is too slow for that; a general question typed after
    /btw is small enough to answer here_ — rather than that the internet is down.
    A small local model sometimes writes its tool call as words — a
    `<tool_call>` or `<function=…>` block where the answer should be — and the
    window reads it as the call it is and carries on, instead of printing the
    block as the answer; one that does so on its last step is told as _it wrote
    no answer this time — a smaller question, or a larger model, usually
    helps_. Measured 2026-10-10 on the user's LM Studio box over the church's
    network (qwen/qwen3.5-9b at 16k through a proxy on another computer): the
    projector question answered correctly in about 30 s (two rounds, 6.3 s to
    the first token of a cold 10k-token round, under a second once cached,
    ~30 words a second), a follow-up in the same tab ran four rounds in about a
    minute, and **/btw what is holy bible** took 27.5 s with the model's
    thinking on (1 069 generated tokens for a 150-token answer) — which is why
    a general question's thinking is now switched off there.
    **A server shared by the project's own site needs no typing at all.** To use
    one, pick it in the **who answers** list at the top of the help window, as you
    would a server of your own; Settings only lists it. An
    admin who runs a capable computer can put its address in one file,
    `https://www.openworship.app/llm/info.json` (its shape is in the
    project's `docs/llm-registry` folder), and every copy of the app reads
    it when it starts: each server in it stands in the **who answers** list
    beside your own, its models in the third list, marked _shared by
    openworship.app_ and _free_ when the file says so, and never appears in
    **[en:tran:Custom servers]** — it is not yours to edit. It is listed
    right below that box instead, under **[en:tran:Shared servers]**
    (**[en:tran:Settings]** → **[en:tran:AI Providers]**): each shared server with
    a lock beside its name and, opened, its models — to read, with nothing
    to type in and nothing to delete. Its address is not shown anywhere in
    the app: a shared server is for the app to ask, not an address to copy
    and use somewhere else. The small **↻**
    beside the **who answers** list reads the file again without a restart
    (hold the mouse over it to see when it was last read, or why a read
    failed — a failed read keeps the servers of the last good one), and the
    **↻** in **[en:tran:Shared servers]** does the same from Settings, with
    the time of the last read written under it. The address and a key the
    file carries stay on the computer's own side; neither window ever sees
    them. 📸
    How long a local answer takes is the computer's and the program's: one laptop's
    Ollama read 11 words a second on a 4-billion-parameter model, llama.cpp's own
    `llama-server` read the very same model file at 53 on the same laptop and
    answered an app question correctly in three and a half minutes, and a computer
    with a graphics card reads thousands. Each model has a **[en:tran:Sees pictures]** box
    — tick it for a model that can look at a picture;
    **[en:tran:Load models from server]** ticks it for you from LM Studio's and
    Ollama's own word (a `vision` model). A model the server does not have, an
    address that answers nothing, and
    a server whose API takes no tools at all (GPT4All's) is asked once more
    without them and the answer says it came from the guide text alone, with
    nothing checked in the window; a model that cannot use tools (Ollama says so; llama.cpp wants `--jinja`, vLLM
    and SGLang `--enable-auto-tool-choice --tool-call-parser`) are each said in the
    chat as that, never as _not available to the account_. If the server's computer
    is switched off or goes to sleep in the middle of a question, the answer stops
    within a minute or two and says to check that the computer is on and awake,
    instead of waiting on for ten. 📸
    **A key that cannot answer does not leave you with the guide while another of
    yours can.** When the assistant you chose is out of credit, refused, or its
    service is down, the question goes to the next assistant whose key you have set —
    once, at once — and the answer opens with a note saying so: _ChatGPT could not
    answer — the AI account is out of credit or being rate-limited. Claude answered
    instead and this chat now uses it; pick ChatGPT in the row above to switch back._
    The tab's own list moves to the one that answered, so the next question in it does
    not wait on the dead key again; a new tab still starts on the one you picked, and
    the moment that key works it answers as before. A key you pay for never answers
    for the **[en:tran:Free]** assistant or a server of your own, and they never answer for
    it. With no other key, or when the internet itself is down, the answer comes
    from this guide, as before, under a note that says which. 📸
    **A server or a free model that cannot answer hands the question on too.** When
    the server or the **[en:tran:Free]** model you picked by name fails before it answers —
    its computer is off, its program is not running, the free service is full —
    the question goes down the same line **[en:tran:Auto]** uses, among the assistants that
    cost nothing: your other servers on this computer or the church's network
    first, then the rest, the **[en:tran:Free]** service among them, three at most. The
    waiting line says _… could not answer — looking for another assistant that
    costs nothing_ and then _Asking … instead_, and the answer opens with a note
    saying who could not answer, why, and who answered instead — for example
    with a server called Church PC switched off, _Church PC · gemma4:31b could not answer — its server is not answering — check that the computer it runs on is on and awake, and that the server is running. Local Ollama · gemma4:cloud answered instead._
    The chat keeps the one you picked, so the next question asks it first again and
    it answers as soon as it is back. When none of them can, the guide answers
    under a note naming every assistant that was tried. 📸
    **The note says what is wrong, and carries the door to it.** For a key that was
    refused, press **[en:tran:Open AI settings]** under the note and paste a correct key into that
    assistant's box. The reason is read
    from what the provider actually said, not only from how loudly it said it: _the
    AI account is out of credit_ when the account is empty, _being rate-limited
    (asked too often)_ when it is a rate limit, _out of credit or being rate-limited_
    only when the provider said nothing more, _the API key was refused_ for a wrong
    or revoked key, _the AI service is overloaded_ or _having trouble_ when it is the
    service's own fault. And the first button in the row under the note takes you to
    the page that fixes it, in your browser — **Open ChatGPT billing** for an empty
    account, **[en:tran:Open AI settings]** and **Open Claude API keys** for a refused key,
    **Open Kimi usage limits** for a rate limit, **Claude status page** when the
    service is down — named for the assistant that FAILED, so with two keys you top
    up the right one. Hold the mouse over the button to see the address it opens;
    pressing it opens the page and the window says _Opening … in your browser._ The
    **[en:tran:Free]** assistant has no account to go to, so its button is **[en:tran:Open AI settings]**,
    where a key of your own goes. 📸
14. An answer that comes from a page of this guide offers **[en:tran:Show me step by step]**. Press
    it and a numbered card
    appears in the corner of the app window itself, with the button for the current
    step **circled in red**: press **[en:tran:Next]** on the card when you have done it, or
    just do it — clicking the circled button moves the card on by itself. **[en:tran:Back]**
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
15. **[en:tran:Do it for me]** runs the same walkthrough with the app driven for you: the
    card's button becomes **[en:tran:Do it]**, and each press clicks the circled control (or
    types the text) and moves to the next step. One press per step — nothing runs
    ahead of you — and **[en:tran:Skip]** does a step yourself. Anything that changes what
    the congregation sees is offered, never done for you unasked. 📸
    **It presses the button the step names, and nothing that merely resembles
    it.** A step about the drawing panel's _Clear_ does not press the projector's
    _Clear All_; when the only thing on screen is a look-alike, the card says
    what it can see — _the closest control on screen is "Clear All", which is not
    "Clear"_ — and asks the assistant instead. 📸
    **Something in the way is closed first.** With the Bible Lookup popup, a
    right-click menu or a floating panel over the control the step needs, the
    card rings the way out (the popup's red ✕) and says so; in **[en:tran:Do it for me]**
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
    unless you have chosen a half yourself in the first list. **Answers are in your
    language**: the one you write in, and the one the app is shown in whenever that
    cannot be told — a "yes", a number, a suggestion you pressed. That is any
    language, not only the ones the app can be shown in: a question written in
    Spanish or Thai is answered in it — in a language you have not installed, only when
    its letters tell which: a script of its own, or a letter English never writes, such
    as an accent; a question in plain English letters, as Swahili is written, is answered
    in the language the app is shown in — and the suggestions under the answer
    too, with every button named the way your screen shows it. With the app in
    Khmer the window's own buttons and labels are in Khmer too, drawn in the app's
    Khmer letters, and so is the AI Chat (✨) window. Behind the scenes, an assistant
    that is not a Gemma 4 model works in English: a Gemma 4 model running on this
    computer or your network puts your question into English and the answer back
    into your language, and the waiting line says so. A Gemma 4 model that answers
    is simply asked in your language. 📸

> With no key set, the **[en:tran:Free]** assistant answers through a shared public service, so your
> questions and anything you attach leave this computer — the notice at the top of the
> conversation says so. The manual is bundled inside the app.

18. **It can turn words you already have into a song.** Paste the verses of a song
    into the box of this help window, where you type a question (not into the Lyric
    Editor) — from an email, from a hymn sheet, from a page you found — and ask
    for a song; or attach a `.txt` of the words, or the PowerPoint (`.pptx`) slides
    a hymn is projected from (the **⋮** at the left of the box → **[en:tran:Attach a file]**); or give it the
    address of a page the words are on. One of the **[en:tran:Try asking]** chips offers this
    outright: _Can you make a song from words I paste in?_ 📸
    The answer comes back in plain words — what the song came out as, its parts and
    the order they play in, and **what it had to guess**, which is usually the key,
    the tempo, the time signature and the author, because ordinary lyrics say none of
    those. Underneath it are two buttons: **Create "<the song's title>"** and
    **[en:tran:Copy song text]**. 📸
    The song's own notation never appears in the chat, and you never have to type it.
    **[en:tran:Create]** writes a real song into your documents list, ready to put on a screen,
    and answers with two things to press: **[en:tran:Show it in the list]**, which draws a red
    ring round the new song's row in the app window behind, so you can see exactly
    where it landed; and the song's name, which opens it over the conversation, with
    **[en:tran:Open folder]** under it for the folder it was written to.
    📸 It never replaces a song you already have: press it twice and the second is
    saved beside the first with `(1)` after the name. **[en:tran:Copy song text]** puts the same thing on the clipboard, to paste
    straight into the Lyric Editor.
    Labels help it: write `Chorus`, `Verse 2`, `Bridge` or just `1.` and `2.` above
    the blocks and it uses them. Typed on one line works too: _Create a song called
    Morning Praise with these words: Verse 1: We lift our eyes to you this morning,
    Chorus: Holy, holy, holy Lord._ — each label with a colon after it starts a part
    of its own, a ` / ` between words starts a new line, and the title you named is
    the song's. Without labels each block becomes a verse, and a
    block repeated word for word is written once and sung each time it appears. Chord
    lines above the words are left out — Open Lyric puts chords inside the words —
    and a section it cannot make sense of is kept whole, with your own label above it,
    rather than dropped. If you paste something that is not a song, it says so instead
    of inventing one.
    **On a server of your own, type /lyric first.** A server of your own is sent no
    song tools, so pasting the words and asking does not write the song there: type
    **/lyric** first and paste the words after it in the same message. Press **[en:tran:Send]** or **Ctrl+Enter** to submit it; the app then writes them out itself, with the same two buttons.
    **Those two buttons are the only thing to press.** The assistant sometimes
    writes its own suggestions under an answer, but under a song it never repeats
    the buttons in other words — _Create the file_ or _Copy the text_ are not
    offered, because the real buttons are right there and do the job without
    asking anybody. 📸
    **Pasted words become a song even when the assistant cannot answer.** With the
    assistant out of credit, or refused for asking too often in a minute (a free
    Kimi account allows about three questions a minute), a paste of song words is
    written out by the app itself in a second or two, under a note that reads
    _I wrote the song out myself instead_ — with the same **[en:tran:Create]** and
    **[en:tran:Copy song text]** buttons, and nothing searched in this guide for the words. 📸
    **A song from a file in your Documents list.** With nothing attached, type
    _new lyric from powerpoint_ — or _make a song from my PDF_, or the file by its
    name: _make a song from Amazing Grace.docx_ — and the app answers by itself, with
    no assistant asked: the files of that kind in your Documents list (slide
    documents, PowerPoint and Word files, PDFs), up to six, each a
    **Make a song from "<file>"** button, and how to reach the others — name the
    file in your question. A file you named is written out at once. A button writes
    its song out in a moment, named by the title slide — for a hymnal, its number,
    the hymn's name and its English name when the slide carries both — with the
    verse numbers out of the words, and nothing is written beside your file;
    **[en:tran:Create]** saves it as above. A PowerPoint or a Word file is read through the same
    converter the Documents list shows its slides with, a slide document by its text
    boxes, a PDF by the words in its first eight pages (a scanned PDF has none to
    read). A slide document or a Word file attached in the box works the same with
    _make a song from it_, and so does that line with the box empty, for the file
    the chat last carried; the card of choices the window shows for a slide
    document carries **[en:tran:Make a song from it]** too. `.ppt` and `.doc` files are not read —
    save them as `.pptx` or `.docx` first. In a window shown in another language the
    answer and its buttons are in that language. 📸
19. **Name a song, or give the address of a song page, and it is written out for
    you.** The fourth **[en:tran:Try asking]** chip is not a question but the start of one:
    _Create a lyric file for song "Amazing Grace"_. Pressing it does not ask
    anything — it drops the sentence into the box with the cursor in it, so you can
    press **Ctrl+Enter** as it stands or swap the title for the song you want. 📸
    A song asked for by its NAME is looked up, never remembered: first in your own
    songs (if you already have it, the answer says so before making a second copy),
    then in the app's collection of public-domain hymns — the same texts, with the
    same link back to where they were transcribed from, that
    **[en:tran:Import From Public Domain Songs]** brings in. A song that is in neither — most songs written in the
    last seventy years — is said so plainly, with the nearest hymn titles when there
    are any, and a request for its words or for the address of a page with it on.
    The address is the other way in: _Create a lyric file from
    https://example.com/lyric/amazing_grace_ is in **[en:tran:More…]**, and works the same
    way — swap the example address for the one you have. A banner appears in the
    app window naming the site while it reads.
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
    press **[en:tran:Create]**.
    Because it is a guess about someone else's page, the answer always says **which
    part of the page it used**, quoting the first and last line it took and how many
    lines of menus and links it left out. Read that line. If it took in too much or
    stopped too early, say so in your own words — _the song starts at "…" and ends at
    "…"_ — and ask again. Everything else is the same as pasting the words yourself:
    the two buttons underneath, and nothing written to disk until you press
    **[en:tran:Create]**.
    **Several songs at once.** Put two, three or four addresses in one message —
    _Create lyric files from_ and the links — or attach up to four PowerPoint files
    (the **⋮** at the left of the box → **[en:tran:Attach a file]**) and type _Create lyric files from these_.
    `/lyric` followed by several links does the same. The app reads them one after
    another by itself, with no assistant asked, and answers with every song at once:
    a box per song, shut, named by its title, to open and read before anything is
    made, and under them **Create all N songs** first, then each song's own
    **Create "<title>"** to make just that one. **Create all N songs** saves every
    one and answers _Saved N songs: …_ with one file under it for each. A page or a
    file it finds no song in is named in a sentence of its own, and links past the
    fourth are left for another message. From a hymnal's slides, the verse numbers
    are left out of the words, a note for the musicians at the end (_music, then
    sing verses 3 and 4 again_) is kept in the file but never put on the screen,
    and a chorus printed after every verse is written once and played after each.
    📸
20. **Ask for a new running order, slide document, Bibles list or background,
    and it is made.** Type what you want in an ordinary chat, the way you would
    say it: _Create a running order called Evening Service._, _Make a new slide
    document called Sunday Welcome with a welcome slide and an announcements
    slide._, _Save John 3:16 to my Bible list._, _Make a new Bible list called
    Easter with John 20:1-18 and 1 Corinthians 15:3-8._, _Make a background web
    page with a soft blue gradient._, _Add this video as a background:_ and its
    link. 📸
    **In your own language too.** The same asks typed in a language installed
    in **[en:tran:Settings]** → **[en:tran:Languages]** are made the same way,
    even with the app in English: _Hazme un orden de culto nuevo para el
    miércoles, por favor_ makes a running order, and a Khmer request with
    Khmer numbers saves the verses to your Bibles list. The answer's own
    sentence (_I made …_) is in the language the app is shown in.
    **Asked for empty**, the file is made at once and the answer says where:
    _I made "Evening Service" for you. It is in Presenting Flows now._ Under it
    is that file's own card, with the file waiting in the box, so the next thing
    you type is about it — _add Amazing Grace and John 3:16_. A name that is
    taken gets `(2)` after it; with no name it is called after the day, such as
    _Slides 2026-11-12_.
    **Asked for with things in it**, it is made and filled in the same answer:
    the slides with their words, a verse as your Bible reads it with its
    reference under it, a running order's songs, passages and countdown. Songs
    must already be in your Documents; the answer says which it could not find.
    Nothing goes on a screen.
    **Passages for a Bibles list** are saved straight away, without the
    assistant: the answer names each one as the Bible writes it, a list it made
    (_I made "Easter" for you. It is in Bibles now._), and a reference no
    installed Bible can read. _My Bible list_ is the list called Default; _the
    Wedding list_ is one you named. Asked in the Bible Reader, the Reader's own
    list is used. A passage the list holds already is not saved again: the
    answer says _… is in your Bibles list already, so it is not saved twice._
    **A list you carry can be pasted as it is**, one passage a line, the way
    you keep it: _Add these to my Bibles list:_ and under it _John 3:15 (kjv)_,
    a passage in another installed Bible's own words and numbers with that
    Bible's name in brackets, _GEN 1:2-_, and so on. Each one is saved in the
    Bible written beside it. Passages inside a paragraph are found too: _Last
    Sunday at 10:30 am we sang 2 hymns, then read Ph 4:13 and Romans 8:28-30,
    and Pastor preached on John 3:16, 17. Save these to the Easter list._
    saves Romans 8:28-30, John 3:16 and John 3:17 and leaves the time and the
    hymns alone. **What is not clear is asked, never guessed**: _Which do you
    mean by “GEN 1:2-”? Press one and I will save it._ over **Genesis 1:2-31**
    and **Genesis 1:2**; _Ph_ as each book it could be; and a Bible that is
    not installed -- _No Bible called “niv” is installed. Which Bible should I
    save … in?_ -- with one button for each Bible you have. Press one and that
    passage is saved, with its own **[en:tran:Undo this change]**, and the next
    question comes; **[en:tran:Skip]** leaves it out. 📸
    **Adding is never showing**: _add bible items for me for:_ with _john 3:16
    gen 1_ under it, short names in lower case and all, is saved -- _Saved
    (KJV) John 3:16, (KJV) Genesis 1:1-31 to your Bibles list._ -- and nothing
    goes on the screen. Asked for a passage by its words only (_add a bible
    item for me: the verse that says the Lord is my shepherd_), the answer
    offers the passage as a button, **Psalm 23:1**; pressing it saves it the
    same way. To put a passage up, say so: _put John 3:16 on the screen_.
    **From the Bibles panel**: under the Default list,
    **[en:tran:Add Bible Item]** asks how -- **[en:tran:Bible Lookup]** opens
    the lookup as before, and **[en:tran:Open in Chatbot]** opens the
    assistant in a chat of its own whose box already holds its first line,
    _Add the Bible passages in this text to my Bibles list:_, in the language
    the app is shown in, the cursor on the line under it. Paste a list or a
    paragraph there and press **[en:tran:Send]**: every passage in it is
    saved to the list called Default -- a whole chapter in the middle of a
    sentence too (_we will read Psalm 23 together_) -- and what is not clear
    is asked as above. Sent with nothing under it, the answer says so and
    the line waits in the box again. With AI features turned off the button
    opens the lookup straight away. 📸
    **A background web page** is written by the assistant and saved in
    **[en:tran:Background]** → **[en:tran:Webs]** under the name you gave (or
    the day's, such as _Background 2026-11-12_): _I made "Calm Sea" for you. It
    is in Webs now._ It fills the screen, loads nothing from the internet and,
    if it moves, only slides or fades, which an old computer can keep up with.
    **A video or a song's sound from a link** is not downloaded by the chat:
    the answer copies the link for you and says where to press -- in
    **[en:tran:Background]** → **[en:tran:Videos]** (or **[en:tran:Audios]**),
    right-click an empty part of the list, **[en:tran:Download From URL]**; the
    box already holds the link, so **[en:tran:Ok]** is all that is left (W-21).
    **[en:tran:Show me step by step]** under it rings each control.
    **[en:tran:Undo this change]** under the answer takes it all back: what was
    put in, and a file, list or page it made. 📸
    A question about HOW to make one (_How do I make a new slide document?_) is
    answered with the steps, and nothing is made.
21. **[en:tran:Enable AI features]** turns all of this on or off. It is in
    **[en:tran:Settings]** → **[en:tran:AI Providers]**, at the top of the
    section (click the section's title if it is folded). To
    turn the whole feature off, untick it and restart the app: the chatbot, its tools
    and the debugging endpoint they use are then never started. Tick it and restart to
    turn it back on.

_Verify: CB-01, CB-02, CB-03, CB-04, CB-05, CB-06, CB-07, CB-08, CB-12, CB-13, CB-14, CB-15, CB-26, CB-27, CB-28, CB-29, CB-31, CB-32, CB-43, CB-46, CB-48, CB-62, CB-66, CB-71, CB-83, CB-84, CB-85, CB-86, CB-87, CB-90, CB-97, CB-121, CB-122, CB-123, CB-124, CB-126, CB-127, CB-128, CB-129, CB-130, CB-134, CB-135, CB-136, CB-137, CB-138, CB-139, CB-140, CB-143, CB-153, CB-165, CB-175, CB-180, CB-181, CB-184, CB-185, CB-186, CB-187, CB-188, CB-189, CB-190, ST-67, ST-68, ST-69, ST-70, ST-71, ST-72, ST-73, ST-74, ST-78._

### W-47 — Put messages on the screen

**Goal:** put up the words everyone needs to read around a service that are not
slides — a parking notice, an offering notice, a call for the next speaker.

1. Open the **[en:tran:Foreground]** tab. The launcher that opens is a menu of
   components, and the first row in it is **[en:tran:Messages]** — it is first
   because it is the one you open in a hurry.
2. **Write your messages.** Press **[en:tran:Add Message]** for each one. Every
   message gets its own box and can be **as many lines as you like** — a line
   break in the box is a line break on the screen. After typing in the second
   box, the first message still has the words you gave it. The arrows beside a
   box move that message up or down the list — and on the screen too, if it is
   up there; the ✕ removes it.
3. **Put one up.** Press the screen button on a message's own row. It appears
   over whatever is already on the screen — the slide, the verse, the background
   — and it **stays there until you take it down**. There is no delay and no
   countdown: nothing removes it but you. Press the same button again to take it
   off; it now reads _hide_.
4. **Several at once.** Show a second message and it sits **underneath** the
   first rather than on top of it, however many lines each one has — a long line
   the screen wraps onto two counts as two. Hide the one above and the one below
   moves up to close the gap. If they would run off the bottom of the screen,
   they are made smaller together until they fit. This is how you put a parking
   notice and an offering notice up together.
5. **The whole set.** **[en:tran:Show All Messages]** puts every message up at
   once as one block — made smaller, too, if it would not fit on the screen. It
   takes the place of any of them you showed one by one, and showing one again
   takes the block down, so the same words are never on the wall twice. Tick **[en:tran:Rotate]** first and a seconds box appears:
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
7. **F4** is the shortcut while the **[en:tran:Messages]** panel is open: with a
   screen ticked it puts the session up, and
   pressing it again takes everything down. If no screen is ticked it tells you
   so rather than guessing.
8. The text is plain. Typing `<b>loud</b>` puts those angle brackets on the
   screen exactly as you typed them; a message is never treated as formatting.
   Use the save buttons at the top to keep a whole session — every message in it
   — and pick it back next week.

_Verify: PM-134, PM-135._

### W-48 — Give a slide, a song, a background or an overlay its own transition

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
   **[en:tran:Fills]**, **[en:tran:Videos]**, **[en:tran:Cameras]**,
   **[en:tran:Webs]**) and choose **[en:tran:Transition]**. Ticked, every
   background from that tab comes in that way; the tab shows the effect's icon
   after its name.
5. **One background.** Press the ⋮ on a picture, video or web tile (right-click
   a colour swatch, a gradient or pattern tile, a camera or a web link) and choose
   **[en:tran:Transition]**. It follows its tab until you tick it; a picture or
   video tile then shows the effect's icon in its corner.
6. **A foreground panel, all its sessions.** Each foreground panel but
   **[en:tran:Long Text Show]** (**[en:tran:Countdown]**, **[en:tran:Quick Text]**,
   **[en:tran:Marquee Top]** …) has a transition button in its title bar, next
   to the collapse arrow.
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

_Verify: PM-154, PM-155, PM-156, SP-06, ED-54._

---

### W-49 — See every keyboard shortcut for this page (Help → Keyboard Shortcuts)

**Goal:** find the key for something without hunting through tooltips, and
learn the keys of the page you are on.

1. On the menu bar, open **Help → [en:tran:Keyboard Shortcuts]**. It sits
   under **[en:tran:Tips of the Day]** and **[en:tran:All tips]**.
2. A floating panel opens titled **[en:tran:Keyboard Shortcuts] ·** and the
   page you are on — **[en:tran:Presenter]**, **[en:tran:Bible Reader]** or
   **[en:tran:Slide Editor]**. The cursor is already in
   **[en:tran:Search shortcuts]**. Each row says what a key does on the left
   and shows the key on the right; a key with two spellings shows both
   (**[en:tran:Redo]** is `Ctrl+Shift+Z` and `Ctrl+Y`). A grey line under a
   heading or a row says when the key works — for example
   **[en:tran:While the slides panel has focus]**: the slide arrows only move
   the slides after you click into the slides panel — or after three quick
   presses, the row
   **[en:tran:Take the keys back to what is being presented]** (W-49b).
3. Each page lists its own keys. The Presenter starts with
   **[en:tran:Screens]** (`F5` shows or hides the selected screens, `F6`–`F10` clear them,
   `F4` the messages), then **[en:tran:Slides]**, **[en:tran:Bible Lookup]**,
   **[en:tran:Presenting Flow]**, **[en:tran:Long Text Show]** and the mini
   screen's
   **[en:tran:Drawing]** and **[en:tran:Focusing]** keys. The Bible Reader
   lists the lookup and split keys, and the Slide Editor the canvas keys.
   Every page ends with **[en:tran:Every window]**,
   **[en:tran:Presenting Control]** and **[en:tran:Dialogs and menus]**. On a
   Mac the keys are shown the Mac way (`⌘⇧ S`).
4. Type a word or a key — `clear`, `split`, `f5` — and the list narrows to
   the rows that match; the counter beside the box shows how many of the
   page's keys matched. **[en:tran:No shortcuts found]** means nothing did.
5. **Esc** in the box empties it; a second **Esc** closes the panel, and so
   does its **✕**. Drag the title bar to move the panel, drag an edge to
   resize it, and use the chevron to roll it up to its title. It opens again
   where you left it.
6. The panel does not take the keyboard away from the app: with it open,
   every key it lists still works, so you can read a key and try it. Only
   typing in its own search box stays in the box — Enter, Tab and the arrows
   there do not reach the page behind it, while a function key such as `F5`
   or a `Ctrl` key still does.
7. **With the Bible Lookup open.** In the Presenter or the Slide Editor,
   open **[en:tran:Bible Lookup]** (`Ctrl+B`) and then **Help →
   [en:tran:Keyboard Shortcuts]** — or open the lookup while the panel is
   already up. The panel sits over the lookup popup, its title changes to
   **[en:tran:Keyboard Shortcuts] · [en:tran:Bible Lookup]**, and it lists
   only the keys that work inside the lookup: typing a reference, completing
   it, splitting, saving, **[en:tran:Close the Bible Lookup popup]**
   (`Ctrl+Q`) and the dialog keys. The page's own keys (`F5`–`F10`, the
   slide arrows) do nothing while the lookup is open, so they are left out.
   Close the lookup and the panel goes back to the page's list.

_Verify: KB-61, KB-62, KB-63, KB-64, KB-65._

---

### W-49b — Run the slides from a presenter remote (get the keys back without a click)

**Goal:** keep moving to the next slide from a remote, or from the keyboard,
when you cannot walk back to the computer to click a panel.

1. **Space**, **→**, **↓** and **Page Down** — the keys a presenter remote
   sends for _next_ — move a panel only while that panel has the keys: the
   presenting flow's preview panel (W-22b), the slides in the middle of the
   Presenter (W-03), a floating **[en:tran:Slides]** preview of another
   document, or the lit part of a **[en:tran:Long Text Show]** (W-53). One
   click anywhere else — a document in the list, a button under
   a screen — and the keys go to what you clicked, so the remote seems dead.
2. **Press the key three times quickly** — inside a second and a half. The
   keys go back to what is being presented. That third press only hands the
   keys over: nothing on the screen changes. The **next** press moves on.
   If nothing happens, check whether a slider has focus or the cursor is in a
   box you type in, such as the open **[en:tran:Bible Lookup]** box: three presses
   leave those controls alone.
   Also check that one of the four panels below has something being presented.
3. **Which panel takes them** — the first of these that has something going:
   - a presenting flow's preview panel whose run has started (one of its
     lines wears the outline);
   - the slides in the middle of the Presenter, while one of that document's
     slides is on a screen;
   - a floating **[en:tran:Slides]** preview, while one of its slides is on a
     screen;
   - a **[en:tran:Long Text Show]** whose text is on a screen with one of its
     parts lit: the keys go to that part's button, on the top card.

   So with a running order started and a song on the screen as well, it is
   the running order that takes the keys. When none of the four has anything
   going, three presses change nothing — there is nothing a key could move —
   so click what you want to present first.
4. **Nothing at all has the keys** — you closed the panel you were in, say:
   there is no need for three presses. The first press goes to the same
   panel, in the same order, and moves it on.
5. **What the three presses never take the keys from:** a box you type in, a
   slider, or an open **[en:tran:Bible Lookup]** with the cursor in its box — there the keys keep
   doing what they do. And a panel that is already moving is left alone
   however fast you press: stepping quickly through a song never jumps you
   over to the running order.
6. **Help → [en:tran:Keyboard Shortcuts]** lists this under
   **[en:tran:Slides]** as
   **[en:tran:Take the keys back to what is being presented]** (W-49).

_Verify: KB-66, KB-67, KB-68._

## Screen Mirror

### W-50 — Present on another computer with Screen Mirror

Use one app as the host and another as the guest. Both computers need the same
app version and a reachable network connection — the same network, or the
internet once the host opens to it (step 7).

1. On the host's Presenter, click **[en:tran:Mini Screen Options]** — the ⋮
   at the bottom right of the Mini Screen list — and in the menu it opens
   click **[en:tran:Virtual Screens Manager]**, then pick the floating
   panel's **[en:tran:Screen Mirror Connection]** tab. The panel remembers
   which tab was open and whether it was open at all. Hosting is off until you
   turn on **[en:tran:Let other computers connect]** at the top of the tab —
   until then no other computer can find or join this one.
   Once it is on, the panel shows **[en:tran:Host addresses]** and
   **[en:tran:Port]**: the app serves HTTP and WebSocket on an available port
   from 39240–39259, and the switch stays on for the next launch. Under
   **[en:tran:This network]** each address of this computer is written as
   `address:port` (for example `192.168.1.3:39240`) with two buttons:
   **[en:tran:Copy address]** puts that text on the clipboard, and
   **[en:tran:QR code]** shows it as a QR code under the row. The code holds
   the same plain text, not a link, so a phone that scans it offers the words
   to copy. **[en:tran:Copy image]** under the code copies it as a picture,
   with the address written beneath it, to send to whoever sets up the guest.
2. On the guest, open the **[en:tran:Screen Mirror]** page. It has no app
   header, only a top bar: **[en:tran:Presenter]** at its left goes back, and
   at its right are the Presenter header's own buttons. The cup is
   **[en:tran:Stay Awake]** — on unless you switch it off, it keeps this
   computer from sleeping for as long as the page is open, which is what a
   computer standing in for a projector needs — then the gear for Settings,
   the 🤖 **[en:tran:App Assistant]**, ✨ **[en:tran:AI Chat]** and
   **[en:tran:Help]**. The 🤖 opened here answers about this page. The page
   looks for hosts as it opens, listing them under
   **[en:tran:Hosts on this network]**; **[en:tran:Rescan]** looks again.
   The scan asks on every network this computer is on, at every port from
   39240 to 39259; a host that answers on several networks is listed once,
   on its best address (a real LAN before a virtual adapter or loopback), and
   the first host is filled into **[en:tran:Host address]** and
   **[en:tran:Port]** under **[en:tran:Connect by address]** — never over
   an address you typed or a host you picked. Pick another host or type an
   address if needed, then click **[en:tran:Connect]**. An address someone
   sent you needs no retyping: **[en:tran:Paste address]** fills
   **[en:tran:Host address]** and **[en:tran:Port]** from whatever was
   copied — `address:port`, a whole `http://` link, an IPv6 address in
   brackets, or a picture of the host's QR code — and
   **[en:tran:Read QR code]** does the same from a picture file you choose.
   Pasting `address:port` straight into **[en:tran:Host address]** splits it
   too, and a picture pasted anywhere in the form is read as a QR code. A
   clipboard with no address in it reads
   **[en:tran:No host address found in the clipboard.]** and leaves the form
   as it was. In approval mode the guest reads
   **[en:tran:Waiting for host approval]** while the host clicks
   **[en:tran:Allow connection]** in the floating panel.
   **When no host is listed**, the list reads
   **[en:tran:No host found. Open the app on the host and check that both computers are on the same network.]**
   A host can be found only once its **[en:tran:Let other computers connect]**
   is on (step 1), and the scan reaches only the networks this computer is
   on: check both, then click **[en:tran:Rescan]**. A host on another network
   is reached by typing its address under **[en:tran:Connect by address]**,
   once that host is open to the internet (step 7).
3. The guest reads **[en:tran:Connected]**, and under
   **[en:tran:This computer]** its monitors carry the prefix the host knows
   it by, such as a1 — the name to pick in the host's display picker. The
   host lists it under
   **[en:tran:Connected guests]** above the Mini Screen previews and at the
   top of their list menu. Each guest has a stable prefix such as a1 or a2;
   click its header button to open the floating panel, on the tab it was last
   on (the guest's row in the list menu opens it on
   **[en:tran:Screen Mirror Connection]**). In the panel every
   guest and every request carries where it came from:
   **[en:tran:This network]** for a computer on one of the host's own
   networks, or **[en:tran:Internet]** — a globe and an amber border — for
   one from outside. The header button of an internet guest is amber with a
   globe as well.
4. Choose the guest's prefixed monitor in the screen card's display picker.
   Present a slide and a background image, then use the card's show control
   (F5). The guest opens the presentation output on that monitor, in front
   of its own app window. Images and
   other host files load through the host's HTTP service; the guest does not
   need its own copy of them. They load from the address the guest dialled,
   so a guest that reached the host through a router gets them through that
   router too.
5. Close the floating panel with its **✕**, or toggle
   **[en:tran:Virtual Screens Manager]** again. The connection and its
   header entry stay active. To end the connection, use
   **[en:tran:Disconnect]**. The guest output closes and its entry leaves
   the host's connected-guest header.
6. In **[en:tran:Background]** → **[en:tran:Cameras]**, the host also lists
   connected guests' cameras with their prefixes. Selecting a camera streams
   it to the host preview and to the selected guest output. Selecting an
   image instead releases the camera stream. Camera access must be available
   on the computer providing it, and a guest offers its cameras only once
   **[en:tran:Share my cameras]** — the camera button in that host's panel on
   the guest's **[en:tran:Screen Mirror]** page, off for every new link — is
   turned on.
7. To let a guest connect from outside this network, turn on
   **[en:tran:Open to the internet]** under
   **[en:tran:Let other computers connect]**. It is off until you turn it
   on, and remembered. A warning says that anyone with the address can ask to
   connect and that the connection is not encrypted (folded to one line; its
   chevron, or a click on it, shows it all — the router and tunnel notes fold
   the same way, and each stays as you left it): choose
   **[en:tran:Require connection code]** under **[en:tran:Guest access]**,
   and turn the option off when you are done. The host asks the router to
   forward its port (UPnP); once **[en:tran:The router opened the port.]**,
   an **[en:tran:Internet]** list shows the router's public address marked
   **[en:tran:Router]**, and any global IPv6 address of this computer marked
   IPv6 — which works only if the router lets incoming connections through.
   When no router answers, or it refuses, the panel says so and shows the
   port and this computer's address to forward by hand on the router;
   **[en:tran:Ask the router again]** tries once more. A public address or a
   DDNS name typed into **[en:tran:Public address (optional)]** and saved
   with **[en:tran:Save address]** is listed too. Every internet address has
   the same copy and QR buttons. A router that sits behind another network
   (carrier NAT) cannot be reached from the internet at all; the panel says
   so and suggests a VPN such as Tailscale instead. Turning the option off
   removes the router's port forward and ends every guest that came from the
   internet — the ones on this network stay. While it is off, a computer
   outside this computer's own networks is refused. Five wrong connection
   codes from one sender lock it out for ten minutes.
8. A guest can be linked to several hosts at once. Once one is connected,
   **[en:tran:Hosts on this network]** and **[en:tran:Connect by address]**
   stay under its panel: pick or type another host and click
   **[en:tran:Connect]** again. Each host gets a panel of its own — its own
   status, the prefix that host gave this computer, and a
   **[en:tran:Disconnect]** that ends only that link. A host already linked
   reads **[en:tran:Connected]** in the list and cannot be picked again;
   connecting to it a second time by address is refused with
   **[en:tran:Incompatible or duplicate connection]**. A link that failed —
   a wrong code, say — keeps its panel with the reason, and its host can be
   picked again to retry. Two hosts can each show a screen on this computer
   at the same time.

_Verify: SP-25, SP-26, SP-27, SP-28, SP-29, SP-32._

### W-51 — Show screens on a virtual display and watch it from another device

A virtual display is a monitor that exists only inside the app. Screens are
shown on it exactly as on a real monitor, and any phone, TV or computer can
watch it — in a web browser, or as a video in a media player — without a
cable or a second copy of the app.
1. On the Presenter, click **[en:tran:Mini Screen Options]** — the ⋮ at the
   bottom right of the Mini Screen list — and in the menu it opens click
   **[en:tran:Virtual Screens Manager]**, then pick the floating panel's
   **[en:tran:Virtual Displays]** tab (it opens on the tab it was last on). The screen card's display picker gets
   there too: its last row, **[en:tran:Manage Virtual Displays]**, opens the
   same tab.
2. Click **[en:tran:Add Virtual Display]**. A display named
   **[en:tran:Virtual Display]** and its number is added at 1920 × 1080 with a
   black wallpaper, and its card opens. Up to eight can exist; a deleted
   display's number is never given to a new one, so an address someone saved
   never shows them a different display.
3. The card's header shows the name, the size and what it is doing:
   **[en:tran:Idle]** while nobody watches, **[en:tran:Live]** with the number
   of people watching. Its chevron folds the card. Inside,
   **[en:tran:Settings]** holds **[en:tran:Name]** (saved when you leave the
   box or press Enter), **[en:tran:Resolution]** — a size from the list, or
   **[en:tran:Custom]** with **[en:tran:Width]**, **[en:tran:Height]** and
   **[en:tran:Apply]** — and **[en:tran:Wallpaper]**:
   **[en:tran:None (black)]**, **[en:tran:Color]** (a colour box),
   **[en:tran:Image]** or **[en:tran:Video]** (each with
   **[en:tran:Choose File]**; a file that has gone reads
   **[en:tran:File not found]**). A video wallpaper plays on a loop, without
   sound. While someone watches, the card warns that changing the
   resolution restarts the stream for everyone watching — their player stops
   and has to be opened again. **[en:tran:Settings]** and
   **[en:tran:Where to watch]** each fold under their title; the card and both
   parts stay folded or open as you left them, also after a restart.
   **[en:tran:Preview]**, at the top of the card, shows the display inside it.
4. In a screen card's display picker, choose the display — it is listed as
   its name, **[en:tran:Virtual]** and its size, such as
   `Virtual Display 1 (Virtual): 1920x1080`. Present something and use the
   card's show control (F5): no window opens on any monitor; the screen shows
   on the virtual display instead, over its wallpaper. Several screens on one
   display are stacked in the order they were shown, the way they would be on
   a real monitor, and the card says so while they are.
   **[en:tran:Screens on this display]** under **[en:tran:Settings]** lists
   them. With no second monitor plugged in, songs and new slides are laid out
   for the virtual display's size, so they fill it. A screen showing on a
   virtual display is showing again, with what it held, when the app starts
   next time, so its viewers are not left on the wallpaper; hide it (F5) and
   it stays hidden. A screen on a real monitor never comes up by itself, and
   going to the Bible Reader, which hides every screen, keeps them all
   hidden.
5. Sound from a screen on a virtual display goes into what the display
   streams, not out of this computer's speakers: the Mini Screen's
   background audio player for that screen stays muted, but its play, pause,
   position and volume still drive the sound the viewers hear.
6. **[en:tran:Where to watch]** starts with the address to give someone,
   marked with a star and its QR code already open: this computer's best
   network (a router's 192.168 before a VPN or a virtual adapter), and any
   internet address you opened. Each address has **[en:tran:Copy address]**
   and **[en:tran:QR code]** (the code holds the whole link). The starred
   address sits under **[en:tran:Watch in a browser]**; every other address,
   and the MP4 ones, fold under **[en:tran:More addresses]**. A phone or a computer
   opens an address. A TV is reached with **[en:tran:Cast to a TV]** instead, the cast icon
   in the display card's header (step 8): choose the TV in its list and press **[en:tran:Cast]**. The two kinds:
   - **[en:tran:Watch in a browser]** — `http://<address>:<port>/vd/<number>/`.
     The browser draws the display itself from what the app sends it, so it is
     the fastest way to watch, and this computer encodes nothing for it.
   - **[en:tran:Video for media players (MP4)]** (folded under **[en:tran:More addresses]**) —
     `http://<address>:<port>/vd/<number>/video`, an H.264 + AAC MP4 for a
     player such as VLC or OBS. It is made only while someone plays it.

   **Use the display in VLC or OBS.** Choose the virtual display in a screen card's
   display picker, present the content and turn that screen on with the card's show
   control (F5). In the display card's **[en:tran:Where to watch]**, open
   **[en:tran:More addresses]** and copy the **[en:tran:Video for media players (MP4)]**
   address into VLC or OBS. If the player is on another device, first turn on
   **[en:tran:Let other devices watch]** above the display cards.

   The port stays the same from one launch to the next, so a saved address
   or a printed QR code keeps working after the app restarts.

   Until **[en:tran:Let other devices watch]** is on — a switch at the top of
   the **[en:tran:Virtual Displays]** tab, above the display cards, not inside one —
   only **[en:tran:This computer]** addresses are listed and nobody else can
   watch. Turned on, it lists **[en:tran:This network]** addresses; turning
   on **[en:tran:Open to the internet]** as well (the same option as Screen
   Mirror's, with the same warning) lists **[en:tran:Internet]** ones. On this
   computer's own networks no code is asked for: anyone who has the address
   can watch. A viewer from the internet is sent nothing until you click
   **[en:tran:Allow connection]** on its row under **[en:tran:Watching now]**
   — or, with **[en:tran:Guest access]** set to
   **[en:tran:Require connection code]**, until it gives the code.

   **Give a virtual display an HTTPS address.** At the top of the **[en:tran:Virtual Displays]**
   tab, turn on **[en:tran:Let other devices watch]**, then **[en:tran:Use HTTPS]**
   directly below it. Open the display card's **[en:tran:Where to watch]** section
   and copy its starred `https://` address under **[en:tran:Watch in a browser]**.
   Other devices use that address, on the same port. A phone's
   page on this network can then do what a browser allows only a secure
   page: keep the screen awake in full screen, and send its microphone and
   camera. This computer signs its own certificate, so each browser warns
   once the first time it opens an address — continue past the warning
   (in Chrome, **Advanced**, then **Proceed**). **[en:tran:This computer]**,
   the tunnel's address and the MP4 are unchanged, and the `http://`
   addresses keep working.

7. The browser page fits the display to its window. Its
   **[en:tran:Full screen]** button (or a double-click on the picture) fills
   the screen, and **[en:tran:Exit full screen]** (or another double-click)
   leaves it; on a phone, full screen also turns the picture sideways for a
   wide display where the browser allows it.
   **On the device watching, the page's buttons come back with the mouse or a tap.**
   Stay on the browser page that is already showing the display: move the mouse
   over its picture or tap the picture once to reveal the buttons. They hide
   when the mouse leaves, or a few seconds after a tap. The pointer shows over the
   picture only while they do.
   **[en:tran:Turn on sound]** is
   needed once, because a browser plays sound only after the page has been
   touched; until then the page plays everything silently. A camera put on
   the screen (Camera Show, or a camera background) is streamed from this
   computer to the page, on this network.

   **To share a phone's camera, open the display on the phone at an `https://`
   address.** Turn on **[en:tran:Let other devices watch]** and **[en:tran:Use HTTPS]**
   first (step 6): only then are `https://` addresses listed under
   **[en:tran:Where to watch]**, this computer's on the network — or use the tunnel's. On such a page **[en:tran:Share my cameras]** opens a
   list of every camera of the device, each with **[en:tran:Share]**. A
   phone lists **[en:tran:Front camera]** and **[en:tran:Back camera]** until
   the browser has been allowed a camera, then every camera it has by name —
   a phone with several back lenses lists each one. The camera shared shows
   its picture above the list and reads **[en:tran:Stop]**; **[en:tran:Share]**
   on another one puts it in its place on every screen showing it, with
   nothing to add again. The app lists it among its cameras as
   `Browser <address>: <camera>`: pick it there, as a Camera Show or a camera
   background, to put it on a screen.

   The page keeps the device from sleeping while it is open. If the app goes
   away, the page reads **[en:tran:Waiting for the display]** and joins again
   by itself.

8. To put the display on a TV, click **[en:tran:Cast to a TV]** — the cast
   icon in the display card's header, beside its size. The list it opens
   shows the TVs the app found on this network (Google Cast, DLNA, Roku),
   looked for only when the list opens: **[en:tran:Cast]** puts the display
   on one and **[en:tran:Stop]** takes it off; **[en:tran:Search again]**
   looks once more. It needs **[en:tran:Let other devices watch]** (step 6)
   on, because the TV plays the display's MP4 address itself.
   **On the phone or tablet watching, the browser page has the same button.** It works
   from any address of **[en:tran:Where to watch]** the page was opened at, `http://` too,
   so **[en:tran:Let other devices watch]** has to be on — the switch at the top of the
   **[en:tran:Virtual Displays]** tab, above the cards (step 6). Its **[en:tran:Cast to a TV]**
   offers one more row:
   - **[en:tran:Cast from this browser]** — a TV on the same network as the
     device holding the page (at home, in another building), through the
     browser's own picker: Chrome and Edge list Google Cast TVs, Safari
     AirPlay ones. The app streams the display to the page for it, and the TV
     then plays it from the app itself, without the operator's
     **[en:tran:Allow connection]** or the connection code. When the browser
     knows no TV, the list says so. A browser that cannot cast (Firefox)
     says that too.
   - On the app's own network, the page's list also shows the TVs the app
     found there, with the same **[en:tran:Cast]**, **[en:tran:Stop]** and
     **[en:tran:Search again]**.
9. **[en:tran:Watching now]** lists everyone watching: **[en:tran:Browser]**
   or MP4, where they are (**[en:tran:This computer]**,
   **[en:tran:This network]** or **[en:tran:Internet]**), their address with
   their browser and device (such as `Chrome · Android` or `VLC`), and
   since when. A device that leaves the page, or drops off the network
   without a word (a phone gone to sleep), leaves the list by itself within
   about 40 seconds. **[en:tran:Disconnect]** ends one and keeps it out of this
   display for ten minutes: a browser by itself (other devices behind the
   same router are not touched), a media player by its address. The browser
   page then says the device was disconnected and stops trying. Its access to
   screen updates, camera streams and interaction ends immediately, even if
   its connection takes longer to close. Each one is
   listed under **[en:tran:Disconnected]**, where **[en:tran:Allow again]**
   lets it back in at once. **[en:tran:Preview]** shows the display
   inside the card, listed as **[en:tran:This app (preview)]**. A browser's
   row — on the display's card in the **[en:tran:Virtual Displays]** tab of step 1 —
   has **[en:tran:Allow interaction]**, off for every new viewer. Turned
   on, a hand on that browser's page reaches the app the way a hand on the
   projector's own window does: scrolling a passage or a tall slide, tapping
   a verse to pick it, and the screen's **✕** (top right, under the mouse)
   hiding that screen. Off, those stay on that device, and the **✕** is not
   shown. A browser keeps
   the permission when its page reloads, until the switch is turned off, the
   viewer is disconnected, or the app restarts. A media player has no switch.
10. **[en:tran:Delete Virtual Display]** asks first. The screens on it are
    hidden and go back to a real monitor — the first one other than the main monitor, or the main monitor when there is no other — as when a monitor is unplugged,
    and everyone watching is disconnected.

_Verify: SP-30, SP-31._

### W-52 — Move your settings to another computer (Export / Import Settings)

**File → [en:tran:Export Data]** moves your files — songs, slides, media. This moves how
the app is SET UP: the language and theme, how a Bible looks on the screen, the
marquee and the timers, the panel sizes, and the rest of what you have chosen
over time.

1. Open **[en:tran:Setting]**. At the bottom of the left sidebar, under
   **[en:tran:Apply Settings]**, are **[en:tran:Export Settings]** and
   **[en:tran:Import Settings]** — the same on every tab. 📸
2. Click **[en:tran:Export Settings]**. A panel lists the settings in sections:
   **[en:tran:General]**, **[en:tran:Bible]**, **[en:tran:Screens]**,
   **[en:tran:Foreground]**, **[en:tran:Background]**,
   **[en:tran:Documents & Lyrics]**, **[en:tran:Layout]**,
   **[en:tran:AI & Assistant]**, **[en:tran:Connections]**,
   **[en:tran:API Keys & Sign-ins]** and **[en:tran:Other Settings]**. Each says
   how many settings it holds, or **[en:tran:All default]** when nothing in it
   was ever changed. Everything starts ticked except the API keys. 📸
3. The arrow at the left of a section opens it, and each part can be ticked on
   its own — **[en:tran:General]** holds **[en:tran:Language]**,
   **[en:tran:Theme]**, **[en:tran:Font]**, **[en:tran:Tips of the Day]**,
   **[en:tran:Folders]** and **[en:tran:File Color Notes]**. A section with only
   some parts ticked shows a dash in its box; ticking the section ticks all of
   them. **[en:tran:Deselect All]** / **[en:tran:Select All]** does every
   section at once.
4. Below the list is the same **[en:tran:Password]** /
   **[en:tran:Confirm Password]** pair as every other export. **API keys and
   sign-ins only go into a file with a password**: their rows stay red with
   **[en:tran:Type a password below to include these]** until one is typed, and
   come back unticked if it is cleared. Typed differently, the two fields say
   **[en:tran:Passwords do not match]** and the panel comes back holding what was
   ticked.
5. Click **[en:tran:Ok]**. `Settings.owasetting.tar.gz` is written to the **Downloads**
   folder (`Settings.owasetting.enc` with a password), and the folder opens on
   it.
6. On the other computer, open **[en:tran:Setting]**, click
   **[en:tran:Import Settings]** and pick the file. A protected file asks for its
   password first.
7. A panel lists the sections the file holds, under the warning
   **[en:tran:Each ticked section replaces the same section on this computer; what the file leaves out goes back to its default]**.
   **[en:tran:Folders]**, **[en:tran:Screen Mirror & Virtual Displays]** and the
   API keys start unticked — they reach past how the app looks. 📸
8. Click **[en:tran:Ok]**. A message says how many settings were written and how many went
   back to their default. The app then offers to reload its windows
   (**[en:tran:Apply Settings]**), or to restart when a ticked section is read
   only at start-up (**[en:tran:Screens & Monitors]**,
   **[en:tran:Screen Mirror & Virtual Displays]**).

> Notes: an import REPLACES each ticked section rather than adding to it — a
> marquee setting changed here but not in the file goes back to its default, and
> a section left unticked is not touched at all. Never carried, whatever is
> ticked: which data folder the app uses, this computer's identity on the
> network and the devices it trusts, whether AI features are switched on,
> conversations with the assistant, and what is on the screens right now. A
> projector window that is open keeps its old look until it is opened again. A
> SongSelect sign-in copied this way can sign one of the two computers out the
> next time either refreshes it.

Steps 1–2 and the Khmer labels were observed live 2026-10-09; steps 3–8 press
inside the app's own dialog, which the MCP firewall leaves to a person, and are
unit-tested until a person's run ticks them.

_Verify: ST-61..ST-66._
