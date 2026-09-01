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

**workflowsVersion: 2026-08-31g** (**W-42: every chat tab has a menu, and a chat can be locked.** A **⋮** at the left of each tab — or a right-click on it — opens that tab’s menu: rename it, lock it, close it, **Close other chats…**, **Clear all chats…**. The last two take more than one conversation, so they ask first, on a line under the strip that says how many will go. **Lock this chat** takes the tab’s **×** away, puts a 🔒 in its place, and makes both sweeping actions step around it — so the strip can be cleared at the end of a service with the one answer worth keeping still in it. Verified live 2026-08-31 on the reader: the menu on a plain and on a locked tab, both confirmations, a solo and a clear that each left the locked tab standing, and the lock read back off disk.)

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
book-level one. A file that matched the book-level half carries a dashed **Introduction**
(សេចក្ដីផ្ដើម) tag, so a `1CH.0.pdf` listed under chapter 1 explains itself. Nothing moved
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
the app-managed bibles folder by hand. Settings → Bible grows a **Bible Data**
(ទិន្នន័យព្រះគម្ពីរ) card under **Import XML File**, with the same picker + optional
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
step 11: the Presenting Flows list menu now also offers **Import From URL** (នាំចូលពី URL), so a
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
Its step 2 covers **Add Action** (បន្ថែមសកម្មភាព) and the five clears it offers, step 4
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

- **Header:** page tabs — **Presenter** / **Bible Reader** (អានព្រះគម្ពីរ) /
  **Slide Editor** (កែសម្រួលស្លាយ) — the **Bible Lookup** (ស្វែងរកព្រះគម្ពីរ) button
  (center, `Ctrl+B`), and the **Settings** gear (ការកំណត់) + Help buttons (right). 📸
- **Left column:** your content libraries — the **Documents** (ឯកសារ) list (songs live
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
- **Pin the document so you cannot lose it by a stray click** — see W-27.

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

**Goal:** look up and read a verse in the Bible Reader — deeper reading than the
quick lookup, and where you look a verse up when you are not presenting.
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
   a second panel ("Bible Online Lookup") appears beside the picker, with **Find**
   (ស្វែងរក) chosen in its dropdown. 📸
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
5. To search part of the Bible only, click the **All Books** (គ្រប់កណ្ឌគម្ពីរ) button
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
   the side panel, then pick **Cross Reference** (ខគម្ពីរយោង) from the panel's dropdown —
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
   whole section; right-click it for **Refresh** (ផ្ទុកឡើងវិញ), which re-fetches.
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

6. Save with **Ctrl+S**.

**Lyrics:** right-click a song in the Documents list → **edit** — the Lyric Editor opens
in its own window; edit the text/chords and save with **Ctrl+S**. 📸

**Web backgrounds:** Background panel → **Web** tab → **+** — the Web Editor opens;
enter the URL and title, save, and the new item appears in the Web tab.

_Verify: ED-01..11, ED-45, ED-46, PU-02, PU-04, PL-09, PL-11, PL-24, CM-23, CM-43, PM-33, PM-124._

---

## Configuration

### W-16 — Settings: language, theme, fonts, folders

**Goal:** configure the app.

1. Click the **gear** (ការកំណត់) in the header — Settings opens in its own window. 📸
2. **General** tab:
   - **Language:** click **English** or **ខ្មែរ**. Each language is listed under its
     OWN name, whatever locale you are currently in — so if a mis-click leaves you in
     a script you cannot read, the way back is still legible. (Hover a button and its
     `title` gives the English name.) Some
     labels change straight away, but the switch is only complete once you click
     **Apply Settings** (អនុវត្តការកំណត់) at the bottom-left — that reloads every open
     window. Unsaved edits in the Slide Editor are kept.
   - **Theme:** system / light / dark.
   - **Font family:** the font used for on-screen text. A font marked `(Missing)` is
     configured but not installed on this computer.
   - **Directories:** where documents, lyrics, and bibles are stored on disk.
   - **Reset buttons** (`Reset All Child Directories` / `Clear All Settings`):
     **these erase configuration; use with care.** `Reset All Child Directories`
     asks for confirmation first; `Clear All Settings` does **not**.
   - Panel sizes are no longer reset from here — see **W-31**.
3. **Bible** tab: search available Bible versions, download new ones, enable/disable
   downloaded ones. 📸
4. Click **Apply Settings** (top-right) to apply — the app windows reload.

_Verify: ST-01..09, LT-02..04._

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
   Mac). A floating **Presenting Control** panel appears — drag it by its title bar,
   resize it from any edge or corner, double-click the title bar to fill the window (and
   again to put it back), and collapse it with the chevron; it reopens where and how you
   last left it. 📸
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

### W-22 — Build a service presenting flow (and share it)

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

_Verify: PL-10, PL-29, PL-32..PL-76, PL-81..PL-96, PL-101._

---

### W-23 — Share one document (song, sermon slides, PDF) with another machine

Sometimes you only want to hand over **one** item, not a whole service. A document
travels as its own bundle, with everything attached to it.

1. In the **Documents** list, right-click the item you want — an Open Worship slide
   document, a lyric, a PDF, a PowerPoint or a Word file all work — and choose
   **Export** (នាំចេញ). 📸
2. A small panel asks for a **Password** (ពាក្យសម្ងាត់) and a **Confirm Password**
   (បញ្ជាក់ពាក្យសម្ងាត់). Leave both empty and press **Ok** for the ordinary bundle, or
   type the same password in both to lock it — see W-22 step 10a, it works identically
   here and there is no way to recover a forgotten one. 📸
3. You get one `<name>.owadoc.tar.gz` file in your **Downloads** folder (or
   `<name>.owadoc.enc` if you set a password), and the folder opens. It contains the
   document itself plus everything hanging off it: the background you attached to it
   (and that background's image or video file), any video placed inside its slides, and
   its colour note.
4. On the other machine, right-click an empty part of the **Documents** list →
   **Import** (នាំចូល) and pick that file — or just **drag the
   `.owadoc.tar.gz` (or `.owadoc.enc`) file from your file manager onto the Documents
   list**, which imports it the same way. A protected bundle asks for its password
   first; an ordinary one never does. 📸
5. The document appears in that machine's documents folder under its original name, with
   its background re-attached and its colour note restored, so it is ready to present
   straight away.
6. If the bundle is on a web server or a machine sharing it over the local network, use
   **Import From URL** (នាំចូលពី URL) instead and paste the link. The
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

### W-24 — Share a bible list with another machine

A bible list (the verses you lined up for a service) travels the same way.

1. In the **Bibles** panel, right-click the list you want and choose **Export**
   (នាំចេញ). A small panel asks for a **Password** (ពាក្យសម្ងាត់) and a **Confirm
   Password** (បញ្ជាក់ពាក្យសម្ងាត់) — leave both empty for the ordinary bundle, or type
   the same password in both to lock it (W-22 step 10a). You get one
   `<name>.owbible.tar.gz` file in your **Downloads** folder, or `<name>.owbible.enc`
   if you set a password. 📸
2. The bundle is small: a bible list stores verse _references_, not the Bible text, so
   only the list and any background you attached to it (or to one of its verses) are
   inside.
3. On the other machine, right-click an empty part of the **Bibles** panel → **Import**
   (នាំចូល) and pick the file — or **drag the `.owbible.tar.gz` (or `.owbible.enc`) onto
   the Bibles panel**; a protected one asks for its password first. **Import From URL**
   (នាំចូលពី URL) works here too. 📸
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
2. A panel lists every data folder you have set up — Documents, Presenting Flows, Background
   Images, Videos, Audios and Webs, Bible Present, Bible Reader, Notes, and **Bibles XML**
   — with the folder each one points at. **They all start ticked.** Untick anything you do
   not want (the videos folder is usually the big one), or use **Select All** /
   **Deselect All**. 📸

   > **Bibles XML** is the one folder you never chose yourself — the app keeps it. It
   > carries the Bible XML files you added by hand (Settings → Bible → Bibles XML), and
   > **only those**: the Bible versions you downloaded in the app are left out, because
   > you simply download them again on the other machine. If you have never added an XML
   > Bible, the row is not offered at all.
   > 2a. Below the folder list, the same panel asks for a **Password** (ពាក្យសម្ងាត់) and a
   > **Confirm Password** (បញ្ជាក់ពាក្យសម្ងាត់). Leave both empty for an ordinary backup.
   > Type the same password in both to lock it — a backup carried on a USB stick holds your
   > whole document set, so this is the one worth protecting. 📸

   > **There is no way to recover a forgotten password**, and this file is everything you
   > have. Write it down somewhere that is not the same USB stick.

3. Press **Ok**. You get one `open-worship-data.owadata.tar` file in your **Downloads**
   folder — or `open-worship-data.owadata.enc` if you set a password — and the folder
   opens. Copy it to a USB stick or the other machine.
4. On the other machine, choose **File → Import Data** (នាំចូលទិន្នន័យ) and pick that
   file. A protected backup asks for its password first. The panel then lists only the
   folders the file actually contains — again all ticked — so you can restore just the
   songs, or just the backgrounds. 📸

   > A protected backup is unlocked in one pass before that list can be shown, so a big
   > one takes a moment longer to open than an ordinary one. An ordinary backup is read
   > as quickly as it always was.

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

### W-26 — Compare two documents side by side (floating slide previews)

**Goal:** look at the slides of more than one document at the same time, without losing
the one you already had open.

**Preconditions:** at least two documents in the **Documents** list.

The middle panel previews the **one** document you have selected. To look at another one
as well, give it a window of its own.

1. In the left **Documents** (ឯកសារ) list, **right-click** a document you have NOT
   selected and choose **Open Slides Preview** (បើកការមើលស្លាយជាមុន). A window titled
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

1. Look at the middle **Documents** (ឯកសារ) tab heading. With a document selected, a
   faint **pin** sits just after the word — nothing selected, no pin. 📸
2. Click the pin. It fills in and turns amber: the document is now **pinned**. Hovering it
   reads **Unpin document** (ដោះខ្ទាស់ឯកសារ). 📸
3. Click a different document in the left list. **Nothing changes** — the previewer keeps
   your document. A message says **Document is pinned** / _Unpin the document to preview
   another one_ (ឯកសារត្រូវបានខ្ទាស់), and the pin flashes so you can see what stopped
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

1. Pick a tab in the bottom **Background** panel — **Colors** (ពណ៌), **Images** (រូបភាព),
   **Videos** (វីដេអូ), **Cameras** (កាមេរ៉ា) or **Webs** (វេប). The presenter also has an
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
   **Names and locations lookup** (ការស្វែងរកឈ្មោះ និងទីកន្លែង). A small floating
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
   the King James verses themselves do not change — those follow the King James
   wording, which is what makes them findable at all. The lists, the record
   windows and the "in your reading" panel are also **typed in that language's own
   script and font** — the name across the top of a record window included — and the
   kind of each record — **People** (មនុស្ស), **Groups**
   (ក្រុម), **Places** (ទីកន្លែង) — is named in it too, in the filter and on each
   record. Every record also carries its **English name in brackets** beside its own —
   _ម៉ូសេ (Moses)_, _យេរូសាឡិម (Jerusalem)_ — the way a Bible book reads
   _លោកុប្បត្តិ (Genesis)_, so a name you only know in English is still recognizable.
   With `en` chosen nothing is added: the name already is the English one. 📸
3. Use the **Names** (ឈ្មោះ) and **Locations** (ទីកន្លែង) tabs to choose what you are
   looking for, and type in the search box. Each tab remembers what you typed, so you
   can switch back and forth. The list updates as you type. You may type in **either
   language** — with Khmer records on screen, `Moses` and `ម៉ូសេ` both find him.
4. On the **Names** tab the dropdown beside the tabs narrows the list by kind —
   **All types** (គ្រប់ប្រភេទ), **People** (មនុស្ស), **Groups** (ក្រុម),
   **Places** (ទីកន្លែង) and so on. These follow the **lookup** language from step 2,
   not the app's, so they read the same way as the records they filter. It is greyed
   out on the **Locations** tab, where there is nothing to filter.
5. Use the arrows at the bottom to page through results, or type a page number in the
   little box and press **Enter**. Starting a new search always takes you back to
   page 1. 📸
6. Click a result to open it in its own small window: a small icon for what kind of
   record it is — a person, a place, a book for a verse — then a short description, then
   a **Details** (ព័ត៌មានលម្អិត) section with things like **Also called**, **Type**,
   **Gender**, **Parents**, **Children** and **Verses** (ខគម្ពីរ). 📸
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
   window's title bar, **Open in bible lookup** (បើកក្នុងការស្វែងរកព្រះគម្ពីរ), loads
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
   opens on the right, its header a **drop-down** listing three views: **Find**
   (ស្វែងរក), **Cross Reference** (ខគម្ពីរយោង) and **Location-Name (KJV)**
   (ទីកន្លែង-ឈ្មោះ (KJV)). Pick the third one. 📸
   _The icon to the left of the drop-down changes with your pick — a signpost for cross
   references, a map pin for names and locations — so you can tell at a glance which
   view the panel is showing._
2. Under the heading **Names and locations in your reading** — it says **(KJV)** too
   while you are reading these records in English; see the note at the end — you get
   **one block
   per passage you have open**. Each block is titled with the passage it belongs to,
   e.g. `(KJV) LUK 13:1-35`, and lists **Names** (ឈ្មោះ) first, then **Locations**
   (ទីកន្លែង), with a count beside each. 📸
3. Every row shows the person or place, the verses of that passage where it comes up
   (`13:4, 13:22, 13:33, 13:34`), and a one-line description. A name that appears in
   several verses is listed **once**, with all of its verses on the row. Reading the
   records in a language other than English, each row carries its **English name in
   brackets** too — _យ៉ូហាន (John)_ — exactly as the lookup list does.
4. Open a second passage (split the reading area, or open another reference) and the
   panel grows a second block for it — so you can see the people of two passages at
   once. A passage with nobody in it says **No matches** (រកមិនឃើញ).
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
still a King James one. What the list FINDS is always read from the King James text, and the
underlined names in the verses themselves stay King James whatever you pick.

_Verify: RD-72, RD-73, RD-74, RD-75, RD-76, RD-57, RD-80, RD-91._

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

5. **View → Reset Widgets Size** (កំណត់ទំហំ Widgets ឡើងវិញ). Answer **Yes** to
   `Are you sure to reset every widget size and reopen the widgets?` 📸
6. Every panel returns to the width and height it had when the app was installed, and
   **any panel you had collapsed is reopened**. This happens immediately — no reload.
   Answer **No** and nothing changes.

> This used to be a button in Settings → General, where it did nothing until you also
> clicked **Apply Settings** and the app reloaded. It is on the View menu now and takes
> effect at once.

_Verify: NAV-20, NAV-21, ST-22._

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
   reads **Bible Information** (ព័ត៌មានព្រះគម្ពីរ).
3. Click **ⓘ**. A card opens in the middle of the window. 📸 It lists:
   - **Title** (ចំណងជើង) — the edition's full name, e.g.
     `Khmer BFBS (ព្រះគម្ពីរបរិសុទ្ធ ១៩៥៤)`
   - **Key** (កូនសោ) — the short code shown on the badge, e.g. `ពគប`
   - **Version** (កំណែ), **Locale** (ភាសា) — e.g. `Khmer (ភាសាខ្មែរ) (km-KH)`
   - **Publisher** (អ្នកបោះពុម្ពផ្សាយ), **Copy Rights** (រក្សាសិទ្ធិ),
     **Legal Note** (កំណត់សម្គាល់ផ្លូវច្បាប់) — e.g.
     `© BFBS/UBS 1954, 1962. All Rights Reserved.`
   - **Description** (ការពិពណ៌នា), **Books** (គម្ពីរ) — how many books this edition
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

1. Open **Settings → Bible** (ព្រះគម្ពីរ). Under the **Import XML File**
   (នាំចូលឯកសារ XML) box on the left there is a card headed **Bible Data**
   (ទិន្នន័យព្រះគម្ពីរ). 📸
2. Click **Export Bible Data** (នាំចេញទិន្នន័យព្រះគម្ពីរ). A panel opens listing every
   translation you have, one row each, showing its short **key** (`KJV`, `GKHB`, `ពគប`…)
   and its full title. Everything starts ticked. Untick the ones you do not want, or use
   **Deselect All** (ដកការជ្រើសរើសទាំងអស់) and pick just a few. 📸
3. Below the list, the same **Password** (ពាក្យសម្ងាត់) / **Confirm Password**
   (បញ្ជាក់ពាក្យសម្ងាត់) pair as every other export: leave both empty for the ordinary
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
   click **Import Bible Data** (នាំចូលទិន្នន័យព្រះគម្ពីរ) and pick it. A protected
   bundle asks for its password first, and says **Wrong password, try again** rather
   than failing outright. 📸
6. A panel lists what is inside. Anything that can come in is ticked. Anything that
   **cannot** is shown as a **red row** you are not allowed to tick, with the reason on
   the right:
   - **Bible key already exists** (លេខកូដព្រះគម្ពីរនេះមានរួចហើយ) — you already have a
     translation with that key. Upper and lower case count as the same key, so a `kjv`
     in the bundle is refused against a `KJV` you already have.
   - **Duplicate bible key in this archive** (លេខកូដព្រះគម្ពីរស្ទួនក្នុងឯកសារបណ្ណសារនេះ)
     — two entries in the same bundle claim the same key; the first one is offered.
   - **Unable to read this bible file** (មិនអាចអានឯកសារព្រះគម្ពីរនេះបានទេ) — the app
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

1. Open **Settings** (Tools → Settings, or the ⚙ button) and pick the **Bible**
   (ព្រះគម្ពីរ) tab. Top-left is the **Import XML File** (នាំចូលឯកសារ XML) box. 📸
2. Leave **Choose File** alone and paste the link into the **URL:** box instead. As soon as
   the link is a valid address the file row dims out and **Import** (នាំចូល) lights up.
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
> orange ↺ button, **Reset Bible XML** (កំណត់ XML ព្រះគម្ពីរឡើងវិញ), to the LEFT of the ✏️ pencil.
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
> **+ Create KJV Bible XML** (បង្កើតឯកសារ XML ព្រះគម្ពីរ KJV) row sits at the TOP
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

1. Open **Settings → Others** (ផ្សេងៗ). Between the AI-key card and **Extra Binaries**
   there is a card headed **SongSelect Integration** (ការភ្ជាប់ SongSelect), with a
   **SongSelect ↗** button that opens songselect.ccli.com in your browser. 📸
2. Fill **Client ID**, **Subscription Key** and **Redirect URI** (and **Client Secret**
   if you have one). Each field saves the moment you click away from it and gains a
   green ✓. Until all three are filled, **Sign In** (ចូលគណនី) stays grey — hovering it
   tells you what is missing.
3. Click **Sign In**. A CCLI window opens for you to log in and approve. If you close
   it instead, the app says **Sign in failed — Sign in was canceled**
   (ការចូលគណនីត្រូវបានបោះបង់) and nothing changes. Once signed in, the card shows a
   green **Signed in** (បានចូលគណនី) with a **Sign Out** (ចាកចេញពីគណនី) button, and the
   app keeps the session refreshed by itself.
4. Back in the presenter, open the **Documents** list's **⋮ More Options**. A new entry,
   **Import From SongSelect** (នាំចូលពី SongSelect), now sits under
   **Download From URL** — it is only there while you are signed in. 📸
5. Click it. A floating **Import From SongSelect** panel opens (drag it anywhere; the
   app remembers where you put it). Type in **Search songs** (ស្វែងរកចម្រៀង) — results
   appear as you pause, with the writers, the CCLI song number, a line of the lyrics,
   and a **Public Domain** (កម្មសិទ្ធិសាធារណៈ) badge where it applies. Page through
   long result lists with the ‹ › arrows at the bottom. A song your account is not
   licensed to take has its download button greyed out. 📸
6. Click a song's ☁⬇ download button. A moment later the app confirms **Lyric document
   created successfully** (បានបង្កើតឯកសារអត្ថបទចម្រៀងដោយជោគជ័យ) and the song appears
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
   **Import From Public Domain Songs**
   (នាំចូលពីចម្រៀងកម្មសិទ្ធិសាធារណៈ). Unlike the SongSelect entry above it is
   _always_ there. 📸
2. A floating panel opens listing the whole catalog straight away — each row shows the
   title, the writers, the year, and the first line, with a count at the top right of the
   search box (36 at the time of writing). Scroll to browse, or type in **Search songs**
   (ស្វែងរកចម្រៀង) to filter instantly by title or writer — the count follows. 📸
3. Click a song's ☁⬇ download button. The app confirms **Lyric document created
   successfully** (បានបង្កើតឯកសារអត្ថបទចម្រៀងដោយជោគជ័យ) and the song appears in your
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

If you already keep study material on disk named after the verse it belongs to —
`PSA.1.pdf`, `GEN.49.pptx` — **Resources** (ឯកសារពាក់ព័ន្ធ) puts those files
right beside whatever verse you are reading, from as many folders as you like.

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
   You can also get here from the verse itself: right-click any verse in the lookup body
   and choose **Open in Resources** (បើកនៅក្នុងឯកសារពាក់ព័ន្ធ), just under **Open in
   Cross Reference**. That opens the panel on this view AND on that verse.
2. The top of the view shows the verse it is working from — its version, its reference and
   its text, exactly as **Cross Reference** shows it. Click the reference to move to
   another verse, or the version chip to read it in another translation. Under it sit the
   file-name patterns being looked for, so you can always see what it is matching — for
   anywhere in Psalm 1, a solid `PSA.1.*` for the chapter's own files and a dashed
   `PSA.0.*` for the book's. Moving to another verse of the same chapter changes the
   heading but not the files. 📸
3. The first time, the body holds a single **Add Folder** (បន្ថែមថត) button. Click it and
   pick the folder your files are in. You can add as many as you want — the **⋮ More
   Options** button, or a right-click anywhere in the view including the empty space below
   the folders, offers **Add Folder** again. Adding the same folder twice does nothing. 📸
   That same menu has **Reload** (ផ្ទុកឡើងវិញ), which re-reads everything at once: your
   folder list, and the files inside every folder. Use it after adding files on disk while
   the app is open, or after changing the list from another window. 📸
4. Each folder becomes its own group, named after the folder, with the folder it lives in
   shown beside the name and the full path if you hover it. Under the name, hanging off a
   single vertical line, are the matching files — **from that folder and every folder
   inside it** — sorted by file type, each with its own icon (PDF, Word, PowerPoint,
   video, image, bible note). The extension is set quieter than the rest of the name so the
   reference reads first. Hover a file to see where it actually lives. 📸
   A file that matched the book-level pattern rather than this chapter's carries a dashed
   **Introduction** (សេចក្ដីផ្ដើម) tag, so a `PSA.0.pdf` listed under Psalm 1 says why it
   is there. A group with nothing for this verse says **No matching files**.
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
6. Click a file to open it in whatever application your computer normally uses for it — a
   PDF in your PDF reader, a PowerPoint in PowerPoint. Right-click one for **Open**,
   **Copy Path to Clipboard**, or **Reveal in Finder** / **Reveal in File Explorer**.
7. Click a group's header to fold it away; it stays folded next time. Right-click a header
   for **Refresh** (re-reads that one folder — **Reload** in step 3 does all of them),
   **Add Folder**, **Reveal in Finder**/**File Explorer**, and **Remove Folder**,
   which asks you to confirm and then only removes it from this list — nothing on disk is
   touched. 📸

> **Watch the numbering.** The chapter number has to stand on its own between two dots. For
> Psalm 1 that means `PSA.1.pdf` is found while `PSA.10.pdf`, `PSA.100.pdf` and `PSA.149.pdf`
> are left alone — which is exactly what you want, since a full set of the Psalms has all of
> them in one folder. Write the numbers plainly: no leading zeros (`PSA.01.pdf` is not
> found), and `-0` is not a number. Upper and lower case do not matter.

> **If a group shows a warning** instead of files: **Folder not found** means the folder was
> moved, renamed or deleted since you added it (remove it and add it again);
> **Cannot read folder** means the app is not allowed to read it. **Too many folders to
> search** means the folder tree was too large to finish — point Resources at the folder
> your material is actually in rather than at a whole drive.

_Verify: RD-81, RD-82, RD-83, RD-84, RD-85, RD-86, RD-87, RD-88, RD-89, RD-90, CM-93._

---

### W-38 — See how people and places connect (Connection Graph)

The record window tells you _who_ someone is. The graph shows you _how they connect_ —
parents, spouses, children, cousins and places, all on one canvas you can explore.

1. Open the **Names and locations lookup** (`👤📍`) from the Bible Lookup header and find
   a person — try **Jacob** (យ៉ាកុប). 📸
2. Click the **⋮** at the right end of the row — or **right-click** the row — and
   choose **Open Graph Preview** (បើកមើលក្រាបទំនាក់ទំនង). A floating window opens with
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
   **Find Connection** (រកទំនាក់ទំនង). The canvas fills with the generations from David
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
10. Opening a record always starts you at that record, with one box — every time, however
    you left the window last time. 📸
    > If an arrangement is worth coming back to, say so: `⋯` → **Save preset**, name it,
    > and it is waiting in that same menu next time.

_Verify: RD-92, RD-93, RD-94, RD-95, RD-96, RD-97, RD-98, RD-99, RD-100, RD-101,
RD-102, RD-103, RD-104, RD-105, RD-106._
### W-39 — Let the passage scroll itself while you read

When a chapter is longer than the panel, you do not have to keep reaching for the mouse
wheel — the app can scroll it for you, at whatever pace you set.

1. Open a passage long enough to scroll, in a Bible panel or on the screen preview.
   Down in the bottom-right corner of the text, two faint controls sit one above the
   other: an up-arrow (**Scroll to the top** / រំកិលទៅលើគេ) and a double chevron below it.
   The double chevron is the auto-scroll button. 📸
2. Click the double chevron once. The text starts creeping downward. Click it again and
   it goes faster; each click adds a little more speed.
3. As soon as it is moving, a **⋯** appears just to its left. Click it. 📸
   A small menu opens listing everything this button can do, with the mouse action for
   each one written beside it:
   - **Auto Scroll Speed** (ល្បឿនរំកិលដោយស្វ័យប្រវត្តិ) — how fast it is going right now.
   - **Speed Up** (បង្កើនល្បឿន) — the same as clicking the chevron.
   - **Speed Up Faster** (បង្កើនល្បឿនខ្លាំង) — a bigger jump, the same as double-clicking it.
   - **Slow Down** (បន្ថយល្បឿន) — the same as right-clicking it.
   - **Stop Auto Scrolling** (បញ្ឈប់ការរំកិលដោយស្វ័យប្រវត្តិ) — the same as Alt + right-click.
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
4. Look at the left panel and open **Bible Notes** (កណ្ណត់ត្រាព្រះគម្ពៀរ). Under
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
   - **Add to Bible List** (បន្ថែមទៅបញ្ជីព្រះគម្ពីរ) — puts that verse in your **Bibles**
     list, ready to present, without going and looking it up again.
   - **Move To** (ផ្លាស់ទីទៅ) — moves the whole row, marks and all, into one of your other
     note files.
   - **Delete** (លុប) — removes the verse and everything marked on it, after asking.
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
   its name) and choose **Export** (នាំចេញ). It sits just under **Import**. 📸
2. A small panel asks for a **Password** (ពាក្យសម្ងាត់) and a **Confirm Password**
   (បញ្ជាក់ពាក្យសម្ងាត់). Leave both empty for an ordinary bundle, or type the same
   password in both to lock it. Press **Ok** (យល់ព្រម).
3. You get one `<name>.owanote.tar.gz` file in your **Downloads** folder —
   `<name>.owanote.enc` if you set a password — and the app opens the folder on it. 📸

   > Everything a note points at rides inside: a picture you pasted, a clip you inserted,
   > the sound file you attached. That makes this bundle much larger than a bible list's,
   > so give a note full of video a moment to finish.
4. On the other machine, click the `⋮` at the top of the **Bible Notes** panel → **Import**
   (នាំចូល) and pick the file — or **drag the `.owanote.tar.gz` (or `.owanote.enc`) onto
   the Bible Notes panel**. A protected one asks for its password first.
   **Import From URL** (នាំចូលពី URL) works here too if the bundle is on the web. 📸
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

1. Click the **🤖** button in the top-right corner of the window, just left of the
   **?**, or open **Help** → **App Help (Chatbot)** in the menu bar. A narrow window
   opens beside the app. 📸
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
5. The rest of the top line belongs to the tab in front. **Presenter** / **Bible
   Reader** says which half of the app you are asking about: it starts on whichever one
   you opened the window from, and the suggested questions change with it. Another tab
   can be asking about the other half at the same time. 📸
6. Type a question and press **Enter**, or click one of the suggestions. Answers arrive
   with follow-up buttons: **Read all of W-xx** opens the full recipe, the other buttons
   are the next-best matches. 📸
7. Under every answer is **Copy**, which puts that answer on the clipboard and says
   **✓ Copied**. Under every question of yours is **Ask again** — or just click the
   question itself — and the same words go back in the box, ready to be changed a
   little and asked again. 📸
8. Ask **"where is …"** and name a button — the chatbot outlines it in **red** in the app
   window for a few seconds, and tells you where it is. Nothing is clicked for you. 📸
9. Ask about screens ("is any screen showing?") and the answer comes from the live app,
   not the manual — with a **Hide every screen** button offered, never pressed for you.
10. With an **AI key** set in **Settings** (កំណត់) → **Others** → **AI Providers**, the
   same window becomes a real conversation: the model answers, using the same app
   knowledge and the same tools. Without a key — or when the internet is down — it
   still answers from the manual, and says so; with no key at all it also tells you that
   Claude and ChatGPT need one, and gives you an **Open AI settings** button that goes
   straight to the panel that takes it.
11. **Claude** and **ChatGPT** sit in that same top line, and you can change your mind
   between two questions: the one whose key you have set can be picked, the other stays
   greyed out until you add its key in the same Settings panel. Beside them is the
   **model** that will answer — **Opus 5**, **GPT-5** — and it is a list you can change.
   Hold the mouse over a name to see what it is good for, how quick it is and what it
   costs, e.g. `gpt-5 · best answers · slower · $1.25/$10 per 1M tokens`; the smaller
   models answer a "how do I" just as well for a fraction of it. Choose **More models…**
   at the bottom of the list and the window asks your own account what else it can run
   and adds those too. Each tab keeps its own provider and model, and a new tab starts
   on the last pair you picked. 📸
12. Every answer offers **Show me step by step**. Press it and a numbered card
   appears in the corner of the app window itself, with the button for the current
   step **circled in red**: press **Next** on the card when you have done it, or
   just do it — clicking the circled button moves the card on by itself. **Back**
   returns a step, **✕** stops. Steps you have already done are not shown: asked
   from the Bible Reader, a recipe that starts "click the Bible Reader tab" starts
   at the step after it instead. 📸
13. **Do it for me** runs the same walkthrough with the app driven for you: the
   card's button becomes **Do it**, and each press clicks the circled control (or
   types the text) and moves to the next step. One press per step — nothing runs
   ahead of you — and **Skip** does a step yourself. When a step has nothing to
   click, the card says so and waits. Anything that changes what the congregation
   sees is offered, never done for you unasked. 📸
14. The window answers about the half of the app you are in — asked from the Bible
   Reader, you are told the reader's way, never the presenter's (they differ: the
   presenter looks a verse up in a **Ctrl+B** popup, the reader has no such popup).
   It follows you: switch the app to the other page and the next answer follows,
   unless you have pressed one of the two buttons yourself. Answers are in English.

   > Nothing here leaves the machine unless you set a key. The manual is bundled inside
   > the app.
15. To turn the whole feature off, untick **Enable AI features** in the same settings
   section and restart the app: the chatbot, its tools and the debugging endpoint they
   use are then never started.

_Verify: CB-01, CB-02, CB-03, CB-04, CB-05, CB-06, CB-07, CB-08, CB-12, CB-13, CB-14, CB-15._
